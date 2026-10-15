// Catálogo de jogadores (ESPN): equipa atual e médias por jogo.
//   1) plantéis atuais das 30 equipas (trocas e rookies certos antes do 1.º jogo);
//   2) médias da época passada (uma vez por época, ou com --backfill AAAA-AA);
//   3) médias desta época (todos os dias), misturadas com as da época passada enquanto há poucos jogos.
import { supa, must, fetchJson, addEspnSeason, addEspnCurrent, addEspnRoster, espnTeam, blendedAverages, teamOf, getState, setState, pool, upsertChunks, etDate } from './lib.mjs';

const ESPN_TEAMS = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';
const ESPN_ROSTER = id => 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/' + id + '/roster';
const ESPN_SEASON = (year, page) => 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&limit=200&sort=offensive.avgPoints:desc&seasontype=2&season=' + year + '&page=' + page;

const sb = await supa();
let state = await getState(sb, 'stats', null);
if (!state || state.version !== 3) state = { version: 3, players: {}, prevSeason: null };
const today = etDate(Date.now());
// época atual: a partir de setembro conta a que começa nesse ano (a ESPN chama 2027 à época 2026-27)
const y = +today.slice(0, 4), m = +today.slice(5, 7);
const curYear = m >= 9 ? y + 1 : y;
const fmt = year => (year - 1) + '-' + String(year).slice(2);

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

// catálogo
const rows = [];
for (const [id, p] of Object.entries(state.players)) {
  if (!p.name) continue;
  const b = blendedAverages(p);
  rows.push({ id, name: p.name, team: teamOf(p), avg: b ? b.avg : null, gp: b ? b.gp : 0, updated_at: new Date().toISOString() });
}
if (!rows.length) throw new Error('A ESPN não devolveu jogadores. Tenta outra vez mais tarde.');
await upsertChunks(sb, 'nba_players', rows, 'id');
const old = (await must(sb.from('nba_players').select('id'))).map(r => r.id).filter(id => /^\d+$/.test(id));
for (let i = 0; i < old.length; i += 200) await must(sb.from('nba_players').delete().in('id', old.slice(i, i + 200)));
await setState(sb, 'stats', state);
console.log('Jogadores no catálogo:', rows.length, '· com equipa:', rows.filter(r => r.team).length, '· com médias:', rows.filter(r => r.avg).length);
