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
const run = max => execFileSync(process.execPath, ['--import', path.join(root, 'test/helpers/job-preload.mjs'), path.join(root, 'scripts/sync-fastbreak.mjs')], { env: Object.assign({}, process.env, { FB_TEST_DB: file, FB_TEST_NOW: String(T), SUPABASE_URL: '', HISTORY_MAX: String(max) }), encoding: 'utf8' });
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
console.log(fails ? fails + ' falha(s)' : 'histórico: tudo certo');
process.exit(fails ? 1 : 0);
