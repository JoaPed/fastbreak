// Tarefas automáticas: leitura do calendário, box scores, odds e respostas da blockchain (com exemplos no formato real).
import { parseSchedule, finalGameIds, addBoxscore, addEspnSeason, addEspnCurrent, addEspnRoster, parseEspnScoreboard, parseEspnBox, teamOf, playerKey, espnTeam, blendedAverages, consensusFromEvent, matchPlayers, decodeCadence, mapStat, objectivesFromStats, etDate, minutes, norm, parseEspnCoreStats, addEspnCore, marketsForStat, addBoxForm, formOf, teamRows, GAME_KEYS, parseEspnInjuries, injuryStatus, buildAlerts, alertText, parseEspnGamelog, histFromGames } from '../scripts/lib.mjs';
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
const cur = JSON.parse(JSON.stringify(espnSeason)); cur.athletes = [cur.athletes[0]]; cur.athletes[0].athlete.teamShortName = 'PHI';
cur.athletes[0].categories[0].totals = ['3', '33.0', '1.0', '9.0']; cur.athletes[0].categories[1].totals = ['30.0', '11', '2.0', '7.0'];
addEspnCurrent(state, cur);
const b2 = blendedAverages(state.players['lebron-james']);
ok('ESPN: médias desta época (3 jogos) puxadas para a época passada', b2.gp === 3 && b2.avg.pts > 24.4 && b2.avg.pts < 30, b2);
// lista completa da ESPN (nomes reais das colunas) e ficha de cada jogador
const full = { categories: [
  { name: 'general', names: ['gamesPlayed', 'avgMinutes', 'avgRebounds'] },
  { name: 'offensive', names: ['avgPoints', 'avgFieldGoalsMade', 'avgFieldGoalsAttempted', 'avgThreePointFieldGoalsMade', 'avgThreePointFieldGoalsAttempted', 'avgFreeThrowsMade', 'avgFreeThrowsAttempted', 'avgAssists', 'avgTurnovers'] },
  { name: 'defensive', names: ['avgSteals', 'avgBlocks'] } ],
  athletes: [{ athlete: { id: '3945274', displayName: 'Luka Dončić', teamShortName: 'LAL' }, categories: [
    { name: 'general', values: [64, 35.8, 7.73] }, { name: 'offensive', values: [33.5, 10.83, 22.77, 3.97, 10.84, 7.86, 10.08, 8.28, 3.98] }, { name: 'defensive', values: [1.64, 0.53] } ] }] };
const st2 = { players: {} };
addEspnSeason(st2, full);
const luka = st2.players['luka-doncic'];
ok('ESPN: médias de lançamentos, triplos tentados e perdas de bola', luka.espnId === '3945274' && luka.prevAvg.fga === 22.77 && luka.prevAvg.fg3a === 10.84 && luka.prevAvg.tov === 3.98 && luka.prevAvg.ftm === 7.86 && luka.prevAvg.oreb == null, luka.prevAvg);
const core = parseEspnCoreStats({ splits: { categories: [
  { name: 'defensive', stats: [{ name: 'defensiveRebounds', value: 454 }, { name: 'avgDefensiveRebounds', value: 7.09375 }] },
  { name: 'general', stats: [{ name: 'gamesPlayed', value: 64 }] },
  { name: 'offensive', stats: [{ name: 'avgOffensiveRebounds', value: 0.640625 }, { name: 'pointsInPaint', value: 0 }] } ] } });
