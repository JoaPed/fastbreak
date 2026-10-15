// Relatório de lesões da NBA (ESPN) → tabela injuries; e avisos antes dos jogos a quem os ligou no site
// (os avisos estão prontos mas desligados por agora: o site não mostra a opção, por isso ninguém os tem ligados).
// Para cada membro com avisos (email e/ou ntfy), vê o lineup de hoje de cada conta: o submetido no Top Shot (lido da
// blockchain), senão o que marcou no site (jogo a jogo), senão o do plano do site. Avisa quando alguém desse lineup
// entra no relatório ou muda de estado, quando sai dele, e uma última vez perto do jogo se continuar em dúvida.
// Uso: node scripts/sync-injuries.mjs [--test]   (--test manda uma mensagem de teste a quem tem avisos ligados)
// Segredos: SUPABASE_URL, SUPABASE_SERVICE_KEY; para email SMTP_USER e SMTP_PASS (Gmail com palavra-passe de app).
import { supa, must, getState, setState, etDate, fetchJson, upsertChunks, parseEspnInjuries, buildAlerts, alertText, playerKey, INJ_LABEL } from './lib.mjs';

const TEST = process.argv.includes('--test');
const TZ = process.env.ALERT_TZ || 'Europe/Lisbon';
// link do site nas mensagens: SITE_URL, ou o GitHub Pages do repositório onde a tarefa corre (dono.github.io/repo)
const GH = String(process.env.GITHUB_REPOSITORY || '').split('/');
const SITE = (process.env.SITE_URL || (GH.length === 2 && GH[1] ? 'https://' + GH[0].toLowerCase() + '.github.io/' + GH[1] + '/' : '')).trim();
const sb = globalThis.__FB_TEST_SB || await supa(); // (nos testes: base de dados falsa)
const now = Date.now(), stamp = new Date(now).toISOString();

// ---------- 1) relatório de lesões ----------
const { json } = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries');
const rows = json ? parseEspnInjuries(json) : [];
const count = {}; rows.forEach(r => { count[r.status] = (count[r.status] || 0) + 1; });
console.log('Relatório de lesões (ESPN):', rows.length, 'jogadores ·', Object.entries(count).map(([k, n]) => (INJ_LABEL[k] || k) + ' ' + n).join(', ') || '—');
if (rows.length) {
  try {
    await upsertChunks(sb, 'injuries', rows.map(r => Object.assign({}, r, { updated_at: stamp })));
    await must(sb.from('injuries').delete().lt('updated_at', stamp)); // quem saiu do relatório
  } catch (e) {
    console.log('Aviso: não consegui guardar o relatório (' + e.message + '). Corre o supabase/schema.sql novo no Supabase (SQL Editor).');
  }
} else console.log('A ESPN não devolveu lesões: fica o relatório anterior.');
const injuries = new Map(rows.map(r => [r.id, r]));

// ---------- 2) quem quer avisos ----------
let subs;
try { subs = await must(sb.from('alerts').select('*')); }
catch (e) { console.log('Sem a tabela alerts (' + e.message + '): corre o supabase/schema.sql novo. Sem avisos.'); process.exit(0); }
const memberIds = new Set((await must(sb.from('members').select('user_id'))).map(m => m.user_id));
subs = subs.filter(s => memberIds.has(s.user_id) && (s.email || s.ntfy));
if (!subs.length) { console.log('Ninguém com avisos ligados.'); process.exit(0); }

