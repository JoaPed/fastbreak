// Tarefas automáticas: leitura do calendário, box scores, odds e respostas da blockchain (com exemplos no formato real).
import { parseSchedule, finalGameIds, addBoxscore, blendedAverages, consensusFromEvent, matchPlayers, decodeCadence, mapStat, objectivesFromStats, etDate, minutes, norm } from '../scripts/lib.mjs';
let fails = 0;
const ok = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'ok   ' : 'FALHA') + ' ' + label + (cond ? '' : ' → ' + JSON.stringify(info))); };

// calendário
const schedule = { leagueSchedule: { seasonYear: '2026-27', gameDates: [
  { gameDate: '10/16/2026 00:00:00', games: [{ gameId: '0012600071', gameStatus: 3, gameDateEst: '2026-10-16T00:00:00Z', gameDateTimeUTC: '2026-10-16T23:00:00Z', homeTeam: { teamTricode: 'NYK' }, awayTeam: { teamTricode: 'PHI' } }] },
  { gameDate: '10/20/2026 00:00:00', games: [
    { gameId: '0022600003', gameStatus: 1, gameDateEst: '2026-10-20T00:00:00Z', gameDateTimeUTC: '2026-10-21T01:30:00Z', homeTeam: { teamTricode: 'SAS' }, awayTeam: { teamTricode: 'OKC' } },
    { gameId: '0022600001', gameStatus: 1, gameDateEst: '2026-10-20T00:00:00Z', gameDateTimeUTC: '2026-10-20T19:00:00Z', homeTeam: { teamTricode: 'DET' }, awayTeam: { teamTricode: 'BOS' } },
  ] },
] } };
const byDate = parseSchedule(schedule);
ok('calendário ignora a pré-época', !byDate['2026-10-16'], byDate);
ok('calendário ordena por hora e guarda o id', JSON.stringify(byDate['2026-10-20'][0]) === JSON.stringify(['BOS', 'DET', '2026-10-20T19:00:00Z', '0022600001']), byDate['2026-10-20']);
ok('jogos terminados por prefixo', finalGameIds(schedule, ['00126']).length === 1 && finalGameIds(schedule, ['00226']).length === 0);
ok('data NBA de um jogo à 01:30 UTC é a véspera', etDate('2026-10-21T01:30:00Z') === '2026-10-20');
ok('minutos do box score', Math.abs(minutes('PT34M12.00S') - 34.2) < 1e-9 && minutes('') === 0);

// box scores e médias
const box = (team, opp, pid, name, pts, reb, min) => ({ game: {
  homeTeam: { teamTricode: team, players: [{ personId: pid, name, played: '1', statistics: { minutes: min, points: pts, reboundsTotal: reb, assists: 5, threePointersMade: 2, steals: 1, blocks: 0 } }] },
  awayTeam: { teamTricode: opp, players: [{ personId: 1, name: 'Banco', played: '0', statistics: { minutes: '' } }] },
} });
const state = { players: {} };
for (let i = 0; i < 20; i++) addBoxscore(state, box('LAL', 'BOS', 2544, 'LeBron James', 25, 7, 'PT35M00.00S'), 'prev', null);
addBoxscore(state, box('PHI', 'NYK', 2544, 'LeBron James', 0, 0, 'PT20M00.00S'), 'team', '2026-10-16');
addBoxscore(state, box('PHI', 'NYK', 2544, 'LeBron James', 35, 9, 'PT36M00.00S'), 'cur', '2026-10-20');
const lj = state.players['2544'];
ok('equipa vem do jogo mais recente desta época', lj.team === 'PHI', lj);
ok('jogo de pré-época não conta para a média', lj.cur.gp === 1, lj.cur);
ok('quem não jogou não conta', !state.players['1'].cur && !state.players['1'].prev, state.players['1']);
const b = blendedAverages(lj);
ok('média puxada para a época passada no início', b.avg.pts > 25 && b.avg.pts < 27, b);

