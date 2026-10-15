// Motor de cálculo: respeita usos, só usa quem joga, prémios por vitórias, jogo a jogo, determinismo.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const FB = require('../docs/core.js');
const seed = JSON.parse(fs.readFileSync(new URL('./fixtures/run.json', import.meta.url)));
const id = seed['app/state'].activeRun;
const run = seed['runs/' + id], roster = seed['rosters/' + id], odds = seed['odds/' + id];
let fails = 0;
const ok = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'ok   ' : 'FALHA') + ' ' + label + (cond ? '' : ' → ' + JSON.stringify(info))); };
function violations(res, model) {
  const errs = [], cnt = {};
  res.days.forEach((d, i) => {
    const md = model.days[i];
    if (new Set(d.lineup).size !== d.lineup.length || d.lineup.length > 5) errs.push('lineup inválido ' + d.date);
    d.lineupIdx.forEach(p => { if (!md.eligSet.has(p)) errs.push('sem jogo ' + model.players[p].id + ' ' + d.date); cnt[p] = (cnt[p] || 0) + 1; });
  });
  Object.entries(cnt).forEach(([p, c]) => { if (c > model.uses[p]) errs.push('usos ' + model.players[p].id); });
  return errs;
}
const NOW = Date.parse('2026-10-10T10:00:00Z');
const t0 = Date.now();
const r = FB.planRun(run, roster, odds, {}, { now: NOW });
ok('plano em menos de 3 s', Date.now() - t0 < 3000, Date.now() - t0);
ok('plano respeita usos e jogos', violations(r.normal, r.model).length === 0, violations(r.normal, r.model));
ok('tudo pelo dia respeita usos e jogos', violations(r.allIn, r.model).length === 0, violations(r.allIn, r.model));
ok('probabilidades de prémio entre 0 e 1', r.normal.prizeProbs.every(p => p >= 0 && p <= 1), r.normal.prizeProbs);
ok('patamar mais alto é menos provável', r.normal.prizeProbs[0] >= r.normal.prizeProbs[1] && r.normal.prizeProbs[1] >= r.normal.prizeProbs[2], r.normal.prizeProbs);
const sga = FB.playerDist(roster.players.sga, 'pts', odds.days['2026-10-20'].players.sga);
ok('linha 31,5 dá média perto de 31,5', Math.abs(sga.mu - 31.5) < 1.5, sga.mu);
ok('odds americanas e decimais', Math.abs(FB.impliedProb(-110) - 0.5238) < 1e-3 && Math.abs(FB.impliedProb(2.5) - 0.4) < 1e-9);
const lost = { played: {} };
run.days.slice(0, 2).forEach(d => { lost.played[d.date] = { done: true, result: 'loss', lineup: [] }; });
const rl = FB.planRun(run, roster, odds, lost, { now: NOW });
ok('derrotas baixam as hipóteses de prémio', rl.normal.prizeProbs[1] < r.normal.prizeProbs[1], [rl.normal.prizeProbs, r.normal.prizeProbs]);
const d1 = run.days[0].date, sub = r.normal.days[0].lineup;
const live = { live: { [d1]: { active: true, lineup: sub, players: { [sub[0]]: { state: 'fim', vals: { pts: 22 } } } } } };
const rv = FB.planRun(run, roster, odds, live, { now: NOW });
ok('jogo a jogo soma o que já foi feito', rv.normal.days[0].totals[0].known === 22, rv.normal.days[0].totals[0]);
ok('jogo a jogo prende quem já jogou', rv.normal.days[0].live.locked.includes(sub[0]), rv.normal.days[0].live);
const rc = FB.planRun(run, roster, odds, { live: { [d1]: { active: true, lineup: sub, players: {} } } }, { now: Date.parse('2026-10-20T22:00:00Z') });
const eligIds = rc.model.days[0].elig.map(i => rc.model.players[i].id);
ok('jogos já começados fecham a porta a quem não está no lineup', !eligIds.includes('dwhite') && !eligIds.includes('pritchard'), eligIds);
const r2 = FB.planRun(run, roster, odds, {}, { now: NOW });
ok('resultado determinístico', JSON.stringify(r2.normal.days.map(d => d.lineup)) === JSON.stringify(r.normal.days.map(d => d.lineup)));
const empty = FB.planRun(run, { players: {} }, odds, {}, { now: NOW });
ok('plantel vazio não rebenta', empty.normal.days.every(d => d.lineup.length === 0));

