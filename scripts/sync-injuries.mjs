// Relatório de lesões da NBA (ESPN) → tabela injuries; e avisos antes dos jogos a quem os ligou no site
// Também: ponto da situação de quem continua em dúvida (às 23h de Lisboa ou 2 h antes do jogo) e o lembrete
// "já fizeste o lineup?" uma hora antes do primeiro jogo do dia.
// Para cada membro com avisos (email e/ou ntfy), vê o lineup de hoje de cada conta: o submetido no Top Shot (lido da
// blockchain), senão o que marcou no site (jogo a jogo), senão o do plano do site. Avisa quando alguém desse lineup
// entra no relatório ou muda de estado, quando sai dele, e uma última vez perto do jogo se continuar em dúvida.
// Uso: node scripts/sync-injuries.mjs [--test]   (--test manda uma mensagem de teste a quem tem avisos ligados)
// Grupo do Telegram (TELEGRAM_BOT_TOKEN): os mesmos avisos para os lineups de toda a gente, numa só mensagem, e o
// lembrete "já fizeram o lineup?" com quem já submeteu. O grupo é descoberto sozinho (o bot tem de lá estar e alguém
// escrever /start@bot) ou vem em TELEGRAM_CHAT_ID.
// Segredos: SUPABASE_URL, SUPABASE_SERVICE_KEY; para email SMTP_USER e SMTP_PASS (Gmail com palavra-passe de app);
// para o Telegram TELEGRAM_BOT_TOKEN (e, se quiseres fixar o grupo, TELEGRAM_CHAT_ID).
import { createRequire } from 'node:module';
import { supa, must, getState, setState, etDate, fetchJson, upsertChunks, parseEspnInjuries, buildAlerts, alertText, buildReminders, reminderText, groupAlertText, groupReminderText, localTime, playerKey, INJ_LABEL } from './lib.mjs';

const require = createRequire(import.meta.url);
require('../docs/core.js'); const FB = globalThis.FB; // estatísticas (especialistas do dia)
const TEST = process.argv.includes('--test');
const TZ = process.env.ALERT_TZ || 'Europe/Lisbon';
const STATUS_HOUR = process.env.ALERT_STATUS_HOUR || '23:00'; // ponto da situação (hora local), ou 2 h antes do jogo
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
const TG_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
// nota visível no resumo da tarefa no GitHub (sem nunca mostrar o token)
const note = msg => { console.log(msg); if (process.env.GITHUB_ACTIONS) console.log('::notice title=Telegram::' + String(msg).replace(/[\r\n]+/g, ' ')); };
if (process.env.GITHUB_ACTIONS && !TG_TOKEN) note('sem o segredo TELEGRAM_BOT_TOKEN: não há mensagens no grupo');
let subs = [];
try { subs = await must(sb.from('alerts').select('*')); }
catch (e) { console.log('Sem a tabela alerts (' + e.message + '): sem avisos pessoais.'); }
const memberIds = new Set((await must(sb.from('members').select('user_id'))).map(m => m.user_id));
subs = subs.filter(s => memberIds.has(s.user_id) && (s.email || s.ntfy));
if (!subs.length && !TG_TOKEN) { console.log('Ninguém com avisos ligados e sem grupo do Telegram.'); process.exit(0); }

