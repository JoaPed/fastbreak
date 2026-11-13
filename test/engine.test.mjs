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
ok('assistências menos perdas de bola: média é a diferença', Math.abs(at.mu - (8.3 - (4 - 0.06 * 2))) < 1e-9 && at.v > 0 && at.v < FB.playerDist(luka, 'ast').v + FB.playerDist(luka, 'tov').v, at);
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

// forma: últimos 10 e 5 jogos misturados com a época
const hot = { name: 'Quente', team: 'BOS', uses: 2, avg: { pts: 20, reb: 6, form: { n10: 10, n5: 5, l10: { pts: 24, reb: 6 }, l5: { pts: 30, reb: 6 } } } };
FB.setForm(1);
ok('forma: nos pontos os últimos 10 pesam 25% e os últimos 5 12% (o resto é a época)', Math.abs(FB.avgOf(hot, 'pts').v - (20 + 0.25 * (24 - 20) + 0.12 * (30 - 20))) < 1e-9, FB.avgOf(hot, 'pts'));
{
  // nas estatísticas raras uma boa fase é quase só sorte: pesa muito menos do que nos pontos
  const st = { name: 'Ladrão', avg: { pts: 20, stl: 1, form: { n10: 10, n5: 5, l10: { pts: 30, stl: 1.5 }, l5: { pts: 30, stl: 1.5 } } } };
  const up = k => FB.avgOf(st, k).v / st.avg[k] - 1;
  ok('forma: nos roubos de bola pesa muito menos do que nos pontos', up('stl') < up('pts') / 4 && up('stl') > 0, [up('pts'), up('stl')]);
  // minutos altos: −3,5% a partir dos 36 min; e o topo das estatísticas raras é cortado
  const star = { name: 'Estrela', avg: { pts: 30, blk: 2.6, min: 37 } }, norm = { name: 'Normal', avg: { pts: 30, blk: 2.6, min: 29 } };
  ok('minutos altos: quem joga 36+ min fica 3,5% abaixo da média; até 30 min não mexe', Math.abs(FB.avgOf(star, 'pts').v - 30 * 0.965) < 1e-9 && FB.avgOf(norm, 'pts').v === 30 && FB.minutesDisc({ min: 33 }) === 1 - 0.035 / 2, [FB.avgOf(star, 'pts'), FB.avgOf(norm, 'pts')]);
  ok('estatísticas raras: o que passa de um jogador normal é cortado (desarmes: 15% acima de 0,6)', Math.abs(FB.avgOf(norm, 'blk').v - (2.6 - 0.15 * 2)) < 1e-9 && Math.abs(FB.avgOf(norm, 'blk', true).v - 2.6) < 1e-9 && FB.avgOf({ avg: { blk: 0.5 } }, 'blk').v === 0.5, FB.avgOf(norm, 'blk'));
}
FB.setForm(0);
ok('sem forma: só a época', FB.avgOf(hot, 'pts').v === 20);
FB.setForm(1);
const few = { name: 'Poucos', avg: { pts: 20, form: { n10: 2, n5: 2, l10: { pts: 30 }, l5: { pts: 30 } } } };
ok('com poucos jogos a forma pesa menos', FB.avgOf(few, 'pts').v > 20 && FB.avgOf(few, 'pts').v < FB.avgOf(hot, 'pts').v + 1, FB.avgOf(few, 'pts'));
ok('odds continuam a mandar quando existem', Math.abs(FB.playerDist(hot, 'pts', { pts: { line: 21.5, over: -110, under: -110 } }).mu - 21.5) < 1.5);
const fi = FB.formInfo(hot, 'pts');
ok('informação de forma para mostrar', fi.season === 20 && fi.l5 === 30 && fi.l10 === 24 && fi.trend > 0.4, fi);
// adversário: o que concede (últimos 10 jogos) mexe nas médias, não nas odds
const teams = { SAC: { n: 10, allowed: { pts: 126, reb: 46 } }, BOS: { n: 10, allowed: { pts: 104, reb: 42 } }, NBA: { n: 30, allowed: { pts: 115, reb: 44 } } };
const mSac = FB.matchup(teams, 'SAC', 'pts'), mBos = FB.matchup(teams, 'BOS', 'pts+reb');
ok('adversário: fator e meio-ajuste com limite', Math.abs(mSac.f - 126 / 115) < 1e-9 && Math.abs(mSac.used - (1 + 0.65 * (126 / 115 - 1))) < 1e-9 && mBos.used < 1 && Math.abs(FB.matchup(teams, 'SAC', 'reb').used - (1 + 0.5 * (46 / 44 - 1))) < 1e-9 && FB.matchup(teams, 'XXX', 'pts') === null && FB.matchup({ SAC: { n: 3, allowed: { pts: 140 } }, NBA: { allowed: { pts: 115 } } }, 'SAC', 'pts') === null);
const mrun = { name: 't', prizes: [], days: [{ date: '2026-11-03', objectives: [{ stat: 'pts', target: 100 }], games: [['BOS', 'SAC', '2026-11-04T00:00:00Z', 'x']] }] };
const mro = { players: { a: { name: 'A', team: 'BOS', uses: 1, avg: { pts: 20 } }, b: { name: 'B', team: 'SAC', uses: 1, avg: { pts: 20 } } } };
const mm = FB.buildModel(mrun, mro, { days: {} }, {}, { now: NOW, teams });
const muA = mm.days[0].mu[mm.pIndex.get('a')][0], muB = mm.days[0].mu[mm.pIndex.get('b')][0];
ok('contra quem concede mais, a média sobe; contra quem concede menos, desce', muA > 20 && muB < 20 && Math.abs(muA - 20 * (1 + 0.65 * (126 / 115 - 1))) < 1e-9, [muA, muB]);
const mmO = FB.buildModel(mrun, mro, { days: { '2026-11-03': { players: { a: { pts: { line: 21.5, over: -110, under: -110 } } } } } }, {}, { now: NOW, teams });
ok('com odds o adversário não mexe (já está na linha)', Math.abs(mmO.days[0].mu[mmO.pIndex.get('a')][0] - FB.playerDist(mro.players.a, 'pts', { pts: { line: 21.5, over: -110, under: -110 } }).mu) < 1e-9);

// alternativas para hoje
const seeds = FB.alternativeSeeds(r.model, r.normal);
ok('alternativas: tudo pelo dia e guardar até 3 jogadores', seeds[0].kind === 'allin' && seeds[0].lineupIdx.length === 5 && seeds.filter(x => x.kind === 'save').length === 3 && seeds.filter(x => x.kind === 'save').every(x => r.normal.days[0].lineupIdx.includes(x.player)), seeds);
const banDate = r.model.days[0].day.date, banId = r.model.players[seeds[1].player].id;
const rb = FB.planRun(run, roster, odds, { bans: { [banDate]: [banId] } }, { now: NOW });
ok('guardar um jogador hoje refaz a run sem ele nesse dia', !rb.normal.days[0].lineup.includes(banId) && violations(rb.normal, rb.model).length === 0);

