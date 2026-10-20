// Tarefa "Carregar dados manuais": run escrita à mão (data/seed/runs) com os jogos da NBA lidos para cada dia.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
let fails = 0;
const ok = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'ok   ' : 'FALHA') + ' ' + label + (cond ? '' : ' → ' + JSON.stringify(info))); };
const root = new URL('..', import.meta.url).pathname;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-seed-'));
fs.mkdirSync(path.join(dir, 'data/seed/runs'), { recursive: true });
const seedRun = { run: { id: 'run-1-classic-2026-27', name: 'Run 1 · Classic', mode: 'classic', start_date: '2026-10-20', end_date: '2026-11-01', prizes: [{ wins: 11, value: 7 }, { wins: 12, value: 28 }, { wins: 13, value: 365 }], active: true, fictitious: false },
  days: Array.from({ length: 13 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 20 + i)).toISOString().slice(0, 10), objectives: i === 1 ? [{ stat: 'fg3', target: 18 }, { stat: 'fg3a', target: 30 }] : [{ stat: 'pts', target: 120 }] })) };
fs.writeFileSync(path.join(dir, 'data/seed/runs/run-1.json'), JSON.stringify(seedRun));
const comp = (a, h, t) => ({ id: '40' + a + h, date: t, season: { type: 2 }, competitions: [{ competitors: [{ homeAway: 'away', team: { abbreviation: a } }, { homeAway: 'home', team: { abbreviation: h } }] }] });
const file = path.join(dir, 'db.json');
fs.writeFileSync(file, JSON.stringify({ tables: { runs: [], run_days: [] }, scoreboard: { 20261020: [comp('NY', 'PHI', '2026-10-20T23:00Z'), comp('SA', 'OKC', '2026-10-21T01:30Z')] } }));
const log = execFileSync(process.execPath, ['--import', path.join(root, 'test/helpers/job-preload.mjs'), path.join(root, 'scripts/load-seed.mjs')], { cwd: dir, env: Object.assign({}, process.env, { FB_TEST_DB: file, SUPABASE_URL: '' }), encoding: 'utf8' });
const db = JSON.parse(fs.readFileSync(file, 'utf8'));
const run = db.tables.runs[0] || {};
ok('run criada, ativa, a sério, 13 dias', run.id === 'run-1-classic-2026-27' && run.active === true && run.fictitious === false && db.tables.run_days.length === 13, run, log);
const d1 = db.tables.run_days.find(d => d.date === '2026-10-20') || {}, d2 = db.tables.run_days.find(d => d.date === '2026-10-21') || {};
ok('dia 1: os 2 jogos da NBA (siglas do site) e o objetivo', JSON.stringify(d1.games.map(g => g.slice(0, 2))) === '[["NYK","PHI"],["SAS","OKC"]]' && d1.objectives[0].stat === 'pts', d1);
ok('dia 2: dois objetivos (triplos marcados e tentados)', JSON.stringify(d2.objectives) === JSON.stringify([{ stat: 'fg3', target: 18 }, { stat: 'fg3a', target: 30 }]), d2);
ok('prémios pelo ranking (estimativa) por vitórias', JSON.stringify(run.prizes.map(p => p.wins)) === '[11,12,13]', run.prizes);
console.log(fails ? fails + ' falha(s)' : 'dados manuais: tudo certo');
process.exit(fails ? 1 : 0);
