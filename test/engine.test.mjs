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

// forma: últimos 10 e 5 jogos misturados com a época
const hot = { name: 'Quente', team: 'BOS', uses: 2, avg: { pts: 20, reb: 6, form: { n10: 10, n5: 5, l10: { pts: 24, reb: 6 }, l5: { pts: 30, reb: 6 } } } };
FB.setForm(1);
ok('forma normal: época 50%, últimos 10 30%, últimos 5 20%', Math.abs(FB.avgOf(hot, 'pts').v - (0.5 * 20 + 0.3 * 24 + 0.2 * 30)) < 1e-9, FB.avgOf(hot, 'pts'));
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
ok('adversário: fator e meio-ajuste com limite', Math.abs(mSac.f - 126 / 115) < 1e-9 && Math.abs(mSac.used - (1 + 0.5 * (126 / 115 - 1))) < 1e-9 && mBos.used < 1 && FB.matchup(teams, 'XXX', 'pts') === null && FB.matchup({ SAC: { n: 3, allowed: { pts: 140 } }, NBA: { allowed: { pts: 115 } } }, 'SAC', 'pts') === null);
const mrun = { name: 't', prizes: [], days: [{ date: '2026-11-03', objectives: [{ stat: 'pts', target: 100 }], games: [['BOS', 'SAC', '2026-11-04T00:00:00Z', 'x']] }] };
const mro = { players: { a: { name: 'A', team: 'BOS', uses: 1, avg: { pts: 20 } }, b: { name: 'B', team: 'SAC', uses: 1, avg: { pts: 20 } } } };
const mm = FB.buildModel(mrun, mro, { days: {} }, {}, { now: NOW, teams });
const muA = mm.days[0].mu[mm.pIndex.get('a')][0], muB = mm.days[0].mu[mm.pIndex.get('b')][0];
ok('contra quem concede mais, a média sobe; contra quem concede menos, desce', muA > 20 && muB < 20 && Math.abs(muA - 20 * (1 + 0.5 * (126 / 115 - 1))) < 1e-9, [muA, muB]);
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
    ok('back-to-back: 2.º jogo seguido rende 3% menos (sem odds)', a.b2b && Math.abs(a.mu / b.mu - 0.97) < 1e-6 && !b.b2b, [a.mu, b.mu, a.src]);
    const r2 = JSON.parse(JSON.stringify(roster)); r2.players[pick.id].avg.hist = { n: 70, d: { pts: 4 }, b2b: { n: 20, r: { pts: 0.85, reb: 0.85, ast: 0.85, fg3: 0.85, stl: 0.85, blk: 0.85 } } };
    const m2 = FB.buildModel(run, r2, odds, {}, { now: NOW }), c = m2.days[d].info[m2.pIndex.get(pick.id)][0];
    ok('back-to-back: quem rendeu menos nos jogos seguidos da época passada desce mais', Math.abs(c.b2b.f - (0.97 + 20 / 30 * (0.85 - 0.97))) < 1e-6 && c.mu < a.mu, [c.b2b, c.mu, a.mu]);
    ok('regularidade: jogador irregular (dispersão 4 em vez de 2) tem mais variância', Math.abs(FB.kOf(r2.players[pick.id], 'pts') - (70 * 4 + 20 * 2) / 90) < 1e-9 && FB.kOf(roster.players[pick.id], 'pts') === FB.STATS.pts.k);
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
console.log(fails ? fails + ' falha(s)' : 'motor: tudo certo');
process.exit(fails ? 1 : 0);