// várias contas (smurf)
function groupErrors(g) {
  const errs = [], night = {};
  g.keys.forEach(k => {
    const r = g.byKey[k], cnt = {};
    r.normal.days.forEach((d, i) => {
      const md = r.model.days[i];
      if (d.lineup.length > md.size) errs.push(k + ' lineup grande ' + d.date);
      d.lineupIdx.forEach(p => { if (!md.eligSet.has(p)) errs.push(k + ' sem jogo ' + d.date); cnt[p] = (cnt[p] || 0) + 1; });
      d.lineup.forEach(id => { const key = d.date + '|' + id; night[key] = (night[key] || []).concat(k); });
    });
    Object.entries(cnt).forEach(([p, c]) => { if (c > r.model.uses[p]) errs.push(k + ' usos ' + r.model.players[p].id); });
  });
  return { errs, night };
}
const split = JSON.parse(JSON.stringify(roster));
Object.keys(split.players).sort().forEach((pid, i) => { split.players[pid].owner = i % 2 ? 's1' : 'main'; split.players[pid].copies = 1; });
const onlyOwn = key => { const r2 = JSON.parse(JSON.stringify(split)); Object.values(r2.players).forEach(p => { if (p.owner !== key) p.uses = 0; }); return r2; };
const sepObj = ['main', 's1'].map(k => FB.planRun(run, onlyOwn(k), odds, {}, { now: NOW }).normal.objective).reduce((a, b) => a + b, 0);
const tg = Date.now();
const g2 = FB.planGroup(run, [{ key: 'main', roster: split, plan: {} }, { key: 's1', roster: split, plan: {} }], odds, { now: NOW });
ok('duas contas: plano em menos de 3 s', Date.now() - tg < 3000, Date.now() - tg);
const ge = groupErrors(g2);
ok('duas contas: usos de cada conta, jogos e tamanho do lineup', !ge.errs.length, ge.errs);
ok('duas contas: um Moment só joga por uma conta em cada noite', Object.values(ge.night).every(ks => ks.length === 1), Object.entries(ge.night).filter(([, ks]) => ks.length > 1));
ok('juntar as coleções vale mais do que jogar cada conta sozinha', g2.objective > sepObj, [g2.objective, sepObj]);
// para cada uso, o Moment tem de estar nessa conta: dono inicial, ou a última transferência antes dessa noite
let okT = true;
g2.keys.forEach(k => g2.byKey[k].normal.days.forEach(d => d.lineup.forEach(pid => {
  const moved = g2.transfers.filter(t => t.id === pid && t.before <= d.date).pop();
  if ((moved ? moved.to : split.players[pid].owner) !== k) okT = false;
})));
ok('transferências: cada Moment está na conta certa em cada noite', okT, g2.transfers.slice(0, 5));
// prioridade a uma conta: com o mesmo plantel e as mesmas hipóteses, a conta com prioridade fica com o melhor
const expOf = (g, k) => g.byKey[k].normal.expected;
const gPm = FB.planGroup(run, [{ key: 'main', roster: split, plan: {} }, { key: 's1', roster: split, plan: {} }], odds, { now: NOW, accWeights: { main: 1.2 } });
const gPs = FB.planGroup(run, [{ key: 'main', roster: split, plan: {} }, { key: 's1', roster: split, plan: {} }], odds, { now: NOW, accWeights: { s1: 1.2 } });
ok('prioridade: a conta com prioridade fica com mais vitórias esperadas', expOf(gPm, 'main') - expOf(gPm, 's1') > expOf(gPs, 'main') - expOf(gPs, 's1'), [expOf(gPm, 'main'), expOf(gPm, 's1'), expOf(gPs, 'main'), expOf(gPs, 's1')]);
ok('prioridade: o total quase não muda', Math.abs((expOf(gPm, 'main') + expOf(gPm, 's1')) - (expOf(g2, 'main') + expOf(g2, 's1'))) < 0.6, [expOf(gPm, 'main') + expOf(gPm, 's1'), expOf(g2, 'main') + expOf(g2, 's1')]);
const allMain = JSON.parse(JSON.stringify(roster)); Object.values(allMain.players).forEach(p => { p.owner = 'main'; p.copies = 1; });
const g1 = FB.planGroup(run, [{ key: 'main', roster: allMain, plan: {} }, { key: 's1', roster: allMain, plan: {} }], odds, { now: NOW });
ok('smurf sem Moments: a conta principal não perde hipóteses de prémio por emprestar à smurf', g1.byKey.main.normal.prizeProbs.every((x, i) => x >= r.normal.prizeProbs[i] - 0.02), [g1.byKey.main.normal.prizeProbs, r.normal.prizeProbs]);
// com o custo baixo (≈ 0,1 vitórias por troca) uma troca que vale a pena aparece: com uma conta sem nada, só se o
// lineup que ela faria com o que sobra valer mais do que as trocas (aqui não vale: 0,03 vitórias por troca)
const gCheap = FB.planGroup(run, [{ key: 'main', roster: allMain, plan: {} }, { key: 's1', roster: allMain, plan: {} }], odds, { now: NOW, transferCost: 0 });
ok('smurf sem Moments: sem custo de troca joga com o que sobra da principal', gCheap.transfers.length > 0 && gCheap.byKey.s1.normal.days.some(d => d.lineup.length), gCheap.transfers.length);
// cada transferência tem de compensar: sem elas (cada conta só com os seus) o plano vale menos
const gNo = FB.planGroup(run, [{ key: 'main', roster: split, plan: {} }, { key: 's1', roster: split, plan: {} }], odds, { now: NOW, transferCost: 10 });
ok('duas contas: há trocas e o plano com trocas vale mais do que sem trocas', g2.transfers.length > 0 && gNo.transfers.length === 0 && g2.objective > gNo.objective, [g2.transfers.length, gNo.transfers.length, g2.objective, gNo.objective]);
const two = JSON.parse(JSON.stringify(allMain)); two.players.sga.copies = 2; delete two.players.sga.owner;
const lockBoth = { locks: { [d1]: ['sga'] } };
const g3 = FB.planGroup(run, [{ key: 'main', roster: two, plan: lockBoth }, { key: 's1', roster: two, plan: lockBoth }], odds, { now: NOW });
ok('com dois Moments do mesmo jogador, as duas contas podem usá-lo na mesma noite', g3.byKey.main.normal.days[0].lineup.includes('sga') && g3.byKey.s1.normal.days[0].lineup.includes('sga') && !g3.clashes.length, [g3.byKey.main.normal.days[0].lineup, g3.byKey.s1.normal.days[0].lineup, g3.clashes]);
// os dois Moments estão na principal: a smurf só o pode usar se receber um antes
const twoMain = JSON.parse(JSON.stringify(two)); twoMain.players.sga.hold = { main: 2 };
const g3b = FB.planGroup(run, [{ key: 'main', roster: twoMain, plan: lockBoth }, { key: 's1', roster: twoMain, plan: lockBoth }], odds, { now: NOW });
ok('dois Moments na mesma conta: manda um para a smurf antes da noite em que as duas o usam', g3b.transfers.some(t => t.id === 'sga' && t.from === 'main' && t.to === 's1' && t.before <= d1), g3b.transfers.filter(t => t.id === 'sga'));
const twoSplit = JSON.parse(JSON.stringify(two)); twoSplit.players.sga.hold = { main: 1, s1: 1 };
const g3c = FB.planGroup(run, [{ key: 'main', roster: twoSplit, plan: lockBoth }, { key: 's1', roster: twoSplit, plan: lockBoth }], odds, { now: NOW });
ok('um Moment em cada conta: nenhuma troca para o usarem as duas na mesma noite', !g3c.transfers.some(t => t.id === 'sga' && t.before <= d1), g3c.transfers.filter(t => t.id === 'sga'));
const g4 = FB.planGroup(run, [{ key: 'main', roster: allMain, plan: lockBoth }, { key: 's1', roster: allMain, plan: lockBoth }], odds, { now: NOW });
ok('o mesmo Moment fixado nas duas contas na mesma noite é assinalado', g4.clashes.some(c => c.id === 'sga' && c.date === d1), g4.clashes);
const closedMain = { played: { [d1]: { done: true, result: 'win', lineup: [] } } };
const g5 = FB.planGroup(run, [{ key: 'main', roster: split, plan: closedMain }, { key: 's1', roster: split, plan: {} }], odds, { now: NOW });
ok('cada conta tem os seus dias fechados e vitórias', g5.byKey.main.wins === 1 && g5.byKey.main.model.days.length === run.days.length - 1 && g5.byKey.s1.model.days.length === run.days.length && !groupErrors(g5).errs.length);

// lesões: relatório da ESPN por dia (o próximo jogo de cada jogador conta mais)
const iso = new Date(NOW).toISOString();
ok('lesão: fora no próximo jogo', FB.injuryOn({ status: 'out', updated_at: iso }, '2026-10-20', 0, NOW) === 'fora');
ok('lesão: fora até à data de regresso, depois volta aos poucos', FB.injuryOn({ status: 'out', return_date: '2026-10-25' }, '2026-10-24', 2, NOW) === 'fora' && FB.injuryOn({ status: 'out', return_date: '2026-10-25' }, '2026-10-26', 3, NOW) === 'duv' && FB.injuryOn({ status: 'out', return_date: '2026-10-25' }, '2026-10-29', 4, NOW) === 'prov');
ok('lesão: dia a dia é dúvida no próximo jogo e provável no seguinte', FB.injuryOn({ status: 'dtd' }, 'x', 0, NOW) === 'duv' && FB.injuryOn({ status: 'dtd' }, 'x', 1, NOW) === 'prov' && FB.injuryOn({ status: 'dtd' }, 'x', 2, NOW) === null);
ok('lesão: fora da época em todos os jogos', FB.injuryOn({ status: 'ofs' }, 'x', 6, NOW) === 'fora');
ok('lesão: relatório parado há mais de 3 dias não conta', FB.injuryOn({ status: 'out', updated_at: new Date(NOW - 4 * 86400e3).toISOString() }, 'x', 0, NOW) === null);
const inj = { maxey: { status: 'out', updated_at: iso }, curry: { status: 'probable', updated_at: iso } };
const ri = FB.planRun(run, roster, odds, {}, { now: NOW, injuries: inj });
const mx = ri.model.pIndex.get('maxey'), dPHI = ri.model.days.findIndex(md => md.day.date === '2026-10-22');
ok('lesão: Maxey fora no próximo jogo não entra nesse dia', !ri.model.days[0].eligSet.has(mx) && ri.model.days[0].info[mx][0].status === 'fora' && !ri.normal.days[0].lineup.includes('maxey'), ri.normal.days[0].lineup);
ok('lesão: no jogo seguinte entra com 25% de jogar', ri.model.days[dPHI].info[mx][0].status === 'dout' && Math.abs(ri.model.days[dPHI].info[mx][0].pPlay - 0.25) < 1e-9 && ri.model.days[dPHI].info[mx][0].injury.k === 1);
ok('lesão: o plano continua válido', violations(ri.normal, ri.model).length === 0, violations(ri.normal, ri.model));
const ign = JSON.parse(JSON.stringify(roster)); ign.players.maxey.injIgnore = true;
const rig = FB.planRun(run, ign, odds, {}, { now: NOW, injuries: inj });
ok('lesão: "ignorar o relatório" volta a contar com ele', rig.model.days[0].eligSet.has(rig.model.pIndex.get('maxey')) && rig.model.days[0].info[rig.model.pIndex.get('maxey')][0].injury.ignored === true);
const man = JSON.parse(JSON.stringify(roster)); man.players.curry.status = 'duv';
const rmn = FB.buildModel(run, man, odds, {}, { now: NOW, injuries: inj });
const cu = rmn.pIndex.get('curry'), dGS = rmn.days.findIndex(md => md.eligSet.has(cu));
ok('lesão: fica o pior entre o estado posto à mão e o relatório', dGS >= 0 && rmn.days[dGS].info[cu][0].status === 'duv', dGS >= 0 && rmn.days[dGS].info[cu][0]);
ok('lesão: o jogo que já começou não conta como o próximo', (() => { const late = Date.parse('2026-10-20T23:45:00Z'); const m = FB.buildModel(run, roster, odds, {}, { now: late, injuries: inj }); const i = m.pIndex.get('maxey'); return m.days[0].info[i][0].injury.k === null && m.days.find(md => md.day.date === '2026-10-22').info[i][0].injury.k === 0; })());

