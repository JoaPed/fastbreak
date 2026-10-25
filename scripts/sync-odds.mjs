// The Odds API → linhas de mais/menos de cada jogador, só para a estatística do objetivo de cada dia.
// Estatísticas sem mercado (pontos na área, ressaltos ofensivos, tentados) usam o mercado mais parecido.
// Custo: 1 crédito por jogo e por mercado (região us). Pedidos sem dados não contam.
// Uso: node scripts/sync-odds.mjs [AAAA-MM-DD ...]   (por defeito: hoje e amanhã, hora de Nova Iorque)
import { supa, must, etDate, addDays, marketsForStat, consensusFromEvent, matchPlayers, getState, setState, oddsReadyText } from './lib.mjs';

const KEY = process.env.ODDS_API_KEY;
if (!KEY) { console.log('Sem ODDS_API_KEY nos segredos do GitHub: nada a fazer.'); process.exit(0); }
const API = 'https://api.the-odds-api.com/v4/sports/basketball_nba';

const sb = await supa();
const today = etDate(Date.now());
const dates = process.argv.slice(2).filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
if (!dates.length) dates.push(today, addDays(today, 1));

// que estatísticas são precisas em cada data (objetivos das runs)
const need = {};
const real = new Set((await must(sb.from('runs').select('id').eq('fictitious', false))).map(r => r.id)); // runs de teste não gastam créditos
const rows = (await must(sb.from('run_days').select('run_id,date,objectives').in('date', dates))).filter(r => real.has(r.run_id));
for (const r of rows) for (const o of r.objectives || []) for (const m of marketsForStat(o.stat)) (need[r.date] = need[r.date] || new Set()).add(m);
if (!Object.keys(need).length) { console.log('Nenhum objetivo definido para', dates.join(', '), '— não gasto créditos.'); process.exit(0); }

const evRes = await fetch(API + '/events?apiKey=' + KEY);
if (!evRes.ok) throw new Error('The Odds API /events ' + evRes.status + ': ' + (await evRes.text()).slice(0, 200));
const events = await evRes.json();
const catalog = await must(sb.from('nba_players').select('id,name'));
const now = Date.now();
let used = null, remaining = null, todayPlayers = 0;

for (const date of Object.keys(need)) {
  const markets = [...need[date]].join(',');
  const todays = events.filter(e => etDate(e.commence_time) === date && Date.parse(e.commence_time) > now);
  console.log(date, '·', todays.length, 'jogos por começar · mercados', markets);
  if (!todays.length) { console.log('::notice title=Odds ' + date + '::nenhum jogo por começar'); continue; }
  const byName = {}; let books = new Set();
  for (const ev of todays) {
    const res = await fetch(API + '/events/' + ev.id + '/odds?apiKey=' + KEY + '&regions=us&oddsFormat=american&markets=' + markets);
    used = res.headers.get('x-requests-used') || used; remaining = res.headers.get('x-requests-remaining') || remaining;
    if (!res.ok) { console.log('  ', ev.away_team, '@', ev.home_team, '→ erro', res.status); continue; }
    const js = await res.json();
    (js.bookmakers || []).forEach(b => books.add(b.key));
    const c = consensusFromEvent(js);
    for (const [who, stats] of Object.entries(c)) byName[who] = Object.assign(byName[who] || {}, stats);
    console.log('  ', ev.away_team, '@', ev.home_team, '→', Object.keys(c).length, 'jogadores');
  }
  const { players, unmatched } = matchPlayers(byName, catalog);
  if (unmatched.length) console.log('  sem correspondência no catálogo:', unmatched.slice(0, 20).join(', '), unmatched.length > 20 ? '…' : '');
  const prev = await must(sb.from('odds_days').select('players').eq('date', date).maybeSingle());
  const merged = Object.assign({}, (prev && prev.players) || {});
  for (const [id, stats] of Object.entries(players)) merged[id] = Object.assign({}, merged[id] || {}, stats);
  await must(sb.from('odds_days').upsert({ date, players: merged, source: 'The Odds API · ' + books.size + ' casas', updated_at: new Date().toISOString() }));
  console.log('  guardado:', Object.keys(players).length, 'jogadores');
  if (date === today) todayPlayers = Object.keys(players).length;
  // resumo visível na página da execução (anotação): dá para ver sem abrir o registo
  console.log('::notice title=Odds ' + date + '::' + todays.length + ' jogos por começar · ' + Object.keys(players).length + ' jogadores com linhas agora · ' + Object.keys(merged).length + ' no total do dia · ' + books.size + ' casas · mercados ' + markets);
}
console.log('Créditos usados este mês:', used, '· restantes:', remaining);
console.log('::notice title=Créditos::usados ' + used + ' · restantes ' + remaining);

// grupo do Telegram (em inglês): as odds de hoje chegaram, ir ver o lineup e fixá-lo. Uma vez por dia, só em dia
// de run, com jogadores nas odds de hoje e antes do 1.º jogo
const TG = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
if (TG && todayPlayers > 0) {
  try {
    const st = await getState(sb, 'odds-tg', {});
    const games = (await must(sb.from('run_days').select('run_id,games').eq('date', today))).filter(r => real.has(r.run_id)).flatMap(r => r.games || []);
    const tips = games.map(g => (Array.isArray(g) && g[2] ? Date.parse(g[2]) : NaN)).filter(x => isFinite(x)), first = tips.length ? Math.min(...tips) : null;
    let chat = (process.env.TELEGRAM_CHAT_ID || '').trim() || ((await getState(sb, 'telegram', {})) || {}).chat || null;
    if (st.date === today) console.log('::notice title=Telegram::aviso das odds já enviado hoje');
    else if (first && Date.now() >= first) console.log('::notice title=Telegram::os jogos já começaram: sem aviso das odds');
    else if (!chat) console.log('::notice title=Telegram::ainda não sei o grupo (corre a tarefa das lesões)');
    else {
      const r = await fetch('https://api.telegram.org/bot' + TG + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: oddsReadyText(first, { tz: 'Europe/Lisbon' }), parse_mode: 'HTML', disable_web_page_preview: true }) }).then(x => x.json()).catch(e => ({ ok: false, description: e.message }));
      if (r.ok) await setState(sb, 'odds-tg', { date: today });
      console.log('::notice title=Telegram::aviso das odds ' + (r.ok ? 'enviado' : 'falhou: ' + String(r.description || '').slice(0, 120)));
    }
  } catch (e) { console.log('::notice title=Telegram::aviso das odds falhou: ' + String(e.message).slice(0, 120)); }
}