ok('ESPN: ficha do jogador dá ressaltos ofensivos e defensivos', core.gp === 64 && core.oreb === 0.64 && core.dreb === 7.09, core);
ok('ficha junta-se às médias', addEspnCore(luka, 'prevAvg', core) && luka.prevAvg.oreb === 0.64 && luka.prevAvg.coreGp === 64);
addEspnSeason(st2, full);
ok('ressaltos ofensivos ficam enquanto o número de jogos não muda', luka.prevAvg.oreb === 0.64, luka.prevAvg);
const bl = blendedAverages(luka).avg;
ok('médias novas passam para o catálogo', bl.oreb === 0.64 && bl.fga === 22.77 && bl.tov === 3.98 && bl.pts === 33.5, bl);
const half = blendedAverages({ prevAvg: { gp: 60, pts: 20, oreb: 2 }, curAvg: { gp: 4, pts: 30 } }).avg;
ok('estatística que só a época passada tem não é puxada para zero', half.oreb === 2 && half.pts > 20 && half.pts < 30, half);
ok('ficha sem jogos é ignorada', parseEspnCoreStats({ splits: { categories: [] } }) === null);
const sbd = { events: [
  { id: '401909090', date: '2026-10-21T01:30Z', season: { type: 2 }, competitions: [{ competitors: [{ homeAway: 'home', team: { abbreviation: 'SA' } }, { homeAway: 'away', team: { abbreviation: 'OKC' } }] }] },
  { id: '401909088', date: '2026-10-20T19:00Z', season: { type: 2 }, competitions: [{ competitors: [{ homeAway: 'home', team: { abbreviation: 'DET' } }, { homeAway: 'away', team: { abbreviation: 'BOS' } }] }] },
  { id: '1', date: '2026-10-10T19:00Z', season: { type: 1 }, competitions: [{ competitors: [{ homeAway: 'home', team: { abbreviation: 'NY' } }, { homeAway: 'away', team: { abbreviation: 'PHI' } }] }] },
] };
const games = parseEspnScoreboard(sbd);
ok('ESPN: calendário do dia, por hora, sem pré-época, com equipas NBA', games.length === 2 && JSON.stringify(games[0]) === JSON.stringify(['BOS', 'DET', '2026-10-20T19:00Z', 'espn:401909088']) && games[1][1] === 'SAS', games);
ok('hora da ESPN lê-se como data', !isNaN(Date.parse('2026-10-20T19:00Z')));
const summary = { boxscore: { players: [{ team: { abbreviation: 'SAC' }, statistics: [{
  keys: ['minutes', 'points', 'fieldGoalsMade-fieldGoalsAttempted', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'freeThrowsMade-freeThrowsAttempted', 'rebounds', 'assists', 'turnovers', 'steals', 'blocks', 'offensiveRebounds', 'defensiveRebounds', 'fouls', 'plusMinus'],
  labels: ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'OREB', 'DREB', 'PF', '+/-'],
  athletes: [
    { athlete: { displayName: 'Domantas Sabonis' }, didNotPlay: false, stats: ['25', '12', '6-7', '0-0', '0-1', '7', '8', '2', '2', '0', '3', '4', '2', '-11'] },
    { athlete: { displayName: 'Doug McDermott' }, didNotPlay: true, stats: [] },
  ] }] }] } };
