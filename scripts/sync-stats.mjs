// Catálogo de jogadores: equipa atual e médias por jogo.
//   1) ESPN: plantéis atuais das 30 equipas (trocas e rookies já certos antes do 1.º jogo);
//   2) ESPN: médias da época passada (uma vez por época, ou com --backfill);
//   3) NBA (cdn.nba.com): box scores dos jogos terminados desta época, para as médias atuais.
// Uso: node scripts/sync-stats.mjs [--backfill 2025-26]
import { supa, must, fetchJson, finalGameIds, addBoxscore, addEspnSeason, addEspnRoster, espnTeam, blendedAverages, teamOf, getState, setState, pool, upsertChunks, etDate } from './lib.mjs';

const SCHEDULE = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';
const BOX = id => 'https://cdn.nba.com/static/json/liveData/boxscore/boxscore_' + id + '.json';
const ESPN_TEAMS = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';
const ESPN_ROSTER = id => 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/' + id + '/roster';
const ESPN_SEASON = (year, page) => 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&limit=200&sort=offensive.avgPoints:desc&seasontype=2&season=' + year + '&page=' + page;

const sb = await supa();
let state = await getState(sb, 'stats', null);
if (!state || state.version !== 2) state = { version: 2, processed: {}, players: {}, prevSeason: null }; // formato novo: jogadores pelo nome
const today = etDate(Date.now());

// 1) plantéis atuais (ESPN)
try {
  const { json } = await fetchJson(ESPN_TEAMS);
  const teams = ((((json || {}).sports || [])[0] || {}).leagues || [])[0];
  const list = ((teams || {}).teams || []).map(t => t.team).filter(Boolean);
  let n = 0;
  await pool(list, 5, async t => {
    const { json: r } = await fetchJson(ESPN_ROSTER(t.id));
    if (r) n += addEspnRoster(state, espnTeam(t.abbreviation), r, today);
  });
  console.log('Plantéis ESPN:', list.length, 'equipas ·', n, 'jogadores');
} catch (e) { console.log('Plantéis ESPN indisponíveis:', e.message); }

// 2) médias da época passada (ESPN), uma vez por época
const arg = process.argv.indexOf('--backfill');
const { json: sched } = await fetchJson(SCHEDULE).catch(() => ({ json: null }));
const seasonYear = String(((sched || {}).leagueSchedule || {}).seasonYear || '2026-27'); // ex.: "2026-27"
const prevSeason = arg > 0 ? (process.argv[arg + 1] || '') : (+seasonYear.slice(0, 4) - 1) + '-' + seasonYear.slice(2, 4);
if (arg > 0 || state.prevSeason !== prevSeason) {
  const espnYear = +prevSeason.slice(0, 4) + 1; // a ESPN chama "2026" à época 2025-26
  let page = 1, pages = 1, n = 0;
  do {
    let json = null;
    try { ({ json } = await fetchJson(ESPN_SEASON(espnYear, page))); } catch (e) { console.log('ESPN falhou na página', page, e.message); }
    if (!json) { console.log('ESPN não respondeu à página', page); break; }
    n += addEspnSeason(state, json);
    pages = +((json.pagination || {}).pages || 1);
    page++;
  } while (page <= pages && page <= 20);
  if (n) state.prevSeason = prevSeason;
  console.log('Médias da época', prevSeason, '(ESPN):', n, 'jogadores');
}

// 3) box scores desta época (NBA)
if (sched) {
  const yy = seasonYear.slice(2, 4);
  const games = finalGameIds(sched, ['001' + yy, '002' + yy, '004' + yy, '005' + yy, '006' + yy]).filter(g => !state.processed[g.id]);
  let read = 0, denied = 0;
  await pool(games, 6, async g => {
    const { json: box, status } = await fetchJson(BOX(g.id));
    if (!box) { if (status === 403) denied++; return; }
    addBoxscore(state, box, g.id.startsWith('001') ? 'team' : 'cur', g.date);
    state.processed[g.id] = 1; read++;
  });
  console.log('Época', seasonYear, '· jogos terminados por ler:', games.length, '· lidos:', read, denied ? '· recusados pela NBA: ' + denied : '');
} else console.log('Calendário NBA indisponível: médias desta época não atualizadas.');

// catálogo
const rows = [];
for (const [id, p] of Object.entries(state.players)) {
  if (!p.name) continue;
  const b = blendedAverages(p);
  rows.push({ id, name: p.name, team: teamOf(p), avg: b ? b.avg : null, gp: b ? b.gp : 0, updated_at: new Date().toISOString() });
}
await upsertChunks(sb, 'nba_players', rows, 'id');
// remove entradas do formato antigo (id numérico da NBA)
const old = (await must(sb.from('nba_players').select('id'))).map(r => r.id).filter(id => /^\d+$/.test(id));
for (let i = 0; i < old.length; i += 200) await must(sb.from('nba_players').delete().in('id', old.slice(i, i + 200)));
await setState(sb, 'stats', state);
console.log('Jogadores no catálogo:', rows.length, '· com equipa:', rows.filter(r => r.team).length, '· com médias:', rows.filter(r => r.avg).length);