// compras: um jogador forte a mais sobe as hipóteses de prémio nos dias em que joga
const wide = JSON.parse(JSON.stringify(roster));
wide.players.star = { name: 'Super Estrela', team: 'PHI', uses: 2, status: 'ok', avg: { pts: 36, reb: 11, ast: 9, fg3: 4, stl: 2, blk: 1.5 } };
wide.players.bench = { name: 'Banco Fraco', team: 'PHI', uses: 2, status: 'ok', avg: { pts: 3, reb: 1, ast: 0.5, fg3: 0.2, stl: 0.1, blk: 0.1 } };
const mw = FB.buildModel(run, wide, odds, {}, { now: NOW });
const scr = FB.buyScreen(mw, r.normal, [mw.pIndex.get('star'), mw.pIndex.get('bench')], 2);
ok('compras: o mais forte fica à frente na pré-seleção', scr[0].id === 'star' && scr[0].score > scr[1].score && scr[0].days.length === 2 && scr[0].days.every(x => x.P1 > x.P0), scr.map(x => [x.id, x.score, x.days.length]));
ok('compras: os dias sugeridos são dias em que ele joga', scr[0].days.every(x => run.days.find(d => d.date === x.date).games.some(g => g.includes('PHI'))), scr[0].days);
const withStar = JSON.parse(JSON.stringify(roster)); withStar.players.star = wide.players.star;
const base2 = FB.optimize(FB.buildModel(run, roster, odds, {}, { now: NOW }), { restarts: 2 });
const buy2 = FB.optimize(FB.buildModel(run, withStar, odds, {}, { now: NOW }), { restarts: 2 });
ok('compras: refazer a run com ele sobe o valor dos prémios', buy2.objective > base2.objective && buy2.prizeProbs[1] >= base2.prizeProbs[1], [base2.prizeProbs, buy2.prizeProbs]);
const rk = FB.buyRank(run, wide, roster, odds, {}, r.normal, ['bench', 'star'], { now: NOW });
ok('compras: a 2.ª peneira põe o mais forte à frente, com ganho', rk[0].id === 'star' && rk[0].gain > 1e-4 && rk[0].gain > rk[1].gain, rk);
ok('compras: o ganho da 2.ª peneira anda perto do da run refeita', Math.abs(rk[0].gain - (buy2.objective - base2.objective)) < 0.5 * (buy2.objective - base2.objective) + 1e-3, [rk[0].gain, buy2.objective - base2.objective]);
{ const m0 = FB.buildModel(run, roster, odds, {}, { now: NOW }), loc = FB.optimize(m0, { now: NOW, local: true, init: m0.days.map(md => { const d = r.normal.days.find(x => x.date === md.day.date); return d ? d.lineupIdx : []; }) });
  ok('compras: melhorias simples a partir do plano não o pioram', loc.objective >= r.normal.objective - 1e-9 && violations(loc, m0).length === 0, [loc.objective, r.normal.objective]); }

// cadeados: nunca mais dias fixados do que usos (fica o cadeado mais recente; sem carimbo, o dia mais perto)
{
  const id = Object.keys(roster.players).find(k => { const t = roster.players[k].team; return run.days.filter(d => d.games.some(g => g.includes(t))).length >= 3; });
  const dts = run.days.filter(d => d.games.some(g => g.includes(roster.players[id].team))).map(d => d.date);
  const one = JSON.parse(JSON.stringify(roster)); one.players[id].uses = 1;
  const pl = { locks: { [dts[0]]: [id], [dts[2]]: [id] } };
  const a = FB.planRun(run, one, odds, pl, { now: NOW });
  const daysWith = a.normal.days.filter(d => d.lineup.includes(id)).map(d => d.date);
  ok('cadeados: com 1 uso e 2 dias fixados joga só num', daysWith.length === 1 && daysWith[0] === dts[0] && a.normal.conflicts.length === 0, daysWith);
  ok('cadeados: o que não conta vem em droppedLocks', a.model.droppedLocks.length === 1 && a.model.droppedLocks[0].date === dts[2] && a.model.droppedLocks[0].player === id, a.model.droppedLocks);
  const b = FB.planRun(run, one, odds, Object.assign({}, pl, { lockAt: { [dts[2] + '|' + id]: 2, [dts[0] + '|' + id]: 1 } }), { now: NOW });
  ok('cadeados: o posto há menos tempo é o que fica', b.normal.days.filter(d => d.lineup.includes(id)).map(d => d.date).join() === dts[2] && b.model.droppedLocks[0].date === dts[0], b.model.droppedLocks);
  const all = FB.planRun(run, one, odds, pl, { now: NOW });
  ok('cadeados: nenhum plano (nem o tudo pelo dia) passa os usos', [all.normal, all.allIn].every(v => !v || Object.entries(v.usage).every(([k, n]) => n <= (one.players[k].uses || 0))), all.allIn && all.allIn.usage[id]);
}

// dia a dia (dúvida no próximo jogo): o plano conta com ele a jogar e marca o risco; com riskSwap: false volta aos 50%
{
  const iso2 = new Date(NOW).toISOString(), injD = { curry: { status: 'dtd', updated_at: iso2 } };
  const a = FB.buildModel(run, roster, odds, {}, { now: NOW, injuries: injD }), ci = a.pIndex.get('curry');
  const d = a.days.findIndex(md => md.teams.has(a.players[ci].team) && md.objs.length), inf = a.days[d].info[ci][0];
  ok('dia a dia: conta como se jogasse, com o risco marcado', inf.pPlay === 1 && inf.pReal === 0.5 && inf.injury.risk === true && inf.injury.status === 'duv', [inf.pPlay, inf.pReal, inf.injury]);
  const b = FB.buildModel(run, roster, odds, {}, { now: NOW, injuries: injD, riskSwap: false }), inf2 = b.days[d].info[ci][0];
  ok('dia a dia: sem a troca, conta 50%', inf2.pPlay === 0.5 && !inf2.injury.risk, [inf2.pPlay]);
  const out = FB.buildModel(run, roster, odds, {}, { now: NOW, injuries: { curry: { status: 'doubtful', updated_at: iso2 } } }).days[d].info[ci][0];
  ok('pouco provável continua a contar pouco', out.pPlay === 0.25 && !out.injury.risk, [out.pPlay]);
}

// patamar de prémio que já não dá: sai e entra o de baixo
{
  const n = run.days.length, rp = Object.assign({}, run, { prizes: [{ wins: n - 1 }, { wins: n }, { wins: n + 1 }] });
  const pl = { played: { [run.days[0].date]: { done: true, result: 'loss', lineup: [] } } }; // uma derrota: o máximo passa a n − 1
  const m = FB.buildModel(rp, roster, odds, pl, { now: NOW });
  ok('prémios: os que já não dão saem e entram os de baixo', m.prizes.map(p => p.wins).join() === [n - 3, n - 2, n - 1].join() && m.prizeShift.dropped.join() === [n, n + 1].join() && m.prizes.filter(p => p.auto).length === 2, [m.prizes, m.prizeShift]);
  const m2 = FB.buildModel(rp, roster, odds, pl, { now: NOW, shiftPrizes: false });
  ok('prémios: sem a troca ficam os definidos', m2.prizes.map(p => p.wins).join() === [n - 1, n, n + 1].join(), m2.prizes);
}

