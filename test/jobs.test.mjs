// Tarefas automáticas: leitura do calendário, box scores, odds e respostas da blockchain (com exemplos no formato real).
import { parseSchedule, finalGameIds, addBoxscore, addEspnSeason, addEspnRoster, teamOf, playerKey, espnTeam, blendedAverages, consensusFromEvent, matchPlayers, decodeCadence, mapStat, objectivesFromStats, etDate, minutes, norm } from '../scripts/lib.mjs';
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

// médias: ESPN (época passada e plantéis) + box scores da NBA (esta época)
const espnSeason = {
  categories: [
    { name: 'general', names: ['gamesPlayed', 'avgMinutes', 'avgFouls', 'avgRebounds'] },
    { name: 'offensive', names: ['avgPoints', 'avgFieldGoalsMade', 'avgThreePointFieldGoalsMade', 'avgAssists'] },
    { name: 'defensive', names: ['avgSteals', 'avgBlocks'] },
  ],
  athletes: [
    { athlete: { id: '1966', displayName: 'LeBron James', teamShortName: 'LAL' }, categories: [
      { name: 'general', totals: ['70', '34.9', '1.2', '7.8'] }, { name: 'offensive', totals: ['24.4', '9.1', '2.1', '8.2'] }, { name: 'defensive', totals: ['1.0', '0.6'] } ] },
    { athlete: { id: '3', displayName: 'Stephen Curry', teamShortName: 'GS' }, categories: [
      { name: 'general', totals: ['66', '32.0', '1.5', '4.4'] }, { name: 'offensive', totals: ['26.0', '8.5', '4.4', '6.0'] }, { name: 'defensive', totals: ['1.1', '0.4'] } ] },
  ],
};
const state = { players: {} };
ok('ESPN: médias da época passada', addEspnSeason(state, espnSeason) === 2 && state.players['lebron-james'].prevAvg.pts === 24.4 && state.players['lebron-james'].prevAvg.reb === 7.8 && state.players['stephen-curry'].prevAvg.fg3 === 4.4, state.players);
ok('ESPN: abreviaturas de equipa convertidas', state.players['stephen-curry'].prevTeam === 'GSW' && espnTeam('UTAH') === 'UTA' && espnTeam('WSH') === 'WAS');
addEspnRoster(state, 'PHI', { athletes: [{ displayName: 'LeBron James' }, { displayName: 'VJ Edgecombe' }] }, '2026-10-15');
ok('ESPN: plantel atual dá a equipa nova antes do 1.º jogo', teamOf(state.players['lebron-james']) === 'PHI', state.players['lebron-james']);
ok('ESPN: rookie entra no catálogo', !!state.players['vj-edgecombe'] && teamOf(state.players['vj-edgecombe']) === 'PHI');
const box = (team, opp, pid, name, pts, reb, min) => ({ game: {
  homeTeam: { teamTricode: team, players: [{ personId: pid, name, played: '1', statistics: { minutes: min, points: pts, reboundsTotal: reb, assists: 5, threePointersMade: 2, steals: 1, blocks: 0 } }] },
  awayTeam: { teamTricode: opp, players: [{ personId: 1, name: 'Banco Teste', played: '0', statistics: { minutes: '' } }] },
} });
addBoxscore(state, box('PHI', 'NYK', 2544, 'LeBron James', 0, 0, 'PT20M00.00S'), 'team', '2026-10-10');
addBoxscore(state, box('PHI', 'NYK', 2544, 'LeBron James', 35, 9, 'PT36M00.00S'), 'cur', '2026-10-20');
const lj = state.players['lebron-james'];
ok('mesmo jogador junta NBA e ESPN pelo nome', lj.nbaId === '2544' && lj.prevAvg && lj.cur, lj);
ok('jogo de pré-época não conta para a média', lj.cur.gp === 1, lj.cur);
ok('quem não jogou não conta', !state.players['banco-teste'].cur, state.players['banco-teste']);
const b = blendedAverages(lj);
ok('média puxada para a época passada no início', b.avg.pts > 24.4 && b.avg.pts < 26, b);
ok('chave pelo nome com acentos', playerKey('Nikola Jokić') === 'nikola-jokic' && playerKey("De'Aaron Fox Jr.") === 'deaaron-fox');

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
const m = matchPlayers(c, [{ id: 'nikola-jokic', name: 'Nikola Jokić' }, { id: 'shai-gilgeous-alexander', name: 'Shai Gilgeous-Alexander' }]);
ok('nomes com e sem acentos ligam ao catálogo', m.players['nikola-jokic'] && m.players['shai-gilgeous-alexander'] && !m.unmatched.length, m);
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
