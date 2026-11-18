// Linhas de mais/menos de cada jogador, só para as estatísticas dos objetivos de cada dia.
// 1.º SportsGameOdds (SGO_API_KEY; grátis: 2.500 jogos/mês, 1 jogo = 1 objeto com todas as estatísticas e casas).
// 2.º The Odds API (ODDS_API_KEY; grátis: 500 créditos/mês, 1 crédito por jogo e por mercado), só nas datas em que a
//     SportsGameOdds não deu nada (ou sem a chave dela). ODDS_ONLY_SGO=1 não gasta créditos da The Odds API.
// Estatísticas sem mercado (pontos na área, ressaltos ofensivos, tentados) usam o mercado mais parecido.
// Uso: node scripts/sync-odds.mjs [AAAA-MM-DD ...]   (por defeito: hoje e amanhã, hora de Nova Iorque)
import { supa, must, etDate, addDays, marketsForStat, consensusFromEvent, consensusFromSGO, MARKET_STAT, matchPlayers, getState, setState, oddsReadyText } from './lib.mjs';

const KEY = process.env.ODDS_API_KEY, SGO = (process.env.SGO_API_KEY || '').trim(), ONLY_SGO = process.env.ODDS_ONLY_SGO === '1';
if (!KEY && !SGO) { console.log('Sem SGO_API_KEY nem ODDS_API_KEY nos segredos do GitHub: nada a fazer.'); process.exit(0); }
const API = 'https://api.the-odds-api.com/v4/sports/basketball_nba', SGO_API = 'https://api.sportsgameodds.com/v2';

const sb = await supa();
const today = etDate(Date.now());
const dates = process.argv.slice(2).filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
if (!dates.length) dates.push(today, addDays(today, 1));

// que estatísticas são precisas em cada data (objetivos das runs)
const need = {};
const real = new Set((await must(sb.from('runs').select('id').eq('fictitious', false))).map(r => r.id)); // runs de teste não gastam créditos
const rows = (await must(sb.from('run_days').select('run_id,date,objectives').in('date', dates))).filter(r => real.has(r.run_id));
for (const r of rows) for (const o of r.objectives || []) for (const m of marketsForStat(o.stat)) (need[r.date] = need[r.date] || new Set()).add(m);
// na SportsGameOdds também há linhas das próprias (ressaltos ofensivos, tentados…): guarda-se a estatística e as parecidas
const needStats = {};
for (const r of rows) for (const o of r.objectives || []) for (const x of String(o.stat || '').split(/[+-]/)) (needStats[r.date] = needStats[r.date] || new Set()).add(x);
if (!Object.keys(need).length) { console.log('Nenhum objetivo definido para', dates.join(', '), '— não gasto créditos.'); process.exit(0); }

const catalog = await must(sb.from('nba_players').select('id,name'));
const now = Date.now();
let used = null, remaining = null, todayPlayers = 0;
const done = {}; // datas com linhas da SportsGameOdds (a The Odds API já não é precisa)

// junta às odds já guardadas desse dia (uma leitura nova só acrescenta ou atualiza)
async function save(date, players, source) {
  const prev = await must(sb.from('odds_days').select('players').eq('date', date).maybeSingle());
  const merged = Object.assign({}, (prev && prev.players) || {});
  for (const [id, stats] of Object.entries(players)) merged[id] = Object.assign({}, merged[id] || {}, stats);
  await must(sb.from('odds_days').upsert({ date, players: merged, source, updated_at: new Date().toISOString() }));
  return Object.keys(merged).length;
}

