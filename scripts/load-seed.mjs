// Carrega dados escritos à mão (pasta data/seed) para o Supabase. Corre sozinho quando esses ficheiros mudam.
//   data/seed/runs/*.json     {run: {...}, days: [{date, objectives, games?}]}
//   data/seed/odds/*.json     {date, source, players: {personId: {pts: {line, over, under}}}}
//   data/seed/players.json    [{id, name, team, avg}]
import fs from 'node:fs';
import path from 'node:path';
import { supa, must, upsertChunks, fetchJson, parseEspnScoreboard } from './lib.mjs';

const sb = globalThis.__FB_TEST_SB || await supa(); // (nos testes: base de dados falsa)
// jogos de um dia no calendário da NBA (ESPN), para os dias de uma run sem jogos no ficheiro
const espnGames = async date => { try { const { json } = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + date.replace(/-/g, '')); return json ? parseEspnScoreboard(json) : null; } catch (e) { return null; } };
const root = path.resolve('data/seed');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const list = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.join(dir, f)) : [];

if (fs.existsSync(path.join(root, 'players.json'))) {
  const players = read(path.join(root, 'players.json'));
  await upsertChunks(sb, 'nba_players', players.map(p => Object.assign({ updated_at: new Date().toISOString() }, p)), 'id');
  console.log('Jogadores:', players.length);
}
for (const f of list(path.join(root, 'runs'))) {
  const { run, days } = read(f);
  // não tira a run ativa a outra: só fica ativa se ainda não houver nenhuma (sem contar com ela própria)
  if (run.active) {
    const act = await must(sb.from('runs').select('id').eq('active', true).neq('id', run.id));
    if (act.length) delete run.active;
  }
  await must(sb.from('runs').upsert(run));
  let withGames = 0;
  for (const d of days || []) {
    const row = { run_id: run.id, date: d.date };
    if (d.objectives) row.objectives = d.objectives;
    if (d.games) row.games = d.games;
    else if (!run.fictitious) { const g = await espnGames(d.date); if (g && g.length) { row.games = g; withGames++; } }
    await must(sb.from('run_days').upsert(row, { onConflict: 'run_id,date' }));
  }
  console.log('Run', run.id, '·', (days || []).length, 'dias' + (withGames ? ' · jogos da NBA lidos para ' + withGames : ''));
}
for (const f of list(path.join(root, 'odds'))) {
  const o = read(f);
  const prev = await must(sb.from('odds_days').select('players').eq('date', o.date).maybeSingle());
  const merged = Object.assign({}, (prev && prev.players) || {});
  for (const [id, stats] of Object.entries(o.players || {})) merged[id] = Object.assign({}, merged[id] || {}, stats);
  await must(sb.from('odds_days').upsert({ date: o.date, players: merged, source: o.source || 'Manual', updated_at: new Date().toISOString() }));
  console.log('Odds', o.date, '·', Object.keys(o.players || {}).length, 'jogadores');
}