// escalões nas contas: 1 Rare + 4 Common do mesmo jogador → cada conta com 2 usos; a 2.ª jogada de cada conta precisa do
// Rare, que só joga numa conta por noite (a 1.ª pode ser com um Common, mesmo na noite em que a outra usa o Rare)
{
  const star = Object.entries(roster.players).map(([id, p]) => [id, run.days.filter(d => d.games.some(g => g.includes(p.team))).length]).sort((a, b) => b[1] - a[1])[0][0];
  const ro = JSON.parse(JSON.stringify(roster));
  Object.values(ro.players).forEach(p => { p.uses = 0; });
  Object.assign(ro.players[star], { uses: 2, copies: 5, cards: [2, 1, 1, 1, 1], hold: { main: [2, 1, 1], s1: [1, 1] }, avg: { pts: 60, reb: 20, ast: 15, fg3: 8, stl: 4, blk: 4 } });
  const g = FB.planGroup(run, [{ key: 'main', roster: ro, plan: {} }, { key: 's1', roster: ro, plan: {} }], odds, { now: NOW });
  const plays = {}; ['main', 's1'].forEach(k => g.byKey[k].normal.days.forEach(d => { if (d.lineup.includes(star)) (plays[k] = plays[k] || []).push(d.date); }));
  const reqs = {}; Object.entries(plays).forEach(([k, ds]) => ds.sort().forEach((dt, i) => { (reqs[dt] = reqs[dt] || []).push(i + 1); }));
  const bad = Object.entries(reqs).filter(([, r]) => r.filter(x => x >= 2).length > 1);
  ok('escalões: 4 jogadas nas duas contas (2 + 2)', (plays.main || []).length === 2 && (plays.s1 || []).length === 2, plays);
  ok('escalões: nunca duas 2.as jogadas na mesma noite (só há 1 Rare)', bad.length === 0, reqs);
  const rareMoves = g.transfers.filter(t => t.id === star && t.uses === 2);
  const g3 = FB.planGroup(run, ['main', 's1', 's2'].map(k => ({ key: k, roster: Object.assign({}, ro, { players: Object.assign({}, ro.players, { [star]: Object.assign({}, ro.players[star], { hold: { main: [2, 1, 1], s1: [1], s2: [1] } }) }) }), plan: {} })), odds, { now: NOW });
  const p3 = {}; g3.keys.forEach(k => g3.byKey[k].normal.days.forEach(d => { if (d.lineup.includes(star)) (p3[k] = p3[k] || []).push(d.date); }));
  const r3 = {}; Object.values(p3).forEach(ds => ds.sort().forEach((dt, i) => { (r3[dt] = r3[dt] || []).push(i + 1); }));
  ok('escalões com 3 contas: no máximo uma 2.ª jogada por noite e nunca mais de 5 contas', Object.values(r3).every(r => r.filter(x => x >= 2).length <= 1 && r.length <= 5) && Object.values(p3).every(ds => ds.length <= 2), [p3, r3]);
  const t3 = g3.transfers.filter(t => t.id === star), hold = { main: [2, 1, 1], s1: [1], s2: [1] };
  ok('escalões com 3 contas: as transferências dão a cada jogada uma carta que chega', (() => { const h = JSON.parse(JSON.stringify(hold)); const cnt = {}; for (const dt of Object.keys(r3).sort()) { t3.filter(t => t.before === dt).forEach(t => { const j = h[t.from].indexOf(t.uses || 1); if (j < 0) throw 0; h[t.from].splice(j, 1); h[t.to].push(t.uses || 1); }); for (const [k, ds] of Object.entries(p3)) if (ds.includes(dt)) { cnt[k] = (cnt[k] || 0) + 1; if (!h[k].some(c => c >= cnt[k])) return false; } } return true; })(), t3);
  // noite fechada numa conta e aberta na outra: a carta usada na fechada fica ocupada nessa noite
  const dts = run.days.filter(d => d.games.some(gm => gm.includes(ro.players[star].team))).map(d => d.date);
  const pm = { played: { [run.days[0].date < dts[0] ? run.days[0].date : dts[0]]: { done: true, result: 'loss', lineup: [] } } };
  const d0 = dts[0], d1 = dts[1];
  const planMain = { played: { [d0]: { done: true, result: 'win', lineup: [star] }, [d1]: { done: true, result: 'win', lineup: [star] } } }; // 2.ª jogada da principal = com o Rare, no dia d1
  const planS1 = { played: { [d0]: { done: true, result: 'win', lineup: [star] } } }; // a smurf já jogou 1 vez; d1 ainda está aberto nela
  run.days.filter(d => d.date < d1 && d.date !== d0).forEach(d => { planMain.played[d.date] = planMain.played[d.date] || { done: true, result: 'loss', lineup: [] }; });
  run.days.filter(d => d.date !== d1 && d.date !== d0).forEach(d => { planS1.played[d.date] = { done: true, result: 'loss', lineup: [] }; }); // na smurf só o dia d1 fica aberto
  const roUsed = JSON.parse(JSON.stringify(ro)); roUsed.players[star].uses = 0; const roS1 = JSON.parse(JSON.stringify(ro)); roS1.players[star].uses = 1;
  const gc = FB.planGroup(run, [{ key: 'main', roster: roUsed, plan: planMain }, { key: 's1', roster: roS1, plan: planS1 }], odds, { now: NOW });
  const s1d1 = (gc.byKey.s1.normal.days.find(d => d.date === d1) || { lineup: [] }).lineup.includes(star);
  ok('escalões: na noite em que a outra conta já usou o Rare, a 2.ª jogada desta conta não pode ser nessa noite', !s1d1, gc.byKey.s1.normal.days.map(d => [d.date, d.lineup.includes(star)]));
  ok('escalões: a transferência diz que é o Rare que passa de conta', !(plays.s1 || []).length || rareMoves.some(t => t.to === 's1'), g.transfers.filter(t => t.id === star));
}

// lineup mantido (ao tirar um cadeado): o dia fica como estava, sem aviso de cadeados
{
  const r0 = FB.planRun(run, roster, odds, {}, { now: NOW });
  const d = r0.normal.days[1], alt = r0.model.days[1].elig.map(i => r0.model.players[i].id).filter(id => !d.lineup.includes(id));
  const want = d.lineup.slice(0, d.lineup.length - 1).concat(alt.slice(0, 1));
  const k = FB.planRun(run, roster, odds, { keep: { [d.date]: want } }, { now: NOW });
  const got = k.normal.days.find(x => x.date === d.date).lineup;
  ok('lineup mantido: o dia fica com os jogadores guardados', want.every(id => got.includes(id)) && k.model.droppedLocks.length === 0, [want, got]);
  const id = want[0], one = JSON.parse(JSON.stringify(roster)); one.players[id].uses = 1;
  const other = run.days.find(x => x.date !== d.date && x.games.some(g => g.includes(one.players[id].team)));
  const k2 = FB.planRun(run, one, odds, { keep: { [d.date]: want }, locks: { [other.date]: [id] } }, { now: NOW });
  ok('lineup mantido: um cadeado de verdade ganha ao lineup mantido (sem aviso)', k2.normal.days.find(x => x.date === other.date).lineup.includes(id) && !k2.normal.days.find(x => x.date === d.date).lineup.includes(id) && k2.model.droppedLocks.length === 0, k2.model.droppedLocks);
}