const bx = parseEspnBox(summary);
ok('ESPN: estatísticas de um jogo por jogador', bx['domantas sabonis'].pts === 12 && bx['domantas sabonis'].reb === 7 && bx['domantas sabonis'].ast === 8 && bx['domantas sabonis'].fg3 === 0 && bx['domantas sabonis'].stl === 2 && !bx['doug mcdermott'], bx);
const ds = bx['domantas sabonis'];
ok('ESPN: lançamentos, tentados, perdas de bola e ressaltos ofensivos', ds.fgm === 6 && ds.fga === 7 && ds.fg3a === 0 && ds.ftm === 0 && ds.fta === 1 && ds.tov === 2 && ds.oreb === 3 && ds.dreb === 4, ds);
// forma: últimos 10 jogos a partir das estatísticas de cada jogo
const fst = { players: { 'domantas-sabonis': { name: 'Domantas Sabonis' } } };
for (let k = 1; k <= 12; k++) {
  const day = '2026-11-' + String(k).padStart(2, '0');
  const sm = JSON.parse(JSON.stringify(summary)); sm.boxscore.players[0].statistics[0].athletes[0].stats[1] = String(10 + k); // pontos 11..22
  addBoxForm(fst, parseEspnBox(sm), day);
}
addBoxForm(fst, parseEspnBox(summary), '2026-11-12'); // o mesmo jogo lido duas vezes não conta a dobrar
const fm = formOf(fst.players['domantas-sabonis']);
ok('forma: últimos 10 e últimos 5 jogos', fm.n10 === 10 && fm.n5 === 5 && fm.l5.pts === (18 + 19 + 20 + 21 + 12) / 5 && fm.l10.reb === 7 && fm.last === '2026-11-12', fm);
ok('forma: quem não jogou não entra e jogador desconhecido é ignorado', addBoxForm(fst, { 'ninguem conhecido': { min: 30, pts: 10 }, 'domantas sabonis': { min: 0, pts: 0 } }, '2026-11-13') === 0 && formOf({}) === null);
// jogos e equipas: com as duas equipas no box score
const two = JSON.parse(JSON.stringify(summary));
two.boxscore.players.push({ team: { abbreviation: 'GS' }, statistics: [{ keys: summary.boxscore.players[0].statistics[0].keys, labels: summary.boxscore.players[0].statistics[0].labels, athletes: [{ athlete: { displayName: 'Stephen Curry' }, stats: ['33', '30', '10-20', '6-12', '4-4', '5', '6', '3', '1', '0', '0', '5', '2', '+9'] }] }] });
const tb = parseEspnBox(two);
ok('jogo: equipa de cada jogador', tb['domantas sabonis'].team === 'SAC' && tb['stephen curry'].team === 'GSW', tb);
const gst = { players: { 'domantas-sabonis': { name: 'Domantas Sabonis' }, 'stephen-curry': { name: 'Stephen Curry' } } };
addBoxForm(gst, tb, '2026-11-02');
const sf = formOf(gst.players['domantas-sabonis']);
ok('últimos jogos: data, adversário e estatísticas', sf.games.length === 1 && sf.games[0][0] === '2026-11-02' && sf.games[0][1] === 'GSW' && sf.games[0][2 + GAME_KEYS.indexOf('pts')] === 12 && sf.games[0][2 + GAME_KEYS.indexOf('fga')] === 7, sf.games);
const trs = teamRows(gst);
const sac = trs.find(x => x.id === 'SAC'), nba = trs.find(x => x.id === 'NBA');
ok('equipas: o que concedem (o adversário marcou) e média da liga', sac.stats.allowed.pts === 30 && sac.stats.scored.pts === 12 && nba.stats.allowed.pts === 21, trs);
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
{ const m2 = matchPlayers({ 'herb jones': { pts: {} }, 'tre jones': { pts: {} } }, [{ id: 'hj', name: 'Herbert Jones' }, { id: 'tj', name: 'Tre Jones' }, { id: 'cj', name: 'Colby Jones' }]);
  ok('diminutivo liga ao nome completo (Herb = Herbert)', m2.players.hj && m2.players.tj && !m2.unmatched.length, m2); }

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
const real = { POINTS_IN_PAINT: 'pip', OFFENSIVE_REBOUNDS: 'oreb', THREE_POINTS_MADE: 'fg3', THREE_POINTS_ATT: 'fg3a', POINTS: 'pts', ASSISTS: 'ast', REBOUNDS: 'reb', ASSISTS_MINUS_TURNOVERS: 'ast-tov', FIELD_GOALS_MADE: 'fgm', FIELD_GOALS_ATT: 'fga', STEALS: 'stl', BLOCKS: 'blk' };
const wrong = Object.entries(real).filter(([n, k]) => mapStat(n) !== k).map(([n]) => n + '→' + mapStat(n));
ok('nomes reais do Fast Break (lidos da blockchain)', !wrong.length, wrong);
ok('nomes desconhecidos não são lidos à sorte', mapStat('FAST_BREAK_POINTS') === null && mapStat('MINUS') === null && mapStat('POINTS_OFF_TURNOVERS') === null, ['FAST_BREAK_POINTS', 'MINUS', 'POINTS_OFF_TURNOVERS'].map(mapStat));
ok('outros nomes prováveis', mapStat('DEFENSIVE_REBOUNDS') === 'dreb' && mapStat('TURNOVERS') === 'tov' && mapStat('FREE_THROWS_MADE') === 'ftm' && mapStat('STEALS_PLUS_BLOCKS') === 'stl+blk' && mapStat('POINTS_REBOUNDS_ASSISTS') === 'pts+reb+ast' && mapStat('THREE_POINT_FIELD_GOALS_ATTEMPTED') === 'fg3a');
ok('mercados de odds para cada estatística', JSON.stringify(marketsForStat('ast-tov')) === JSON.stringify(['player_assists', 'player_turnovers']) && marketsForStat('pip')[0] === 'player_points' && marketsForStat('oreb')[0] === 'player_rebounds' && marketsForStat('fga')[0] === 'player_field_goals' && JSON.stringify(marketsForStat('fgm+fga')) === JSON.stringify(['player_field_goals', 'player_points']) && JSON.stringify(marketsForStat('fta')) === JSON.stringify(['player_frees_attempts', 'player_points']) && marketsForStat('fg3a')[0] === 'player_threes' && marketsForStat('xyz').length === 0);
const ind = objectivesFromStats([{ name: 'ASSISTS_MINUS_TURNOVERS', type: 1, valueNeeded: 25 }, { name: 'POINTS', type: 0, valueNeeded: 20 }]);
ok('objetivo combinado e objetivo por jogador', ind.objs[0].stat === 'ast-tov' && ind.objs[0].target === 25 && !ind.objs[0].each && ind.objs[1].each === true, ind);
const ob = objectivesFromStats(dec[0].stats);
ok('objetivo do dia a partir da blockchain', ob.objs[0].stat === 'pts' && ob.objs[0].target === 140 && !ob.objs[0].each, ob);


