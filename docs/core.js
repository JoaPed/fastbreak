/* Fastbreak run planner — motor de cálculo (funções puras, sem DOM).
   Usado pela app no browser e pelos testes em Node. */
(function (root) {
  'use strict';

  // k = dispersão (variância ≈ k × média); kind = modelo para converter linhas em médias
  const STATS = {
    pts: { label: 'Pontos', short: 'PTS', k: 2.0, kind: 'normal' },
    reb: { label: 'Ressaltos', short: 'REB', k: 1.3, kind: 'normal' },
    ast: { label: 'Assistências', short: 'AST', k: 1.3, kind: 'normal' },
    fg3: { label: 'Triplos', short: '3PM', k: 1.15, kind: 'poisson' },
    stl: { label: 'Roubos de bola', short: 'STL', k: 1.0, kind: 'poisson' },
    blk: { label: 'Desarmes', short: 'BLK', k: 1.1, kind: 'poisson' },
  };
  const STATUS = {
    ok: { label: 'Disponível', play: 1 },
    prov: { label: 'Provável', play: 0.9 },
    duv: { label: 'Dúvida', play: 0.5 },
    fora: { label: 'Fora', play: 0 },
  };
  // fração do jogo que ainda falta quando o jogador está a meio de cada período
  const QREM = { 1: 0.82, 2: 0.57, 3: 0.32, 4: 0.08 };
  const COMBO_RHO = 0.3;   // correlação entre stats do mesmo jogador (minutos)
  const EPS_TOTAL = 0.002; // peso do total esperado (desempate / ranking diário)
  const EPS_WINS = 0.01;   // com prémios, peso das vitórias esperadas (desempate)
  const Z90 = 1.2816;      // percentil 90 para o modo "tudo pelo dia"

  // ---------- matemática ----------
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function normCdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function invNorm(p) {
    if (p <= 0) return -8; if (p >= 1) return 8;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425, ph = 1 - pl; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > ph) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function poissonTail(lambda, m) { // P(X >= m)
    if (m <= 0) return 1;
    let term = Math.exp(-lambda), cdf = term;
    for (let i = 1; i < m; i++) { term *= lambda / i; cdf += term; }
    return Math.max(0, Math.min(1, 1 - cdf));
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  // ---------- odds ----------
  // Aceita odds americanas (-115, +130) ou decimais (1.87)
  function impliedProb(o) {
    if (o == null || o === '' || !isFinite(+o)) return null;
    o = +o;
    if (o >= 100) return 100 / (o + 100);
    if (o <= -100) return -o / (-o + 100);
    if (o > 1 && o < 100) return 1 / o;
    return null;
  }
  // Probabilidade de "mais" sem a margem da casa
  function devig(over, under) {
    const a = impliedProb(over), b = impliedProb(under);
    if (a != null && b != null) return a / (a + b);
    if (a != null) return clamp(a - 0.024, 0.03, 0.97);
    if (b != null) return 1 - clamp(b - 0.024, 0.03, 0.97);
    return 0.5;
  }
  // Média que faz P(X > linha) = p, com X ~ Normal(μ, k·μ)
  function solveNormal(line, p, k) {
    let mu = Math.max(line, 0.5);
    for (let i = 0; i < 40; i++) {
      const sd = Math.sqrt(k * Math.max(mu, 0.5));
      const next = Math.max(0, line + sd * invNorm(p));
      if (Math.abs(next - mu) < 1e-7) { mu = next; break; }
      mu = next;
    }
    return mu;
  }
  // λ que faz P(Poisson(λ) > linha) = p
  function solvePoisson(line, p) {
    const m = Math.floor(line) + 1;
    let lo = 1e-3, hi = 4 * line + 12;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (poissonTail(mid, m) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // ---------- distribuição de um jogador num dia ----------
  function rawStat(player, s, oddsP) {
    const st = STATS[s];
    if (!st) return { mu: 0, v: 0, src: 'sem' };
    const o = oddsP && oddsP[s];
    let mu, src, line = null, pOver = null;
    if (o && o.line != null && isFinite(+o.line)) {
      line = +o.line;
      pOver = devig(o.over, o.under);
      mu = st.kind === 'normal' ? solveNormal(line, pOver, st.k) : solvePoisson(line, pOver);
      src = 'odds';
    } else if (player.avg && player.avg[s] != null && isFinite(+player.avg[s])) {
      mu = +player.avg[s];
      src = 'media';
    } else {
      mu = 0; src = 'sem';
    }
    return { mu, v: Math.max(st.k * mu, mu > 0 ? 0.05 : 0), src, line, pOver };
  }
  function statusFor(player, oddsP) { return (oddsP && oddsP.status) || player.status || 'ok'; }

  function playerDist(player, statKey, oddsP) {
    const parts = String(statKey).split('+');
    const raws = parts.map(s => rawStat(player, s, oddsP));
    let mu = 0, v = 0;
    raws.forEach(r => { mu += r.mu; v += r.v; });
    for (let i = 0; i < raws.length; i++) for (let j = i + 1; j < raws.length; j++) v += 2 * COMBO_RHO * Math.sqrt(raws[i].v * raws[j].v);
    const srcs = raws.map(r => r.src);
    const src = srcs.every(x => x === 'odds') ? 'odds' : srcs.some(x => x === 'odds') ? 'misto' : srcs.every(x => x === 'sem') ? 'sem' : 'media';
    const status = statusFor(player, oddsP);
    const pp = (STATUS[status] || STATUS.ok).play;
    const mu2 = pp * mu;
    const v2 = Math.max(0, pp * (v + mu * mu) - mu2 * mu2);
    return { mu: mu2, v: v2, src, status, pPlay: pp, line: raws.length === 1 ? raws[0].line : null, pOver: raws.length === 1 ? raws[0].pOver : null };
  }

  function probAtLeast(S, V, T) {
    if (V <= 1e-9) return S >= T - 0.5 ? 1 : 0;
    return 1 - normCdf((T - 0.5 - S) / Math.sqrt(V));
  }

  // ---------- jogos ----------
  function gameOf(day, team) { return (day.games || []).find(g => Array.isArray(g) && (g[0] === team || g[1] === team)) || null; }
  function teamsOn(day) {
    const set = new Set();
    (day.games || []).forEach(g => { if (Array.isArray(g)) { set.add(g[0]); set.add(g[1]); } });
    return set;
  }
  function tipTime(day, team) { const g = gameOf(day, team); return g && g[2] ? Date.parse(g[2]) : null; }

  // ---------- modelo ----------
  function buildModel(run, roster, odds, plan, opts) {
    plan = plan || {}; opts = opts || {};
    const now = opts.now != null ? opts.now : Date.now();
    const played = plan.played || {};
    const locks = plan.locks || {};
    const bans = plan.bans || {};
    const banAll = new Set(bans['*'] || []);
    const players = Object.entries((roster && roster.players) || {})
      .map(([id, p]) => Object.assign({ id }, p))
      .filter(p => !p.removed)
      .sort((a, b) => a.name.localeCompare(b.name));
    const pIndex = new Map(players.map((p, i) => [p.id, i]));
    const allDays = (run.days || []).map((d, i) => Object.assign({ idx: i, objectives: [] }, d));
    const isDone = d => played[d.date] && played[d.date].done;
    const open = allDays.filter(d => !isDone(d));
    const oddsDays = (odds && odds.days) || {};
    const winsSoFar = allDays.filter(d => isDone(d) && played[d.date].result === 'win').length;

    const days = open.map((day, di) => {
      const teams = teamsOn(day);
      const oddsDay = (oddsDays[day.date] && oddsDays[day.date].players) || {};
      const banned = new Set(bans[day.date] || []);
      const objs = (day.objectives || []).filter(o => o && o.stat && +o.target > 0);
      const K = objs.length;
      const offset = new Array(K).fill(0);

      // dia em curso: jogadores do lineup submetido cujo jogo já começou ficam presos
      const liveDoc = di === 0 && plan.live && plan.live[day.date];
      const live = liveDoc && liveDoc.active ? liveDoc : null;
      const submitted = live ? (live.lineup || []).filter(id => pIndex.has(id)) : [];
      const lp = (live && live.players) || {};
      const startedTeams = new Set();
      if (live) {
        teams.forEach(t => { const tt = tipTime(day, t); if (tt != null && now >= tt) startedTeams.add(t); });
        submitted.forEach(id => {
          const s = lp[id] && lp[id].state;
          if (s === 'jogo' || s === 'fim') { const g = gameOf(day, players[pIndex.get(id)].team); if (g) { startedTeams.add(g[0]); startedTeams.add(g[1]); } }
        });
        (live.startedGames || []).forEach(t => { const g = gameOf(day, t); if (g) { startedTeams.add(g[0]); startedTeams.add(g[1]); } });
      }

      const mu = [], v = [], info = [], elig = [];
      const liveLocks = [];
      players.forEach((p, pi) => {
        const oddsP = oddsDay[p.id];
        const dists = objs.map(o => playerDist(p, o.stat, oddsP));
        mu[pi] = dists.map(x => x.mu);
        v[pi] = dists.map(x => x.v);
        info[pi] = dists;
        const status = statusFor(p, oddsP);
        const plays = teams.has(p.team);
        const avail = (STATUS[status] || STATUS.ok).play > 0;
        const inSub = submitted.includes(p.id);
        const started = startedTeams.has(p.team);
        if (live && started) {
          if (!inSub) return; // jogo já começou e não está no lineup: já não pode entrar
          // preso no lineup; aplica o que já fez
          const e = lp[p.id] || {};
          const state = e.state === 'fim' ? 'fim' : e.state === 'jogo' ? 'jogo' : 'jogo?';
          const vals = e.vals || {};
          objs.forEach((o, k) => {
            const known = +vals[o.stat] || 0;
            if (state === 'fim') { offset[k] += known; mu[pi][k] = 0; v[pi][k] = 0; }
            else if (state === 'jogo') { const r = QREM[e.q] != null ? QREM[e.q] : 0.5; offset[k] += known; mu[pi][k] *= r; v[pi][k] *= r; }
          });
          info[pi] = dists.map((x, k) => Object.assign({}, x, { liveState: state, known: +((e.vals || {})[objs[k].stat]) || 0, q: e.q || null, muLeft: mu[pi][k] }));
          elig.push(pi); liveLocks.push(pi);
          return;
        }
        if (plays && avail && !banned.has(p.id) && !banAll.has(p.id) && K) elig.push(pi);
      });
      // os jogadores presos contam como "fixados" e não somam ao offset duas vezes (mu já é só o que falta)
      const eligSet = new Set(elig);
      const lockAll = (locks[day.date] || []).map(id => pIndex.get(id)).filter(i => i != null);
      const lockIdx = Array.from(new Set(liveLocks.concat(lockAll.filter(i => eligSet.has(i))))).slice(0, 5);
      const badLocks = lockAll.filter(i => !eligSet.has(i)).map(i => players[i].id);
      return {
        day, objs, T: objs.map(o => +o.target), mu, v, info, elig, eligSet, locks: lockIdx, badLocks, teams, oddsDay, offset,
        live: live ? { submitted, startedTeams: [...startedTeams], liveLocks: liveLocks.map(i => players[i].id) } : null,
      };
    });
    const uses = players.map(p => Math.max(0, Math.floor(+p.uses || 0)));
    const prizes = (run.prizes || []).map(p => ({ wins: Math.round(+p.wins), value: +p.value > 0 ? +p.value : 1, label: p.label || '' })).filter(p => p.wins > 0).sort((a, b) => a.wins - b.wins);
    return { players, pIndex, allDays, days, uses, played, D: days.length, P: players.length, prizes, winsSoFar, now };
  }

  // ---------- objetivo da run ----------
  function makeObjective(model) {
    const prizes = model.prizes || [];
    const base = model.winsSoFar || 0;
    const n = model.days.length;
    const dist = new Float64Array(n + 2);
    const totalW = prizes.reduce((a, p) => a + p.value, 0) || 1;
    function winDist(Ps) {
      dist.fill(0); dist[0] = 1;
      for (let i = 0; i < Ps.length; i++) { const p = Ps[i]; for (let k = i + 1; k >= 1; k--) dist[k] = dist[k] * (1 - p) + dist[k - 1] * p; dist[0] *= (1 - p); }
      return dist;
    }
    function prizeProbs(Ps) {
      if (!prizes.length) return [];
      const d = winDist(Ps);
      return prizes.map(pr => { const need = pr.wins - base; if (need <= 0) return 1; let t = 0; for (let k = need; k <= Ps.length; k++) t += d[k]; return Math.min(1, t); });
    }
    function value(Ps) {
      let ew = 0; for (let i = 0; i < Ps.length; i++) ew += Ps[i];
      if (!prizes.length) return ew;
      const pp = prizeProbs(Ps); let v = 0;
      for (let i = 0; i < pp.length; i++) v += prizes[i].value * pp[i];
      return v / totalW + EPS_WINS * ew;
    }
    return { value, prizeProbs, prizes, winDist: Ps => Array.from(winDist(Ps).slice(0, Ps.length + 1)) };
  }

  // ---------- avaliação ----------
  function lineupStats(md, set) {
    const K = md.objs.length;
    const S = md.offset.slice(), V = new Array(K).fill(0);
    set.forEach(p => { for (let k = 0; k < K; k++) { S[k] += md.mu[p][k]; V[k] += md.v[p][k]; } });
    return { S, V };
  }
  function winProb(md, S, V) {
    if (!md.objs.length) return 0;
    let P = 1;
    for (let k = 0; k < md.objs.length; k++) P *= probAtLeast(S[k], V[k], md.T[k]);
    return P;
  }
  function auxOf(md, S) {
    const K = md.objs.length; if (!K) return 0;
    let t = 0; for (let k = 0; k < K; k++) t += Math.min(S[k] / md.T[k], 1.5);
    return EPS_TOTAL * t / K;
  }
  function ceilingOf(md, S, V) { // percentil 90 normalizado pelo alvo
    let c = 0;
    for (let k = 0; k < md.objs.length; k++) c += (S[k] + Z90 * Math.sqrt(V[k])) / md.T[k];
    return md.objs.length ? c / md.objs.length : 0;
  }
  function rng(seed) { // mulberry32 — determinístico
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- otimizador da run ----------
  // fixed: Map(dayIndex -> array de jogadores) para dias já decididos (modo "tudo pelo dia")
  function optimize(model, opts) {
    opts = opts || {};
    const { days, P } = model;
    const D = days.length;
    const obj = makeObjective(model);
    const fixed = opts.fixed || new Map();
    const uses = model.uses.slice();
    const used = new Array(P).fill(0);
    let plan = days.map(() => new Set());
    const lockSets = days.map(md => new Set(md.locks));

    for (let d = 0; d < D; d++) {
      const base = fixed.has(d) ? fixed.get(d) : days[d].locks;
      base.forEach(p => { if (!plan[d].has(p) && plan[d].size < 5) { plan[d].add(p); used[p]++; } });
    }
    const frozen = d => fixed.has(d);
    const isLocked = (d, p) => frozen(d) || lockSets[d].has(p);
    const conflicts = [];
    for (let p = 0; p < P; p++) if (used[p] > uses[p]) conflicts.push({ player: model.players[p].id, used: used[p], uses: uses[p] });

    // inicialização gulosa: cada jogador vai para os dias onde pesa mais no alvo
    const cand = [];
    for (let d = 0; d < D; d++) {
      if (frozen(d)) continue;
      const md = days[d];
      md.elig.forEach(p => {
        let s = 0;
        for (let k = 0; k < md.objs.length; k++) s += md.mu[p][k] / md.T[k];
        cand.push([s / Math.max(1, md.objs.length), d, p]);
      });
    }
    cand.sort((a, b) => b[0] - a[0]);
    for (const [, d, p] of cand) {
      if (plan[d].size >= 5 || plan[d].has(p) || used[p] >= uses[p]) continue;
      plan[d].add(p); used[p]++;
    }

    let st = days.map((md, d) => lineupStats(md, plan[d]));
    const dayP = new Float64Array(D), aux = new Float64Array(D), tmpP = new Float64Array(D);
    for (let d = 0; d < D; d++) { dayP[d] = winProb(days[d], st[d].S, st[d].V); aux[d] = auxOf(days[d], st[d].S); }
    let auxSum = aux.reduce((a, b) => a + b, 0);
    let cur = obj.value(dayP) + auxSum;

    function evalChanges(ch) { // ch: [[d, p, x], ...]
      tmpP.set(dayP); let a = auxSum;
      for (const [d, p, x] of ch) { tmpP[d] = p; a += x - aux[d]; }
      return obj.value(tmpP) + a;
    }
    function tryReplace(d, a, b) { // a = -1 vaga vazia
      const md = days[d], K = md.objs.length;
      const S = st[d].S.slice(), V = st[d].V.slice();
      for (let k = 0; k < K; k++) {
        if (a >= 0) { S[k] -= md.mu[a][k]; V[k] -= md.v[a][k]; }
        if (b >= 0) { S[k] += md.mu[b][k]; V[k] += md.v[b][k]; }
      }
      return { d, S, V, p: winProb(md, S, V), x: auxOf(md, S) };
    }
    function commit(r) { st[r.d] = { S: r.S, V: r.V }; auxSum += r.x - aux[r.d]; aux[r.d] = r.x; dayP[r.d] = r.p; }
    const free = p => used[p] < uses[p];

    const openDays = [];
    for (let d = 0; d < D; d++) if (!frozen(d) && days[d].elig.length) openDays.push(d);
    const snapshot = () => ({ plan: plan.map(s => new Set(s)), used: used.slice(), st: st.map(x => ({ S: x.S.slice(), V: x.V.slice() })), dayP: dayP.slice(), aux: aux.slice(), auxSum, cur });
    const restore = s => { plan = s.plan.map(x => new Set(x)); for (let p = 0; p < P; p++) used[p] = s.used[p]; st = s.st.map(x => ({ S: x.S.slice(), V: x.V.slice() })); dayP.set(s.dayP); aux.set(s.aux); auxSum = s.auxSum; cur = s.cur; };

    function hillClimb() {
      for (let round = 0; round < 300; round++) {
        let best = null, bestDv = 1e-10;
        for (const d of openDays) {
          const md = days[d];
          const members = [...plan[d]].filter(p => !isLocked(d, p));
          const slots = plan[d].size < 5 ? members.concat([-1]) : members;
          for (const a of slots) for (const b of md.elig) {
            if (plan[d].has(b) || !free(b)) continue;
            const r = tryReplace(d, a, b);
            const dv = evalChanges([[d, r.p, r.x]]) - cur;
            if (dv > bestDv) { bestDv = dv; best = ['r', d, a, b, r]; }
          }
        }
        for (let i = 0; i < openDays.length; i++) for (let j = i + 1; j < openDays.length; j++) {
          const d1 = openDays[i], d2 = openDays[j];
          for (const a of plan[d1]) {
            if (isLocked(d1, a) || !days[d2].eligSet.has(a) || plan[d2].has(a)) continue;
            for (const b of plan[d2]) {
              if (isLocked(d2, b) || !days[d1].eligSet.has(b) || plan[d1].has(b)) continue;
              const r1 = tryReplace(d1, a, b), r2 = tryReplace(d2, b, a);
              const dv = evalChanges([[d1, r1.p, r1.x], [d2, r2.p, r2.x]]) - cur;
              if (dv > bestDv) { bestDv = dv; best = ['s', d1, d2, a, b, r1, r2]; }
            }
          }
        }
        if (!best) return;
        if (best[0] === 'r') {
          const [, d, a, b, r] = best;
          if (a >= 0) { plan[d].delete(a); used[a]--; }
          plan[d].add(b); used[b]++; commit(r);
        } else {
          const [, d1, d2, a, b, r1, r2] = best;
          plan[d1].delete(a); plan[d1].add(b); plan[d2].delete(b); plan[d2].add(a); commit(r1); commit(r2);
        }
        cur = obj.value(dayP) + auxSum;
      }
    }

    if (openDays.length) {
      const start = snapshot();
      let best = null;
      const iters = opts.iters || Math.min(50000, 4000 + openDays.length * 3500);
      for (let restart = 0; restart < (opts.restarts || 3); restart++) {
        restore(start);
        const rand = rng(1234 + restart * 7919);
        const pick = arr => arr[Math.floor(rand() * arr.length)];
        for (let it = 0; it < iters; it++) {
          const temp = 0.05 * Math.pow(0.0005 / 0.05, it / iters);
          if (rand() < 0.55 || openDays.length < 2) {
            const d = pick(openDays), md = days[d];
            const members = [...plan[d]].filter(p => !isLocked(d, p));
            const canAdd = plan[d].size < 5;
            let a;
            if (canAdd && (rand() < 0.5 || !members.length)) a = -1;
            else if (members.length) a = pick(members);
            else continue;
            const b = pick(md.elig);
            if (plan[d].has(b) || !free(b)) continue;
            const r = tryReplace(d, a, b);
            const nv = evalChanges([[d, r.p, r.x]]), dv = nv - cur;
            if (dv > 0 || rand() < Math.exp(dv / temp)) {
              if (a >= 0) { plan[d].delete(a); used[a]--; }
              plan[d].add(b); used[b]++; commit(r); cur = nv;
            }
          } else {
            const d1 = pick(openDays), d2 = pick(openDays);
            if (d1 === d2) continue;
            const m1 = [...plan[d1]].filter(p => !isLocked(d1, p)), m2 = [...plan[d2]].filter(p => !isLocked(d2, p));
            if (!m1.length || !m2.length) continue;
            const a = pick(m1), b = pick(m2);
            if (a === b || !days[d2].eligSet.has(a) || !days[d1].eligSet.has(b) || plan[d2].has(a) || plan[d1].has(b)) continue;
            const r1 = tryReplace(d1, a, b), r2 = tryReplace(d2, b, a);
            const nv = evalChanges([[d1, r1.p, r1.x], [d2, r2.p, r2.x]]), dv = nv - cur;
            if (dv > 0 || rand() < Math.exp(dv / temp)) {
              plan[d1].delete(a); plan[d1].add(b); plan[d2].delete(b); plan[d2].add(a); commit(r1); commit(r2); cur = nv;
            }
          }
        }
        hillClimb();
        if (!best || cur > best.cur + 1e-12) best = snapshot();
      }
      restore(best);
    }
    return summarize(model, plan, used, conflicts, obj, dayP, cur);
  }

  function summarize(model, plan, used, conflicts, obj, dayP, cur) {
    const out = model.days.map((md, d) => {
      const lineup = [...plan[d]].sort((a, b) => {
        const sa = md.objs.reduce((s, _, k) => s + md.mu[a][k] / md.T[k], 0);
        const sb = md.objs.reduce((s, _, k) => s + md.mu[b][k] / md.T[k], 0);
        return sb - sa;
      });
      const { S, V } = lineupStats(md, plan[d]);
      const ids = lineup.map(p => model.players[p].id);
      const res = {
        date: md.day.date, idx: md.day.idx,
        lineup: ids, lineupIdx: lineup,
        P: winProb(md, S, V),
        totals: md.objs.map((o, k) => ({ stat: o.stat, target: md.T[k], mu: S[k], sd: Math.sqrt(V[k]), known: md.offset[k] })),
        ceiling: ceilingOf(md, S, V),
        eligible: md.elig.length,
        noObjective: !md.objs.length,
        badLocks: md.badLocks,
        hasOdds: Object.keys(md.oddsDay || {}).length > 0,
      };
      if (md.live) {
        const sub = md.live.submitted;
        res.live = {
          submitted: sub,
          locked: md.live.liveLocks,
          out: sub.filter(id => !ids.includes(id)),
          in: ids.filter(id => !sub.includes(id)),
          startedTeams: md.live.startedTeams,
        };
      }
      return res;
    });
    const usage = {};
    model.players.forEach((p, i) => { usage[p.id] = used[i]; });
    const Ps = Float64Array.from(out.map(d => d.P));
    return {
      days: out, expected: out.reduce((a, d) => a + d.P, 0), usage, conflicts,
      objective: cur != null ? cur : obj.value(Ps),
      prizeProbs: obj.prizeProbs(Ps),
      winDist: obj.winDist(Ps),
    };
  }

  // Melhor lineup para um só dia, a maximizar o teto (percentil 90) do total
  function bestSingleDay(model, d) {
    const md = model.days[d];
    const locks = md.locks.filter(p => md.eligSet.has(p));
    const pool = md.elig.filter(p => model.uses[p] > 0 && !locks.includes(p));
    const need = Math.max(0, Math.min(5, locks.length + pool.length) - locks.length);
    let best = null, bestScore = -Infinity;
    const score = set => { const { S, V } = lineupStats(md, set); return ceilingOf(md, S, V) + 0.05 * winProb(md, S, V); };
    const n = pool.length;
    if (choose(n, need) <= 400000) {
      const idx = [];
      (function rec(start, depth) {
        if (depth === need) {
          const set = new Set(locks.concat(idx.map(i => pool[i])));
          const s = score(set);
          if (s > bestScore) { bestScore = s; best = set; }
          return;
        }
        for (let i = start; i <= n - (need - depth); i++) { idx.push(i); rec(i + 1, depth + 1); idx.pop(); }
      })(0, 0);
    } else {
      const set = new Set(locks);
      while (set.size < locks.length + need) {
        let bp = -1, bs = -Infinity;
        for (const p of pool) { if (set.has(p)) continue; set.add(p); const s = score(set); set.delete(p); if (s > bs) { bs = s; bp = p; } }
        set.add(bp);
      }
      best = set;
    }
    return [...(best || new Set(locks))];
  }
  function choose(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }

  // Plano normal e plano "tudo pelo próximo dia", para comparar o custo
  function planRun(run, roster, odds, planDoc, opts) {
    const model = buildModel(run, roster, odds, planDoc, opts);
    let normal = optimize(model, opts);
    let allIn = null;
    if (model.days.length) {
      const lineup0 = bestSingleDay(model, 0);
      allIn = optimize(model, Object.assign({}, opts, { fixed: new Map([[0, lineup0]]) }));
      // o plano "tudo pelo dia" também é válido para a run: se for melhor, passa a ser o plano da run
      if (allIn.objective > normal.objective + 1e-9) normal = allIn;
    }
    const playedDays = model.allDays.filter(d => model.played[d.date] && model.played[d.date].done);
    const wins = playedDays.filter(d => model.played[d.date].result === 'win').length;
    const losses = playedDays.length - wins;
    return { model, normal, allIn, wins, losses, playedCount: playedDays.length, prizes: model.prizes };
  }

  const api = { STATS, STATUS, QREM, normCdf, invNorm, poissonTail, impliedProb, devig, solveNormal, solvePoisson, playerDist, probAtLeast, buildModel, makeObjective, optimize, bestSingleDay, planRun, teamsOn, gameOf, tipTime };
  root.FB = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
