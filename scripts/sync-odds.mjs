// Linhas de mais/menos de cada jogador, só para as estatísticas dos objetivos de cada dia.
// 1.º SportsGameOdds (SGO_API_KEY; grátis: 2.500 jogos/mês, 1 jogo = 1 objeto com todas as estatísticas e casas).
// 2.º The Odds API (ODDS_API_KEY; grátis: 500 créditos/mês, 1 crédito por jogo e por mercado), só nas datas em que a
//     SportsGameOdds não deu nada (ou sem a chave dela). ODDS_ONLY_SGO=1 não gasta créditos da The Odds API.
// Estatísticas sem mercado (pontos na área, ressaltos ofensivos, tentados) usam o mercado mais parecido.
// Uso: node scripts/sync-odds.mjs [AAAA-MM-DD ...]   (por defeito: hoje e amanhã, hora de Nova Iorque)
//      node scripts/sync-odds.mjs --pre   (de hora a hora à noite: só lê hoje, uma vez, quando faltam ≤ 2 h para o
//      1.º jogo; é a única leitura que avisa o grupo no Telegram)
import { supa, must, etDate, addDays, marketsForStat, consensusFromEvent, consensusFromSGO, sgoName, norm, espnTeam, fetchJson, parseEspnBox, MARKET_STAT, matchPlayers, getState, setState, oddsReadyText } from './lib.mjs';
import { sgoLegs, pickDouble, settleDouble, espnScores, ladder, dobraText } from './dobra.mjs';

const KEY = process.env.ODDS_API_KEY, SGO = (process.env.SGO_API_KEY || '').trim(), ONLY_SGO = process.env.ODDS_ONLY_SGO === '1';
if (!KEY && !SGO) { console.log('Sem SGO_API_KEY nem ODDS_API_KEY nos segredos do GitHub: nada a fazer.'); process.exit(0); }
const API = 'https://api.the-odds-api.com/v4/sports/basketball_nba', SGO_API = 'https://api.sportsgameodds.com/v2';

const sb = await supa();
const today = etDate(Date.now());
const dates = process.argv.slice(2).filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const PRE = process.argv.includes('--pre'), AUTO = process.argv.includes('--auto');
if (!dates.length) dates.push(today, ...(PRE ? [] : [addDays(today, 1)]));

// que estatísticas são precisas em cada data (objetivos das runs)
const need = {};
const real = new Set((await must(sb.from('runs').select('id').eq('fictitious', false))).map(r => r.id)); // runs de teste não gastam créditos
// hora do 1.º jogo de hoje (dos dias das runs)
const firstTip = async () => { const games = (await must(sb.from('run_days').select('run_id,games').eq('date', today))).filter(r => real.has(r.run_id)).flatMap(r => r.games || []);
  const tips = games.map(g => (Array.isArray(g) && g[2] ? Date.parse(g[2]) : NaN)).filter(x => isFinite(x)); return tips.length ? Math.min(...tips) : null; };
// leituras com hora marcada (Supabase e, de reserva, GitHub): a mesma não se repete em 4 h (poupa a SportsGameOdds)
if (AUTO) {
  const st = await getState(sb, 'odds-auto', {});
  if (st.at && Date.now() - Date.parse(st.at) < 4 * 36e5) { console.log('Leitura marcada já feita às ' + st.at + ': não repito.'); process.exit(0); }
  await setState(sb, 'odds-auto', { at: new Date().toISOString() });
}
if (PRE) {
  const first = await firstTip(), st = await getState(sb, 'odds-pre', {}), left = first ? (first - Date.now()) / 36e5 : null;
  if (st.date === today) { console.log('Leitura antes do jogo já feita hoje.'); process.exit(0); }
  if (!first || left <= 0 || left > 2) { console.log('Antes do jogo: ainda não (1.º jogo ' + (first ? 'daqui a ' + left.toFixed(1) + ' h' : 'sem hora') + ').'); process.exit(0); }
  console.log('Antes do jogo: 1.º jogo daqui a ' + left.toFixed(1) + ' h — a ler.');
}
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
  await must(sb.from('odds_days').upsert(Object.assign({ date, players: merged, updated_at: new Date().toISOString() }, source ? { source } : {})));
  return Object.keys(merged).length;
}

// ---------- 1.º SportsGameOdds ----------
const sgoDay = {}; // jogos por começar de cada data (para a dobradinha)
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
    sgoDay[date] = todays;
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

