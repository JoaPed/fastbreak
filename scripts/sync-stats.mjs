// Catálogo de jogadores (ESPN): equipa atual e médias por jogo.
//   1) plantéis atuais das 30 equipas (trocas e rookies certos antes do 1.º jogo);
//   2) médias da época passada (uma vez por época, ou com --backfill AAAA-AA);
//   3) médias desta época (todos os dias), misturadas com as da época passada enquanto há poucos jogos;
//   4) ressaltos ofensivos e defensivos, que só vêm na ficha de cada jogador (uma vez por época e quando joga mais jogos);
//   5) forma: as estatísticas de cada jogo terminado (últimos 10 jogos de cada jogador).
import { supa, must, fetchJson, addEspnSeason, addEspnCurrent, addEspnRoster, addEspnCore, parseEspnCoreStats, parseEspnBox, addBoxForm, formOf, teamRows, espnTeam, blendedAverages, teamOf, getState, setState, pool, upsertChunks, etDate, addDays } from './lib.mjs';

const ESPN_TEAMS = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';
const ESPN_ROSTER = id => 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/' + id + '/roster';
const ESPN_BOARD = d => 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + d.replace(/-/g, '');
const ESPN_SUMMARY = id => 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=' + id;
const ESPN_CORE = (year, id) => 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/' + year + '/types/2/athletes/' + id + '/statistics';
const ESPN_SEASON = (year, page) => 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&limit=200&sort=offensive.avgPoints:desc&seasontype=2&season=' + year + '&page=' + page;

const sb = await supa();
let state = await getState(sb, 'stats', null);
// versão 4: médias com perdas de bola, lançamentos, lances livres e ressaltos ofensivos/defensivos (lê tudo de novo)
if (!state || state.version !== 4) state = { version: 4, players: {}, prevSeason: null, curSeason: null };
const today = etDate(Date.now());
// época atual: a partir de setembro conta a que começa nesse ano (a ESPN chama 2027 à época 2026-27)
const y = +today.slice(0, 4), m = +today.slice(5, 7);
const curYear = m >= 9 ? y + 1 : y;
const fmt = year => (year - 1) + '-' + String(year).slice(2);
// época nova: as médias "desta época" da anterior deixam de contar como atuais
if (state.curSeason && state.curSeason !== fmt(curYear)) { for (const p of Object.values(state.players)) { delete p.curAvg; delete p.cur; delete p.log; } delete state.boxDate; delete state.teams; }
state.curSeason = fmt(curYear);

async function season(year, add) {
  let page = 1, pages = 1, n = 0;
  do {
    let json = null;
    try { ({ json } = await fetchJson(ESPN_SEASON(year, page))); } catch (e) { console.log('ESPN falhou na página', page, e.message); }
    if (!json) break;
    n += add(state, json);
    pages = +((json.pagination || {}).pages || 1);
    page++;
  } while (page <= pages && page <= 20);
  return n;
}

// 1) plantéis atuais
try {
  const { json } = await fetchJson(ESPN_TEAMS);
  const league = ((((json || {}).sports || [])[0] || {}).leagues || [])[0] || {};
  const list = (league.teams || []).map(t => t.team).filter(Boolean);
  let n = 0;
  await pool(list, 5, async t => { const { json: r } = await fetchJson(ESPN_ROSTER(t.id)); if (r) n += addEspnRoster(state, espnTeam(t.abbreviation), r, today); });
  console.log('Plantéis ESPN:', list.length, 'equipas ·', n, 'jogadores');
} catch (e) { console.log('Plantéis ESPN indisponíveis:', e.message); }

// 2) época passada (uma vez)
const arg = process.argv.indexOf('--backfill');
const prevYear = arg > 0 ? +String(process.argv[arg + 1] || '').slice(0, 4) + 1 : curYear - 1;
if (arg > 0 || state.prevSeason !== fmt(prevYear)) {
  const n = await season(prevYear, addEspnSeason);
  if (n) state.prevSeason = fmt(prevYear);
  console.log('Médias da época', fmt(prevYear) + ':', n, 'jogadores');
}

// 3) esta época
const nCur = await season(curYear, addEspnCurrent);
console.log('Médias da época', fmt(curYear) + ':', nCur, 'jogadores', nCur ? '' : '(ainda sem jogos)');

// só jogadores num plantel atual (ou com jogos esta época): tira agentes livres e retirados da pesquisa
const rostersLoaded = Object.values(state.players).some(p => p.rosterDate === today);
const inCatalog = p => p.name && !(rostersLoaded && p.rosterDate !== today && !(p.curAvg && p.curAvg.gp > 0));

