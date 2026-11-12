// Dados para medir o motor (só leitura): jogos de cada jogador em duas épocas (ESPN), as odds que já foram lidas e
// os dias/objetivos das runs. Escreve um ficheiro compacto (DEST/dados.json.gz) que a tarefa "Dados para medir o
// motor" põe num ramo à parte. Sem dados pessoais: os lineups jogados saem sem conta nem nome de quem os jogou.
// Uso: node scripts/backtest-data.mjs [pasta de destino]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { supa, must, fetchJson, pool, etDate, espnTeam } from './lib.mjs';

const DEST = process.argv[2] || '/tmp/bt';
const ESPN_GAMELOG = (year, id) => 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/' + id + '/gamelog?season=' + year;
const GL = { minutes: ['min'], 'fieldGoalsMade-fieldGoalsAttempted': ['fgm', 'fga'], 'threePointFieldGoalsMade-threePointFieldGoalsAttempted': ['fg3', 'fg3a'], 'freeThrowsMade-freeThrowsAttempted': ['ftm', 'fta'], totalRebounds: ['reb'], assists: ['ast'], blocks: ['blk'], steals: ['stl'], turnovers: ['tov'], points: ['pts'] };
const KEYS = ['min', 'pts', 'reb', 'ast', 'fg3', 'fg3a', 'fgm', 'fga', 'ftm', 'fta', 'stl', 'blk', 'tov'];

// jogos da época regular de um jogador, com equipa, adversário, casa/fora e resultado
let sampleMeta = null;
function parse(json) {
  const names = (json && json.names) || [], evs = (json && json.events) || {}, out = new Map();
  for (const st of (json && json.seasonTypes) || []) {
    const label = String(st.displayName || st.name || '');
    if (/pre|post|play-?in|all-?star|cup final/i.test(label) && !/regular/i.test(label)) continue;
    for (const cat of st.categories || []) for (const e of cat.events || []) {
      if (!e || !e.eventId || !Array.isArray(e.stats) || out.has(e.eventId)) continue;
      const meta = evs[e.eventId] || {};
      if (!meta.gameDate) continue;
      if (!sampleMeta) sampleMeta = meta;
      const g = { eid: String(e.eventId), date: etDate(meta.gameDate) };
      names.forEach((nm, i) => { const keys = GL[nm]; if (!keys) return; const parts = String(e.stats[i] == null ? '' : e.stats[i]).split('-'); keys.forEach((k, j) => { const x = parseFloat(parts[j]); if (isFinite(x)) g[k] = x; }); });
      if (!(g.min > 0)) continue;
      g.team = espnTeam((meta.team || {}).abbreviation) || '';
      g.opp = espnTeam((meta.opponent || {}).abbreviation) || '';
      g.home = meta.atVs === 'vs' ? 1 : meta.atVs === '@' ? 0 : -1;
      g.win = meta.gameResult === 'W' ? 1 : meta.gameResult === 'L' ? 0 : -1;
      const hs = +meta.homeTeamScore, as = +meta.awayTeamScore;
      g.diff = isFinite(hs) && isFinite(as) && g.home >= 0 ? (g.home ? hs - as : as - hs) : null;
      out.set(e.eventId, g);
    }
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const sb = await supa();
const now = new Date(), y = now.getUTCFullYear(), m = now.getUTCMonth() + 1, curYear = m >= 9 ? y + 1 : y;
const cat = await must(sb.from('nba_players').select('id,name,team,avg'));
const list = cat.filter(p => p.avg && p.avg.espn).map(p => ({ id: String(p.id), name: p.name, team: p.team || '', espn: String(p.avg.espn) }));
console.log('Jogadores com ficha na ESPN:', list.length, 'de', cat.length);

const rows = [], pIdx = new Map(list.map((p, i) => [p.id, i]));
let fails = 0, done = 0;
for (const year of [curYear - 1, curYear]) {
  await pool(list, 6, async p => {
    try {
      const { json } = await fetchJson(ESPN_GAMELOG(year, p.espn), {}, 3);
      if (!json) { fails++; return; }
      for (const g of parse(json)) rows.push([pIdx.get(p.id), year, g.date, g.eid, g.team, g.opp, g.home, g.win, g.diff].concat(KEYS.map(k => (g[k] != null ? g[k] : null))));
    } catch (e) { fails++; }
    if (++done % 200 === 0) console.log('  ', done, 'fichas lidas ·', rows.length, 'jogos');
  });
}
console.log('Jogos de jogadores:', rows.length, '· fichas falhadas:', fails);
console.log('Exemplo dos campos de um jogo na ESPN:', sampleMeta ? Object.keys(sampleMeta).join(', ') : '(nenhum)');

// odds guardadas (todas as datas) e os dias das runs a sério
const odds = {};
for (const r of await must(sb.from('odds_days').select('date,players'))) odds[r.date] = r.players || {};
const runs = (await must(sb.from('runs').select('id,name,mode,start_date,end_date,prizes').eq('fictitious', false)));
const real = new Set(runs.map(r => r.id));
const days = (await must(sb.from('run_days').select('run_id,date,objectives,games'))).filter(r => real.has(r.run_id)).map(r => ({ run: r.run_id, date: r.date, objectives: r.objectives || [], games: r.games || [] }));
// lineups jogados (sem conta nem nome): data, jogadores e se ganhou
const played = [];
for (const r of await must(sb.from('user_runs').select('run_id,plan'))) {
  if (!real.has(r.run_id)) continue;
  const plans = [r.plan || {}].concat(Object.values(((r.plan || {}).smurfs) || {}));
  for (const pl of plans) for (const [date, e] of Object.entries((pl && pl.played) || {})) {
    if (e && e.done && (e.result === 'win' || e.result === 'loss') && (e.lineup || []).length >= 3) played.push({ run: r.run_id, date, lineup: e.lineup.map(String), win: e.result === 'win' ? 1 : 0 });
  }
}
console.log('Dias com odds:', Object.keys(odds).length, '· dias de runs:', days.length, '· lineups jogados:', played.length);

fs.mkdirSync(DEST, { recursive: true });
const out = { v: 1, at: now.toISOString(), curYear, keys: ['p', 'season', 'date', 'eid', 'team', 'opp', 'home', 'win', 'diff'].concat(KEYS), players: list.map(p => [p.id, p.name, p.team]), games: rows, odds, runs, days, played };
fs.writeFileSync(DEST + '/dados.json.gz', zlib.gzipSync(JSON.stringify(out)));
console.log('Escrito:', DEST + '/dados.json.gz', Math.round(fs.statSync(DEST + '/dados.json.gz').size / 1024) + ' KB');
