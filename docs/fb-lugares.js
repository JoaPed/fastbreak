(()=>{
// FB lugares: na página do Fast Break do Top Shot, pede o lugar na run de cada conta do grupo (endereços vindos do
// nosso site no #fbsync=...) e volta ao site com os resultados. A sessão do Top Shot só é usada aqui, nos pedidos à
// API do próprio Top Shot; para o nosso site vão só os lugares.
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
const call = async (m, body) => {
  const r = await fetch(API + m, { method: 'POST', headers: { 'content-type': 'application/json', 'connect-protocol-version': '1', authorization: S.tok }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(m.split('/').pop() + ' ' + r.status);
  return r.json();
};
let started = false;
async function go() {
  if (started) return; started = true;
  try {
    say('A ver a run…');
    const runs = (await call('GameEngineService/ListActiveRuns', { product: 'nba' })).runs || [];
    const run = runs.find(r => /classic/i.test(r.id) && r.league === 'nba' && r.mode === 'RUN_MODE_CLASSIC') || runs.find(r => /nba-classic/.test(r.id));
    if (!run) throw new Error('não encontrei a run Classic da NBA');
    const lb = run.leaderboardId || ('run:' + run.id), out = { v: 1, at: new Date().toISOString(), run: { id: run.id, name: run.name, ends: run.endsAt }, bands: ((run.reward || {}).bands || []).map(b => [+b.rankLow, +b.rankHigh, +b.amount, b.label || '']), qual: run.reward && run.reward.qualifier ? +run.reward.qualifier.rankHigh : null, accs: [], cut: {} };
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
        const d = { id: c.id, date: (String(c.id).match(/(\d{4}-\d{2}-\d{2})$/) || [])[1] || null, name: c.name, final: /FINAL/.test(c.status || ''), objs: (c.objectives || []).map(o => [o.statAbbreviation || o.statKey, +o.target]), accs: {}, asked: job.accs.map(a => String(a.a).replace(/^0x/, '').toLowerCase()) };
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
    const back = (job.back || 'https://joaped.github.io/fastbreak/') + '#fbranks=' + B64.enc(out);
    say('Feito: ' + out.accs.filter(x => x.found).length + ' contas na classificação. A voltar ao site…');
    try { localStorage.removeItem('fb-lugares'); } catch (e) {}
    setTimeout(() => { location.href = back; }, 900);
  } catch (err) { started = false; say('Não deu: ' + String(err.message || err).slice(0, 120) + '. Toca outra vez em <b>Leaderboard</b> para tentar de novo.'); S.tok = null; }
}
})()