// ---------- 1.º SportsGameOdds ----------
if (SGO) {
  let objs = 0; const seen = new Set();
  for (const date of Object.keys(need)) {
    const want = new Set([...need[date]].map(m => MARKET_STAT[m]).filter(Boolean).concat([...(needStats[date] || [])]));
    // dia NBA (Nova Iorque: das 04:00 UTC às 08:00 UTC do dia seguinte), só jogos por começar: cada jogo devolvido
    // gasta 1 dos 2.500 do mês, por isso a janela é justa (e filtra-se depois pela data de cada jogo)
    const from = new Date(Math.max(Date.parse(date + 'T04:00:00Z'), now)).toISOString();
    const qs = 'leagueID=NBA&oddsAvailable=true&limit=50&startsAfter=' + encodeURIComponent(from) + '&startsBefore=' + encodeURIComponent(addDays(date, 1) + 'T08:00:00Z');
    let cursor = null, evs = [];
    try {
      do {
        const r = await fetch(SGO_API + '/events?' + qs + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { headers: { 'x-api-key': SGO } });
        if (!r.ok) throw new Error('SportsGameOdds /events ' + r.status + ': ' + (await r.text()).slice(0, 200));
        const js = await r.json(); evs = evs.concat(js.data || []); cursor = js.nextCursor || null;
      } while (cursor && evs.length < 200);
    } catch (e) { console.log('::warning title=SportsGameOdds ' + date + '::' + String(e.message).slice(0, 200)); continue; }
    const todays = evs.filter(e => { const t = e.status && e.status.startsAt; return t && etDate(t) === date && Date.parse(t) > now; });
    objs += evs.length;
    const byName = {};
    for (const ev of todays) {
      Object.values(ev.odds || {}).forEach(o => { if (o && o.betTypeID === 'ou' && !['home', 'away', 'all'].includes(o.statEntityID)) seen.add(o.statID); });
      const c = consensusFromSGO(ev);
      for (const [who, stats] of Object.entries(c)) for (const [k, v] of Object.entries(stats)) if (want.has(k)) (byName[who] = byName[who] || {})[k] = v;
    }
    const { players, unmatched } = matchPlayers(byName, catalog), n = Object.keys(players).length;
    if (unmatched.length) console.log('  sem correspondência no catálogo:', unmatched.slice(0, 20).join(', '), unmatched.length > 20 ? '…' : '');
    console.log(date, '· SportsGameOdds:', todays.length, 'jogos por começar ·', n, 'jogadores com linhas');
    if (!n) { console.log('::notice title=SportsGameOdds ' + date + '::' + todays.length + ' jogos por começar, ainda sem linhas dos jogadores'); continue; }
    const tot = await save(date, players, 'SportsGameOdds · ' + todays.length + ' jogos');
    done[date] = true; if (date === today) todayPlayers = n;
    console.log('::notice title=Odds ' + date + '::SportsGameOdds · ' + todays.length + ' jogos por começar · ' + n + ' jogadores com linhas agora · ' + tot + ' no total do dia');
  }
  console.log('SportsGameOdds: ' + objs + ' jogos lidos nesta execução · estatísticas de jogadores vistas: ' + ([...seen].join(', ') || 'nenhuma'));
  try {
    const u = await fetch(SGO_API + '/account/usage', { headers: { 'x-api-key': SGO } }).then(r => (r.ok ? r.json() : null));
    // só os limites (a resposta traz também o email da conta, que não pode ir para o registo público)
    const rl = u && (u.data || u).rateLimits;
    if (rl) console.log('::notice title=SportsGameOdds::uso ' + JSON.stringify(rl['per-month'] || rl).slice(0, 300));
  } catch (e) { /* o uso é só informativo */ }
}

// ---------- 2.º The Odds API: só nas datas que ficaram sem linhas ----------
const rest = Object.keys(need).filter(d => !done[d]);
if (rest.length && (!KEY || ONLY_SGO)) console.log('The Odds API não usada' + (ONLY_SGO ? ' (só SportsGameOdds nesta leitura)' : ' (sem chave)') + ': ficam sem linhas', rest.join(', '));
const events = rest.length && KEY && !ONLY_SGO ? await (async () => {
  const evRes = await fetch(API + '/events?apiKey=' + KEY);
  if (!evRes.ok) throw new Error('The Odds API /events ' + evRes.status + ': ' + (await evRes.text()).slice(0, 200));
  return evRes.json();
})() : [];

for (const date of events.length ? rest : []) {
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
  const tot = await save(date, players, 'The Odds API · ' + books.size + ' casas');
  console.log('  guardado:', Object.keys(players).length, 'jogadores');
  if (date === today) todayPlayers = Object.keys(players).length;
  // resumo visível na página da execução (anotação): dá para ver sem abrir o registo
  console.log('::notice title=Odds ' + date + '::' + todays.length + ' jogos por começar · ' + Object.keys(players).length + ' jogadores com linhas agora · ' + tot + ' no total do dia · ' + books.size + ' casas · mercados ' + markets);
}
if (used != null) {
  console.log('Créditos usados este mês:', used, '· restantes:', remaining);
  console.log('::notice title=Créditos The Odds API::usados ' + used + ' · restantes ' + remaining);
}

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