// estatísticas novas do Fast Break: combinações com menos, proxies de odds, estimativas, tamanho do lineup
const luka = { name: 'Luka', team: 'LAL', uses: 3, avg: { pts: 33.5, reb: 7.7, ast: 8.3, fg3: 4.0, fgm: 10.8, fga: 22.8, fg3a: 10.8, tov: 4.0, oreb: 0.64, dreb: 7.1 } };
ok('termos de uma estatística', JSON.stringify(FB.statTerms('ast-tov')) === JSON.stringify([{ s: 'ast', sign: 1 }, { s: 'tov', sign: -1 }]) && FB.statTerms('pts+reb').length === 2);
const at = FB.playerDist(luka, 'ast-tov');
ok('assistências menos perdas de bola: média é a diferença', Math.abs(at.mu - 4.3) < 1e-9 && at.v > 0 && at.v < FB.playerDist(luka, 'ast').v + FB.playerDist(luka, 'tov').v, at);
ok('valor ao vivo de uma diferença', FB.statValue({ ast: 9, tov: 5 }, 'ast-tov') === 4 && FB.statValue({ 'ast-tov': 2, ast: 9, tov: 5 }, 'ast-tov') === 2);
const pipD = FB.playerDist(luka, 'pip');
ok('pontos na área estimados a partir dos lançamentos de 2', pipD.src === 'estimativa' && pipD.mu > 7 && pipD.mu < 13, pipD);
const pipBig = FB.playerDist({ name: 'Gobert', team: 'MIN', avg: { pts: 12, fgm: 4.8, fga: 7.0, fg3: 0, fg3a: 0 } }, 'pip');
ok('poste quase só faz pontos na área', pipBig.mu > 8.5 && pipBig.mu <= 9.6, pipBig.mu);
const pipOdds = FB.playerDist(luka, 'pip', { pts: { line: 38.5, over: -110, under: -110 } });
ok('pontos na área com a linha de pontos (proxy)', pipOdds.src === 'proxy' && pipOdds.via === 'pts' && pipOdds.mu > pipD.mu, pipOdds);
const orebE = FB.playerDist({ name: 'X', team: 'BOS', avg: { pts: 10, reb: 8 } }, 'oreb');
ok('ressaltos ofensivos estimados quando falta a média', orebE.src === 'estimativa' && Math.abs(orebE.mu - 2) < 1e-9, orebE);
ok('média real ganha à estimativa', FB.playerDist(luka, 'oreb').src === 'media' && FB.playerDist(luka, 'fga').mu === 22.8);
const fgaP = FB.playerDist(luka, 'fga', { fgm: { line: 11.5, over: -110, under: -110 } });
ok('lançamentos tentados pela linha de marcados', fgaP.src === 'proxy' && fgaP.via === 'fgm' && fgaP.mu > 22.8, fgaP);
const tovO = FB.playerDist(luka, 'tov', { tov: { line: 3.5, over: -150, under: 120 } });
ok('perdas de bola com odds diretas', tovO.src === 'odds' && tovO.mu > 3.5, tovO);
// run pequena com objetivo de assistências menos perdas e lineup de 3
const mini = { name: 't', prizes: [], days: [
  { date: '2026-11-01', objectives: [{ stat: 'ast-tov', target: 12 }], games: [['LAL', 'BOS', '2026-11-01T23:00:00Z', 'espn:1'], ['DEN', 'PHX', '2026-11-02T01:00:00Z', 'espn:2']], numPlayers: 3 },
  { date: '2026-11-02', objectives: [{ stat: 'pip', target: 40 }], games: [['LAL', 'DEN', '2026-11-02T23:00:00Z', 'espn:3'], ['BOS', 'PHX', '2026-11-03T00:00:00Z', 'espn:4']] },
] };
const ro = { players: {
  luka: luka,
  jokic: { name: 'Nikola Jokic', team: 'DEN', uses: 2, avg: { pts: 29, reb: 12.5, ast: 10, fg3: 2, fgm: 11.2, fga: 19.5, fg3a: 4.5, tov: 3.2 } },
  brown: { name: 'Jaylen Brown', team: 'BOS', uses: 2, avg: { pts: 23, reb: 6, ast: 4.5, fg3: 2.2, fgm: 8.8, fga: 18.5, fg3a: 6.5, tov: 3.5 } },
  turnover: { name: 'Muitas Perdas', team: 'PHX', uses: 2, avg: { pts: 9, reb: 3, ast: 1, fg3: 1, fgm: 3.5, fga: 8, fg3a: 3, tov: 2.5 } },
  booker: { name: 'Devin Booker', team: 'PHX', uses: 2, avg: { pts: 25, reb: 4, ast: 7, fg3: 2.3, fgm: 8.7, fga: 18.8, fg3a: 6.2, tov: 2.8 } },
} };
const rm = FB.planRun(mini, ro, { days: {} }, {}, { now: Date.parse('2026-10-30T10:00:00Z') });
ok('lineup com o tamanho do dia (3) e 5 por defeito', rm.normal.days[0].lineup.length === 3 && rm.normal.days[0].size === 3 && rm.normal.days[1].size === 5, rm.normal.days.map(d => [d.size, d.lineup]));
ok('com assistências menos perdas não escolhe quem perde mais bolas do que assiste', !rm.normal.days[0].lineup.includes('turnover'), rm.normal.days[0].lineup);
ok('objetivo de pontos na área tem probabilidade', rm.normal.days[1].P > 0 && rm.normal.days[1].P < 1, rm.normal.days[1]);
const rmLive = FB.planRun(mini, ro, { days: {} }, { live: { '2026-11-01': { active: true, lineup: rm.normal.days[0].lineup, players: { [rm.normal.days[0].lineup[0]]: { state: 'fim', vals: { ast: 11, tov: 3, pts: 30 } } } } } }, { now: Date.parse('2026-11-02T03:00:00Z') });
ok('jogo a jogo calcula a diferença a partir das estatísticas do jogo', rmLive.normal.days[0].totals[0].known === 8, rmLive.normal.days[0].totals[0]);
ok('objetivo por jogador fica assinalado', FB.planRun({ name: 't', prizes: [], days: [{ date: '2026-11-01', objectives: [{ stat: 'pts', target: 20, each: true }], games: mini.days[0].games }] }, ro, { days: {} }, {}, { now: Date.parse('2026-10-30T10:00:00Z') }).normal.days[0].perPlayer === true);
console.log(fails ? fails + ' falha(s)' : 'motor: tudo certo');
process.exit(fails ? 1 : 0);
