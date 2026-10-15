// Carrega dados escritos à mão (pasta data/seed) para o Supabase. Corre sozinho quando esses ficheiros mudam.
//   data/seed/runs/*.json     {run: {...}, days: [{date, objectives, games?}]}
//   data/seed/odds/*.json     {date, source, players: {personId: {pts: {line, over, under}}}}
//   data/seed/players.json    [{id, name, team, avg}]
import fs from 'node:fs';
import path from 'node:path';
import { supa, must, upsertChunks } from './lib.mjs';

const sb = await supa();
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
  await must(sb.from('runs').upsert(run));
  for (const d of days || []) {
    const row = { run_id: run.id, date: d.date };
    if (d.objectives) row.objectives = d.objectives;
    if (d.games) row.games = d.games;
    await must(sb.from('run_days').upsert(row, { onConflict: 'run_id,date' }));
  }
  console.log('Run', run.id, '·', (days || []).length, 'dias');
}
for (const f of list(path.join(root, 'odds'))) {
  const o = read(f);
  const prev = await must(sb.from('odds_days').select('players').eq('date', o.date).maybeSingle());
  const merged = Object.assign({}, (prev && prev.players) || {});
  for (const [id, stats] of Object.entries(o.players || {})) merged[id] = Object.assign({}, merged[id] || {}, stats);
  await must(sb.from('odds_days').upsert({ date: o.date, players: merged, source: o.source || 'Manual', updated_at: new Date().toISOString() }));
  console.log('Odds', o.date, '·', Object.keys(o.players || {}).length, 'jogadores');
}