// jogos seguidos (back-to-back), regularidade de cada jogador e Moments emprestados (só alguns dias)
{
  const dates = run.days.map(d => d.date);
  const teamsOf = d => new Set(d.games.flatMap(g => [g[0], g[1]]));
  let pick = null;
  for (let i = 3; i < run.days.length && !pick; i++) { const t1 = teamsOf(run.days[i - 1]), t2 = teamsOf(run.days[i]); for (const [id, p] of Object.entries(roster.players)) if (t1.has(p.team) && t2.has(p.team)) { pick = { id, i }; break; } }
  ok('back-to-back: há um jogador com jogos em dias seguidos na run de teste', !!pick);
  if (pick) {
    const on = FB.buildModel(run, roster, odds, {}, { now: NOW }), off = FB.buildModel(run, roster, odds, {}, { now: NOW, b2b: false });
    const pi = on.pIndex.get(pick.id), d = on.days.findIndex(md => md.day.date === dates[pick.i]);
    const a = on.days[d].info[pi][0], b = off.days[d].info[pi][0];
    ok('back-to-back: quem joga o 2.º jogo seguido rende o mesmo (medido); fica só assinalado', a.b2b && a.b2b.f === 1 && Math.abs(a.mu / b.mu - 1) < 1e-6 && !b.b2b, [a.mu, b.mu, a.src]);
    const r2 = JSON.parse(JSON.stringify(roster)); r2.players[pick.id].avg.hist = { n: 70, d: { pts: 4 }, b2b: { n: 20, r: { pts: 0.85, reb: 0.85, ast: 0.85, fg3: 0.85, stl: 0.85, blk: 0.85 } } };
    const m2 = FB.buildModel(run, r2, odds, {}, { now: NOW }), c = m2.days[d].info[m2.pIndex.get(pick.id)][0];
    ok('back-to-back: quem rendeu menos nos jogos seguidos da época passada desce mais', Math.abs(c.b2b.f - (1 + 20 / 30 * (0.85 - 1))) < 1e-6 && c.mu < a.mu, [c.b2b, c.mu, a.mu]);
    ok('regularidade: jogador irregular (dispersão 4 em vez de 2) tem mais variância', Math.abs(FB.kOf(r2.players[pick.id], 'pts') - (70 * 4 + 20 * FB.STATS.pts.k) / 90) < 1e-9 && FB.kOf(roster.players[pick.id], 'pts') === FB.STATS.pts.k);
    ok('back-to-back: quem não jogou na véspera (descansou) não conta como jogo seguido (opts.rested)', (() => { const t = [...teamsOf(run.days[0])][0], pid = Object.keys(roster.players).find(k => roster.players[k].team === t); if (!pid) return true; const prev = '2026-10-19'; const m = FB.buildModel(run, roster, {}, {}, { now: NOW, prevGames: { [prev]: [t] }, rested: { [prev]: [pid] } }); return !m.days[0].info[m.pIndex.get(pid)][0].b2b; })());
    ok('back-to-back: a véspera fora da run também conta (opts.prevGames)', (() => { const t = [...teamsOf(run.days[0])][0], pid = Object.keys(roster.players).find(k => roster.players[k].team === t); if (!pid) return true; const prev = '2026-10-19'; const m = FB.buildModel(run, roster, {}, {}, { now: NOW, prevGames: { [prev]: [t] } }); return !!m.days[0].info[m.pIndex.get(pid)][0].b2b; })());
  }
  const lend = JSON.parse(JSON.stringify(roster)); lend.players.star = { name: 'Emprestado', team: 'PHI', uses: 2, status: 'ok', avg: { pts: 40, reb: 10, ast: 10, fg3: 5, stl: 2, blk: 2 }, availDates: ['2026-10-24'] };
  const ml = FB.buildModel(run, lend, odds, {}, { now: NOW }), si = ml.pIndex.get('star');
  ok('emprestado: só entra nos dias combinados', ml.days.filter(md => md.eligSet.has(si)).map(md => md.day.date).join() === '2026-10-24', ml.days.filter(md => md.eligSet.has(si)).map(md => md.day.date));
}