// ---------- Telegram: grupo (descoberto pelas mensagens que o bot recebeu, guardado em job_state) ----------
const tg = (method, body) => fetch('https://api.telegram.org/bot' + TG_TOKEN + '/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then(r => r.json()).catch(e => ({ ok: false, description: e.message }));
let tgState = null;
async function tgChat() {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID.trim();
  tgState = tgState || await getState(sb, 'telegram', {});
  const up = await tg('getUpdates', { allowed_updates: ['message', 'my_chat_member'] });
  const chats = ((up && up.result) || []).map(u => (u.my_chat_member || u.message || {}).chat).filter(c => c && (c.type === 'group' || c.type === 'supergroup'));
  const last = chats[chats.length - 1];
  if (last && String(last.id) !== String(tgState.chat)) {
    tgState = { chat: String(last.id), title: last.title || '' }; await setState(sb, 'telegram', tgState); note('grupo encontrado: "' + tgState.title + '"');
    const hi = await tg('sendMessage', { chat_id: tgState.chat, text: '🏀 Olá! Sou o bot do Fast Break. A partir de agora mando aqui as lesões dos vossos lineups, o ponto da situação às 23h e o lembrete "já fizeram o lineup?" uma hora antes dos jogos.' });
    note(hi && hi.ok ? 'olá enviado ao grupo' : 'o olá falhou: ' + ((hi && hi.description) || '?'));
  }
  if (!up || !up.ok) note('não consegui ler as mensagens do bot (' + ((up && up.description) || '?') + '): confirma o token');
  else if (!tgState.chat) note('o bot ainda não viu nenhum grupo: junta-o ao grupo e escreve lá /start@nome_do_bot');
  return tgState.chat || null;
}
async function sendTg(text) {
  const chat = await tgChat();
  if (!chat) { note('ainda não sei o grupo. Junta o bot ao grupo e escreve /start@<nome do bot> lá.'); return false; }
  let r = await tg('sendMessage', { chat_id: chat, text, disable_web_page_preview: true });
  const mig = r && r.parameters && r.parameters.migrate_to_chat_id; // o grupo passou a supergrupo: muda de número
  if (!r.ok && mig) { tgState = Object.assign({}, tgState, { chat: String(mig) }); await setState(sb, 'telegram', tgState); r = await tg('sendMessage', { chat_id: mig, text, disable_web_page_preview: true }); }
  if (!r.ok) note('mensagem falhou: ' + (r.description || '').slice(0, 120));
  return !!r.ok;
}

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

if (TG_TOKEN && !process.env.TELEGRAM_CHAT_ID) await tgChat(); // descobre o grupo (e cumprimenta-o da primeira vez)
if (TEST) {
  if (TG_TOKEN) console.log('Teste no grupo do Telegram:', (await sendTg('🏀 Fast Break · teste. Os avisos de lesões e o lembrete do lineup vão chegar a este grupo.')) ? 'enviado' : 'nada enviado');
  for (const s of subs) {
    const done = await deliver(s, 'Fast Break · teste dos avisos', 'Os avisos estão a funcionar. Vais receber uma mensagem destas quando alguém do teu lineup aparecer no relatório de lesões da NBA (ou sair dele), e uma última chamada perto do jogo se continuar em dúvida.', false);
    console.log('Teste para', s.user_id.slice(0, 8) + '…:', done.join(' e ') || 'nada enviado');
  }
  process.exit(0);
}

// ---------- 3) lineups de hoje ----------
const today = etDate(now);
const runs = (await must(sb.from('runs').select('id,name,chain_run_id,fictitious'))).filter(r => !r.fictitious); // runs de teste têm jogos inventados
const days = runs.length ? await must(sb.from('run_days').select('run_id,date,games,objectives').eq('date', today).in('run_id', runs.map(r => r.id))) : [];
const state = await getState(sb, 'alerts', {});
if (!days.length) { console.log('Hoje (' + today + ') não há dia de run.'); await setState(sb, 'alerts', buildAlerts({ now, lineups: [], injuries, state }).state); process.exit(0); }
const uids = TG_TOKEN ? [...memberIds] : subs.map(s => s.user_id); // com o grupo do Telegram, os lineups de toda a gente
const catalog = new Map();
for (let from = 0; from < 20000; from += 1000) { // a API devolve no máximo 1000 linhas de cada vez
  const page = await must(sb.from('nba_players').select(TG_TOKEN ? 'id,name,team,avg' : 'id,name,team').range(from, from + 999));
  page.forEach(p => catalog.set(String(p.id), p));
  if (page.length < 1000) break;
}
let profiles;
try { profiles = await must(sb.from('profiles').select('user_id,display_name,smurfs,share_plan').in('user_id', uids)); }
catch (e) { try { profiles = await must(sb.from('profiles').select('user_id,display_name,smurfs').in('user_id', uids)); } catch (e2) { profiles = null; } }
if (!profiles) profiles = await must(sb.from('profiles').select('user_id,display_name').in('user_id', uids));
const userRuns = await must(sb.from('user_runs').select('user_id,run_id,plan,roster').in('user_id', uids).in('run_id', days.map(d => d.run_id)));
const chain = await must(sb.from('chain_results').select('*').in('user_id', uids).eq('date', today));
const lineups = [], reminders = [];
for (const s of uids.map(user_id => ({ user_id }))) {
  const prof = profiles.find(p => p.user_id === s.user_id) || {};
  const accs = [{ id: 'main', label: 'Conta principal' }].concat((Array.isArray(prof.smurfs) ? prof.smurfs : []).filter(x => x && x.id).map((x, i) => ({ id: x.id, label: x.topshot_username || 'Smurf ' + (i + 1) })));
  for (const day of days) {
    const run = runs.find(r => r.id === day.run_id), ur = userRuns.find(u => u.user_id === s.user_id && u.run_id === day.run_id) || null;
    const plan = (ur && ur.plan) || {}, roster = (ur && ur.roster) || {};
    const tips = (day.games || []).map(g => (Array.isArray(g) && g[2] ? Date.parse(g[2]) : NaN)).filter(x => isFinite(x));
    const rem = { uid: s.user_id, date: today, firstTip: tips.length ? Math.min(...tips) : null, run: run.name, accs: [] };
    if (ur) reminders.push(rem);
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
      if (ur && (acc.id === 'main' || source)) rem.accs.push({ label: acc.label, submitted: source === 'chain', names: list.map(p => p.name) });
      if (!list.length) continue;
      const players = list.map(p => {
        const team = (catalog.get(p.id) || {}).team || (roster[p.id] || {}).team || (injuries.get(p.id) || {}).team || null;
        const g = (day.games || []).find(x => Array.isArray(x) && (x[0] === team || x[1] === team));
        return { id: p.id, name: p.name, team, tip: g && g[2] ? Date.parse(g[2]) : null };
      });
      lineups.push({ uid: s.user_id, acc: acc.id, accLabel: acc.label, date: today, source, players, run: run.name, firstTip: rem.firstTip });
    }
  }
}
console.log('Lineups de hoje vistos:', lineups.length, lineups.map(l => l.accLabel + ' (' + l.source + ', ' + l.players.length + ')').join(' · '));

