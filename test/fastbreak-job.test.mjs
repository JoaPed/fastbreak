// Tarefa "Fast Break na blockchain": o histórico de cada conta (todos os dias jogados, todas as runs), com base de
// dados e blockchain falsas (test/helpers/job-preload.mjs).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
let fails = 0;
const ok = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'ok   ' : 'FALHA') + ' ' + label + (cond ? '' : ' → ' + JSON.stringify(info))); };
const root = new URL('..', import.meta.url).pathname;
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fb-historico-')), 'db.json');
const T = Date.parse('2026-10-21T18:00:00Z'), S = Math.floor(T / 1000), day = 86400;
const MAIN = '0x00000000000000aa', SMURF = '0x00000000000000bb';
// NFT 1 a 6: época passada (run antiga); 7: sem dia (apagado); 8: ontem, na run a decorrer (ainda pode mudar)
const nfts = {}, games = {};
const STATS = [['THREE_POINTERS_MADE', 13], ['REBOUNDS', 45], ['THREE_POINTERS_MADE', 14], ['POINTS', 130], ['ASSISTS', 30], ['THREE_POINTERS_MADE', 12]];
for (let i = 1; i <= 6; i++) {
  const dl = S - 200 * day + i * day;
  nfts[i] = { gameId: 'g' + i, runId: 'cr-old', deadline: dl, points: 100 + i, win: i % 2 === 0, names: ['Stephen Curry', '', 'LeBron James'] };
  games['g' + i] = { id: 'g' + i, name: 'Dia ' + i, runId: 'cr-old', deadline: dl, numPlayers: 5, status: 3, stats: [{ name: STATS[i - 1][0], type: 1, valueNeeded: STATS[i - 1][1] }] };
}
nfts[8] = { gameId: 'g-now', runId: 'cr-now', deadline: S - day + 3600, points: 140, win: true, names: ['Nikola Jokic'] };
games['g-now'] = { id: 'g-now', name: 'Dia 1', runId: 'cr-now', deadline: S - day + 3600, numPlayers: 5, status: 2, stats: [{ name: 'POINTS', type: 1, valueNeeded: 120 }] };
nfts[100] = { gameId: 'g1', runId: 'cr-old', deadline: S - 199 * day, points: 90, win: false, names: ['Jalen Brunson'] };
nfts[101] = { gameId: 'g2', runId: 'cr-old', deadline: S - 198 * day, points: 150, win: true, names: ['Jalen Brunson'] };
fs.writeFileSync(file, JSON.stringify({
  flow: { height: 5000, maxBatch: 3, ids: { [MAIN]: [1, 2, 3, 4, 5, 6, 7, 8], [SMURF]: [100, 101] }, nfts, games,
    runs: { 'cr-old': { id: 'cr-old', name: 'Classic - Run 20', runStart: S - 202 * day, runEnd: S - 180 * day, status: 3 }, 'cr-now': { id: 'cr-now', name: 'Classic - Run 1', runStart: S - 2 * day, runEnd: S + 9 * day, status: 1 } } },
  tables: {
    members: [{ user_id: 'u1' }],
    profiles: [{ user_id: 'u1', topshot_username: 'joao', flow_address: MAIN, smurfs: [{ id: 's1', topshot_username: 'smurfy', flow_address: SMURF }] }],
    runs: [{ id: 'run-1', name: 'Run 1 · Classic', chain_run_id: 'cr-now', prizes: [], fictitious: false, start_date: '2026-10-20', active: true }],
    run_days: [{ run_id: 'run-1', date: '2026-10-20', objectives: [], chain_game_id: null, games: [] }],
    chain_runs: [], chain_games: [], chain_results: [], job_state: [{ key: 'flow', value: { height: 4990 } }],
  } }));