// 4) ressaltos ofensivos e defensivos (ficha de cada jogador na ESPN)
const jobs = [];
for (const p of Object.values(state.players)) {
  if (!inCatalog(p) || !p.espnId) continue;
  if (p.prevAvg && p.prevAvg.gp >= 5 && p.prevAvg.coreGp !== p.prevAvg.gp) jobs.push([p, 'prevAvg', prevYear]);
  if (p.curAvg && p.curAvg.gp > 0 && p.curAvg.coreGp !== p.curAvg.gp) jobs.push([p, 'curAvg', curYear]);
}
if (jobs.length) {
  let ok = 0, miss = 0, stop = false;
  await pool(jobs, 8, async ([p, bucket, year]) => {
    if (stop) return;
    try {
      const { json } = await fetchJson(ESPN_CORE(year, p.espnId), {}, 2);
      if (addEspnCore(p, bucket, parseEspnCoreStats(json))) ok++; else miss++;
    } catch (e) { miss++; }
    if (!ok && miss >= 25) stop = true; // a ESPN não responde: tenta amanhã
  });
  console.log('Fichas ESPN (ressaltos ofensivos/defensivos):', ok, 'lidas de', jobs.length + (miss ? ' · ' + miss + ' sem dados' : '') + (stop ? ' · parei: a ESPN não está a responder' : ''));
}

// 5) forma: jogos terminados desde a última leitura (na primeira vez, as últimas 2 semanas)
{
  const yesterday = addDays(today, -1);
  let d = state.boxDate ? addDays(state.boxDate, 1) : addDays(today, -14);
  if (d < addDays(today, -21)) d = addDays(today, -21);
  let games = 0, lines = 0, stopped = null;
  for (; d <= yesterday; d = addDays(d, 1)) {
    let json = null;
    try { ({ json } = await fetchJson(ESPN_BOARD(d))); } catch (e) { /* sem resposta */ }
    if (!json) { stopped = d; break; }
    const done = (json.events || []).filter(ev => {
      const st = ev.status || ((ev.competitions || [])[0] || {}).status || {};
      return ev.season && [2, 3].includes(+ev.season.type) && st.type && st.type.completed; // época regular e playoffs
    });
    const got = await pool(done, 4, async ev => {
      try { const { json: sj } = await fetchJson(ESPN_SUMMARY(ev.id)); return sj ? addBoxForm(state, parseEspnBox(sj), d) : -1; } catch (e) { return -1; }
    });
    if (got.some(x => x < 0)) { stopped = d; break; }
    games += done.length; lines += got.reduce((a, b) => a + b, 0);
    state.boxDate = d;
  }
  console.log('Forma: ' + games + ' jogos terminados lidos (' + lines + ' linhas de jogadores)' + (stopped ? ' · parei em ' + stopped + ', a ESPN não respondeu (continua amanhã)' : ''));
}

// catálogo
const rows = [];
for (const [id, p] of Object.entries(state.players)) {
  if (!inCatalog(p)) continue;
  const b = blendedAverages(p), f = formOf(p);
  const avg = b ? Object.assign({}, b.avg) : (f ? {} : null);
  if (avg && f) avg.form = f; // últimos 5 e 10 jogos
  rows.push({ id, name: p.name, team: teamOf(p), avg, gp: b ? b.gp : 0, updated_at: new Date().toISOString() });
}
if (!rows.length) throw new Error('A ESPN não devolveu jogadores. Tenta outra vez mais tarde.');
await upsertChunks(sb, 'nba_players', rows, 'id');
const keep = new Set(rows.map(r => r.id));
const old = (await must(sb.from('nba_players').select('id'))).map(r => r.id).filter(id => /^\d+$/.test(id) || (rostersLoaded && !keep.has(id)));
for (let i = 0; i < old.length; i += 200) await must(sb.from('nba_players').delete().in('id', old.slice(i, i + 200)));
// o que cada equipa concede (últimos 10 jogos), para comparar adversários
const tRows = teamRows(state);
if (tRows.length) {
  try { await upsertChunks(sb, 'nba_teams', tRows.map(r => Object.assign({ updated_at: new Date().toISOString() }, r)), 'id'); console.log('Equipas (defesa nos últimos jogos):', tRows.length - 1); }
  catch (e) { console.log('Aviso: corre o supabase/schema.sql novo para guardar os dados das equipas (' + e.message + ').'); }
}
await setState(sb, 'stats', state);
console.log('Jogadores no catálogo:', rows.length, '· com equipa:', rows.filter(r => r.team).length, '· com médias:', rows.filter(r => r.avg).length,
  '· com ressaltos ofensivos:', rows.filter(r => r.avg && r.avg.oreb != null).length, '· com perdas de bola:', rows.filter(r => r.avg && r.avg.tov != null).length,
  '· com forma (últimos jogos):', rows.filter(r => r.avg && r.avg.form).length);
