// Tarefa "Lesões e avisos" de ponta a ponta, com base de dados e internet falsas (test/helpers/job-preload.mjs).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
let fails = 0;
const ok = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'ok   ' : 'FALHA') + ' ' + label + (cond ? '' : ' → ' + JSON.stringify(info))); };
const root = new URL('..', import.meta.url).pathname;
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fb-avisos-')), 'db.json');
const espn = { injuries: [
  { displayName: 'Atlanta Hawks', injuries: [{ status: 'Day-To-Day', date: '2026-10-21T14:00Z', shortComment: 'Gilbert is questionable.', athlete: { displayName: 'Keshon Gilbert', team: { abbreviation: 'ATL' } }, type: { name: 'INJURY_STATUS_DAYTODAY' }, details: { fantasyStatus: { description: 'GTD' }, type: 'Knee' } }] },
  { displayName: 'Golden State Warriors', injuries: [{ status: 'Out', date: '2026-10-21T12:00Z', athlete: { displayName: 'Stephen Curry', team: { abbreviation: 'GS' } }, type: { name: 'INJURY_STATUS_OUT' }, details: { type: 'Ankle', returnDate: '2026-10-24' } }] },
] };
const games = [['ATL', 'BOS', '2026-10-21T23:00:00Z'], ['GSW', 'LAL', '2026-10-22T02:00:00Z']];
fs.writeFileSync(file, JSON.stringify({ espn, tables: {
  members: [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }],
  alerts: [{ user_id: 'u1', email: false, ntfy: 'fastbreak-teste123' }, { user_id: 'u2', email: false, ntfy: null }, { user_id: 'u3', email: false, ntfy: 'fastbreak-amigo456' }],
  profiles: [{ user_id: 'u1', display_name: 'João', smurfs: [{ id: 's1', topshot_username: 'smurfy' }] }, { user_id: 'u3', display_name: 'Rui', smurfs: [] }],
  runs: [{ id: 'run-1', name: 'Run 1', chain_run_id: 'cr1', fictitious: false }, { id: 'teste', name: 'Run de teste', chain_run_id: null, fictitious: true }],
  run_days: [{ run_id: 'run-1', date: '2026-10-21', games }, { run_id: 'teste', date: '2026-10-21', games }],
  nba_players: [{ id: 'stephen-curry', name: 'Stephen Curry', team: 'GSW' }, { id: 'keshon-gilbert', name: 'Keshon Gilbert', team: 'ATL' }, { id: 'lebron-james', name: 'LeBron James', team: 'LAL' }],
  user_runs: [{ user_id: 'u1', run_id: 'run-1', roster: {}, plan: { next: { main: { '2026-10-21': ['lebron-james'] }, s1: { '2026-10-21': ['keshon-gilbert', 'lebron-james'] } } } },
    { user_id: 'u3', run_id: 'teste', roster: {}, plan: { next: { main: { '2026-10-21': ['stephen-curry'] } } } }],
  chain_results: [{ user_id: 'u1', game_id: 'g1', account: 'main', chain_run_id: 'cr1', date: '2026-10-21', lineup: ['Stephen Curry', 'LeBron James'], win: false }],
  job_state: [],
  injuries: [{ id: 'jogador-antigo', name: 'Antigo', status: 'out', updated_at: '2026-10-01T00:00:00Z' }],
} }));
const run = (now, args = []) => execFileSync(process.execPath, ['--import', path.join(root, 'test/helpers/job-preload.mjs'), path.join(root, 'scripts/sync-injuries.mjs'), ...args], { env: Object.assign({}, process.env, { FB_TEST_DB: file, FB_TEST_NOW: String(now), SUPABASE_URL: '', SMTP_USER: '', SMTP_PASS: '', SITE_URL: 'https://exemplo.github.io/fastbreak/' }), encoding: 'utf8' });
const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
const T = Date.parse('2026-10-21T18:00:00Z');
const log1 = run(T);
let db = read();
ok('relatório guardado e quem saiu do relatório apagado', db.tables.injuries.length === 2 && !db.tables.injuries.some(r => r.id === 'jogador-antigo'), db.tables.injuries.map(r => r.id));
ok('um aviso para quem tem o telemóvel ligado (só uma mensagem por pessoa)', db.sent.length === 1 && db.sent[0].topic === 'fastbreak-teste123', db.sent);
const m = db.sent[0] || {};
ok('aviso: lineup submetido na conta principal e lineup do plano na smurf', /Stephen Curry \(GSW\): Fora · Ankle/.test(m.message) && /submetido no Top Shot/.test(m.message) && /smurfy:/.test(m.message) && /Keshon Gilbert \(ATL\): Dia a dia/.test(m.message) && /plano do site/.test(m.message), m.message);
ok('aviso: prioridade alta e link para o site', m.priority === 4 && m.click === 'https://exemplo.github.io/fastbreak/' && /Fast Break/.test(m.title), m);
ok('runs de teste (jogos inventados) não dão avisos', !db.sent.some(x => x.topic === 'fastbreak-amigo456'), db.sent);
ok('o que foi avisado fica guardado', Object.keys((db.tables.job_state.find(r => r.key === 'alerts') || {}).value || {}).length === 2, db.tables.job_state, log1);
run(T + 1800e3);
db = read();
ok('meia hora depois, sem novidades, não manda nada', db.sent.length === 1, db.sent.length);
run(Date.parse('2026-10-21T22:00:00Z'));
db = read();
ok('última chamada para quem continua em dúvida, perto do jogo', db.sent.length === 2 && /Última chamada/.test(db.sent[1].message) && /Gilbert/.test(db.sent[1].message), db.sent.slice(1));
run(T, ['--test']);
db = read();
ok('modo de teste manda a mensagem de teste a quem tem avisos', db.sent.length === 4 && db.sent.slice(2).every(x => /teste/i.test(x.title)), db.sent.slice(2).map(x => x.topic));
console.log(fails ? fails + ' falha(s)' : 'avisos: tudo certo');
process.exit(fails ? 1 : 0);