const run = (max, args = []) => execFileSync(process.execPath, ['--import', path.join(root, 'test/helpers/job-preload.mjs'), path.join(root, 'scripts/sync-fastbreak.mjs'), ...args], { env: Object.assign({}, process.env, { FB_TEST_DB: file, FB_TEST_NOW: String(T), SUPABASE_URL: '', HISTORY_MAX: String(max) }), encoding: 'utf8' });
const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
const log1 = run(5); if (process.env.SHOWLOG) console.log(log1);
let db = read();
const mine = acc => db.tables.chain_results.filter(r => r.user_id === 'u1' && r.account === acc);
const hist = () => (db.tables.job_state.find(r => r.key === 'history') || {}).value || {};
ok('1.ª vez: os 5 NFT mais recentes da principal (um sem dia) e os 2 da smurf', mine('main').length === 4 && mine('s1').length === 2, db.tables.chain_results.map(r => r.account + ' ' + r.game_id), log1);
ok('lotes grandes demais para a Flow partidos ao meio', db.flow.scripts.filter(x => /^history/.test(x)).some(x => x === 'history 5') && db.flow.scripts.filter(x => /^history/.test(x)).every(x => x === 'history 5' || +x.split(' ')[1] <= 3), db.flow.scripts);
const r6 = mine('main').find(r => r.game_id === 'g6') || {};
ok('dia guardado com data, pontos, vitória e jogadores (sem nomes vazios)', r6.date === new Date((S - 194 * day - 4 * 3600) * 1000).toISOString().slice(0, 10) && r6.points === 106 && r6.win === true && JSON.stringify(r6.lineup) === '["Stephen Curry","LeBron James"]' && r6.chain_run_id === 'cr-old', r6);
ok('dias e runs do histórico lidos da blockchain', ['g4', 'g5', 'g6', 'g-now'].every(id => db.tables.chain_games.some(g => g.id === id)) && db.tables.chain_runs.some(r => r.id === 'cr-old' && r.name === 'Classic - Run 20'), db.tables.chain_games.map(g => g.id));
ok('o dia de ontem fica por fechar (volta a ser lido); o NFT sem dia não', JSON.stringify(hist()['u1|main'].done.sort()) === JSON.stringify(['4', '5', '6', '7']), hist());
ok('log diz quantos faltam', /faltam 3/.test(log1) && /ficam para as próximas/.test(log1), log1);
const log2 = run(5);
db = read();
ok('2.ª vez: o resto (1 a 3) e o de ontem outra vez', mine('main').length === 7 && JSON.stringify(hist()['u1|main'].done.slice().sort()) === JSON.stringify(['1', '2', '3', '4', '5', '6', '7']), mine('main').map(r => r.game_id), log2);
ok('a smurf já não tem nada novo', !/Histórico de smurfy/.test(log2) || /smurfy[^\n]*: 0 dias/.test(log2), log2);
const log3 = run(0);
ok('HISTORY_MAX=0 desliga o histórico', !/Histórico de/.test(log3), log3);
// run Classic nova criada antes da 1.ª leitura: só aparece por uma mudança de estado de um dos seus dias
db = read();
db.flow.height = 5100;
db.flow.events = [{ height: 5050, type: 'FastBreakGameStatusChange', data: { id: 'g-nova', newRawStatus: 1 } }];
db.flow.games['g-nova'] = { id: 'g-nova', name: 'Dia 1', runId: 'cr-nova', deadline: S + 6 * 3600, numPlayers: 5, status: 1, stats: [{ name: 'POINTS', type: 1, valueNeeded: 130 }] };
db.flow.runs['cr-nova'] = { id: 'cr-nova', name: 'Classic - Run 1 - NBA 2026-27 Season', runStart: S - 5 * 3600, runEnd: S + 10 * day, status: 1 };
fs.writeFileSync(file, JSON.stringify(db));
const log4 = run(0);
db = read();
const nova = db.tables.runs.find(r => r.chain_run_id === 'cr-nova') || {};
ok('run nova descoberta pelo estado de um dia e criada no site, ativa', nova.name === 'Run 1 · Classic' && nova.active === true && db.tables.runs.filter(r => r.active).length === 1, db.tables.runs, log4);
const d0 = db.tables.run_days.find(d => d.run_id === nova.id && d.date === new Date((S + 6 * 3600 - 4 * 3600) * 1000).toISOString().slice(0, 10)) || {};
ok('o dia dessa run ficou com o objetivo da blockchain', JSON.stringify(d0.objectives) === JSON.stringify([{ stat: 'pts', target: 130 }]) && d0.chain_game_id === 'g-nova', d0);
ok('log mostra as runs a decorrer', /Runs a decorrer ou a começar: .*Classic - Run 1 - NBA 2026-27/.test(log4), log4);
// run feita à mão no site + lineup submetido por alguém na run da blockchain: a run do site fica ligada (não há duplicado)
db = read();
db.flow.height = 5200;
db.flow.events = [{ height: 5150, type: 'FastBreakGameTokenMinted', data: { id: 77, fastBreakGameID: 'g-outra', serialNumber: 1, mintingDate: S, topShots: [1, 2], mintedTo: 9 } }];
db.flow.games['g-outra'] = { id: 'g-outra', name: 'Dia 1', runId: 'cr-outra', deadline: S + 30 * 3600, numPlayers: 5, status: 1, stats: [{ name: 'REBOUNDS', type: 1, valueNeeded: 45 }] };
db.flow.runs['cr-outra'] = { id: 'cr-outra', name: 'Classic - Run 2 - NBA 2026-27 Season', runStart: S + 20 * 3600, runEnd: S + 12 * day, status: 0 };
db.tables.runs.push({ id: 'manual-2', name: 'Run 2 (à mão)', mode: 'classic', start_date: new Date((S + 30 * 3600 - 4 * 3600) * 1000).toISOString().slice(0, 10), end_date: '2026-11-02', prizes: [], active: false, chain_run_id: null, fictitious: false });
fs.writeFileSync(file, JSON.stringify(db));
const log5 = run(0);
db = read();
const man = db.tables.runs.find(r => r.id === 'manual-2') || {};
ok('lineup submetido por alguém revela a run; a run feita à mão fica ligada e ativa, sem duplicado', man.chain_run_id === 'cr-outra' && man.active === true && !db.tables.runs.some(r => r.chain_run_id === 'cr-outra' && r.id !== 'manual-2'), db.tables.runs, log5);
// --backfill: os outros dias de uma run criados antes da 1.ª leitura, sem mexer no ponto onde a leitura normal vai
db = read();
db.flow.height = 5300;
db.flow.events = [{ height: 4000, type: 'FastBreakGameCreated', data: { id: 'g-nova-2', name: 'Dia 2', fastBreakRunID: 'cr-nova', submissionDeadline: S + 30 * 3600, numPlayers: 5 } }];
db.flow.games['g-nova-2'] = { id: 'g-nova-2', name: 'Dia 2', runId: 'cr-nova', deadline: S + 30 * 3600, numPlayers: 5, status: 0, stats: [{ name: 'ASSISTS', type: 1, valueNeeded: 32 }] };
fs.writeFileSync(file, JSON.stringify(db));
const log6 = run(0, ['--backfill', '2000']);
db = read();
const nv = db.tables.runs.find(r => r.chain_run_id === 'cr-nova') || {};
const d2 = db.tables.run_days.find(d => d.run_id === nv.id && d.chain_game_id === 'g-nova-2') || {};
ok('backfill encontra o dia 2 da run e põe o objetivo', JSON.stringify(d2.objectives) === JSON.stringify([{ stat: 'ast', target: 32 }]), d2, log6);
ok('backfill não mexe no ponto da leitura normal', ((db.tables.job_state.find(r => r.key === 'flow') || {}).value || {}).height === 5300, db.tables.job_state.find(r => r.key === 'flow'), log6);
console.log(fails ? fails + ' falha(s)' : 'histórico: tudo certo');
process.exit(fails ? 1 : 0);