// lesões (formato real do relatório da ESPN) e avisos
const espnInj = { timestamp: '2026-10-15T15:00:00Z', status: 'success', injuries: [
  { id: '1', displayName: 'Atlanta Hawks', injuries: [
    { id: '534140', status: 'Day-To-Day', date: '2026-10-15T14:00Z', shortComment: 'Gilbert is questionable for Thursday.', athlete: { displayName: 'Keshon Gilbert', team: { id: '1', abbreviation: 'ATL', displayName: 'Atlanta Hawks' } }, type: { name: 'INJURY_STATUS_DAYTODAY', abbreviation: 'DD' }, details: { fantasyStatus: { description: 'GTD' }, type: 'Knee', location: 'Leg', detail: 'Tendinitis', side: 'Left', returnDate: '2026-10-16' } },
    { id: '534150', status: 'Out', date: '2026-10-14T20:00Z', shortComment: 'Veesaar is expected to miss the 2026-27 season.', athlete: { displayName: 'Henri Veesaar', team: { abbreviation: 'ATL' } }, type: { name: 'INJURY_STATUS_OUT' }, details: { fantasyStatus: { description: 'OUT' }, type: 'Knee', detail: 'ACL', returnDate: '2027-10-01' } },
  ] },
  { id: '9', displayName: 'Golden State Warriors', injuries: [
    { id: '1', status: 'Out', date: '2026-10-15T12:00Z', shortComment: 'Curry will miss the season opener.', athlete: { displayName: 'Stephen Curry', team: { abbreviation: 'GS' } }, type: { name: 'INJURY_STATUS_OUT' }, details: { type: 'Ankle', side: 'Not Specified', returnDate: '2026-10-24' } },
    { id: '2', status: 'Questionable', athlete: { displayName: 'Jonathan Kuminga' }, details: {} },
  ] },
] };
const inj = parseEspnInjuries(espnInj);
const by = Object.fromEntries(inj.map(x => [x.id, x]));
ok('lesões: um por jogador, com a chave do catálogo', inj.length === 4 && by['keshon-gilbert'] && by['stephen-curry'], inj.map(x => x.id));
ok('lesões: dia a dia, regresso e detalhe', by['keshon-gilbert'].status === 'dtd' && by['keshon-gilbert'].return_date === '2026-10-16' && by['keshon-gilbert'].detail === 'Knee · Tendinitis (left)' && by['keshon-gilbert'].team === 'ATL', by['keshon-gilbert']);
ok('lesões: fora da época pelo comentário', by['henri-veesaar'].status === 'ofs', by['henri-veesaar']);
ok('lesões: "falha o jogo de abertura" não é fora da época', by['stephen-curry'].status === 'out' && by['stephen-curry'].team === 'GSW' && by['stephen-curry'].detail === 'Ankle', by['stephen-curry']);
ok('lesões: equipa pelo nome quando falta a abreviatura', by['jonathan-kuminga'].team === 'GSW' && by['jonathan-kuminga'].status === 'questionable', by['jonathan-kuminga']);
ok('lesões: outros estados', injuryStatus({ status: 'Doubtful' }) === 'doubtful' && injuryStatus({ status: 'Probable' }) === 'probable' && injuryStatus({ status: 'Suspension' }) === 'out' && injuryStatus({}) === 'dtd');
const T0 = Date.parse('2026-10-15T20:00:00Z'), tip = Date.parse('2026-10-15T23:30:00Z');
const lu = [{ uid: 'u1', acc: 'main', accLabel: 'Principal', date: '2026-10-15', source: 'chain', players: [{ id: 'stephen-curry', name: 'Stephen Curry', team: 'GSW', tip }, { id: 'keshon-gilbert', name: 'Keshon Gilbert', team: 'ATL', tip }, { id: 'nikola-jokic', name: 'Nikola Jokic', team: 'DEN', tip }] }];
const im = new Map(inj.map(x => [x.id, x]));
let a1 = buildAlerts({ now: T0, lineups: lu, injuries: im, state: {} });
ok('avisos: avisa os dois do lineup que estão no relatório', a1.items.length === 2 && a1.items.every(i => i.kind === 'new'), a1.items.map(i => [i.name, i.kind]));
let a2 = buildAlerts({ now: T0 + 1800e3, lineups: lu, injuries: im, state: a1.state });
ok('avisos: não repete o mesmo aviso', a2.items.length === 0, a2.items);
const im2 = new Map(im); im2.set('keshon-gilbert', Object.assign({}, by['keshon-gilbert'], { status: 'out' })); im2.delete('stephen-curry');
let a3 = buildAlerts({ now: T0 + 3600e3, lineups: lu, injuries: im2, state: a2.state });
ok('avisos: mudança de estado e jogador liberado', a3.items.length === 2 && a3.items.find(i => i.id === 'keshon-gilbert').kind === 'change' && a3.items.find(i => i.id === 'stephen-curry').kind === 'clear', a3.items.map(i => [i.name, i.kind]));
const im3 = new Map(im2); im3.set('keshon-gilbert', Object.assign({}, by['keshon-gilbert']));
let a4 = buildAlerts({ now: T0 + 1.5 * 3600e3, lineups: lu, injuries: im3, state: a3.state });
let a5 = buildAlerts({ now: tip - 50 * 60e3, lineups: lu, injuries: im3, state: a4.state, lastCallMin: 30 });
let a6 = buildAlerts({ now: tip - 20 * 60e3, lineups: lu, injuries: im3, state: a5.state, lastCallMin: 30 });
let a7 = buildAlerts({ now: tip - 10 * 60e3, lineups: lu, injuries: im3, state: a6.state, lastCallMin: 30 });
const a8 = buildAlerts({ now: tip - 20 * 60e3, lineups: lu, injuries: im3, state: a5.state });
ok('avisos: sem última chamada por defeito', !a8.items.some(i => i.kind === 'last'), a8.items);
ok('avisos: última chamada perto do jogo (≤ 30 min, se pedida), só uma vez', !a5.items.some(i => i.kind === 'last') && a6.items.length === 1 && a6.items[0].kind === 'last' && a7.items.length === 0, [a4.items.map(i => i.kind), a5.items.map(i => i.kind), a6.items.map(i => i.kind), a7.items.length]);
ok('avisos: jogo já começado não avisa', buildAlerts({ now: tip + 60e3, lineups: lu, injuries: im, state: {} }).items.length === 0);
const tx = alertText(a1.items, { tz: 'Europe/Lisbon' });
ok('avisos: texto com estado, lesão, hora de Lisboa e de onde vem o lineup', /Stephen Curry \(GSW\): Fora · Ankle/.test(tx.body) && /00:30/.test(tx.body) && /submetido no Top Shot/.test(tx.body) && tx.urgent && /2 avisos/.test(tx.title), tx);
ok('avisos: estado antigo é esquecido ao fim de 3 dias', Object.keys(buildAlerts({ now: T0 + 4 * 86400e3, lineups: [], injuries: im, state: a1.state }).state).length === 0);