// ---------- 4) avisos ----------
const statusAt = (tip, date) => Math.min(tip - 2 * 3600e3, localTime(date, STATUS_HOUR, TZ));
const subIds = new Set(subs.map(x => x.user_id));
const LAST_MIN = 30; // última chamada: meia hora antes do primeiro jogo do dia
const { items, state: next0 } = buildAlerts({ now, lineups: lineups.filter(L => subIds.has(L.uid)), injuries, state, statusAt, lastCallMin: LAST_MIN });
const { items: remind, state: next1 } = buildReminders({ now, reminders: reminders.filter(R => subIds.has(R.uid)), state: next0 });
let next = next1;
// grupo do Telegram: os jogadores dos lineups de toda a gente (quem não partilha o plano fica de fora)
if (TG_TOKEN) {
  const nameOf = uid => ((profiles.find(p => p.user_id === uid) || {}).display_name) || 'Sem nome';
  const shares = uid => (profiles.find(p => p.user_id === uid) || {}).share_plan !== false;
  const owners = {}, union = new Map();
  lineups.filter(L => shares(L.uid)).forEach(L => L.players.forEach(p => { if (!union.has(p.id)) union.set(p.id, p); const o = (owners[p.id] = owners[p.id] || []); if (!o.includes(nameOf(L.uid))) o.push(nameOf(L.uid)); }));
  // especialistas do dia: os 8 melhores (média por jogo) em cada estatística dos objetivos de hoje, entre quem joga
  // hoje — se algum estiver no relatório, o grupo também quer saber
  const spec = {};
  for (const day of days) {
    const tipOf = team => { const g = (day.games || []).find(x => Array.isArray(x) && (x[0] === team || x[1] === team)); return g && g[2] ? Date.parse(g[2]) : null; };
    const playing = [...catalog.values()].filter(p => p.team && tipOf(p.team) && p.avg && (+p.avg.min || 0) >= 12);
    const terms = [...new Set((day.objectives || []).filter(o => o && o.stat).flatMap(o => FB.statTerms(o.stat).filter(t => t.sign > 0).map(t => t.s)))];
    for (const st of terms) {
      const lab = (FB.STATS[st] || {}).short || st.toUpperCase();
      playing.map(p => ({ p, v: (FB.avgOf({ avg: p.avg }, st) || {}).v })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 8).forEach((x, i) => {
        const id = String(x.p.id); if (!injuries.has(id)) return;
        if (!union.has(id)) union.set(id, { id, name: x.p.name, team: x.p.team, tip: tipOf(x.p.team) });
        if (!spec[id]) spec[id] = 'especialista em ' + lab + ', ' + (i + 1) + '.º';
      });
    }
  }
  const first = Math.min(...reminders.map(R => R.firstTip || Infinity), ...days.flatMap(d => (d.games || []).map(g => (Array.isArray(g) && g[2] ? Date.parse(g[2]) : Infinity))));
  const G = buildAlerts({ now, lineups: union.size ? [{ uid: 'grupo', acc: 'tg', date: today, source: 'grupo', players: [...union.values()], firstTip: isFinite(first) ? first : null }] : [], injuries, state: next, statusAt, lastCallMin: LAST_MIN });
  next = G.state;
  if (G.items.length) {
    const okTg = await sendTg(groupAlertText(G.items, owners, { tz: TZ, spec }));
    note('lesões: ' + G.items.map(i => i.kind + ' ' + i.name).join(', ') + ' → ' + (okTg ? 'enviado' : 'nada enviado'));
    if (!okTg) G.items.forEach(i => { const k = i.date + '|grupo|tg|' + i.id; if (state[k]) next[k] = state[k]; else delete next[k]; });
  }
  // lembrete: uma vez por dia, a quem joga esta run (com lineup submetido ou não)
  const firstTip = Math.min(...reminders.map(R => R.firstTip || Infinity));
  const players = reminders.filter((R, i, a) => a.findIndex(x => x.uid === R.uid) === i).map(R => ({ label: nameOf(R.uid), submitted: R.accs.length > 0 && R.accs.every(a => a.submitted) }));
  const GR = buildReminders({ now, reminders: isFinite(firstTip) && players.length ? [{ uid: 'grupo', date: today, firstTip, run: (reminders[0] || {}).run, accs: players }] : [], state: next });
  next = GR.state;
  for (const R of GR.items) { const okTg = await sendTg(groupReminderText(R, { tz: TZ })); note('lembrete do lineup → ' + (okTg ? 'enviado' : 'nada enviado')); if (!okTg) delete next['lu|' + R.date + '|grupo']; }
  if (!G.items.length && !GR.items.length) note('nada de novo para o grupo (' + union.size + ' jogadores vistos, ' + Object.keys(spec).length + ' especialistas em dúvida)');
}
for (const R of remind) {
  const sub = subs.find(s => s.user_id === R.uid), { title, body } = reminderText(R, { tz: TZ });
  const done = await deliver(sub, title, body, false);
  console.log('Lembrete do lineup para', R.uid.slice(0, 8) + '…:', done.join(' e ') || 'nada enviado');
  if (!done.length) delete next['lu|' + R.date + '|' + R.uid];
}
const byUser = new Map(); items.forEach(i => { (byUser.get(i.uid) || byUser.set(i.uid, []).get(i.uid)).push(i); });
for (const [uid, list] of byUser) {
  const sub = subs.find(s => s.user_id === uid);
  const { title, body, urgent } = alertText(list, { tz: TZ });
  const done = await deliver(sub, title, body, urgent);
  console.log('Aviso para', uid.slice(0, 8) + '…:', list.map(i => i.kind + ' ' + i.name + ' (' + i.status + ')').join(', '), '→', done.join(' e ') || 'nada enviado');
  if (!done.length) list.forEach(i => { const k = i.date + '|' + i.uid + '|' + i.acc + '|' + i.id; if (state[k]) next[k] = state[k]; else delete next[k]; }); // tenta outra vez na próxima
}
if (!items.length && !remind.length) console.log('Nada de novo para avisar.');
await setState(sb, 'alerts', next);