// ---------- canais ----------
const SMTP_USER = (process.env.SMTP_USER || '').trim(), SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
let mailer = null;
async function sendMail(to, subject, text) {
  if (!SMTP_USER || !SMTP_PASS) return 'sem SMTP_USER/SMTP_PASS nos segredos';
  if (!mailer) {
    const nodemailer = (await import('nodemailer')).default;
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    mailer = nodemailer.createTransport({ host, port: +(process.env.SMTP_PORT || 465), secure: +(process.env.SMTP_PORT || 465) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  }
  await mailer.sendMail({ from: '"Fastbreak" <' + SMTP_USER + '>', to, subject, text: text + (SITE ? '\n\n' + SITE : '') + '\n\n— Avisos do Fastbreak Run Planner. Desliga-os no site, em Ajustes → Avisos.' });
  return null;
}
async function sendNtfy(topic, title, body, urgent) {
  const res = await fetch('https://ntfy.sh/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ topic, title, message: body, priority: urgent ? 4 : 3, tags: ['basketball'] }, SITE ? { click: SITE } : {})) });
  if (!res.ok) throw new Error('ntfy ' + res.status + ' ' + (await res.text()).slice(0, 120));
}
const emails = new Map();
async function emailOf(uid) {
  if (emails.has(uid)) return emails.get(uid);
  let em = null;
  try { const { data } = await sb.auth.admin.getUserById(uid); em = (data && data.user && data.user.email) || null; } catch (e) { console.log('  sem email para', uid.slice(0, 8), e.message); }
  emails.set(uid, em);
  return em;
}
async function deliver(sub, title, body, urgent) {
  const done = [];
  if (sub.ntfy) { try { await sendNtfy(sub.ntfy, title, body, urgent); done.push('telemóvel'); } catch (e) { console.log('  ntfy falhou:', e.message); } }
  if (sub.email) {
    const to = await emailOf(sub.user_id);
    if (to) { try { const why = await sendMail(to, title, body); if (why) console.log('  email desligado:', why); else done.push('email'); } catch (e) { console.log('  email falhou:', e.message); } }
  }
  return done;
}

if (TEST) {
  for (const s of subs) {
    const done = await deliver(s, 'Fast Break · teste dos avisos', 'Os avisos estão a funcionar. Vais receber uma mensagem destas quando alguém do teu lineup aparecer no relatório de lesões da NBA (ou sair dele), e uma última chamada perto do jogo se continuar em dúvida.', false);
    console.log('Teste para', s.user_id.slice(0, 8) + '…:', done.join(' e ') || 'nada enviado');
  }
  process.exit(0);
}

// ---------- 3) lineups de hoje ----------
const today = etDate(now);
const runs = (await must(sb.from('runs').select('id,name,chain_run_id,fictitious'))).filter(r => !r.fictitious); // runs de teste têm jogos inventados
const days = runs.length ? await must(sb.from('run_days').select('run_id,date,games').eq('date', today).in('run_id', runs.map(r => r.id))) : [];
const state = await getState(sb, 'alerts', {});
if (!days.length) { console.log('Hoje (' + today + ') não há dia de run.'); await setState(sb, 'alerts', buildAlerts({ now, lineups: [], injuries, state }).state); process.exit(0); }
const uids = subs.map(s => s.user_id);
const catalog = new Map();
for (let from = 0; from < 20000; from += 1000) { // a API devolve no máximo 1000 linhas de cada vez
  const page = await must(sb.from('nba_players').select('id,name,team').range(from, from + 999));
  page.forEach(p => catalog.set(String(p.id), p));
  if (page.length < 1000) break;
}
let profiles;
try { profiles = await must(sb.from('profiles').select('user_id,display_name,smurfs').in('user_id', uids)); }
catch (e) { profiles = await must(sb.from('profiles').select('user_id,display_name').in('user_id', uids)); }
const userRuns = await must(sb.from('user_runs').select('user_id,run_id,plan,roster').in('user_id', uids).in('run_id', days.map(d => d.run_id)));
const chain = await must(sb.from('chain_results').select('*').in('user_id', uids).eq('date', today));
const lineups = [];
for (const s of subs) {
  const prof = profiles.find(p => p.user_id === s.user_id) || {};
  const accs = [{ id: 'main', label: 'Conta principal' }].concat((Array.isArray(prof.smurfs) ? prof.smurfs : []).filter(x => x && x.id).map((x, i) => ({ id: x.id, label: x.topshot_username || 'Smurf ' + (i + 1) })));
  for (const day of days) {
    const run = runs.find(r => r.id === day.run_id), ur = userRuns.find(u => u.user_id === s.user_id && u.run_id === day.run_id) || null;
    const plan = (ur && ur.plan) || {}, roster = (ur && ur.roster) || {};
    for (const acc of accs) {
      let source = null, list = [];
      const c = chain.find(x => x.user_id === s.user_id && (x.account || 'main') === acc.id && (!run.chain_run_id || x.chain_run_id === run.chain_run_id) && Array.isArray(x.lineup) && x.lineup.filter(Boolean).length);
      if (c) { source = 'chain'; list = c.lineup.filter(Boolean).map(name => ({ id: playerKey(name), name })); }
      else {
        const pa = acc.id === 'main' ? plan : ((plan.smurfs || {})[acc.id] || {});
        const live = (pa.live || {})[today], next = ((plan.next || {})[acc.id] || {})[today];
        const ids = live && live.active && (live.lineup || []).length ? (source = 'live', live.lineup) : Array.isArray(next) && next.length ? (source = 'plan', next) : [];
        list = ids.map(id => ({ id: String(id), name: (roster[id] || {}).name || (catalog.get(String(id)) || {}).name || String(id) }));
      }
      if (!list.length) continue;
      const players = list.map(p => {
        const team = (catalog.get(p.id) || {}).team || (roster[p.id] || {}).team || (injuries.get(p.id) || {}).team || null;
        const g = (day.games || []).find(x => Array.isArray(x) && (x[0] === team || x[1] === team));
        return { id: p.id, name: p.name, team, tip: g && g[2] ? Date.parse(g[2]) : null };
      });
      lineups.push({ uid: s.user_id, acc: acc.id, accLabel: acc.label, date: today, source, players, run: run.name });
    }
  }
}
console.log('Lineups de hoje vistos:', lineups.length, lineups.map(l => l.accLabel + ' (' + l.source + ', ' + l.players.length + ')').join(' · '));

// ---------- 4) avisos ----------
const { items, state: next } = buildAlerts({ now, lineups, injuries, state });
const byUser = new Map(); items.forEach(i => { (byUser.get(i.uid) || byUser.set(i.uid, []).get(i.uid)).push(i); });
for (const [uid, list] of byUser) {
  const sub = subs.find(s => s.user_id === uid);
  const { title, body, urgent } = alertText(list, { tz: TZ });
  const done = await deliver(sub, title, body, urgent);
  console.log('Aviso para', uid.slice(0, 8) + '…:', list.map(i => i.kind + ' ' + i.name + ' (' + i.status + ')').join(', '), '→', done.join(' e ') || 'nada enviado');
  if (!done.length) list.forEach(i => { const k = i.date + '|' + i.uid + '|' + i.acc + '|' + i.id; if (state[k]) next[k] = state[k]; else delete next[k]; }); // tenta outra vez na próxima
}
if (!items.length) console.log('Nada de novo para avisar.');
await setState(sb, 'alerts', next);