// odds
const ev = { bookmakers: [
  { key: 'fanduel', markets: [{ key: 'player_points', outcomes: [
    { name: 'Over', description: 'Nikola Jokic', price: -115, point: 28.5 }, { name: 'Under', description: 'Nikola Jokic', price: -105, point: 28.5 },
    { name: 'Over', description: 'Shai Gilgeous-Alexander', price: -110, point: 31.5 }, { name: 'Under', description: 'Shai Gilgeous-Alexander', price: -110, point: 31.5 } ] }] },
  { key: 'draftkings', markets: [{ key: 'player_points', outcomes: [
    { name: 'Over', description: 'Nikola Jokic', price: -120, point: 28.5 }, { name: 'Under', description: 'Nikola Jokic', price: 100, point: 28.5 } ] }] },
  { key: 'betmgm', markets: [{ key: 'player_points', outcomes: [
    { name: 'Over', description: 'Nikola Jokic', price: 105, point: 29.5 }, { name: 'Under', description: 'Nikola Jokic', price: -125, point: 29.5 } ] }] },
] };
const c = consensusFromEvent(ev);
ok('linha de consenso = a mais comum', c['nikola jokic'].pts.line === 28.5 && c['nikola jokic'].pts.books === 2, c['nikola jokic']);
ok('preço de consenso favorece o mais', c['nikola jokic'].pts.over < c['nikola jokic'].pts.under, c['nikola jokic']);
const m = matchPlayers(c, [{ id: 203999, name: 'Nikola Jokić' }, { id: 1628983, name: 'Shai Gilgeous-Alexander' }]);
ok('nomes com e sem acentos ligam aos ids NBA', m.players['203999'] && m.players['1628983'] && !m.unmatched.length, m);
ok('normalização de nomes', norm("De'Aaron Fox Jr.") === 'deaaron fox' && norm('Luka Dončić') === 'luka doncic');

// blockchain (JSON-Cadence)
const jc = { type: 'Array', value: [{ type: 'Dictionary', value: [
  { key: { type: 'String', value: 'gameId' }, value: { type: 'String', value: 'abc-123' } },
  { key: { type: 'String', value: 'deadline' }, value: { type: 'UInt64', value: '1792537200' } },
  { key: { type: 'String', value: 'win' }, value: { type: 'Bool', value: true } },
  { key: { type: 'String', value: 'names' }, value: { type: 'Array', value: [{ type: 'String', value: 'Nikola Jokić' }] } },
  { key: { type: 'String', value: 'stats' }, value: { type: 'Array', value: [{ type: 'Dictionary', value: [
    { key: { type: 'String', value: 'name' }, value: { type: 'String', value: 'POINTS' } },
    { key: { type: 'String', value: 'type' }, value: { type: 'UInt8', value: '1' } },
    { key: { type: 'String', value: 'valueNeeded' }, value: { type: 'UInt64', value: '140' } } ] }] } },
  { key: { type: 'String', value: 'opt' }, value: { type: 'Optional', value: null } },
] }] };
const dec = decodeCadence(jc);
ok('JSON-Cadence → objeto', dec[0].gameId === 'abc-123' && dec[0].deadline === 1792537200 && dec[0].win === true && dec[0].names[0] === 'Nikola Jokić' && dec[0].opt === null, dec);
const ev2 = decodeCadence({ type: 'Event', value: { id: 'A.0b2a3299cc857e29.FastBreakV1.FastBreakGameStatAdded', fields: [{ name: 'fastBreakGameID', value: { type: 'String', value: 'g1' } }, { name: 'valueNeeded', value: { type: 'UInt64', value: '45' } }] } });
ok('evento da blockchain', ev2.fastBreakGameID === 'g1' && ev2.valueNeeded === 45, ev2);
ok('nomes de estatísticas', mapStat('POINTS') === 'pts' && mapStat('Total Rebounds') === 'reb' && mapStat('THREE_POINTERS_MADE') === 'fg3' && mapStat('3PM') === 'fg3' && mapStat('STEALS') === 'stl' && mapStat('BLOCKS') === 'blk' && mapStat('ASSISTS') === 'ast' && mapStat('POINTS_REBOUNDS') === 'pts+reb' && mapStat('XYZ') === null,
  ['POINTS', 'Total Rebounds', 'THREE_POINTERS_MADE', '3PM', 'POINTS_REBOUNDS'].map(mapStat));
const ob = objectivesFromStats(dec[0].stats);
ok('objetivo do dia a partir da blockchain', ob.objs[0].stat === 'pts' && ob.objs[0].target === 140 && !ob.objs[0].each, ob);

console.log(fails ? fails + ' falha(s)' : 'tarefas: tudo certo');
process.exit(fails ? 1 : 0);
