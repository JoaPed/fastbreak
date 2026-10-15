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
console.log(fails ? fails + ' falha(s)' : 'motor: tudo certo');
process.exit(fails ? 1 : 0);
