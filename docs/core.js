/* Fastbreak run planner — motor de cálculo (funções puras, sem DOM).
   Usado pela app no browser e pelos testes em Node. */
(function (root) {
  'use strict';

  // Parte dos pontos de 2 que são na área: alta para quem quase não lança de 3, mais baixa para atiradores
  function paintShare(a) {
    const fga = +((a || {}).fga), f3a = +((a || {}).fg3a);
    const r = fga > 0 && f3a >= 0 ? f3a / fga : 0.35;
    return Math.max(0.55, Math.min(0.97, 0.97 - 0.55 * r));
  }
  const num = x => x != null && x !== '' && isFinite(+x) ? +x : null;
  // k = dispersão (variância ≈ k × média); kind = modelo para converter linhas em médias
  // proxy = estatísticas com odds que servem para esta (média da proxy nas odds × proporção nas médias do jogador)
  // est = estimativa a partir de outras médias, quando falta a média desta
  const STATS = {
    pts: { label: 'Pontos', short: 'PTS', k: 2.0, kind: 'normal' },
    reb: { label: 'Ressaltos', short: 'REB', k: 1.3, kind: 'normal' },
    ast: { label: 'Assistências', short: 'AST', k: 1.3, kind: 'normal' },
    fg3: { label: 'Triplos', short: '3PM', k: 1.15, kind: 'poisson' },
    stl: { label: 'Roubos de bola', short: 'STL', k: 1.0, kind: 'poisson' },
    blk: { label: 'Desarmes', short: 'BLK', k: 1.1, kind: 'poisson' },
    tov: { label: 'Perdas de bola', short: 'TOV', k: 1.0, kind: 'poisson',
      est: a => num(a.pts) != null ? 0.4 + 0.05 * a.pts + 0.15 * (num(a.ast) || 0) : null },
    oreb: { label: 'Ressaltos ofensivos', short: 'OREB', k: 1.2, kind: 'poisson', proxy: ['reb'],
      est: a => num(a.reb) == null ? null : num(a.dreb) != null ? Math.max(0, a.reb - a.dreb) : 0.25 * a.reb },
    dreb: { label: 'Ressaltos defensivos', short: 'DREB', k: 1.2, kind: 'normal', proxy: ['reb'],
      est: a => num(a.reb) == null ? null : num(a.oreb) != null ? Math.max(0, a.reb - a.oreb) : 0.75 * a.reb },
    fgm: { label: 'Lançamentos de campo marcados', short: 'FGM', k: 1.0, kind: 'normal', proxy: ['pts'],
      est: a => num(a.pts) != null ? 0.37 * a.pts : null },
    fga: { label: 'Lançamentos de campo tentados', short: 'FGA', k: 1.1, kind: 'normal', proxy: ['fgm', 'pts'],
      est: a => num(a.fgm) != null ? a.fgm / 0.46 : num(a.pts) != null ? 0.8 * a.pts : null },
    fg3a: { label: 'Triplos tentados', short: '3PA', k: 1.2, kind: 'normal', proxy: ['fg3'],
      est: a => num(a.fg3) != null ? a.fg3 / 0.36 : null },
    ftm: { label: 'Lances livres marcados', short: 'FTM', k: 1.3, kind: 'poisson', proxy: ['fta', 'pts'],
      est: a => num(a.fta) != null ? 0.78 * a.fta : num(a.pts) != null ? 0.15 * a.pts : null },
    fta: { label: 'Lances livres tentados', short: 'FTA', k: 1.3, kind: 'poisson', proxy: ['ftm', 'pts'],
      est: a => num(a.ftm) != null ? a.ftm / 0.78 : num(a.pts) != null ? 0.19 * a.pts : null },
    // a ESPN não dá pontos na área por jogador: estimam-se a partir dos lançamentos de 2 marcados
    pip: { label: 'Pontos na área', short: 'PIP', k: 2.4, kind: 'normal', proxy: ['pts'],
      est: a => num(a.fgm) != null ? 2 * Math.max(0, a.fgm - (num(a.fg3) || 0)) * paintShare(a) : num(a.pts) != null ? 0.42 * a.pts : null },
  };
  // "ast-tov" → [{s:'ast', sign:1}, {s:'tov', sign:-1}]; "pts+reb" → dois termos positivos
  function statTerms(key) {
    const out = [], re = /([+-]?)\s*([a-z0-9]+)/gi; let m;
    while ((m = re.exec(String(key || '')))) out.push({ s: m[2].toLowerCase(), sign: m[1] === '-' ? -1 : 1 });
    return out;
  }
  // Valor de uma estatística (simples ou combinada) a partir das estatísticas de um jogo
  function statValue(vals, key, avg) {
    vals = vals || {};
    if (num(vals[key]) != null) return +vals[key];
    let t = 0;
    for (const { s, sign } of statTerms(key)) {
      let x = num(vals[s]);
      if (x == null && s === 'pip' && num(vals.fgm) != null) x = 2 * Math.max(0, vals.fgm - (num(vals.fg3) || 0)) * paintShare(avg || vals);
      if (x == null && s === 'dreb' && num(vals.reb) != null) x = Math.max(0, vals.reb - (num(vals.oreb) || 0));
      t += sign * (x || 0);
    }
    return t;
  }
  // Forma: as médias da época misturadas com as dos últimos 10 e 5 jogos (avg.form = {n10, n5, l10, l5}).
  // Peso normal: época 50%, últimos 10 30%, últimos 5 20% (com menos jogos, a forma pesa menos). 0 = só a época.
  let FORM_K = 1;
  function setForm(k) { FORM_K = Math.max(0, Math.min(1.6, +k || 0)); formCache = new WeakMap(); }
  let formCache = new WeakMap();
  function formAvg(a) {
    if (!a || !a.form || !FORM_K) return a;
    if (formCache.has(a)) return formCache.get(a);
    const f = a.form, w10 = 0.3 * FORM_K * Math.min(1, (f.n10 || 0) / 10), w5 = 0.2 * FORM_K * Math.min(1, (f.n5 || 0) / 5);
    const out = {};
    Object.keys(a).forEach(k => { if (k !== 'form') out[k] = a[k]; });
    const keys = new Set(Object.keys(f.l10 || {}).concat(Object.keys(f.l5 || {})));
    keys.forEach(k => {
      const se = num(a[k]), t = num((f.l10 || {})[k]), c = num((f.l5 || {})[k]);
      if (se == null) { if (t != null || c != null) out[k] = t != null && c != null ? 0.6 * t + 0.4 * c : (t != null ? t : c); return; } // sem média da época: só a forma
      let v = se;
      if (t != null) { v += w10 * (t - se); }
      if (c != null) { v += w5 * (c - se); }
      out[k] = Math.max(0, v);
    });
    formCache.set(a, out);
    return out;
  }
  // Média do jogador para uma estatística (já com a forma); se faltar, estimativa a partir das outras médias
  function avgOf(player, s) {
    const a = formAvg(player && player.avg); if (!a) return null;
    if (num(a[s]) != null) return { v: +a[s], est: false };
    const st = STATS[s] || {};
    const e = st.est ? st.est(a) : null;
    return e != null && isFinite(e) ? { v: Math.max(0, e), est: true } : null;
  }
  // Para mostrar: época, últimos 10, últimos 5 e o valor usado (estatística simples ou combinada)
  function formInfo(player, statKey) {
    const a = player && player.avg; if (!a) return null;
    const f = a.form || null, val = (src, k) => { const x = src ? num(src[k]) : null; return x; };
    const sum = src => { let t = 0, any = false; for (const { s, sign } of statTerms(statKey)) { let x = val(src, s); if (x == null && src && STATS[s] && STATS[s].est && src === a) x = STATS[s].est(a); if (x == null) return null; t += sign * x; any = true; } return any ? t : null; };
    const season = sum(a), l10 = f ? sum(f.l10) : null, l5 = f ? sum(f.l5) : null;
    let used = 0, ok = true; for (const { s, sign } of statTerms(statKey)) { const x = avgOf(player, s); if (!x) { ok = false; break; } used += sign * x.v; }
    return { season, l10, l5, n10: f ? f.n10 : 0, n5: f ? f.n5 : 0, used: ok ? used : null, trend: season && l5 != null && f.n5 >= 3 ? (l5 - season) / Math.max(1, Math.abs(season)) : 0 };
  }
  const STATUS = {
    ok: { label: 'Disponível', play: 1 },
    prov: { label: 'Provável', play: 0.9 },
    duv: { label: 'Dúvida', play: 0.5 },
    dout: { label: 'Pouco provável', play: 0.25 },
    fora: { label: 'Fora', play: 0 },
  };
  // ---------- lesões (relatório da ESPN, tabela injuries) ----------
  // estados do relatório: out, ofs (fora da época), doubtful, questionable, dtd (dia a dia), probable
  const INJ_LABEL = { out: 'Fora', ofs: 'Fora da época', doubtful: 'Pouco provável', questionable: 'Dúvida', dtd: 'Dia a dia', probable: 'Provável' };
  const dayDiff = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);
  // Estado no plano para o k-ésimo jogo que falta ao jogador (k = 0: o próximo jogo dele). O relatório fala do
  // próximo jogo; nos seguintes conta a data prevista de regresso (Fora) ou volta ao normal aos poucos.
  function injuryOn(rec, date, k, now) {
    if (!rec || k == null || k < 0) return null;
    if (rec.updated_at && now != null && now - Date.parse(rec.updated_at) > 3 * 86400e3) return null; // relatório parado há dias: não conta
    const R = rec.return_date || null, s = rec.status;
    if (s === 'ofs') return 'fora';
    if (s === 'out') {
      if (k === 0) return 'fora';
      if (R) { const g = dayDiff(R, date); return g < 0 ? 'fora' : g < 3 ? 'duv' : 'prov'; }
      return k <= 2 ? 'dout' : k <= 4 ? 'duv' : 'prov';
    }
    if (s === 'doubtful') return k === 0 ? 'dout' : k === 1 ? 'duv' : k === 2 ? 'prov' : null;
    if (s === 'questionable' || s === 'dtd') return k === 0 ? 'duv' : k === 1 ? 'prov' : null;
    if (s === 'probable') return k === 0 ? 'prov' : null;
    return null;
  }
  const worse = (a, b) => ((STATUS[b] || STATUS.ok).play < (STATUS[a] || STATUS.ok).play ? b : a);
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
  const hasLine = o => !!o && o.line != null && o.line !== '' && isFinite(+o.line);
  // Regularidade: dispersão (variância ÷ média por jogo) de cada jogador na época passada (avg.hist), puxada para a
  // da estatística quando há poucos jogos. Quem varia muito tem mais hipóteses de um jogo grande e de um jogo vazio.
  function kOf(player, s) {
    const st = STATS[s], h = player && player.avg && player.avg.hist;
    if (!st || !h || !h.d || num(h.d[s]) == null || !(h.n >= 15)) return st ? st.k : 1;
    const k = (h.n * +h.d[s] + 20 * st.k) / (h.n + 20);
    return clamp(k, 0.6 * st.k, 2 * st.k);
  }
  // Jogos seguidos (back-to-back): no 2.º jogo rende-se um pouco menos (−3%). Com 6+ jogos assim na época passada,
  // conta o que esse jogador fez (puxado para os −3%). Só mexe nas médias: as odds já contam com isto.
  const B2B_DEFAULT = 0.97;
  function b2bFactor(player, statKey) {
    const h = player && player.avg && player.avg.hist, b = h && h.b2b;
    let t = 0, base = 0;
    for (const { s, sign } of statTerms(statKey)) {
      const a = avgOf(player, s), w = a ? a.v : 1;
      let f = B2B_DEFAULT;
      if (b && b.n >= 6 && b.r && num(b.r[s]) != null) { const sh = b.n / (b.n + 10); f = clamp(B2B_DEFAULT + sh * (+b.r[s] - B2B_DEFAULT), 0.85, 1.08); }
      t += sign * w * f; base += sign * w;
    }
    return base > 0 ? clamp(t / base, 0.85, 1.08) : B2B_DEFAULT;
  }
  function oddsMean(st, o, k) {
    const line = +o.line, pOver = devig(o.over, o.under);
    return { mu: st.kind === 'normal' ? solveNormal(line, pOver, k != null ? k : st.k) : solvePoisson(line, pOver), line, pOver };
  }
  // Adversário: o que concede por jogo (últimos 10) a dividir pela média da liga. teams = {BOS: {n, allowed}, NBA: {allowed}}
  function matchup(teams, opp, statKey) {
    const t = teams && opp && teams[opp], lg = teams && teams.NBA;
    if (!t || !lg || !t.allowed || !lg.allowed || (t.n || 0) < 5) return null;
    let a = 0, b = 0;
    for (const { s, sign } of statTerms(statKey)) { const x = num(t.allowed[s]), y = num(lg.allowed[s]); if (x == null || y == null) return null; a += sign * x; b += sign * y; }
    if (!(b > 0)) return null;
    const f = a / b;
    return { f, used: Math.max(0.9, Math.min(1.1, 1 + 0.5 * (f - 1))) }; // nas médias conta metade, no máximo ±10%
  }
  // src: 'odds' (linha desta estatística), 'proxy' (linha de outra × proporção nas médias), 'media', 'estimativa', 'sem'
  function rawStat(player, s, oddsP, mf) {
    const st = STATS[s];
    if (!st) return { mu: 0, v: 0, src: 'sem' };
    const o = oddsP && oddsP[s];
    let mu = 0, src = 'sem', line = null, pOver = null, via = null;
    const kp = kOf(player, s);
    if (hasLine(o)) { ({ mu, line, pOver } = oddsMean(st, o, kp)); src = 'odds'; }
    else {
      const a = avgOf(player, s);
      for (const q of st.proxy || []) {
        const oq = oddsP && oddsP[q], aq = avgOf(player, q);
        if (!hasLine(oq) || !a || !aq || !(aq.v > 0)) continue;
        const m = oddsMean(STATS[q], oq, kOf(player, q));
        mu = m.mu * a.v / aq.v; line = m.line; pOver = m.pOver; via = q; src = 'proxy';
        break;
      }
      if (src === 'sem' && a) { mu = a.v * (mf ? mf(s) : 1); src = a.est ? 'estimativa' : 'media'; } // sem odds: ajusta ao adversário
    }
    const k = kp * (src === 'proxy' || src === 'estimativa' ? 1.15 : 1); // menos certeza
    return { mu, v: Math.max(k * mu, mu > 0 ? 0.05 : 0), src, line, pOver, via };
  }
  function statusFor(player, oddsP) { return (oddsP && oddsP.status) || player.status || 'ok'; }

  function playerDist(player, statKey, oddsP, mf, stOverride) {
    const terms = statTerms(statKey);
    const raws = terms.map(t => rawStat(player, t.s, oddsP, mf));
    let mu = 0, v = 0;
    raws.forEach((r, i) => { mu += terms[i].sign * r.mu; v += r.v; });
    for (let i = 0; i < raws.length; i++) for (let j = i + 1; j < raws.length; j++) v += 2 * COMBO_RHO * terms[i].sign * terms[j].sign * Math.sqrt(raws[i].v * raws[j].v);
    v = Math.max(v, raws.some(r => r.v > 0) ? 0.05 : 0);
    const srcs = raws.map(r => r.src);
    const src = srcs.length === 1 ? srcs[0] : srcs.every(x => x === 'odds') ? 'odds' : srcs.some(x => x === 'odds' || x === 'proxy') ? 'misto'
      : srcs.every(x => x === 'sem') ? 'sem' : srcs.some(x => x === 'estimativa') ? 'estimativa' : 'media';
    const status = stOverride || statusFor(player, oddsP);
    const pp = (STATUS[status] || STATUS.ok).play;
    const mu2 = pp * mu;
    const v2 = Math.max(0, pp * (v + mu * mu) - mu2 * mu2);
    const one = raws.length === 1 ? raws[0] : {};
    return { mu: mu2, v: v2, muIf: mu, vIf: v, src, status, pPlay: pp, line: one.line != null ? one.line : null, pOver: one.pOver != null ? one.pOver : null, via: one.via || null, parts: raws.map((r, i) => ({ stat: terms[i].s, sign: terms[i].sign, mu: r.mu, src: r.src, line: r.line, via: r.via })) };
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
    const keep = plan.keep || {}; // lineup mantido de propósito (ao tirar um cadeado): fica como estava, sem cadeados
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
    // lesões: para cada jogador com aviso, que jogo dele (0 = o próximo) é cada dia que falta
    const injuries = opts.injuries || null;
    const todayEt = new Date(now - 5 * 3600e3).toISOString().slice(0, 10);
    const injK = injuries ? players.map(p => {
      if (!injuries[p.id] || p.injIgnore) return null;
      const ks = new Array(open.length).fill(null); let k = 0;
      open.forEach((day, di) => {
        if (!teamsOn(day).has(p.team)) return;
        const tt = tipTime(day, p.team);
        if (tt != null ? tt <= now : day.date < todayEt) return; // jogo que já começou ou já passou
        ks[di] = k++;
      });
      return ks;
    }) : null;

    // equipas que jogaram na véspera de cada dia (dias da run e, fora deles, opts.prevGames = {data: [equipas]})
    const playedOn = new Map();
    allDays.forEach(d => playedOn.set(d.date, teamsOn(d)));
    Object.entries(opts.prevGames || {}).forEach(([dt, ts]) => { if (!playedOn.has(dt) || !playedOn.get(dt).size) playedOn.set(dt, new Set(ts)); });
    const prevDate = dt => { const x = new Date(dt + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
    const days = open.map((day, di) => {
      const teams = teamsOn(day);
      const yday = opts.b2b === false ? new Set() : (playedOn.get(prevDate(day.date)) || new Set());
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
        const g = gameOf(day, p.team), opp = g ? (g[0] === p.team ? g[1] : g[0]) : null;
        const b2b = !!g && yday.has(p.team);
        const mf0 = opts.teams && opp ? (s => { const m = matchup(opts.teams, opp, s); return m ? m.used : 1; }) : null;
        const mf = b2b ? (s => (mf0 ? mf0(s) : 1) * b2bFactor(p, s)) : mf0;
        const injSt = injK && injK[pi] ? injuryOn(injuries[p.id], day.date, injK[pi][di], now) : null;
        const status = injSt ? worse(statusFor(p, oddsP), injSt) : statusFor(p, oddsP);
        const dists = objs.map(o => playerDist(p, o.stat, oddsP, mf, status));
        if (injuries && injuries[p.id]) { const inj = { rec: injuries[p.id], status: injSt, k: injK && injK[pi] ? injK[pi][di] : null, ignored: !!p.injIgnore }; dists.forEach(x => { x.injury = inj; }); }
        if (b2b) dists.forEach((x, k) => { x.b2b = { f: b2bFactor(p, objs[k].stat) }; });
        mu[pi] = dists.map(x => x.mu);
        v[pi] = dists.map(x => x.v);
        info[pi] = dists;
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
          const knownK = objs.map(o => statValue(vals, o.stat, p.avg));
          objs.forEach((o, k) => {
            const known = knownK[k];
            if (state === 'fim') { offset[k] += known; mu[pi][k] = 0; v[pi][k] = 0; }
            else if (state === 'jogo') { const r = QREM[e.q] != null ? QREM[e.q] : 0.5; offset[k] += known; mu[pi][k] *= r; v[pi][k] *= r; }
          });
          info[pi] = dists.map((x, k) => Object.assign({}, x, { liveState: state, known: state === 'jogo?' ? 0 : knownK[k], q: e.q || null, muLeft: mu[pi][k] }));
          elig.push(pi); liveLocks.push(pi);
          return;
        }
        const onDate = !p.availDates || p.availDates.includes(day.date); // Moment emprestado: só nos dias combinados
        if (plays && avail && onDate && !banned.has(p.id) && !banAll.has(p.id) && K) elig.push(pi);
      });
      // os jogadores presos contam como "fixados" e não somam ao offset duas vezes (mu já é só o que falta)
      const eligSet = new Set(elig);
      const size = Math.max(1, Math.min(10, Math.round(+day.numPlayers) || 5)); // jogadores por lineup (5 no Classic)
      const lockAll = (locks[day.date] || []).map(id => pIndex.get(id)).filter(i => i != null);
      const keepIdx = (keep[day.date] || []).map(id => pIndex.get(id)).filter(i => i != null && eligSet.has(i));
      const lockIdx = Array.from(new Set(liveLocks.concat(lockAll.filter(i => eligSet.has(i))).concat(keepIdx))).slice(0, size);
      const kept = new Set(keepIdx.filter(i => !liveLocks.includes(i) && !lockAll.includes(i)));
      const badLocks = lockAll.filter(i => !eligSet.has(i)).map(i => players[i].id);
      return {
        day, objs, T: objs.map(o => +o.target), size, mu, v, info, elig, eligSet, locks: lockIdx, kept, badLocks, teams, oddsDay, offset,
        perPlayer: objs.some(o => o.each), // objetivo que cada jogador tem de cumprir sozinho (o plano trata-o como total)
        live: live ? { submitted, startedTeams: [...startedTeams], liveLocks: liveLocks.map(i => players[i].id) } : null,
      };
    });
    const uses = players.map(p => Math.max(0, Math.floor(+p.uses || 0)));
    // nunca mais dias fixados do que usos: ficam os que já começaram, depois o cadeado posto há menos tempo
    // (plan.lockAt[data|id]) e depois os dias mais perto; os outros cadeados não contam (droppedLocks)
    const lockAt = plan.lockAt || {}, droppedLocks = [];
    players.forEach((p, pi) => {
      const on = []; days.forEach((md, d) => { if (md.locks.includes(pi)) on.push(d); });
      if (on.length <= uses[pi]) return;
      const live = d => (days[d].live && days[d].live.liveLocks.includes(p.id) ? 1 : 0), at = d => +lockAt[days[d].day.date + '|' + p.id] || 0;
      const soft = d => (days[d].kept.has(pi) ? 1 : 0); // lineup mantido: sai primeiro, sem aviso
      on.sort((a, b) => (live(b) - live(a)) || (soft(a) - soft(b)) || (at(b) - at(a)) || (a - b));
      on.slice(uses[pi]).forEach(d => { if (live(d)) return; days[d].locks = days[d].locks.filter(x => x !== pi); if (!soft(d)) droppedLocks.push({ player: p.id, date: days[d].day.date }); });
    });
    const prizes = (run.prizes || []).map(p => ({ wins: Math.round(+p.wins), value: +p.value > 0 ? +p.value : 1, label: p.label || '' })).filter(p => p.wins > 0).sort((a, b) => a.wins - b.wins);
    return { players, pIndex, allDays, days, uses, played, D: days.length, P: players.length, prizes, winsSoFar, now, droppedLocks };
  }

  // ---------- objetivo da run ----------
  function makeObjective(model, epsWins) {
    const EPSW = epsWins != null ? epsWins : EPS_WINS;
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
      return v / totalW + EPSW * ew;
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
    const uses = (opts.uses || model.uses).slice();
    const used = new Array(P).fill(0);
    let plan = days.map(() => new Set());
    const lockSets = days.map(md => new Set(md.locks));

    // primeiro os cadeados (o modelo já os limita aos usos), depois os dias decididos, só com usos que sobram
    for (let d = 0; d < D; d++) if (!fixed.has(d)) days[d].locks.forEach(p => { if (!plan[d].has(p) && plan[d].size < days[d].size) { plan[d].add(p); used[p]++; } });
    for (const [d, base] of fixed) if (d < D) base.forEach(p => { if (!plan[d].has(p) && plan[d].size < days[d].size && used[p] < uses[p]) { plan[d].add(p); used[p]++; } });
    const frozen = d => fixed.has(d);
    const isLocked = (d, p) => frozen(d) || lockSets[d].has(p);
    const conflicts = [];
    for (let p = 0; p < P; p++) if (used[p] > uses[p]) conflicts.push({ player: model.players[p].id, used: used[p], uses: uses[p] });

    // ponto de partida dado (lineups por dia, índices no model): entra primeiro, o resto completa-se à gulosa
    if (opts.init) opts.init.forEach((L, d) => { if (d >= D || frozen(d)) return; (L || []).forEach(p => { if (plan[d].size < days[d].size && !plan[d].has(p) && days[d].eligSet.has(p) && used[p] < uses[p]) { plan[d].add(p); used[p]++; } }); });
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
      if (plan[d].size >= days[d].size || plan[d].has(p) || used[p] >= uses[p]) continue;
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
          const slots = plan[d].size < md.size ? members.concat([-1]) : members;
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

    if (openDays.length && opts.local) hillClimb(); // só melhorias simples a partir do ponto de partida (rápido)
    else if (openDays.length) {
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
            const canAdd = plan[d].size < md.size;
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
        totals: md.objs.map((o, k) => ({ stat: o.stat, each: !!o.each, target: md.T[k], mu: S[k], sd: Math.sqrt(V[k]), known: md.offset[k] })),
        ceiling: ceilingOf(md, S, V),
        eligible: md.elig.length,
        noObjective: !md.objs.length,
        size: md.size, perPlayer: md.perPlayer,
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
    const need = Math.max(0, Math.min(md.size, locks.length + pool.length) - locks.length);
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

  // Alternativas para o próximo dia: "tudo pelo dia" e "guardar" cada um dos 3 jogadores que mais pesam no lineup
  // sugerido (sem ele hoje). Devolve as sementes; quem chama refaz o plano da run para cada uma.
  function alternativeSeeds(model, normal) {
    const md = model.days[0], d0 = normal && normal.days[0];
    if (!md || !d0 || !d0.lineupIdx.length || !md.objs.length) return [];
    const out = [{ kind: 'allin', lineupIdx: bestSingleDay(model, 0) }];
    const locked = new Set(md.locks);
    const weight = p => md.objs.reduce((t, _, k) => t + md.mu[p][k] / md.T[k], 0);
    d0.lineupIdx.filter(p => !locked.has(p)).sort((x, y) => weight(y) - weight(x)).slice(0, 3).forEach(p => out.push({ kind: 'save', player: p }));
    return out;
  }

  // Compras: pré-seleção rápida antes de refazer a run para cada candidato. model = buildModel com o plantel e os
  // candidatos; normal = plano atual (os mesmos ids); cands = índices no model; U = usos do Moment a comprar.
  // Ganho aproximado = soma, nos U melhores dias, da subida da vitória nesse dia (entra no lugar de quem pesa
  // menos) × quanto esse dia pesa nos prémios da run.
  function buyScreen(model, normal, cands, U) {
    const obj = makeObjective(model);
    const byDate = new Map(normal.days.map(d => [d.date, d]));
    const Ps = Float64Array.from(model.days.map(md => { const d = byDate.get(md.day.date); return d ? d.P : 0; }));
    const base = obj.value(Ps);
    const sens = model.days.map((md, d) => { const x = Ps[d], y = Math.min(1, x + 0.02); if (y <= x) return 0; Ps[d] = y; const up = obj.value(Ps); Ps[d] = x; return (up - base) / (y - x); });
    const lineups = model.days.map(md => { const d = byDate.get(md.day.date); return d ? d.lineup.map(id => model.pIndex.get(id)).filter(i => i != null) : []; });
    return cands.map(c => {
      const days = [];
      model.days.forEach((md, d) => {
        if (!md.eligSet.has(c) || !md.objs.length) return;
        const L = lineups[d]; if (L.includes(c)) return;
        let best = 0, out = null;
        for (const m of (L.length < md.size ? [-1] : []).concat(L)) {
          if (m >= 0 && md.locks.includes(m)) continue;
          const { S, V } = lineupStats(md, L.filter(x => x !== m).concat([c]));
          const dp = winProb(md, S, V) - Ps[d];
          if (dp > best) { best = dp; out = m; }
        }
        if (best > 1e-4) days.push({ d, date: md.day.date, dP: best, P0: Ps[d], P1: Ps[d] + best, out: out != null && out >= 0 ? model.players[out].id : null, g: best * sens[d] });
      });
      days.sort((a, b) => b.g - a.g);
      const top = days.slice(0, Math.max(1, U));
      return { p: c, id: model.players[c].id, score: top.reduce((t, x) => t + x.g, 0), days: top };
    }).sort((a, b) => b.score - a.score);
  }

  // Compras, 2.ª peneira: para cada candidato, a run refeita só com melhorias simples a partir do plano atual (trocar
  // um jogador num dia, trocar dois entre dias), o que já apanha os usos que ele liberta a outros jogadores.
  // model = buildModel com o plantel e todos os candidatos comprados; baseUses = usos sem compra nenhuma (por índice
  // do model); normal = plano atual; cands = índices no model. Devolve [{ id, gain }], do maior ganho para o menor.
  function buyRefine(model, baseUses, normal, cands, opts) {
    const byDate = new Map(normal.days.map(d => [d.date, d]));
    const init = model.days.map(md => { const d = byDate.get(md.day.date); return d ? d.lineup.map(id => model.pIndex.get(id)).filter(i => i != null) : []; });
    const value = c => { const u = baseUses.slice(); if (c >= 0) u[c] = model.uses[c]; return optimize(model, Object.assign({}, opts, { init, local: true, uses: u, fixed: null })).objective; };
    const base = value(-1);
    return cands.map(c => ({ id: model.players[c].id, gain: value(c) - base })).sort((a, b) => b.gain - a.gain);
  }

  // buyRefine com os dois plantéis (wide = com todos os candidatos comprados, base = sem compras); ids = candidatos
  function buyRank(run, wide, base, odds, planDoc, normal, ids, opts) {
    const mw = buildModel(run, wide, odds, planDoc, opts), mb = buildModel(run, base, odds, planDoc, opts);
    const baseUses = mw.players.map(p => { const i = mb.pIndex.get(p.id); return i != null ? mb.uses[i] : 0; });
    return buyRefine(mw, baseUses, normal, ids.map(id => mw.pIndex.get(String(id))).filter(i => i != null), opts);
  }

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
    // dias que passaram sem resultado (result 'none') não contam como derrota
    const losses = playedDays.filter(d => model.played[d.date].result === 'loss').length;
    return { model, normal, allIn, wins, losses, playedCount: wins + losses, prizes: model.prizes };
  }

  // ---------- várias contas (smurf) ----------
  // Cada conta tem os seus usos de cada jogador; um Moment só joga por uma conta em cada noite (copies = quantos
  // Moments desse jogador há nas contas todas). Maximiza a soma do valor dos prémios das contas.
  // models: um buildModel por conta, todos com os mesmos jogadores pela mesma ordem.
  function optimizeMulti(models, copies, opts) {
    opts = opts || {};
    const A = models.length, P = models[0].P;
    // custo de cada Moment mandado para outra conta: ≈ 0,1 vitórias esperadas (mandar entre as tuas contas é de graça
    // no Top Shot; o custo só evita trocas por migalhas). Com prémios, as vitórias esperadas pesam 0,002 → 0,0002.
    const hasPrizes = models.some(m => m.prizes && m.prizes.length);
    const TC = opts.transferCost != null ? opts.transferCost : (hasPrizes ? 0.0002 : 0.1);
    const owners = opts.owners || new Array(P).fill(-1);
    // com várias contas, os desempates (vitórias esperadas sem prémio, total do dia) pesam menos que uma transferência
    const multi = A > 1, AUX = multi ? 0.2 : 1;
    const objs = models.map(m => makeObjective(m, multi && m.prizes.length ? 0.002 : undefined));
    const slots = [];
    models.forEach((m, a) => m.days.forEach((md, d) => slots.push({ a, d, md, date: md.day.date })));
    const S_ = slots.length;
    const bySlot = models.map(() => []);
    slots.forEach((s, i) => { bySlot[s.a][s.d] = i; });
    const uses = models.map(m => m.uses);
    const lockSets = slots.map(s => new Set(s.md.locks));
    const isLocked = (i, p) => lockSets[i].has(p);
    const dates = [...new Set(slots.map(s => s.date))].sort();
    const ND = dates.length, dIdx = new Map(dates.map((dt, k) => [dt, k]));
    slots.forEach(s => { s.di = dIdx.get(s.date); });
    const night = new Map(dates.map(dt => [dt, new Int32Array(P)]));
    // Moments que outra conta já usou nessa noite (dia fechado nessa conta)
    if (opts.taken) Object.entries(opts.taken).forEach(([dt, ps]) => { const nt = night.get(dt); if (nt) ps.forEach(p => { nt[p]++; }); });
    const cap = p => Math.max(1, copies[p] || 1);
    // conta que usa cada jogador em cada noite (para contar as transferências dos Moments únicos)
    let assign = new Int8Array(P * ND).fill(-1);
    function tcOf(p) {
      if (cap(p) > 1) return 0;
      let at = owners[p], n = 0;
      for (let k = 0; k < ND; k++) { const a = assign[p * ND + k]; if (a >= 0) { if (at >= 0 && a !== at) n++; at = a; } }
      return n;
    }
    function tDelta(ch) { // ch: [[p, noite, conta ou -1], ...] aplicadas por ordem
      if (!TC) return 0;
      const ps = [...new Set(ch.map(c => c[0]))].filter(p => cap(p) === 1);
      if (!ps.length) return 0;
      let before = 0; ps.forEach(p => { before += tcOf(p); });
      const saved = [];
      ch.forEach(([p, k, a]) => { saved.push(assign[p * ND + k]); assign[p * ND + k] = a; });
      let after = 0; ps.forEach(p => { after += tcOf(p); });
      for (let n = ch.length - 1; n >= 0; n--) assign[ch[n][0] * ND + ch[n][1]] = saved[n];
      return after - before;
    }

    let plan = slots.map(() => new Set());
    let used = models.map(() => new Int32Array(P));
    const conflicts = models.map(() => []);
    const place = (i, p) => { const s = slots[i]; plan[i].add(p); used[s.a][p]++; night.get(s.date)[p]++; assign[p * ND + s.di] = s.a; };
    // fixados primeiro (mesmo que passem dos limites: o aviso aparece)
    slots.forEach((s, i) => s.md.locks.forEach(p => { if (plan[i].size < s.md.size) place(i, p); }));
    models.forEach((m, a) => { for (let p = 0; p < P; p++) if (used[a][p] > uses[a][p]) conflicts[a].push({ player: m.players[p].id, used: used[a][p], uses: uses[a][p] }); });
    const canAdd = (i, p) => { const s = slots[i]; return used[s.a][p] < uses[s.a][p] && night.get(s.date)[p] < cap(p); };
    // ponto de partida dado (p. ex. o melhor plano da conta principal sozinha)
    if (opts.init) slots.forEach((s, i) => ((opts.init[s.a] || [])[s.d] || []).forEach(p => { if (plan[i].size < s.md.size && !plan[i].has(p) && s.md.eligSet.has(p) && canAdd(i, p)) place(i, p); }));
    // gulosa: o melhor par (dia/conta, jogador) primeiro; prefere quem já está na conta
    const cand = [];
    slots.forEach((s, i) => s.md.elig.forEach(p => {
      let sc = 0; for (let k = 0; k < s.md.objs.length; k++) sc += s.md.mu[p][k] / s.md.T[k];
      cand.push([sc / Math.max(1, s.md.objs.length) + (owners[p] === s.a ? 1e-6 : 0), i, p]);
    }));
    cand.sort((x, y) => y[0] - x[0] || x[1] - y[1]);
    // no arranque, cada conta só usa os Moments que já tem (mandar Moments fica para a pesquisa, que pesa o custo)
    const needsMove = (i, p) => cap(p) === 1 && owners[p] >= 0 && owners[p] !== slots[i].a;
    for (const [, i, p] of cand) { const s = slots[i]; if (plan[i].size >= s.md.size || plan[i].has(p) || !canAdd(i, p) || needsMove(i, p)) continue; place(i, p); }

    let st = slots.map((s, i) => lineupStats(s.md, plan[i]));
    const dayP = models.map(m => new Float64Array(m.days.length)), aux = new Float64Array(S_);
    slots.forEach((s, i) => { dayP[s.a][s.d] = winProb(s.md, st[i].S, st[i].V); aux[i] = AUX * auxOf(s.md, st[i].S); });
    const auxSum = new Float64Array(A); slots.forEach((s, i) => { auxSum[s.a] += aux[i]; });
    const val = new Float64Array(A);
    let T = 0; for (let p = 0; p < P; p++) T += tcOf(p);
    let cur = 0;
    function refreshVals() { cur = -TC * T; for (let a = 0; a < A; a++) { val[a] = objs[a].value(dayP[a]) + auxSum[a]; cur += val[a]; } }
    refreshVals();

    function tryReplace(i, x, y) {
      const s = slots[i], md = s.md, K = md.objs.length, S = st[i].S.slice(), V = st[i].V.slice();
      for (let k = 0; k < K; k++) { if (x >= 0) { S[k] -= md.mu[x][k]; V[k] -= md.v[x][k]; } if (y >= 0) { S[k] += md.mu[y][k]; V[k] += md.v[y][k]; } }
      return { i, S, V, p: winProb(md, S, V), x: AUX * auxOf(md, S) };
    }
    const tmp = models.map(m => new Float64Array(m.days.length));
    function gain(rs) { // ganho no valor dos prémios das contas tocadas
      const touched = new Set(rs.map(r => slots[r.i].a));
      let g = 0;
      touched.forEach(a => {
        tmp[a].set(dayP[a]); let ax = auxSum[a];
        rs.forEach(r => { if (slots[r.i].a === a) { tmp[a][slots[r.i].d] = r.p; ax += r.x - aux[r.i]; } });
        g += objs[a].value(tmp[a]) + ax - val[a];
      });
      return g;
    }
    function commit(r) { const s = slots[r.i]; st[r.i] = { S: r.S, V: r.V }; auxSum[s.a] += r.x - aux[r.i]; aux[r.i] = r.x; dayP[s.a][s.d] = r.p; }
    const replCh = (i, x, y) => { const s = slots[i]; return (x >= 0 ? [[x, s.di, -1]] : []).concat(y >= 0 ? [[y, s.di, s.a]] : []); };
    const swapCh = (i, j, x, y) => { const si = slots[i], sj = slots[j]; return [[x, si.di, -1], [y, sj.di, -1], [y, si.di, si.a], [x, sj.di, sj.a]]; };
    function applyReplace(i, x, y, r, dT) {
      const s = slots[i], nt = night.get(s.date);
      if (x >= 0) { plan[i].delete(x); used[s.a][x]--; nt[x]--; assign[x * ND + s.di] = -1; }
      if (y >= 0) { plan[i].add(y); used[s.a][y]++; nt[y]++; assign[y * ND + s.di] = s.a; }
      commit(r); T += dT;
    }
    // troca x (em i) com y (em j): valida usos por conta e Moments por noite
    function swapOk(i, j, x, y) {
      const si = slots[i], sj = slots[j];
      if (x === y || isLocked(i, x) || isLocked(j, y) || plan[i].has(y) || plan[j].has(x)) return false;
      if (!si.md.eligSet.has(y) || !sj.md.eligSet.has(x)) return false;
      if (si.a !== sj.a && (used[si.a][y] >= uses[si.a][y] || used[sj.a][x] >= uses[sj.a][x])) return false;
      if (si.date !== sj.date && (night.get(si.date)[y] >= cap(y) || night.get(sj.date)[x] >= cap(x))) return false;
      return true;
    }
    function applySwap(i, j, x, y, ri, rj, dT) {
      const si = slots[i], sj = slots[j];
      plan[i].delete(x); plan[i].add(y); plan[j].delete(y); plan[j].add(x);
      if (si.a !== sj.a) { used[si.a][x]--; used[si.a][y]++; used[sj.a][y]--; used[sj.a][x]++; }
      if (si.date !== sj.date) { const ni = night.get(si.date), nj = night.get(sj.date); ni[x]--; ni[y]++; nj[y]--; nj[x]++; }
      swapCh(i, j, x, y).forEach(([p, k, a]) => { assign[p * ND + k] = a; });
      commit(ri); commit(rj); T += dT;
    }

    const open = []; slots.forEach((s, i) => { if (s.md.elig.length) open.push(i); });
    // pares de lugares que vale a pena trocar: mesma conta (dias diferentes) ou mesma noite (contas diferentes)
    const pairs = [];
    for (let u = 0; u < open.length; u++) for (let w = u + 1; w < open.length; w++) { const i = open[u], j = open[w]; if (slots[i].a === slots[j].a || slots[i].date === slots[j].date) pairs.push([i, j]); }
    const snapshot = () => ({ plan: plan.map(x => new Set(x)), used: used.map(x => x.slice()), night: new Map([...night].map(([k, v]) => [k, v.slice()])), st: st.map(x => ({ S: x.S.slice(), V: x.V.slice() })), dayP: dayP.map(x => x.slice()), aux: aux.slice(), auxSum: auxSum.slice(), assign: assign.slice(), T, cur });
    const restore = sn => { plan = sn.plan.map(x => new Set(x)); used = sn.used.map(x => x.slice()); sn.night.forEach((v, k) => night.get(k).set(v)); st = sn.st.map(x => ({ S: x.S.slice(), V: x.V.slice() })); sn.dayP.forEach((v, a) => dayP[a].set(v)); aux.set(sn.aux); auxSum.set(sn.auxSum); assign = sn.assign.slice(); T = sn.T; refreshVals(); };

    // subida: aplica a primeira melhoria que encontra e continua, até uma volta inteira sem melhorias
    function hillClimb() {
      const EPSV = 1e-10;
      for (let round = 0; round < 60; round++) {
        let improved = false;
        for (const i of open) {
          const s = slots[i], md = s.md;
          for (const x of [...plan[i]].filter(p => !isLocked(i, p)).concat(plan[i].size < md.size ? [-1] : [])) {
            if (x >= 0 && !plan[i].has(x)) continue;
            // uma conta pode jogar com menos jogadores (ou não jogar) quando não compensa mandar-lhe Moments
            for (const y of x >= 0 ? md.elig.concat([-1]) : md.elig) {
              if (y >= 0 && (plan[i].has(y) || used[s.a][y] >= uses[s.a][y] || night.get(s.date)[y] >= cap(y))) continue;
              const r = tryReplace(i, x, y), dT = tDelta(replCh(i, x, y));
              if (gain([r]) - TC * dT > EPSV) { applyReplace(i, x, y, r, dT); refreshVals(); improved = true; break; }
            }
          }
        }
        for (const [i, j] of pairs) for (const x of [...plan[i]]) for (const y of [...plan[j]]) {
          if (!plan[i].has(x) || !plan[j].has(y) || !swapOk(i, j, x, y)) continue;
          const ri = tryReplace(i, x, y), rj = tryReplace(j, y, x), dT = tDelta(swapCh(i, j, x, y));
          if (gain([ri, rj]) - TC * dT > EPSV) { applySwap(i, j, x, y, ri, rj, dT); refreshVals(); improved = true; }
        }
        // tirar um jogador de todas as noites de uma conta (desfaz as idas e voltas de um Moment)
        if (A > 1) {
          const uses2 = models.map(() => new Map());
          open.forEach(i => plan[i].forEach(p => { if (!isLocked(i, p)) { const m = uses2[slots[i].a]; m.set(p, (m.get(p) || []).concat(i)); } }));
          uses2.forEach(m => m.forEach((where, p) => {
            if (where.length < 2 || cap(p) > 1 || !where.every(i => plan[i].has(p))) return;
            const rs = where.map(i => tryReplace(i, p, -1)), dT = tDelta(where.map(i => [p, slots[i].di, -1]));
            if (gain(rs) - TC * dT > EPSV) { where.forEach((i, k) => applyReplace(i, p, -1, rs[k], 0)); T += dT; refreshVals(); improved = true; }
          }));
        }
        if (!improved) return;
      }
    }

    if (open.length) {
      if (opts.init) hillClimb(); // o ponto de partida dado também fica sem melhorias simples por fazer
      const start = snapshot();
      let best = opts.init ? start : null; // com ponto de partida, nunca fica pior do que ele
      const iters = opts.iters || Math.min(30000, 4000 + open.length * 1500);
      const t0 = opts.temp0 || 0.05;
      for (let restart = 0; restart < (opts.restarts || 2); restart++) {
        restore(start);
        const rand = rng(4321 + restart * 7919), pick = arr => arr[Math.floor(rand() * arr.length)];
        for (let it = 0; it < iters; it++) {
          const temp = t0 * Math.pow(0.0005 / t0, it / iters);
          if (rand() < 0.55 || open.length < 2) {
            const i = pick(open), s = slots[i], md = s.md;
            const members = [...plan[i]].filter(p => !isLocked(i, p));
            let x;
            if (plan[i].size < md.size && (rand() < 0.5 || !members.length)) x = -1; else if (members.length) x = pick(members); else continue;
            const y = x >= 0 && rand() < 0.1 ? -1 : pick(md.elig); // às vezes só tira
            if (y >= 0 && (plan[i].has(y) || used[s.a][y] >= uses[s.a][y] || night.get(s.date)[y] >= cap(y))) continue;
            const r = tryReplace(i, x, y), dT = tDelta(replCh(i, x, y)), dv = gain([r]) - TC * dT;
            if (dv > 0 || rand() < Math.exp(dv / temp)) { applyReplace(i, x, y, r, dT); refreshVals(); }
          } else {
            const i = pick(open), j = pick(open); if (i === j) continue;
            const mi = [...plan[i]], mj = [...plan[j]]; if (!mi.length || !mj.length) continue;
            const x = pick(mi), y = pick(mj);
            if (!swapOk(i, j, x, y)) continue;
            const ri = tryReplace(i, x, y), rj = tryReplace(j, y, x), dT = tDelta(swapCh(i, j, x, y)), dv = gain([ri, rj]) - TC * dT;
            if (dv > 0 || rand() < Math.exp(dv / temp)) { applySwap(i, j, x, y, ri, rj, dT); refreshVals(); }
          }
        }
        hillClimb();
        if (!best || cur > best.cur + 1e-12) best = snapshot();
      }
      restore(best);
      // pesquisa local repetida: força 3 mudanças ao acaso (a melhor troca que não seja manter o jogador), volta a
      // subir, e só fica se o plano todo melhorar. Sai de becos em que nenhuma mudança sozinha ajuda.
      const kicks = opts.kicks || 0;
      const krand = rng(777);
      for (let kk = 0; kk < kicks; kk++) {
        const before = snapshot();
        for (let m = 0; m < 3; m++) {
          const withP = open.filter(i => [...plan[i]].some(p => !isLocked(i, p)));
          if (!withP.length) break;
          const i = withP[Math.floor(krand() * withP.length)], s = slots[i], md = s.md;
          const mem = [...plan[i]].filter(p => !isLocked(i, p)), x = mem[Math.floor(krand() * mem.length)];
          let bestY = -1, bestG = -Infinity, bestR = null, bestT = 0;
          for (const y of md.elig.concat([-1])) {
            if (y === x || (y >= 0 && (plan[i].has(y) || used[s.a][y] >= uses[s.a][y] || night.get(s.date)[y] >= cap(y)))) continue;
            const r = tryReplace(i, x, y), dT = tDelta(replCh(i, x, y)), g = gain([r]) - TC * dT;
            if (g > bestG) { bestG = g; bestY = y; bestR = r; bestT = dT; }
          }
          if (bestR) { applyReplace(i, x, bestY, bestR, bestT); refreshVals(); }
        }
        hillClimb();
        if (cur < before.cur - 1e-12) restore(before);
      }
    }
    const results = models.map((m, a) => {
      const planA = m.days.map((_, d) => plan[bySlot[a][d]]);
      return summarize(m, planA, Array.from(used[a]), conflicts[a], objs[a], dayP[a], val[a]);
    });
    return { results, total: cur, transfers: T };
  }

  // Transferências: em que noite cada Moment tem de estar noutra conta (só jogadores com um Moment nas contas todas)
  // plans: {conta: resultado}, owners: {jogador: conta onde o Moment está agora}
  // holds: { id: { conta: quantos Moments } } (lido das carteiras). Com vários Moments do mesmo jogador, uma conta que
  // o use numa noite sem ter nenhum recebe um de uma conta que nessa noite não o usa (ou que tem dois).
  function transfersFor(keys, results, owners, copies, holds) {
    const uses = {};
    keys.forEach(k => results[k].days.forEach(d => d.lineup.forEach(id => { (uses[id] = uses[id] || []).push({ date: d.date, acc: k }); })));
    const out = [];
    Object.entries(uses).forEach(([id, list]) => {
      list.sort((x, y) => x.date.localeCompare(y.date));
      if ((copies[id] || 1) > 1) {
        const h0 = holds && holds[id]; if (!h0) return;
        const h = {}; Object.entries(h0).forEach(([k, n]) => { if (+n > 0) h[k] = +n; });
        const byDate = {}; list.forEach(u => { (byDate[u.date] = byDate[u.date] || []).push(u.acc); });
        Object.keys(byDate).sort().forEach(date => {
          const users = byDate[date];
          users.forEach(acc => {
            if ((h[acc] || 0) > 0) return;
            const spare = n => Object.keys(h).filter(k => k !== acc && (h[k] || 0) > (users.includes(k) ? n : 0));
            const from = spare(0)[0] || spare(1)[0];
            if (!from) return;
            h[from]--; h[acc] = (h[acc] || 0) + 1;
            out.push({ id, before: date, from, to: acc });
          });
        });
        return;
      }
      if (!owners[id]) return;
      let at = owners[id];
      list.forEach(u => { if (u.acc !== at) { out.push({ id, before: u.date, from: at, to: u.acc }); at = u.acc; } });
    });
    return out.sort((x, y) => x.before.localeCompare(y.before) || String(x.id).localeCompare(String(y.id)));
  }

  // Plano conjunto de várias contas. accounts: [{key, roster, plan}] (o mesmo plantel, com os usos de cada conta).
  // Nos jogadores do plantel: copies (Moments nas contas todas) e owner (conta onde está o Moment, se só há um).
  function planGroup(run, accounts, odds, opts) {
    opts = opts || {};
    const models = accounts.map(acc => buildModel(run, acc.roster, odds, acc.plan, opts));
    const players = models[0].players;
    const keys = accounts.map(a => a.key), byKey = {};
    const copies = players.map(p => Math.max(1, Math.floor(+p.copies || 1)));
    const owners = players.map(p => keys.indexOf(p.owner));
    const base = Object.assign({}, opts, { owners });
    // Moments já usados em dias fechados de cada conta: nessa noite não podem jogar por outra
    const taken = {};
    models.forEach(m => m.allDays.forEach(d => { const pl = m.played[d.date]; if (pl && pl.done) (pl.lineup || []).forEach(id => { const i = m.pIndex.get(id); if (i != null) (taken[d.date] = taken[d.date] || []).push(i); }); }));
    base.taken = taken;
    // pontos de partida, fica o melhor: do zero; o melhor plano da conta principal sozinha; uma divisão
    // equilibrada (em cada noite as contas escolhem à vez, como num draft); e a principal mais as sobras
    const cold = optimizeMulti(models, copies, Object.assign({}, base, { restarts: 1 }));
    const lead = optimize(models[0], Object.assign({}, opts, { restarts: 2 }));
    const warm = optimizeMulti(models, copies, Object.assign({}, base, { init: [lead.days.map(d => d.lineupIdx)], temp0: 0.01, restarts: 1 }));
    const draft = models.map(m => m.days.map(() => []));
    const slotsByDate = {};
    models.forEach((m, a) => m.days.forEach((md, d) => { (slotsByDate[md.day.date] = slotsByDate[md.day.date] || []).push([a, d, md]); }));
    Object.values(slotsByDate).forEach(list => {
      const md0 = list[0][2], score = p => md0.objs.reduce((t, _, k) => t + md0.mu[p][k] / md0.T[k], 0);
      const ranked = md0.elig.slice().sort((x, y) => score(y) - score(x));
      let turn = 0, dir = 1;
      ranked.forEach(p => {
        const [a, d, md] = list[turn];
        if (draft[a][d].length < md.size && md.eligSet.has(p)) draft[a][d].push(p);
        if (list.length > 1) { turn += dir; if (turn === list.length || turn < 0) { dir = -dir; turn += dir; } }
      });
    });
    const split = models.length > 1 ? optimizeMulti(models, copies, Object.assign({}, base, { init: draft, temp0: 0.02, restarts: 1 })) : null;
    // quarto ponto de partida: o plano da principal e, em cada noite, as outras contas com os Moments que sobram
    // (mesmo os de outra conta: é aqui que nascem as trocas; um a um, a pesquisa não chega lá porque um jogador
    // sozinho não ganha um dia)
    let fillRun = null;
    if (models.length > 1) {
      const fill = models.map((m, a) => (a === 0 ? lead.days.map(d => d.lineupIdx.slice()) : m.days.map(() => [])));
      const usedA = models.map(m => new Int32Array(m.P)), dayOf = models.map(m => new Map(m.days.map((md, d) => [md.day.date, d])));
      fill[0].forEach(l => l.forEach(p => { usedA[0][p]++; }));
      Object.keys(slotsByDate).sort().forEach(date => {
        const list = slotsByDate[date], md0 = list[0][2], night = new Int32Array(models[0].P);
        const d0 = dayOf[0].get(date); if (d0 != null) fill[0][d0].forEach(p => { night[p]++; });
        (taken[date] || []).forEach(p => { night[p]++; });
        const score = p => md0.objs.reduce((t, _, k) => t + md0.mu[p][k] / md0.T[k], 0);
        const ranked = md0.elig.slice().sort((x, y) => score(y) - score(x));
        list.forEach(([a, d, md]) => {
          if (a === 0) return;
          ranked.forEach(p => { if (fill[a][d].length < md.size && md.eligSet.has(p) && night[p] < copies[p] && usedA[a][p] < models[a].uses[p]) { fill[a][d].push(p); night[p]++; usedA[a][p]++; } });
        });
      });
      fillRun = optimizeMulti(models, copies, Object.assign({}, base, { init: fill, temp0: 0.01, restarts: 1 }));
    }
    let best = [cold, warm, split, fillRun].filter(Boolean).reduce((x, y) => (y.total > x.total + 1e-12 ? y : x));
    // no fim, a pesquisa local repetida parte do melhor dos três
    if (models.length > 1) {
      const polished = optimizeMulti(models, copies, Object.assign({}, base, { init: best.results.map(r => r.days.map(d => d.lineupIdx)), iters: 1, restarts: 1, temp0: 0.001, kicks: opts.kicks != null ? opts.kicks : 40 }));
      if (polished.total > best.total + 1e-12) best = polished;
    }
    const res = best.results;
    models.forEach((model, a) => {
      const playedDays = model.allDays.filter(d => model.played[d.date] && model.played[d.date].done);
      const wins = playedDays.filter(d => model.played[d.date].result === 'win').length;
      const losses = playedDays.filter(d => model.played[d.date].result === 'loss').length;
      byKey[keys[a]] = { model, normal: res[a], allIn: null, group: true, wins, losses, playedCount: wins + losses, prizes: model.prizes };
    });
    const ownerById = {}, cp = {}, holdById = {};
    players.forEach((p, i) => { cp[p.id] = copies[i]; if (p.owner) ownerById[p.id] = p.owner; if (p.hold) holdById[p.id] = p.hold; });
    const transfers = transfersFor(keys, Object.fromEntries(keys.map((k, a) => [k, res[a]])), ownerById, cp, holdById);
    // um Moment em duas contas na mesma noite (só acontece com jogadores fixados à mão)
    const clashes = [];
    const byDate = {};
    keys.forEach((k, a) => res[a].days.forEach(d => d.lineup.forEach(id => { const key = d.date + '|' + id; (byDate[key] = byDate[key] || []).push(k); })));
    Object.entries(byDate).forEach(([key, ks]) => { const [date, id] = key.split('|'); if (ks.length > (cp[id] || 1)) clashes.push({ date, id, accounts: ks }); });
    return { keys, byKey, transfers, clashes, objective: best.total };
  }

  // Nome da estatística no contrato do Fast Break → chave do planeador (igual ao das tarefas automáticas, scripts/lib.mjs)
  const STAT_WORDS = [
    ['pip', 'POINTS?_IN_(?:THE_)?PAINT|PAINT_POINTS|PITP'],
    ['oreb', 'OFF(?:ENSIVE)?_?REB(?:OUND)?S?|OREB'],
    ['dreb', 'DEF(?:ENSIVE)?_?REB(?:OUND)?S?|DREB'],
    ['fg3a', '(?:THREE|3)_?(?:POINT(?:ER)?S?_?|PT_?|P_?)?(?:FIELD_GOALS?_)?ATT(?:EMPT(?:S|ED)?)?|3PA|FG3A'],
    ['fg3', '(?:THREE|3)_?(?:POINT(?:ER)?S?|PT)(?:_FIELD_GOALS?)?(?:_MADE)?|3PM|FG3M?|TRIPLES?|THREES'],
    ['fga', 'FIELD_GOALS?_ATT(?:EMPT(?:S|ED)?)?|FGA'],
    ['fgm', 'FIELD_GOALS?(?:_MADE)?|FGM'],
    ['fta', 'FREE_THROWS?_ATT(?:EMPT(?:S|ED)?)?|FTA'],
    ['ftm', 'FREE_THROWS?(?:_MADE)?|FTM'],
    ['tov', 'TURNOVERS?|TOV'],
    ['pts', 'POINTS?|PTS'],
    ['reb', '(?:TOTAL_)?REB(?:OUND)?S?'],
    ['ast', 'ASSISTS?|AST'],
    ['stl', 'STEALS?|STL'],
    ['blk', 'BLOCK(?:S|ED_SHOTS)?|BLK'],
  ].map(([k, re]) => [k, new RegExp('(?<=_)(?:' + re + ')(?=_)')]);
  const STAT_ORDER = ['pts', 'reb', 'ast', 'fg3', 'stl', 'blk', 'tov', 'oreb', 'dreb', 'fgm', 'fga', 'fg3a', 'ftm', 'fta', 'pip'];
  const STAT_GLUE = new Set(['AND', 'PLUS', 'TOTAL', 'COMBINED']);
  function mapStat(name) {
    const u = String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!u) return null;
    const pos = [], neg = [], parts = u.split(/(?:^|_)MINUS(?:_|$)/);
    for (let i = 0; i < parts.length; i++) {
      let rest = '_' + parts[i] + '_';
      const found = [];
      for (const [k, re] of STAT_WORDS) { if (re.test(rest)) { found.push(k); rest = rest.replace(re, '_'); } }
      if (!found.length || rest.split('_').some(t => t && !STAT_GLUE.has(t))) return null;
      (i === 0 ? pos : neg).push(...found);
    }
    const sort = arr => [...new Set(arr)].sort((a, b) => STAT_ORDER.indexOf(a) - STAT_ORDER.indexOf(b));
    return sort(pos).join('+') + sort(neg).map(x => '-' + x).join('');
  }

  const api = { mapStat, STATS, STATUS, INJ_LABEL, injuryOn, buyScreen, buyRefine, buyRank, kOf, b2bFactor, B2B_DEFAULT, QREM, matchup, statTerms, statValue, avgOf, formAvg, formInfo, setForm, alternativeSeeds, paintShare, normCdf, invNorm, poissonTail, impliedProb, devig, solveNormal, solvePoisson, playerDist, probAtLeast, buildModel, makeObjective, optimize, optimizeMulti, planGroup, transfersFor, bestSingleDay, planRun, teamsOn, gameOf, tipTime };
  root.FB = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