// nomes das estatísticas (o site lê o histórico da blockchain com o mesmo leitor das tarefas)
{
  const { mapStat } = await import('../scripts/lib.mjs');
  const names = ['POINTS', 'REBOUNDS', 'ASSISTS', 'STEALS', 'BLOCKS', 'THREE_POINTS_MADE', 'THREE_POINTS_ATT', 'FIELD_GOALS_MADE', 'FIELD_GOALS_ATT', 'OFFENSIVE_REBOUNDS', 'ASSISTS_MINUS_TURNOVERS', 'POINTS_IN_PAINT', 'POINTS_REBOUNDS', 'XYZ', 'FAST_BREAK_POINTS'];
  const diff = names.filter(n => FB.mapStat(n) !== mapStat(n));
  ok('nomes das estatísticas: site e tarefas leem igual', !diff.length, diff);
}
// procura em segundo plano: fixar um jogador num dia e refazer a run; o melhor plano encontrado entra como ponto
// de partida (opts.hint) e o cálculo nunca fica pior do que ele
{
  const tryLocks = (planFn, total, days, model, uses) => {
    let best = null;
    days.slice(0, 6).forEach((d, i) => {
      const md = model.days[i], w = pi => md.objs.reduce((t, _, k) => t + md.mu[pi][k] / md.T[k], 0);
      md.elig.filter(pi => !d.lineup.includes(model.players[pi].id) && uses[pi] > 0).sort((a, b) => w(b) - w(a)).slice(0, 3).forEach(pi => {
        const out = planFn({ locks: { [d.date]: [model.players[pi].id] } });
        if (out.total > (best ? best.total : total) + 1e-9) best = out;
      });
    });
    return best;
  };
  const base = FB.planRun(run, roster, odds, {}, { now: NOW });
  const found = tryLocks(plan => { const x = FB.planRun(run, roster, odds, plan, { now: NOW }); return { total: x.normal.objective, res: x.normal }; }, base.normal.objective, base.normal.days, base.model, base.model.uses);
  const hint = found ? { main: Object.fromEntries(found.res.days.map(d => [d.date, d.lineup])) } : { main: Object.fromEntries(base.normal.days.map(d => [d.date, d.lineup])) };
  const withHint = FB.planRun(run, roster, odds, {}, { now: NOW, hint });
  console.log('     procura: ' + (found ? 'melhorou ' + base.normal.objective.toFixed(5) + ' → ' + found.total.toFixed(5) : 'nada melhor'));
  ok('com o plano encontrado como ponto de partida, nunca fica pior', withHint.normal.objective >= Math.max(base.normal.objective, found ? found.total : -Infinity) - 1e-9, [withHint.normal.objective, base.normal.objective, found && found.total]);
  ok('ponto de partida respeita usos e jogos', violations(withHint.normal, withHint.model).length === 0, violations(withHint.normal, withHint.model));
  const junk = FB.planRun(run, roster, odds, {}, { now: NOW, hint: { main: { [run.days[0].date]: ['ninguem', 'outro'] } } });
  ok('ponto de partida com jogadores que não existem é ignorado', Math.abs(junk.normal.objective - base.normal.objective) < 1e-9);
  const gb = FB.planGroup(run, [{ key: 'main', roster, plan: {} }, { key: 's1', roster, plan: {} }], odds, { now: NOW });
  const gh = { main: {}, s1: {} }; gb.keys.forEach(k => gb.byKey[k].normal.days.forEach(d => { gh[k][d.date] = d.lineup; }));
  const gw = FB.planGroup(run, [{ key: 'main', roster, plan: {} }, { key: 's1', roster, plan: {} }], odds, { now: NOW, hint: gh });
  ok('contas: com ponto de partida não fica pior', gw.objective >= gb.objective - 1e-9, [gw.objective, gb.objective]);
}
// cadeados que obrigam as duas contas à 2.ª jogada na mesma noite com um só Rare: aviso (clash com tier)
{
  const star = Object.entries(roster.players).map(([id, p]) => [id, run.days.filter(d => d.games.some(g => g.includes(p.team))).length]).sort((a, b) => b[1] - a[1])[0][0];
  const ro = JSON.parse(JSON.stringify(roster));
  Object.assign(ro.players[star], { uses: 2, copies: 3, cards: [2, 1, 1], hold: { main: [2, 1], s1: [1] } });
  const dts = run.days.filter(d => d.games.some(gm => gm.includes(ro.players[star].team))).map(d => d.date);
  const pl = () => ({ played: Object.fromEntries(run.days.filter(d => d.date < dts[1]).map(d => [d.date, { done: true, result: 'win', lineup: d.date === dts[0] ? [star] : [] }])), locks: { [dts[1]]: [star] } });
  const ro1 = JSON.parse(JSON.stringify(ro)); ro1.players[star].uses = 1;
  const g = FB.planGroup(run, [{ key: 'main', roster: ro1, plan: pl() }, { key: 's1', roster: ro1, plan: pl() }], odds, { now: NOW });
  const c = g.clashes.find(x => x.date === dts[1] && x.id === star);
  ok('escalões: 2.ª jogada nas duas contas com 1 Rare (fixado nas duas) → aviso', !!(c && c.tier && c.req.join() === '2,2'), g.clashes);
  const ro2 = JSON.parse(JSON.stringify(ro1)); ro2.players[star].cards = [2, 2, 1];
  const g2 = FB.planGroup(run, [{ key: 'main', roster: ro2, plan: pl() }, { key: 's1', roster: ro2, plan: pl() }], odds, { now: NOW });
  ok('escalões: com 2 cartas de 2 usos já não há aviso', !g2.clashes.some(x => x.date === dts[1] && x.id === star && x.tier), g2.clashes);
}
// ---- Historic: pontos esperados, as melhores equipas dentro do orçamento, simulação do dia ----
{
  const H = JSON.parse(fs.readFileSync(new URL('./fixtures/historic.json', import.meta.url), 'utf8'));
  const M = FB.histModel(H, 'run-fb-historic-2026-10-20-d10', { now: Date.parse('2026-10-29T14:00:00Z') });
  ok('historic: 30 lendas no dia 10, com média e esperado', M && M.rows.length === 30 && M.rows.every(x => isFinite(x.mu)), M && M.rows.length);
  ok('historic: o custo prevê os pontos (reta a subir)', M.b > 0.1 && M.b < 1, M.b);
  ok('historic: cortes dos dias com ~3 jogos (1.º ≥ 10.º ≥ 40.º)', M.cuts.length === 40 && M.cuts[0] >= M.cuts[9] && M.cuts[9] >= M.cuts[39], M.cuts.slice(0, 3));
  const best = FB.histBest(M, 50);
  ok('historic: equipas de 5 dentro dos 350, da melhor para a pior', best.length === 50 && best.every(b => b.ids.length === 5 && b.cost <= 350 && new Set(b.ids).size === 5) && best.every((b, i) => !i || best[i - 1].ev >= b.ev - 1e-9), best[0]);
  // a melhor tem de ser mesmo a melhor: força bruta nas 30 lendas
  let top = -1; const R = M.rows;
  for (let a = 0; a < R.length; a++) for (let b = a + 1; b < R.length; b++) for (let c = b + 1; c < R.length; c++) for (let d = c + 1; d < R.length; d++) for (let e = d + 1; e < R.length; e++) {
    const L = [R[a], R[b], R[c], R[d], R[e]]; if (L.reduce((t, x) => t + x.cost, 0) <= 350) top = Math.max(top, L.reduce((t, x) => t + x.mu, 0)); }
  ok('historic: a melhor equipa é a de força bruta', Math.abs(best[0].ev - top) < 1e-6, [best[0].ev, top]);
  const fixId = R.find(x => !best[0].ids.includes(x.id)).id, banId = best[0].ids[0];
  const b2 = FB.histBest(M, 10, [fixId], [banId]);
  ok('historic: fixado entra sempre e tirado nunca', b2.length && b2.every(b => b.ids.includes(fixId) && !b.ids.includes(banId)), b2[0]);
  const M2 = FB.histModel(H, 'run-fb-historic-2026-10-20-d10', { now: Date.parse('2026-10-29T14:00:00Z'), disc: { [R[0].id]: 20 } });
  ok('historic: carta dá desconto no custo', Math.abs(M2.rows.find(x => x.id === R[0].id).cost - R[0].rp * 0.8) < 1e-9);
  const ev = FB.histEval(M, best.slice(0, 5), 2000);
  ok('historic: simulação dá probabilidades e média perto do esperado', ev.every(r => r.p40 >= r.p10 && r.p10 >= r.p1 && Math.abs(r.mean - r.ev) < 4), ev.map(r => [r.mean, r.ev, r.p40]));
  const all = FB.histEval(M, best, 2000).sort((p, q) => (q.p40 - p.p40) || (q.mean - p.mean)), port = FB.histPortfolio(all, 3, 2);
  ok('historic: smurfs com equipas diferentes (≥ 2 lendas) e a hipótese de pelo menos uma sobe', port.length === 3 && port.every((p, i) => port.slice(0, i).every(o => p.ids.filter(id => !o.ids.includes(id)).length >= 2)) && port[2].union > port[0].p40 && port[0].ids.join() === all[0].ids.join(), port.map(p => [p.p40, p.union]));
  // conta com orçamento próprio (descontos das cartas dela): só recebe equipas que lhe servem
  const okK = (e, k) => k !== 1 || !e.ids.includes(all[0].ids[0]);
  const port2 = FB.histPortfolio(all, 3, 2, okK);
  ok('historic: equipa de cada conta respeita o que lhe serve', port2.length === 3 && !port2[1].ids.includes(all[0].ids[0]) && port2[0].ids.join() === all[0].ids.join(), port2.map(p => p.ids));
  const M11 = FB.histModel(H, 'run-fb-historic-2026-10-20-d11', { now: Date.parse('2026-10-29T14:00:00Z') }), t0 = Date.now(), b11 = FB.histBest(M11, 200);
  ok('historic: 100 lendas (dia 11) em menos de 1 s', b11.length === 200 && Date.now() - t0 < 1000, Date.now() - t0);
}
// jogar para um número de vitórias (plan.goal): um só patamar, em vez dos prémios da run
{
  const rg = Object.assign({}, run, { prizes: [{ wins: 5, value: 7 }, { wins: 9, value: 28 }, { wins: 12, value: 365 }] });
  const mg = FB.buildModel(rg, man, odds, { goal: 7 }, { now: NOW });
  const mp = FB.buildModel(rg, man, odds, {}, { now: NOW });
  ok('jogar para 7 vitórias: um só patamar (7)', mg.prizes.length >= 1 && mg.prizes.every(p => p.wins <= 7) && mg.prizes.some(p => p.wins === 7 || p.auto), mg.prizes);
  ok('sem objetivo: os prémios da run', mp.prizes.length === 3 || mp.prizeShift.dropped.length > 0, mp.prizes);
}
// duas contas com objetivos diferentes (uma para 5 vitórias, outra para a classificação): o plano conjunto corre e
// dá lineups às duas (a classificação não leva as cartas todas)
{
  const rg = Object.assign({}, run, { prizes: [{ wins: 5, value: 7 }, { wins: 9, value: 28 }] });
  const half = (k) => { const ro = { players: {} }; Object.entries(man.players).forEach(([id, p]) => { ro.players[id] = Object.assign({}, p); }); return ro; };
  try {
    const g = FB.planGroup(rg, [{ key: 'main', roster: half(0), plan: { goal: 5 } }, { key: 's1', roster: half(1), plan: { goal: 'max' } }], odds, { now: NOW });
    const n = k => { const e = g.byKey ? g.byKey[k] : null; return e ? (e.normal || e.plan || []).filter(x => x && (x.lineup || x.ids || []).length).length : -1; };
    ok('jogar para diferente em cada conta: o plano conjunto corre', !!g && (g.byKey ? Object.keys(g.byKey).length === 2 : true), Object.keys(g || {}));
  } catch (e) { ok('jogar para diferente em cada conta: o plano conjunto corre', false, String(e && e.message)); }
}
// ---------- motor medido (nov 2026): objetivos ligados, colegas que faltam, regressos, odds ----------
{
  // P(X > h e Y > k) com correlação: valores de referência (scipy)
  const near = (a, b, e) => Math.abs(a - b) < (e || 1e-5);
  ok('probabilidade conjunta de duas normais (referência)', near(FB.bvnUpper(0, 0, 0.5), 1 / 3) && near(FB.bvnUpper(0.5, -0.3, 0.77), 0.292147) && near(FB.bvnUpper(1.2, 0.4, -0.4), 0.014292) && near(FB.bvnUpper(-1, -1, 0.9), 0.79818) && near(FB.bvnUpper(0.3, 1.1, 0), (1 - FB.normCdf(0.3)) * (1 - FB.normCdf(1.1))), [FB.bvnUpper(0.5, -0.3, 0.77), FB.bvnUpper(1.2, 0.4, -0.4)]);
  ok('três objetivos ligados: perto do valor exato', near(FB.mvnUpper([0, 0, 0], [[1, 0.5, 0.5], [0.5, 1, 0.5], [0.5, 0.5, 1]]), 0.25, 0.005) && near(FB.mvnUpper([-0.3, 0.2, -0.5], [[1, 0.6, 0.2], [0.6, 1, 0.3], [0.2, 0.3, 1]]), 0.28074, 0.006));
  ok('correlações medidas: FGM com FGA 0,77, triplos com tentados 0,70, a mesma estatística 1, desconhecidas 0,07', FB.rhoOf('fgm', 'fga') === 0.77 && FB.rhoOf('fga', 'fgm') === 0.77 && FB.rhoOf('fg3', 'fg3a') === 0.7 && FB.rhoOf('pts', 'pts') === 1 && FB.rhoOf('stl', 'blk') === 0.07);
  // um dia com FGM + FGA: quem marca muito também tenta muito, por isso cumprir os dois é mais provável do que o
  // produto das duas probabilidades (como se não tivessem nada a ver)
  const mk = n => { const o = {}; for (let i = 0; i < n; i++) o['p' + i] = { name: 'P' + i, team: i % 2 ? 'BOS' : 'SAC', uses: 2, avg: { pts: 22, fgm: 8.2, fga: 17.4, reb: 6, ast: 5, stl: 1, blk: 0.5, min: 29 } }; return { players: o }; };
  const day = (objs) => ({ name: 't', prizes: [], days: [{ date: '2026-11-03', objectives: objs, games: [['BOS', 'SAC', '2026-11-04T00:00:00Z', 'x']] }] });
  const m2 = FB.buildModel(day([{ stat: 'fgm', target: 41 }, { stat: 'fga', target: 87 }]), mk(6), { days: {} }, {}, { now: NOW });
  const md = m2.days[0], L = [0, 1, 2, 3, 4];
  const marg = k => { let S = 0, V = 0; L.forEach(i => { S += md.mu[i][k]; V += md.v[i][k]; }); return FB.probAtLeast(S, V, md.T[k]); };
  const joint = FB.lineupProb(md, L), prod = marg(0) * marg(1);
  ok('objetivos ligados (FGM + FGA): a probabilidade do dia é maior do que o produto das duas', joint > prod + 0.03 && joint <= Math.min(marg(0), marg(1)) + 1e-9 && md.nv === 3 && md.pairs.length === 1, [joint, prod, marg(0), marg(1)]);
  const m1 = FB.buildModel(day([{ stat: 'fgm', target: 41 }]), mk(6), { days: {} }, {}, { now: NOW });
  ok('com um só objetivo nada muda', near(FB.lineupProb(m1.days[0], L), marg(0), 1e-12) && m1.days[0].nv === 1);
  const m3 = FB.buildModel(day([{ stat: 'stl', target: 5 }, { stat: 'blk', target: 2 }]), mk(6), { days: {} }, {}, { now: NOW }), md3 = m3.days[0];
  const mg3 = k => { let S = 0, V = 0; L.forEach(i => { S += md3.mu[i][k]; V += md3.v[i][k]; }); return FB.probAtLeast(S, V, md3.T[k]); };
  ok('objetivos sem ligação (roubos + desarmes): fica praticamente o produto', Math.abs(FB.lineupProb(md3, L) - mg3(0) * mg3(1)) < 0.01, [FB.lineupProb(md3, L), mg3(0) * mg3(1)]);
  const r2 = FB.planRun(day([{ stat: 'fgm', target: 41 }, { stat: 'fga', target: 87 }]), mk(7), { days: {} }, {}, { now: NOW });
  ok('o plano usa a probabilidade conjunta', near(r2.normal.days[0].P, FB.lineupProb(md, r2.normal.days[0].lineupIdx), 1e-9), r2.normal.days[0].P);
  // quem não joga falha os dois objetivos ao mesmo tempo: com um jogador em dúvida, a ligação aumenta
  const rq = mk(6); rq.players.p0.status = 'duv';
  const mq = FB.buildModel(day([{ stat: 'reb', target: 28 }, { stat: 'ast', target: 23 }]), rq, { days: {} }, {}, { now: NOW }), mok = FB.buildModel(day([{ stat: 'reb', target: 28 }, { stat: 'ast', target: 23 }]), mk(6), { days: {} }, {}, { now: NOW });
  ok('jogador em dúvida: a covariância entre os objetivos dele sobe (falha os dois de uma vez)', mq.days[0].v[0][2] > mok.days[0].v[0][2] && mok.days[0].v[0][2] > 0, [mq.days[0].v[0][2], mok.days[0].v[0][2]]);

  // colegas que faltam: a produção de quem está fora reparte-se pelos que jogam (mais para quem joga menos minutos)
  const teams = { BOS: { n: 10, allowed: { pts: 115 }, scored: { pts: 115, reb: 44 }, last: '2026-11-02' }, SAC: { n: 10, allowed: { pts: 115 }, scored: { pts: 115, reb: 44 }, last: '2026-11-02' }, NBA: { n: 30, allowed: { pts: 115 } } };
  const star = { id: 'star', team: 'BOS', avg: { pts: 28, reb: 8, min: 35, form: { n10: 10, n5: 5, l10: { pts: 28, reb: 8, min: 35 }, l5: { pts: 28, reb: 8, min: 35 }, last: '2026-11-02' } } };
  const ro = { players: { tit: { name: 'Titular', team: 'BOS', uses: 2, avg: { pts: 20, reb: 6, min: 34, gp: 12 } }, sup: { name: 'Suplente', team: 'BOS', uses: 2, avg: { pts: 9, reb: 4, min: 16, gp: 12 } }, out: { name: 'Outro', team: 'SAC', uses: 2, avg: { pts: 20, reb: 6, min: 34, gp: 12 } } } };
  const rn = day([{ stat: 'pts', target: 60 }]);
  const base = FB.buildModel(rn, ro, { days: {} }, {}, { now: NOW, teams, mates: { BOS: [star] } });
  const inj = { star: { status: 'out', return_date: null, updated_at: new Date(NOW).toISOString() } };
  const outM = FB.buildModel(rn, ro, { days: {} }, {}, { now: NOW, teams, mates: { BOS: [star] }, injuries: inj });
  const mu = (m, id) => m.days[0].mu[m.pIndex.get(id)][0], fT = mu(outM, 'tit') / mu(base, 'tit'), fS = mu(outM, 'sup') / mu(base, 'sup');
  const share = 28 * FB.minutesDisc({ min: 35 }) / 115;
  ok('colega habitual fora: o titular sobe pouco, o suplente sobe mais, a outra equipa não mexe', near(fT, 1 + share * 0.33, 1e-6) && fS > fT + 0.1 && near(fS, 1 + share * (0.33 + 0.94 * (34 - 16) / 20), 1e-6) && near(mu(outM, 'out') / mu(base, 'out'), 1, 1e-9), [fT, fS]);
  const info = outM.days[0].info[outM.pIndex.get('sup')][0];
  ok('o efeito dos colegas fica à vista (para o "Porquê")', info.ctx && near(info.ctx.f, fS, 1e-6) && info.ctx.mates[0].id === 'star' && info.ctx.mates[0].out === 1 && !base.days[0].info[base.pIndex.get('sup')][0].ctx, info.ctx);
  // se as médias já foram feitas sem o colega (faltou a época toda), não há nada a acrescentar
  const ro2 = JSON.parse(JSON.stringify(ro)); ro2.players.sup.avg.sem = { star: [12] };
  const outAll = FB.buildModel(rn, ro2, { days: {} }, {}, { now: NOW, teams, mates: { BOS: [star] }, injuries: inj });
  ok('colega fora a época toda: as médias já contam com isso', near(mu(outAll, 'sup') / mu(base, 'sup'), 1, 1e-9));
  // e se o colega volta (as médias foram feitas sem ele em metade dos jogos), o jogador desce
  const ro3 = JSON.parse(JSON.stringify(ro)); ro3.players.sup.avg.sem = { star: [6] };
  const back = FB.buildModel(rn, ro3, { days: {} }, {}, { now: NOW, teams, mates: { BOS: [star] } });
  ok('colega que volta: quem cresceu sem ele desce', mu(back, 'sup') < mu(base, 'sup') * 0.95, [mu(back, 'sup'), mu(base, 'sup')]);
  // colega parado há muito e fora do relatório (ex.: retirado ainda no plantel): conta como fora, e como as médias já
  // foram todas feitas sem ele, não mexe em nada (não "volta" só por não estar no relatório)
  const ghost = { id: 'ghost', team: 'BOS', avg: { pts: 25, min: 33, form: { last: '2026-06-01' } } };
  const ro5 = JSON.parse(JSON.stringify(ro)); ro5.players.sup.avg.sem = { ghost: [12] };
  ok('colega parado há muito e fora do relatório: não conta como regresso', near(mu(FB.buildModel(rn, ro5, { days: {} }, {}, { now: NOW, teams, mates: { BOS: [ghost] } }), 'sup'), mu(base, 'sup'), 1e-9));
  // com a linha das odds os colegas não mexem (a linha já sabe quem falta)
  const od = { days: { '2026-11-03': { players: { sup: { pts: { line: 9.5, over: -110, under: -110 } } } } } };
  const a1 = FB.buildModel(rn, ro, od, {}, { now: NOW, teams, mates: { BOS: [star] }, injuries: inj }), a0 = FB.buildModel(rn, ro, od, {}, { now: NOW, teams });
  ok('com a linha das odds os colegas não mexem', near(mu(a1, 'sup'), mu(a0, 'sup'), 1e-9) && !a1.days[0].info[a1.pIndex.get('sup')][0].ctx);
  // sem o número de jogos (catálogo antigo) não se inventa nada
  const ro4 = JSON.parse(JSON.stringify(ro)); delete ro4.players.sup.avg.gp;
  ok('sem o número de jogos do jogador, o efeito dos colegas não se aplica', near(mu(FB.buildModel(rn, ro4, { days: {} }, {}, { now: NOW, teams, mates: { BOS: [star] }, injuries: inj }), 'sup'), mu(base, 'sup'), 1e-9));

  // regresso: falhou o último jogo da equipa → o primeiro jogo vale menos (−5% / −8% / −14%), o segundo metade
  const two = { name: 't', prizes: [], days: [{ date: '2026-11-03', objectives: [{ stat: 'pts', target: 60 }], games: [['BOS', 'SAC', '2026-11-04T00:00:00Z', 'x']] }, { date: '2026-11-05', objectives: [{ stat: 'pts', target: 60 }], games: [['BOS', 'SAC', '2026-11-06T00:00:00Z', 'y']] }, { date: '2026-11-07', objectives: [{ stat: 'pts', target: 60 }], games: [['BOS', 'SAC', '2026-11-08T00:00:00Z', 'z']] }] };
  const rb = { players: { a: { name: 'A', team: 'BOS', uses: 3, avg: { pts: 20, form: { n10: 10, n5: 5, l10: { pts: 20 }, l5: { pts: 20 }, last: '2026-10-28' } } }, b: { name: 'B', team: 'BOS', uses: 3, avg: { pts: 20, form: { n10: 10, n5: 5, l10: { pts: 20 }, l5: { pts: 20 }, last: '2026-11-02' } } } } };
  const mb = FB.buildModel(two, rb, { days: {} }, {}, { now: NOW, teams });
  const ma = d => mb.days[d].mu[mb.pIndex.get('a')][0], mbb = d => mb.days[d].mu[mb.pIndex.get('b')][0];
  ok('regresso depois de falhar jogos: 1.º jogo −8% (5 dias parado), 2.º −4%, depois normal; quem jogou o último não mexe', near(ma(0) / mbb(0), 0.92, 1e-9) && near(ma(1) / mbb(1), 0.96, 1e-9) && near(ma(2) / mbb(2), 1, 1e-9) && mb.days[0].info[mb.pIndex.get('a')][0].back.gap === 5, [ma(0), ma(1), ma(2), mbb(0)]);

  // odds: nas estatísticas pequenas (triplos, roubos, desarmes) a média fica um pouco abaixo da que a linha dá
  const pl = { name: 'X', team: 'BOS', avg: { fg3: 2.5, pts: 20 } };
  const d3 = FB.playerDist(pl, 'fg3', { fg3: { line: 2.5, over: -110, under: -110 } }), dp = FB.playerDist(pl, 'pts', { pts: { line: 20.5, over: -110, under: -110 } });
  ok('odds: triplos ficam ~4% abaixo da conta direta da linha; pontos ficam na linha', d3.mu > 2.4 && d3.mu < 2.67 * 0.985 && near(dp.mu, 20.5, 1e-6), [d3.mu, dp.mu]);
  ok('odds: com a linha a dispersão é 5% menor do que pelas médias', near(dp.v / dp.mu, FB.STATS.pts.k * 0.95, 1e-9));
}
// ---------- pesquisa do plano: mudar um jogador de dia (um uso que hoje pesa pouco e fecha outro lineup) ----------
{
  // caso real (nov 2026): com poucos usos, o plano punha o Şengün (1 uso) hoje e deixava o dia 10 com 4; guardá-lo
  // dava mais vitórias, mas a pesquisa não chegava lá (só trocava dentro do dia ou entre dias, nunca "mudava")
  const uses = { sga: 3, jokic: 2, giannis: 1, luka: 2, wemby: 1, ant: 4, mitchell: 1, brunson: 1, cade: 0, maxey: 1, lebron: 4, jbrown: 1, sabonis: 1, kat: 2, sengun: 1, curry: 4 };
  const players = Object.fromEntries(Object.entries(uses).map(([pid, u]) => [pid, Object.assign({}, roster.players[pid], { uses: u, status: 'ok' })]));
  ok('pesquisa: o fixture tem os 16 jogadores do caso', Object.values(players).every(p => p.team), Object.keys(uses).filter(pid => !roster.players[pid]));
  const d1 = run.days[0].date, d2 = run.days[1].date;
  const base = { played: { [d1]: { done: true, result: 'win', lineup: ['sga', 'cade', 'maxey', 'jbrown', 'brunson'] } } };
  const o = { now: Date.parse(d2 + 'T15:00:00Z'), injuries: { maxey: { id: 'maxey', status: 'out' }, sga: { id: 'sga', status: 'dtd' } } };
  const r = FB.planRun(run, { players }, odds, base, o), today = r.normal.days[0];
  const alts = today.lineup.map(pid => [pid, FB.planRun(run, { players }, odds, Object.assign({}, base, { bans: { [d2]: [pid] } }), o).normal.objective]);
  ok('pesquisa: guardar um jogador de hoje nunca dá um plano melhor do que o plano', alts.every(x => x[1] <= r.normal.objective + 1e-9), [r.normal.objective, alts]);
  // antes: 3 lineups completos e 1,4 vitórias esperadas (usos espalhados por dias perdidos); agora 5 e 2,4
  ok('pesquisa: com poucos usos junta-os em lineups completos (5 ou mais dias cheios, 2,2+ vitórias esperadas)', r.normal.days.filter(d => d.lineup.length === 5).length >= 5 && r.normal.expected >= 2.2, [r.normal.days.map(d => d.lineup.length).join(''), r.normal.expected]);
  ok('pesquisa: nenhum dia fica com lugares vazios havendo quem tenha usos e jogo nesse dia', r.normal.days.every((d, i) => { const md = r.model.days[i]; return d.lineup.length >= md.size || !md.elig.some(p => !d.lineupIdx.includes(p) && (r.normal.usage[r.model.players[p].id] || 0) < r.model.uses[p]); }));

  // cenários ao acaso (semente fixa): o plano respeita sempre usos, jogos e tamanho do lineup; com duas contas, também
  // os usos de cada conta e um Moment por noite
  let a = 12345; const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const all = Object.keys(roster.players), bad = [];
  for (let s = 0; s < 6; s++) {
    const ids = all.slice().sort(() => rnd() - 0.5).slice(0, 10 + Math.floor(rnd() * 10));
    const mk = k => ({ players: Object.fromEntries(ids.map((pid, i) => [pid, Object.assign({}, roster.players[pid], { uses: 1 + Math.floor(rnd() * 3), status: 'ok', copies: i % 4 === 0 ? 2 : 1, owner: i % 4 === 0 ? null : (i % 2 ? 'main' : 's1') })])) });
    const ro = mk('main'), single = FB.planRun(run, ro, odds, {}, { now: NOW });
    const cnt = {};
    single.normal.days.forEach((d, i) => { const md = single.model.days[i]; if (d.lineup.length > md.size || new Set(d.lineup).size !== d.lineup.length) bad.push(['tamanho', s, d.date]); d.lineupIdx.forEach(p => { if (!md.eligSet.has(p)) bad.push(['sem jogo', s, d.date, p]); cnt[p] = (cnt[p] || 0) + 1; }); });
    Object.entries(cnt).forEach(([p, c]) => { if (c > single.model.uses[p]) bad.push(['usos', s, p, c]); });
    const list = [{ key: 'main', roster: ro, plan: {} }, { key: 's1', roster: mk('s1'), plan: {} }], g = FB.planGroup(run, list, odds, { now: NOW }), night = {};
    g.keys.forEach((k, ai) => { const c2 = {}; g.byKey[k].normal.days.forEach((d, i) => { const md = g.byKey[k].model.days[i]; if (d.lineup.length > md.size) bad.push(['tamanho', s, k, d.date]); d.lineup.forEach(pid => { c2[pid] = (c2[pid] || 0) + 1; const nk = d.date + '|' + pid; night[nk] = (night[nk] || 0) + 1; if (!md.eligSet.has(g.byKey[k].model.pIndex.get(pid))) bad.push(['sem jogo', s, k, d.date, pid]); }); }); Object.entries(c2).forEach(([pid, c]) => { if (c > list[ai].roster.players[pid].uses) bad.push(['usos da conta', s, k, pid, c]); }); });
    Object.entries(night).forEach(([nk, c]) => { const pid = nk.split('|')[1]; if (c > (ro.players[pid].copies || 1)) bad.push(['mesma noite', s, nk, c]); });
  }
  ok('pesquisa: em cenários ao acaso (1 e 2 contas) o plano respeita usos, jogos, tamanho e um Moment por noite', bad.length === 0, bad.slice(0, 5));
}
// ---------- Moments trancados (lock de 1 ano no Top Shot): nunca entram numa transferência ----------
{
  const star = Object.entries(roster.players).map(([id, p]) => [id, run.days.filter(d => d.games.some(g => g.includes(p.team))).length]).sort((a, b) => b[1] - a[1])[0][0];
  const mk = (extra) => { const ro = JSON.parse(JSON.stringify(roster)); Object.values(ro.players).forEach(p => { p.uses = 0; }); Object.assign(ro.players[star], { uses: 2, avg: { pts: 60, reb: 20, ast: 15, fg3: 8, stl: 4, blk: 4 } }, extra); return ro; };
  // 1 Moment, na principal: livre → a smurf joga-o com uma transferência; trancado → sem transferência
  const free1 = mk({ copies: 1, owner: 'main', hold: { main: [2] } }), lk1 = mk({ copies: 1, owner: 'main', hold: { main: [2] }, pin: { main: [2] } });
  const plays = g => g.keys.filter(k => g.byKey[k].normal.days.some(d => d.lineup.includes(star)));
  const g0 = FB.planGroup(run, [{ key: 'main', roster: free1, plan: {} }, { key: 's1', roster: free1, plan: {} }], odds, { now: NOW });
  const g1 = FB.planGroup(run, [{ key: 'main', roster: lk1, plan: {} }, { key: 's1', roster: lk1, plan: {} }], odds, { now: NOW });
  ok('trancados: livre, o Moment passa para a smurf (há transferência)', plays(g0).includes('s1') && g0.transfers.some(t => t.id === star), [plays(g0), g0.transfers.filter(t => t.id === star)]);
  ok('trancados: trancado, nenhuma transferência dele', !g1.transfers.some(t => t.id === star), g1.transfers.filter(t => t.id === star));
  // 2 Moments na principal (Rare trancado + Common livre): só o Common pode ir
  const two = mk({ copies: 2, cards: [2, 1], hold: { main: [2, 1] }, pin: { main: [2] } });
  const g2 = FB.planGroup(run, [{ key: 'main', roster: two, plan: {} }, { key: 's1', roster: two, plan: {} }], odds, { now: NOW });
  const sent = g2.transfers.filter(t => t.id === star && t.from === 'main');
  ok('trancados: com um Rare trancado e um Common livre, só sai o Common', sent.every(t => (t.uses || 1) === 1), sent);
}
console.log(fails ? fails + ' falha(s)' : 'motor: tudo certo');
process.exit(fails ? 1 : 0);