// ---------- dobradinha do dia (fica em odds_days.players._dobra de cada data) ----------
try { await dobradinha(); } catch (e) { console.log('::warning title=Dobradinha::' + String(e.message || e).slice(0, 200)); }
async function dobradinha() {
  // 1) as dos dias anteriores que ainda não têm resultado: placar e fichas da ESPN
  const past = await must(sb.from('odds_days').select('date,players').gte('date', addDays(today, -4)).lte('date', today));
  for (const row of past) {
    const d = row.players && row.players._dobra; if (!d || d.res) continue;
    if (d.legs.some(l => Date.parse(l.tip) > Date.now() - 3 * 36e5)) continue; // ainda a jogar
    const { json } = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + row.date.replace(/-/g, ''));
    const scores = espnScores(json), box = {};
    for (const ev of (json && json.events) || []) {
      const ts = ((ev.competitions || [])[0] || {}).competitors || [], ab = ts.map(c => espnTeam((c.team || {}).abbreviation)); // só os jogos das linhas de jogadores
      if (!d.legs.some(l => l.k === 'pr' && (ab.includes(l.home) || ab.includes(l.away)))) continue;
      try { const r = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=' + ev.id); Object.assign(box, parseEspnBox(r.json)); } catch (e) {}
    }
    const res = settleDouble(d, scores, box);
    if (!res) { console.log('Dobradinha ' + row.date + ': ainda sem resultado'); continue; }
    d.res = res; d.settled = new Date().toISOString();
    await save(row.date, { _dobra: d }, null);
    console.log('::notice title=Dobradinha ' + row.date + '::' + (res === 'win' ? 'bateu ✓' : 'falhou ✗'));
  }
  // 2) a de hoje: a 1.ª data com jogos por começar e sem dobradinha (escolhe-se uma vez e fica)
  const date = Object.keys(sgoDay).sort().find(x => sgoDay[x].length); if (!date) return;
  const prev = await must(sb.from('odds_days').select('players').eq('date', date).maybeSingle());
  if (prev && prev.players && prev.players._dobra) { console.log('Dobradinha de ' + date + ' já escolhida.'); return; }
  const inj = new Set((await must(sb.from('injuries').select('id,status'))).filter(x => ['out', 'ofs', 'doubtful', 'questionable', 'dtd'].includes(x.status)).map(x => x.id));
  const byNorm = new Map(catalog.map(p => [norm(p.name), p.id]));
  const legs = sgoDay[date].flatMap(ev => sgoLegs(ev, sgoName));
  const soon = Date.now() + 30 * 6e4;
  const best = pickDouble(legs, { skip: l => Date.parse(l.tip) < soon || (l.k === 'pr' && (inj.has(norm(l.who)) || !byNorm.has(norm(l.who)))) });
  if (!best) { console.log('Dobradinha de ' + date + ': nenhum par perto de 2 (' + legs.length + ' apostas)'); return; }
  best.legs.forEach(l => { if (l.k === 'pr') l.id = byNorm.get(norm(l.who)); });
  best.at = new Date().toISOString(); best.n = legs.length;
  await save(date, { _dobra: best }, null);
  console.log('::notice title=Dobradinha ' + date + '::odd ' + best.o + ' · ' + Math.round(best.p * 100) + '% · ' + best.legs.map(l => l.k === 'pr' ? l.who + ' ' + l.side + ' ' + l.line + ' ' + l.stat : l.t + ' ' + l.k + (l.line != null ? ' ' + l.line : '')).join(' + '));
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
if (PRE && todayPlayers > 0) await setState(sb, 'odds-pre', { date: today }); // sem linhas, tenta outra vez na hora seguinte
// a dobradinha de hoje para o aviso (com o degrau, contado pelos dias da run de hoje)
async function dobraLine() {
  try {
    const row = await must(sb.from('odds_days').select('players').eq('date', today).maybeSingle()), d = row && row.players && row.players._dobra; if (!d) return '';
    const rd = (await must(sb.from('run_days').select('run_id,date').eq('date', today))).find(r => real.has(r.run_id));
    let step = null;
    if (rd) { const ds = (await must(sb.from('run_days').select('date').eq('run_id', rd.run_id))).map(x => x.date).filter(x => x < today).sort();
      const prev = ds.length ? await must(sb.from('odds_days').select('date,players').in('date', ds)) : [];
      step = ladder(prev.sort((a, b) => a.date.localeCompare(b.date)).map(r => r.players && r.players._dobra).filter(Boolean)).step; }
    return dobraText(d, step);
  } catch (e) { return ''; }
}
if (TG && PRE && todayPlayers > 0) { // só a leitura de antes do jogo avisa
  try {
    const st = await getState(sb, 'odds-tg', {});
    const first = await firstTip();
    let chat = (process.env.TELEGRAM_CHAT_ID || '').trim() || ((await getState(sb, 'telegram', {})) || {}).chat || null;
    if (st.date === today) console.log('::notice title=Telegram::aviso das odds já enviado hoje');
    else if (first && Date.now() >= first) console.log('::notice title=Telegram::os jogos já começaram: sem aviso das odds');
    else if (!chat) console.log('::notice title=Telegram::ainda não sei o grupo (corre a tarefa das lesões)');
    else {
      const r = await fetch('https://api.telegram.org/bot' + TG + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: oddsReadyText(first, { tz: 'Europe/Lisbon' }) + await dobraLine(), parse_mode: 'HTML', disable_web_page_preview: true }) }).then(x => x.json()).catch(e => ({ ok: false, description: e.message }));
      if (r.ok) await setState(sb, 'odds-tg', { date: today });
      console.log('::notice title=Telegram::aviso das odds ' + (r.ok ? 'enviado' : 'falhou: ' + String(r.description || '').slice(0, 120)));
    }
  } catch (e) { console.log('::notice title=Telegram::aviso das odds falhou: ' + String(e.message).slice(0, 120)); }
}
