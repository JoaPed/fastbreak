// ==UserScript==
// @name         FB lugares
// @description  Fast Break (Top Shot): lugar na run de cada conta do grupo, preços do mercado e raridade e ASP das cartas, e a run com os prémios, para o site joaped.github.io/fastbreak. Só corre quando vens do site (Classificação → Atualizar lugares).
// @match        https://nbatopshot.com/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// @version      11
// ==/UserScript==
window.__fblUS = true;
(()=>{
// FB lugares: na página do Fast Break do Top Shot, pede o lugar na run de cada conta do grupo (endereços vindos do
// nosso site no #fbsync=...) e volta ao site com os resultados. A sessão do Top Shot só é usada aqui, nos pedidos à
// API do próprio Top Shot; para o nosso site vão só os lugares e os preços do mercado.
if (window.__fbl) { window.__fbl.box.style.display = 'block'; return; }
const API = 'https://api.production.atlas.dapperlabs.com/atlas.v1.';
const B64 = { dec: s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))), enc: o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
let job = null, fresh = false;
try { const m = location.hash.match(/fbsync=([A-Za-z0-9_-]+)/) || String(window.name || '').match(/^fbsync:([A-Za-z0-9_-]+)/); if (m) { job = B64.dec(m[1]); fresh = true; localStorage.setItem('fb-lugares', JSON.stringify(job)); if (/^fbsync:/.test(window.name)) window.name = ''; } } catch (e) {}
if (!job && window.__fblUS) return; // como script automático, só quando vem do site
if (!job) { try { job = JSON.parse(localStorage.getItem('fb-lugares') || 'null'); } catch (e) {} }
const S = window.__fbl = { tok: null, box: document.createElement('div'), log: [] };
const box = S.box;
box.style.cssText = 'position:fixed;z-index:2147483647;left:10px;right:10px;bottom:10px;max-width:420px;margin:0 auto;background:#111;color:#eee;font:14px/1.45 system-ui,sans-serif;padding:12px 14px;border:2px solid #f80;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.5)';
if (document.body) document.body.appendChild(box); else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
const say = (html) => { box.innerHTML = '<b style="color:#f80">Fast Break · lugares</b><div style="margin-top:6px">' + html + '</div>'; };
if (!job || !Array.isArray(job.accs) || !job.accs.length) { say('Abre isto a partir do site (Classificação → <b>Atualizar lugares</b>), para eu saber que contas procurar.'); return; }
say('Toca uma vez em <b>Leaderboard</b> (ou muda de separador) para eu começar…');
// a sessão: o cabeçalho que a própria página põe nos pedidos à API (fica só aqui, em memória)
const grab = (n, v) => { try { if (String(n).toLowerCase() === 'authorization' && v && !S.tok) { S.tok = String(v); go(); } } catch (e) {} };
const hs = Headers.prototype.set, ha = Headers.prototype.append;
Headers.prototype.set = function (n, v) { grab(n, v); return hs.apply(this, arguments); };
Headers.prototype.append = function (n, v) { grab(n, v); return ha.apply(this, arguments); };
const wait = ms => new Promise(f => setTimeout(f, ms));
const call = async (m, body, tries = 0) => {
  const r = await fetch(API + m, { method: 'POST', headers: { 'content-type': 'application/json', 'connect-protocol-version': '1', authorization: S.tok }, body: JSON.stringify(body) });
  // muitos pedidos seguidos: o Top Shot pode pedir para abrandar → espera e tenta outra vez (até 4 vezes)
  if ((r.status === 429 || r.status === 503) && tries < 4) { await wait(1500 * (tries + 1)); return call(m, body, tries + 1); }
  if (!r.ok) throw new Error(m.split('/').pop() + ' ' + r.status);
  return r.json();
};
// ---- preços ----
const norm = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.'’`]/g, '').replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
// todos os jogadores do Top Shot (nome → id da NBA), guardados neste aparelho uma semana
async function tsPlayers() {
  try { const c = JSON.parse(localStorage.getItem('fb-tsp') || 'null'); if (c && Date.now() - c.at < 7 * 864e5 && Object.keys(c.m).length > 200) return c.m; } catch (e) {}
  let r = null;
  for (const body of [{ product: 'nba' }, {}]) { try { r = await call('PlayerService/GetAllPlayers', body); break; } catch (e) {} }
  if (!r) throw new Error('não li a lista de jogadores');
  const m = {}, seen = new Set();
  const walk = (o, d) => {
    if (!o || typeof o !== 'object' || d > 6 || seen.has(o)) return; seen.add(o);
    if (Array.isArray(o)) { o.forEach(x => walk(x, d + 1)); return; }
    const id = o.playerId || o.nbaId || o.id, nm = o.fullName || o.FullName || o.playerName || o.name || ((o.firstName || o.FirstName) && [o.firstName || o.FirstName, o.lastName || o.LastName].join(' '));
    if (id && /^\d{3,9}$/.test(String(id)) && typeof nm === 'string' && nm.trim()) m[norm(nm)] = String(id);
    Object.values(o).forEach(v => { if (v && typeof v === 'object') walk(v, d + 1); });
  };
  walk(r, 0);
  if (Object.keys(m).length < 50) throw new Error('lista de jogadores vazia');
  try { localStorage.setItem('fb-tsp', JSON.stringify({ at: Date.now(), m })); } catch (e) {}
  return m;
}
// nome do site → id da NBA: nome igual, ou o mesmo apelido com a mesma inicial (só se não houver dúvida)
function matcher(m) {
  const byLast = {};
  Object.entries(m).forEach(([n, id]) => { const w = n.split(' '); if (w.length < 2) return; const k = w.slice(1).join(' ') + '|' + w[0][0]; (byLast[k] = byLast[k] || []).push(id); });
  return name => { const n = norm(name); if (m[n]) return m[n]; const w = n.split(' '); if (w.length < 2) return null; const L = byLast[w.slice(1).join(' ') + '|' + w[0][0]]; return L && L.length === 1 ? L[0] : null; };
}
// [Common/Fandom, Rare, Legendary/Ultimate]: o Moment mais barato à venda de cada um (em cêntimos; null = nenhum à venda)
const PX_TIERS = [['COMMON', 'FANDOM'], ['RARE'], ['LEGENDARY', 'ULTIMATE']];
let edOwner = false, oneTier = false;
async function cheapest(nba, tiers) {
  if (oneTier) tiers = tiers.slice(0, 1);
  const body = { product: 'nba', tier: tiers, hasListings: true, sortByOption: 'LOW_ASK', sortByDirection: 'ASC', limit: '1', offset: '0', playerId: [nba] };
  if (edOwner && job.accs[0]) body.ownerAddress = String(job.accs[0].a).replace(/^0x/, '');
  let r;
  try { r = await call('EditionService/SearchEditions', body); }
  catch (e) {
    if (!edOwner && job.accs[0]) { edOwner = true; return cheapest(nba, tiers); }
    if (tiers.length > 1) { oneTier = true; return cheapest(nba, tiers.slice(0, 1)); }
    throw e;
  }
  const e = (r.editions || [])[0];
  return e && e.lowAskCents != null && +e.lowAskCents > 0 ? +e.lowAskCents : null;
}
async function prices(pl) {
  say('A ler a lista de jogadores do Top Shot…');
  const find = matcher(await tsPlayers()), px = { at: new Date().toISOString(), p: {}, miss: [] }, todo = [];
  pl.forEach(([id, name]) => { const n = find(name); if (n) todo.push([id, n]); else px.miss.push(id); });
  let done = 0, fails = 0;
  const work = async () => {
    for (let x; (x = todo.shift());) {
      const row = [];
      for (const t of PX_TIERS) { try { row.push(await cheapest(x[1], t)); } catch (e) { row.push(undefined); fails++; } }
      if (row.some(v => v !== undefined)) px.p[x[0]] = row.map(v => v === undefined ? null : v);
      done++; if (done % 5 === 0) say('A ler os preços… ' + done + ' de ' + (done + todo.length) + ' jogadores');
      if (fails > 30 && Object.keys(px.p).length < 3) throw new Error('o mercado não respondeu');
    }
  };
  await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(work));
  if (fails) px.fails = fails;
  return px;
}
// ---- raridade e ASP de cada carta do grupo ----
// O site manda, por jogador, os sets das cartas que o grupo tem (job.cs = [[id, nome, [sets]]]). Aqui pedem-se as edições
// desse jogador e ficam as desses sets: [set, paralelo, escalão, ASP em cêntimos, tiragem, série, setID e playID da Flow,
// data da jogada]
// nome do set sem o número da série no fim (na blockchain "Base Set6", no site "Base Set")
const setBase = n => norm(n).replace(/\s*\d+$/, '');
// data (2026-04-19) a partir do que vier: texto ISO, "Apr 19, 2026" ou segundos
const isoDay = v => { if (v == null || v === '') return null; const t = /^\d{9,11}$/.test(String(v)) ? +v * 1000 : /^\d{12,14}$/.test(String(v)) ? +v : Date.parse(String(v).replace(' +0000 UTC', 'Z').replace(' ', 'T')) || Date.parse(String(v)); return isFinite(t) && t > 0 ? new Date(t).toISOString().slice(0, 10) : null; };
const ED_TIERS = ['COMMON', 'FANDOM', 'RARE', 'LEGENDARY', 'ULTIMATE'];
let edLimit = '100', edMode = 0; // 0: sem escalão · 1: todos os escalões juntos · 2: um escalão de cada vez
const pick = (o, rx, d = 0) => { if (!o || typeof o !== 'object' || d > 2) return null; for (const [k, v] of Object.entries(o)) { if (rx.test(k) && v != null && typeof v !== 'object' && String(v) !== '') return v; } for (const v of Object.values(o)) { if (v && typeof v === 'object' && !Array.isArray(v)) { const r = pick(v, rx, d + 1); if (r != null) return r; } } return null; };
async function editionsOf(nba) {
  const all = [];
  const page = async (tier, off) => { const body = { product: 'nba', playerId: [nba], limit: edLimit, offset: String(off) }; if (tier) body.tier = tier; return (await call('EditionService/SearchEditions', body)).editions || []; };
  const run = async tier => { for (let off = 0, k = 0; k < 8; k++) { const es = await page(tier, off); all.push(...es); if (es.length < +edLimit) break; off += es.length; } };
  for (;;) {
    try {
      if (edMode === 0) await run(null); else if (edMode === 1) await run(ED_TIERS); else for (const t of ED_TIERS) await run([t]);
      return all;
    } catch (e) {
      all.length = 0;
      if (edLimit === '100') { edLimit = '50'; continue; }
      if (edMode < 2) { edMode++; continue; }
      throw e;
    }
  }
}
async function editions(cs) {
  const find = matcher(await tsPlayers()), ed = { at: new Date().toISOString(), p: {}, miss: [] }, todo = [];
  cs.forEach(([id, name, sets]) => { const n = find(name); if (n) todo.push([id, n, new Set((sets || []).map(setBase))]); else ed.miss.push(id); });
  let done = 0, fails = 0;
  const work = async () => {
    for (let x; (x = todo.shift());) {
      try {
        const es = await editionsOf(x[1]);
        if (!ed.keys && es[0]) ed.keys = Object.keys(es[0]).concat(Object.keys(es[0].set || {}).map(k => 'set.' + k)).slice(0, 60);
        const rows = [];
        es.forEach(e => {
          const set = (e.set && (e.set.name || e.set.setName)) || e.setName || ''; if (!x[2].has(setBase(set))) return;
          const par = e.parallel && typeof e.parallel === 'object' ? (e.parallel.name || e.parallel.label || '') : (e.parallel || e.parallelName || '');
          const asp = e.averageSalePriceCents != null ? +e.averageSalePriceCents : null;
          rows.push([set, String(par || ''), String(e.tier || ''), asp, e.maxMintSize != null ? +e.maxMintSize : null, pick(e.set, /series(number)?$|^flowSeries/i), pick(e, /flow.?set.?id|set.?flow.?id/i), pick(e, /flow.?play.?id|play.?flow.?id/i), isoDay(pick(e, /date.?of.?moment|moment.?date|play.?date|game.?date/i))]);
        });
        ed.p[x[0]] = rows;
      } catch (e) { fails++; }
      done++; if (done % 5 === 0) say('A ler a raridade e o ASP das cartas… ' + done + ' de ' + (done + todo.length) + ' jogadores');
      if (fails > 30 && Object.keys(ed.p).length < 3) throw new Error('as edições não responderam');
    }
  };
  await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(work));
  if (fails) ed.fails = fails;
  return ed;
}
// ---- picks do dia (PredictionService): os jogos abertos, a % do pessoal em cada opção e o limite de pontos ----
async function picks(addr) {
  const r = await call('PredictionService/ListPredictionEvents', { product: 'nba' });
  const ev = (r.events || []).filter(e => e.status === 'open').map(e => { const m = e.metadata || {};
    return { id: e.eventId, t: e.pickType, d: e.description, lock: e.lockTime, max: +e.maxPoints || 0, x: +e.multiplier || 2, risk: !!e.stakeAtRisk, n: +e.totalEntries || 0,
      home: (m.home_team || {}).alias || null, away: (m.away_team || {}).alias || null, hid: (m.home_team || {}).reference || null,
      o: (e.options || []).map(o => { const md = o.metadata || {}; return [o.label, +o.pickPercentage || 0, md.id || null, md.side || null, md.threshold != null ? +md.threshold : null, md.stat_key || null]; }) }; });
  const out = { at: new Date().toISOString(), ev };
  try { const u = await call('PredictionService/GetUserPredictionSummary', { product: 'nba', userFlowAddress: String(addr || '').replace(/^0x/, '') }); out.cap = +u.dailyActivePointsCap || null; out.free = !!u.freePicks; } catch (e) {}
  return out;
}
let started = false;
async function go() {
  if (started) return; started = true;
  // o que ler (o site manda em job.do): ranks = lugares e dias · picks · px = preços dos jogadores · ed = cartas (ASP).
  // Sem job.do (links antigos): tudo
  const want = new Set(Array.isArray(job.do) && job.do.length ? job.do : ['ranks', 'picks', 'px', 'ed']);
  try {
    const out = { v: 1, sv: 11, do: [...want], at: new Date().toISOString(), accs: [], bands: [], cut: {} };
    if (want.has('ranks')) await readRanks(out);
    // a run (dias, objetivos de cada dia e prémios): para criar/completar a run no site se a blockchain falhar
    if (want.has('run')) { try { out.runs = await readRun(); } catch (err) { out.runErr = String(err.message || err).slice(0, 80); } }
    // preços: o mais barato à venda de cada jogador que o site pediu, em cada escalão (como no Marketplace do Top Shot)
    if (want.has('px') && Array.isArray(job.pl) && job.pl.length) { try { out.px = await prices(job.pl); } catch (err) { out.px = { at: new Date().toISOString(), p: {}, err: String(err.message || err).slice(0, 80) }; } }
    // picks do dia (jogos abertos e % do pessoal): servem para o pick do dia na Jornada
    if (want.has('picks')) { try { say('A ler os picks…'); out.picks = await picks(job.accs[0] && job.accs[0].a); } catch (err) { out.picksErr = String(err.message || err).slice(0, 80); } }
    // raridade e ASP das cartas que o grupo tem (vai pelo set de cada carta)
    if (want.has('ed') && Array.isArray(job.cs) && job.cs.length) { try { out.ed = await editions(job.cs); } catch (err) { out.ed = { at: new Date().toISOString(), p: {}, err: String(err.message || err).slice(0, 80) }; } }
    const back = (job.back || 'https://joaped.github.io/fastbreak/') + '#fbranks=' + B64.enc(out);
    say('Feito: ' + [want.has('ranks') ? out.accs.filter(x => x.found).length + ' contas na classificação' : '', out.picks ? out.picks.ev.length + ' picks' : out.picksErr ? 'picks: ' + out.picksErr : '', out.px ? 'preços de ' + Object.keys(out.px.p).length + ' jogadores' : '', out.ed ? 'cartas de ' + Object.keys(out.ed.p).length + ' jogadores' : '', out.runs ? out.runs.map(r => (r.name || r.id) + ': ' + r.days.length + ' dias').join(', ') || 'nenhuma run Classic' : out.runErr ? 'run: ' + out.runErr : ''].filter(Boolean).join(', ') + '. A voltar ao site…');
    try { localStorage.removeItem('fb-lugares'); } catch (e) {}
    setTimeout(() => { location.href = back; }, 900);
  } catch (err) { started = false; say('Não deu: ' + String(err.message || err).slice(0, 120) + '. Toca outra vez em <b>Leaderboard</b> para tentar de novo.'); S.tok = null; }
}
// a run Classic da NBA (a que está a decorrer e, se o Top Shot já a mostrar, a seguinte): dias com os objetivos,
// jogadores por lineup e prémios da run e de cada dia. Vai também uma amostra dos campos (sem objetos) para se
// perceber o formato se alguma coisa não for lida.
const prim = o => { const r = {}; Object.entries(o || {}).slice(0, 40).forEach(([k, v]) => { if (v == null || typeof v !== 'object') r[k] = typeof v === 'string' ? v.slice(0, 80) : v; }); return r; };
const bandsOf = x => (((x || {}).reward || {}).bands || []).map(b => [+b.rankLow, +b.rankHigh, +b.amount, b.label || '']);
const etDay = t => { const ms = Date.parse(t); return isFinite(ms) ? new Date(ms - 4 * 3600e3).toISOString().slice(0, 10) : null; };
async function readRun() {
  say('A ler a run e os prémios…');
  const runs = (await call('GameEngineService/ListActiveRuns', { product: 'nba' })).runs || [];
  const nba = runs.filter(r => (!r.league || r.league === 'nba') && (r.mode === 'RUN_MODE_CLASSIC' || /classic/i.test(String(r.id) + ' ' + (r.name || ''))));
  const out = [];
  for (const r of nba.slice(0, 4)) {
    const x = { id: r.id, name: r.name || null, mode: r.mode || null, starts: r.startsAt || r.startAt || r.opensAt || null, ends: r.endsAt || null, bands: bandsOf(r), qual: r.reward && r.reward.qualifier ? +r.reward.qualifier.rankHigh : null, raw: prim(r), days: [] };
    try {
      let cs = [], page = null;
      for (let i = 0; i < 6; i++) {
        const res = await call('GameEngineService/SearchContests', Object.assign({ product: 'nba', runId: r.id }, page ? { pageToken: page } : {}));
        cs = cs.concat(res.contests || []);
        page = res.nextPageToken || null; if (!page) break;
      }
      x.days = cs.map((c, i) => ({
        id: c.id, date: (String(c.id).match(/(\d{4}-\d{2}-\d{2})$/) || [])[1] || etDay(c.locksAt || c.startsAt), name: c.name || null, locks: c.locksAt || null, status: c.status || null,
        n: +(c.lineupSize || c.numPlayers || c.rosterSize || c.maxLineupSize || c.playerCount || 0) || null,
        objs: (c.objectives || []).map(o => Object.assign({ k: o.statKey || null, a: o.statAbbreviation || null, t: +o.target, ty: o.type || o.objectiveType || o.scope || o.aggregation || o.mode || null }, i === 0 ? { raw: prim(o) } : {})),
        bands: bandsOf(c), raw: i === 0 ? prim(c) : undefined,
      })).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    } catch (err) { x.daysErr = String(err.message || err).slice(0, 80); }
    out.push(x);
  }
  return out;
}
// lugares na run e em cada dia, de cada conta do grupo
async function readRanks(out) {
  {
    say('A ver a run…');
    const runs = (await call('GameEngineService/ListActiveRuns', { product: 'nba' })).runs || [];
    const run = runs.find(r => /classic/i.test(r.id) && r.league === 'nba' && r.mode === 'RUN_MODE_CLASSIC') || runs.find(r => /nba-classic/.test(r.id));
    if (!run) throw new Error('não encontrei a run Classic da NBA');
    const lb = run.leaderboardId || ('run:' + run.id); Object.assign(out, { run: { id: run.id, name: run.name, ends: run.endsAt }, bands: ((run.reward || {}).bands || []).map(b => [+b.rankLow, +b.rankHigh, +b.amount, b.label || '']), qual: run.reward && run.reward.qualifier ? +run.reward.qualifier.rankHigh : null, accs: [], cut: {} });
    let n = 0;
    for (const a of job.accs) {
      say('A ler os lugares… ' + (++n) + ' de ' + job.accs.length);
      try {
        const r = await call('LeaderboardService/GetSubjectRank', { leaderboardId: lb, subjectId: String(a.a).replace(/^0x/, '').toLowerCase() });
        const e = r.entry || {};
        if (r.totalCount) out.total = +r.totalCount;
        out.accs.push({ a: a.a, found: !!r.found, rank: r.found ? +e.rank : null, wins: r.found ? +(e.displayScore != null ? e.displayScore : e.score) : 0, tb: r.found ? +e.tiebreakerScore : null, user: (e.user || {}).username || null });
      } catch (err) { out.accs.push({ a: a.a, err: String(err.message || err).slice(0, 80) }); }
    }
    // cada dia da run (os que já fecharam e o de hoje, se já começou): lugar de cada conta nesse dia e se ganhou.
    // Os dias que o site já tem fechados (job.known) não se voltam a pedir.
    try {
      const cs = ((await call('GameEngineService/SearchContests', { product: 'nba', runId: run.id })).contests || [])
        .filter(c => c.locksAt && Date.parse(c.locksAt) <= Date.now() && !(job.known || []).includes(c.id))
        .sort((a, b) => String(a.locksAt).localeCompare(String(b.locksAt)));
      out.days = [];
      let k = 0;
      for (const c of cs) {
        k++;
        const d = { id: c.id, date: (String(c.id).match(/(\d{4}-\d{2}-\d{2})$/) || [])[1] || null, name: c.name, final: /FINAL/.test(c.status || ''), objs: (c.objectives || []).map(o => [o.statAbbreviation || o.statKey, +o.target]), accs: {}, asked: job.accs.map(a => String(a.a).replace(/^0x/, '').toLowerCase()), bands: ((c.reward || {}).bands || []).map(b => [+b.rankLow, +b.rankHigh, +b.amount, b.label || '']) };
        const lbc = c.leaderboardId || ('contest:' + c.id);
        for (const a of job.accs) {
          say('A ler os dias… ' + k + ' de ' + cs.length);
          try {
            const r = await call('LeaderboardService/GetSubjectRank', { leaderboardId: lbc, subjectId: String(a.a).replace(/^0x/, '').toLowerCase() });
            if (r.totalCount) d.total = +r.totalCount;
            if (r.found) { const e = r.entry || {}; d.accs[String(a.a).replace(/^0x/, '').toLowerCase()] = { rank: +e.rank, score: +e.score, won: +e.score >= 1e6, ds: e.displayScore != null ? +e.displayScore : null }; }
          } catch (err) {}
        }
        out.days.push(d);
      }
    } catch (err) { out.daysErr = String(err.message || err).slice(0, 80); }
    // vitórias de quem está nos lugares que contam (corte do top 50 e do último lugar pago), se a API deixar saltar
    const lastPaid = out.bands.length ? Math.max(...out.bands.map(b => b[1])) : 250;
    for (const k of [...new Set([out.qual || 50, lastPaid])]) {
      try { const p = await call('LeaderboardService/GetLeaderboardPage', { leaderboardId: lb, limit: 1, offset: k - 1 }); const e = (p.entries || [])[0]; if (e && +e.rank >= k - 5 && +e.rank <= k + 5) out.cut[k] = +(e.displayScore != null ? e.displayScore : e.score); } catch (e) {}
    }
  }
}
})()
