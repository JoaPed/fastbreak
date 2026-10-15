// Box scores oficiais da NBA → catálogo de jogadores (equipa atual e médias por jogo).
// Uso normal: processa os jogos terminados desta época que ainda não foram lidos.
// Uso único:  node scripts/sync-stats.mjs --backfill 2025-26   (lê a época passada para as médias de arranque)
import { supa, must, fetchJson, finalGameIds, addBoxscore, blendedAverages, getState, setState, pool, upsertChunks } from './lib.mjs';

const SCHEDULE = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';
const BOX = id => 'https://cdn.nba.com/static/json/liveData/boxscore/boxscore_' + id + '.json';

const sb = await supa();
const state = await getState(sb, 'stats', { processed: {}, players: {}, prevSeason: null });
state.processed = state.processed || {}; state.players = state.players || {};

const arg = process.argv.indexOf('--backfill');
if (arg > 0) {
  const season = process.argv[arg + 1] || '2025-26';
  const yy = season.slice(2, 4);
  console.log('A ler a época', season, '(médias de arranque)…');
  let misses = 0, read = 0;
  const ids = Array.from({ length: 1230 }, (_, i) => '002' + yy + String(i + 1).padStart(5, '0'));
  await pool(ids, 8, async id => {
    if (state.processed['prev:' + id] || misses > 40) return;
    const { json, status } = await fetchJson(BOX(id));
    if (!json) { misses++; if (status !== 404) console.log('sem acesso', id, status); return; }
    misses = 0; read++;
    addBoxscore(state, json, 'prev', null);
    state.processed['prev:' + id] = 1;
  });
  state.prevSeason = season;
  console.log('Jogos lidos da época passada:', read);
} else {
  const { json } = await fetchJson(SCHEDULE);
  if (!json) throw new Error('Não consegui ler o calendário NBA.');
  const yy = String((json.leagueSchedule || {}).seasonYear || '').slice(2, 4);
  // época regular (002…) conta para as médias; pré-época (001…) só para saber a equipa de cada jogador
  const games = finalGameIds(json, ['001' + yy, '002' + yy, '004' + yy, '005' + yy, '006' + yy]).filter(g => !state.processed[g.id]);
  console.log('Jogos terminados por ler:', games.length);
  let read = 0;
  await pool(games, 6, async g => {
    const { json: box } = await fetchJson(BOX(g.id));
    if (!box) return;
    addBoxscore(state, box, g.id.startsWith('001') ? 'team' : 'cur', g.date);
    state.processed[g.id] = 1; read++;
  });
  console.log('Box scores lidos:', read);
}

const rows = [];
for (const [id, p] of Object.entries(state.players)) {
  const b = blendedAverages(p);
  if (!p.name) continue;
  rows.push({ id, name: p.name, team: p.team || null, avg: b ? b.avg : null, gp: b ? b.gp : 0, updated_at: new Date().toISOString() });
}
await upsertChunks(sb, 'nba_players', rows, 'id');
await setState(sb, 'stats', state);
console.log('Jogadores no catálogo:', rows.length);