// jogos da época passada (gamelog da ESPN): regularidade e jogos seguidos
const glNames = ['minutes', 'fieldGoalsMade-fieldGoalsAttempted', 'fieldGoalPct', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'threePointPct', 'freeThrowsMade-freeThrowsAttempted', 'freeThrowPct', 'totalRebounds', 'assists', 'blocks', 'steals', 'fouls', 'turnovers', 'points'];
const glEv = {}, glStats = [], glPre = [];
const glDates = ['2025-10-22', '2025-10-23', '2025-10-25', '2025-10-27', '2025-10-28', '2025-10-30', '2025-11-01', '2025-11-02', '2025-11-04', '2025-11-06'];
glDates.forEach((d, i) => { const id = '4018' + i; glEv[id] = { id, gameDate: d + 'T23:30:00.000+00:00', opponent: { abbreviation: 'BOS' } };
  const b2b = i > 0 && (Date.parse(d) - Date.parse(glDates[i - 1])) === 86400e3, pts = b2b ? 18 : 26 + (i % 3) * 4;
  glStats.push({ eventId: id, stats: ['34', '9-18', '50.0', (b2b ? 1 : 3) + '-8', '37.5', '5-6', '83.3', '7', '6', '1', '1', '2', '3', String(pts)] }); });
glEv.pre1 = { id: 'pre1', gameDate: '2025-10-08T23:00:00.000+00:00' };
glPre.push({ eventId: 'pre1', stats: ['20', '3-9', '', '1-4', '', '0-0', '', '2', '1', '0', '0', '1', '1', '7'] });
const glJson = { names: glNames, events: glEv, seasonTypes: [{ displayName: '2025-26 Regular Season', categories: [{ type: 'event', events: glStats.slice(0, 5) }, { type: 'event', events: glStats.slice(5) }] }, { displayName: '2025-26 Preseason', categories: [{ events: glPre }] }] };
const gl = parseEspnGamelog(glJson);
ok('jogos da época passada: só a época regular, com lançamentos separados', gl.length === 10 && gl[0].date === '2025-10-22' && gl[0].fgm === 9 && gl[0].fga === 18 && gl[0].fg3a === 8 && gl[0].pts === 26 && gl[0].min === 34, gl[0]);
const hs = histFromGames(gl);
ok('regularidade: dispersão dos pontos e jogos seguidos detetados', hs.n === 10 && hs.d.pts > 0 && hs.b2b && hs.b2b.n === 3 && hs.b2b.r.pts < 0.75 && hs.b2b.r.fg3 < 0.5, hs);
ok('regularidade: poucos jogos não contam', histFromGames(gl.slice(0, 3)).d === undefined);
// arquivo do Historic: só dias acabados, junta sem repetir, refaz colunas se o leitor mudar a ordem
{
  const { mergeRun, archive } = await import('../scripts/hist-archive.mjs');
  const fs = await import('node:fs'), os = await import('node:os');
  const h1 = { at: '2026-10-28T10:00:00Z', run: { id: 'run-fb-historic-x', name: 'HISTORIC - RUN 1' }, keys: ['points', 'assists'], rubric: [{ statKey: 'points', weight: 1 }],
    days: [{ id: 'run-fb-historic-x-d1', locks: '2026-10-21T01:00:00Z', lines: [['1', 'A', 't', 30, 5]], top: [200] }, { id: 'run-fb-historic-x-d2', locks: '2026-10-22T01:00:00Z', players: [['1', 'A', 't', 90, 0, 50]] }] };
  const r1 = mergeRun(null, h1);
  ok('Historic: arquivo só com dias acabados', r1.added === 1 && r1.doc.days.length === 1 && !r1.doc.days[0].players, r1);
  const h2 = { at: '2026-10-29T10:00:00Z', run: h1.run, keys: ['assists', 'points'], days: [h1.days[0], { id: 'run-fb-historic-x-d2', locks: '2026-10-22T01:00:00Z', lines: [['1', 'A', 't', 7, 25]] }] };
  h2.days[0] = Object.assign({}, h1.days[0], { lines: [['1', 'A', 't', 5, 30]] });
  const r2 = mergeRun(r1.doc, h2);
  ok('Historic: junta o dia novo com as colunas do arquivo', r2.added === 1 && r2.changed === 0 && JSON.stringify(r2.doc.days[1].lines[0]) === JSON.stringify(['1', 'A', 't', 25, 7]), r2.doc.days);
  const dir = fs.mkdtempSync(os.tmpdir() + '/hist-');
  const n1 = archive([h1, h2], dir), n2 = archive([h1, h2], dir), idx = JSON.parse(fs.readFileSync(dir + '/index.json', 'utf8'));
  ok('Historic: arquivo e índice, sem mudar à segunda', n1 === 2 && n2 === 0 && idx.runs.length === 1 && idx.runs[0].days === 2, { n1, n2, idx });
}
// Discord → Telegram: texto com os embeds dos canais seguidos, HTML escapado, ids grandes
{
  const { msgText, tgText, newer } = await import('../scripts/discord.mjs');
  const m = { id: '1300000000000000002', content: 'Run 2 <Pro> & more', author: { global_name: 'NBA Top Shot' }, embeds: [{ title: 'Fast Break', description: 'Pro is back', fields: [{ name: 'Prize', value: '$10,000' }] }] };
  ok('Discord: texto com embeds', msgText(m) === 'Run 2 <Pro> & more\nFast Break\nPro is back\nPrize: $10,000', msgText(m));
  ok('Discord: mensagem do Telegram escapada', tgText(m, 'announcements').includes('#announcements · NBA Top Shot') && tgText(m, 'x').includes('Run 2 &lt;Pro&gt; &amp; more'), tgText(m, 'x'));
  const { isFollowed } = await import('../scripts/discord.mjs');
  ok('Discord: só mensagens dos canais seguidos', isFollowed({ flags: 2 }) && isFollowed({ flags: 6 }) && !isFollowed({ flags: 0 }) && !isFollowed({}));
  const { passes } = await import('../scripts/discord.mjs'), ch = { id: '55', name: 'fast-break' };
  ok('Discord: filtro por palavras e canais', passes(m, ch, { palavras: ['pro is'] }) && !passes(m, ch, { palavras: ['historic'] }) && passes(m, ch, { canais: ['#Fast-Break'] }) && !passes(m, ch, { canais: ['99'] }) && passes(m, ch, { canais: ['55'], palavras: [] }));
  ok('Discord: ids grandes comparados como números', newer('1300000000000000010', '1300000000000000009') && !newer('999999999999999999', '1300000000000000000'));
}
console.log(fails ? fails + ' falha(s)' : 'tarefas: tudo certo');
process.exit(fails ? 1 : 0);
