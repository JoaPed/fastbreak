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
run(Date.parse('2026-10-21T22:00:00Z')); // 23h em Lisboa, uma hora antes do primeiro jogo
db = read();
const lu = db.sent[1] || {}, st = db.sent[2] || {};
ok('lembrete do lineup uma hora antes do primeiro jogo (com a sugestão da conta que ainda não submeteu)', /Já fizeste o lineup/.test(lu.title) && /Conta principal: ✓ já submetido/.test(lu.message) && /smurfy: sugestão do site: Keshon Gilbert, LeBron James/.test(lu.message), lu);
ok('ponto da situação às 23h de quem continua em dúvida (quem está fora não)', /Ponto da situação/.test(st.title) && /Gilbert \(ATL\) continua dia a dia/.test(st.message) && !/Curry/.test(st.message), st);
run(Date.parse('2026-10-21T22:15:00Z'));
db = read();
ok('sem repetir o lembrete nem o ponto da situação', db.sent.length === 3, db.sent.length);
run(Date.parse('2026-10-21T22:40:00Z'));
db = read();
ok('última chamada meia hora antes do primeiro jogo do dia, com todos os que continuam em dúvida (também os de jogos mais tarde)', db.sent.length === 4 && /Última chamada/.test(db.sent[3].message) && /Gilbert/.test(db.sent[3].message) && /Curry/.test(db.sent[3].message), db.sent.slice(3));
const dbx = read(); dbx.espn.injuries = dbx.espn.injuries.filter(t => !/Hawks/.test(t.displayName)); fs.writeFileSync(file, JSON.stringify(dbx));
run(Date.parse('2026-10-21T22:47:00Z'));
db = read();
ok('sai do relatório: avisa que deve jogar', db.sent.length === 5 && /Gilbert \(ATL\) saiu do relatório de lesões: deve jogar/.test(db.sent[4].message), db.sent.slice(4));
run(Date.parse('2026-10-22T01:40:00Z')); // antes do jogo das 02:00 (o 2.º do dia): já não há outra última chamada
ok('só uma última chamada por dia', read().sent.length === 5, read().sent.slice(5));
db = read();
const n0 = db.sent.length;
run(T, ['--test']);
db = read();
ok('modo de teste manda a mensagem de teste a quem tem avisos', db.sent.length === n0 + 2 && db.sent.slice(n0).every(x => /teste/i.test(x.title)), db.sent.slice(n0).map(x => x.topic));

// ---------- grupo do Telegram: avisos dos lineups de toda a gente e o lembrete do lineup ----------
const file2 = path.join(path.dirname(file), 'db-tg.json');
const tgDb = JSON.parse(fs.readFileSync(file, 'utf8'));
tgDb.sent = []; tgDb.tables.job_state = []; tgDb.tables.alerts = []; // ninguém com avisos pessoais
tgDb.tables.profiles = [{ user_id: 'u1', display_name: 'João', smurfs: [{ id: 's1', topshot_username: 'smurfy' }] }, { user_id: 'u2', display_name: 'Marquês', smurfs: [] }, { user_id: 'u3', display_name: 'Rui', smurfs: [] }];
tgDb.tables.user_runs.push({ user_id: 'u2', run_id: 'run-1', roster: {}, plan: { next: { main: { '2026-10-21': ['keshon-gilbert'] } } } });
tgDb.tables.run_days = tgDb.tables.run_days.map(d => Object.assign({}, d, { objectives: [{ stat: 'fg3', target: 18 }] }));
tgDb.tables.nba_players = [{ id: 'stephen-curry', name: 'Stephen Curry', team: 'GSW', avg: { fg3: 4.6, min: 33 } }, { id: 'keshon-gilbert', name: 'Keshon Gilbert', team: 'ATL', avg: { fg3: 0.4, min: 14 } }, { id: 'lebron-james', name: 'LeBron James', team: 'LAL', avg: { fg3: 2.1, min: 34 } }, { id: 'trae-young', name: 'Trae Young', team: 'ATL', avg: { fg3: 3.1, min: 35 } }];
tgDb.espn = JSON.parse(JSON.stringify(espn)); tgDb.espn.injuries[0].injuries.push({ status: 'Day-To-Day', date: '2026-10-21T15:00Z', athlete: { displayName: 'Trae Young', team: { abbreviation: 'ATL' } }, type: { name: 'INJURY_STATUS_DAYTODAY' }, details: { type: 'Hamstring' } });
tgDb.telegram = { updates: [{ update_id: 1, my_chat_member: { chat: { id: -1001, type: 'group', title: 'Fast Break' } } }] };
fs.writeFileSync(file2, JSON.stringify(tgDb));
const runTg = (now, args = []) => execFileSync(process.execPath, ['--import', path.join(root, 'test/helpers/job-preload.mjs'), path.join(root, 'scripts/sync-injuries.mjs'), ...args], { env: Object.assign({}, process.env, { FB_TEST_DB: file2, FB_TEST_NOW: String(now), SUPABASE_URL: '', TELEGRAM_BOT_TOKEN: 'teste:abc', TELEGRAM_CHAT_ID: '', SITE_URL: '' }), encoding: 'utf8' });
const readTg = () => JSON.parse(fs.readFileSync(file2, 'utf8'));
const lg = runTg(T);
let g = readTg();
const hello = g.sent[0] || {}, g0 = g.sent[1] || {};
ok('Telegram: cumprimenta o grupo da primeira vez', /Hi! I’m the Fast Break bot/.test(hello.message || ''), hello);
ok('Telegram: o grupo é descoberto e guardado', (g.tables.job_state.find(r => r.key === 'telegram') || {}).value?.chat === '-1001', g.tables.job_state, lg);
ok('Telegram: especialista do dia em dúvida também entra (mesmo sem estar em nenhum lineup)', /<b>Trae Young<\/b> \(ATL\) · <b>Day-to-day<\/b>[^]*?⭐ 3PM specialist \(#2\)/.test(g0.message || ''), g0.message);
ok('Telegram: uma mensagem com as lesões dos lineups de toda a gente e de quem é cada um', g.sent.length === 2 && g0.via === 'tg' && g0.chat === '-1001' && /<b>Stephen Curry<\/b> \(GSW\) · <b>Out<\/b>/.test(g0.message) && /👥 In the lineup of <b>João<\/b>\n/.test(g0.message) && /<b>Keshon Gilbert<\/b> \(ATL\) · <b>Day-to-day<\/b>[^]*?👥 In the lineup of <b>João and Marquês<\/b>/.test(g0.message) && /\n\n/.test(g0.message), g.sent);
runTg(Date.parse('2026-10-21T22:00:00Z'));
g = readTg();
const gl = g.sent.find(x => /Lineups done/.test(x.message)) || {}, gs = g.sent.find(x => /Status update/.test(x.message)) || {};
ok('Telegram: lembrete do lineup só com o aviso, sem nomes', /<b>Lineups done\?<\/b>/.test(gl.message || '') && !/João|Marquês/.test(gl.message || ''), g.sent.map(x => x.message));
ok('Telegram: ponto da situação às 23h de quem está em dúvida', /<b>Keshon Gilbert<\/b> \(ATL\) · still <b>day-to-day<\/b>/.test(gs.message || ''), g.sent.map(x => x.message));
const nTg = g.sent.length;
runTg(Date.parse('2026-10-21T22:15:00Z'));
ok('Telegram: não repete', readTg().sent.length === nTg, readTg().sent.length);
console.log(fails ? fails + ' falha(s)' : 'avisos: tudo certo');
process.exit(fails ? 1 : 0);
