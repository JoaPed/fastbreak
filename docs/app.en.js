// GERADO por scripts/build-en.mjs a partir de docs/app.js e i18n/en.json — não editar à mão.
// Fastbreak Run Planner — site. Dados no Supabase; cálculo no browser (core.js → window.FB).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

const FB = window.FB;
const CFG = window.FB_CONFIG || {};
const STATS = FB.STATS, STATUS = FB.STATUS;
const TEAMS = ['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QLABEL = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };
const TABS = ['hoje', 'run', 'plantel', 'grupo', 'ajustes'];
const LIVE_STAT = { pts: 'points', reb: 'reboundsTotal', ast: 'assists', fg3: 'threePointersMade', stl: 'steals', blk: 'blocks', tov: 'turnovers', oreb: 'reboundsOffensive', dreb: 'reboundsDefensive', fgm: 'fieldGoalsMade', fga: 'fieldGoalsAttempted', fg3a: 'threePointersAttempted', ftm: 'freeThrowsMade', fta: 'freeThrowsAttempted', pip: 'pointsInThePaint' };
// estatísticas que se podem escolher como objetivo à mão (as da blockchain entram sozinhas)
const OBJ_STATS = ['pts', 'reb', 'ast', 'fg3', 'stl', 'blk', 'oreb', 'dreb', 'tov', 'ast-tov', 'fgm', 'fga', 'fg3a', 'ftm', 'fta', 'pip', 'pts+reb', 'pts+ast', 'pts+reb+ast', 'stl+blk'];
const AVG_SHOW = ['pts', 'reb', 'ast', 'fg3', 'stl', 'blk', 'tov', 'oreb', 'dreb', 'fgm', 'fga', 'fg3a', 'ftm', 'fta', 'pip'];

// peso da forma recente (últimos 5 e 10 jogos) nas médias: guardado neste browser
const FORM_LEVELS = [['0', 'Season only'], ['1', 'Normal'], ['1.5', 'Strong']];
let formLevel = '1';
try { const v = localStorage.getItem('fb-form'); if (FORM_LEVELS.some(x => x[0] === v)) formLevel = v; } catch (e) {}
FB.setForm(+formLevel);
const configured = CFG.supabaseUrl && !/SEU-PROJETO/.test(CFG.supabaseUrl) && CFG.supabaseKey && !/COLOCA/.test(CFG.supabaseKey);
const sb = configured ? createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

const S = {
  session: null, role: null, profile: null,
  runs: [], runId: null, days: [], players: new Map(), odds: {}, chainRuns: [], chainGames: [],
  mine: { roster: {}, plan: {} }, mineLoaded: false,
  group: { profiles: [], summaries: [], members: [], chain: [] },
  tab: 'hoje', result: null, calcError: null, pendingUses: {}, filter: '', sheetBack: null,
  invite: null, lastSummary: '', loading: true,
  acc: 'main', multi: null, smDraft: null, teams: {}, cmpSort: { col: 'proj', dir: -1 },
  injuries: {}, injAt: null, injOk: null, alerts: null, alertsOk: null, buy: { uses: 2, mode: 'new', results: null, pick: null },
  box: {},
};
const INJ_LABEL = FB.INJ_LABEL;
// sub-separadores de cada secção (o escolhido fica guardado neste aparelho)
const SUBS = {
  hoje: () => [['lineup', 'Lineup'], ['porque', 'Why'], ['comparar', 'Compare']],
  run: () => [['premios', 'Prizes'], ['dias', 'Days']].concat(S.multi ? [['contas', 'Accounts']] : []).concat([['analise', 'Analysis'], ['historico', 'History']]),
  plantel: () => [['plantel', 'Roster'], ['forma', 'Form'], ['lesoes', 'Injuries'], ['comprar', 'Buy'], ['vender', 'Sell'], ['colecao', 'Collection']],
  grupo: () => [['classif', 'Standings'], ['lineups', 'Lineups'], ['emprestimos', 'Loans']],
  ajustes: () => [['perfil', 'Profile'], ['prefs', 'Preferences']].concat(S.role === 'admin' ? [['admin', 'Admin']] : []).concat([['dados', 'Data']]),
};
S.sub = { hoje: 'lineup', run: 'premios', plantel: 'plantel', grupo: 'classif', ajustes: 'perfil' };
try { Object.assign(S.sub, JSON.parse(localStorage.getItem('fb-sub') || '{}')); } catch (e) {}
// cartões que se fecham na Jornada (Lesões e forma; Jogos do dia antes dos jogos): fechados mostram uma linha de resumo
S.fold = { lesoes: true, jogos: true };
try { Object.assign(S.fold, JSON.parse(localStorage.getItem('fb-fold') || '{}')); } catch (e) {}
const icoChev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
function foldCard(k, title, help, sum, body) {
  const shut = !!S.fold[k];
  return '<div class="card fold' + (shut ? ' shut' : '') + '"><div class="fold-head"><h2><button class="fold-btn" type="button" data-action="fold" data-k="' + k + '" aria-expanded="' + !shut + '">' + title + '</button> ' + help + '</h2><span class="small muted fold-s">' + sum + '</span>' + icoChev + '</div>' + (shut ? '' : body) + '</div>';
}
function subOf(tab) { const list = SUBS[tab](), cur = S.sub[tab]; return list.some(x => x[0] === cur) ? cur : list[0][0]; }
function setSub(tab, sub) { S.sub[tab] = sub; try { localStorage.setItem('fb-sub', JSON.stringify(S.sub)); } catch (e) {} }
function subBar(tab) {
  const cur = subOf(tab), counts = {};
  return '<nav class="subtabs" aria-label="Sections of ' + esc(tab) + '"><div class="subtabs-in" role="tablist">' + SUBS[tab]().map(([k, l]) => '<button type="button" role="tab" data-action="sub" data-stab="' + tab + '" data-sub="' + k + '" aria-selected="' + (cur === k) + '">' + l + (counts[k] ? '<span class="cnt" aria-label="' + counts[k] + ' on the injury report">' + counts[k] + '</span>' : '') + '</button>').join('') + '</div></nav>';
}
const injuredInRoster = () => Object.keys((S.mine || {}).roster || {}).filter(id => (S.injuries || {})[id] && !S.mine.roster[id].injIgnore);
// opções do motor: o que cada equipa concede e o relatório de lesões
// jogos seguidos (back-to-back): ajustar ou não (fica neste aparelho)
let b2bOn = true;
try { b2bOn = localStorage.getItem('fb-b2b') !== '0'; } catch (e) {}
try { if (localStorage.getItem('fb-luview') === 'pessoa') S.luView = 'pessoa'; } catch (e) {}
// aspeto: automático (segue o telemóvel), claro ou escuro (fica neste aparelho)
let theme = 'auto';
try { const t = localStorage.getItem('fb-theme'); if (t === 'light' || t === 'dark') theme = t; } catch (e) {}
// língua do site: 'pt' (app.js) ou 'en' (app.en.js, gerado por scripts/build-en.mjs); o index.html carrega a certa
const LANG = (() => { try { return localStorage.getItem('fb-lang') === 'en' ? 'en' : 'pt'; } catch (e) { return 'pt'; } })();
function setLang(l) { try { localStorage.setItem('fb-lang', l); } catch (e) {} location.reload(); }
// textos que estão no index.html (separadores, botões sem texto)
function staticTexts() {
  const tabs = { hoje: 'Matchday', run: 'Run', plantel: 'Players', grupo: 'Group', ajustes: 'Settings' };
  Object.entries(tabs).forEach(([k, label]) => { const b = $('t-' + k); if (b && b.lastChild && b.lastChild.nodeType === 3) b.lastChild.textContent = label; });
  const lbl = (id, text) => { const e = $(id); if (e) e.setAttribute('aria-label', text); };
  lbl('meBtn', 'Settings and profile');
  const nav = document.querySelector('.tabbar'); if (nav) nav.setAttribute('aria-label', 'Sections');
  const bg = document.querySelector('.sheet-bg'); if (bg) bg.setAttribute('aria-label', 'Close');
  const meta = $('runMeta'); if (meta && /carregar|Loading/.test(meta.textContent)) meta.textContent = 'Loading…';
  document.documentElement.lang = LANG === 'en' ? 'en' : 'en-GB';
}
function applyTheme(t) {
  theme = t;
  try { if (t === 'auto') localStorage.removeItem('fb-theme'); else localStorage.setItem('fb-theme', t); } catch (e) {}
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches, dark = t === 'dark' || (t === 'auto' && sys);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.setAttribute('content', t === 'auto' ? (/dark/.test(m.getAttribute('media') || '') ? '#0B1018' : '#EEF1F5') : dark ? '#0B1018' : '#EEF1F5'); });
}
// hint: o plano melhor que a procura em segundo plano encontrou (ponto de partida do cálculo; só fica se for melhor)
const engOpts = () => { const h = S.mine && S.mine.plan && S.mine.plan.hint, pr = prioAcc(); return Object.assign({ teams: S.teams, injuries: S.injuries, prevGames: S.prevGames || {}, b2b: b2bOn, rested: restedMap() }, h && h.acc && h.run === S.runId ? { hint: h.acc } : {}, pr ? { accWeights: { [pr]: PRIO_W } } : {}); };
// prioridade entre contas (com smurfs): a conta escolhida, ou a mais bem classificada na Geral (Automática); cada
// vitória esperada dela vale PRIO_W no plano conjunto. 'eq' = iguais
const PRIO_W = 1.2;
function prioAuto() {
  if (!S.session) return null; const uid = S.session.user.id; let best = null;
  accounts().forEach(a => { const r = rankOf(accAddr(uid, a.id)); if (r && r.rank != null && (!best || +r.rank < best.rank)) best = { id: a.id, rank: +r.rank }; });
  return best;
}
function prioAcc() {
  if (!S.mine || !S.mine.plan || accounts().length < 2) return null;
  const p = S.mine.plan.prio || 'auto';
  if (p === 'eq') return null;
  if (p !== 'auto') return accounts().some(a => a.id === p) ? p : null;
  const b = prioAuto(); return b ? b.id : null;
}
// quem não jogou nos últimos dias, apesar de a equipa ter jogado (descansou, lesão): no dia seguinte não é jogo seguido.
// Pelas fichas da ESPN do dia e pelos últimos jogos de cada um (tarefa das médias). {data: [ids]}
function restedMap() {
  const today = todayET(), out = {};
  const dates = [...new Set(S.days.map(d => d.date).filter(d => d < today).concat(Object.keys(S.prevGames || {})))].sort().slice(-2);
  dates.forEach(date => {
    const day = S.days.find(d => d.date === date), teams = day ? FB.teamsOn(day) : new Set((S.prevGames || {})[date] || []);
    Object.keys(S.mine.roster || {}).forEach(id => { if (teams.has(pTeam(id)) && didPlay(id, date) === false) (out[date] = out[date] || []).push(id); });
  });
  return out;
}
// jogou nesse dia? true · false (a equipa jogou e ele não) · undefined (não se sabe)
function didPlay(id, date) {
  const b = boxFor(date, id); if (b === null) return false; if (b && b.fin) return true;
  const c = S.players.get(String(canon(id))), f = c && c.avg && c.avg.form;
  if (!f || !Array.isArray(f.games) || !f.games.length) return undefined;
  const g = f.games.find(x => x[0] === date); if (g) return (+gameVals(g).min || 0) > 0;
  const ds = f.games.map(x => x[0]).sort(); return ds[ds.length - 1] > date && ds[0] < date ? false : undefined;
}
// siglas da ESPN → siglas do site
const ESPN_ABBR = { GS: 'GSW', NY: 'NYK', SA: 'SAS', NO: 'NOP', UTAH: 'UTA', WSH: 'WAS', PHO: 'PHX', BRK: 'BKN', CHO: 'CHA' };
const espnAbbr = a => { const x = String(a || '').toUpperCase(); return ESPN_ABBR[x] || x; };
// placar da ESPN de um dia (do browser): [{id, away, home, as, hs, state, detail, period}]
async function espnBoard(date) {
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + date.replace(/-/g, ''), { cache: 'no-store' });
  if (!res.ok) throw new Error('ESPN ' + res.status);
  return ((await res.json()).events || []).map(ev => {
    const c = (ev.competitions || [])[0] || {}, st = ev.status || c.status || {}, cs = c.competitors || [];
    const side = h => cs.find(x => x.homeAway === h) || {};
    return { id: ev.id, away: espnAbbr((side('away').team || {}).abbreviation), home: espnAbbr((side('home').team || {}).abbreviation), as: side('away').score, hs: side('home').score, state: (st.type || {}).state, detail: (st.type || {}).shortDetail || '', period: +st.period || 0, start: ev.date };
  });
}
// véspera do 1.º dia da run: quem jogou (para os jogos seguidos do dia 1)
async function loadPrevGames() {
  const d0 = (S.days[0] || {}).date; if (!d0) return;
  const p0 = (planOf('main').played || {})[d0]; if (d0 < todayET() || (p0 && p0.done)) return; // o dia 1 já passou: não faz falta (e evita refazer a run)
  const x = new Date(d0 + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); const prev = x.toISOString().slice(0, 10);
  if (S.prevGames && S.prevGames[prev]) return;
  try { const games = await espnBoard(prev); S.prevGames = { [prev]: games.flatMap(g => [g.away, g.home]).filter(Boolean) }; schedule(); } catch (e) { /* sem rede: o dia 1 fica sem jogos seguidos */ }
}

// ---------- picks do Fast Break (PredictionService do Top Shot, lidos pelo script com os lugares) ----------
// S.picksMine = {at, ev: [{id, t, d, lock, max, x, risk, n, home, away, o: [[nome, %pessoal, id NBA, lado, linha, stat]]}], cap, free}
try { S.picksMine = JSON.parse(localStorage.getItem('fb-picks') || 'null'); } catch (e) { S.picksMine = null; }
// (leituras feitas antes de o site saber dos picks guardaram-nos dentro dos lugares: também servem)
const picksDoc = () => [S.picksMine, S.ranksMine && S.ranksMine.picks].concat(((S.group || {}).summaries || []).flatMap(x => x.share ? [x.share.picks, x.share.ranks && x.share.ranks.picks] : [])).filter(d => d && d.at && Array.isArray(d.ev)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
const TEAM_FIX = { NO: 'NOP', GS: 'GSW', SA: 'SAS', NY: 'NYK', UTAH: 'UTA', WSH: 'WAS', PHO: 'PHX', BRK: 'BKN', CHO: 'CHA' };
const teamFix = a => { const x = String(a || '').toUpperCase(); return TEAM_FIX[x] || x; };
// probabilidade de a equipa da casa ganhar, pelas casas de apostas que a ESPN mostra (moneyline; sem ela, pelo spread)
S.gOdds = {};
function espnOdds(c) {
  const o = ((c && c.odds) || [])[0]; if (!o) return null;
  const ml = x => { if (x == null || x === '') return null; const v = +String(x).replace(/[^0-9+.-]/g, ''); return isFinite(v) && v ? FB.impliedProb(v) : null; };
  let h = ml((o.homeTeamOdds || {}).moneyLine), a = ml((o.awayTeamOdds || {}).moneyLine);
  if ((h == null || a == null) && o.moneyline) { const g = k => { const z = o.moneyline[k] || {}; return ml((z.close || z.current || z.open || {}).odds); }; h = g('home'); a = g('away'); }
  if (h != null && a != null && h + a > 0) return { pHome: h / (h + a), src: 'ml' };
  // "BOS -5.5": favorito e vantagem; a diferença final é ~normal com desvio de 12 pontos
  const m = /^([A-Z]{2,4})\s*(-?\d+(?:\.\d+)?)/.exec(String(o.details || ''));
  const cs = c.competitors || [], home = teamFix(((cs.find(x => x.homeAway === 'home') || {}).team || {}).abbreviation);
  if (m && +m[2] !== 0) { const pf = FB.normCdf(Math.abs(+m[2]) / 12); return { pHome: teamFix(m[1]) === home ? pf : 1 - pf, src: 'spread' }; }
  return null;
}
async function loadGameOdds(date) {
  const G = S.gOdds[date]; if (G && (G.busy || Date.now() - G.at < 30 * 60e3)) return;
  S.gOdds[date] = Object.assign(G || { m: {} }, { busy: true });
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + date.replace(/-/g, ''), { cache: 'no-store' });
    const js = res.ok ? await res.json() : { events: [] }, m = {};
    (js.events || []).forEach(ev => { const c = (ev.competitions || [])[0] || {}, cs = c.competitors || [], side = h => teamFix(((cs.find(x => x.homeAway === h) || {}).team || {}).abbreviation); const o = espnOdds(c); if (o) m[side('away') + '@' + side('home')] = o; });
    S.gOdds[date] = { at: Date.now(), m };
  } catch (e) { S.gOdds[date] = { at: Date.now(), m: (G && G.m) || {} }; }
  if (S.tab === 'hoje') render();
}
// probabilidade de cada opção de um pick (as nossas; null = só se sabe a % do pessoal)
function pickProbs(e, date) {
  if (e.t === 'game_winner' && e.home && e.away) {
    const M = (S.gOdds[date] || {}).m || {}, g0 = M[teamFix(e.away) + '@' + teamFix(e.home)], gr = M[teamFix(e.home) + '@' + teamFix(e.away)];
    const g = g0 || (gr ? { pHome: 1 - gr.pHome } : null); if (!g) return null;
    const hi = e.o.findIndex(o => e.hid && String(o[2]) === String(e.hid)); if (hi < 0) return null;
    return e.o.map((o, i) => (i === hi ? g.pHome : 1 - g.pHome));
  }
  // pontos de um jogador: as odds dele (linha e probabilidade de passar) dão a média e o desvio
  const find = catalogIndex(), dist = name => { const p = find(name); const od = p && (((S.odds[date] || {}).players || {})[p.id] || {}).pts; if (!od || od.line == null) return null;
    const pOver = FB.devig(od.over, od.under); if (pOver == null) return null; const sd = Math.max(4, 0.3 * od.line); return { mu: od.line + sd * FB.invNorm(pOver), sd }; };
  if (e.t === 'player_over_under' && e.o.length === 2) {
    const d = dist(String(e.d).replace(/^Will\s+/i, '').replace(/\s+record.*$/i, '')); const th = e.o[0][4]; if (!d || th == null) return null;
    const pOver = 1 - FB.normCdf((th - d.mu) / d.sd); return e.o.map(o => (o[3] === 'under' ? 1 - pOver : pOver));
  }
  if (e.t === 'player_duel' && e.o.length === 2) {
    const a = dist(e.o[0][0]), b = dist(e.o[1][0]); if (!a || !b) return null;
    const p0 = FB.normCdf((a.mu - b.mu) / Math.sqrt(a.sd * a.sd + b.sd * b.sd)); return [p0, 1 - p0];
  }
  return null;
}
function picksCard() {
  const P = picksDoc(); if (!P) return '';
  const now = Date.now(), ev = P.ev.filter(e => Date.parse(e.lock) > now && Date.parse(e.lock) - now < 30 * 3600e3);
  if (!ev.length) return '';
  const date = todayET(); if (ev.some(e => e.t === 'game_winner')) loadGameOdds(date);
  // o pick recomendado: o favorito mais seguro (odds mais baixas) para dobrar os pontos do dia; sem odds, pela % do pessoal
  const rows = ev.map(e => { const pr = pickProbs(e, date), crowd = e.o.map(o => o[1] / 100), use = pr || crowd, k = use.indexOf(Math.max(...use)); return { e, k, p: use[k], ours: !!pr, crowd: crowd[k] }; });
  const best = rows.filter(x => x.ours).sort((a, b) => b.p - a.p)[0] || rows.slice().sort((a, b) => b.p - a.p)[0];
  const e = best.e, o = e.o[best.k], other = e.o[1 - best.k] || [''], cap = P.cap || 100;
  const what = e.t === 'game_winner' ? '<b>' + esc(o[0]) + '</b> wins' : e.t === 'player_duel' ? '<b>' + esc(o[0]) + '</b> scores more than ' + esc(other[0]) : '<b>' + esc(String(e.d).replace(/^Will\s+/i, '').replace(/\s+record.*$/i, '')) + '</b> · ' + esc(o[0]);
  const team = e.t === 'game_winner' ? (String(o[2]) === String(e.hid) ? e.home : e.away) : null;
  return '<div class="card pick-card"><div class="pk-top"><span class="eyebrow">Pick of the day ' + helpBtn('picks') + '</span></div>' +
    '<div class="pk-main">' + (team ? teamLogo(teamFix(team)) : '') + '<div style="min-width:0;flex:1"><div class="pk-what">' + what + '</div><div class="ps">' + hm(Date.parse(e.lock)) + ' · ' + (best.ours ? 'odds ' + pct(best.p) + ' · crowd ' + Math.round(o[1]) + '%' : 'crowd ' + Math.round(o[1]) + '% (no odds yet)') + '</div></div>' +
    '<div class="pk-pts num"><b>' + cap + '</b><small>points</small></div></div></div>';
}

// ---------- utilidades ----------
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o == null ? {} : o));
const f1 = n => (Math.round(n * 10) / 10).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f0 = n => Math.round(n).toLocaleString('en-GB');
const f2 = n => (+n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = p => p < 0.005 ? '<1%' : p > 0.995 ? '>99%' : Math.round(p * 100) + '%';
const tone = p => p >= 0.65 ? 'good' : p >= 0.4 ? 'warn' : 'bad';
const dt = s => new Date(s + 'T12:00:00Z');
const dShort = s => { const d = dt(s); return d.getUTCDate() + ' ' + MO[d.getUTCMonth()]; };
const dWeek = s => WD[dt(s).getUTCDay()];
const hm = iso => { try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const ago = iso => { if (!iso) return 'never'; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); if (m < 2) return 'just now'; if (m < 60) return '' + m + ' min ago'; const h = Math.round(m / 60); if (h < 36) return '' + h + ' h ago'; return '' + Math.round(h / 24) + ' days ago'; };
const statShort = st => FB.statTerms(st).map((t, i) => (i ? (t.sign < 0 ? '−' : '+') : t.sign < 0 ? '−' : '') + ((STATS[t.s] || {}).short || t.s.toUpperCase())).join('');
const statLabel = st => FB.statTerms(st).map((t, i) => (i ? (t.sign < 0 ? ' − ' : ' + ') : t.sign < 0 ? '− ' : '') + ((STATS[t.s] || {}).label || t.s)).join('');
const objOne = o => o.target + '+ ' + statShort(o.stat) + (o.each ? ' each' : '');
// objetivo no placar grande: um por linha nos dias de combinação (sem o "e")
function goalBig(objs) {
  const l = (objs || []).filter(x => x && x.stat);
  if (!l.length) return '<div class="goal"><small>Goal not set</small></div>';
  const one = x => x.target + '<small>' + esc(statShort(x.stat)) + (x.each ? ' each' : '') + '</small>';
  return l.length === 1 ? '<div class="goal">' + one(l[0]) + '</div>' : '<div class="goal multi">' + l.map(x => '<span>' + one(x) + '</span>').join('') + '</div>';
}
// placar do dia: meia quadra ao fundo (linha de três pontos, garrafão, lance livre e aro), vista de cima
const COURT = '<svg class="court-b" viewBox="0 0 400 150" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path d="M20 150V112A180 180 0 0 1 380 112V150"/><rect x="140" y="40" width="120" height="110"/><path d="M140 40A60 60 0 0 1 260 40"/><path d="M140 40A60 60 0 0 0 260 40" stroke-dasharray="6 7"/><path d="M176 150V135M224 150V135M184 128h32"/><circle class="rim" cx="200" cy="120" r="7"/></svg>';
const BALL = '<svg viewBox="0 0 40 40" width="22" height="22" aria-hidden="true"><circle cx="20" cy="20" r="18.5" fill="#E8742F" stroke="#1a1208" stroke-width="1.6"/><path d="M1.5 20h37M20 1.5v37M7 7c6 5 6 21 0 26M33 7c-6 5-6 21 0 26" stroke="#1a1208" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="13" cy="11" rx="6" ry="3.5" fill="#fff" opacity=".18" transform="rotate(-30 13 11)"/></svg>';
// vitória do dia num anel que enche até à percentagem, com a bola na ponta
function winRing(P, tn, big, label) {
  const r = 40, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, P || 0)), a = -Math.PI / 2 + 2 * Math.PI * p;
  return '<div class="win-ring t-' + tn + '"><svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true"><circle class="wr-bg" cx="50" cy="50" r="47"/><circle class="wr-tr" cx="50" cy="50" r="40"/>' +
    (p > 0.004 ? '<circle class="wr-on" cx="50" cy="50" r="40" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 50 50)"/>' : '') + '</svg>' +
    '<span class="wr-ball" style="left:' + (50 + r * Math.cos(a) - 11).toFixed(1) + 'px;top:' + (50 + r * Math.sin(a) - 11).toFixed(1) + 'px">' + BALL + '</span>' +
    '<div class="wr-v"><b class="num">' + (big != null ? big : pct(P)) + '</b><span>' + (label || 'win') + '</span></div></div>';
}
// tom de um dia: cinzento quando o plano o dá por perdido (guarda os usos para outros dias)
const dTone = P => (P < 0.05 ? 'mute' : tone(P));
const objsText = day => { const list = ((day || {}).objectives || []).filter(o => o && o.stat); return list.length ? list.map(objOne).join(' and ') : 'Goal not set'; };
// de onde vem o valor esperado de um jogador (texto curto para as listas)
// seta de forma ao lado do valor: últimos 5 jogos acima/abaixo da média da época na estatística do dia
function formMark(p, o) {
  if (!o) return '';
  const f = FB.formInfo(p, o.stat); if (!f || !f.n5 || f.n5 < 3) return '';
  return f.trend >= 0.12 ? ' <i class="fm up" title="In form" aria-label="in form">▲</i>' : f.trend <= -0.12 ? ' <i class="fm down" title="Out of form" aria-label="out of form">▼</i>' : '';
}
function srcShort(info) {
  if (info.src === 'odds') return 'line ' + f1(info.line);
  if (info.src === 'proxy') return 'line from ' + ((STATS[info.via] || {}).short || info.via) + ' ' + f1(info.line);
  if (info.src === 'misto') return 'odds + average';
  if (info.src === 'media') return 'average';
  if (info.src === 'estimativa') return 'estimativa';
  return 'no data';
}
// ---------- lesões ----------
const injRec = id => (S.injuries || {})[id] || null;
// o mesmo jogador com dois nomes no catálogo ("Steph Curry" e "Stephen Curry"): fica um, o outro é alias dele
S.alias = new Map();
const canon = id => (id == null ? id : S.alias.get(String(id)) || String(id));
// primeiro nome igual, ou um começa pelo outro (Steph/Stephen, Herb/Herbert, Cam/Cameron)
const sameFirst = (a, b) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));
// odds decimais (as europeias: 1.91 = ganhas 1,91 por cada 1 apostado); a The Odds API dá-as americanas (+110 / −120)
const fmtOdd = x => { const a = +x; if (x == null || x === '' || !isFinite(a) || a === 0) return '–'; return (a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a)).toFixed(2); };
const INJ_PILL = { out: 'fora', ofs: 'fora', doubtful: 'dout', questionable: 'duv', dtd: 'duv', probable: 'prov' };
const INJ_SHORT = { out: 'Out', ofs: 'Out', doubtful: 'Q', questionable: 'Q', dtd: 'Q', probable: 'Prob.' };
function injLine(rec) {
  if (!rec) return '';
  return esc(INJ_LABEL[rec.status] || rec.label || rec.status) + (rec.detail ? ' · ' + esc(rec.detail) : '') + (rec.return_date ? ' · expected back ' + dShort(rec.return_date) : '');
}
// relatório de lesões nas fichas, com o botão para o ignorar
function injuryBlock(id, j, date) {
  const rec = injRec(id); if (!rec) return '';
  const ign = !!((S.mine.roster[id] || {}).injIgnore);
  let how = '';
  if (j && !ign && j.k != null) how = (j.k === 0 ? 'This is his next game' : 'This is his game no. ' + (j.k + 1) + ' from now') + ': ' + (j.status ? 'the plan assumes a ' + Math.round(STATUS[j.status].play * 100) + '% chance he plays.' : 'the plan already counts him as normal.');
  return '<div class="note' + (rec.status === 'probable' ? ' info' : '') + ' stack" style="gap:6px"><div><b>Injury report:</b> ' + injLine(rec) + '. <span class="small">(ESPN, ' + esc(ago(rec.updated_at)) + ')</span></div>' +
    (rec.comment ? '<div class="small">' + esc(rec.comment) + '</div>' : '') + (how ? '<div class="small">' + how + '</div>' : '') +
    (ign ? '<div class="small"><b>Report ignored</b>: the plan counts on him.</div>' : '') +
    ((S.mine.roster || {})[id] ? '<button class="btn small" type="button" data-action="inj-ignore" data-id="' + esc(id) + '"' + (date ? ' data-date="' + date + '"' : '') + ' data-on="' + (ign ? '0' : '1') + '">' + (ign ? 'Use the report again' : 'He’ll play (ignore the report)') + '</button>' : '') + '</div>';
}
// ---------- em que se baseia cada valor ----------
const formName = () => (FORM_LEVELS.find(x => x[0] === formLevel) || ['1', 'Normal'])[1];
function partBasis(p, part, md, id, opp) {
  const u = esc((STATS[part.stat] || {}).short || part.stat);
  const raw = (md.oddsDay || {})[id] || {};
  if (part.src === 'odds') {
    const o = raw[part.stat] || {};
    return '<b>Odds</b> for ' + u + ': line ' + f1(+o.line) + ' · over odds <b class="num">' + esc(fmtOdd(o.over)) + '</b> / under <b class="num">' + esc(fmtOdd(o.under)) + '</b>' + (o.books ? ' (consensus of ' + o.books + ' bookmaker' + (o.books > 1 ? 's' : '') + ')' : '') + ' → ' + pct(FB.devig(o.over, o.under)) + ' to go over the line, without the bookmaker margin → average <b class="num">' + f1(part.mu) + '</b>. The odds already account for form, opponent and minutes.';
  }
  if (part.src === 'proxy') {
    const o = raw[part.via] || {}, vs = esc((STATS[part.via] || {}).short || part.via), a = FB.avgOf(p, part.stat), aq = FB.avgOf(p, part.via);
    return '<b>No odds for ' + u + '</b>: uses the line for ' + vs + ' ' + f1(+o.line) + ' (' + pct(FB.devig(o.over, o.under)) + ' to go over) and the ratio ' + u + '/' + vs + ' in his averages (' + (a && aq && aq.v > 0 ? (a.v / aq.v).toLocaleString('en-GB', { maximumFractionDigits: 2 }) : '–') + ') → <b class="num">' + f1(part.mu) + '</b>.';
  }
  if (part.src === 'media' || part.src === 'estimativa') {
    const fi = FB.formInfo(p, part.stat) || {}, m = opp ? FB.matchup(S.teams, opp, part.stat) : null;
    let t = '<b>No odds</b>: averages for ' + u + ' — season ' + (fi.season != null ? f1(fi.season) : '–') + (fi.n10 ? ' · last 10 ' + (fi.l10 != null ? f1(fi.l10) : '–') + ' · last 5 ' + (fi.l5 != null ? f1(fi.l5) : '–') + (fi.used != null ? ' → with form (' + esc(formName().toLowerCase()) + ') ' + f1(fi.used) : '') : ' (no games this season yet)');
    if (part.src === 'estimativa') t += part.stat === 'pip' ? '. ESPN doesn\'t give points in the paint per player: estimated from 2-pointers made' : '. Estimated from his other averages (less certain)';
    if (m) t += '. Opponent ' + esc(opp) + ': allows ' + (m.f >= 1 ? '+' : '−') + Math.round(Math.abs(m.f - 1) * 100) + '% of this stat versus the league average → adjustment ' + (m.used >= 1 ? '+' : '−') + Math.round(Math.abs(m.used - 1) * 100) + '%';
    return t + ' → <b class="num">' + f1(part.mu) + '</b>.';
  }
  return 'No data for ' + u + '.';
}
function playBasis(info) {
  const j = info.injury, pp = pPlayOf(info);
  if (j && !j.ignored && j.risk) return '<b>Availability</b>: ' + pct(pp) + ' to play — injury report: ' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + (j.rec.detail ? ' (' + esc(j.rec.detail) + ')' : '') + '. The plan counts on him playing (100%), because you can swap him before his game if he is ruled out.';
  if (j && !j.ignored && j.status) return '<b>Availability</b>: ' + pct(pp) + ' to play — injury report: ' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + (j.rec.detail ? ' (' + esc(j.rec.detail) + ')' : '') + (j.k === 0 ? ', for his next game.' : ', in his game no. ' + (j.k + 1) + ' from now.') + (info.status !== j.status ? ' You set him as ' + esc(STATUS[info.status].label.toLowerCase()) + ' in the roster: the worse one counts.' : '');
  if (info.status !== 'ok') return '<b>Availability</b>: ' + pct(pp) + ' to play (status "' + esc(STATUS[info.status].label) + '" set by you in the roster).';
  if (j && j.ignored) return '<b>Availability</b>: 100% — you are ignoring the injury report for him.';
  if (j) return '<b>Availability</b>: 100% — he is on the report (' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + '), but ' + (j.k == null ? 'this game has already started or is over.' : 'for this game he already counts as normal.');
  return '<b>Availability</b>: 100% — not on the injury report' + (S.injOk && S.injAt ? ' (ESPN, ' + esc(ago(S.injAt)) + ')' : S.injOk === false ? ' (the report is not connected yet)' : '') + '.';
}
function basisHtml(p, info, o, md, id, many) {
  const g = FB.gameOf(md.day, p.team), opp = g ? (g[0] === p.team ? g[1] : g[0]) : null;
  const u = esc(statShort(o.stat)), parts = info.parts || [], steps = [];
  parts.forEach(part => steps.push((parts.length > 1 && part.sign < 0 ? 'Subtracting. ' : '') + partBasis(p, part, md, id, opp)));
  if (parts.length > 1) steps.push('<b>Sum</b>: ' + parts.map((x, i) => (x.sign < 0 ? '− ' : i ? '+ ' : '') + f1(x.mu) + ' ' + esc((STATS[x.stat] || {}).short || x.stat)).join(' ') + ' = ' + f1(info.muIf != null ? info.muIf : info.mu) + ' ' + u + '.');
  if (info.b2b) { const h = (p.avg || {}).hist, b = h && h.b2b, pc = Math.round((1 - info.b2b.f) * 100);
    steps.push('<b>Back-to-back</b>: played yesterday. ' + (info.src === 'odds' ? 'The odds already account for that.' : 'Without odds, counts ' + (pc > 0 ? pc + '% less' : pc < 0 ? Math.abs(pc) + '% more' : 'the same') + (b && b.n >= 6 ? ' (last season he played ' + plural(b.n, 'back-to-back game', 'back-to-back games') + ' and produced ' + Math.round(((b.r || {})[FB.statTerms(o.stat)[0].s] || 1) * 100) + '% of normal)' : ' (the usual in these games)') + '.')); }
  steps.push(playBasis(info));
  { const t0 = FB.statTerms(o.stat)[0].s, k = FB.kOf(p, t0), k0 = (STATS[t0] || {}).k, h = (p.avg || {}).hist;
    if (h && h.n >= 15 && k0) steps.push('<b>Consistency</b> (' + h.n + ' games last season): ' + (k / k0 >= 1.2 ? 'varies a lot from game to game' : k / k0 <= 0.85 ? 'is consistent, usually close to his average' : 'normal for this stat') + '.'); }
  const muIf = info.muIf != null ? info.muIf : info.mu;
  steps.push('<b>In the plan</b>: ' + (info.pPlay < 1 ? pct(info.pPlay) + ' × ' + f1(muIf) + ' = ' : '') + '<b class="num">' + f1(info.mu) + '</b> ' + u + ' expected (± ' + f1(Math.sqrt(info.v || 0)) + ').');
  return '<div class="card panel basis"><h2>What it is based on' + (many ? ' · ' + u : '') + '</h2><ol class="steps">' + steps.map(x => '<li>' + x + '</li>').join('') + '</ol></div>';
}
const icoShare = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
const icoLock = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-label="Locked"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
// ---------- ajuda: as explicações ficam atrás de um (?) ao lado dos títulos ----------
const HELP = {
  lineup: ['Lineup', 'The lineup the plan suggests for this day, with the whole run in mind: it may save players for days when they are worth more. The number on the right is what each one should score. In Change you lock, remove and add players one by one and see what that does to the run. Tap a player to see what it’s based on.'],
  aovivo: ['Live', 'When the first game starts, the app locks in who has already played, reads the points from ESPN every 2 minutes and redoes the rest of the run. When the lineup’s games end, the day closes by itself. If the lineup you submitted on Top Shot is different, fix it in Suggestions for today. Tap a lineup player to see his game’s stats. If ESPN fails during the game, the values come in when the game ends.'],
  opcoes: ['Suggestions for today', '<b>Before the games</b>: compares the plan with going all in today or saving a player for another day (to pick player by player yourself, use Change on the lineup).<br><b>During the games</b>: with the points already in, compares keeping, removing or saving whoever hasn’t played yet.<br>Each option redoes the whole run with the uses left; “the best” is the one that raises your prize chances the most. Removing a player before his game starts doesn’t spend the use.'],
  jogosdia: ['Games that day', 'Local time. Under each game, your players (the lineup in bold). During the games: live score and the numbers of the players in the lineup.'],
  lesoesforma: ['Injuries and form', '<b>Injuries</b>: ESPN report for who plays this day, with the chance the plan counts on. The report for the whole run is in Players → Injuries. <b>Form</b>: average of the last 5 games against the season’s, in the day’s stat.'],
  porque: ['What it’s based on', 'Bookmaker odds when there are any; otherwise season averages with form and opponent. Each player’s number (pp) is how much he adds to the day’s win: without him, the best one left would come in. “Saves others”: he’s here so someone better can be kept for another day. The ones left out are saved for other days or are worth less.'],
  comparar: ['Compare', 'All your players with a game this day. Big numbers: last 5 games; small: season. Opp.: how much the opponent allows of this stat. Tap a header to sort and a player to open his card.'],
  transf: ['Transfers', 'A Moment only plays for one account each night. Before the night shown, gift the Moment to the other account on Top Shot, then read the wallets again (Players → Collection).'],
  vender: ['Sell', 'Cards from all your accounts. Not used: players no account used or uses for the rest of the run (and in how many runs that already happened). Duplicates: players with more cards than the plan uses (each account that uses him n times needs a card with at least n uses, and each card plays for one account per night). Spare rare: the plan uses him a few times and a cheaper card, with fewer uses, is enough. Save: swap yours for one of the same player and rarity listed for less. Low ask = the cheapest listing of that edition; when selling Top Shot keeps 5%.'],
  premios: ['Prizes', 'Each ring is the chance of finishing the run with at least that many wins: full means certain. Green likely, yellow a toss-up, red hard. The plan picks the lineups to raise these chances.'],
  dist: ['Wins at the end', 'The chance of each win total at the end of the run. The colours mark the prize tiers; the outline is the most likely total.'],
  contas: ['Accounts', 'The plan pools your accounts’ collections as if they were one and picks each account’s lineup. Tap an account to see its prizes.'],
  picks: ['Pick of the day', 'Of today’s Fast Break picks (read on Top Shot when the admin updates), the safest one: the favourite with the lowest odds, to double the day’s points. The probability comes from the bookmakers (the game’s win line; for players, the points odds); «crowd» is the % of people who already picked it on Top Shot. Without odds, it goes by the crowd %.'],
  mudar: ['Change the lineup', 'Tap the lock to lock in who must play, the × to remove someone from this day (it leaves an empty spot: tap + to choose who comes in, or let the plan choose) and the + under Add to lineup to bring in a player the plan left out. The plan fills in the rest and redoes the run after each change. At the top you see what changes compared with the plan’s suggestion: the day’s win, the expected wins in the run, the prizes and the other days where someone comes in or goes out (uses spent today are no longer there). To undo, tap the lock again or Back to the plan’s suggestion.'],
  dias: ['Days', 'The whole run: each day’s goal, the plan’s lineup and the predicted win. For days already played, the result and the total made, which come in by themselves from the game stats. Tap a day to open it in Matchday.'],
  analise: ['Analysis', 'Each day’s prediction is saved until the first game. Then you see the prediction next to what happened: wins, totals and each player (100% = did as predicted). With few days, luck weighs a lot.'],
  historico: ['History', 'Your Fast Break days read from the blockchain, from every run. Older days come in little by little.'],
  plantel: ['Roster', 'Your players in this run. Uses: how many days they can still play (those of the best card: Common 1, Rare 2, Legendary 4; more cards of the same player don’t add up). The strip is the run’s days: used, in the plan, on the other account, has a game. Tap a player to change his uses, cards or status.'],
  cartas: ['Your cards', 'Each Moment with the rarity and ASP read on Top Shot. Rarity gives the minimum uses (Common 1, Rare 2, Legendary 4, Ultimate unlimited) and ASP can only raise them: up to $10 Draft Pick (1), up to $50 Starter (2), up to $300 All-Star (3), up to $1000 MVP (4), above that Hall of Fame (unlimited). The player gets the uses of his best card. Cards without Top Shot data: the site guesses the rarity from the set and the mint size, and you can pick the right one.'],
  colecao: ['Collection', 'Your Moments read from the blockchain (all accounts), saved in your profile for every run. Uses per run of each player: those of the best card. Moments of players outside this NBA season don’t count.'],
  comprar: ['Buy', 'A run é refeita com cada candidato: vês quanto sobem os prémios e em que dias ele jogaria. Usos por run: Common 1 (2 se o ASP passar dos 10 $), Rare 2, Legendary 4. “All” includes new players and a higher-tier Moment of players you already have (a Rare of someone you only have as a Common gives +1 use); “Upgrade yours” looks only at those. Num jogador que já tens, só ganha se o novo for de um escalão acima. Os preços não entram: esses vês tu no marketplace.'],
  especialistas: ['Specialists', 'The NBA’s best in each stat (this season mixed with last). Stats are ordered by how often they come up on Fast Break days; ● = it comes up in the rest of this run. <b>Specialist</b>: top of this stat but outside the top 75 scorers. <b>Steady/streaky</b>: how much he varies from game to game.'],
  forma: ['Run form', 'Pick one of the next days. Hot: your players who play that day with their last-5 average above the season (≥ 8%) in the goal’s stats. Cold: those in that day’s plan below the season. Minutes: who plays 3+ minutes more or less than his season average. Might play less: games the favourite wins 85%+ of the time (ESPN odds, only near the game) — if it’s decided early, stars rest or are spared. The bars are the last games (most recent on the right); the line is the season average.'],
  historic: ['Historic', 'Simulated games between legends (career averages, 36 minutes). You pick 5 within 350 Roster Points; whoever adds up the most Fast Break Points wins (PTS 1, REB 1, AST 2, STL 3, BLK 3, turnover −1, three +0.5, double-double +5, triple-double +10). Each legend’s expected points come from the simulated games so far, pulled towards what the cost predicts when there are few games, and from the opponent. The suggestion is the team that most often reaches the top 40 when the day is simulated 3000 times, compared with the scores that won prizes on similar days. + locks a legend, × takes him out of the day, tapping the name saves your card (the discount lowers the cost).'],
  prio: ['Priority between accounts', 'The plan joins your accounts and looks for the most prize money adding them up. Since prizes go to whoever gets furthest, it pays to put the best Moments together in one account, and without priority that can be either one. With priority, each expected win of the chosen account is worth 20% more and the best Moments go to it first; the other plays with the rest. <b>Automatic</b> = the best ranked in the Overall standings (from the places read on Top Shot). <b>Equal</b> = no priority.'],
  lesoes: ['Injuries', 'ESPN report. In the plan: out → doesn’t play; doubtful → 25%; questionable or day-to-day → 50%; probable → 90% (in his next game, and less in the following ones). In the player’s card you can ignore the report. In the rest of the NBA, by team, only the important ones show (20+ minutes or 12+ points); search a name or team to see everyone. Tap a player to see the full ESPN note.'],
  classif: ['Standings', 'Wins and losses of every account, smurfs included: as soon as the games end, days close with the box scores and the lineup each person shared. The rings are each person’s chance of reaching the prizes. The admin invites friends in Settings → Admin.'],
  lineups: ['Group lineups', 'For each day, the players each person’s plan puts in the lineup (it changes until the game), most picked on top, and who takes them. Lock: that person already locked him or he is already playing. Highlighted: the ones in your lineup for that day. «By person» shows each person’s lineup, with a ring on the players also in yours.'],
  emprestimos: ['Loans', 'Redoes your run with your friends’ Moments, only on days their plan doesn’t use them. It counts the uses of one of their Moments in a run. On Top Shot they gift you the Moment and you give it back after you play that day.'],
  partilha: ['Sharing', 'The group sees the lineup your plan suggests and your players’ uses, and can ask you for Moments on days you don’t use them. Your roster and plan stay yours.'],
  smurf: ['Smurf accounts', 'Up to 2 extra accounts of yours. The plan pools the collections and tells you which Moments to send to which account before each night (a Moment only plays for one account each night).'],
  flow: ['Flow address', 'Your Dapper wallet address: 0x and 16 letters or numbers (it’s in Dapper and in your Top Shot profile). It’s used to read your Moments and your results from the blockchain.'],
  avancado: ['Calculation', '<b>Back-to-backs</b>: in the 2nd of two games on consecutive days, without odds, the plan takes off ~3% (or what that player did in those games last season). <b>Form</b>: without odds, it mixes the season with the last 10 and 5 games (normal: 50/30/20%). The odds already account for both.'],
  dados: ['Data', 'Updated automatically: schedule and averages in the morning, odds in the afternoon and early evening (Lisbon time), blockchain and injuries every 30 minutes.'],
};
const helpBtn = k => '<button class="help-btn" type="button" data-action="help" data-k="' + k + '" aria-label="' + esc('Help: ' + (HELP[k] || ['?'])[0]) + '">?</button>';
// ajuda: numa folha aberta aparece ali mesmo, por baixo do título (toca outra vez para fechar); fora delas abre uma folha
function helpSheet(k, btn) {
  const h = HELP[k]; if (!h) return;
  if (btn && !$('sheet').hidden && $('sheetPanel').contains(btn)) {
    const id = 'help-' + k, cur = $(id);
    if (cur) { cur.remove(); btn.setAttribute('aria-expanded', 'false'); return; }
    const box = document.createElement('div'); box.id = id; box.className = 'note info help-text'; box.innerHTML = h[1];
    (btn.closest('.list-head') || btn.closest('h2, h3, .field-lbl') || btn).after(box);
    btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-controls', id);
    return;
  }
  openSheet('<h3>' + h[0] + '</h3><div class="help-text">' + h[1] + '</div>');
}
const todayET = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
function norm(name) {
  return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[.'’`]/g, '').replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
}
function colorFor(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return 'hsl(' + h + ' 55% 45%)'; }
function initials(name) { const p = String(name || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
// fotos dos jogadores (ESPN): o id da ESPN vem do catálogo (avg.espn, tarefa das médias) ou dos plantéis da ESPN lidos
// no browser (guardados neste aparelho uma vez por semana). Sem foto (ou se não carregar) fica a inicial na cor da equipa.
let HEADS = { at: 0, m: {} };
try { const h = JSON.parse(localStorage.getItem('fb-heads') || 'null'); if (h && h.m) HEADS = h; } catch (e) {}
const headWant = new Set(); let headTimer = null, headBusy = false;
function espnIdOf(id) { const c = S.players.get(String(canon(id))) || {}; return (c.avg && c.avg.espn) || HEADS.m[norm(nameOf(id))] || null; }
function face(id, cls) {
  const e = espnIdOf(id), t = pTeam(id);
  if (!e && t && Date.now() - (HEADS.at || 0) > 864e5) { headWant.add(t); clearTimeout(headTimer); headTimer = setTimeout(loadHeads, 400); }
  return '<span class="face' + (cls ? ' ' + cls : '') + '" style="--av:' + (TEAM_COLOR[t] || 'var(--muted)') + '" aria-hidden="true"><b>' + esc(initials(nameOf(id))) + '</b>' +
    (e ? '<img src="https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/' + encodeURIComponent(e) + '.png&w=96&h=70" width="96" height="70" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</span>';
}
// plantéis das equipas que faltam → {nome: id}; uma vez por dia no máximo
async function loadHeads() {
  if (headBusy || !headWant.size) return; headBusy = true;
  const want = [...headWant]; headWant.clear();
  try {
    const tj = await (await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams')).json();
    const teams = ((((tj.sports || [])[0] || {}).leagues || [])[0] || {}).teams || [];
    const ids = {}; teams.forEach(x => { const t = x.team || {}; ids[espnAbbr(t.abbreviation)] = t.id; });
    let n = 0;
    await Promise.all(want.filter(t => ids[t]).map(async t => {
      try {
        const rj = await (await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/' + ids[t] + '/roster')).json();
        let list = rj.athletes || []; if (list.length && Array.isArray(list[0].items)) list = list.flatMap(g => g.items || []);
        list.forEach(a => { if (a && a.id && a.displayName) { HEADS.m[norm(a.displayName)] = String(a.id); n++; } });
      } catch (e) { /* sem rede: fica a inicial */ }
    }));
    HEADS.at = Date.now();
    try { localStorage.setItem('fb-heads', JSON.stringify(HEADS)); } catch (e) {}
    if (n) render();
  } catch (e) { HEADS.at = Date.now(); }
  finally { headBusy = false; }
}
function avatar(id, name) { return '<span class="avatar" style="--av:' + colorFor(id) + '" aria-hidden="true">' + esc(initials(name)) + '</span>'; }

function toast(msg) {
  const t = $('toast'); t.hidden = false; t.textContent = msg;
  // o leitor de ecrã só anuncia mudanças numa região viva já visível: volta a pôr o texto logo a seguir
  requestAnimationFrame(() => { if (!t.hidden) { t.textContent = ''; t.textContent = msg; } });
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2800);
}
function errText(e) {
  const m = String((e && (e.message || e.error_description)) || e || '');
  if (/Invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/already registered|already been registered/i.test(m)) return 'There is already an account with this email. Use “Sign in”.';
  if (/Password should be at least/i.test(m)) return 'The password needs at least 6 characters.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts in a row. Wait a minute.';
  if (/Email not confirmed/i.test(m)) return 'You still need to confirm your email. Open the message you received.';
  if (/Código de convite errado/.test(m)) return 'Wrong invite code. Ask whoever invited you.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No connection to the server. Check your internet.';
  return m || 'Something went wrong. Try again.';
}
async function q(promise) { const { data, error } = await promise; if (error) throw error; return data; }

// ---------- entrada (login, convite, perfil) ----------
function showGate(html) { $('app').hidden = true; $('gate').hidden = false; $('gate').innerHTML = '<div class="gate"><div class="card gate-card">' + html + '</div></div>'; }
function brand() { return '<h1 class="brand">Fastbreak<br><span>Run Planner</span></h1>'; }

function renderAuth(mode, err) {
  mode = mode || 'login';
  showGate(brand() +
    '<p class="small muted" style="margin:0">Plan the lineups for the whole run and follow your group.</p>' +
    '<form id="authForm" class="stack" novalidate>' +
    (mode === 'signup' ? '<label>Name the group sees<input class="field" id="auName" autocomplete="nickname" maxlength="40" required></label>' : '') +
    '<label>Email<input class="field" id="auEmail" type="email" autocomplete="email" required></label>' +
    '<label>Password<input class="field" id="auPass" type="password" autocomplete="' + (mode === 'signup' ? 'new-password' : 'current-password') + '" minlength="6" required></label>' +
    (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') +
    '<button class="btn primary" type="submit" id="auSubmit">' + (mode === 'signup' ? 'Create account' : 'Sign in') + '</button></form>' +
    '<button class="btn link" type="button" data-action="auth-mode" data-mode="' + (mode === 'signup' ? 'login' : 'signup') + '">' + (mode === 'signup' ? 'I already have an account: sign in' : 'I don\'t have an account yet: create one') + '</button>');
  $('authForm').dataset.mode = mode;
  setTimeout(() => { const f = $(mode === 'signup' ? 'auName' : 'auEmail'); if (f) f.focus(); }, 30);
}
async function submitAuth(form) {
  const mode = form.dataset.mode;
  const email = $('auEmail').value.trim(), password = $('auPass').value;
  const name = mode === 'signup' ? $('auName').value.trim() : '';
  if (!email || !password || (mode === 'signup' && !name)) { renderAuth(mode, 'Fill in all the fields.'); return; }
  $('auSubmit').disabled = true;
  try {
    if (mode === 'signup') {
      const data = await q(sb.auth.signUp({ email, password, options: { data: { name } } }));
      if (!data.session) { renderAuth('login', 'Account created. Confirm the email you received and then sign in.'); return; }
      sessionStorageSet('fb-pending-name', name);
    } else {
      await q(sb.auth.signInWithPassword({ email, password }));
    }
    await afterLogin();
  } catch (e) { renderAuth(mode, errText(e)); }
}
function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

async function afterLogin() {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  if (!S.session) { renderAuth(); return; }
  let status;
  try { status = await q(sb.rpc('group_status')); }
  catch (e) { showGate(brand() + '<div class="err">' + esc(errText(e)) + '</div><p class="small muted">If you just created the project, make sure you ran the file <span class="kbd">supabase/schema.sql</span> in the SQL Editor.</p><button class="btn" type="button" data-action="logout">Sign out</button>'); return; }
  S.role = status && status.role;
  if (!S.role) { renderJoin(!!(status && status.has_members)); return; }
  await loadProfile();
  if (!S.profile || !S.profile.display_name) { renderProfileSetup(); return; }
  await enterApp();
}
function renderJoin(hasMembers, err) {
  showGate(brand() + (hasMembers
    ? '<p style="margin:0">To join the group you need the invite code.</p><form id="joinForm" class="stack"><label>Invite code<input class="field" id="joinCode" autocomplete="off" spellcheck="false" autocapitalize="none" required></label>' + (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') + '<button class="btn primary" type="submit">Join the group</button></form>'
    : '<p style="margin:0">There is nobody in the group yet. You become the <b>admin</b>: you create the runs, set the goals and choose the invite code for your friends.</p>' + (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') + '<form id="joinForm"><button class="btn primary" type="submit" style="width:100%">Create the group</button></form>') +
    '<button class="btn link" type="button" data-action="logout">Sign out of this account</button>');
  $('joinForm').dataset.has = hasMembers ? '1' : '';
}
async function submitJoin(form) {
  const code = $('joinCode') ? $('joinCode').value.trim() : null;
  try { S.role = await q(sb.rpc('join_group', { code })); await afterLogin(); }
  catch (e) { renderJoin(!!form.dataset.has, errText(e)); }
}
async function loadProfile() {
  const uid = S.session.user.id;
  S.profile = await q(sb.from('profiles').select('*').eq('user_id', uid).maybeSingle());
}
function renderProfileSetup(err) {
  const meta = (S.session.user.user_metadata || {});
  const name = sessionStorageGet('fb-pending-name') || meta.name || '';
  showGate(brand() + '<p style="margin:0">Only your profile is missing. Your Top Shot username is used to read your results from the blockchain.</p>' +
    '<form id="profForm" class="stack"><label>Name the group sees<input class="field" id="pfName" maxlength="40" value="' + esc(name) + '" required></label>' +
    '<label>Top Shot username (optional)<input class="field" id="pfTs" maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false" value="' + esc((S.profile || {}).topshot_username || '') + '"></label>' +
    (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') + '<button class="btn primary" type="submit">Continue</button></form>');
}
async function submitProfile(nameEl, tsEl, flowEl, smurfs) {
  const ts = tsEl.value.trim().replace(/^@+/, '').replace(/^https?:\/\/[^/]*\/user\/@?/i, '');
  const row = { user_id: S.session.user.id, display_name: nameEl.value.trim().slice(0, 40), topshot_username: ts || null };
  if (flowEl) { const fa = flowEl.value.trim(); if (fa && !/^0x[0-9a-fA-F]{16}$/.test(fa)) throw new Error('The Flow address has the format 0x followed by 16 characters.'); row.flow_address = fa || null; }
  if (!row.display_name) throw new Error('Write your name.');
  if (smurfs !== undefined && (smurfs.length || 'smurfs' in (S.profile || {}))) row.smurfs = smurfs; // base de dados antiga sem a coluna: só falha quem quer smurfs
  try { await q(sb.from('profiles').upsert(row, { onConflict: 'user_id' })); }
  catch (e) { if (/smurfs/.test(errText(e))) throw new Error('To save smurf accounts, the admin has to run the new supabase/schema.sql in Supabase (SQL Editor).'); throw e; }
  S.profile = Object.assign({}, S.profile, row);
}

// ---------- carregar dados ----------
async function enterApp() {
  $('gate').hidden = true; $('app').hidden = false;
  try { const t = localStorage.getItem('fb-tab3'); if (TABS.includes(t)) S.tab = t; } catch (e) {}
  setTabUI();
  S.loading = true; render();
  try {
    await loadShared();
    await loadRun(pickRun());
    await loadAlerts();
    if (S.switchedTo) { toast('Showing the active run: ' + S.switchedTo + '. Other runs in Settings → Preferences.'); S.switchedTo = null; }
  } catch (e) { console.error(e); toast(errText(e)); }
  S.loading = false; schedule();
}
async function loadShared() {
  const [runs, players, chainRuns, teams] = await Promise.all([
    q(sb.from('runs').select('*').order('start_date', { ascending: false })),
    fetchAll('nba_players', 'id,name,team,avg,gp,updated_at'),
    q(sb.from('chain_runs').select('*').order('run_start', { ascending: false }).limit(40)),
    q(sb.from('nba_teams').select('id,stats')).catch(() => []), // o que cada equipa concede (sem a tabela: vazio)
    loadInjuries(),
  ]);
  S.teams = {}; (teams || []).forEach(t => { S.teams[t.id] = t.stats || {}; });
  S.runs = runs || [];
  S.players = new Map((players || []).map(p => [String(p.id), p]));
  S.chainRuns = chainRuns || [];
  dedupeCatalog();
}
// junta jogadores repetidos no catálogo: mesma equipa, mesmo apelido e o primeiro nome igual ou abreviado.
// Fica o que tem mais jogos (e médias); o outro passa a alias (odds, lesões e planos dos amigos seguem para o que fica)
function dedupeCatalog() {
  const groups = new Map();
  S.players.forEach(p => { const w = norm(p.name).split(' '); if (w.length < 2 || !p.team) return; const k = p.team + '|' + w.slice(1).join(' '); (groups.get(k) || groups.set(k, []).get(k)).push({ p, first: w[0] }); });
  S.alias = new Map();
  groups.forEach(list => {
    if (list.length < 2) return;
    list.sort((a, b) => ((+b.p.gp || 0) - (+a.p.gp || 0)) || ((b.p.avg ? 1 : 0) - (a.p.avg ? 1 : 0)) || (b.first.length - a.first.length));
    const keep = [];
    list.forEach(x => { const k = keep.find(y => sameFirst(x.first, y.first)); if (k) S.alias.set(String(x.p.id), String(k.p.id)); else keep.push(x); });
  });
  S.alias.forEach((to, from) => S.players.delete(from));
  if (S.alias.size) { const inj = {}; Object.entries(S.injuries || {}).forEach(([id, r]) => { if (!inj[canon(id)]) inj[canon(id)] = r; }); S.injuries = inj; }
}
// ids de jogadores num documento (plano, partilha): troca os alias pelo jogador que fica, nas chaves e nos valores
function canonDeep(x, map) {
  if (Array.isArray(x)) return x.map(v => (typeof v === 'string' && map.has(v) ? map.get(v) : canonDeep(v, map)));
  if (x && typeof x === 'object') { const o = {}; Object.entries(x).forEach(([k, v]) => { const k2 = map.has(k) ? map.get(k) : k; o[k2] = k2 !== k && o[k2] !== undefined ? o[k2] : canonDeep(v, map); }); return o; }
  return x;
}
// plantel com o mesmo jogador duas vezes (um à mão com outro nome, ou um id antigo): junta no jogador do catálogo
function mergeDuplicates() {
  const R = S.mine.roster || {}, find = catalogIndex(), map = new Map(S.alias);
  Object.keys(R).forEach(id => { if (!map.has(id) && !S.players.has(id)) { const m = R[id].name && find(R[id].name); if (m && String(m.id) !== id) map.set(id, String(m.id)); } });
  const moves = Object.keys(R).filter(id => map.has(id));
  if (!moves.length) return;
  const names = [];
  moves.forEach(from => {
    const to = map.get(from), e = R[from], c = R[to];
    if (c) { c.uses = Math.max(+c.uses || 0, +e.uses || 0); if (e.usesManual) c.usesManual = true; if (e.su && !c.su) c.su = e.su; }
    else { const n = Object.assign({}, e); delete n.name; delete n.team; R[to] = n; }
    delete R[from]; names.push(nameOf(to));
  });
  S.mine.plan = canonDeep(S.mine.plan || {}, map);
  saveMine();
  toast('Duplicate player merged: ' + names.join(', ') + '.');
}
// relatório de lesões (ESPN), guardado pela tarefa "Lesões"
async function loadInjuries() {
  let rows = null;
  try { rows = await q(sb.from('injuries').select('*')); } catch (e) { rows = null; }
  S.injuries = {}; S.injAt = null; S.injOk = rows != null;
  (rows || []).forEach(r => { const k = canon(r.id); if (!S.injuries[k]) S.injuries[k] = r; if (!S.injAt || r.updated_at > S.injAt) S.injAt = r.updated_at; });
}
async function loadAlerts() {
  try { S.alerts = await q(sb.from('alerts').select('*').eq('user_id', S.session.user.id).maybeSingle()) || {}; S.alertsOk = true; }
  catch (e) { S.alerts = {}; S.alertsOk = false; }
}
async function fetchAll(table, cols, filter) {
  const out = []; const size = 1000;
  for (let from = 0; from < 20000; from += size) {
    let qy = sb.from(table).select(cols); if (filter) qy = filter(qy);
    const rows = await q(qy.range(from, from + size - 1));
    out.push(...(rows || []));
    if (!rows || rows.length < size) break;
  }
  return out;
}
function pickRun() {
  let saved = null, savedAct = null; try { saved = localStorage.getItem('fb-run'); savedAct = localStorage.getItem('fb-run-act'); } catch (e) {}
  const act = S.runs.find(r => r.active);
  // uma run ficou ativa depois da última escolha (p. ex. a run nova lida da blockchain): passa para ela
  if (act && saved && saved !== act.id && savedAct !== act.id) { S.switchedTo = act.name; return act.id; }
  if (saved && S.runs.some(r => r.id === saved)) return saved;
  return act ? act.id : (S.runs[0] ? S.runs[0].id : null);
}
async function loadRun(runId) {
  S.runId = runId; S.days = []; S.odds = {}; S.prevGames = {}; S.board = null; S.mine = { roster: {}, plan: {} }; S.mineLoaded = false; S.pendingUses = {}; S.lastSummary = '';
  S.group = { profiles: [], summaries: [], members: [], chain: [] }; S.chainGames = [];
  try { localStorage.setItem('fb-run', runId || ''); localStorage.setItem('fb-run-act', (S.runs.find(r => r.active) || {}).id || ''); } catch (e) {}
  if (!runId) { schedule(); return; }
  const uid = S.session.user.id;
  const run = S.runs.find(r => r.id === runId);
  const [days, mine, cgames] = await Promise.all([
    q(sb.from('run_days').select('*').eq('run_id', runId).order('date')),
    q(sb.from('user_runs').select('*').eq('run_id', runId).eq('user_id', uid).maybeSingle()),
    run && run.chain_run_id ? q(sb.from('chain_games').select('id,num_players').eq('run_id', run.chain_run_id)).catch(() => []) : Promise.resolve([]),
  ]);
  // jogadores por lineup em cada dia (vem da blockchain; 5 por defeito)
  const np = new Map((cgames || []).map(g => [g.id, +g.num_players || null]));
  S.days = (days || []).map(d => ({ date: d.date, objectives: d.objectives || [], games: d.games || [], chain_game_id: d.chain_game_id, numPlayers: np.get(d.chain_game_id) || null }));
  S.mine = mine ? { roster: mine.roster || {}, plan: mine.plan || {} } : { roster: {}, plan: {} };
  S.mineSeen = mine ? Date.parse(mine.updated_at) : 0; S.mineBase = clone(S.mine);
  S.mineLoaded = true;
  mergeDuplicates();
  syncTierUses();
  await loadOdds();
  await loadGroup();
  applyChainResults();
  schedule();
  loadPrevGames();
}
// odds dos dias da run (chegam à tarde): lidas ao abrir a run, ao voltar ao site e de 10 em 10 minutos.
// Devolve true se chegaram odds novas.
async function loadOdds() {
  if (!S.runId || !S.days.length) return false;
  const runId = S.runId, dates = S.days.map(d => d.date);
  const rows = await q(sb.from('odds_days').select('*').gte('date', dates[0]).lte('date', dates[dates.length - 1]));
  S.oddsAt = Date.now();
  if (runId !== S.runId) return false;
  let changed = false;
  (rows || []).forEach(o => { const cur = S.odds[o.date]; if (!cur || cur.updated_at !== o.updated_at) { S.odds[o.date] = S.alias.size ? Object.assign({}, o, { players: canonDeep(o.players || {}, S.alias) }) : o; changed = true; } });
  return changed;
}
async function refreshOdds() {
  try {
    const nd = nextDay && S.result ? nextDay() : null, had = !!(nd && S.odds[nd.date] && Object.keys(S.odds[nd.date].players || {}).length);
    if (await loadOdds()) { schedule(); if (nd && !had && S.odds[nd.date] && Object.keys(S.odds[nd.date].players || {}).length) toast('Today\'s odds arrived: the plan was redone with them.'); }
  } catch (e) { /* sem rede: fica como está */ }
}
async function loadGroup() {
  if (!S.runId) return;
  const run = S.runs.find(r => r.id === S.runId) || {};
  const [profiles, summaries, members, chain] = await Promise.all([
    q(sb.from('profiles').select('user_id,display_name,topshot_username,flow_address,smurfs,share_plan,updated_at,tl:collection->tl')).catch(() => q(sb.from('profiles').select('*'))), // sem as coleções dos outros (pesadas), só os escalões que marcaram
    q(sb.from('summaries').select('*').eq('run_id', S.runId)),
    q(sb.from('members').select('*')),
    run.chain_run_id ? q(sb.from('chain_results').select('*').eq('chain_run_id', run.chain_run_id)) : Promise.resolve([]),
  ]);
  groupTierLabels(profiles || []);
  takeRanksHash();
  S.group = { profiles: profiles || [], summaries: (summaries || []).map(x => (x.share && S.alias.size ? Object.assign({}, x, { share: canonDeep(x.share, S.alias) }) : x)), members: members || [], chain: chain || [], loaded: true };
  adoptMine();
  if (S.mineLoaded) syncTierUses(); // raridade e ASP das cartas lidos por alguém do grupo
  if (S.edReview && S.edPending && edOn()) { S.edReview = false; setTimeout(edReviewSheet, 900); }
  if (S.runReview && S.runRead) { S.runReview = false; setTimeout(runReviewSheet, 900); } // run lida no Top Shot: mostra o que muda // leitura nova: mostra o que muda antes de aplicar
}
// os lugares e preços que eu li noutro sítio (o Safari e a app do ecrã principal guardam coisas à parte, ou outro
// aparelho) vêm do meu resumo publicado; sem isto, o resumo seguinte publicava-se sem eles e desapareciam para todos
function adoptMine() {
  const me = S.session && S.session.user.id, own = ((S.group || {}).summaries || []).find(x => x.user_id === me), sh = own && own.share;
  if (!sh) return;
  if (sh.px && sh.px.at && sh.px.p && (!S.pxMine || !S.pxMine.at || sh.px.at > S.pxMine.at)) { S.pxMine = sh.px; S.pxIdx = null; try { localStorage.setItem('fb-px', JSON.stringify(sh.px)); } catch (e) {} }
  if (sh.picks && sh.picks.at && Array.isArray(sh.picks.ev) && (!S.picksMine || !S.picksMine.at || sh.picks.at > S.picksMine.at)) { S.picksMine = sh.picks; try { localStorage.setItem('fb-picks', JSON.stringify(sh.picks)); } catch (e) {} }
  if (sh.ed && sh.ed.at && sh.ed.p && (!S.edMine || !S.edMine.at || sh.ed.at > S.edMine.at)) { S.edMine = sh.ed; S.edIdx = null; try { localStorage.setItem('fb-ed', JSON.stringify(sh.ed)); } catch (e) {} }
  if (sh.hist && sh.hist.at && Array.isArray(sh.hist.days) && (!S.histMine || !S.histMine.at || sh.hist.at > S.histMine.at)) { S.histMine = sh.hist; try { localStorage.setItem('fb-hist', JSON.stringify(sh.hist)); } catch (e) {} }
  if (sh.ranks && sh.ranks.at && (!S.ranksMine || !S.ranksMine.at || sh.ranks.at > S.ranksMine.at)) { S.ranksMine = sh.ranks; try { localStorage.setItem('fb-ranks', JSON.stringify(sh.ranks)); } catch (e) {} }
}

// ---------- lugares na run do Top Shot (script "FB lugares" na página do Fast Break, com a sessão de quem o corre) ----------
// O site manda as contas do grupo em #fbsync=...; o script devolve #fbranks=... com o lugar e as vitórias de cada uma.
// Ficam no resumo publicado de quem atualizou (share.ranks) e todos usam o mais recente.
const b64u = { enc: o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), dec: x => JSON.parse(decodeURIComponent(escape(atob(x.replace(/-/g, '+').replace(/_/g, '/'))))) };
const addrKey = a => String(a || '').replace(/^0x/, '').toLowerCase();
try { S.ranksMine = JSON.parse(localStorage.getItem('fb-ranks') || 'null'); } catch (e) { S.ranksMine = null; }
// endereço da pasta do site (funciona com e sem a barra no fim: …/fastbreak e …/fastbreak/)
const siteBase = () => location.origin + (/\.[a-z]+$/i.test(location.pathname) ? location.pathname.replace(/[^/]*$/, '') : location.pathname.replace(/\/?$/, '/'));
function takeRanksHash() {
  const m = location.hash.match(/fbranks=([A-Za-z0-9_-]+)/); if (!m) return;
  try {
    const d = b64u.dec(m[1]);
    if (d && d.px && d.px.p) { pxTake(d.px); delete d.px; }
    if (d && d.pro && d.pro.p) { S.proMine = d.pro; S.proMemo = null; try { localStorage.setItem('fb-pro', JSON.stringify(d.pro)); } catch (e) {} S.pickNote = (S.pickNote || '') + ' Pro: prices for ' + Object.keys(d.pro.p).length + ' players' + (d.pro.err ? ' (' + d.pro.err + ')' : '') + '.'; delete d.pro; }
    // que script correu: sem "sv" (ou antigo) é o automático antigo, que não lê os picks
    S.pickNote = !d || !Array.isArray(d.accs) || (Array.isArray(d.do) && !d.do.includes('picks')) ? null : d.picks && Array.isArray(d.picks.ev) ? ' Picks: ' + d.picks.ev.length + ' games.' : d.picksErr ? ' Picks: failed (' + d.picksErr + ').' : (+d.sv || 0) < 8 ? ' Picks: the Top Shot script is old — if you use the automatic one (Tampermonkey/Userscripts), reinstall it or turn it off and use the bookmark.' : ' Picks: none open.';
    if (d && d.picks && Array.isArray(d.picks.ev)) { S.picksMine = d.picks; try { localStorage.setItem('fb-picks', JSON.stringify(d.picks)); } catch (e) {} delete d.picks; }
    if (d && d.hist && Array.isArray(d.hist.days)) { histTake(d.hist); delete d.hist; }
    else if (d && d.histErr) S.pickNote = (S.pickNote || '') + ' Historic: failed (' + d.histErr + ').';
    if (d && d.ed && d.ed.p) { edTake(d.ed); S.edNew = { n: Object.keys(d.ed.p).length, err: d.ed.err || null }; delete d.ed; }
    if (d && Array.isArray(d.do) && d.do.includes('run')) { S.runRead = { at: d.at, runs: Array.isArray(d.runs) ? d.runs : [], err: d.runErr || null }; S.runReview = true; S.pickNote = (S.pickNote || '') + (d.runs ? ' Run: ' + (d.runs.length ? d.runs.map(r => r.days.length + ' days').join(', ') : 'no Classic run') + '.' : ' Run: didn’t work (' + (d.runErr || '?') + ').'); delete d.runs; }
    const gotRanks = d && Array.isArray(d.accs) && (!Array.isArray(d.do) || d.do.includes('ranks') || d.do.includes('lu'));
    if (d && !gotRanks) setTimeout(() => toast('Read on Top Shot.' + (S.pxNew != null ? ' Prices for ' + S.pxNew + ' players' + (S.pxMissN ? ' (' + S.pxMissN + ' not found)' : '') + '.' : '') + (S.edNew ? (S.edNew.err ? ' Cards: ' + S.edNew.err + '.' : ' Rarity and ASP of the cards of ' + S.edNew.n + ' players.') : '') + (S.pickNote || '')), 300);
    if (gotRanks) { const luN = (d.days || []).reduce((t, x) => t + Object.values(x.accs || {}).filter(a => a.lu && a.lu.length).length, 0), luD = (d.days || []).length; const old = groupRanks(); d.days = mergeRankDays((old && old.run && d.run && old.run.id === d.run.id ? old.days : null) || [], d.days || []); S.ranksMine = d; try { localStorage.setItem('fb-ranks', JSON.stringify(d)); } catch (e) {} setTimeout(() => toast('Ranks updated: ' + d.accs.filter(x => x.found).length + ' accounts on the Top Shot leaderboard.' + (Array.isArray(d.do) && d.do.includes('lu') ? ' Lineups: ' + luN + ' in ' + plural(luD, 'day', 'days') + '.' : '') + (S.pxNew != null ? ' Prices for ' + S.pxNew + ' players' + (S.pxMissN ? ' (' + S.pxMissN + ' not found on Top Shot)' : '') + '.' : '') + (S.edNew ? (S.edNew.err ? ' Cards: ' + S.edNew.err + '.' : ' Rarity and ASP of the cards of ' + S.edNew.n + ' players.') : '') + (S.pickNote || '')), 300); S.lastSummary = ''; }
  } catch (e) { console.warn('lugares', e); }
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
}
// junta os dias (lugar de cada conta em cada dia): os novos por cima dos antigos, conta a conta
function mergeRankDays(a, b) {
  const by = new Map(); (a || []).forEach(d => by.set(d.id, JSON.parse(JSON.stringify(d))));
  // conta a conta junta os campos (uma leitura só dos lugares não apaga o lineup lido antes)
  (b || []).forEach(d => { const o = by.get(d.id); if (!o) { by.set(d.id, d); return; } const accs = Object.assign({}, o.accs); Object.entries(d.accs || {}).forEach(([k, v]) => { accs[k] = Object.assign({}, accs[k], v); }); by.set(d.id, Object.assign(o, d, { accs, luv: d.luv || o.luv, final: d.final || o.final, asked: [...new Set((o.asked || []).concat(d.asked || []))] }, o.no || d.no ? { no: [...new Set((o.no || []).concat(d.no || []))].filter(k => !(accs[k] && accs[k].rank != null)) } : {})); });
  return [...by.values()].sort((x, y) => String(x.date || x.id).localeCompare(String(y.date || y.id)));
}
// os lugares mais recentes do grupo (os meus ou os que outro membro publicou); os dias juntam-se de todos os da mesma run
function groupRanks() {
  const docs = [S.ranksMine].concat(((S.group || {}).summaries || []).map(x => x.share && x.share.ranks)).filter(r => r && r.at && Array.isArray(r.accs));
  if (!docs.length) return null;
  docs.sort((p, q) => String(p.at).localeCompare(String(q.at)));
  const best = docs[docs.length - 1], runId = (best.run || {}).id;
  return Object.assign({}, best, { days: docs.filter(r => (r.run || {}).id === runId).reduce((acc, r) => mergeRankDays(acc, r.days), []) });
}
// lugar de uma conta num dia (pela data do site)
const DAY_BANDS = [[1, 1, 15000], [2, 2, 10000], [3, 3, 5000], [4, 4, 2000], [5, 10, 1000], [11, 25, 500], [26, 50, 300], [51, 100, 200]];
function dayRankOf(addr, date) { const R = groupRanks(), d = R && (R.days || []).find(x => x.date === date); return d && addr ? Object.assign({ total: d.total, final: d.final }, (d.accs || {})[addrKey(addr)] || { rank: null }) : null; }
// a conta não levou lineup num dia já fechado: perguntou-se por ela e o Top Shot não a tem na classificação do dia
// (leituras antigas sem a lista "no": conta quando o dia respondeu, com o total de jogadores)
function tsNoEntry(addr, date) {
  const R = groupRanks(), d = R && (R.days || []).find(x => x.date === date), ak = addrKey(addr);
  if (!d || !d.final || !ak || !(d.asked || []).includes(ak)) return false;
  const a = (d.accs || {})[ak]; if (a && a.rank != null) return false;
  return Array.isArray(d.no) ? d.no.includes(ak) : d.total != null;
}
function rankOf(addr) { const R = groupRanks(); if (!R || !addr) return null; return (R.accs || []).find(x => addrKey(x.a) === addrKey(addr)) || null; }
// as contas do grupo com endereço Flow (as que o script procura)
function rankJob(what) {
  const want = what && what.length ? what : ['ranks', 'picks', 'px', 'ed'];
  const accs = [];
  (S.group.profiles || []).forEach(p => {
    if (!S.group.members.some(m => m.user_id === p.user_id)) return;
    if (p.flow_address) accs.push({ a: addrKey(p.flow_address), uid: p.user_id, acc: 'main' });
    (Array.isArray(p.smurfs) ? p.smurfs : []).forEach(x => { if (x && x.id && x.flow_address) accs.push({ a: addrKey(x.flow_address), uid: p.user_id, acc: x.id }); });
  });
  const R = groupRanks(), known = R ? (R.days || []).filter(d => d.final && (!want.includes('lu') || d.luv) && accs.every(x => (d.asked || []).includes(x.a))).map(d => d.id) : [];
  return Object.assign({ accs, back: siteBase(), known, do: want }, want.includes('px') ? { pl: pxWanted().map(id => [id, nameOf(id)]) } : {}, want.includes('ed') ? { cs: S.groupCards || [] } : {}, want.includes('pro') ? { pro: proWanted().map(id => [id, nameOf(id)]) } : {});
}
// as cartas de todo o grupo (a minha coleção e as dos outros): por jogador, os sets que é preciso ver no Top Shot
async function loadGroupCards() {
  const by = new Map(), add = items => Object.values(items || {}).forEach(it => { if (!it || it.p == null) return; const k = String(it.p), b = String(it.s || '').split(' · ')[0]; if (!b || b === '?') return; (by.get(k) || by.set(k, new Set()).get(k)).add(b); });
  add((((S.profile || {}).collection) || {}).items);
  try {
    const rows = await q(sb.from('profiles').select('user_id,it:collection->items'));
    (rows || []).forEach(r => { if (r.user_id !== S.session.user.id && S.group.members.some(m => m.user_id === r.user_id)) add(r.it || (r.collection && r.collection.items)); });
  } catch (e) { console.warn('cartas do grupo', e); }
  S.groupCards = [...by.entries()].map(([id, sets]) => [id, nameOf(id), [...sets]]).filter(x => x[1]);
}
// ---------- preços do mercado lidos no próprio Top Shot (o script "FB lugares" lê-os com os lugares) ----------
// S.pxMine = {at, p: {id: [Common, Rare, Legendary] em cêntimos ou null}}; fica no resumo publicado (share.px) e o grupo
// usa, jogador a jogador, o preço mais recente que alguém leu
try { S.pxMine = JSON.parse(localStorage.getItem('fb-px') || 'null'); } catch (e) { S.pxMine = null; }
function pxTake(px) {
  const old = S.pxMine && S.pxMine.p ? S.pxMine : { p: {}, t: {} }, t = Object.assign({}, old.t || {});
  Object.keys(px.p).forEach(id => { t[id] = px.at; });
  // guarda os de antes (de outros jogadores) com a hora de cada um; os que já têm mais de 3 dias saem
  const p = Object.assign({}, old.p, px.p);
  Object.keys(p).forEach(id => { const at = t[id] || old.at; if (!at || Date.now() - Date.parse(at) > 3 * 864e5) { delete p[id]; delete t[id]; } else t[id] = at; });
  S.pxMine = { at: px.at, p, t, miss: (px.miss || []).slice(0, 400) }; S.pxNew = Object.keys(px.p).length; S.pxMissN = (px.miss || []).length; S.pxIdx = null;
  try { localStorage.setItem('fb-px', JSON.stringify(S.pxMine)); } catch (e) {}
}
// jogador → {c: [3 preços], at}: o mais recente entre o meu e os que o grupo publicou
function pxIndex() {
  const key = [(S.group || {}).summaries, S.pxMine && S.pxMine.at];
  if (S.pxIdx && S.pxIdx.k[0] === key[0] && S.pxIdx.k[1] === key[1]) return S.pxIdx.m;
  const m = new Map(), docs = [S.pxMine].concat(((S.group || {}).summaries || []).map(x => x.share && x.share.px)).filter(d => d && d.at && d.p);
  docs.forEach(d => Object.entries(d.p).forEach(([id, c]) => { const at = (d.t || {})[id] || d.at, o = m.get(id); if (Array.isArray(c) && (!o || at > o.at)) m.set(id, { c, at }); }));
  S.pxIdx = { k: key, m };
  return m;
}
const pxOf = id => { const x = pxIndex().get(String(canon(id))) || pxIndex().get(String(id)); return x && Date.now() - Date.parse(x.at) < 3 * 864e5 ? x : null; };
// jogador que o script não encontrou na lista do Top Shot na última leitura (sem Moments, ou nome diferente)
const pxMiss = id => !!(S.pxMine && S.pxMine.miss && Date.now() - Date.parse(S.pxMine.at) < 3 * 864e5 && S.pxMine.miss.includes(String(canon(id))) && !pxOf(id));
// com preços lidos: só se sugere quem tem um Moment desse escalão à venda
const pxReady = () => pxIndex().size >= 50;
const buyable = (id, U) => { const p = mktOf(id, U); return !!(p && p.ask != null); };
const pxCol = uses => (uses >= 4 ? 2 : uses >= 2 ? 1 : 0);
// os jogadores a ler: sempre todos os que podem aparecer nas compras (os da NBA com médias), primeiro o teu plantel
// e a coleção, as sugestões de compra e os especialistas, depois por minutos
function pxWanted() {
  const out = new Set(), add = id => { if (id != null) out.add(String(canon(id))); };
  Object.keys(S.mine.roster || {}).forEach(id => add(id, 1));
  Object.keys(((S.profile || {}).collection || {}).players || {}).forEach(id => add(id, 1));
  [S.buy && S.buy.results, S.autoBuy].forEach(R => { if (R) { (R.list || []).forEach(x => add(x.id, 1)); (R.rank || []).slice(0, 40).forEach(x => add(x && x.id != null ? x.id : x, 1)); } });
  const pool = [...S.players.values()].filter(p => p.team && p.avg);
  const val = (p, k) => { const a = FB.avgOf({ avg: p.avg }, k); return a ? a.v : 0; };
  SPEC_STATS.forEach(k => pool.filter(p => (+p.avg.min || 0) >= 12).sort((a, b) => val(b, k) - val(a, k)).slice(0, 12).forEach(p => add(p.id)));
  pool.sort((a, b) => (+b.avg.min || 0) - (+a.avg.min || 0)).forEach(p => add(p.id));
  return [...out].filter(id => S.players.has(id) || (S.mine.roster || {})[id]).slice(0, 650);
}
// escalões que os amigos marcaram carta a carta, juntos por set (servem para os sets que tu não marcaste)
function groupTierLabels(profiles) {
  const me = S.session.user.id, out = {};
  profiles.forEach(p => { if (p.user_id === me) return; const tl = p.tl || (p.collection && p.collection.tl); if (!tl || typeof tl !== 'object') return;
    Object.entries(tl).forEach(([k, L]) => { if (Array.isArray(L)) out[k] = (out[k] || []).concat(L.filter(x => Array.isArray(x) && TIERS.includes(x[1]))); }); });
  const before = JSON.stringify(S.groupTL || {}); S.groupTL = out;
  if (before !== JSON.stringify(out) && S.mineLoaded) syncTierUses(); // usos do plantel pelo que o grupo aprendeu
}
// Resultados lidos da blockchain entram sozinhos no plano de cada conta (e descontam os usos dessa conta)
function applyChainResults() {
  const uid = S.session.user.id;
  const dates = new Set(S.days.map(d => d.date));
  const roster = S.mine.roster;
  const byName = new Map();
  Object.keys(roster).forEach(id => { const nm = norm(nameOf(id)); if (nm) byName.set(nm, id); });
  let changed = 0, nTs = 0, nNone = 0; const fixes = [];
  accounts().forEach(acc => {
    const mine = S.group.chain.filter(c => c.user_id === uid && c.date && (c.account || 'main') === acc.id);
    // dias fechados lidos no Top Shot (lugar, se ganhou e o lineup), para os dias que a blockchain não tem
    const R = groupRanks(), ad = addrKey(accAddr(uid, acc.id));
    if (R && ad) (R.days || []).forEach(d => { const a = (d.accs || {})[ad]; if (!d.final || !d.date || !a || a.rank == null || mine.some(c => c.date === d.date)) return; const ids = tsLineup(ad, d.date); if (!ids) return; mine.push({ date: d.date, win: !!a.won, points: null, ids, ts: true }); });
    // dias em que a conta não levou lineup no Top Shot (só se a conta está na run: o endereço está certo)
    const rk = R && ad ? rankOf(accAddr(uid, acc.id)) : null;
    const none = rk && rk.found ? (R.days || []).filter(d => d.date && dates.has(d.date) && tsNoEntry(ad, d.date) && !mine.some(c => c.date === d.date)).map(d => d.date) : [];
    if (!mine.length && !none.length) return;
    const plan = planOf(acc.id), played = clone(plan.played || {});
    let ch = 0;
    none.forEach(date => {
      const cur = played[date]; if (cur && cur.edited) return; // corrigido à mão
      // já está; se as estatísticas lhe puseram um total (lineup sugerido), sai
      if (cur && cur.done && cur.none) { if (cur.tot || cur.box || cur.points != null) { delete cur.tot; delete cur.box; delete cur.points; ch++; nTs++; nNone++; } return; }
      // o lineup que o site julgava levado não jogou: os usos voltam
      ((cur && cur.done && cur.lineup) || []).forEach(id => { const e = roster[id]; if (e) setUsesOf(e, acc.id, usesEff(e, id, acc.id) + 1); });
      played[date] = { done: true, result: 'loss', lineup: [], ts: true, none: true };
      ch++; nTs++; nNone++;
    });
    mine.forEach(c => {
      if (!dates.has(c.date) || c.win == null) return;
      const res = c.win ? 'win' : 'loss';
      const cur = played[c.date];
      if (cur && cur.done) {
        // fechado à mão ou pelas estatísticas: a blockchain confirma (resultado, total e lineup)
        let upd = false;
        if (cur.result !== res) { cur.result = res; upd = true; }
        if (!c.ts && !cur.chain) { cur.chain = true; cur.box = false; upd = true; }
        if (c.points != null && cur.points !== c.points) { cur.points = c.points; upd = true; }
        const ids = c.ids || (c.lineup || []).map(n => byName.get(norm(n))).filter(Boolean), old = cur.lineup || [];
        // lido antes de haver plantel: liga agora os nomes aos jogadores (os usos que puseste já são os restantes)
        if (!old.length) { if (ids.length) { cur.lineup = ids; upd = true; } }
        // jogou outro lineup do que o que o site julgava: acerta os usos
        else if (ids.length === (c.ids || c.lineup || []).length && ids.slice().sort().join() !== old.slice().sort().join()) {
          old.filter(id => !ids.includes(id)).forEach(id => { const e = roster[id]; if (e) setUsesOf(e, acc.id, usesEff(e, id, acc.id) + 1); });
          ids.filter(id => !old.includes(id)).forEach(id => { const e = roster[id]; if (e) setUsesOf(e, acc.id, Math.max(0, usesEff(e, id, acc.id) - 1)); });
          if (c.ts) fixes.push({ acc: acc.id, date: c.date, old: old.slice(), now: ids.slice() });
          cur.lineup = ids; upd = true;
          // o total era do lineup antigo: refaz-se com as estatísticas deste (agora, ou quando houver as fichas)
          const dd = S.days.find(d => d.date === c.date), cc = dd && dayCalc(acc.id, dd, ids);
          if (cc && cc.res === res) { cur.tot = cc.tot; if (cc.objs.length === 1 && c.points == null) cur.points = cc.tot[0]; }
          else { delete cur.tot; if (c.points == null) delete cur.points; }
        }
        if (upd) { ch++; if (c.ts) nTs++; }
        return;
      }
      const finished = c.ts || Date.now() - Date.parse(c.date + 'T12:00:00Z') > 30 * 3600e3; // do Top Shot: só vêm dias fechados
      if (!finished && !c.win) return; // ainda a decorrer: espera pelo fim
      const ids = c.ids || (c.lineup || []).map(n => byName.get(norm(n))).filter(Boolean);
      ids.forEach(id => { const e = roster[id]; if (e) setUsesOf(e, acc.id, Math.max(0, usesEff(e, id, acc.id) - 1)); });
      const pj = (((plan.proj || {})[c.date]) || {}).lineup || [];
      if (c.ts && pj.length && pj.slice().sort().join() !== ids.slice().sort().join()) fixes.push({ acc: acc.id, date: c.date, old: pj.slice(), now: ids.slice() });
      played[c.date] = Object.assign({ done: true, result: res, lineup: ids, points: c.points }, c.ts ? { ts: true } : { chain: true });
      ch++; if (c.ts) nTs++;
    });
    if (ch) { plan.played = played; changed += ch; }
  });
  if (fixes.length) { S.luFix = fixes; setTimeout(luFixShow, 800); }
  if (changed) {
    saveMine();
    if (!fixes.length && nNone === changed) toast(nNone === 1 ? 'One day with no Top Shot lineup: it stays empty and the uses come back.' : nNone + ' days with no Top Shot lineup: they stay empty and the uses come back.');
    else if (!fixes.length) toast(nTs === changed ? (changed === 1 ? 'One day corrected with the lineup you played (Top Shot).' : changed + ' days corrected with the lineups you played (Top Shot).') : changed === 1 ? 'One result read from the blockchain.' : changed + ' results read from the blockchain.');
  }
}

// "O lineup que levaste não era o da app": dias acertados pelo lineup lido no Top Shot (quem estava na app e quem
// levaste mesmo); os usos já foram acertados
function luFixShow() {
  const F = S.luFix; if (!F || !F.length) return;
  if (!$('sheet').hidden) { setTimeout(luFixShow, 2000); return; }
  S.luFix = null;
  const multi = accounts().length > 1;
  const who = (id, k) => '<span class="op-p ' + k + '">' + face(id, 'sm') + '<span class="op-t"><span class="op-l">' + (k === 'op-out' ? 'In the app' : 'You played') + '</span><span class="op-n">' + esc(nameOf(id)) + '</span></span></span>';
  const card = f => {
    const outs = f.old.filter(id => !f.now.includes(id)), ins = f.now.filter(id => !f.old.includes(id)), n = Math.max(outs.length, ins.length);
    return '<div class="card op-card"><div class="list-head"><h2>Day ' + dayNo(f.date) + (multi ? ' · ' + esc(accLabel(f.acc)) : '') + '</h2><span class="small muted">' + dWeek(f.date) + ', ' + dShort(f.date) + '</span></div><ul class="list">' +
      Array.from({ length: n }, (_, i) => '<li class="op-pair">' + (outs[i] ? who(outs[i], 'op-out') : '<span></span>') + '<span class="op-arrow" aria-hidden="true">→</span>' + (ins[i] ? who(ins[i], 'op-in') : '<span></span>') + '</li>').join('') + '</ul></div>';
  };
  openSheet('<h3>Lineups corrected</h3><div class="small muted">The lineups you played on Top Shot weren’t the ones in the app. The app now uses the ones you played and corrected those players’ uses.</div>' +
    F.slice().sort((x, y) => x.date.localeCompare(y.date)).map(card).join('') + '<button class="btn primary" type="button" data-action="close-sheet">OK</button>');
}
// ---------- contas (principal + smurf) ----------
const smurfList = () => { const x = (S.profile || {}).smurfs; return Array.isArray(x) ? x.filter(a => a && a.id) : []; };
const groupMode = () => smurfList().length > 0;
function accounts() {
  const me = S.profile || {};
  return [{ id: 'main', label: 'Main', nick: me.topshot_username, flow: me.flow_address }]
    .concat(smurfList().map((x, i) => ({ id: x.id, label: x.topshot_username || ('Smurf ' + (i + 1)), nick: x.topshot_username, flow: x.flow_address })));
}
const accLabel = k => (accounts().find(a => a.id === k) || { label: k }).label;
// plano de cada conta: o da principal é o de sempre; o das smurf fica dentro dele
function planOf(acc) {
  if (!S.mine.plan) S.mine.plan = {};
  if (acc === 'main') return S.mine.plan;
  const sm = (S.mine.plan.smurfs = S.mine.plan.smurfs || {});
  return (sm[acc] = sm[acc] || {});
}
const curPlan = () => planOf(S.acc);
// quantas vezes a conta já usou o jogador nesta run (dias fechados)
function usedCount(acc, id) { let n = 0; Object.values(planOf(acc).played || {}).forEach(pl => { if (pl && pl.done && (pl.lineup || []).includes(id)) n++; }); return n; }
// usos restantes de cada conta: a principal guarda-os em "uses"; as smurf em "su" (se ainda não foram mexidos,
// têm os mesmos usos por run que a principal, menos os que já gastaram)
function usesEff(e, id, acc) {
  // jogador com Moments na coleção: cada conta tem os usos da melhor carta (passa de uma conta para a outra)
  // menos os que já gastou. Não se muda à mão.
  const top = colTopUses(id);
  if (top) return Math.max(0, top - usedCount(acc, id));
  if (acc === 'main') return +e.uses || 0;
  return e.su && e.su[acc] != null ? +e.su[acc] : Math.max(0, (+e.uses || 0) + usedCount('main', id) - usedCount(acc, id));
}
let colTopMemo = { col: null, m: null };
function colTopUses(id) {
  const col = (S.profile || {}).collection; if (!col || !col.items) return null;
  if (colTopMemo.col !== col || colTopMemo.ed !== edIndex()) { const m = new Map(); Object.keys(col.items).forEach(f => { const p = String(col.items[f].p), u = cardUses(col, f); if (u > (m.get(p) || 0)) m.set(p, u); }); colTopMemo = { col, m, ed: edIndex() }; }
  return colTopMemo.m.get(String(id)) || null;
}
// usos da melhor carta que uma conta tem hoje (lido das carteiras); null se a conta não tem nenhum Moment dele
function bestTierName(id) {
  const col = (S.profile || {}).collection || {}, fids = col.items ? Object.keys(col.items).filter(f => String(col.items[f].p) === String(id)) : [];
  let best = null, bu = -1; fids.forEach(f => { const t = momentTier(col, f), u = cardUses(col, f); if (u > bu) { bu = u; best = t; } }); return best || 'Moment';
}
function accTierUses(id, acc) {
  const col = (S.profile || {}).collection; if (!col || !col.items) return null;
  const fids = Object.keys(col.items).filter(f => String(col.items[f].p) === String(id) && (col.items[f].a || 'main') === acc);
  return fids.length ? Math.max(1, ...fids.map(f => cardUses(col, f))) : null;
}
function setUsesOf(e, acc, n) { if (acc === 'main') e.uses = n; else { e.su = e.su || {}; e.su[acc] = n; } }
// onde estão os Moments de cada jogador (lido das carteiras)
// Cada conta tem os usos da melhor carta da coleção (os Moments passam de uma conta para a outra). Numa noite cada
// carta só joga numa conta, e a k-ésima jogada de uma conta precisa de uma carta com pelo menos k usos: com 1 Rare +
// 4 Common, as duas contas podem jogá-lo na mesma noite (uma com o Rare, a outra com um Common, se for a 1.ª jogada
// dela), mas a 2.ª jogada de cada conta precisa do Rare. copies = Moments; cards = usos de cada um; hold = onde estão.
// Moments que marcaste como mandados (A fazer) depois da última leitura da carteira: contam já na conta para onde foram
// (até a carteira ser lida outra vez)
function sentSince(col, id) {
  const t0 = Date.parse(col.read_at || 0) || 0, pre = (S.runId || '') + '|tr|' + id + '|', out = [];
  Object.entries(TODO_DONE).forEach(([k, at]) => { if (!k.startsWith(pre) || !(+at > t0)) return; const m = k.slice(pre.length).match(/^([^>|]+)>([^|]+)\|/); if (m) out.push([m[1], m[2]]); });
  return out;
}
function collectionInfo(id) {
  const col = ((S.profile || {}).collection) || {}, c = (col.players || {})[id];
  if (!c || !c.owners) return { copies: 1, owner: null, hold: null };
  const fids = col.items ? Object.keys(col.items).filter(f => String(col.items[f].p) === String(id)) : [];
  if (fids.length) {
    const u = fids.map(f => cardUses(col, f)), top = Math.max(...u), nTop = u.filter(x => x === top).length;
    const hold = {}; fids.forEach((f, i) => { const a = col.items[f].a || 'main'; (hold[a] = hold[a] || []).push(u[i]); });
    sentSince(col, id).forEach(([from, to]) => { const h = hold[from]; if (!h || !h.length) return; const k = h.indexOf(Math.max(...h)); (hold[to] = hold[to] || []).push(h.splice(k, 1)[0]); if (!h.length) delete hold[from]; });
    const keys = Object.keys(hold);
    return { copies: fids.length, owner: fids.length === 1 ? keys[0] : null, hold, cards: u.slice().sort((x, y) => y - x), moments: fids.length, topUses: top, nTop };
  }
  const keys = Object.keys(c.owners).filter(k => c.owners[k] > 0), n = keys.reduce((a, k) => a + c.owners[k], 0);
  const hold = {}; keys.forEach(k => { hold[k] = +c.owners[k]; });
  sentSince(col, id).forEach(([from, to]) => { if (!(hold[from] > 0)) return; hold[from]--; hold[to] = (hold[to] || 0) + 1; if (!hold[from]) delete hold[from]; });
  const ks = Object.keys(hold);
  return { copies: Math.max(1, n), owner: n === 1 ? ks[0] : null, hold }; // hold: quantos Moments dele há em cada conta
}

// ---------- gravar ----------
let mineTimer = null, mineSaving = Promise.resolve();
function saveMine() {
  clearTimeout(mineTimer);
  mineTimer = setTimeout(saveNow, 600);
}
// jogadores com Moments na coleção: os usos são os da melhor carta, nunca os gravados à mão
function cleanCollectionUses() {
  Object.entries(S.mine.roster || {}).forEach(([id, e]) => {
    const top = colTopUses(id); if (!top) return;
    e.uses = Math.max(0, top - usedCount('main', id)); e.tierUses = top; delete e.su; delete e.sm; delete e.usesManual;
  });
}
// Dois aparelhos (PC e telemóvel) gravam o mesmo plano. Antes de gravar vê-se se o outro gravou entretanto: se sim,
// junta-se — o que mudou neste aparelho desde a última leitura (S.mineBase) fica, o resto vem do servidor (um cadeado
// posto no PC não é apagado por um telemóvel que tinha o plano antigo aberto). As horas são sempre as do servidor.
function merge3(base, mine, theirs, depth) {
  const J = x => JSON.stringify(x === undefined ? null : x);
  if (J(mine) === J(base)) return theirs === undefined ? undefined : clone(theirs);
  if (J(theirs) === J(base) || theirs === undefined) return mine;
  const obj = x => x && typeof x === 'object' && !Array.isArray(x);
  if (depth > 0 && obj(mine) && obj(theirs)) {
    const out = {}, b = obj(base) ? base : {};
    new Set(Object.keys(mine).concat(Object.keys(theirs))).forEach(k => { const v = merge3(b[k], mine[k], theirs[k], depth - 1); if (v !== undefined) out[k] = v; });
    // apagado neste aparelho (estava na base e já não está): fica apagado, se o outro não o mudou
    Object.keys(b).forEach(k => { if (!(k in mine) && J(theirs[k]) === J(b[k])) delete out[k]; });
    return out;
  }
  return mine; // os dois mudaram a mesma coisa: fica a deste aparelho (a mais recente aqui)
}
async function mineSync(fromSave) {
  const row = await q(sb.from('user_runs').select('roster,plan,updated_at').eq('run_id', S.runId).eq('user_id', S.session.user.id).maybeSingle());
  if (!row || !(Date.parse(row.updated_at) > (S.mineSeen || 0))) return false;
  const srv = { roster: row.roster || {}, plan: row.plan || {} }, base = S.mineBase || { roster: {}, plan: {} };
  const merged = { roster: merge3(base.roster, S.mine.roster, srv.roster, 2) || {}, plan: merge3(base.plan, S.mine.plan, srv.plan, 5) || {} };
  S.mine = merged; S.mineBase = clone(srv); S.mineSeen = Date.parse(row.updated_at);
  if (!fromSave && JSON.stringify(merged) !== JSON.stringify(srv)) saveMine(); // havia mudanças só neste aparelho: grava-as por cima
  return true;
}
function saveNow() {
  mineTimer = null;
  if (!S.session || !S.runId) return;
  const runId = S.runId;
  mineSaving = mineSaving.then(async () => {
    if (runId !== S.runId) return;
    let merged = false;
    try { merged = await mineSync(true); } catch (e) { /* sem rede para ver: grava o que tem */ }
    cleanCollectionUses();
    const snap = clone({ roster: S.mine.roster, plan: S.mine.plan });
    await q(sb.from('user_runs').upsert({ user_id: S.session.user.id, run_id: runId, roster: snap.roster, plan: snap.plan }, { onConflict: 'user_id,run_id' }));
    S.mineBase = snap;
    try { const r = await q(sb.from('user_runs').select('updated_at').eq('run_id', runId).eq('user_id', S.session.user.id).maybeSingle()); if (r) S.mineSeen = Math.max(S.mineSeen || 0, Date.parse(r.updated_at) || 0); } catch (e) {}
    if (merged) { schedule(); render(); }
  }).catch(e => toast('Not saved: ' + errText(e)));
  return mineSaving;
}
// com a app aberta: de minuto a minuto vê se o outro aparelho gravou (e ao voltar à app)
async function mineRefresh() {
  if (!S.session || !S.runId || !S.mineLoaded || mineTimer || document.visibilityState !== 'visible') return false;
  try { await mineSaving; if (mineTimer) return false; if (await mineSync(false)) { schedule(); render(); return true; } } catch (e) {}
  return false;
}
setInterval(mineRefresh, 60e3);
window.addEventListener('focus', () => { mineRefresh(); });
// cada conta para a Classificação do grupo: vitórias, aros, hoje e (se partilhas o plano) o lineup de cada dia já
// começado e do próximo, para os outros verem o resultado pelas estatísticas mal os jogos acabem
function accSummaries() {
  const out = {}, share = (S.profile || {}).share_plan !== false, now = Date.now();
  accounts().forEach(a => {
    const r = S.multi ? S.multi.byKey[a.id] : (a.id === 'main' ? S.result : null); if (!r) return;
    const v = r.normal, days = {}, lu = {};
    Object.entries(planOf(a.id).played || {}).forEach(([d, pl]) => { if (pl && pl.done) days[d] = pl.result; });
    if (share) {
      S.days.forEach(day => { const tip = firstTipOf(day); if (tip == null || now < tip || days[day.date]) return; const ids = lineupFor(a.id, day.date); if (ids && ids.length) lu[day.date] = ids; });
      const d0 = v.days[0]; if (d0 && !lu[d0.date]) { const ids = lineupFor(a.id, d0.date) || d0.lineup; if (ids && ids.length) lu[d0.date] = ids.slice(); }
    }
    const o = { wins: r.wins, losses: r.losses, expected: Math.round((r.wins + v.expected) * 100) / 100, prize_probs: r.prizes.map((p, i) => ({ wins: p.wins, p: Math.round(v.prizeProbs[i] * 1000) / 1000 })), days, next_p: v.days[0] ? Math.round(v.days[0].P * 1000) / 1000 : null };
    if (Object.keys(lu).length) o.lu = lu;
    if (a.id !== 'main') o.label = a.label;
    out[a.id] = o;
  });
  return out;
}
let sumTimer = null;
function publishSummary() {
  if (!S.session || !(S.group && S.group.loaded)) return; // antes de ler o grupo não: perdia os lugares e preços que só estão no resumo
  const r = mainResult(); if (!r || !S.runId) return;
  const v = r.normal; // o grupo vê a conta principal
  const days = {};
  Object.entries(planOf('main').played || {}).forEach(([d, p]) => { if (p && p.done) days[d] = p.result; });
  const row = {
    user_id: S.session.user.id, run_id: S.runId, wins: r.wins, losses: r.losses,
    expected: Math.round((r.wins + v.expected) * 100) / 100,
    prize_probs: r.prizes.map((p, i) => ({ wins: p.wins, p: Math.round(v.prizeProbs[i] * 1000) / 1000 })),
    days, next_p: v.days[0] ? Math.round(v.days[0].P * 1000) / 1000 : null,
  };
  const share = shareDoc(), accs = accSummaries();
  const sh = Object.assign({}, share || {}, Object.keys(accs).length ? { accs } : {}, S.ranksMine && S.ranksMine.at ? { ranks: S.ranksMine } : {}, S.pxMine && S.pxMine.at ? { px: S.pxMine } : {}, S.edMine && S.edMine.at ? { ed: Object.assign({ at: S.edMine.at, p: S.edMine.p, t: S.edMine.t }, S.edMine.mk ? { mk: S.edMine.mk } : {}) } : {}, S.picksMine && S.picksMine.at && Date.now() - Date.parse(S.picksMine.at) < 2 * 864e5 ? { picks: S.picksMine } : {}, S.histMine && S.histMine.at && Date.now() - Date.parse(S.histMine.at) < 3 * 864e5 ? { hist: S.histMine } : {}, S.proMine && S.proMine.at && Date.now() - Date.parse(S.proMine.at) < 3 * 864e5 ? { pro: S.proMine } : {});
  if (!S.noShareCol) row.share = Object.keys(sh).length ? sh : null;
  const key = JSON.stringify(row);
  if (key === S.lastSummary) return;
  clearTimeout(sumTimer);
  sumTimer = setTimeout(async () => {
    if (!S.session) return;
    try { await q(sb.from('summaries').upsert(row, { onConflict: 'user_id,run_id' })); S.lastSummary = key; }
    catch (e) {
      if ('share' in row && /share/i.test(String(e && e.message))) { S.noShareCol = true; delete row.share; try { await q(sb.from('summaries').upsert(row, { onConflict: 'user_id,run_id' })); S.lastSummary = key; } catch (e2) { console.warn('resumo', e2); } } // base de dados sem a coluna nova
      else console.warn('resumo', e);
    }
  }, 2500);
}

// ---------- cálculo ----------
let scheduled = false;
function schedule() { if (scheduled) return; scheduled = true; setTimeout(() => { scheduled = false; if (!S.session) return; compute(); holdSync(); render(); if (S.lu && $('luBody')) luRender(); publishSummary(); publishNext(); snapshotProj(); scheduleAutoBuy(); scheduleImprove(); scheduleHoldCheck(); ensureLive(); boxTick(); }, 16); }
function recalcNow() { if (!S.session) return; compute(); holdSync(); render(); publishSummary(); publishNext(); }
// ---- Lineup de hoje mantido: menos trocas no dia ----
// O primeiro lineup do dia fica (plan.hold). Só muda sozinho se alguém dele não puder jogar (fora no relatório, sem
// jogo, sem usos) ou se, refeita a run sem ele, houver um lineup que dá pelo menos HOLD_MIN vitórias a mais.
// Cada mudança (ou troca que não valeu a pena) fica no histórico do dia (plan.lhist), que se vê na Jornada.
const HOLD_MIN = 0.02;
function holdOn(acc) {
  const h = planOf(acc).hold; if (!h || !h.d || !Array.isArray(h.ids) || !h.ids.length) return null;
  const pa = planOf(acc), day = S.days.find(d => d.date === h.d); if (!day) return null;
  if (((pa.played || {})[h.d] || {}).done || ((pa.locks || {})[h.d] || []).length || ((pa.keep || {})[h.d] || []).length) return null;
  const tip = firstTipOf(day); if (tip != null && Date.now() >= tip) return null;
  return h;
}
function holdLog(acc, date, ev) {
  const pa = planOf(acc), H = pa.lhist = pa.lhist || {};
  (H[date] = H[date] || []).push(Object.assign({ t: new Date().toISOString() }, ev));
  if (H[date].length > 30) H[date] = H[date].slice(-30);
  Object.keys(H).sort().slice(0, -3).forEach(d => delete H[d]); // só os últimos 3 dias
}
// porque é que um jogador do lineup mantido já não pode jogar
function holdWhy(acc, md, id) {
  const pi = S.result && S.result.model.pIndex.get(id), inj = (S.injuries || {})[id], e = (S.mine.roster || {})[id];
  if (inj && /^(out|ofs)$/.test(inj.status) && !(e && e.injIgnore)) return 'fora';
  if (!FB.gameOf(md.day, pTeam(id))) return 'semjogo';
  if (pi != null && !((S.result.model.uses || [])[pi] > 0)) return 'semusos';
  return '';
}
// depois de cada cálculo: guarda o lineup do dia e regista o que mudou sem ser por uma troca melhor
function holdSync() {
  const run = curRun(); if (!S.result || !run || !S.mineLoaded) return;
  let ch = false; const pops = [];
  accounts().forEach(a => {
    const R = S.multi ? S.multi.byKey[a.id] : (a.id === 'main' ? S.result : null); if (!R || !R.model.days.length) return;
    const md = R.model.days[0], date = md.day.date, d = R.normal.days[0]; if (!d || d.date !== date) return;
    const tip = firstTipOf(md.day); if (tip == null || Date.now() >= tip || liveOn(date)) return;
    const L = d.lineup.slice(), pa = planOf(a.id), h = pa.hold;
    if (!L.length) return;
    if (!h || h.d !== date) {
      // já havia histórico neste dia (voltaste à sugestão do plano): fica como mudança tua
      const H = (pa.lhist || {})[date] || [], last = H.length ? (H[H.length - 1].ids || null) : null;
      pa.hold = { d: date, ids: L };
      if (last) { const outs = last.filter(id => !L.includes(id)), ins = L.filter(id => !last.includes(id)); if (outs.length || ins.length) holdLog(a.id, date, { k: 'mine', outs, ins, prev: last, ids: L, P0: luP(R, md, last), P1: d.P }); }
      else holdLog(a.id, date, { k: 'start', ids: L, P1: d.P });
      ch = true; return;
    }
    const same = L.length === h.ids.length && L.every(id => h.ids.includes(id)); if (same) return;
    const outs = h.ids.filter(id => !L.includes(id)), ins = L.filter(id => !h.ids.includes(id));
    const banned = (pa.bans || {})[date] || [], base = { outs, ins, prev: h.ids.slice(), ids: L, P0: luP(R, md, h.ids), P1: d.P };
    if (((pa.locks || {})[date] || []).length || ((pa.keep || {})[date] || []).length || outs.some(id => banned.includes(id))) holdLog(a.id, date, Object.assign({ k: 'mine' }, base));
    else { const why = outs.map(id => holdWhy(a.id, md, id)); holdLog(a.id, date, Object.assign({ k: 'out', why }, base)); if (why.some(w => w === 'fora' || w === 'semjogo')) pops.push({ acc: a.id, old: h.ids.slice(), now: L, outs, ins, why }); }
    pa.hold = { d: date, ids: L }; ch = true;
  });
  if (ch) saveMine();
  if (pops.length) { S.oddsPop = { date: pops[0] && planOf(pops[0].acc).hold.d, ch: pops, out: true }; setTimeout(oddsPopShow, 600); }
}
// o que mudou desde a última verificação (para dizer porque é que o lineup mudou)
function holdSigs(date) {
  const o = S.odds[date], inj = Object.values(S.injuries || {}).map(x => x.id + ':' + x.status).sort().join();
  return { odds: o ? Object.keys(o.players || {}).length + '|' + (o.updated_at || '') : '', inj };
}
let holdKey = null, holdBusy = false, holdTimer = null;
function scheduleHoldCheck() {
  const key = calcKey; if (!key || holdBusy || holdKey === key || !S.result || S.calcError) return;
  if (!accounts().some(a => holdOn(a.id))) return;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => { if (calcKey === key && !holdBusy) holdCheck(key); }, 1500);
}
// refaz a run sem o lineup mantido (no outro fio): se a run fica pelo menos HOLD_MIN vitórias melhor, troca
async function holdCheck(key) {
  holdBusy = true; holdKey = key;
  try {
    const multi = !!S.multi, accs = accounts().map(a => a.id).filter(k => multi || k === 'main');
    const held = accs.filter(k => holdOn(k)); if (!held.length) return;
    const date = holdOn(held[0]).d, base = engineInputs('main', true);
    let out;
    if (!multi) out = await engineCall('planRun', [base.run, base.roster, base.odds, base.plan, engOpts()]);
    else out = await engineCall('planGroup', [base.run, accs.map(a => { const y = a === 'main' ? base : engineInputs(a, true); return { key: a, roster: y.roster, plan: y.plan }; }), base.odds, engOpts()], 'main');
    if (calcKey !== key || !out) return;
    const resOf = k => multi ? (out.group.byKey[k] || {}).normal : out.res;
    const curOf = k => (multi ? S.multi.byKey[k] : S.result).normal;
    const pr = prioAcc(), wOf = k => (k === pr ? PRIO_W : 1);
    const expU = multi ? Object.entries(out.group.byKey).reduce((t, [k, g]) => t + wOf(k) * (g.normal.expected || 0), 0) : out.res.expected || 0;
    const expK = multi ? Object.entries(S.multi.byKey).reduce((t, [k, g]) => t + wOf(k) * (g.normal.expected || 0), 0) : S.result.normal.expected || 0;
    const diffs = held.map(k => { const u = resOf(k), c = curOf(k); const ud = u && u.days.find(x => x.date === date), cd = c.days.find(x => x.date === date); if (!ud || !cd) return null;
      const outs = cd.lineup.filter(id => !ud.lineup.includes(id)), ins = ud.lineup.filter(id => !cd.lineup.includes(id));
      return outs.length || ins.length ? { k, outs, ins, now: ud.lineup.slice(), old: cd.lineup.slice(), P0: cd.P, P1: ud.P } : null; }).filter(Boolean);
    // o que mudou desde a última verificação; na primeira não se sabe (sem aviso grande)
    const sg = holdSigs(date), last = S.mine.plan.holdSig, why = last ? [sg.odds !== (last.odds || '') && sg.odds ? 'odds' : '', sg.inj !== (last.inj || '') ? 'inj' : ''].filter(Boolean) : [];
    S.mine.plan.holdSig = sg;
    if (!diffs.length) { saveMine(); return; }
    const g = expU - expK;
    if (g >= HOLD_MIN) {
      diffs.forEach(x => { planOf(x.k).hold = { d: date, ids: x.now }; holdLog(x.k, date, { k: 'upd', outs: x.outs, ins: x.ins, prev: x.old, ids: x.now, g, P0: x.P0, P1: x.P1, why }); });
      saveMine(); schedule();
      // aviso grande só quando veio de dados novos (odds, lesões); depois de mexeres no plantel basta uma nota
      if (why.length) { S.oddsPop = { date, ch: diffs.map(x => ({ acc: x.k, old: x.old, now: x.now, outs: x.outs, ins: x.ins, P0: x.P0, P1: x.P1 })), g, why }; setTimeout(oddsPopShow, 600); }
      else toast('Today’s lineup updated: ' + diffs.map(x => (diffs.length > 1 || accounts().length > 1 ? accLabel(x.k) + ' ' : '') + pct(x.P0) + ' → ' + pct(x.P1)).join(', ') + ' win chance today.');
    } else {
      // a mesma troca que já não valeu a pena não volta a ficar no histórico
      diffs.forEach(x => { const H = ((planOf(x.k).lhist || {})[date]) || [], prev = H.slice().reverse().find(e => e.k === 'keep');
        const sig = x.outs.slice().sort().join() + '>' + x.ins.slice().sort().join();
        if (!prev || (prev.outs || []).slice().sort().join() + '>' + (prev.ins || []).slice().sort().join() !== sig) holdLog(x.k, date, { k: 'keep', outs: x.outs, ins: x.ins, prev: x.old, ids: x.now, g: Math.max(0, g), P0: x.P0, P1: x.P1, why }); });
      saveMine();
    }
  } catch (e) { console.warn('lineup mantido', e); holdKey = null; }
  finally { holdBusy = false; }
}
const HOLD_WHY = { fora: 'out in the report', semjogo: 'no game', semusos: 'no uses', '': 'no longer available' };
const holdWhyTxt = why => (why || []).map(w => w === 'odds' ? 'new odds' : w === 'inj' ? 'injury report' : '').filter(Boolean).join(' and ');
// vitória de hoje com um lineup (o modelo de uma conta)
function luP(R, md, ids) {
  const idx = (ids || []).map(id => R.model.pIndex.get(id)).filter(i => i != null); let P = 1;
  md.objs.forEach((o, k) => { let sm = md.offset[k], v = 0; idx.forEach(i => { sm += md.mu[i][k]; v += md.v[i][k]; }); P *= FB.probAtLeast(sm, v, md.T[k]); });
  return md.objs.length ? P : 0;
}
const gainTxt = g => String(Math.round(Math.max(0, g) * 1000) / 10).replace('.', ',') + '%';
const pTo = e => e.P0 != null && e.P1 != null ? pct(e.P0) + ' → ' + pct(e.P1) : '';
// histórico do lineup de hoje: linha curta na Jornada (o último que aconteceu) e a folha com tudo
function holdLine(acc, date) {
  const H = ((planOf(acc).lhist || {})[date]) || []; if (!H.length) return '';
  const e = H[H.length - 1], pt = pTo(e);
  const t = e.k === 'upd' ? 'Updated at ' + hm(e.t) + (pt ? ': today ' + pt : '') : e.k === 'keep' ? 'Kept at ' + hm(e.t) + (pt ? ': the swap would give ' + pt : '') : e.k === 'out' ? 'Swapped at ' + hm(e.t) + ': ' + e.outs.map(id => esc(lastName(id))).join(', ') + ' ' + (HOLD_WHY[(e.why || [])[0]] || 'doesn\'t play') : e.k === 'mine' ? 'Changed by you at ' + hm(e.t) : 'Lineup of the day since ' + hm(e.t);
  return '<button class="row small hold-line" type="button" data-action="hold-hist" data-date="' + date + '"><span>' + icoClock + ' ' + t + '</span><span class="muted">History ›</span></button>';
}
// o que um botão do histórico faz ao lineup de agora: reverter a troca (quem saiu volta) ou fazer a troca que não se fez
function holdUndo(acc, date, e) {
  const h = planOf(acc).hold, cur = h && h.d === date ? h.ids : null; if (!cur || e.k === 'start') return null;
  const back = e.k !== 'keep', outs = back ? e.ins || [] : e.outs || [], ins = back ? e.outs || [] : e.ins || [];
  if (!outs.length && !ins.length) return null;
  if (!outs.every(id => cur.includes(id)) || ins.some(id => cur.includes(id))) return null; // já mudou outra vez entretanto
  return { back, outs, ins, target: cur.filter(id => !outs.includes(id)).concat(ins) };
}
function holdHistSheet(date) {
  const multi = accounts().length > 1, nd = S.days.find(d => d.date === date), tip = nd ? firstTipOf(nd) : null, open = !(tip != null && Date.now() >= tip);
  const mini = (ids, k) => ids.map(id => '<span class="hh-p ' + k + '">' + face(id, 'sm') + '<span>' + esc(lastName(id)) + '</span></span>').join('');
  const ev = (acc, e, i) => {
    const pt = pTo(e);
    const head = e.k === 'upd' ? '<span class="pill ok">Updated</span>' + (pt ? ' <b class="up">' + pt + '</b> today' : '') : e.k === 'keep' ? '<span class="pill mute">Kept</span> <span class="muted">' + (pt ? 'the swap would give ' + pt + ' today' : 'the swap wasn’t worth it') + '</span>'
      : e.k === 'out' ? '<span class="pill duv">Swapped</span> <span class="muted">' + e.outs.map((id, k) => esc(lastName(id)) + ' ' + (HOLD_WHY[(e.why || [])[k]] || 'doesn\'t play')).join(', ') + '</span>'
      : e.k === 'mine' ? '<span class="pill mute">Changed by you</span>' + (pt ? ' <span class="muted">' + pt + ' today</span>' : '') : '<span class="pill mute">Lineup of the day</span>' + (e.P1 != null ? ' <span class="muted">' + pct(e.P1) + ' today</span>' : '');
    const sub = [e.k === 'upd' || e.k === 'keep' ? holdWhyTxt(e.why) ? 'With ' + holdWhyTxt(e.why) : '' : '', e.g != null && (e.k === 'upd' || e.k === 'keep') ? 'run +' + gainTxt(e.g) + ' (swaps from ' + gainTxt(HOLD_MIN) + ')' : ''].filter(Boolean).join(' · ');
    const o = e.outs || [], n = e.ins || [];
    const body = e.k === 'start' ? '<div class="hh-ids">' + mini(e.ids || [], '') + '</div>' : '<div class="hh-pairs">' + Array.from({ length: Math.max(o.length, n.length) }, (_, k) => '<div class="hh-pair">' + (o[k] ? mini([o[k]], 'op-out') : '<span></span>') + '<span class="op-arrow" aria-hidden="true">→</span>' + (n[k] ? mini([n[k]], 'op-in') : '<span></span>') + '</div>').join('') + '</div>';
    const u = open && holdUndo(acc, date, e);
    const btn = u ? '<button class="btn small hh-btn" type="button" data-action="hold-undo" data-acc="' + esc(acc) + '" data-date="' + date + '" data-i="' + i + '">' + (u.back ? 'Undo' : 'Make this swap') + '</button>' : '';
    return '<li class="hh-ev"><span class="hh-t num">' + hm(e.t) + '</span><div style="min-width:0"><div>' + head + '</div>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + body + btn + '</div></li>';
  };
  const cards = accounts().map(a => { const H = ((planOf(a.id).lhist || {})[date]) || []; if (!H.length) return '';
    return '<div class="card">' + (multi ? '<div class="list-head"><h2>' + esc(accLabel(a.id)) + '</h2></div>' : '') + '<ul class="list hh-list">' + H.map((e, i) => [e, i]).reverse().map(([e, i]) => ev(a.id, e, i)).join('') + '</ul></div>'; }).join('');
  openSheet('<h3>Lineup history</h3><div class="small muted">Day ' + dayNo(date) + ' · ' + dWeek(date) + ', ' + dShort(date) + '. The lineup of the day only changes by itself if someone can’t play or there’s a clearly better one (at least +' + gainTxt(HOLD_MIN) + ' expected wins in the run).</div>' +
    (cards || '<div class="small muted">Nothing yet for this day.</div>'));
}
// "Reverter" / "Fazer esta troca": mostra como fica (quem sai e entra, a vitória de hoje) antes de confirmar
function holdUndoSheet(acc, date, i) {
  const e = (((planOf(acc).lhist || {})[date]) || [])[+i], u = e && holdUndo(acc, date, e); if (!u) return;
  const R = S.multi ? S.multi.byKey[acc] : S.result, md = R && R.model.days.find(x => x.day.date === date); if (!md) return;
  const cur = planOf(acc).hold.ids, p0 = luP(R, md, cur), p1 = luP(R, md, u.target);
  const bad = u.ins.filter(id => { const pi = R.model.pIndex.get(id); return pi == null || !md.eligSet.has(pi); });
  const who = (id, k) => '<span class="op-p ' + k + '">' + face(id, 'sm') + '<span class="op-t"><span class="op-l">' + (k === 'op-out' ? 'Out' : 'In') + '</span><span class="op-n">' + esc(nameOf(id)) + '</span></span></span>';
  const n = Math.max(u.outs.length, u.ins.length);
  openSheet('<h3>' + (u.back ? 'Undo the swap' : 'Make this swap') + '</h3><div class="small muted">' + (accounts().length > 1 ? esc(accLabel(acc)) + ' · ' : '') + 'Day ' + dayNo(date) + '. Today’s lineup becomes:</div>' +
    '<div class="card op-card"><ul class="list">' + Array.from({ length: n }, (_, k) => '<li class="op-pair">' + (u.outs[k] ? who(u.outs[k], 'op-out') : '<span></span>') + '<span class="op-arrow" aria-hidden="true">→</span>' + (u.ins[k] ? who(u.ins[k], 'op-in') : '<span></span>') + '</li>').join('') + '</ul>' +
      '<div class="kv lu-kv hu-kv"><div><div class="label">Win today</div><div class="v num">' + pct(p0) + ' → <span class="' + (p1 >= p0 ? 'up' : 'down') + '">' + pct(p1) + '</span></div></div></div>' +
      '<div class="hh-ids hu-ids">' + u.target.map(id => '<span class="hh-p">' + face(id, 'sm') + '<span>' + esc(lastName(id)) + '</span></span>').join('') + '</div></div>' +
    (bad.length ? '<div class="note warn">' + bad.map(id => '<b>' + esc(nameOf(id)) + '</b>').join(', ') + ' can’t play today (' + bad.map(id => HOLD_WHY[holdWhy(acc, md, id)] || 'doesn\'t play').join(', ') + ').</div>'
      : '<div class="small muted">The lineup gets locked, so the plan won’t swap it again by itself. Remove the lock in Change lineup.</div>') +
    '<div class="btns">' + (bad.length ? '' : '<button class="btn primary" type="button" data-action="hold-undo-ok" data-acc="' + esc(acc) + '" data-date="' + date + '" data-i="' + i + '">Confirm</button>') + '<button class="btn" type="button" data-action="hold-hist" data-date="' + date + '">Back to history</button></div>');
}
function holdUndoOk(acc, date, i) {
  const e = (((planOf(acc).lhist || {})[date]) || [])[+i], u = e && holdUndo(acc, date, e); if (!u) return;
  if (acc !== S.acc) { S.acc = acc; if (S.multi && S.multi.byKey[acc]) S.result = S.multi.byKey[acc]; }
  const dr = planPatch({ locks: { [date]: u.target.slice() }, bans: { [date]: (((curPlan().bans || {})[date]) || []).filter(x => !u.target.includes(x)) } });
  closeSheet(); toast((u.back ? 'Swap undone' : 'Swap made') + ': today’s lineup locked.' + capMsg(dr));
}
// Lineups dos próximos 3 dias de cada conta, guardados no plano: a tarefa dos avisos (grupo do Telegram) usa-os
// quando ainda não há lineup submetido no Top Shot (só runs a sério)
function publishNext() {
  const run = curRun();
  if (!S.session || !run || run.fictitious || !S.mineLoaded || !Object.keys(S.mine.roster || {}).length || !S.result) return;
  const out = {};
  accounts().forEach(a => {
    const r = S.multi ? S.multi.byKey[a.id] : (a.id === 'main' ? S.result : null); if (!r) return;
    const v = r.normal, m = {}; v.days.slice(0, 3).forEach(d => { if (d.lineup.length) m[d.date] = d.lineup.slice(); });
    out[a.id] = m;
  });
  // com que odds foi feito cada dia: se o lineup de hoje tinha sido feito sem as odds de hoje e agora, com elas,
  // mudou, avisa ao entrar (há quem se esqueça de fixar e o plano troca-lhe os jogadores)
  const hasOdds = date => !!(S.odds[date] && Object.keys(S.odds[date].players || {}).length);
  const nd = nextDay(), today = nd && nd.date, oldOdds = S.mine.plan.nextOdds || {}, oldNext = S.mine.plan.next || {};
  const nextOdds = {}; Object.values(out).forEach(m => Object.keys(m).forEach(d => { nextOdds[d] = hasOdds(d); }));
  if (today && oldOdds[today] === false && nextOdds[today] && !liveOn(today) && !accounts().some(a => holdOn(a.id))) { // com o lineup mantido, avisa o holdCheck
    const ch = Object.keys(out).map(acc => { const a = (oldNext[acc] || {})[today] || [], b = (out[acc] || {})[today] || []; return { acc, old: a, now: b, outs: a.filter(id => !b.includes(id)), ins: b.filter(id => !a.includes(id)) }; }).filter(c => c.outs.length || c.ins.length);
    if (ch.length) { S.oddsPop = { date: today, ch }; setTimeout(oddsPopShow, 600); }
  }
  if (JSON.stringify(oldNext) === JSON.stringify(out) && JSON.stringify(oldOdds) === JSON.stringify(nextOdds)) return;
  S.mine.plan.next = out; S.mine.plan.nextOdds = nextOdds; saveMine();
}
// "O lineup de hoje mudou": as odds de hoje chegaram e o plano trocou jogadores (uma vez, ao entrar na app).
// Por conta: quem sai (vermelho) → quem entra (verde), e escolher entre fixar o novo ou manter o de antes
function oddsPopShow() {
  const P = S.oddsPop; if (!P) return;
  if (!$('sheet').hidden) { setTimeout(oddsPopShow, 2000); return; } // espera que feches a folha que está aberta
  S.oddsPop = null; S.oddsPopLast = P;
  const multi = accounts().length > 1;
  const who = (id, k) => '<span class="op-p ' + k + '">' + face(id, 'sm') + '<span class="op-t"><span class="op-l">' + (k === 'op-out' ? 'Out' : 'In') + '</span><span class="op-n">' + esc(nameOf(id)) + '</span></span></span>';
  const pairs = c => { const n = Math.max(c.outs.length, c.ins.length); return Array.from({ length: n }, (_, i) => '<li class="op-pair">' + (c.outs[i] ? who(c.outs[i], 'op-out') : '<span></span>') + '<span class="op-arrow" aria-hidden="true">→</span>' + (c.ins[i] ? who(c.ins[i], 'op-in') : '<span></span>') + '</li>').join(''); };
  const outTxt = P.out ? P.ch.map(c => c.outs.map((id, i) => '<b>' + esc(nameOf(id)) + '</b> ' + (HOLD_WHY[(c.why || [])[i]] || 'doesn\'t play')).join(', ')).join('; ') : '';
  const sub = P.out ? outTxt + ': someone else came in. The rest of the lineup stayed the same.' : P.g != null ? (holdWhyTxt(P.why) ? 'With ' + holdWhyTxt(P.why) + ', there’s' : 'There’s') + ' a better lineup and the plan switched to it (expected wins in the run <b class="up">+' + gainTxt(P.g) + '</b>). If you prefer the previous one, keep it.' : 'Today’s odds are in and the plan swapped players. If you prefer the previous lineup, keep it.';
  openSheet('<h3>Today’s lineup changed</h3><div class="small muted">' + sub + '</div>' +
    P.ch.map((c, i) => '<div class="card op-card">' + (multi ? '<div class="list-head"><h2>' + esc(accLabel(c.acc)) + '</h2></div>' : '') + '<ul class="list">' + pairs(c) + '</ul>' + (c.P0 != null && c.P1 != null ? '<div class="small muted op-pp">Win today ' + pct(c.P0) + ' → <b class="' + (c.P1 >= c.P0 ? 'up' : 'down') + '">' + pct(c.P1) + '</b></div>' : '') +
      (P.out ? '' : '<div class="op-btns" id="opb-' + i + '"><button class="btn" type="button" data-action="odds-keep" data-k="old" data-i="' + i + '">Keep the lineup</button></div>') + '</div>').join('') +
    '<div class="op-foot"><button class="btn quiet" type="button" data-action="odds-see" data-date="' + P.date + '">See the lineup</button>' + (P.g != null || P.out ? '<button class="btn quiet" type="button" data-action="hold-hist" data-date="' + P.date + '">History</button>' : '') + '</div>' + (P.out ? '<button class="btn primary" type="button" data-action="close-sheet">OK</button>' : ''));
}
// fixa o lineup escolhido (o novo do plano ou o de antes das odds) nessa conta
function oddsKeep(i, which) {
  const P = S.oddsPopLast, c = P && P.ch[i]; if (!c) return;
  if (c.acc !== S.acc) { S.acc = c.acc; if (S.multi && S.multi.byKey[c.acc]) S.result = S.multi.byKey[c.acc]; }
  const { md } = dayInfo(P.date), ids = (which === 'old' ? c.old : c.now).slice(0, (md && md.size) || 5);
  const dr = planPatch({ locks: { [P.date]: ids }, bans: { [P.date]: (((curPlan().bans || {})[P.date]) || []).filter(x => !ids.includes(x)) } });
  const box = $('opb-' + i); if (box) box.innerHTML = '<span class="op-done">' + (which === 'old' ? 'Previous lineup kept ✓' : 'New lineup kept ✓') + '</span>';
  toast((which === 'old' ? 'Previous lineup locked.' : 'New lineup locked.') + capMsg(dr));
}
const nameOf = id => { const r = (S.mine.roster || {})[id]; const p = S.players.get(String(canon(id))); return (r && r.name) || (p && p.name) || String(id); };
const lastName = id => { const parts = nameOf(id).split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : parts[0]; };
// Um dia acabou quando o último jogo começou há mais de 5 h (sem jogos: no dia seguinte ao meio-dia UTC)
function dayEnd(day) {
  const ts = (day.games || []).map(g => Date.parse(g[2])).filter(x => isFinite(x));
  return ts.length ? Math.max(...ts) + 5 * 3600e3 : Date.parse(day.date + 'T12:00:00Z') + 24 * 3600e3;
}
const dayOver = day => Date.now() > dayEnd(day);
// Dias que já acabaram sem resultado registado (não jogaste, ou o resultado ainda não chegou da blockchain): o plano
// deixa de contar com eles (não gasta usos nem os mostra como "hoje"); continuam por registar em Run → Dias
const skippedDays = acc => { const pl = planOf(acc || S.acc).played || {}; return S.days.filter(d => !(pl[d.date] && pl[d.date].done) && dayOver(d)); };
// lineup mantido (keep, ao tirar um cadeado) que já não pode ser: o jogador está fixado noutra conta nessa noite e
// não há Moments/cartas para as duas (ex.: 2.ª jogada nas duas com um só Rare). Sai do "mantido" e o plano escolhe outro
function keepConflict(acc, date, id) {
  const ids = accounts().map(a => a.id), me = ids.indexOf(acc);
  const others = ids.filter((k, j) => k !== acc && ((((planOf(k).locks || {})[date]) || []).includes(id) || (j < me && (((planOf(k).keep || {})[date]) || []).includes(id))));
  if (!others.length) return false;
  const ci = collectionInfo(id);
  if (others.length + 1 > (ci.copies || 1)) return true;
  const cd = (ci.cards || []).slice().sort((a, b) => b - a); if (!cd.length) return false;
  const req = others.concat([acc]).map(k => usedCount(k, id) + 1).sort((a, b) => b - a);
  return req.some((r, j) => r > (cd[j] || 0));
}
function planForEngine(acc, raw) {
  let pa = planOf(acc); const sk = skippedDays(acc);
  // o lineup de hoje fica como estava (keep) até haver um claramente melhor ou alguém ficar de fora (holdSync, holdCheck)
  const hd = !raw && holdOn(acc); if (hd) pa = Object.assign({}, pa, { keep: Object.assign({}, pa.keep || {}, { [hd.d]: hd.ids.slice() }) });
  if (accounts().length > 1 && pa.keep) {
    const keep = {}; let cut = false;
    Object.entries(pa.keep).forEach(([d, ids]) => { const ok = (ids || []).filter(id => !keepConflict(acc, d, id)); if (ok.length !== (ids || []).length) cut = true; keep[d] = ok; });
    if (cut) pa = Object.assign({}, pa, { keep });
  }
  if (!sk.length) return pa;
  const played = Object.assign({}, pa.played || {});
  sk.forEach(d => { played[d.date] = { done: true, result: 'none', lineup: [], auto: true }; });
  return Object.assign({}, pa, { played });
}
// já não está em nenhuma equipa da NBA (retirado, sem contrato): o catálogo (plantéis da ESPN e quem jogou esta
// época) não o tem. Jogadores postos à mão (x-…) não contam.
const gone = id => S.players.size > 200 && !/^x-/.test(String(id)) && !S.players.get(String(canon(id)));
function engineInputs(acc, raw) {
  acc = acc || 'main';
  const run = S.runs.find(r => r.id === S.runId) || {};
  const players = {};
  Object.entries(S.mine.roster || {}).forEach(([id, e]) => {
    const c = S.players.get(String(id)) || {}, pk = acc + '|' + id;
    const uses = S.pendingUses[pk] != null ? S.pendingUses[pk] : usesEff(e, id, acc);
    const ci = collectionInfo(id);
    players[id] = { name: e.name || c.name || id, team: e.team || c.team || '', uses, status: gone(id) ? 'fora' : 'ok' /* o estado vem do relatório de lesões; quem já não está na NBA fica de fora */, injIgnore: !!e.injIgnore, avg: e.avg || c.avg || null, copies: ci.copies, cards: ci.cards || null, owner: ci.owner, hold: ci.hold };
  });
  const odds = { days: {} };
  Object.entries(S.odds).forEach(([d, o]) => { odds.days[d] = { players: o.players || {}, source: o.source, updatedAt: o.updated_at }; });
  return { run: { name: run.name, prizes: run.prizes || [], days: S.days }, roster: { players }, odds, plan: planForEngine(acc, raw) };
}
// O plano só é refeito quando alguma coisa que entra no cálculo mudou (plantel, plano, odds, lesões, jogos já
// começados…): voltar à app ou redesenhar não refaz a run (com smurfs, cada vez são vários segundos no telemóvel).
let calcKey = null;
function compute() {
  if (!S.runId || !S.mineLoaded) { S.result = null; S.multi = null; S.calcError = null; calcKey = null; return; }
  const multi = groupMode(), accs = multi ? accounts() : null;
  if (multi && !accs.some(a => a.id === S.acc)) S.acc = 'main';
  if (!multi) S.acc = 'main';
  let inputs = null, key = null;
  try {
    inputs = multi ? accs.map(a => engineInputs(a.id)) : [engineInputs('main')];
    const now = Date.now(), started = S.days.reduce((n, d) => n + (d.games || []).filter(g => Date.parse(g[2]) <= now).length, 0);
    key = JSON.stringify([accs && accs.map(a => a.id), inputs, engOpts(), formLevel, started, todayET()]);
  } catch (e) { key = null; }
  if (key && key === calcKey && S.result && !S.calcError) { if (S.multi) S.result = S.multi.byKey[S.acc] || S.result; return; }
  S.result = null; S.multi = null; S.calcError = null; calcKey = null;
  try {
    if (multi) {
      // plano conjunto: as coleções das contas como se fossem uma só (um Moment joga por uma conta em cada noite)
      const base = inputs ? inputs[0] : engineInputs('main');
      S.multi = FB.planGroup(base.run, accs.map((a, i) => { const x = inputs ? inputs[i] : engineInputs(a.id); return { key: a.id, roster: x.roster, plan: x.plan }; }), base.odds, engOpts());
      S.result = S.multi.byKey[S.acc];
    } else {
      const x = inputs ? inputs[0] : engineInputs('main'); S.result = FB.planRun(x.run, x.roster, x.odds, x.plan, engOpts());
    }
    calcKey = key;
  } catch (e) { console.error(e); S.calcError = 'Calculation error: ' + (e && e.message); }
}
const mainResult = () => S.multi ? S.multi.byKey.main : S.result;
const curRun = () => S.runs.find(r => r.id === S.runId) || null;
const nextDay = () => { const r = S.result; return r && r.model.days.length ? r.model.days[0].day : null; };
const liveDoc = date => ((curPlan().live || {})[date]) || null;
const liveOn = date => { const l = liveDoc(date); return !!(l && l.active); };
function view() { const r = S.result; return r ? r.normal : null; }
function opp(team, day) {
  const g = FB.gameOf(day, team);
  if (!g) return 'no game';
  return (g[0] === team ? '@ ' + g[1] : 'vs ' + g[0]) + (g[2] ? ' · ' + hm(g[2]) : '');
}
// dúvida no próximo jogo (dia a dia): o plano conta com ele, mas pode ficar de fora
const pPlayOf = info => (info && info.pReal != null ? info.pReal : info ? info.pPlay : 1);
function riskOf(md, id) { const pi = S.result.model.pIndex.get(id), inf = pi != null && md.info[pi] && md.info[pi][0]; return !!(inf && inf.injury && inf.injury.risk && !inf.injury.ignored); }
// quem entra se ele ficar de fora: joga no mesmo dia, o jogo começa depois (ainda dá para trocar) e rende mais
function riskSub(md, day, lineup, id) {
  const r = S.result, team = x => (r.model.players[r.model.pIndex.get(x)] || {}).team, t0 = FB.tipTime(day, team(id)) || 0;
  let best = null;
  md.elig.forEach(pi => { const pid = r.model.players[pi].id; if (lineup.includes(pid) || riskOf(md, pid) || !(r.model.uses[pi] > 0)) return;
    if ((FB.tipTime(day, r.model.players[pi].team) || 0) < t0) return;
    const P = lineupP(md, lineup.filter(x => x !== id).concat([pid])); if (!best || P > best.P) best = { id: pid, P }; });
  return best;
}
function lineupP(md, ids) {
  const idx = ids.map(id => S.result.model.pIndex.get(id)).filter(i => i != null);
  let P = 1;
  md.objs.forEach((o, k) => { let s = md.offset[k], v = 0; idx.forEach(i => { s += md.mu[i][k]; v += md.v[i][k]; }); P *= FB.probAtLeast(s, v, md.T[k]); });
  return md.objs.length ? P : 0;
}

// ---------- render ----------
// não redesenhar uma secção enquanto alguém está a escrever num campo dela
function typingIn(id) { const ae = document.activeElement; return !!(ae && $(id).contains(ae) && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(ae.tagName)); }
function render() {
  if ($('app').hidden) return;
  renderHeader();
  if (S.tab === 'hoje') renderHoje();
  if (S.tab === 'run') renderRun();
  if (S.tab === 'plantel') renderPlantel();
  if (S.tab === 'grupo') renderGrupo();
  if (S.tab === 'ajustes' && !typingIn('tab-ajustes')) renderAjustes();
}
function renderHeader() {
  const run = curRun(), r = S.result;
  const me = S.profile || {};
  $('meBtn').innerHTML = avatar(S.session.user.id, me.display_name);
  const pick = S.tab === 'hoje' && !S.loading;
  if (pick && S.jmode === 'historic') { $('runName').innerHTML = modeTitle(run); $('runMeta').textContent = histMeta(); return; }
  if (pick && S.jmode === 'pro') { $('runName').innerHTML = modeTitle(run); $('runMeta').textContent = 'Trial in ' + (run ? run.name.replace(/ · .*$/, '') : 'run'); return; }
  if (!run) { if (pick) $('runName').innerHTML = modeTitle(run); else $('runName').textContent = 'Fastbreak'; $('runMeta').textContent = S.loading ? 'Loading…' : 'No run'; return; }
  if (pick) $('runName').innerHTML = modeTitle(run); else $('runName').textContent = run.name;
  const bits = [];
  if (run.fictitious) bits.push('<span class="chip">Test</span>');
  // uma linha só: em que dia vai e o registo (as datas estão na faixa da Jornada)
  // com smurfs: o registo e as bolinhas da conta com mais vitórias (em empate, a principal)
  if (r) { const nd = nextDay(), bk = bestAcc(), m = S.multi ? S.multi.byKey[bk] : r; bits.push('<span>' + (nd ? 'Day ' + (nd.idx + 1) + ' of ' + S.days.length : 'Finished') + '</span>', runDots(nd, bk) + recChip(m.wins, m.losses) + (S.multi && accounts().length > 1 ? '<span class="rec-acc">' + esc(accLabel(bk)) + '</span>' : '')); }
  else if (S.days.length) bits.push('<span>' + dShort(S.days[0].date) + ' – ' + dShort(S.days[S.days.length - 1].date) + '</span>');
  $('runMeta').innerHTML = bits.join('<span aria-hidden="true">·</span>');
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
// 12.º / 12th (o site em inglês usa o mesmo código, com LANG = 'en')
const ord = n => (LANG === 'en' ? n + ([11, 12, 13].includes(n % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')) : n + '.º');
// registo compacto: "0–1" (verde as vitórias, vermelho as derrotas), com o texto completo para leitores de ecrã
const recChip = (w, l) => '<span class="recc" title="' + recordTxt(w, l) + '"><span class="vh">' + recordTxt(w, l) + '</span><b class="w" aria-hidden="true">' + w + '</b><i aria-hidden="true">–</i><b class="l" aria-hidden="true">' + l + '</b></span>';
// a run num traço de pontos: verde ganho, vermelho perdido, contorno no dia de hoje (conta principal)
function bestAcc() {
  if (!S.multi) return 'main';
  let best = 'main', bw = -1; accounts().forEach(a => { const x = S.multi.byKey[a.id]; if (x && x.wins > bw) { bw = x.wins; best = a.id; } }); return best;
}
function runDots(nd, acc) {
  const pl = planOf(acc || 'main').played || {};
  return '<span class="rdots" aria-hidden="true">' + S.days.map(d => { const p = pl[d.date]; return '<i class="' + (p && p.done ? (p.result === 'win' ? 'w' : 'l') : nd && nd.date === d.date ? 'n' : '') + '"></i>'; }).join('') + '</span>';
}
const recordTxt = (w, l) => (w + l === 0 ? 'no results yet' : plural(w, 'win', 'wins') + ', ' + plural(l, 'loss', 'losses'));
// probabilidade em palavras
const likely = p => (p >= 0.95 ? 'Almost certain' : p >= 0.75 ? 'Very likely' : p >= 0.55 ? 'Probable' : p >= 0.4 ? 'Toss-up' : p >= 0.2 ? 'Possible' : p >= 0.05 ? 'Hard' : 'Very hard');
// aro de cesto que enche com a probabilidade (um por patamar de prémio)
function aro(p, center, size, extra) {
  const v = Math.max(0, Math.min(1, +p || 0));
  return '<span class="aro t-' + tone(v) + (size < 40 ? ' sm' : '') + '" style="--p:' + (v * 100).toFixed(1) + ';--s:' + size + 'px" role="img" aria-label="' + esc(center) + ' wins: ' + pct(v) + '" title="' + esc(center) + ' wins: ' + pct(v) + (extra ? ' · ' + esc(extra) : '') + '"><b>' + esc(center) + '</b></span>';
}
const miniAros = (prizes, probs) => '<span class="aros-mini">' + prizes.map((p, i) => aro(probs[i], p.wins, 30)).join('') + '</span>';
function empty(title, text, btn) { return '<div class="card empty"><h2>' + esc(title) + '</h2><p class="muted small" style="margin:0;max-width:44ch">' + esc(text) + '</p>' + (btn || '') + '</div>'; }
function guard(el, needRoster) {
  if (S.loading) { el.innerHTML = empty('Loading…', 'Reading the run and your roster.'); return false; }
  if (!S.runId) {
    el.innerHTML = S.role === 'admin' ? empty('No runs yet', 'Runs arrive by themselves from the blockchain when they start.')
      : empty('No runs yet', 'The group admin hasn\'t created the run yet. Come back later.');
    return false;
  }
  if (S.calcError) { el.innerHTML = empty('Error', S.calcError); return false; }
  if (needRoster && !Object.keys(S.mine.roster || {}).length) {
    el.innerHTML = empty('Your roster is missing', 'Add your players and the plan appears.', '<button class="btn primary" type="button" data-action="goto" data-tab="plantel">Build roster</button>');
    return false;
  }
  return !!S.result;
}

// ---- valores por objetivo (num dia de combinação há um por estatística: 3PM e 3PA, AST e STL…) ----
function objVals(md, pi, live) {
  return (md.objs || []).map((o, k) => {
    const info = (md.info[pi] || [])[k] || {}, st = live ? info.liveState : null;
    const v = st === 'fim' ? info.known : st === 'jogo' ? info.known + info.muLeft : info.mu;
    return { o, v: v || 0, fin: st === 'fim' };
  });
}
function pvHtml(vals, mark) {
  const fv = x => (x.fin || Math.abs(x.v) >= 10 ? f0(x.v) : f1(x.v)); // 32 PTS, 1,4 STL (os decimais ficam na ficha e no Porquê)
  if (vals.length <= 1) { const x = vals[0]; return '<div class="pv"><div class="v num">' + (x ? fv(x) : '–') + '</div><div class="u">' + esc(x ? statShort(x.o.stat) : '') + (mark || '') + '</div></div>'; }
  return '<div class="pv pv-multi">' + vals.map(x => '<div><b class="num">' + fv(x) + '</b><span class="u">' + esc(statShort(x.o.stat)) + '</span></div>').join('') + '</div>';
}
// barra de cada objetivo: projeção (ou feito ao vivo), alvo e, com mais de um, a chance de cada um
function objBars(d, live) {
  const many = d.totals.length > 1;
  return d.totals.map(t => {
    const max = Math.max(t.target * 1.2, t.mu + t.sd, 1);
    const kw = Math.min(100, t.known / max * 100), fw = Math.min(100 - kw, (t.mu - t.known) / max * 100);
    const pk = FB.probAtLeast(t.mu, t.sd * t.sd, t.target), lbl = many ? '<b class="bs">' + esc(statShort(t.stat)) + '</b> ' : '';
    return '<div class="obj-bar"><div class="bar" aria-hidden="true"><i class="k" style="width:' + kw.toFixed(1) + '%"></i><i class="f" style="left:' + kw.toFixed(1) + '%;width:' + Math.max(0, fw).toFixed(1) + '%"></i><i class="t" style="left:' + Math.min(99, t.target / max * 100).toFixed(1) + '%"></i></div>' +
      '<div class="bar-cap">' + (live && t.known ? '<span>' + lbl + 'Done <b class="num">' + f0(t.known) + '</b> · left <b class="num">' + f0(Math.max(0, t.target - t.known)) + '</b></span><span>final ≈ <b class="num">' + f1(t.mu) + '</b>' + (many ? ' · <b class="num">' + pct(pk) + '</b>' : '') + '</span>'
        : '<span>' + lbl + (many ? '' : 'Projection ') + '<b class="num">' + f1(t.mu) + '</b> <span class="num">± ' + f1(t.sd) + '</span></span><span>target <b class="num">' + t.target + '</b>' + (many ? ' · <b class="num">' + pct(pk) + '</b>' : '') + '</span>') + '</div></div>';
  }).join('');
}
// ---- Jornada (antigo "Hoje"): o dia escolhido na faixa dos dias; por defeito o próximo dia por jogar ----
// S.hd = data escolhida (null = o próximo dia). Dias que já passaram mostram o resultado e o previsto vs real.
function jornadaDay() {
  const r = S.result; if (!r) return null;
  const nd0 = nextDay();
  if (S.hd && (!S.days.some(x => x.date === S.hd) || (nd0 && S.hd === nd0.date))) S.hd = null;
  const date = S.hd || (nd0 ? nd0.date : null); if (!date) return null;
  const day = S.days.find(x => x.date === date), { md, d } = dayInfo(date);
  return { date, day, idx: S.days.indexOf(day), md, d, cur: !!nd0 && date === nd0.date, past: !md || !d };
}
// quem do lineup de um dia está no relatório de lesões (para a faixa dos dias e o cartão de lesões)
function lineupInjured(r, md, ids) {
  return ids.filter(id => { const pi = r.model.pIndex.get(id), inf = pi != null && md.info[pi] && md.info[pi][0]; return inf && inf.injury && !inf.injury.ignored && inf.injury.status; });
}
// faixa com os dias todos da run: resultado nos que passaram, vitória prevista nos que faltam, ponto vermelho se há lesão no lineup
function dayStrip(sel) {
  const r = S.result, v = view(), nd0 = nextDay(), pl = curPlan().played || {};
  return '<div class="day-strip" role="group" aria-label="Run days">' + S.days.map((day, i) => {
    const p = pl[day.date], { md, d } = dayInfo(day.date), now = !!nd0 && nd0.date === day.date;
    let val = '–', cls = '', sr = '';
    if (p && p.done && (p.result === 'win' || p.result === 'loss')) {
      // dia jogado: caixa como as outras com um degradê verde ou vermelho por baixo e ✓ / ✕ no lugar da percentagem
      val = p.result === 'win' ? '✓' : '✕'; cls = p.result === 'win' ? ' win' : ' loss'; sr = '<span class="vh">' + (p.result === 'win' ? 'win' : 'loss') + '</span>';
    }
    else if (md && d && !d.noObjective && d.lineup.length) { val = pct(d.P); cls = ' c-' + dTone(d.P); }
    else if (!md && !(p && p.noAuto) && lineupFor(S.acc, day.date)) val = '…'; // passou: à espera das estatísticas
    const inj = md && d ? lineupInjured(r, md, d.lineup).length : 0;
    return '<button type="button" class="ds' + cls + (now ? ' now' : '') + '" data-action="hd" data-date="' + day.date + '" aria-pressed="' + (day.date === sel) + '"><b class="num">' + (i + 1) + '</b><small>' + (now ? 'Today' : dWeek(day.date)) + '</small><span class="ds-v num">' + val + '</span>' + sr + (inj ? '<i class="ds-inj" title="Injury in the lineup"></i>' : '') + '</button>';
  }).join('') + '</div>';
}
async function shareLineup(date) {
  const r = S.result, v = view(), { md, d } = dayInfo(date); if (!r || !md || !d || !d.lineup.length) return;
  const day = md.day, objLine = (day.objectives || []).filter(x => x && x.stat).map(x => x.target + ' ' + statShort(x.stat)).join(' + ');
  const text = 'Fast Break · Day ' + (day.idx + 1) + ' (' + dWeek(date) + ' ' + dShort(date) + ')\n' + objLine;
  toast('Preparing the image…');
  const W = 1080, PAD = 48, RH = 168, H = PAD * 2 + RH * d.lineup.length, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), font = (w, px) => w + ' ' + px + 'px "IBM Plex Sans", system-ui, sans-serif';
  g.fillStyle = '#1B2638'; g.fillRect(0, 0, W, H);
  // fotos: primeiro a cópia guardada no próprio site (heads/, tarefa das médias), senão a da ESPN (se a ESPN deixar)
  const load = (src, cors) => new Promise(ok => { const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; setTimeout(() => ok(null), 6000); });
  const photo = async id => { const e = espnIdOf(id); if (!e) return null; return (await load(siteBase() + 'heads/' + encodeURIComponent(e) + '.png')) || load('https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/' + encodeURIComponent(e) + '.png&w=260&h=190', true); };
  const imgs = await Promise.all(d.lineup.map(photo));
  const locks = new Set(((curPlan().locks || {})[date]) || []);
  d.lineup.forEach((id, i) => {
    const pi = r.model.pIndex.get(id), p = r.model.players[pi], y = PAD + i * RH, cx = PAD + 62, cy = y + RH / 2, R = 62;
    if (i) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(PAD, y, W - PAD * 2, 2); }
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.closePath(); g.fillStyle = TEAM_COLOR[p.team] || '#334'; g.fill(); g.clip();
    if (imgs[i]) { const im = imgs[i], sc = (R * 2.4) / im.width; g.drawImage(im, cx - im.width * sc / 2, cy - R * 0.95, im.width * sc, im.height * sc); }
    else { g.fillStyle = '#fff'; g.font = font(700, 40); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(initials(p.name), cx, cy); }
    g.restore(); g.lineWidth = 4; g.strokeStyle = '#0b0f16'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#F5F7FB'; g.font = font(600, 44);
    g.fillText((locks.has(id) ? '🔒 ' : '') + p.name, cx + R + 32, cy - 6);
    g.fillStyle = '#9EABBE'; g.font = font(400, 32); g.fillText(p.team + ' ' + opp(p.team, day), cx + R + 32, cy + 40);
    const vals = objVals(md, pi, false), fv = x => (Math.abs(x.v) >= 10 ? f0(x.v) : f1(x.v));
    g.textAlign = 'right'; const lines = vals.length, top = cy - (lines - 1) * 26;
    vals.forEach((x, k) => { const yy = top + k * 52 + 14; g.font = font(600, 26); g.fillStyle = '#9EABBE'; const lab = statShort(x.o.stat); g.fillText(lab, W - PAD, yy); const lw = g.measureText(lab).width; g.font = font(800, 46); g.fillStyle = '#F5F7FB'; g.fillText(fv(x), W - PAD - lw - 12, yy); });
  });
  const blob = await new Promise(ok => { try { cv.toBlob(ok, 'image/png'); } catch (e) { ok(null); } });
  if (!blob) { try { await navigator.clipboard.writeText(text); } catch (e) {} toast('Could not make the image. The text was copied.'); return; }
  // a partilha precisa de um toque "fresco" (o iPhone recusa depois de esperar pelas fotos): mostra a imagem e o botão
  const file = new File([blob], 'lineup-dia-' + (day.idx + 1) + '.png', { type: 'image/png' }), url = URL.createObjectURL(blob);
  S.shareDoc = { file, text, url };
  openSheet('<h3>Share the lineup</h3><div class="small muted" style="white-space:pre-line">' + esc(text) + '</div><img class="share-img" src="' + url + '" alt="Lineup for day ' + (day.idx + 1) + '">' +
    '<button class="btn primary" type="button" data-action="share-go">' + icoShare + ' Share</button>');
}
async function shareGo() {
  const D = S.shareDoc; if (!D) return;
  // o WhatsApp às vezes larga o texto quando vai com uma imagem: fica também copiado, para colar como legenda
  try { await navigator.clipboard.writeText(D.text); } catch (e) {}
  try { if (navigator.canShare && navigator.canShare({ files: [D.file] })) { await navigator.share({ files: [D.file], text: D.text, title: D.text.split('\n')[0] }); toast('If the text doesn’t show up in WhatsApp, paste it: it was copied.'); return; } }
  catch (e) { if (e && e.name === 'AbortError') return; }
  // sem partilha de ficheiros (computador): descarrega a imagem e copia o texto
  const a = document.createElement('a'); a.href = D.url; a.download = D.file.name; document.body.appendChild(a); a.click(); a.remove();
  try { await navigator.clipboard.writeText(D.text); } catch (e) {}
  toast('Image downloaded and text copied: paste it into WhatsApp.');
}
function jornadaNav(date, sub) {
  const accs = groupMode() ? accounts().map(a => {
    const R = S.multi && S.multi.byKey[a.id], dd = R && R.normal.days.find(x => x.date === date), pl = ((planOf(a.id).played || {})[date]) || null;
    const v = pl && pl.done ? (pl.result === 'win' ? '<b class="c-ok">✓</b>' : pl.result === 'loss' ? '<b class="c-no">✕</b>' : '') : dd ? (dd.lineup.length ? '<b class="c-' + dTone(dd.P) + '">' + pct(dd.P) + '</b>' : '<span class="muted">–</span>') : '';
    return '<button type="button" class="acc-chip" data-action="acc" data-acc="' + esc(a.id) + '" aria-pressed="' + (S.acc === a.id) + '">' + esc(a.label) + ' ' + v + '</button>';
  }).join('') : '';
  const links = SUBS.hoje().map(([k, l]) => '<button type="button" class="btn link small" data-action="sub" data-stab="hoje" data-sub="' + k + '" aria-pressed="' + (k === sub) + '">' + l + '</button>').join('<span aria-hidden="true">·</span>');
  return '<div class="j-nav"><div class="j-accs" role="group" aria-label="Account">' + accs + '</div><div class="j-links">' + links + '</div></div>';
}
// ---------- Jornada → modo: Classic (o plano da run) ou Historic (lendas simuladas, orçamento de Roster Points) ----------
S.jmode = (() => { try { return localStorage.getItem('fb-jmode') || 'classic'; } catch (e) { return 'classic'; } })();
const JMODES = [['classic', 'Classic'], ['historic', 'Historic'], ['pro', 'Pro']];
// o modo escolhe-se no título (na Jornada): "Run 1 · Classic ▾" — não ocupa uma linha por cima do lineup
function modeTitle(run) {
  const H = groupHist(), hn = H && H.run && String(H.run.name || '').match(/run\s*(\d+)/i);
  const lab = { classic: run ? run.name : 'Classic', historic: 'Historic' + (hn ? ' · Run ' + hn[1] : ''), pro: 'Pro' };
  return '<span class="mode-pick">' + esc(lab[S.jmode] || lab.classic) + '<svg class="caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '<select id="jmode" aria-label="Matchday mode">' + JMODES.map(([k]) => '<option value="' + k + '"' + (S.jmode === k ? ' selected' : '') + '>' + esc(lab[k]) + '</option>').join('') + '</select></span>';
}
// ---- Pro ----
// Cada noite do Pro só conta cartas de certos sets (os grandes Rare e Legendary, as estreias, cartas com emblemas).
// Enquanto a Run 2 não abre: o que o grupo já tem de cada família. Quando abrir, o leitor traz as regras de cada
// noite e os preços das cartas que contam (sonda-pro.html para ver primeiro o formato).
const PRO_FAM = [
  { k: 'mgle', name: 'Metallic Gold LE', short: 'MGLE', re: /metallic gold/i },
  { k: 'holo', name: 'Holo Icon', short: 'Holo', re: /holo|top shot 50|cosmic/i },
  { k: 'debut', name: 'Debuts', short: 'Debut', re: /debut/i },
];
function proOwned() {
  const col = (S.profile || {}).collection, items = (col && col.items) || {}, out = PRO_FAM.map(f => ({ f, by: new Map() }));
  Object.values(items).forEach(it => {
    const fam = out.find(x => x.f.re.test(String(it.s || ''))); if (!fam || !it.p) return;
    const e = fam.by.get(it.p) || fam.by.set(it.p, { id: it.p, n: 0, accs: new Set(), sets: new Set(), tier: null }).get(it.p);
    e.n++; e.accs.add(it.a || 'main'); e.sets.add(String(it.s).replace(/ · .*$/, ''));
    const t = setTier(col, it.s); if (t) e.tier = e.tier && TIER_RANK[e.tier] >= TIER_RANK[t] ? e.tier : t;
  });
  return out;
}
const TIER_RANK = { Common: 1, Fandom: 1, Rare: 2, Legendary: 3, Ultimate: 4 };
// ---- Pro em ensaio na run Classic que está a decorrer ----
// Enquanto o Pro não abre: cada dia da run leva uma regra inventada (as famílias do Pro à vez) para testar as contas.
// Preços: a carta mais barata de cada família, lida no Top Shot (Ajustes → Admin → Ler no Top Shot → Preços do Pro).
try { S.proMine = JSON.parse(localStorage.getItem('fb-pro') || 'null'); } catch (e) { S.proMine = null; }
function groupPro() {
  const docs = [S.proMine].concat(((S.group || {}).summaries || []).map(x => x.share && x.share.pro)).filter(d => d && d.at && d.p);
  return docs.sort((p, q) => String(q.at).localeCompare(String(p.at)))[0] || null;
}
const proRule = idx => PRO_FAM[idx % PRO_FAM.length];
// jogadores cujo preço o leitor vai ver: os que têm jogo nos dias que faltam (mais minutos primeiro) e os do Pro que já tens
function proWanted() {
  const today = todayET(), teams = new Set(); S.days.forEach(d => { if (d.date >= today) (d.games || []).forEach(g => { teams.add(g[0]); teams.add(g[1]); }); });
  const pts = p => { const a = FB.avgOf({ avg: p.avg }, 'pts'); return a ? a.v : 0; };
  const list = [...S.players.values()].filter(p => p.team && teams.has(p.team) && p.avg && (+p.avg.min || 0) >= 18).sort((a, b) => pts(b) - pts(a)).slice(0, 150).map(p => p.id);
  proOwned().forEach(x => x.by.forEach((e, id) => { if (!list.includes(id)) list.push(id); }));
  return list;
}
// modelo com todos os candidatos (os que tens das famílias do Pro e os que têm preço): só para as contas de um dia
function proModel(P) {
  const owned = proOwned(), key = [S.runId, P && P.at, owned.map(x => x.by.size).join(), Object.keys(S.odds || {}).length, S.days.length].join('|');
  if (S.proMemo && S.proMemo.key === key) return S.proMemo;
  const x = engineInputs('main'), wide = { players: {} }, ids = new Set(Object.keys((P && P.p) || {}));
  owned.forEach(o => o.by.forEach((e, id) => ids.add(id)));
  ids.forEach(id => { const c = S.players.get(String(id)) || {}; if (!c.team) return; wide.players[id] = { name: c.name || id, team: c.team, uses: 9, status: gone(id) ? 'fora' : 'ok', avg: c.avg || null, copies: 1, owner: 'main' }; });
  let mw = null; try { mw = FB.buildModel(x.run, wide, x.odds, { played: {}, locks: {}, bans: {} }, engOpts()); } catch (e) { console.warn('pro', e); }
  S.proMemo = { key, mw, owned };
  return S.proMemo;
}
// P(vitória) de um lineup (índices do modelo) num dia
function proP(md, set) {
  if (!md.objs.length) return 0; let P = 1;
  md.objs.forEach((o, k) => { let s0 = md.offset[k], v = 0; set.forEach(i => { s0 += md.mu[i][k]; v += md.v[i][k]; }); P *= FB.probAtLeast(s0, v, md.T[k]); });
  return P;
}
// o melhor lineup com um conjunto de jogadores (os 16 que mais contam, todas as combinações)
function proBest(md, pool) {
  const size = md.size || 5, con = i => md.objs.reduce((t, o, k) => t + md.mu[i][k] / (md.T[k] || 1), 0);
  const top = pool.slice().sort((a, b) => con(b) - con(a)).slice(0, 16), n = Math.min(size, top.length);
  let best = { set: top.slice(0, n), P: proP(md, top.slice(0, n)) };
  const rec = (start, cur) => { if (cur.length === n) { const P = proP(md, cur); if (P > best.P) best = { set: cur.slice(), P }; return; } for (let i = start; i <= top.length - (n - cur.length); i++) { cur.push(top[i]); rec(i + 1, cur); cur.pop(); } };
  if (n) rec(0, []);
  return best;
}
function proDay(date) {
  const P = groupPro(), M = proModel(P), mw = M.mw; if (!mw) return null;
  const idx = S.days.findIndex(d => d.date === date), md = mw.days.find(z => z.day.date === date); if (idx < 0 || !md) return null;
  const rule = proRule(idx), fam = M.owned.find(o => o.f.k === rule.k), mine = new Set([...fam.by.keys()]);
  const elig = i => md.eligSet.has(i);
  const ownIdx = [...mine].map(id => mw.pIndex.get(id)).filter(i => i != null && elig(i));
  const base = proBest(md, ownIdx);
  // compras: a cada passo, a carta (da família do dia) que mais sobe a hipótese, até 5 ou até deixar de valer a pena
  const price = id => { const r = P && P.p[id] && P.p[id][rule.k]; return r ? r : null; };
  const con = i => md.objs.reduce((t, o, k) => t + md.mu[i][k] / (md.T[k] || 1), 0);
  const cands = mw.players.map((p, i) => i).filter(i => elig(i) && !mine.has(mw.players[i].id) && price(mw.players[i].id)).sort((a, b) => con(b) - con(a)).slice(0, 40);
  let L = base.set.slice(), Pc = base.P; const steps = [], size = md.size || 5;
  for (let s = 0; s < 8; s++) {
    let best = null;
    cands.forEach(c => { if (L.includes(c)) return;
      const opts = L.length < size ? [L.concat([c])] : L.map(m => L.filter(x => x !== m).concat([c]));
      opts.forEach(set => { const Pn = proP(md, set), pr = price(mw.players[c].id)[0]; if (!best || Pn > best.P + 1e-9 || (Math.abs(Pn - best.P) < 1e-9 && pr < best.pr)) best = { c, set, P: Pn, pr, out: L.find(x => !set.includes(x)) }; }); });
    if (!best || (L.length >= size && best.P - Pc < 0.005)) break; // lugares vazios enchem-se sempre
    steps.push({ id: mw.players[best.c].id, P0: Pc, P: best.P, pr: best.pr, row: price(mw.players[best.c].id), out: best.out != null ? mw.players[best.out].id : null });
    L = best.set; Pc = best.P; if (Pc >= 0.95) break;
  }
  return { rule, md, base: { ids: base.set.map(i => mw.players[i].id), P: base.P }, steps, final: { ids: L.map(i => mw.players[i].id), P: Pc }, size, P };
}
// a carta do jogador que já tens (noutro set) e quanto vale (ASP), para a diferença até à carta do Pro
// as minhas cartas de um jogador (todas as contas), por set, com o ASP da edição (leitura das cartas, se houver)
function proMyCards(id) {
  const col = (S.profile || {}).collection, by = new Map();
  Object.values((col && col.items) || {}).forEach(it => {
    if (String(it.p) !== String(id)) return;
    const base = String(it.s || '?').split(' · ')[0], e = by.get(base) || by.set(base, { set: base, tier: setTier(col, it.s), n: 0, accs: new Set(), asp: null }).get(base);
    e.n++; e.accs.add(it.a || 'main');
  });
  const rows = (S.edMine && S.edMine.p && S.edMine.p[id]) || [];
  by.forEach(e => { const r = rows.filter(x => norm(String(x[0]).replace(/\s*\d+$/, '')) === norm(e.set.replace(/\s*\d+$/, '')) && x[3] > 0).sort((a, b) => b[3] - a[3])[0]; if (r) e.asp = r[3]; });
  return [...by.values()].sort((a, b) => (b.asp || 0) - (a.asp || 0) || (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0));
}
// a carta mais valiosa que já tens desse jogador (para a diferença até à carta do Pro)
const proOwnValue = id => proMyCards(id)[0] || null;
// folha de uma compra: a carta que conta (a mais barata à venda), a tua, a diferença e o que muda no dia
function proCardSheet(date, i) {
  const X = proDay(date); const st = X && X.steps[+i]; if (!st) return;
  const mine = proMyCards(st.id), own = mine[0] || null, tierTxt = t => t ? t.charAt(0) + t.slice(1).toLowerCase() : '';
  const row = (l, v) => '<div class="pro-kv"><span class="muted">' + l + '</span><b>' + v + '</b></div>';
  openSheet('<h3>' + esc(nameOf(st.id)) + '</h3>' +
    row('Card that counts (cheapest for sale)', esc(tierTxt(st.row[1])) + ' · ' + esc(st.row[2] || X.rule.name) + ' · ' + usdC(st.pr)) +
    (own ? row('Your most valuable card of him', esc(own.set) + (own.tier ? ' · ' + esc(own.tier) : '') + ' · ' + (own.asp ? 'ASP ' + usdC(own.asp) : 'no ASP read')) +
      (own.asp ? row('Difference (if you sell yours)', (st.pr - own.asp > 0 ? '+' : '−') + usdC(Math.abs(st.pr - own.asp))) : '') : row('Your card of him', 'you don\'t have one')) +
    (mine.length > 1 ? '<div class="small muted">You also have: ' + mine.slice(1).map(c => esc(c.set) + (c.asp ? ' (ASP ' + usdC(c.asp) + ')' : '')).join(', ') + '</div>' : '') +
    row('This day', pct(st.P0) + ' → <span class="c-good">' + pct(st.P) + '</span>' + (st.out ? ' · out ' + esc(nameOf(st.out)) : '')) +
    (st.row && st.row[3] ? '<div class="small muted">ASP of the card that counts: ' + usdC(st.row[3]) + '</div>' : '') +
    '<div class="btns"><button class="btn primary" type="button" data-action="close-sheet">OK</button></div>');
}
const usdC = c => usd(c / 100); // preços do Top Shot vêm em cêntimos
function renderPro(el) {
  const fams = proOwned(), multi = accounts().length > 1, hasCol = !!(((S.profile || {}).collection || {}).items);
  const today = todayET(), days = S.days.map((d, i) => ({ d, i })).filter(x => x.d.date >= today);
  if (!days.some(x => x.d.date === S.proDay)) S.proDay = days.length ? days[0].d.date : null;
  const intro = '<div class="note info">Pro trial on the Classic run: each day gets a made-up rule (Metallic Gold LE, Holo Icon, debuts, in turn). In Run 2 the rules come from Top Shot.</div>';
  const strip = days.length ? '<div class="day-strip" role="group" aria-label="Trial days">' + days.map(({ d, i }) => '<button type="button" class="ds" data-action="pro-day" data-date="' + d.date + '" aria-pressed="' + (d.date === S.proDay) + '"><b class="num">' + (i + 1) + '</b><small>' + dWeek(d.date) + '</small><span class="ds-v">' + esc(proRule(i).short) + '</span></button>').join('') + '</div>' : '';
  let dayHtml = '';
  if (S.proDay) {
    const X = S.result ? proDay(S.proDay) : null, P = groupPro(), dn = S.days.findIndex(d => d.date === S.proDay) + 1, rule = proRule(dn - 1);
    const objs = ((S.days[dn - 1] || {}).objectives || []).filter(o => o && o.stat).map(o => o.target + ' ' + statShort(o.stat)).join(' + ');
    const li = (id, right, sub) => '<li class="row pro-row">' + face(id, 'sm') + '<span class="pro-n"><b>' + esc(nameOf(id)) + '</b><small class="muted">' + sub + '</small></span>' + right + '</li>';
    const head = '<div class="card hero day-hero">' + COURT + '<div class="hero-top"><span class="eyebrow">Pro (trial) · Day ' + dn + ' · ' + esc(objs) + '</span></div><div class="small muted" style="margin-top:4px">Only cards from <b>' + esc(rule.name) + '</b></div>' +
      (X ? '<div class="score"><div class="gblocks"><div class="gb"><span class="gb-st">With what you have</span><span class="gb-n">' + pct(X.base.P) + '</span><span class="gb-t">' + plural(X.base.ids.length, 'eligible card', 'eligible cards') + ' playing</span></div></div>' + winRing(X.final.P, tone(X.final.P), pct(X.final.P), X.steps.length ? 'buying' : 'win') + '</div>' : '') + '</div>';
    if (!X) dayHtml = head + '<div class="note">Still working out the plan…</div>';
    else {
      const baseCard = '<div class="card"><div class="list-head"><h2>Your lineup with what you have</h2><span class="small muted">' + pct(X.base.P) + '</span></div>' + (X.base.ids.length ? '<ul class="list">' + X.base.ids.map(id => { const c = proMyCards(id).find(x => rule.re.test(x.set)); return li(id, '', esc((S.players.get(id) || {}).team || '') + (c ? ' · ' + esc(c.set) + (c.asp ? ' · ASP ' + usdC(c.asp) : '') : '')); }).join('') + '</ul>' : '<div class="pad small muted">You have no ' + esc(rule.name) + ' cards of anyone playing this day.</div>') + (X.base.ids.length && X.base.ids.length < X.size ? '<div class="pad small muted">' + (X.size - X.base.ids.length) + ' short of a full lineup.</div>' : '') + '</div>';
      let buyCard;
      if (!P) buyCard = '<div class="card"><div class="list-head"><h2>To be competitive</h2></div><div class="pad small muted">Prices missing: ' + (S.role === 'admin' ? '<button class="btn small" type="button" data-action="ranks-go" data-do="pro">Read Pro prices</button>' : 'the admin reads them in Settings → Admin → Read on Top Shot → Pro prices.') + '</div></div>';
      else if (!X.steps.length) buyCard = '<div class="card"><div class="list-head"><h2>To be competitive</h2></div><div class="pad small muted">' + (X.base.P >= 0.5 ? 'You\'re already fine with what you have.' : 'No card for sale raises the chance of this day.') + '</div></div>';
      else {
        let tot = 0, reach = null;
        const rows = X.steps.map((st, k) => { tot += st.pr; if (reach == null && st.P >= 0.5) reach = { k: k + 1, tot };
          const own = proOwnValue(st.id);
          const sub = esc(st.row[1] ? st.row[1].charAt(0) + st.row[1].slice(1).toLowerCase() + ' · ' : '') + '<b>' + usdC(st.pr) + '</b>' + (own ? ' · you have ' + esc(own.set) + (own.asp ? ' (' + usdC(own.asp) + ')' : '') : '');
          return '<li><button class="row pro-row" type="button" data-action="pro-card" data-date="' + S.proDay + '" data-i="' + k + '">' + face(st.id, 'sm') + '<span class="pro-n"><b>' + esc(nameOf(st.id)) + '</b><small class="muted">' + sub + '</small></span><span class="pro-p num">' + pct(st.P) + '</span></button></li>'; }).join('');
        const sumTxt = reach ? 'With <b>' + plural(reach.k, 'card', 'cartas') + ' (' + usdC(reach.tot) + ')</b> you go from ' + pct(X.base.P) + ' to over 50%.' : 'With these ' + plural(X.steps.length, 'card', 'cartas') + ' (' + usdC(tot) + ') you reach ' + pct(X.final.P) + '.';
        buyCard = '<div class="card"><div class="list-head"><h2>To be competitive</h2><span class="small muted">prices from ' + esc(ago(P.at)) + '</span></div><div class="pad small">' + sumTxt + '</div><ul class="list">' + rows + '</ul></div>';
      }
      dayHtml = head + baseCard + buyCard;
    }
  }
  const famCard = x => {
    const list = [...x.by.values()].sort((a, b) => (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0) || String(nameOf(a.id)).localeCompare(nameOf(b.id)));
    return '<div class="card"><div class="list-head"><h2>' + esc(x.f.name) + '</h2><span class="small muted">' + plural(list.length, 'player', 'players') + '</span></div>' +
      (list.length ? '<ul class="list">' + list.map(e => '<li class="row pro-row">' + face(e.id, 'sm') + '<span class="pro-n"><b>' + esc(nameOf(e.id)) + '</b><small class="muted">' + esc([...e.sets].join(', ')) + ((c => c && c.asp ? ' · ASP ' + usdC(c.asp) : '')(proMyCards(e.id).find(y => x.f.re.test(y.set)))) + (multi ? ' · ' + [...e.accs].map(a => esc(accLabel(a))).join(', ') : '') + '</small></span>' + (e.tier ? '<span class="pill">' + esc(e.tier) + (e.n > 1 ? ' ×' + e.n : '') + '</span>' : '') + '</li>').join('') + '</ul>' : '<div class="pad small muted">No cards from these sets in your collection.</div>') + '</div>';
  };
  const owned = hasCol ? '<h2 class="sec-h">What you already have for Pro</h2>' + fams.map(famCard).join('') : empty('Your collection', 'You haven\'t read your collection yet: go to Players → Collection to see which cards you have for Pro.');
  const admin = S.role === 'admin' ? '<div class="card"><div class="pad small">To get ready for Run 2: open the <a href="sonda-pro.html" target="_blank" rel="noopener">Pro probe</a> on a computer, run it on Top Shot and send me the result.</div></div>' : '';
  el.innerHTML = intro + strip + dayHtml + owned + admin;
}
// Historic: o dia que vem (para a linha debaixo do título)
function histMeta() {
  const H = groupHist(); if (!H) return 'No data';
  const now = Date.now(), nd = H.days.find(d => d.players && d.players.length && Date.parse(d.locks) > now);
  return nd ? 'Day ' + histDayNo(nd.id) + ' of ' + H.days.length : 'Finished';
}
// o que o leitor do Top Shot trouxe do Historic (fica no meu resumo; o grupo usa o mais recente)
try { S.histMine = JSON.parse(localStorage.getItem('fb-hist') || 'null'); } catch (e) { S.histMine = null; }
function histTake(h) {
  S.histMine = h; S.histMemo = null; S.histCache = {};
  try { localStorage.setItem('fb-hist', JSON.stringify(h)); } catch (e) {}
  const nd = (h.days || []).find(d => d.players && d.players.length && Date.parse(d.locks) > Date.now());
  S.pickNote = (S.pickNote || '') + ' Historic: ' + plural((h.days || []).filter(d => d.lines && d.lines.length).length, 'day played', 'days played') + (nd ? ', ' + nd.players.length + ' legends on day ' + histDayNo(nd.id) : '') + '.';
  S.lastSummary = '';
}
function groupHist() {
  const docs = [S.histMine].concat(((S.group || {}).summaries || []).map(x => x.share && x.share.hist)).filter(h => h && h.at && Array.isArray(h.days));
  return docs.sort((p, q) => String(q.at).localeCompare(String(p.at)))[0] || null;
}
const histDayNo = id => (String(id).match(/-d(\d+)$/) || [])[1] || '?';
// data do dia (os lineups fecham de madrugada em Lisboa: o dia é o do fuso dos EUA)
const histDate = d => new Date(Date.parse(d.locks) - 6 * 3600e3).toISOString().slice(0, 10);
const NBA_TEAM = { 1610612737: 'ATL', 1610612738: 'BOS', 1610612739: 'CLE', 1610612740: 'NOP', 1610612741: 'CHI', 1610612742: 'DAL', 1610612743: 'DEN', 1610612744: 'GSW', 1610612745: 'HOU', 1610612746: 'LAC', 1610612747: 'LAL', 1610612748: 'MIA', 1610612749: 'MIL', 1610612750: 'MIN', 1610612751: 'BKN', 1610612752: 'NYK', 1610612753: 'ORL', 1610612754: 'IND', 1610612755: 'PHI', 1610612756: 'PHX', 1610612757: 'POR', 1610612758: 'SAC', 1610612759: 'SAS', 1610612760: 'OKC', 1610612761: 'TOR', 1610612762: 'UTA', 1610612763: 'MEM', 1610612764: 'WAS', 1610612765: 'DET', 1610612766: 'CHA' };
const hTeam = id => NBA_TEAM[id] || '?';
// lendas que já cá não estão (na simulação continuam a jogar os 36 minutos)
const H_RIP = { 'moses malone': '1955–2015', 'bob lanier': '1948–2022', 'nate thurmond': '1941–2016', 'dikembe mutombo': '1966–2024', 'clifford robinson': '1966–2020', 'drazen petrovic': '1964–1993', 'connie hawkins': '1942–2017', 'wes unseld': '1946–2020', 'mark eaton': '1957–2021' };
const hRip = x => H_RIP[norm(x.name)] || null;
const hRipTag = x => hRip(x) ? ' <span class="h-rip" title="Rest in peace (' + hRip(x) + ')">🕊️ RIP</span>' : '';
// cara de uma lenda: iniciais na cor da equipa e a foto da NBA por cima (se houver)
const hFace = (x, cls) => '<span class="face' + (cls ? ' ' + cls : '') + '" style="--av:' + (TEAM_COLOR[hTeam(x.team)] || 'var(--muted)') + '" aria-hidden="true"><b>' + esc(initials(x.name)) + '</b><img src="https://cdn.nba.com/headshots/nba/latest/260x190/' + encodeURIComponent(x.id) + '.png" width="96" height="70" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>';
// escolhas guardadas neste aparelho: fixados e tirados de cada dia, e a melhor carta de cada lenda (desconto)
const hLoad = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
S.hsel = hLoad('fb-hsel', {}); S.hdisc = hLoad('fb-hdisc', {});
const hSave = () => { try { localStorage.setItem('fb-hsel', JSON.stringify(S.hsel)); localStorage.setItem('fb-hdisc', JSON.stringify(S.hdisc)); } catch (e) {} };
const H_DISC = [[0, 'None'], [5, 'Common or Fandom'], [10, 'Rare'], [15, 'Legendary'], [20, 'Ultimate']];
// arquivo do Historic no site (docs/data/historic, guardado pela tarefa "Arquivo do Historic"): os dias jogados de
// todas as runs, para o modelo aprender com mais jogos de cada lenda do que os da run atual
S.histArch = null;
async function loadHistArch() {
  if (S.histArch) return; S.histArch = { runs: [], days: [], busy: true };
  try {
    const get = async f => { const r = await fetch('data/historic/' + f, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); return r.json(); };
    const idx = await get('index.json'), runs = await Promise.all((idx.runs || []).map(e => get(e.file).catch(() => null)));
    S.histArch = { runs: runs.filter(Boolean), at: idx.at || null };
  } catch (e) { S.histArch = { runs: [], err: String(e.message || e) }; }
  S.histCache = {}; if (S.tab === 'hoje' && S.jmode === 'historic') renderHoje();
}
// os dados para o modelo: os do Top Shot (run atual) mais os dias do arquivo que eles não têm (colunas acertadas)
function histData(H) {
  const A = S.histArch; if (!A || !A.runs || !A.runs.length) return H;
  const have = new Set(H.days.map(d => d.id)), keys = H.keys || [], extra = [];
  A.runs.forEach(r => (r.days || []).forEach(d => {
    if (have.has(d.id)) return; have.add(d.id);
    const ix = keys.map(k => (r.keys || []).indexOf(k));
    extra.push(Object.assign({}, d, { lines: d.lines.map(l => l.slice(0, 3).concat(ix.map(j => j >= 0 ? l[3 + j] : 0))) }));
  }));
  return extra.length ? Object.assign({}, H, { days: extra.concat(H.days) }) : H;
}
function histCalc(H, dayId) {
  const nArch = S.histArch && S.histArch.runs ? S.histArch.runs.reduce((t, r) => t + (r.days || []).length, 0) : 0;
  const sel = S.hsel[dayId] || { fix: [], ban: [] }, key = [H.at, dayId, JSON.stringify(sel), JSON.stringify(S.hdisc), accounts().length, nArch].join('|');
  // guardadas por dia (a faixa dos dias mostra a hipótese de cada dia aberto)
  const hc = S.histCache || (S.histCache = {}); if (hc[key]) return hc[key];
  if (Object.keys(hc).length > 40) S.histCache = {};
  const M = FB.histModel(histData(H), dayId, { disc: S.hdisc }); if (!M) return null;
  const best = FB.histBest(M, 200, sel.fix, sel.ban);
  // a sugestão: a que mais vezes chega aos prémios (40 primeiros); desempata pelos pontos
  const ev = FB.histEval(M, best, 3000).sort((p, q) => (q.p40 - p.p40) || (q.mean - p.mean));
  // com smurfs: uma equipa diferente por conta (juntas, mais vezes pelo menos uma chega aos prémios)
  const nAcc = accounts().length, port = nAcc > 1 ? FB.histPortfolio(ev, nAcc, 2) : null;
  return (S.histCache[key] = { key, M, ev, sel, port });
}
// faixa dos dias como a da run: nos abertos a hipótese de top 40 da equipa sugerida, nos que acabaram o lugar da conta
function histStrip(H, open, day, C) {
  const ai0 = S.hacc || 0, today = todayET(), acc = accounts()[ai0] || accounts()[0], ak = addrKey(accAddr(S.session.user.id, (acc || {}).id || 'main'));
  return '<div class="day-strip" role="group" aria-label="Historic days">' + H.days.map(d => {
    const isOpen = open.includes(d), done = !!(d.lines && d.lines.length), c = isOpen ? (d === day && C ? C : histCalc(H, d.id)) : null;
    if (c) hSugSave(d.id, c);
    const t = c && c.ev.length ? (c.port && c.port.length ? c.port[Math.min(ai0, c.port.length - 1)] : c.ev[0]) : null, now = d === open[0];
    const me = done ? ((d.mine || {})[ak] || (S.role === 'admin' && ai0 === 0 ? (d.mine || {})._me : null)) : null, paid = me && me.rank && me.rank <= hLastPaid(d);
    const val = t ? pct(t.p40) : me && me.rank ? me.rank + '.º' : '–', cls = t ? ' c-' + tone(Math.min(1, t.p40 * 2)) : paid ? ' win' : me && me.rank ? ' loss' : '';
    return '<button type="button" class="ds' + cls + (now ? ' now' : '') + '" data-action="h-day" data-id="' + esc(d.id) + '" aria-pressed="' + (d === day) + '"' + (isOpen || done ? '' : ' disabled title="No results yet"') + '><b class="num">' + histDayNo(d.id) + '</b><small>' + (now && histDate(d) === today ? 'Today' : dWeek(histDate(d))) + '</small><span class="ds-v num">' + val + '</span></button>';
  }).join('') + '</div>';
}
// último lugar com prémio num dia (pelas faixas do dia; sem elas, 40)
const hLastPaid = d => (d.bands && d.bands.length ? Math.max(...d.bands.map(b => +b[1])) : 40);
// pontos FastBreak de uma linha do placar (pelas regras do Historic)
function hFbp(H, l) {
  const W = {}; (H.rubric || []).forEach(e => { W[e.statKey] = +e.weight || 0; });
  if (!Object.keys(W).length) Object.assign(W, { points: 1, rebounds: 1, assists: 2, steals: 3, blocks: 3, turnovers: -1, three_points_made: 0.5, double_double: 5, triple_double: 10 });
  return (H.keys || []).reduce((t, k, i) => t + (W[k] || 0) * (+l[3 + i] || 0), 0);
}
// a sugestão da app para cada dia (a última vista antes de fechar), guardada neste aparelho para comparar depois
S.hsug = hLoad('fb-hsug', {});
function hSugSave(dayId, c) {
  if (!c || !c.ev.length) return;
  const t = (c.port && c.port.length ? c.port : [c.ev[0]]).map(x => x.ids), cur = S.hsug[dayId];
  if (cur && JSON.stringify(cur.t) === JSON.stringify(t)) return;
  S.hsug[dayId] = { at: new Date().toISOString(), t, mean: Math.round(c.ev[0].mean) };
  const keys = Object.keys(S.hsug).sort(); while (keys.length > 60) delete S.hsug[keys.shift()];
  try { localStorage.setItem('fb-hsug', JSON.stringify(S.hsug)); } catch (e) {}
}
// dia do Historic que já acabou: o lineup e o lugar de cada conta, a sugestão da app, a melhor equipa possível e as
// lendas que mais fizeram
function histPastHtml(H, day) {
  const pts = new Map(day.lines.map(l => [String(l[0]), { id: String(l[0]), name: l[1], team: l[2], v: hFbp(H, l) }]));
  const rp = new Map((day.rp || []).map(r => [String(r[0]), +r[1]]));
  const top = day.top || [], entries = day.entries || null, paidTo = hLastPaid(day);
  const rankOfScore = v => { if (!top.length) return null; let k = 0; while (k < top.length && top[k] > v + 1e-9) k++; return k < top.length ? k + 1 : null; };
  const accs = accounts(), ai = Math.min(S.hacc || 0, accs.length - 1), acc = accs[ai] || { id: 'main' };
  // "_me": o lineup de quem leu (o admin, na conta com que entrou no Top Shot), quando não se sabe o endereço
  const akOf = a => addrKey(accAddr(S.session.user.id, a.id)), mineOf = a => (day.mine || {})[akOf(a)] || (S.role === 'admin' && a.id === 'main' ? (day.mine || {})._me : null) || null, me = mineOf(acc);
  const noLu = (day.no || []).includes(akOf(acc));
  const sum = ids => ids.reduce((t, id) => t + ((pts.get(String(id)) || {}).v || 0), 0);
  const line = (id, tag) => { const x = pts.get(String(id)) || { id, name: nameOfLegend(H, id), team: null, v: 0 }, r = rp.get(String(id));
    return '<li class="row"><span class="who">' + hFace({ id: x.id, name: x.name, team: x.team }) + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(x.name) + '</span>' + hRipTag(x) + (tag || '') + '</div><div class="ps">' + esc(hTeam(x.team)) + (r ? ' · ' + f0(r) + ' RP' : '') + '</div></div></span><div class="pv"><div class="v num">' + f1(x.v) + '</div><div class="u">pts</div></div></li>'; };
  const accBar = accs.length > 1 ? '<div class="j-accs h-accs" role="group" aria-label="Accounts">' + accs.map((a, i) => { const m = mineOf(a); return '<button type="button" class="acc-chip" data-action="h-acc" data-i="' + i + '" aria-pressed="' + (i === ai) + '">' + esc(a.label) + (m && m.rank ? ' <b class="num ' + (m.rank <= paidTo ? 'c-good' : '') + '">' + m.rank + '.º</b>' : '') + '</button>'; }).join('') + '</div>' : '';
  const cut = k => top[k - 1] != null ? f0(top[k - 1]) : '–';
  const cuts = top.length ? '1.º ' + cut(1) + ' · 10.º ' + cut(10) + ' · 40.º ' + cut(40) + ' pts' + (entries ? ' · ' + entries.toLocaleString('en-GB') + ' teams' : '') : '';
  const lu = me && me.lu && me.lu.length ? me.lu : null, myPts = me ? (me.score != null ? me.score : lu ? sum(lu) : null) : null;
  const ring = me && me.rank ? winRing(1, me.rank <= paidTo ? 'good' : 'bad', me.rank <= paidTo ? '✓' : '✕', me.rank <= paidTo ? 'prize' : 'no prize') : winRing(0, 'mute', '–', noLu ? 'no lineup' : 'not read yet');
  const hero = '<div class="card hero day-hero past h-hero">' + COURT + '<div class="hero-top"><span class="eyebrow">Historic · Day ' + histDayNo(day.id) + ' · ' + dWeek(histDate(day)) + ', ' + dShort(histDate(day)) + '</span><span class="small muted">finished</span></div>' +
    '<div class="score"><div class="gblocks"><div class="gb"><span class="gb-st">' + (me ? 'Rank' : 'Points') + '</span><span class="gb-n">' + (me && me.rank ? me.rank.toLocaleString('en-GB') + '.º' : '–') + '</span><span class="gb-t">' + (myPts != null ? f1(myPts) + ' pts' : noLu ? 'you didn\'t enter' : 'the admin reads it in Read on Top Shot → Historic') + '</span></div></div>' + ring + '</div>' +
    (cuts ? '<div class="small muted h-odds">' + esc(cuts) + '</div>' : '') +
    (lu ? '<ul class="list jc-list">' + lu.slice().sort((a, b) => ((pts.get(b) || {}).v || 0) - ((pts.get(a) || {}).v || 0)).map(id => line(id)).join('') + '</ul>' : '') + '</div>';
  // a sugestão da app nesse dia (guardada neste aparelho) e onde teria ficado
  const sg = S.hsug[day.id], sIds = sg && sg.t ? sg.t[Math.min(ai, sg.t.length - 1)] : null;
  const sTot = sIds ? sum(sIds) : null, sRank = sTot != null ? rankOfScore(sTot) : null;
  const sugCard = sIds ? '<div class="card"><div class="list-head"><h2>The app\'s suggestion</h2><span class="small muted"><b class="num">' + f1(sTot) + ' pts</b> · ' + (sRank ? 'would have finished ' + sRank + '.º' : 'outside the top 40') + '</span></div><ul class="list">' + sIds.slice().sort((a, b) => ((pts.get(b) || {}).v || 0) - ((pts.get(a) || {}).v || 0)).map(id => line(id, lu && lu.includes(id) ? ' <span class="pill ok">entered</span>' : '')).join('') + '</ul></div>' : '';
  // a melhor equipa possível (com os pontos que saíram e os Roster Points do dia, com as tuas cartas)
  const rows = [...pts.values()].filter(x => rp.has(x.id)).map(x => ({ id: x.id, mu: x.v, cost: rp.get(x.id) * (1 - (+S.hdisc[x.id] || 0) / 100) })).sort((a, b) => b.mu - a.mu);
  const ideal = rows.length >= 5 ? (FB.histBest({ rows, budget: +((H.budget || {}).limit) || 350 }, 1) || [])[0] : null;
  const idealCard = ideal ? '<div class="card"><div class="list-head"><h2>The best possible team</h2><span class="small muted"><b class="num">' + f1(ideal.ev) + ' pts</b> · ' + f0(ideal.cost) + ' RP</span></div><ul class="list">' + ideal.ids.map(id => line(id)).join('') + '</ul></div>' : '';
  const best = [...pts.values()].sort((a, b) => b.v - a.v).slice(0, 10);
  const bestCard = '<div class="card"><div class="list-head"><h2>Top-scoring legends</h2></div><ul class="list">' + best.map(x => line(x.id)).join('') + '</ul></div>';
  return accBar + hero + sugCard + idealCard + bestCard;
}
const nameOfLegend = (H, id) => { for (const d of H.days) { const l = (d.lines || []).find(z => String(z[0]) === String(id)) || (d.players || []).find(z => String(z[0]) === String(id)); if (l) return l[1]; } return String(id); };
function renderHistoric(el) {
  if (typingField('tab-hoje')) return; // a escrever na procura das lendas: não redesenha
  if (!S.histArch) loadHistArch();
  const H = groupHist(), now = Date.now();
  const open = H ? H.days.filter(d => d.players && d.players.length && Date.parse(d.locks) > now) : [];
  const past = H ? H.days.filter(d => d.lines && d.lines.length) : [];
  const head = '';
  // um dia que já acabou: o que fizemos, o que a app sugeria, a melhor equipa possível
  const pd = past.find(d => d.id === S.hday);
  if (pd || (!open.length && past.length)) { el.innerHTML = head + histStrip(H, open, pd || past[past.length - 1], null) + histPastHtml(H, pd || past[past.length - 1]); return; }
  if (!open.length) {
    el.innerHTML = head + empty('Historic', H ? 'The Top Shot data has no days left to play. The admin reads it again in Settings → Admin → Read on Top Shot → Historic.' : 'No Historic data yet. The admin reads it in Settings → Admin → Read on Top Shot → Historic.',
      S.role === 'admin' ? '<button class="btn primary" type="button" data-action="ranks-go" data-do="hist">Read Historic</button>' : '');
    return;
  }
  if (!open.some(d => d.id === S.hday)) S.hday = open[0].id;
  const day = open.find(d => d.id === S.hday);
  const C = S.histMemo = histCalc(H, day.id);
  const strip = histStrip(H, open, day, C);
  if (!C || !C.ev.length) { el.innerHTML = head + strip + '<div class="note">No team of 5 fits the budget with these choices. Unlock someone or restore someone.</div>' + histLegendsCard(C, day); return; }
  const M = C.M, byId = new Map(M.rows.map(x => [x.id, x])), sel = C.sel, accs = accounts(), port = C.port && C.port.length ? C.port : null;
  const ai = port ? Math.min(S.hacc || 0, port.length - 1) : 0, best = port ? port[ai] : C.ev[0];
  // com smurfs: uma equipa por conta (botões com a hipótese de cada uma) e a hipótese de pelo menos uma chegar lá
  const accBar = port ? '<div class="j-accs h-accs" role="group" aria-label="Accounts">' + port.map((p, i) => '<button type="button" class="acc-chip" data-action="h-acc" data-i="' + i + '" aria-pressed="' + (i === ai) + '">' + esc(accLabel((accs[i] || {}).id || 'main')) + ' <b class="num c-' + tone(Math.min(1, p.p40 * 2)) + '">' + pct(p.p40) + '</b></button>').join('') + '</div>' +
    '<div class="small muted h-port">A different team for each account: together, at least one makes the top 40 in <b>' + pct(port[port.length - 1].union) + '</b> (with the best one only: ' + pct(port[0].p40) + ').</div>' : '';
  const cutTxt = M.cuts.length ? 'On days with ' + plural((day.games || []).length, 'game', 'games') + ', 40th place (the last with a prize) scored ' + f0(M.cuts[39] != null ? M.cuts[39] : M.cuts[M.cuts.length - 1]) + ' and 10th ' + f0(M.cuts[9] != null ? M.cuts[9] : M.cuts[0]) + '.' : '';
  // de quantos dias jogados aprende o modelo (os do Top Shot e os do arquivo de outras runs)
  const nRuns = new Set(M.dayIds.map(id => String(id).replace(/-d\d+$/, ''))).size;
  const learnTxt = ' Learns from ' + plural(M.dayIds.length, 'day played', 'days played') + (nRuns > 1 ? ' of ' + nRuns + ' runs' : '') + '.';
  const row = id => {
    const x = byId.get(id), fx = sel.fix.includes(id), opp = x.opp ? (day.games.some(g => g[1] === x.team) ? 'vs ' : '@ ') + hTeam(x.opp) : '';
    return '<li><button class="row" type="button" data-action="h-card" data-id="' + esc(id) + '" data-day="' + esc(day.id) + '"><span class="who">' + hFace(x) + '<div style="min-width:0"><div class="pn">' + (fx ? icoLock : '') + '<span class="nm">' + esc(x.name) + '</span>' + hRipTag(x) + '</div>' +
      '<div class="ps">' + esc(hTeam(x.team)) + ' ' + esc(opp) + ' · ' + f0(x.cost) + ' RP · ' + (x.own != null ? pct(x.own / 100) + ' pick him' : '') + '</div>' +
      '<div class="ps">' + (x.n ? 'avg ' + f0(x.avg) + ' in ' + plural(x.n, 'game', 'games') : 'no games yet') + '</div></div></span>' +
      '<div class="pv"><div class="v num">' + f0(x.mu) + '</div><div class="u">pts</div></div></button></li>';
  };

  const hero = '<div class="card hero day-hero h-hero">' + COURT + '<div class="hero-top"><span class="eyebrow">Historic · Day ' + histDayNo(day.id) + ' · ' + dWeek(histDate(day)) + ', ' + dShort(histDate(day)) + '</span><span class="small muted">locks at ' + hm(day.locks) + '</span></div>' +
    '<div class="score"><div class="gblocks"><div class="gb"><span class="gb-st">Expected points</span><span class="gb-n">' + f0(best.mean) + '</span><span class="gb-t">± ' + f0(best.sd) + ' · ' + f0(best.cost) + ' of ' + M.budget + ' RP</span></div></div>' +
    winRing(best.p40, tone(Math.min(1, best.p40 * 2)), pct(best.p40), 'top 40') + '</div>' +
    '<div class="small muted h-odds">Top 10 ' + pct(best.p10) + ' · 1st place ' + pct(best.p1) + '. ' + esc(cutTxt + learnTxt) + '</div>' +
    '<ul class="list jc-list">' + best.ids.map(row).join('') + '</ul>' +
    (sel.fix.length || sel.ban.length ? '<div class="jc-btns"><button class="btn hero-btn" type="button" data-action="h-reset" data-day="' + esc(day.id) + '">Back to the suggestion</button></div>' : '') + '</div>';
  const alts = C.ev.filter(r => !(port || [best]).some(p => p.ids.join() === r.ids.join())).slice(0, 3).map(r => '<li class="row h-alt"><div style="min-width:0"><div class="pn"><b class="num">' + f0(r.mean) + ' pts</b><span class="small muted"> · top 40 ' + pct(r.p40) + ' · top 10 ' + pct(r.p10) + ' · ' + f0(r.cost) + ' RP</span></div><div class="ps">' + r.ids.map(id => esc(byId.get(id).name)).join(', ') + '</div></div></li>').join('');
  const H0 = groupHist(), src = '<div class="small muted h-src">Top Shot data from ' + esc(ago(H0.at)) + ' · ' + plural(M.dayIds.length, 'day played', 'days played') + ' in the simulation' + (S.role === 'admin' ? ' · <button class="btn link small" type="button" data-action="ranks-go" data-do="hist">read again</button>' : '') + '</div>';
  el.innerHTML = head + strip + accBar + hero + (alts ? '<div class="card"><div class="list-head"><h2>Other teams</h2><span class="small muted">by the same math</span></div><ul class="list">' + alts + '</ul></div>' : '') + histLegendsCard(C, day) + src;
  hFilter();
}
// todas as lendas do dia: pontos esperados, custo, quem escolhe; + fixa, × tira, tocar no nome = a tua carta (desconto)
function histLegendsCard(C, day) {
  if (!C) return '';
  const sel = C.sel, inBest = new Set(C.ev.length ? C.ev[0].ids : []);
  const rows = C.M.rows.map(x => { const ban = sel.ban.includes(x.id), fx = sel.fix.includes(x.id);
    return '<li class="lu-row' + (ban ? ' h-ban' : '') + '" data-n="' + esc(norm(x.name) + ' ' + hTeam(x.team).toLowerCase()) + '"><button class="lu-main" type="button" data-action="h-card" data-id="' + esc(x.id) + '" data-day="' + esc(day.id) + '">' + hFace(x, 'sm') + '<span class="lu-t"><span class="pn">' + (fx ? icoLock : '') + '<span class="nm">' + esc(x.name) + '</span>' + hRipTag(x) + '</span>' +
      '<span class="ps">' + (inBest.has(x.id) ? '<b class="c-good">in the team</b> · ' : '') + esc(hTeam(x.team)) + ' · ' + f0(x.cost) + ' RP' + (x.cost < x.rp ? ' (card)' : '') + (x.n ? ' · avg ' + f0(x.avg) : '') + (x.own != null ? ' · ' + pct(x.own / 100) : '') + '</span></span></button>' +
      '<div class="pv"><div class="v num">' + f0(x.mu) + '</div><div class="u">pts</div></div>' +
      (ban ? '<button class="btn small" type="button" data-action="h-ban" data-id="' + esc(x.id) + '" data-day="' + esc(day.id) + '">Restore</button>'
        : '<button class="lu-ic add" type="button" data-action="h-fix" data-id="' + esc(x.id) + '" data-day="' + esc(day.id) + '" aria-pressed="' + fx + '" aria-label="Lock ' + esc(x.name) + '" title="Lock in the team">' + (fx ? icoLockBtn : icoPlus) + '</button>' +
          '<button class="lu-ic" type="button" data-action="h-ban" data-id="' + esc(x.id) + '" data-day="' + esc(day.id) + '" aria-label="Remove ' + esc(x.name) + ' from this day" title="Remove from this day">' + icoX + '</button>') + '</li>'; }).join('');
  return '<div class="card"><div class="list-head"><h2>Legends of day ' + histDayNo(day.id) + ' ' + helpBtn('historic') + '</h2><span class="small muted">' + plural(C.M.rows.length, 'legend', 'legends') + '</span></div>' +
    '<div class="lu-search"><input class="field" id="hSearch" type="search" placeholder="Search legend or team…" autocomplete="off" aria-label="Search legend or team" value="' + esc(S.hq || '') + '"></div>' +
    '<ul class="list" id="hList">' + rows + '<li class="row small muted lu-none" hidden>No legend with that name or team.</li></ul></div>';
}
function hFilter() {
  const ul = $('hList'); if (!ul) return;
  const q = norm(($('hSearch') || {}).value || ''); let n = 0;
  ul.querySelectorAll('li[data-n]').forEach(li => { const ok = !q || li.dataset.n.includes(q); li.hidden = !ok; if (ok) n++; });
  const none = ul.querySelector('.lu-none'); if (none) none.hidden = !(q && !n);
}
function hSel(day) { return (S.hsel[day] = S.hsel[day] || { fix: [], ban: [] }); }
function hFix(day, id) {
  const s = hSel(day);
  if (s.fix.includes(id)) s.fix = s.fix.filter(x => x !== id);
  else { if (s.fix.length >= 5) { toast('You already have 5 locked: unlock one first.'); return; } s.fix.push(id); s.ban = s.ban.filter(x => x !== id); }
  hSave(); renderHoje();
}
function hBan(day, id) {
  const s = hSel(day);
  if (s.ban.includes(id)) s.ban = s.ban.filter(x => x !== id); else { s.ban.push(id); s.fix = s.fix.filter(x => x !== id); }
  hSave(); renderHoje();
}
function hCardSheet(day, id) {
  const C = S.histMemo, x = C && C.M.rows.find(r => r.id === id); if (!x) return;
  const cur = +S.hdisc[id] || 0, sl = S.hsel[day] || { fix: [], ban: [] }, fixed = sl.fix.includes(id), banned = sl.ban.includes(id);
  openSheet('<div class="h-sheet-top">' + hFace(x, 'lg') + '<h3>' + esc(x.name) + '</h3></div>' + (hRip(x) ? '<div class="note info">🕊️ Rest in peace (' + hRip(x) + '). In the simulation he still plays 36 minutes a game, without complaining about his legs.</div>' : '') + '<div class="small muted">' + esc(hTeam(x.team)) + ' · ' + x.rp + ' RP · ' + (x.n ? 'avg ' + f1(x.avg) + ' pts in ' + plural(x.n, 'game', 'games') + ' (' + x.hist.map(f0).join(', ') + ')' : 'no games yet') + ' · expected today ' + f1(x.mu) + '</div>' +
    '<div class="label" style="margin-top:6px">Your best card of him</div><div class="chips" role="group" aria-label="Your best card">' + H_DISC.map(([v, l]) => '<button type="button" data-action="h-disc" data-id="' + esc(id) + '" data-v="' + v + '" aria-pressed="' + (cur === v) + '">' + l + (v ? ' · −' + v + '%' : '') + '</button>').join('') + '</div>' +
    '<div class="small muted">With a card of him, he costs fewer Roster Points and the card counts for the tiebreak. Saved on this device.</div>' +
    '<div class="btns"><button class="btn" type="button" data-action="h-fix" data-id="' + esc(id) + '" data-day="' + esc(day) + '" data-close="1">' + (fixed ? 'Unlock' : 'Lock in the team') + '</button><button class="btn" type="button" data-action="h-ban" data-id="' + esc(id) + '" data-day="' + esc(day) + '" data-close="1">' + (banned ? 'Restore on this day' : 'Take out of this day') + '</button></div>');
}
function renderHoje() {
  const el = $('tab-hoje'), os = el.querySelector('.day-strip'), left = os ? os.scrollLeft : null;
  renderJornada(el);
  // a faixa não volta ao início a cada desenho; ao escolher um dia, centra-o
  const ns = el.querySelector('.day-strip'); if (!ns) return;
  const on = ns.querySelector('[aria-pressed="true"]');
  if ((S.hdCenter || left == null) && on) ns.scrollLeft = Math.max(0, on.offsetLeft - ns.offsetLeft - (ns.clientWidth - on.offsetWidth) / 2);
  else if (left != null) ns.scrollLeft = left;
  S.hdCenter = false;
}
// um dia que já passou: resultado, o que o plano previa e o que saiu, jogos
function pastDayHtml(J) {
  const r = S.result, day = J.day, pl = ((curPlan().played || {})[J.date]) || null, done = !!(pl && pl.done), res = done ? pl.result : null;
  const none = done && !!pl.none && !(pl.lineup || []).length; // não levou lineup no Top Shot
  const lineup = none ? [] : done && (pl.lineup || []).length ? pl.lineup : (lineupFor(S.acc, J.date) || []);
  const objs = (day.objectives || []).filter(o => o && o.stat), calc = none ? null : dayCalc(S.acc, day);
  const tot = done ? doneTot(pl, day) : null;
  const wait = !done && !(pl && pl.noAuto) && lineup.length > 0 && objs.length > 0 && !calc; // os jogos do lineup ainda não acabaram (ou a ESPN não respondeu)
  const src = none ? 'no Top Shot lineup' : pl && pl.chain ? 'read from the blockchain' : done && pl.box ? 'from the box scores' : done ? 'entered by hand' : wait ? 'waiting for the games' : 'no result';
  // placar desse dia (uma leitura): os resultados ao lado das equipas
  const B = S.box[J.date], run = curRun();
  if (run && !run.fictitious && (!B || (!B.board && !B.busy && Date.now() - B.at > 120e3))) setTimeout(() => { boxLoad(J.date, new Set()).then(() => { if (S.tab === 'hoje') renderHoje(); }); }, 0);
  // o mesmo cartão da previsão: feito / alvo em cima (verde se chegou, vermelho se não), anel com ✓ ou ✕ e as barras do feito
  const madeOf = (pl0, c0, r0) => { const t0 = pl0 && pl0.done ? doneTot(pl0, day) : null; return t0 && objs.length && t0.length >= objs.length ? t0 : c0 && c0.tot && (!r0 || c0.res === r0) ? c0.tot : null; };
  const made = none ? objs.map(() => 0) : madeOf(pl, calc, res); // sem lineup: 0 em tudo
  const ok = (o, k) => +made[k] >= +o.target;
  // um bloco por estatística: nome, o que se fez (grande) e o alvo com a diferença
  const goal = made ? '<div class="gblocks">' + objs.map((o, k) => { const d = Math.round(made[k] - o.target); return '<div class="gb"><span class="gb-st">' + esc(statShort(o.stat)) + '</span><span class="gb-n ' + (ok(o, k) ? 'g-ok' : 'g-no') + '">' + f0(made[k]) + '</span><span class="gb-t">target ' + o.target + ' · ' + (ok(o, k) ? '<b class="c-ok">✓ +' + d + '</b>' : '<b class="c-no">✕ −' + (-d) + '</b>') + '</span></div>'; }).join('') + '</div>' : goalBig(objs);
  const ring = res ? winRing(1, res === 'win' ? 'good' : 'bad', res === 'win' ? '✓' : '✕', res === 'win' ? 'win' : 'loss') : winRing(0, 'mute', wait ? '…' : '–', wait ? 'waiting' : 'no result');
  const bars = made ? objs.map((o, k) => {
    const M = Math.max(+o.target * 1.25, +made[k] * 1.12, 1), w = Math.min(100, made[k] / M * 100), tl = Math.min(99, o.target / M * 100), d = Math.round(made[k] - o.target);
    return '<div class="obj-bar"><div class="bar" aria-hidden="true"><i class="k ' + (ok(o, k) ? 'kok' : 'kno') + '" style="width:' + w.toFixed(1) + '%"></i><i class="t" style="left:' + tl.toFixed(1) + '%"></i></div>' +
      '</div>';
  }).join('') : '';
  // com smurfs: uma linha por conta com o que fez em cada estatística e o resultado
  const accs = groupMode() ? '<div class="acc-res" style="--n:' + objs.length + '">' + accounts().map(a => {
    const p2 = ((planOf(a.id).played || {})[J.date]) || null, r2 = p2 && p2.done ? p2.result : null, n2 = r2 && p2.none && !(p2.lineup || []).length, m2 = n2 ? objs.map(() => 0) : madeOf(p2, a.id === S.acc ? calc : dayCalc(a.id, day), r2);
    return '<div class="ar' + (a.id === S.acc ? ' me' : '') + '"><span class="ar-n">' + esc(a.label) + '</span>' + objs.map((o, k) => '<span class="ar-v">' + (m2 ? '<b class="' + (+m2[k] >= +o.target ? 'c-ok' : 'c-no') + '">' + f0(m2[k]) + '</b>' : '<b>–</b>') + ' <small>' + esc(statShort(o.stat)) + '</small></span>').join('') +
      '<span class="ar-r">' + (n2 ? '<b class="muted">no lineup</b>' : r2 === 'win' ? '<b class="c-ok">✓ win</b>' : r2 === 'loss' ? '<b class="c-no">✕ loss</b>' : '<b>–</b>') + '</span></div>';
  }).join('') + '</div>' : '';
  const out = ['<div class="card hero day-hero past">' + COURT + '<div class="hero-top"><span class="eyebrow">Day ' + (J.idx + 1) + ' · ' + dWeek(J.date) + ', ' + dShort(J.date) + '</span><span class="small muted">' + src + '</span></div>' +
    '<div class="score">' + goal + ring + '</div>' + bars + accs + '</div>'];
  if (done && !pl.chain && !pl.box && calc && calc.res !== res) out.push('<div class="note">By this lineup’s stats: ' + (calc.res === 'win' ? 'win' : 'loss') + ' (' + madeTxt(calc.objs, calc.tot) + '). If this was the lineup, change the result.</div>');
  out.push((none ? '' : predVsActualHtml(J.date)) || '<div class="card"><div class="list-head"><h2>Lineup</h2></div><ul class="list">' + (lineup.map(id => '<li class="row"><span>' + esc(nameOf(id)) + '</span></li>').join('') || '<li class="row muted small">' + (none ? 'You didn\'t submit a lineup this day: Top Shot doesn\'t have you in the day\'s standings. No player uses were spent.' : 'No players recorded.') + '</li>') + '</ul></div>');
  out.push('<div class="ctr-btn"><button class="btn' + (lineup.length ? '' : ' primary') + '" type="button" data-action="past-lu" data-date="' + J.date + '">' + (lineup.length ? 'Change the players' : 'Pick the players') + '</button></div>');
  if ((day.games || []).length) {
    // valor de cada jogador do plantel nesse dia (do guardado ou das fichas), por baixo do jogo dele
    const lp = {};
    Object.keys(S.mine.roster || {}).forEach(id => { const v = valsFor(S.acc, J.date, id, objs); if (v) { const vals = {}; objs.forEach((o, k) => { vals[o.stat] = v[k]; }); lp[id] = { vals }; } });
    const board = B && B.board && B.board.length ? B.board : null;
    out.push('<div class="card"><div class="list-head"><h2>Games that day</h2><span class="small muted">' + plural(day.games.length, 'game', 'games') + (board ? '' : ' · local time') + '</span></div><ul class="list">' + gameRows(day, r, lineup, board, lp, day.objectives) + '</ul></div>');
  }
  return out.join('');
}
function renderJornada(el) {
  if (S.jmode === 'historic') { renderHistoric(el); return; }
  if (S.jmode === 'pro') { renderPro(el); return; }
  if (!guard(el, true)) return;
  const r = S.result, v = view(), J = jornadaDay();
  if (!J) { el.innerHTML = empty('Run finished', 'You finished with ' + r.wins + ' wins in ' + r.playedCount + ' days.'); return; }
  const sub = subOf('hoje'), html = [dayStrip(J.date), jornadaNav(J.date, sub)];
  const run = curRun() || {}, real = S.runs.find(x => x.active && !x.fictitious && x.id !== run.id);
  if (run.fictitious) html.push('<div class="note">Test run: made-up games and goals.' + (real ? ' <button class="btn link small" type="button" data-action="run-go" data-id="' + esc(real.id) + '">Open ' + esc(real.name) + '</button>' : '') + '</div>');
  if (J.past) {
    html.push(sub === 'lineup' ? pastDayHtml(J) : '<div class="note info">Day already played: the result is under Lineup.</div>');
    el.innerHTML = html.join(''); return;
  }
  const { md, d } = J, nd = md.day, o = (nd.objectives || [])[0], isCur = J.cur;
  const live = isCur && liveOn(nd.date) && !!d.live, t = d.totals[0]; // d.live só existe depois de recalcular
  const noneTxt = isCur ? 'None of your players plays today.' : 'None of your players plays this day.';
  if (sub === 'porque' || sub === 'comparar') {
    html.push((sub === 'porque' ? basisDayCard(r, v, d, md, nd) : compareCard(md, d, nd.date, true)) || '<div class="note info">' + (d.noObjective ? 'This day has no goal yet.' : noneTxt) + '</div>');
    el.innerHTML = html.join(''); return;
  }
  const tips = (nd.games || []).map(g => g[2]).filter(Boolean).sort();
  const right = live ? '<span class="pill jogo">Live</span>' : tips.length ? '<span class="small muted">1st game ' + hm(tips[0]) + '</span>' : '';
  // fora dos jogos ao vivo: o placar leva o lineup dentro (preenche-se mais abaixo, quando as linhas estão feitas)
  const compact = true, heroAt = html.length; // também durante os jogos (o placar mostra o que já se fez)
  // placar do dia: objetivo, vitória, barra(s); no dia em curso, o botão das opções
  html.push('<div class="card hero day-hero">' + COURT + '<div class="hero-top"><span class="eyebrow">Day ' + (nd.idx + 1) + ' · ' + dWeek(nd.date) + ', ' + dShort(nd.date) + '</span>' + right + '</div>' +
    '<div class="score">' + goalBig(nd.objectives) +
    (d.noObjective ? '' : winRing(d.P, dTone(d.P))) + '</div>' + (t ? objBars(d, live) : '') +
    (S.multi ? groupLine(nd) : '') +
    (isCur && !d.noObjective && (d.lineup.length || live) ? '<button class="btn hero-btn" type="button" data-action="opcoes">Suggestions for today</button>' : !isCur ? '' : '') + '</div>');
  const luAt = html.length; // o lineup vem logo a seguir ao placar (sem ter de descer)
  if (isCur && !live) html.push(picksCard());
  if (isCur) html.push(todoCard(r, v, d, md, nd, live, tips));
  // ao vivo: o plano sugere mudar quem ainda não jogou
  if (live && d.live && (d.live.out.length || d.live.in.length)) {
    const pSub = lineupP(md, d.live.submitted);
    html.push('<div class="note sug"><div><b>Suggestion:</b> ' + [d.live.out.length ? 'remove ' + d.live.out.map(id => esc(lastName(id))).join(', ') : '', d.live.in.length ? 'add ' + d.live.in.map(id => esc(lastName(id))).join(', ') : ''].filter(Boolean).join(' and ') +
      ' · today ' + pct(pSub) + ' → <b>' + pct(d.P) + '</b>' + (d.P + 0.15 < pSub ? ' (saves uses for the run)' : '') + '</div><div class="btns"><button class="btn" type="button" data-action="opcoes">Suggestions</button><button class="btn primary" type="button" data-action="swap-done">Done it</button></div></div>');
  }
  html.push(liveGamesCard(r, md, nd, live && d.live ? d.live.submitted : d.lineup, live, true));
  // avisos curtos
  const note = (txt, info) => html.push('<div class="note' + (info ? ' info' : '') + '">' + txt + '</div>');
  if (S.multi) {
    const cl = S.multi.clashes.filter(c => c.date === nd.date && !c.tier); if (cl.length) note('Locked in two accounts: ' + cl.map(c => esc(nameOf(c.id)) + ' (' + c.accounts.map(accLabel).map(esc).join(', ') + ')').join(' · ') + '. He only plays for one.');
    // cartas que não chegam: ex. 2.ª jogada nas duas contas com um só Rare
    S.multi.clashes.filter(c => c.date === nd.date && c.tier).forEach(c => { const top = c.req[0], n = c.cards.filter(u => u >= top).length;
      note('<b>' + esc(nameOf(c.id)) + '</b> today in ' + c.accounts.map(accLabel).map(esc).join(' + ') + ': this needs ' + c.req.length + ' cards with at least ' + top + ' uses and you have ' + n + ' (his cards: ' + c.cards.map(usesN).join(' · ') + '). Remove him or unlock him in one of the accounts.'); });
  }
  if (d.noObjective) note('This day has no goal yet.', true);
  if (d.perPlayer) note('Per-player goal: each one has to get there alone. Check the lineup by hand.');
  if ((nd.objectives || []).some(x => x && /pip/.test(x.stat))) note('Points in the paint: estimated from made 2-pointers.', true);
  else if (!(nd.games || []).length) note('This day’s games haven’t arrived yet.', true);
  if (((curPlan().keep || {})[nd.date] || []).length) note('Lineup kept as it was when you removed the lock. <button class="btn link small" type="button" data-action="keep-clear" data-date="' + nd.date + '">Let the plan choose</button>', true);
  const drop = (r.model.droppedLocks || []).filter(x => x.date >= nd.date);
  if (drop.length) { const ids = [...new Set(drop.map(x => x.player))]; note('Locked on more days than uses: ' + ids.map(id => '<b>' + esc(nameOf(id)) + '</b> (the lock ' + (drop.filter(x => x.player === id).length > 1 ? 'on days ' : 'on day ') + drop.filter(x => x.player === id).map(x => dayNo(x.date)).join(', ') + ' doesn’t count)').join(', ') + '. <button class="btn link small" type="button" data-action="locks-fix">Remove those locks</button>'); }
  if (r.normal.conflicts.length) note('Locked more times than uses: ' + r.normal.conflicts.map(c => esc(nameOf(c.player)) + ' (' + c.used + ' of ' + c.uses + ')').join(', ') + '.');
  if (d.badLocks && d.badLocks.length) {
    const plays = FB.teamsOn(nd), teamOf = id => (r.model.players[r.model.pIndex.get(id)] || {}).team;
    const noGame = d.badLocks.filter(id => !plays.has(teamOf(id))), outNow = d.badLocks.filter(id => plays.has(teamOf(id)));
    if (noGame.length) note('Locked with no game this day: ' + noGame.map(id => esc(nameOf(id))).join(', ') + '.');
    if (outNow.length) note('Locked but out: ' + outNow.map(id => esc(nameOf(id)) + (injRec(id) ? ' (' + esc((INJ_LABEL[injRec(id).status] || '').toLowerCase()) + ')' : '')).join(', ') + '. Unlock him or ignore the report in his card.');
  }
  // lineup
  const locks = new Set(((curPlan().locks || {})[nd.date]) || []), bans = ((curPlan().bans || {})[nd.date]) || [];
  const lp = live ? ((liveDoc(nd.date) || {}).players || {}) : {};
  const rows = d.lineup.map(id => {
    const pi = r.model.pIndex.get(id), p = r.model.players[pi], info = md.info[pi][0];
    let ps;
    if (live) {
      const st = info.liveState, sb2 = d.live.submitted.includes(id);
      if (st === 'fim') ps = '<span class="pill fim">Final</span> ' + teamMini(p.team) + esc(p.team) + ' ' + esc(opp(p.team, nd));
      else if (st === 'jogo') ps = '<span class="pill jogo">' + (info.q ? QLABEL[info.q] : 'Playing') + '</span> ' + teamMini(p.team) + md.objs.map((ob, k) => f0(md.info[pi][k].known) + (md.objs.length > 1 ? ' ' + esc(statShort(ob.stat)) : '')).join(' · ') + ' so far';
      else if (st === 'jogo?') ps = '<span class="pill jogo">Playing</span> ' + teamMini(p.team) + esc(p.team) + ' ' + esc(opp(p.team, nd));
      else ps = (sb2 ? '' : '<span class="pill prov">New</span> ') + teamMini(p.team) + esc(p.team) + ' ' + esc(opp(p.team, nd));
    } else ps = teamMini(p.team) + esc(p.team) + ' ' + esc(opp(p.team, nd)) + (info.b2b ? ' · back-to-back' : ''); // a fonte do valor fica em Porquê e na ficha; a lesão é a pílula do nome
    // Moment que ainda está noutra conta: tem de ser mandado antes deste jogo
    const tr = S.multi && (S.profile || {}).collection ? S.multi.transfers.find(x => x.id === id && x.to === S.acc && x.before <= nd.date) : null;
    if (tr) ps = '<span class="pill prov">Send from ' + esc(accLabel(tr.from)) + '</span> ' + ps;
    if (!live && !S.gOdds[nd.date]) loadGameOdds(nd.date);
    let stp = info.status !== 'ok' ? '<span class="pill ' + info.status + '">' + esc(STATUS[info.status].label) + '</span>' : '';
    let rl = '';
    if (!live && riskOf(md, id)) { const sb = riskSub(md, nd, d.lineup, id);
      stp += '<span class="pill duv risk" title="' + esc((INJ_LABEL[info.injury.rec.status] || '') + ': counted as playing; if he is ruled out, swap him before the game') + '">⚠ ' + esc(INJ_LABEL[info.injury.rec.status] || 'Questionable') + '</span>';
      rl = '<div class="risk-sub">if he sits: ' + (sb ? '<b>' + esc(lastName(sb.id)) + '</b> (today ' + pct(sb.P) + ')' : 'no swap after his game') + '</div>'; }
    // ao vivo, com o jogo já começado: tocar abre as estatísticas do jogo
    const gid = live && /^(jogo\??|fim)$/.test(info.liveState || '') ? ((FB.gameOf(nd, p.team) || [])[3] || '') : '';
    return '<li><button class="row" type="button" ' + (/^espn:/.test(gid) ? 'data-action="game-box" data-gid="' + esc(gid) + '"' : 'data-action="player"') + ' data-id="' + esc(id) + '" data-date="' + nd.date + '"><span class="who">' + face(id) + '<div style="min-width:0"><div class="pn">' + (locks.has(id) ? icoLock : '') + '<span class="nm">' + esc(p.name) + '</span>' + stp + '</div><div class="ps">' + ps + '</div>' + rl + (live ? '' : fxHtml(id, nd, [...new Set(md.objs.map(x => x.stat))])) + '</div></span>' + pvHtml(objVals(md, pi, live), live ? '' : formMark(p, o)) + '</button></li>';
  }).join('');
  const allFinal = live && d.live.submitted.length && d.live.submitted.every(id => ((lp[id] || {}).state) === 'fim');
  // antes dos jogos: Mudar (fixar, tirar e pôr jogadores um a um, com o que muda face à sugestão)
  const tip0 = firstTipOf(nd), canEdit = !live && !(tip0 != null && Date.now() >= tip0) && md.elig.length > 0;
  const bansLine = bans.length ? '<div class="row small muted" style="display:block">Removed from this day: ' + bans.map(id => esc(lastName(id)) + ' <button class="btn link small" type="button" data-action="unban" data-id="' + esc(id) + '" data-date="' + nd.date + '">restore</button>').join(' · ') + '</div>' : '';
  if (compact) {
    const objLine = (nd.objectives || []).filter(x => x && x.stat).map(x => x.target + ' ' + esc(statShort(x.stat))).join(' + ');
    const perStat = t ? d.totals.map(x => '<span>' + esc(statShort(x.stat)) + ' ' + (live ? '<b class="num">' + f0(x.known) + '</b>/' + x.target + ' · end ≈ ' + f1(x.mu) : '<b class="num">' + f1(x.mu) + '</b>/' + x.target) + ' · ' + pct(FB.probAtLeast(x.mu, x.sd * x.sd, x.target)) + '</span>').join('<span aria-hidden="true"> · </span>') : '';
    // ao vivo: uma barra fina por estatística (feito + o que falta prever) e, no fim, o total
    const liveBars = live && t ? '<div class="jc-bars">' + d.totals.map(x => { const max = Math.max(x.target * 1.2, x.mu + x.sd, 1), kw = Math.min(100, x.known / max * 100), fw = Math.max(0, Math.min(100 - kw, (x.mu - x.known) / max * 100)); return '<div class="bar" aria-hidden="true"><i class="k" style="width:' + kw.toFixed(1) + '%"></i><i class="f" style="left:' + kw.toFixed(1) + '%;width:' + fw.toFixed(1) + '%"></i><i class="t" style="left:' + Math.min(99, x.target / max * 100).toFixed(1) + '%"></i></div>'; }).join('') + '</div>' : '';
    const finalLine = allFinal && t ? '<div class="row small jc-final" style="display:block">Total ' + d.totals.map(x => '<b class="num">' + f0(x.known) + '</b> of ' + x.target + (d.totals.length > 1 ? ' ' + esc(statShort(x.stat)) : '')).join(' · ') + ' → ' + (d.totals.every(x => x.known >= x.target) ? '<b class="up">you won</b>' : '<b class="down">you lost</b>') + '</div>' : '';
    const btns = [isCur && !d.noObjective && (d.lineup.length || live) ? '<button class="btn hero-btn" type="button" data-action="opcoes">Suggestions for today</button>' : '', canEdit ? '<button class="btn hero-btn" type="button" data-action="lu-edit" data-date="' + nd.date + '">Change lineup</button>' : isCur && (live || (tip0 != null && Date.now() >= tip0)) ? '<button class="btn hero-btn" type="button" data-action="live-lu" data-date="' + nd.date + '">Change lineup</button>' : '', d.lineup.length ? '<button class="btn hero-btn jc-share" type="button" data-action="lu-share" data-date="' + nd.date + '" aria-label="Share the lineup" title="Share the lineup">' + icoShare + '</button>' : ''].filter(Boolean);
    html[heroAt] = '<div class="card hero day-hero jcompact">' + COURT + '<div class="jc-top"><div class="jc-txt"><span class="eyebrow">' + (isCur ? 'Today' : 'Day ' + (nd.idx + 1)) + (objLine ? ' · ' + objLine : '') + ' ' + helpBtn(live ? 'aovivo' : 'lineup') + (live ? ' <span class="pill jogo">Live</span>' : '') + '</span>' +
      '<div class="jc-sub">' + (d.noObjective ? 'No target' : d.lineup.length ? perStat : '') + '</div>' + (live ? '' : '<div class="jc-sub">' + (isCur ? '' : dWeek(nd.date) + ' ' + dShort(nd.date) + (tips.length ? ' · ' : '')) + (tips.length ? '1st game ' + hm(tips[0]) : '') + '</div>') + '</div>' + (d.noObjective ? '' : winRing(d.P, dTone(d.P))) + '</div>' +
      liveBars + (d.lineup.length ? '<ul class="list jc-list">' + rows + '</ul>' : '<div class="row muted small jc-empty">' + (S.multi && md.elig.length ? 'This account doesn’t play this day: the Moments are worth more in the others.' : noneTxt) + '</div>') + finalLine + bansLine + (isCur && !live ? holdLine(S.acc, nd.date) : '') +
      (btns.length ? '<div class="jc-btns">' + btns.join('') + '</div>' : '') + '</div>';
  } else html.splice(luAt, 0, '<div class="card"><div class="list-head"><h2>Lineup ' + helpBtn(live ? 'aovivo' : 'lineup') + '</h2>' + (canEdit ? '<button class="btn small" type="button" data-action="lu-edit" data-date="' + nd.date + '">Change</button>' : '<span class="small muted">' + (live ? 'live points' : d.lineup.length ? d.lineup.length + ' of ' + md.size : '') + '</span>') + '</div>' +
    (d.lineup.length ? '<ul class="list">' + rows + '</ul>' : '<div class="row muted small">' + (S.multi && md.elig.length ? 'This account doesn’t play this day: the Moments are worth more in the others.' : noneTxt) + '</div>') +
    (allFinal && t ? '<div class="row small" style="display:block">Total ' + d.totals.map(x => '<b class="num">' + f0(x.known) + '</b> of ' + x.target + (d.totals.length > 1 ? ' ' + esc(statShort(x.stat)) : '')).join(' · ') + ' → ' + (d.totals.every(x => x.known >= x.target) ? '<b class="up">you won</b>' : '<b class="down">you lost</b>') + '</div>' : '') +
    bansLine + '</div>');
  html.push(liveGamesCard(r, md, nd, live && d.live ? d.live.submitted : d.lineup, live, false));
  html.push(todayPlayersCard(r, md, nd, isCur));
  if (isCur) html.push(betterCard(), buyLine());
  el.innerHTML = html.join('');
}
// Ao vivo: liga-se sozinho quando o 1.º jogo do dia começa, com o lineup submetido (lido da blockchain, se já lá
// estiver; senão o do plano). Prende quem já jogou, lê os pontos da ESPN de 2 em 2 minutos e refaz o resto da run.
function ensureLive() {
  const nd = S.result ? nextDay() : null; if (!nd || liveOn(nd.date)) return false;
  const tip = firstTipOf(nd), d0 = view().days[0];
  if (tip == null || Date.now() < tip || !d0 || d0.date !== nd.date) return false;
  const cur = liveDoc(nd.date);
  const lineup = cur && cur.lineup && cur.lineup.length ? cur.lineup : chainLineupToday(nd.date) || d0.lineup.slice();
  if (!lineup.length) return false;
  planPatch({ live: { [nd.date]: { active: true, lineup, players: (cur && cur.players) || {} } } });
  S.liveAt = Date.now(); setTimeout(() => liveFetch(true), 300);
  return true;
}
// a melhor compra, numa linha (as outras em Jogadores → Comprar)
function buyLine() {
  const A = S.autoBuy, key = autoBuyKey(); if (!key || !A || A.key.split('|')[0] !== key.split('|')[0] || !A.list.length) return '';
  return buyTipsCard(3, true);
}
// ---- jogos de hoje ao vivo (placar da ESPN) ----
function gamesWindow(nd) {
  const tips = (nd.games || []).map(g => Date.parse(g[2])).filter(x => isFinite(x)).sort((a, b) => a - b);
  return tips.length && Date.now() >= tips[0] - 15 * 60e3 && Date.now() <= tips[tips.length - 1] + 4 * 3600e3;
}
async function refreshBoard(date) {
  if (S.boardBusy || (S.board && S.board.date === date && Date.now() - S.board.at < 50e3)) return;
  S.boardBusy = true;
  try { S.board = { date, at: Date.now(), games: await espnBoard(date) }; if (S.tab === 'hoje') renderHoje(); }
  catch (e) { S.board = { date, at: Date.now(), games: null, err: true }; }
  finally { S.boardBusy = false; }
}
// linhas dos jogos de um dia: equipas, hora (ou placar ao vivo) e os teus jogadores em cada jogo (os do lineup a negrito)
// emblema da equipa (ESPN), com a bolinha da cor por baixo se a imagem não carregar
// emblema pequeno ao lado da sigla (linhas dos jogadores); sem imagem, não ocupa espaço
const teamMini = t => t ? '<img class="tmini" src="https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/' + (LOGO_CODE[t] || String(t).toLowerCase()) + '.png&amp;w=40&amp;h=40" width="16" height="16" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '';
const LOGO_CODE = { GSW: 'gs', NYK: 'ny', NOP: 'no', SAS: 'sa', UTA: 'utah', WAS: 'wsh' };
const teamLogo = t => '<span class="tlogo" style="--tc:' + (TEAM_COLOR[t] || 'var(--faint)') + '" aria-hidden="true"><img src="https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/' + (LOGO_CODE[t] || String(t || '').toLowerCase()) + '.png&amp;w=80&amp;h=80" width="36" height="36" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>';
// um jogo: equipas com emblema, hora (ou placar ao vivo) e os teus jogadores; os do lineup em destaque com cara e
// valor ao vivo, os outros numa fila de caras; tocar abre a lista de nomes
function gameRows(day, r, ids, B, lp, objs) {
  objs = (objs || []).filter(x => x && x.stat);
  const inLine = new Set(ids || []);
  const otherLu = new Map();
  if (S.multi) accounts().filter(a => a.id !== S.acc).forEach(a => { const rr = S.multi.byKey[a.id], pd = rr && rr.normal.days.find(d => d.date === day.date);
    ((pd && pd.lineup) || lineupFor(a.id, day.date) || []).forEach(id => (otherLu.get(id) || otherLu.set(id, []).get(id)).push(accLabel(a.id))); });
  const games = (day.games || []).slice().sort((a, b) => String(a[2] || '').localeCompare(String(b[2] || '')));
  return games.map(g => {
    const bg = B ? B.find(x => (x.away === g[0] && x.home === g[1]) || (x.home === g[0] && x.away === g[1])) || null : null;
    const mine = r.model.players.filter(p => p.team === g[0] || p.team === g[1]).map(p => p.id).sort((a, b) => (inLine.has(b) ? 1 : 0) - (inLine.has(a) ? 1 : 0));
    const started = bg && bg.state !== 'pre', st = !started ? '' : bg.state === 'post' ? 'Final' : bg.detail;
    const tm = (t, sc) => '<span class="g-tm">' + teamLogo(t) + '<b>' + esc(t) + '</b>' + (sc != null ? '<span class="g-sc num">' + esc(sc) + '</span>' : '') + '</span>';
    const teams = tm(g[0], started ? bg.as : null) + '<span class="g-at">' + (started ? '–' : '@') + '</span>' + tm(g[1], started ? bg.hs : null);
    const right = started ? esc(st) : (g[2] ? hm(bg && bg.start || g[2]) : '–'), gid = String(g[3] || '');
    const val = id => { const e = lp && lp[id]; return e && e.vals && objs.some(o => e.vals[o.stat] != null) ? ' <b class="num">' + objs.map(o => (e.vals[o.stat] != null ? f0(e.vals[o.stat]) : '–')).join('/') + '</b>' : ''; };
    // só quem joga hoje: o lineup desta conta e, com smurfs, o das outras (com o nome da conta)
    const lu = mine.filter(id => inLine.has(id)), oth = mine.filter(id => !inLine.has(id) && otherLu.has(id));
    const chips = lu.map(id => '<span class="g-chip">' + face(id, 'xs') + esc(lastName(id)) + val(id) + '</span>').join('') +
      oth.map(id => '<span class="g-chip g-oth">' + face(id, 'xs') + esc(lastName(id)) + ' <small>' + esc(otherLu.get(id).join(', ')) + '</small></span>').join('');
    const rest = [];
    const top = '<span class="g-teams">' + teams + '</span>' + (started && gid ? '<button type="button" class="g-time num g-boxbtn" data-action="game-box" data-gid="' + esc(gid) + '" aria-label="Live stats">' + right + ' <span aria-hidden="true">›</span></button>' : '<span class="g-time num">' + right + '</span>') + (mine.length ? '<span class="g-mine">' + chips + '</span>' : '');
    const all = rest.length ? '<div class="g-all">' + rest.map(id => esc(lastName(id)) + val(id)).join(' · ') + '</div>' : '';
    return '<li class="gcard' + (bg && bg.state === 'in' ? ' on' : '') + '">' + (all ? '<details><summary class="g-top">' + top + '</summary>' + all + '</details>' : '<div class="g-top">' + top + '</div>') + '</li>';
  }).join('');
}
// Jogos do dia: durante os jogos ficam por cima do lineup, com o placar da ESPN; antes, por baixo, com as horas
function liveGamesCard(r, md, nd, ids, live, above) {
  if (!(nd.games || []).length) return '';
  const inWin = gamesWindow(nd);
  if (inWin !== !!above) return '';
  const ttl = (nd.date === (nextDay() || {}).date ? 'Today\'s games' : 'Games that day') + ' ' + helpBtn('jogosdia');
  if (inWin && (!S.board || S.board.date !== nd.date)) { setTimeout(() => refreshBoard(nd.date), 0); return '<div class="card"><div class="list-head"><h2>' + ttl + '</h2></div><div class="row small muted" style="display:block">Reading the scoreboard…</div></div>'; }
  const B = inWin ? (S.board.games || []) : null, o = nd.objectives || [], lp = live ? ((liveDoc(nd.date) || {}).players || {}) : {};
  const many = o.filter(x => x && x.stat).length > 1;
  if (!inWin) { const tips = (nd.games || []).map(g => g[2]).filter(Boolean).sort(); return foldCard('jogos', nd.date === (nextDay() || {}).date ? 'Today\'s games' : 'Games that day', helpBtn('jogosdia'), plural(nd.games.length, 'game', 'games') + (tips.length ? ' · 1st at ' + hm(tips[0]) : ''), '<ul class="list">' + gameRows(nd, r, ids, null, lp, o) + '</ul>'); }
  return '<div class="card"><div class="list-head"><h2>' + ttl + '</h2><span class="small muted">' + (inWin ? (S.board.err ? 'no connection to ESPN' : 'live') : plural(nd.games.length, 'game', 'games')) + (inWin && live && many ? ' · ' + o.filter(x => x && x.stat).map(x => esc(statShort(x.stat))).join('/') : '') + '</span></div><ul class="list">' + gameRows(nd, r, ids, B, lp, o) + '</ul></div>';
}
// O que há para fazer hoje: Moments a mandar entre contas, lesões no lineup, resultados por registar
// itens marcados como feitos (neste aparelho): somem da lista até mudarem (outra transferência, outra lesão, outro dia)
let TODO_DONE = {};
try { TODO_DONE = JSON.parse(localStorage.getItem('fb-todo') || '{}') || {}; } catch (e) {}
function todoSave() {
  const lim = Date.now() - 14 * 864e5; for (const k in TODO_DONE) if (!(TODO_DONE[k] > lim)) delete TODO_DONE[k];
  try { localStorage.setItem('fb-todo', JSON.stringify(TODO_DONE)); } catch (e) {}
}
const icoTick = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
S.todoShow = false;
function todoCard(r, v, d, md, nd, live, tips) {
  const items = [], done = [];
  const btn = (attrs, html, sub, key) => {
    const k = key ? (S.runId || '') + '|' + key : null, on = !!(k && TODO_DONE[k]);
    const li = '<li class="todo-li' + (on ? ' done' : '') + '">' + (k ? '<button class="todo-ck" type="button" data-action="todo-tick" data-k="' + esc(k) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Done. Unmark' : 'Mark as done') + '">' + icoTick + '</button>' : '') +
      '<button class="row" type="button" ' + attrs + '><div style="min-width:0"><div class="todo-t">' + html + '</div>' + (sub && !on ? '<div class="ps">' + sub + '</div>' : '') + '</div><span class="muted" aria-hidden="true">›</span></button></li>';
    return on ? (done.push(li), '') : li;
  };
  const today = todayET(), at = (day, team) => { const tt = team ? FB.tipTime(day, team) : null; return tt ? 'by ' + hm(new Date(tt).toISOString()) : 'before his game'; };
  if (S.multi) {
    if (!(S.profile || {}).collection) items.push(btn('data-action="goto" data-tab="plantel" data-sub="colecao"', 'Read the wallets of your accounts', 'To know what to send to each account.', 'wallet|' + today));
    else {
      const due = S.multi.transfers.filter(t => t.before <= nd.date), later = S.multi.transfers.filter(t => t.before > nd.date);
      due.forEach(t => { const day = S.days.find(x => x.date === t.before) || nd, team = (r.model.players[r.model.pIndex.get(t.id)] || {}).team;
        items.push(btn('data-action="player" data-id="' + esc(t.id) + '" data-date="' + nd.date + '"', (t.uses && collectionInfo(t.id).nTop < collectionInfo(t.id).copies ? 'Send the ' + (t.uses >= 4 ? 'Legendary' : t.uses >= 2 ? 'Rare' : 'Common') + ' of <b>' : 'Send <b>') + esc(nameOf(t.id)) + '</b> to <b>' + esc(accLabel(t.to)) + '</b>', 'From ' + esc(accLabel(t.from)) + ', ' + at(day, team) + '. On Top Shot: gift the Moment to the other account.', 'tr|' + t.id + '|' + t.from + '>' + t.to + '|' + t.before)); });
      if (later.length) items.push('<li class="row small muted" style="display:block">Later: ' + later.slice(0, 3).map(t => esc(lastName(t.id)) + ' → ' + esc(accLabel(t.to)) + ' by ' + dShort(t.before)).join(' · ') + (later.length > 3 ? ' and another ' + (later.length - 3) : '') + '.</li>');
    }
  }
  d.lineup.forEach(id => { const pi = r.model.pIndex.get(id), info = md.info[pi][0], j = info.injury;
    if (j && !j.ignored && j.status && !info.liveState) items.push(btn('data-action="player" data-id="' + esc(id) + '" data-date="' + nd.date + '"', '<b>' + esc(nameOf(id)) + '</b>' + (j.risk ? ' ⚠' : '') + ': ' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + ', ' + pct(pPlayOf(info)) + ' to play', (() => { const sb = j.risk ? riskSub(md, nd, d.lineup, id) : null; return 'Check ' + at(nd, r.model.players[pi].team) + '; if he sits, ' + (sb ? 'swap him for <b>' + esc(nameOf(sb.id)) + '</b> in Top Shot (today ' + pct(sb.P) + ').' : 'take him out in Top Shot.'); })(), 'inj|' + id + '|' + nd.date + '|' + j.rec.status)); });
  // run a sério: dia que acabou há mais de 12 h e não fechou sozinho (sem lineup guardado, ou sem estatísticas)
  const run = curRun();
  if (run && !run.fictitious) {
    const lim = new Date(Date.parse(today + 'T12:00:00Z') - 3 * 864e5).toISOString().slice(0, 10), pl = curPlan().played || {};
    skippedDays(S.acc).filter(x => x.date >= lim && !(pl[x.date] && pl[x.date].noAuto) && (x.objectives || []).some(o => o && o.stat) && Date.now() > dayEnd(x) + 12 * 3600e3).forEach(x => {
      items.push(btn('data-action="past-lu" data-date="' + x.date + '"', 'Day ' + (S.days.indexOf(x) + 1) + ' without a result', 'It didn’t close by itself. If you played, record it.', 'res|' + x.date));
    });
  }
  const open = items.filter(x => x), n = open.filter(x => x.indexOf('<button') >= 0).length;
  if (!open.length && !done.length) return '';
  const doneRow = done.length ? '<li class="row small muted todo-more" style="display:block"><button class="btn link small" type="button" data-action="todo-show" aria-expanded="' + S.todoShow + '">' + (S.todoShow ? 'Hide' : 'Show') + ' ' + plural(done.length, 'done item', 'done items') + '</button></li>' + (S.todoShow ? done.join('') : '') : '';
  if (!n) return '<div class="card todo all-done"><div class="list-head"><h2>To do</h2><span class="small muted">all done ✓</span></div><ul class="list">' + open.join('') + doneRow + '</ul></div>';
  return '<div class="card todo"><div class="list-head"><h2>To do</h2><span class="small muted">' + n + '</span></div><ul class="list">' + open.join('') + doneRow + '</ul></div>';
}
// Lesões e forma de quem joga neste dia, e as lesões do plantel na run toda (o resto em Jogadores)
function todayPlayersCard(r, md, nd, isCur) {
  const o = (nd.objectives || [])[0]; if (!o || !md.teams.size) return '';
  const mine = r.model.players.map((p, pi) => ({ p, pi, info: md.info[pi] && md.info[pi][0] })).filter(x => x.info && md.teams.has(x.p.team));
  if (!mine.length) return '';
  const runInj = injuryHits(r);
  const inj = mine.filter(x => x.info.injury && !x.info.injury.ignored && x.info.injury.status);
  const fm = mine.map(x => ({ x, fi: FB.formInfo(x.p, o.stat) })).filter(z => z.fi && (z.fi.n5 || 0) >= 3 && z.fi.season && z.fi.l5 != null).map(z => Object.assign(z, { d: (z.fi.l5 - z.fi.season) / Math.max(1, Math.abs(z.fi.season)) }));
  const hot = fm.filter(z => z.d >= 0.08).sort((a, b) => b.d - a.d).slice(0, 3), cold = fm.filter(z => z.d <= -0.08).sort((a, b) => a.d - b.d).slice(0, 3);
  const pcs = z => '<span class="' + (z.d > 0 ? 'up' : 'down') + '">' + (z.d > 0 ? '▲ +' : '▼ −') + Math.abs(Math.round(z.d * 100)) + '%</span>';
  const SEV = { fora: 0, dout: 1, duv: 2, prov: 3 };
  const inLu = new Set(((view() || { days: [] }).days.find(x => x.date === nd.date) || { lineup: [] }).lineup);
  const pill = rec => '<span class="pill ' + INJ_PILL[rec.status] + '">' + esc(INJ_LABEL[rec.status] || rec.status) + '</span>';
  // hoje: quem joga neste dia e está no relatório (os do lineup primeiro), com cara, estado, lesão e % de jogar
  const injToday = inj.slice().sort((x, y) => ((inLu.has(y.p.id) ? 1 : 0) - (inLu.has(x.p.id) ? 1 : 0)) || ((SEV[x.info.injury.status] || 9) - (SEV[y.info.injury.status] || 9)));
  const rowT = x => { const rec = x.info.injury.rec, out = x.info.injury.status === 'fora';
    return '<li><button class="inj-row" type="button" data-action="player" data-id="' + esc(x.p.id) + '" data-date="' + nd.date + '">' + face(x.p.id, 'sm') +
      '<span class="inj-n"><span class="pn"><span class="nm">' + esc(nameOf(x.p.id)) + '</span>' + pill(rec) + (inLu.has(x.p.id) ? '<span class="badge">in lineup</span>' : '') + '</span>' +
      '<span class="ps">' + teamTag(x.p.team) + (rec.detail ? ' · ' + esc(rec.detail) : '') + (rec.return_date ? ' · back ' + dShort(rec.return_date) : '') + '</span></span>' +
      '<span class="inj-p num' + (out ? ' c-bad' : '') + '">' + (out ? '0%' : pct(pPlayOf(x.info))) + '<small>plays</small></span></button></li>'; };
  // na run: cada jogador do relatório com a faixa dos dias que faltam (vermelho fora, amarelo em dúvida, azul claro provável)
  const runRows = runInj.filter(x => x.hits.length).sort((a, b) => b.hits.length - a.hits.length);
  const sec = (t, n, body) => '<div class="inj-sec"><div class="inj-h">' + t + (n != null ? ' <span class="muted">' + n + '</span>' : '') + '</div>' + body + '</div>';
  const formChips = (l, cls) => l.map(z => '<button class="f-chip ' + cls + '" type="button" data-action="player" data-id="' + esc(z.x.p.id) + '" data-date="' + nd.date + '">' + face(z.x.p.id, 'xs') + esc(lastName(z.x.p.id)) + ' ' + pcs(z) + '</button>').join('');
  let body = '<div class="small muted fold-sub">' + plural(mine.length, 'of your players plays', 'of your players play') + '</div>';
  body += sec('Today', inj.length || null, !S.injOk ? '<div class="small muted inj-empty">The injury report isn’t connected yet.</div>' : inj.length ? '<ul class="list inj-list">' + injToday.map(rowT).join('') + '</ul>' : '<div class="small muted inj-empty">None of your players who play is on the report. ✓</div>');
  if (hot.length || cold.length) body += sec('Form', null, '<div class="f-chips">' + formChips(hot, 'hot') + formChips(cold, 'cold') + '</div>');
  // o relatório todo (a run inteira) fica em Jogadores → Lesões
  if (S.injOk) body += '<button class="btn link small inj-all" type="button" data-action="goto" data-tab="plantel" data-sub="lesoes">' + (runRows.length ? 'Injuries across the run (' + runRows.length + ') ›' : 'Injury report ›') + '</button>';
  const sum = [inj.length ? plural(inj.length, 'injury', 'injuries') : 'no injuries', (hot.length ? hot.length + ' ▲' : '') + (hot.length && cold.length ? ' ' : '') + (cold.length ? cold.length + ' ▼' : '')].filter(Boolean).join(' · ');
  return foldCard('lesoes', 'Injuries and form', helpBtn('lesoesforma'), sum, body);
}
// lesões do plantel na run toda: para cada jogador no relatório, os dias que faltam em que conta (fora ou com X% de jogar)
function injuryHits(r) {
  return r.model.players.filter(p => injRec(p.id)).map(p => {
    const pi = r.model.pIndex.get(p.id), rec = injRec(p.id);
    const hits = r.model.days.map(md => { const inf = md.info[pi] && md.info[pi][0]; return inf && inf.injury && inf.injury.status && md.teams.has(p.team) ? { n: md.day.idx + 1, out: inf.injury.status === 'fora', p: pPlayOf(inf) } : null; }).filter(Boolean);
    return { p, rec, hits };
  });
}
// De onde vem o lineup do dia (odds, lesões, médias, run) e quanto pesa cada jogador (e porque ficam outros de fora)
function basisDayCard(r, v, d, md, nd) {
  if (!d.lineup.length || d.noObjective) return '';
  const date = nd.date, od = S.odds[date];
  const rows = d.lineup.map(id => { const pi = r.model.pIndex.get(id); return { id, pi, info: md.info[pi][0] }; });
  const withOdds = rows.filter(x => ['odds', 'proxy', 'misto'].includes(x.info.src)).length;
  const hasOdds = od && Object.keys(od.players || {}).length;
  const injured = rows.filter(x => x.info.injury && !x.info.injury.ignored && x.info.injury.status);
  const bb = rows.filter(x => x.info.b2b);
  const lines = [
    ['Odds', hasOdds ? withOdds + ' of ' + rows.length + ' in the lineup · ' + esc(ago(od.updated_at)) : 'none yet (they arrive in the afternoon): using averages'],
    ['Injuries', S.injOk ? (injured.length ? injured.map(x => '<b>' + esc(lastName(x.id)) + '</b> ' + pct(pPlayOf(x.info)) + ' to play').join(' · ') : 'nobody in the lineup') : 'report not connected yet'],
    ['Back-to-back', bb.length ? bb.map(x => '<b>' + esc(lastName(x.id)) + '</b>').join(', ') + ' played yesterday' + (!b2bOn ? ' (no adjustment)' : '') : 'nobody played yesterday'],
    ['Run', r.prizes.length ? r.prizes.map((p, i) => p.wins + 'V ' + pct(v.prizeProbs[i])).join(' · ') : 'the most wins over the whole run'],
  ];
  // sem cada jogador do lineup, quanto cai a vitória do dia (entra o melhor que sobra com usos)
  const inSet = new Set(d.lineup), bench = md.elig.filter(pi => !inSet.has(r.model.players[pi].id));
  const withUses = bench.filter(pi => (r.model.uses[pi] || 0) > 0), P = d.P;
  const why = rows.map(x => {
    const rest = d.lineup.filter(y => y !== x.id);
    let best = lineupP(md, rest), sub = null;
    withUses.forEach(pi => { const id2 = r.model.players[pi].id, q2 = lineupP(md, rest.concat([id2])); if (q2 > best + 1e-12) { best = q2; sub = id2; } });
    return { id: x.id, info: x.info, without: best, sub };
  });
  // os mais fortes que ficam de fora, e porquê
  const weight = pi => md.objs.reduce((t, _, k) => t + md.mu[pi][k] / md.T[k], 0);
  const outs = bench.slice().sort((a, b) => weight(b) - weight(a)).slice(0, 3).map(pi => {
    const id = r.model.players[pi].id, info = md.info[pi][0], later = v.days.filter(x => x.date !== date && x.lineup.includes(id));
    let swapP = P, swapOut = null;
    d.lineup.forEach(y => { const q2 = lineupP(md, d.lineup.filter(z => z !== y).concat([id])); if (q2 > swapP + 1e-12) { swapP = q2; swapOut = y; } });
    const reason = !(r.model.uses[pi] > 0) ? 'no uses' : later.length ? 'saved for ' + (later.length > 1 ? 'days ' : 'day ') + later.map(x => x.idx + 1).join(', ') : info.pPlay < 1 ? pct(info.pPlay) + ' to play' : 'worth less';
    return { id, info, reason, swapP, swapOut };
  });
  const pp = x => Math.round(x * 100), signed = n => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');
  const row = (id, name, sub, val) => '<li><button class="row" type="button" data-action="player" data-id="' + esc(id) + '" data-date="' + date + '"><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + name + '</span></div><div class="ps">' + sub + '</div></div></span><div class="pv"><div class="v num">' + val + '</div><div class="u">pp</div></div></button></li>';
  return '<div class="card basis-day"><div class="list-head"><h2>What it’s based on ' + helpBtn('porque') + '</h2><span class="small muted">' + dWeek(date) + ', ' + dShort(date) + '</span></div>' +
    lines.map(([a, b]) => '<div class="status-line basis-line"><span class="bl">' + a + '</span><span>' + b + '</span></div>').join('') +
    '<div class="list-head sub-head"><h3>What each one is worth</h3></div><ul class="list">' +
    why.map(w => row(w.id, esc(nameOf(w.id)), esc(srcShort(w.info)) + (w.info.pPlay < 1 ? ' · ' + pct(w.info.pPlay) + ' to play' : '') + ' · without him ' + pct(w.without) + (w.sub ? ' (in: ' + esc(lastName(w.sub)) + ')' : '') + (pp(w.without) > pp(P) ? ' · saves others' : ''), signed(pp(P) - pp(w.without)))).join('') +
    outs.map(x => row(x.id, '<span class="muted">Out:</span> ' + esc(nameOf(x.id)), esc(x.reason) + (x.swapOut ? ' · for ' + esc(lastName(x.swapOut)) + ': ' + pct(x.swapP) : ''), signed(x.swapOut ? pp(x.swapP) - pp(P) : 0))).join('') + '</ul></div>';
}
// várias contas: vitória de cada conta neste dia
function groupLine(nd) {
  const g = S.multi;
  return '<div class="impact"><div>' + g.keys.map(k => { const dd = g.byKey[k].normal.days.find(x => x.date === nd.date); return esc(accLabel(k)) + ' ' + (dd ? (dd.lineup.length ? '<b class="num">' + pct(dd.P) + '</b>' : 'doesn\'t play') : 'closed'); }).join(' · ') + '</div></div>';
}
// Moments a mandar de uma conta para outra (Run → Contas)
function transfersCard() {
  const g = S.multi; if (!g) return '';
  if (!(S.profile || {}).collection) return '<div class="note info">Read the wallets (Players → Collection) to know what to send to each account.</div>';
  const list = g.transfers;
  const row = t => '<li class="row"><span class="who">' + face(t.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(t.id)) + '</span>' + (t.uses && collectionInfo(t.id).nTop < collectionInfo(t.id).copies ? '<span class="badge">' + (t.uses >= 4 ? 'Legendary' : t.uses >= 2 ? 'Rare' : 'Common') + '</span>' : '') + '</div><div class="ps">' + esc(accLabel(t.from)) + ' → <b>' + esc(accLabel(t.to)) + '</b> · before ' + dWeek(t.before) + ', ' + dShort(t.before) + '</div></div></span></li>';
  return '<div class="card"><div class="list-head"><h2>Transfers ' + helpBtn('transf') + '</h2><span class="small muted">' + (list.length ? list.length + ' in the run' : 'none') + '</span></div>' + (list.length ? '<ul class="list">' + list.map(row).join('') + '</ul>' : '<div class="row small muted">Each account plays with the Moments it has.</div>') + '</div>';
}
// ---- a run refeita com uma mudança ao plano (para as opções do dia e para fixar/tirar um jogador) ----
// ---- motor noutro fio (engine-worker.js): sem Worker, ou se não arrancar, corre aqui como antes ----
let EW = null, ewSeq = 0; const ewWait = new Map();
function engineWorker() {
  if (EW !== null) return EW || null;
  try {
    EW = new Worker('engine-worker.js');
    EW.onmessage = e => { const p = ewWait.get(e.data.id); if (!p) return; ewWait.delete(e.data.id); window.FB_WORKER = 'ok'; if (e.data.err) p.no(new Error(e.data.err)); else p.ok(e.data.out); };
    EW.onerror = () => { ewWait.forEach(p => p.no(new Error('worker'))); ewWait.clear(); EW = false; window.FB_WORKER = 'falhou'; };
  } catch (e) { EW = false; }
  return EW || null;
}
function engineLocal(kind, args, key) {
  if (kind === 'buyRank') return FB.buyRank.apply(null, args);
  if (kind === 'planRun') { const r = FB.planRun.apply(null, args); return { res: r.normal, total: r.normal.objective }; }
  const g = FB.planGroup.apply(null, args); return { res: g.byKey[key || 'main'].normal, total: g.objective, group: g };
}
function engineCall(kind, args, key) {
  const w = engineWorker();
  if (!w) return tick(0).then(() => engineLocal(kind, args, key));
  // a hora vai com o pedido (o outro fio pode ter outro relógio: jogos já começados, lesões)
  const o = args[args.length - 1]; if (o && typeof o === 'object' && o.now == null) args = args.slice(0, -1).concat([Object.assign({}, o, { now: Date.now() })]);
  return new Promise((ok, no) => { const id = ++ewSeq; ewWait.set(id, { ok, no }); try { w.postMessage({ id, kind, args, key, form: +formLevel }); } catch (e) { ewWait.delete(id); no(e); } })
    .catch(() => engineLocal(kind, args, key));
}
// como evalAlt / planWith, mas no outro fio (o ecrã continua a responder)
function evalAltAsync(mod) {
  if (!S.multi) { const x = engineInputs('main'), plan = clone(x.plan); modCap(mod, plan); return engineCall('planRun', [x.run, x.roster, x.odds, plan, engOpts()]); }
  const base = engineInputs('main');
  const list = accounts().map(a => { const x = a.id === 'main' ? base : engineInputs(a.id); let plan = x.plan; if (a.id === S.acc) { plan = clone(plan); modCap(mod, plan); } return { key: a.id, roster: x.roster, plan }; });
  return engineCall('planGroup', [base.run, list, base.odds, engOpts()], S.acc);
}
function planWithAsync(mod, kicks) {
  if (!S.multi) { const y = engineInputs('main'); mod(y.roster.players); return engineCall('planRun', [y.run, y.roster, y.odds, y.plan, engOpts()]); }
  const base = engineInputs('main');
  const list = accounts().map(a => { const y = a.id === 'main' ? base : engineInputs(a.id); const ro = clone(y.roster); mod(ro.players); return { key: a.id, roster: ro, plan: y.plan }; });
  return engineCall('planGroup', [base.run, list, base.odds, Object.assign(engOpts(), kicks != null ? { kicks } : {})], 'main');
}
function evalAlt(mod) {
  if (!S.multi) {
    // como o plano que se vê (planRun: também experimenta tudo pelo dia e fica com o melhor), para as contas baterem certo
    const x = engineInputs('main'), plan = clone(x.plan); modCap(mod, plan);
    const res = FB.planRun(x.run, x.roster, x.odds, plan, engOpts()).normal;
    return { res, total: res.objective };
  }
  const base = engineInputs('main');
  const list = accounts().map(a => { const x = a.id === 'main' ? base : engineInputs(a.id); let plan = x.plan; if (a.id === S.acc) { plan = clone(plan); modCap(mod, plan); } return { key: a.id, roster: x.roster, plan }; });
  const g = FB.planGroup(base.run, list, base.odds, engOpts());
  return { res: g.byKey[S.acc].normal, total: g.objective, group: g };
}
const altMods = {
  fix: (date, ids) => plan => { plan.locks = plan.locks || {}; plan.bans = plan.bans || {}; plan.locks[date] = ids.slice(); plan.bans[date] = (plan.bans[date] || []).filter(x => !ids.includes(x)); if (plan.keep) delete plan.keep[date]; },
  ban: (date, id) => plan => { plan.bans = plan.bans || {}; plan.bans[date] = (plan.bans[date] || []).concat([id]); if (plan.locks && plan.locks[date]) plan.locks[date] = plan.locks[date].filter(x => x !== id); if (plan.keep && plan.keep[date]) plan.keep[date] = plan.keep[date].filter(x => x !== id); },
  clear: date => plan => { if (plan.locks) plan.locks[date] = []; if (plan.bans) plan.bans[date] = []; if (plan.keep) delete plan.keep[date]; },
};
// ---- Sugestões para hoje (antes "Opções"): o plano comparado com as alternativas, cada uma com a run toda refeita ----
// Antes dos jogos: ir com tudo hoje ou guardar um dos que mais pesam. Durante os jogos (com os pontos que já
// entraram): manter, tirar um ou poupar os que ainda não jogaram. Quem sai antes de o jogo começar não gasta o uso.
function chainLineupToday(date) {
  const uid = S.session.user.id, rows = ((S.group || {}).chain || []).filter(c => c.user_id === uid && c.date === date && (c.account || 'main') === S.acc && (c.lineup || []).length);
  if (!rows.length) return null;
  const byName = new Map(Object.keys(S.mine.roster || {}).map(id => [norm(nameOf(id)), id]));
  const ids = rows[0].lineup.map(n => byName.get(norm(n))).filter(Boolean);
  return ids.length ? ids : null;
}
// topo das opções durante os jogos: feito até agora, vitória se ficar tudo como está, cada jogador do lineup submetido
function liveHead(nd) {
  const r = S.result, v = view(), d0 = v.days[0], md = r.model.days[0];
  if (!d0 || d0.date !== nd.date) return { html: '<div class="note info">' + 'This day is already closed.' + '</div>', closed: true };
  const lv = liveDoc(nd.date) || {}, sub = (lv.lineup || []).filter(id => r.model.pIndex.has(id));
  const started = new Set(((d0.live || {}).locked) || []), rem = sub.filter(id => !started.has(id));
  const eligIds = md.elig.map(pi => r.model.players[pi].id), pSub = lineupP(md, sub);
  const done = d0.totals.map(t => f0(t.known) + '<small> of ' + t.target + (d0.totals.length > 1 ? ' ' + esc(statShort(t.stat)) : '') + '</small>').join(' · ');
  const rows = sub.map(id => {
    const pi = r.model.pIndex.get(id), info = (md.info[pi] || [])[0] || {}, st = info.liveState;
    const ps = st === 'fim' ? '<span class="pill fim">Final</span>'
      : st === 'jogo' || st === 'jogo?' ? '<span class="pill jogo">' + (info.q ? QLABEL[info.q] : 'Playing') + '</span> ' + md.objs.map((o, k) => f0((md.info[pi][k] || {}).known || 0) + (md.objs.length > 1 ? ' ' + esc(statShort(o.stat)) : '')).join(' · ') + ' so far'
      : (tipOf(nd, id) ? 'game at ' + tipOf(nd, id) : '');
    return '<li class="row"><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn">' + (started.has(id) ? icoLock : '') + '<span class="nm">' + esc(nameOf(id)) + '</span></div><div class="ps">' + ps + '</div></div></span>' + pvHtml(objVals(md, pi, true)) + '</li>';
  }).join('');
  const chips = '<div class="chips" role="group" aria-label="Submitted lineup">' + eligIds.map(id => '<button type="button" data-action="op-pick" data-id="' + esc(id) + '" aria-pressed="' + sub.includes(id) + '">' + (started.has(id) ? icoLock : '') + esc(lastName(id)) + '</button>').join('') + '</div>';
  const html = '<div class="kv" style="grid-template-columns:1fr 1fr"><div><div class="label">Done so far</div><div class="v num">' + done + '</div></div><div><div class="label">Win today as it is</div><div class="v num c-' + tone(pSub) + '">' + pct(pSub) + '</div></div></div>' +
    (rows ? '<ul class="list card">' + rows + '</ul>' : '') +
    '<div class="stack" style="gap:8px"><div class="label">Submitted lineup <span class="muted" style="font-weight:400">· tap to fix</span></div>' + chips + '</div>' +
    (rem.length ? '' : '<div class="note info">All your players have started: nothing left to change today.</div>');
  return { html, sub, started, rem, eligIds, closed: false };
}
const tipOf = (day, id) => { const r = S.result, team = (r.model.players[r.model.pIndex.get(id)] || {}).team, tt = team ? FB.tipTime(day, team) : null; return tt ? hm(new Date(tt).toISOString()) : ''; };
async function opcoesSheet(fetchLive) {
  const nd = nextDay(); if (!S.result || !nd) return;
  const date = nd.date, tip = firstTipOf(nd), during = tip != null && Date.now() >= tip;
  if (during) ensureLive();
  compute();
  const r0 = S.result;
  openSheet('<h3>Suggestions for today ' + helpBtn('opcoes') + '</h3><div id="opHead" class="stack">' + (during ? liveHead(nd).html : '') + '</div><div id="opCards" class="stack"><div class="small muted" id="opProg">' + (during ? 'Reading the live points…' : 'Redoing the run…') + '</div></div>');
  if (during && fetchLive !== false && gamesWindow(nd)) { try { await liveFetch(true); } catch (e) { /* sem rede: usa o que há */ } if (!$('opCards')) return; compute(); }
  const r = S.result || r0, cur = view(), d0 = cur.days[0];
  let opts = [];
  if (during) {
    const h = liveHead(nd); $('opHead').innerHTML = h.html;
    if (h.closed || !h.rem.length) { $('opCards').innerHTML = ''; return; }
    const { sub, started, rem, eligIds } = h;
    // só os escolhidos jogam hoje (os outros ficam de fora, para ninguém entrar no lugar)
    const keepOnly = keep => plan => { plan.locks = plan.locks || {}; plan.bans = plan.bans || {}; plan.locks[date] = keep.filter(id => !started.has(id)); plan.bans[date] = eligIds.filter(id => !keep.includes(id) && !started.has(id)); };
    opts.push({ title: 'What the plan suggests', mod: () => {}, plan: true });
    opts.push({ title: rem.length > 1 ? 'Keep the ' + rem.length + ' still to play' : 'Keep ' + nameOf(rem[0]), mod: keepOnly(sub) });
    if (rem.length > 1) rem.forEach(x => opts.push({ title: 'Remove ' + nameOf(x), mod: keepOnly(sub.filter(y => y !== x)) }));
    opts.push({ title: rem.length > 1 ? 'Save the ' + rem.length + ' still to play' : 'Remove ' + nameOf(rem[0]), mod: keepOnly(sub.filter(y => started.has(y))) });
  } else {
    if (!d0 || d0.date !== date) { $('opCards').innerHTML = '<div class="note info">' + 'This day is already closed.' + '</div>'; return; }
    const fixed = (((curPlan().locks || {})[date]) || []).length + (((curPlan().bans || {})[date]) || []).length;
    opts.push({ title: 'The plan' + (fixed ? ' (with your choices)' : ''), mod: () => {}, plan: true, now: true });
    if (fixed) opts.push({ title: 'The plan without your choices', mod: altMods.clear(date) });
    // alternativa sem riscos: sem quem está em dúvida hoje (o plano conta com eles a jogar)
    const md0 = r.model.days[0], risky = md0 ? md0.elig.map(pi => r.model.players[pi].id).filter(id => riskOf(md0, id)) : [];
    if (risky.length && d0.lineup.some(id => risky.includes(id))) opts.push({ title: 'No injury risk (without ' + risky.map(lastName).join(', ') + ')', mod: plan => { plan.bans = plan.bans || {}; plan.bans[date] = [...new Set((plan.bans[date] || []).concat(risky))]; if (plan.locks && plan.locks[date]) plan.locks[date] = plan.locks[date].filter(x => !risky.includes(x)); } });
    // com várias contas: quem não pode jogar hoje nesta conta porque a carta que chega já joga noutra fica de fora
    const blk = new Set(md0 ? md0.elig.filter(pi => tierBlocked(r.model.players[pi].id, S.acc, date)) : []);
    const mAlt = blk.size ? Object.assign({}, r.model, { uses: r.model.uses.map((u, i) => (blk.has(i) ? 0 : u)) }) : r.model;
    FB.alternativeSeeds(mAlt, cur).forEach(sd => {
      if (sd.kind === 'allin') opts.push({ title: 'All in on today', mod: altMods.fix(date, sd.lineupIdx.map(i => r.model.players[i].id)) });
      else { const id = r.model.players[sd.player].id; opts.push({ title: 'Save ' + nameOf(id), mod: altMods.ban(date, id) }); }
    });
  }
  // a run: vitórias esperadas no fim (é o que separa as escolhas quando os prémios estão longe) e os prémios
  const prizeTxt = res => r.prizes.map((p, i) => p.wins + 'V ' + pct(res.prizeProbs[i])).join(' · ');
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const base = during ? ((liveDoc(date) || {}).lineup || []) : d0.lineup;
  const lkey = x => [...x.a0.lineup].sort().join('|'), baseKey = [...base].sort().join('|');
  const isNow = x => x.now || lkey(x) === baseKey; // é o que já tens (nada a mudar)
  const res = [], failed = [];
  const draw = busy => {
    // escolhas com o mesmo lineup hoje: fica a primeira (o plano antes das outras); as outras ficam escritas nela
    const list = [], seen = new Map(); res.forEach(x => { const k = lkey(x); if (!seen.has(k)) { x.same = []; seen.set(k, x); list.push(x); } else seen.get(k).same.push(x.title); });
    if (!busy) list.sort((x, y) => (y.ev.total - x.ev.total) || ((y.plan ? 1 : 0) - (x.plan ? 1 : 0)));
    S.opcoes = list;
    const best = busy ? null : list[0];
    $('opCards').innerHTML = (busy ? '<div class="small muted" id="opProg">Redoing the run… ' + res.length + ' of ' + opts.length + '</div>' : '') + list.map((x, k) => {
      const ins = x.a0.lineup.filter(id => !base.includes(id)), outs = base.filter(id => !x.a0.lineup.includes(id));
      const later = outs.map(id => { const ds = x.ev.res.days.filter(dd => dd.date !== date && dd.lineup.includes(id)).map(dd => dd.idx + 1); return ds.length ? esc(lastName(id)) + ' is kept for ' + (ds.length > 1 ? 'days ' : 'day ') + ds.join(', ') : ''; }).filter(Boolean);
      const tag = x === best ? '<span class="small up">the best</span>' : isNow(x) ? '<span class="small muted">what you have</span>' : '';
      return '<div class="card panel op-card' + (x === best ? ' best' : '') + '"><div class="list-head" style="padding:0"><h2>' + esc(x.title) + '</h2>' + tag + '</div>' +
        '<div class="small">Today <b class="num c-' + tone(x.a0.P) + '">' + pct(x.a0.P) + '</b> · rest of the run ≈ <b class="num">' + f1(x.ev.res.days.filter(dd => dd.date !== date).reduce((t, dd) => t + (dd.P || 0), 0)) + '</b> wins</div>' +
        (r.prizes.length ? '<div class="small muted">Prizes: ' + prizeTxt(x.ev.res) + '</div>' : '') +
        (() => { const rk = !during && r.model.days[0] ? x.a0.lineup.filter(id => riskOf(r.model.days[0], id)) : []; return rk.length ? '<div class="small c-warn">⚠ Counts on ' + rk.map(id => esc(lastName(id))).join(', ') + ' playing (' + esc((INJ_LABEL[(injRec(rk[0]) || {}).status] || 'questionable').toLowerCase()) + ').</div>' : ''; })() +
        ((ins.length || outs.length) ? '<div class="small muted">' + cap([outs.length ? 'out: ' + outs.map(id => esc(lastName(id)) + (during && tipOf(nd, id) ? ' (' + tipOf(nd, id) + ')' : '')).join(', ') : '', ins.length ? 'in: ' + ins.map(id => esc(lastName(id))).join(', ') : ''].filter(Boolean).join(' · ')) + (later.length ? '. ' + later.join(' · ') : '') + '.</div>' : '') +
        (x.same && x.same.length ? '<div class="small muted">Same lineup as: ' + x.same.map(esc).join(', ') + '</div>' : '') +
        (isNow(x) ? '' : '<button class="btn' + (x === best ? ' primary' : '') + '" type="button" data-action="op-use" data-i="' + k + '">Choose</button>') + '</div>';
    }).join('') + (busy || list.length ? '' : '<div class="note info">Couldn\'t redo the run.</div>') +
      (!busy && failed.length ? '<div class="small muted">Couldn’t calculate: ' + failed.map(esc).join(', ') + '.</div>' : '');
  };
  draw(true);
  for (let k = 0; k < opts.length; k++) {
    await new Promise(ok => setTimeout(ok, 30));
    if (!$('opCards')) return; // fechou a folha
    try { const ev = await evalAltAsync(opts[k].mod), a0 = ev.res.days[0]; if (a0 && a0.date === date) res.push(Object.assign({ ev, a0 }, opts[k])); else failed.push(opts[k].title); } catch (e) { console.warn(e); failed.push(opts[k].title); }
    draw(k < opts.length - 1);
  }
}
// corrigir o lineup submetido (durante os jogos)
function opPick(id) {
  const nd = nextDay(); if (!nd) return;
  const cur = (liveDoc(nd.date) || {}).lineup || [], size = (S.result.model.days[0] || {}).size || 5;
  const next = cur.includes(id) ? cur.filter(x => x !== id) : cur.concat([id]);
  if (next.length > size) { toast('At most ' + size + ' players.'); return; }
  planPatch({ live: { [nd.date]: { lineup: next } } });
  opcoesSheet(true);
}
function opUse(i) {
  const x = (S.opcoes || [])[+i], nd = nextDay(); if (!x || !nd) return;
  const during = liveOn(nd.date), base = during ? ((liveDoc(nd.date) || {}).lineup || []) : view().days[0].lineup;
  const outs = base.filter(id => !x.a0.lineup.includes(id)), ins = x.a0.lineup.filter(id => !base.includes(id));
  const plan = curPlan(); modCap(x.mod, plan);
  // durante os jogos, a escolha passa a ser o lineup submetido (faz a mesma mudança no Top Shot)
  if (during) { plan.live = plan.live || {}; plan.live[nd.date] = Object.assign({}, plan.live[nd.date], { lineup: x.a0.lineup.slice() }); }
  else { const h = planOf(S.acc).hold; if (h && h.d === nd.date && (outs.length || ins.length)) { holdLog(S.acc, nd.date, { k: 'mine', outs, ins, prev: h.ids.slice(), ids: x.a0.lineup.slice(), P1: x.a0.P }); planOf(S.acc).hold = { d: nd.date, ids: x.a0.lineup.slice() }; } }
  closeSheet(); schedule(); saveMine();
  toast(during && (outs.length || ins.length) ? 'On Top Shot: ' + [outs.length ? 'take out ' + outs.map(lastName).join(', ') : '', ins.length ? 'put in ' + ins.map(lastName).join(', ') : ''].filter(Boolean).join(' and ') + ' before the game.' : 'Done. The rest of the run was redone.');
}

// ---- Run ----
function renderRun() {
  const el = $('tab-run');
  if (!guard(el, true)) return;
  const r = S.result, v = view(), sub = subOf('run'), html = [subBar('run')];
  if (sub === 'contas' && S.multi) {
    const g = S.multi, P = mainResult().prizes;
    html.push('<div class="card"><div class="list-head"><h2>Your accounts ' + helpBtn('contas') + '</h2><span class="small muted">joint plan</span></div><ul class="list">' + g.keys.map(k => { const rk = g.byKey[k], vk = rk.normal;
      return '<li><button class="row" type="button" data-action="acc-run" data-acc="' + esc(k) + '"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(accLabel(k)) + '</span></div><div class="ps">' + recordTxt(rk.wins, rk.losses) + ' · expected ' + f1(rk.wins + vk.expected) + '</div></div>' + (P.length ? miniAros(P, vk.prizeProbs) : '') + '</button></li>'; }).join('') + '</ul></div>');
    html.push(transfersCard());
    el.innerHTML = html.join(''); return;
  }
  if (sub === 'historico') { html.push(historicoHtml()); el.innerHTML = html.join(''); return; }
  if (S.multi) html.push(accSwitch());
  if (sub === 'analise') { html.push(analiseHtml()); el.innerHTML = html.join(''); return; }
  if (sub === 'dias') { html.push(runDaysHtml(r, v)); el.innerHTML = html.join(''); return; }
  html.push(runBoard(r, v), distCard(r, v));
  el.innerHTML = html.join('');
}
// objetivo do dia com o "e" pequeno (os dias de combinação cabem numa linha)
const goalHtml = day => { const l = ((day || {}).objectives || []).filter(o => o && o.stat); return l.length ? l.map(o => esc(objOne(o))).join('<small> and </small>') : esc('Goal not set'); };
// Run → Dias: a run toda numa lista — objetivo, lineup do plano e vitória prevista; nos dias que passaram, o resultado
// e o total feito. Tocar num dia abre-o na Jornada.
function runDaysHtml(r, v) {
  const nd = nextDay(), byDate = new Map(v.days.map(d => [d.date, d])), played = curPlan().played || {};
  const rows = S.days.map((day, i) => {
    const pl = played[day.date], d = byDate.get(day.date), now = !!nd && nd.date === day.date;
    let names, chip, note = '';
    if (pl && pl.done) {
      // dia jogado: o total feito num quadrado verde ou vermelho (como na faixa da Jornada)
      const tot = doneTot(pl, day), win = pl.result === 'win';
      names = pl.lineup || [];
      chip = '<span class="pchip num ' + (win ? 'p-good' : 'p-bad') + '">' + (tot ? tot.map(f0).join('·') : resMark(pl.result)) + '<span class="vh"> ' + (win ? 'win' : 'loss') + '</span></span>';
    } else if (d) {
      names = d.lineup;
      if (now && liveOn(day.date)) note = 'live';
      chip = d.noObjective || !d.lineup.length ? '<span class="pchip pred p-done">—</span>' : '<span class="pchip pred p-' + dTone(d.P) + ' num">' + pct(d.P) + '</span>'; // previsão: só a cor no número
    } else {
      const lu = pl && pl.noAuto ? null : lineupFor(S.acc, day.date);
      names = lu || []; note = lu ? 'waiting for the stats' : 'no result';
      chip = '<span class="pchip p-done">' + (lu ? '…' : '—') + '</span>';
    }
    const md = d ? r.model.days.find(m => m.day.date === day.date) : null, hurt = md ? lineupInjured(r, md, d.lineup).length : 0;
    const sub = [dShort(day.date), note, names.length ? names.map(id => esc(lastName(id))).join(' · ') : (pl && pl.done) || note ? '' : 'no players'].filter(Boolean).join(' · ');
    return '<li' + (now ? ' class="is-next"' : '') + '><button class="drow" type="button" data-action="day" data-date="' + day.date + '"><span class="dn">' + (i + 1) + '<small>' + (now ? 'Today' : dWeek(day.date)) + '</small></span>' +
      '<span style="min-width:0"><span class="d1"><b>' + goalHtml(day) + '</b>' + (hurt ? '<span class="pill duv">injury</span>' : '') + '</span>' +
      '<span class="d2" style="display:block">' + sub + '</span></span>' + chip + '</button></li>';
  }).join('');
  return '<div class="card"><div class="list-head"><h2>Days ' + helpBtn('dias') + '</h2><span class="small muted">' + recordTxt(r.wins, r.losses) + '</span></div><ul class="list">' + rows + '</ul></div>';
}
// Placar da run: vitórias e derrotas, e um aro por patamar de prémio com a probabilidade em palavras
function runBoard(r, v) {
  const left = r.model.days.length, P = r.prizes;
  const head = '<div class="hero-top"><span class="eyebrow">' + (S.multi ? esc(accLabel(S.acc)) : 'Your run') + ' ' + helpBtn('premios') + '</span><span class="small">' + (left ? plural(left, 'day to play', 'days to play') : 'run finished') + '</span></div>';
  const rec = '<div class="rec-big num">' + r.wins + '<small>' + (r.wins === 1 ? 'win' : 'wins') + '</small>' + r.losses + '<small>' + (r.losses === 1 ? 'loss' : 'losses') + '</small></div>';
  if (!P.length) return '<div class="card hero run-board">' + head + rec + '<div class="small">Expected at the end: <b>' + f1(r.wins + v.expected) + '</b> of ' + S.days.length + '.' + (S.role === 'admin' ? ' Set the prizes in Settings → Admin.' : '') + '</div></div>';
  const cols = P.map((p, i) => { const x = v.prizeProbs[i], need = p.wins - r.wins;
    return '<div class="aro-col">' + aro(x, p.wins, 64, likely(x)) + '<div><div class="pc num">' + pct(x) + '</div><div class="lk">' + likely(x) + '</div><div class="nd small">' + (need <= 0 ? 'secured' : need > left ? 'out of reach' : 'need ' + need + ' in ' + left) + '</div></div></div>'; }).join('');
  const withP = P.map((p, i) => [p, v.prizeProbs[i]]), sure = withP.filter(([, x]) => x >= 0.5).pop(), up = withP.find(([, x]) => x < 0.5);
  const line = sure ? 'On track for the <b>' + sure[0].wins + ' wins</b> prize' + (up ? '; the ' + up[0].wins + '-win prize is at ' + pct(up[1]) + '.' : '.') : up ? 'The closest prize is <b>' + up[0].wins + ' wins</b>: ' + likely(up[1]).toLowerCase() + '.' : '';
  const sh = r.model.prizeShift || {}, shTxt = (sh.dropped || []).length ? '<div class="small muted">Out of reach: ' + sh.dropped.join(' and ') + ' wins' + (sh.added.length ? '. Now counting: ' + sh.added.slice().sort((a, b) => a - b).join(' and ') + ' wins' : '') + '.</div>' : '';
  return '<div class="card hero run-board">' + head + rec + '<div class="aros">' + cols + '</div>' + (line ? '<div class="small">' + line + '</div>' : '') + shTxt + '</div>';
}
// Quantas vitórias no fim da run: probabilidade de cada total, com as zonas de prémio
function distCard(r, v) {
  const dist = v.winDist || [], P = r.prizes, base = r.wins;
  if (dist.length < 2) return '';
  const max = Math.max(...dist), modeK = dist.indexOf(max), n = P.length;
  const cls = i => (n === 1 ? 'z3' : n === 2 ? ['z2', 'z3'][i] : ['z1', 'z2', 'z3'][Math.min(2, i)]);
  const zone = w => { let z = -1; P.forEach((p, i) => { if (w >= p.wins) z = i; }); return z; };
  const bars = dist.map((x, k) => { const w = base + k, z = zone(w); return '<i class="' + (z >= 0 ? cls(z) : '') + (k === modeK ? ' mode' : '') + '" style="height:' + Math.max(2, x / max * 100).toFixed(1) + '%" title="' + w + ' wins: ' + pct(x) + '"></i>'; }).join('');
  const xs = dist.map((x, k) => { const w = base + k; return '<span class="' + (P.some(p => p.wins === w) ? 'tier' : '') + '">' + w + '</span>'; }).join('');
  const legend = P.map((p, i) => '<span><i class="' + cls(i) + '" style="background:var(--ball);opacity:' + [0.45, 0.72, 1][n === 1 ? 2 : n === 2 ? i + 1 : Math.min(2, i)] + '"></i>' + p.wins + ' or more' + (p.label ? ' · ' + esc(p.label) : '') + '</span>').join('') +
    '<span><i style="outline:2px solid var(--ink);background:transparent"></i>most likely: ' + (base + modeK) + ' (' + pct(max) + ')</span>';
  return '<div class="card"><div class="list-head"><h2>Wins at the end ' + helpBtn('dist') + '</h2><span class="small muted">expected ' + f1(base + v.expected) + '</span></div>' +
    '<div class="dist" role="img" aria-label="Chance of each number of wins at the end of the run; the most likely is ' + (base + modeK) + '">' + bars + '</div><div class="dist-x" aria-hidden="true">' + xs + '</div><div class="dist-legend">' + legend + '</div></div>';
}

// ---------- previsões guardadas: Análise (previsto vs real) ----------
// Até ao 1.º jogo de cada dia, o plano de cada conta guarda a previsão desse dia: vitória, total do lineup e o esperado
// de cada jogador do plantel que joga (se jogar), com a origem (odds ou médias), jogo seguido e probabilidade de jogar.
// Depois do 1.º jogo fica como estava. Os valores reais entram depois: do jogo a jogo ou dos últimos jogos (tarefa das médias).
const SRC_CODE = { odds: 'o', proxy: 'o', misto: 'o', media: 'a', estimativa: 'a', sem: '-' };
const firstTipOf = day => { const ts = (day.games || []).map(g => Date.parse(g[2])).filter(x => isFinite(x)); return ts.length ? Math.min(...ts) : null; };
const rnd = (x, k) => { const m = Math.pow(10, k == null ? 1 : k); return Math.round((+x || 0) * m) / m; };
function snapshotProj() {
  if (!S.session || !S.mineLoaded || !S.result) return;
  const now = Date.now(); let changed = false;
  accounts().forEach(a => {
    const r = S.multi ? S.multi.byKey[a.id] : (a.id === 'main' ? S.result : null); if (!r) return;
    const pa = planOf(a.id);
    r.model.days.forEach((md, di) => {
      const day = md.day, tip = firstTipOf(day);
      if (!md.objs.length || tip == null || now >= tip) return; // depois do 1.º jogo fica a que estava
      const d = r.normal.days[di];
      if (!d || !d.lineup.length) return;
      const pl = {};
      md.elig.forEach(pi => {
        const p = r.model.players[pi], inf = md.info[pi] || [], x = inf[0] || {};
        // [esperado se jogar (por objetivo), desvio se jogar, origem, jogo seguido, probabilidade de jogar]
        pl[p.id] = [inf.map(y => rnd(y.muIf != null ? y.muIf : y.mu)), rnd(Math.sqrt(Math.max(0, x.vIf != null ? x.vIf : x.v || 0))), SRC_CODE[x.src] || '-', x.b2b ? 1 : 0, rnd(x.pPlay != null ? x.pPlay : 1, 2)];
      });
      const snap = { P: rnd(d.P, 3), lineup: d.lineup.slice(), o: md.objs.map((o, k) => Object.assign({ stat: o.stat, T: md.T[k], mu: rnd(d.totals[k].mu), sd: rnd(d.totals[k].sd) }, o.each ? { each: true } : {})), pl };
      const old = (pa.proj || {})[day.date];
      if (old) {
        const strip = x => JSON.stringify(Object.assign({}, x, { at: 0, act: 0 }));
        if (strip(old) === strip(snap)) return;
        if (now - Date.parse(old.at) < 20 * 60e3 && (old.lineup || []).join() === snap.lineup.join() && Math.abs(old.P - snap.P) < 0.03) return; // poupa gravações
      }
      snap.at = new Date(now).toISOString();
      pa.proj = pa.proj || {}; pa.proj[day.date] = snap; changed = true;
    });
  });
  if (fillActuals()) changed = true;
  if (changed) saveMine();
}
// valor real de um jogador num dia: array por objetivo, null = não jogou, undefined = ainda não se sabe
function actualFor(id, date, objs) {
  const c = S.players.get(String(id)), avg = c && c.avg, f = avg && avg.form;
  if (!f || !Array.isArray(f.games) || !f.games.length) return undefined;
  const g = f.games.find(x => x[0] === date);
  if (g) { const vals = gameVals(g); return (+vals.min || 0) > 0 ? objs.map(o => rnd(FB.statValue(vals, o.stat, avg))) : null; }
  const ds = f.games.map(x => x[0]).sort();
  return ds[0] < date && ds[ds.length - 1] > date ? null : undefined; // jogou antes e depois desse dia, mas nesse não
}
function fillActuals() {
  let changed = false; const today = todayET();
  accounts().forEach(a => {
    const pa = planOf(a.id);
    Object.entries(pa.proj || {}).forEach(([date, sn]) => {
      if (date > today || !sn || !sn.pl || !(sn.o || []).length) return;
      const act = sn.act || {};
      let ch = false;
      Object.keys(sn.pl).forEach(id => {
        if (act[id] !== undefined) return;
        const x = valsFor(a.id, date, id, sn.o); // ao vivo (fim) → fichas da ESPN → últimos jogos
        if (x !== undefined) { act[id] = x; ch = true; }
      });
      if (ch) { sn.act = act; changed = true; }
    });
  });
  return changed;
}
// junta as previsões guardadas de uma conta com o que aconteceu
function analysisData(acc) {
  const pa = planOf(acc), proj = pa.proj || {}, played = pa.played || {}, today = todayET();
  const rows = [];
  S.days.forEach((day, i) => {
    const sn = proj[day.date], pl = played[day.date];
    if (!sn || !pl || !pl.done || !(sn.o || []).length) return;
    const lineup = (pl.lineup || []).length ? pl.lineup : sn.lineup, act = sn.act || {}, o = sn.o[0];
    const same = lineup.slice().sort().join() === sn.lineup.slice().sort().join();
    // previsto para o lineup que jogou (1.º objetivo), com a probabilidade de cada um jogar
    let pred = 0, v = 0, known = lineup.length > 0;
    lineup.forEach(id => { const x = sn.pl[id]; if (!x) { known = false; return; } const m = x[0][0], s = x[1], q = x[4]; pred += q * m; v += q * s * s + q * (1 - q) * m * m; });
    if (!known && same) { pred = o.mu; v = o.sd * o.sd; known = true; }
    let actual = sn.o.length === 1 && pl.points != null ? +pl.points : null;
    if (actual == null && lineup.length && lineup.every(id => act[id] !== undefined)) actual = lineup.reduce((s, id) => s + (act[id] ? act[id][0] : 0), 0);
    rows.push({ date: day.date, i, sn, pl, lineup, win: pl.result === 'win', P: sn.P, same, pred: known ? pred : null, sd: known ? Math.sqrt(v) : null, actual, T: o.T, stat: o.stat });
  });
  // jogadores: todos os do plantel que jogavam em cada dia que já passou (não só os do lineup)
  const obs = [];
  Object.entries(proj).forEach(([date, sn]) => {
    if (date >= today || !sn || !sn.pl || !(sn.o || []).length) return;
    const act = sn.act || {};
    Object.entries(sn.pl).forEach(([id, x]) => { const a = act[id]; if (a === undefined) return; obs.push({ id, date, pred: x[0][0], q: x[4], src: x[2], b2b: !!x[3], act: a ? a[0] : null, stat: sn.o[0].stat }); });
  });
  return { rows, obs, saved: Object.keys(proj).length, waiting: Object.keys(proj).filter(d => d >= today).sort() };
}
// razão real/previsto de um conjunto de observações (só quem jogou e com previsão que se veja)
function ratioOf(list) {
  const ok = list.filter(x => x.act != null && x.pred > 0.3); if (!ok.length) return null;
  const sp = ok.reduce((s, x) => s + x.pred, 0), sa = ok.reduce((s, x) => s + x.act, 0), se = ok.reduce((s, x) => s + Math.abs(x.act - x.pred), 0);
  return { n: ok.length, r: sa / sp, err: se / sp };
}
// [2,3,4,7] → "2–4, 7"
const spans = ns => { const a = [...new Set(ns)].sort((x, y) => x - y), out = []; for (let i = 0; i < a.length; i++) { let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; if (j - i >= 2) out.push(a[i] + '–' + a[j]); else for (let k = i; k <= j; k++) out.push(String(a[k])); i = j; } return out.length > 1 ? out.slice(0, -1).join(', ') + ' and ' + out[out.length - 1] : out.join(''); };
const signPct = x => (x > 0.005 ? '+' : x < -0.005 ? '−' : '') + Math.abs(Math.round(x * 100)) + '%';
function analiseHtml() {
  const A = analysisData(S.acc), rows = A.rows, html = [];
  const wn = A.waiting.map(d => S.days.findIndex(x => x.date === d) + 1).filter(n => n > 0);
  const waitTxt = wn.length ? 'Predictions waiting for the games: ' + (wn.length === 1 ? 'day ' : 'days ') + spans(wn) + '.' : '';
  if (!rows.length && !A.obs.length) return '<div class="card panel"><h2>Analysis ' + helpBtn('analise') + '</h2><div class="small muted">Shows up after the first days are played. ' + esc(waitTxt) + '</div></div>';
  if (rows.length) {
    const exp = rows.reduce((s, x) => s + x.P, 0), wins = rows.filter(x => x.win).length, fav = rows.filter(x => (x.P >= 0.5) === x.win).length;
    const tot = rows.filter(x => x.pred != null && x.actual != null), inside = tot.filter(x => x.sd > 0 && Math.abs(x.actual - x.pred) <= x.sd).length;
    const bias = tot.length ? tot.reduce((s, x) => s + (x.actual - x.pred) / Math.max(1, x.pred), 0) / tot.length : null;
    const buckets = [[0, 0.35, 'Under 35%'], [0.35, 0.65, '35% to 65%'], [0.65, 1.01, 'Over 65%']].map(([lo, hi, l]) => { const b = rows.filter(x => x.P >= lo && x.P < hi); return b.length ? { l, n: b.length, p: b.reduce((s, x) => s + x.P, 0) / b.length, w: b.filter(x => x.win).length } : null; }).filter(Boolean);
    html.push('<div class="card hero an-board"><div class="hero-top"><span class="eyebrow">' + (S.multi ? esc(accLabel(S.acc)) + ' · ' : '') + 'Predicted vs actual ' + helpBtn('analise') + '</span><span class="small">' + plural(rows.length, 'day closed', 'closed days') + '</span></div>' +
      '<div class="an-kpis"><div><div class="label">Wins</div><div class="v num">' + wins + '<small> of ' + rows.length + '</small></div><div class="small">predicted ' + f1(exp) + '</div></div>' +
      '<div><div class="label">Favourite</div><div class="v num">' + fav + '<small> of ' + rows.length + '</small></div><div class="small">called who would win</div></div>' +
      (tot.length ? '<div><div class="label">Total</div><div class="v num">' + inside + '<small> of ' + tot.length + '</small></div><div class="small">close to the prediction (normal: 7 in 10)</div></div>' : '') + '</div>' +
      '<div class="small">' + (bias != null ? 'Totals: <b>' + signPct(bias) + '</b> vs predicted. ' : '') + (rows.length >= 4 ? (Math.abs(wins - exp) <= Math.max(1, Math.sqrt(rows.reduce((s, x) => s + x.P * (1 - x.P), 0))) ? 'Wins as expected.' : wins > exp ? 'More wins than predicted.' : 'Fewer wins than predicted.') : 'Still too few days to draw conclusions.') + '</div></div>');
    if (buckets.length > 1) html.push('<div class="card"><div class="list-head"><h2>Is the prediction right?</h2><span class="small muted">days grouped by predicted win</span></div><ul class="list">' + buckets.map(b => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + b.l + '</span></div><div class="ps">' + plural(b.n, 'day', 'days') + ' · predicted on average ' + pct(b.p) + '</div></div><div class="pv"><div class="v num">' + Math.round(b.w / b.n * 100) + '%</div><div class="u">' + b.w + ' of ' + b.n + ' won</div></div></li>').join('') + '</ul></div>');
    html.push('<div class="card"><div class="list-head"><h2>Day by day</h2><span class="small muted">predicted · actual</span></div><ul class="list">' + rows.map(x => {
      const diff = x.pred != null && x.actual != null ? x.actual - x.pred : null;
      return '<li><button class="drow" type="button" data-action="day" data-date="' + x.date + '"><span class="dn">' + (x.i + 1) + '<small>' + dWeek(x.date) + '</small></span><span style="min-width:0"><span class="d1"><b>' + esc(objsText(S.days[x.i])) + '</b><span class="small muted">predicted ' + pct(x.P) + (x.same ? '' : ' · lineup changed') + '</span></span><span class="d2" style="display:block">' +
        (x.pred != null ? 'predicted total ' + f0(x.pred) + (x.actual != null ? ' · actual <b>' + f0(x.actual) + '</b> <span class="' + (diff >= 0 ? 'good-t' : 'warn-t') + '">(' + (diff >= 0 ? '+' : '−') + f0(Math.abs(diff)) + ')</span>' : ' · actual unknown') : 'no prediction for the lineup played') + '</span></span>' +
        '<span class="pchip ' + (x.win ? 'p-good' : 'p-bad') + '">' + (x.win ? 'W' : 'L') + '</span></button></li>'; }).join('') + '</ul></div>');
  }
  const obs = A.obs;
  if (obs.length) {
    const byP = new Map(); obs.forEach(x => { (byP.get(x.id) || byP.set(x.id, []).get(x.id)).push(x); });
    const pr = [...byP.entries()].map(([id, l]) => ({ id, R: ratioOf(l), dnp: l.filter(x => x.act == null).length, n: l.length })).filter(x => x.R && x.R.n >= 2);
    const up = pr.filter(x => x.R.r >= 1.12).sort((a, b) => b.R.r - a.R.r).slice(0, 6), down = pr.filter(x => x.R.r <= 0.88).sort((a, b) => a.R.r - b.R.r).slice(0, 6);
    const prow = x => '<li><button class="row" type="button" data-action="pform" data-id="' + esc(x.id) + '"><span class="who">' + face(x.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(x.id)) + '</span></div><div class="ps">' + plural(x.R.n, 'game', 'games') + (x.dnp ? ' · missed ' + x.dnp : '') + '</div></div></span><span class="delta ' + (x.R.r >= 1 ? 'up' : 'down') + ' num">' + signPct(x.R.r - 1) + '<small>vs predicted</small></span></button></li>';
    if (up.length || down.length) html.push('<div class="card"><div class="list-head"><h2>Players</h2><span class="small muted">what they did versus the prediction</span></div><ul class="list">' + up.map(prow).join('') + down.map(prow).join('') + '</ul></div>');
    const odds = ratioOf(obs.filter(x => x.src === 'o')), avgs = ratioOf(obs.filter(x => x.src === 'a')), b2b = ratioOf(obs.filter(x => x.b2b)), rest = ratioOf(obs.filter(x => !x.b2b));
    const miss = obs.filter(x => x.act == null), missQ = miss.length ? miss.reduce((s, x) => s + x.q, 0) / miss.length : null;
    const line = (l, R, note) => R ? '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + l + '</span></div><div class="ps">' + plural(R.n, 'game', 'games') + ' · average error ' + Math.round(R.err * 100) + '%' + (note ? ' · ' + note : '') + '</div></div><div class="pv"><div class="v num">' + Math.round(R.r * 100) + '%</div><div class="u">of predicted</div></div></li>' : '';
    html.push('<div class="card"><div class="list-head"><h2>Where the prediction came from</h2><span class="small muted">' + plural(obs.length, 'game', 'games') + '</span></div><ul class="list">' +
      line('With odds', odds, 'bookmaker lines') + line('Averages only', avgs, 'no line for that player') + line('Back-to-back (2nd day)', b2b, b2bOn ? 'the plan takes ~3% off without odds' : 'adjustment turned off') + line('With rest', rest) +
      (miss.length ? '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">Didn\'t play</span></div><div class="ps">' + plural(miss.length, 'time', 'times') + ' · the plan gave them on average ' + pct(missQ) + ' to play</div></div></li>' : '') +
      '</ul></div>');
  }
  if (waitTxt) html.push('<p class="small muted" style="margin:0 4px">' + esc(waitTxt) + '</p>');
  return html.join('');
}
// folha de um dia fechado: previsto ao lado do real, jogador a jogador
function predVsActualHtml(date) {
  const sn = (curPlan().proj || {})[date]; if (!sn || !(sn.o || []).length) return '';
  const pl = ((curPlan().played || {})[date]) || {}, act = sn.act || {}, o = sn.o[0], u = esc(statShort(o.stat)), many = sn.o.length > 1;
  const lineup = (pl.lineup || []).length ? pl.lineup : (lineupFor(S.acc, date) || sn.lineup);
  const units = sn.o.map(x => esc(statShort(x.stat)));
  const val = a => (a === undefined ? '<div class="v num muted">…</div>' : a === null ? '<div class="small muted" style="font-weight:600">didn\'t play</div>' : '<div class="v num">' + f1(a[0]) + '</div>');
  // dia de combinação: um valor por estatística, empilhados
  const valMany = a => (a === undefined || a === null ? '<div class="pv">' + val(a) + '</div>' : '<div class="pv pv-multi">' + sn.o.map((x, k) => '<div><b class="num">' + f1(a[k] || 0) + '</b><span class="u">' + units[k] + '</span></div>').join('') + '</div>');
  const rows = lineup.map(id => { const x = sn.pl[id], a = act[id], d = x && a ? a[0] - x[0][0] : null;
    return '<li class="row"><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(id)) + '</span>' + (x && x[3] ? '<span class="badge">back-to-back</span>' : '') + '</div><div class="ps">predicted ' + (x ? (many ? sn.o.map((z, k) => f1(x[0][k] || 0) + ' ' + units[k]).join(' · ') : f1(x[0][0])) + (x[4] < 1 ? ' (' + pct(x[4]) + ' to play)' : '') + ' · ' + (x[2] === 'o' ? 'odds' : 'averages') : '—') + '</div></div></span>' +
      (many ? valMany(a) : '<div class="pv">' + val(a) + '<div class="u">' + (d != null ? '<span class="' + (d >= 0 ? 'good-t' : 'warn-t') + '">' + (d >= 0 ? '+' : '−') + f1(Math.abs(d)) + '</span>' : u) + '</div></div>') + '</li>'; }).join('');
  const others = Object.entries(sn.pl).filter(([id]) => !lineup.includes(id) && act[id]).map(([id, x]) => ({ id, d: act[id][0] - x[0][0], a: act[id][0] })).filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
  const A = analysisData(S.acc).rows.find(x => x.date === date);
  let kv;
  if (many) {
    // por estatística: previsto para o lineup que jogou, alvo e feito
    const allKnown = lineup.length && lineup.every(id => sn.pl[id]), allAct = lineup.length && lineup.every(id => act[id] !== undefined);
    kv = '<div><div class="label">Predicted win</div><div class="v num">' + pct(sn.P) + '</div></div>' + sn.o.map((x, k) => {
      const pred = allKnown ? lineup.reduce((t, id) => t + sn.pl[id][4] * (sn.pl[id][0][k] || 0), 0) : x.mu;
      const done = allAct ? lineup.reduce((t, id) => t + (act[id] ? act[id][k] || 0 : 0), 0) : null;
      return '<div><div class="label">' + units[k] + ' · target ' + x.T + '</div><div class="v num' + (done != null ? (done >= x.T ? ' up' : ' down') : '') + '">' + (done != null ? f0(done) : '…') + '</div><div class="small muted">predicted ' + f0(pred) + '</div></div>';
    }).join('');
  } else kv = '<div><div class="label">Predicted win</div><div class="v num">' + pct(sn.P) + '</div></div><div><div class="label">Predicted total</div><div class="v num">' + (A && A.pred != null ? f0(A.pred) : f0(o.mu)) + '</div><div class="small muted">± ' + f0(A && A.sd != null ? A.sd : o.sd) + ' · target ' + o.T + '</div></div><div><div class="label">Actual</div><div class="v num">' + (A && A.actual != null ? f0(A.actual) : '…') + '</div></div>';
  return '<div class="card"><div class="list-head"><h2>Predicted vs actual</h2><span class="small muted">prediction at ' + esc(hm(sn.at)) + '</span></div>' +
    '<div class="kv" style="padding:0 14px 10px">' + kv + '</div>' +
    '<ul class="list">' + rows + '</ul>' + (others.length ? '<div class="row small muted" style="display:block">Outside the lineup, who did more than predicted' + (many ? ' in ' + u : '') + ': ' + others.map(x => esc(lastName(x.id)) + ' ' + f1(x.a) + ' (+' + f1(x.d) + ')').join(' · ') + '.</div>' : '') +
    (A && !A.same ? '<div class="row small muted" style="display:block">The lineup played was not the predicted one: the predicted total is for the players who played.</div>' : '') + '</div>';
}

// ---------- Histórico: os teus dias de Fast Break (todas as runs lidas da blockchain) ----------
S.hist = null;
async function loadHistory() {
  if (S.hist && (S.hist.loading || Date.now() - S.hist.at < 5 * 60e3)) return;
  S.hist = { loading: true, at: Date.now() };
  try {
    const uid = S.session.user.id;
    const [res, games, runs] = await Promise.all([
      fetchAll('chain_results', 'game_id,chain_run_id,date,points,win,lineup,account', x => x.eq('user_id', uid)),
      fetchAll('chain_games', 'id,run_id,deadline,num_players,stats'),
      fetchAll('chain_runs', 'id,name,run_start,run_end'),
    ]);
    S.hist = { at: Date.now(), res: res || [], games: new Map((games || []).map(g => [g.id, g])), runs: new Map((runs || []).map(r => [r.id, r])) };
  } catch (e) { S.hist = { at: Date.now(), err: errText(e) }; }
  if (S.tab === 'run' && subOf('run') === 'historico') renderRun();
  if (S.tab === 'plantel' && subOf('plantel') === 'comprar') renderPlantel();
}
// objetivos de um dia da blockchain: [{stat, target, each}]
const gameObjs = g => ((g && g.stats) || []).map(s => ({ stat: FB.mapStat(s.name), target: +s.valueNeeded, each: +s.type === 0, name: s.name })).filter(o => o.stat);
const median = xs => { const a = xs.slice().sort((x, y) => x - y), n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; };
// estatísticas que mais saem (dias das runs Classic lidas; se não houver Classic, todas)
function statFrequency() {
  const H = S.hist; if (!H || !H.games) return null;
  const all = [...H.games.values()], isClassic = g => /classic/i.test(((H.runs.get(g.run_id) || {}).name) || '');
  const list = all.some(isClassic) ? all.filter(isClassic) : all;
  const by = {};
  list.forEach(g => gameObjs(g).forEach(o => { const e = (by[o.stat] = by[o.stat] || { stat: o.stat, n: 0, t: [], each: 0 }); e.n++; if (o.each) e.each++; else e.t.push(o.target); }));
  return { days: list.length, classic: list !== all, runs: new Set(list.map(g => g.run_id)).size, stats: Object.values(by).map(e => Object.assign(e, { med: median(e.t), lo: median(e.t.filter(x => x <= median(e.t))), hi: median(e.t.filter(x => x >= median(e.t))) })).sort((a, b) => b.n - a.n) };
}
function historicoHtml() {
  const H = S.hist;
  if (!H || H.loading) { if (!H) setTimeout(loadHistory, 0); return '<div class="note info">Reading your history…</div>'; }
  if (H.err) return '<div class="note">Couldn\'t read the history: ' + esc(H.err) + '</div>';
  const res = H.res.filter(x => x.win != null), html = [];
  const F = statFrequency();
  if (!res.length && !(F && F.days)) return '<div class="card panel"><h2>History ' + helpBtn('historico') + '</h2><div class="small muted">No days read from the blockchain yet. Come back in a few hours.</div></div>';
  const W = res.filter(x => x.win).length, runsSeen = new Set(res.map(x => x.chain_run_id));
  const accN = new Set(res.map(x => x.account || 'main')).size;
  html.push('<div class="card hero an-board"><div class="hero-top"><span class="eyebrow">Your Fast Break ' + helpBtn('historico') + '</span><span class="small">' + plural(runsSeen.size, 'run', 'runs') + (accN > 1 ? ' · ' + accN + ' accounts' : '') + '</span></div>' +
    '<div class="an-kpis"><div><div class="label">Days played</div><div class="v num">' + res.length + '</div></div><div><div class="label">Wins</div><div class="v num">' + W + '</div><div class="small">' + (res.length ? Math.round(W / res.length * 100) + '% of days' : '') + '</div></div></div></div>');
  // estatísticas: quantas vezes saem, alvo típico e como te corre cada uma
  if (F && F.stats.length) {
    const mine = {}; res.forEach(x => { const g = H.games.get(x.game_id); gameObjs(g).forEach(o => { const e = (mine[o.stat] = mine[o.stat] || { n: 0, w: 0 }); e.n++; if (x.win) e.w++; }); });
    const max = F.stats[0].n;
    html.push('<div class="card"><div class="list-head"><h2>Most common stats</h2><span class="small muted">' + F.days + ' days' + (F.classic ? ' Classic' : '') + ' · ' + plural(F.runs, 'run', 'runs') + '</span></div><ul class="list">' + F.stats.slice(0, 12).map(e => { const m = mine[e.stat];
      return '<li class="row hist-stat"><div style="min-width:0;flex:1"><div class="pn"><span class="nm">' + esc(statLabel(e.stat)) + '</span><span class="small muted">' + Math.round(e.n / F.days * 100) + '% of days</span></div><div class="hbar" aria-hidden="true"><i style="width:' + Math.max(3, e.n / max * 100).toFixed(1) + '%"></i></div>' +
        '<div class="ps">' + (e.med != null ? 'typical target <b class="num">' + f0(e.med) + '</b>' + (e.lo !== e.hi ? ' (' + f0(e.lo) + '–' + f0(e.hi) + ')' : '') : '') + (e.each ? (e.med != null ? ' · ' : '') + e.each + '× per player' : '') + (m ? ' · you: ' + m.w + ' of ' + m.n + ' won' : '') + '</div></div><div class="pv"><div class="v num">' + e.n + '</div><div class="u">days</div></div></li>'; }).join('') + '</ul>' +
      '</div>');
  }
  if (res.length) {
    // jogadores que mais usaste
    const pu = {}; res.forEach(x => (x.lineup || []).filter(Boolean).forEach(n => { const e = (pu[n] = pu[n] || { n: 0, w: 0 }); e.n++; if (x.win) e.w++; }));
    const top = Object.entries(pu).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    if (top.length) html.push('<div class="card"><div class="list-head"><h2>Players you used the most</h2><span class="small muted">days won with him</span></div><ul class="list">' + top.map(([n, e]) => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(n) + '</span></div><div class="ps">' + plural(e.n, 'day', 'days') + '</div></div><div class="pv"><div class="v num">' + Math.round(e.w / e.n * 100) + '%</div><div class="u">' + e.w + ' of ' + e.n + '</div></div></li>').join('') + '</ul></div>');
    // runs
    const byRun = {}; res.forEach(x => { const k = x.chain_run_id || '?'; const e = (byRun[k] = byRun[k] || { id: k, acc: {} }); const a = (e.acc[x.account || 'main'] = e.acc[x.account || 'main'] || { w: 0, l: 0 }); x.win ? a.w++ : a.l++; });
    const runs = Object.values(byRun).map(e => Object.assign(e, { r: H.runs.get(e.id) || {} })).sort((a, b) => (+b.r.run_start || 0) - (+a.r.run_start || 0));
    html.push('<div class="card"><div class="list-head"><h2>Runs</h2><span class="small muted">wins – losses</span></div><ul class="list">' + runs.map(e => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(e.r.name || 'Run ' + String(e.id).slice(0, 8)) + '</span></div><div class="ps">' + (e.r.run_start ? dShort(new Date(e.r.run_start * 1000).toISOString().slice(0, 10)) + (e.r.run_end ? ' – ' + dShort(new Date((e.r.run_end - 12 * 3600) * 1000).toISOString().slice(0, 10)) : '') : '') + '</div></div><div class="pv" style="text-align:right">' + Object.entries(e.acc).map(([k, a]) => '<div class="small"><span class="muted">' + (accN > 1 ? esc(accLabel(k)) + ' ' : '') + '</span><b class="num">' + a.w + '–' + a.l + '</b></div>').join('') + '</div></li>').join('') + '</ul></div>');
  }
  return html.join('');
}

// ---- Plantel ----
// seletor de conta (só com contas smurf)
function accSwitch() {
  if (!groupMode()) return '';
  return '<div class="seg acc-seg" role="group" aria-label="Account">' + accounts().map(a => '<button type="button" data-action="acc" data-acc="' + esc(a.id) + '" aria-pressed="' + (S.acc === a.id) + '">' + esc(a.label) + '</button>').join('') + '</div>';
}
// coleção (lida das carteiras; não depende de haver run)
function collectionCard(compact) {
  const col = (S.profile || {}).collection, accs = accounts(), withFlow = accs.filter(a => /^0x[0-9a-fA-F]{16}$/.test((a.flow || '').trim()));
  if (!col) return '<div class="card panel"><h2>Your collection ' + helpBtn('colecao') + '</h2><div class="small muted">' + (withFlow.length ? 'Read your Moments from the blockchain.' : 'Add your Flow address in Settings → Profile to read your Moments.') + '</div>' +
    (withFlow.length ? '<button class="btn primary" type="button" data-action="wallet-sheet">Read wallet' + (withFlow.length > 1 ? 's' : '') + '</button>' : '<button class="btn" type="button" data-action="goto" data-tab="ajustes" data-sub="perfil">Go to Settings</button>') + '</div>';
  const n = Object.keys(col.players || {}).length;
  const tot = Object.entries(col.accounts || {}).map(([k, t]) => (groupMode() ? esc(accLabel(k)) + ' ' : '') + t.moments + ' Moments').join(' · ');
  if (compact) return '<div class="card panel"><div class="list-head"><h2>Your collection</h2><span class="small muted">read ' + esc(ago(col.read_at)) + '</span></div><div class="small muted">' + tot + ' · ' + n + ' NBA players</div><div class="btns"><button class="btn" type="button" data-action="wallet-sheet">Read again</button><button class="btn" type="button" data-action="col-sheet">See collection</button></div></div>';
  const rows = colRows();
  return colSummary(col) + '<div class="card"><div class="list-head"><h2>Players</h2><span class="small muted" id="colCount">' + S.colN + ' players</span></div>' + colToolbar() + '<ul class="list" id="colList">' + rows + '</ul></div>';
}
// ---- coleção: resumo (Moments, jogadores, usos por run e escalões) ----
const TIER_CLS = { Common: 'c', Fandom: 'f', Rare: 'r', 'Rare+': 'r', Legendary: 'l', Ultimate: 'u' };
function tierCounts(col, c) { const o = {}; momentTiers(col, c).forEach(t => { o[t] = (o[t] || 0) + 1; }); return o; }
const tierPills = o => TIERS.slice().reverse().filter(t => o[t]).map(t => '<span class="tpill t-' + TIER_CLS[t] + '">' + t + (o[t] > 1 ? ' <b>×' + o[t] + '</b>' : '') + '</span>').join('');
function colSummary(col) {
  const ps = Object.values(col.players || {}), moments = Object.values(col.accounts || {}).reduce((a, t) => a + (+t.moments || 0), 0);
  const inNba = ps.reduce((a, c) => a + (+c.moments || 0), 0), uses = ps.reduce((a, c) => a + (tierUsesOf(col, c) || 0), 0);
  const tt = {}; ps.forEach(c => { const o = tierCounts(col, c); Object.entries(o).forEach(([t, k]) => { tt[t] = (tt[t] || 0) + k; }); });
  const sum = Object.values(tt).reduce((a, b) => a + b, 0);
  const bar = sum ? '<div class="tier-bar" role="img" aria-label="Moments by tier">' + TIERS.slice().reverse().filter(t => tt[t]).map(t => '<i class="t-' + TIER_CLS[t] + '" style="flex:' + tt[t] + '"></i>').join('') + '</div>' +
    '<div class="tier-legend">' + TIERS.slice().reverse().filter(t => tt[t]).map(t => '<span><i class="t-' + TIER_CLS[t] + '"></i>' + t + ' <b class="num">' + tt[t] + '</b></span>').join('') + '</div>' : '';
  const accLine = groupMode() ? '<div class="small muted">' + Object.entries(col.accounts || {}).map(([k, t]) => esc(accLabel(k)) + ' <b>' + t.moments + '</b>' + (t.listed ? ' (' + t.listed + ' for sale)' : '')).join(' · ') + '</div>' : '';
  return '<div class="card panel col-sum"><div class="list-head" style="padding:0"><h2>Your collection ' + helpBtn('colecao') + '</h2><span class="small muted">read ' + esc(ago(col.read_at)) + '</span></div>' +
    '<div class="col-kpis"><div><b class="num">' + f0(moments) + '</b><span>Moments</span></div><div><b class="num">' + ps.length + '</b><span>NBA players</span></div><div><b class="num">' + (col.sets ? f0(uses) : '–') + '</b><span>uses per run</span></div></div>' +
    bar + accLine + (col.sets ? '' : '<div class="note info">Read the wallet again to see each Moment’s tier.</div>') +
    (col.sets && col.items && Object.values(col.items).some(it => it && !it.d) ? '<div class="note info">Before the next run, tap <b>Read again</b>: that way each card gets the right rarity and ASP from Top Shot.</div>' : '') +
    '<button class="btn" type="button" data-action="wallet-sheet">Read again</button></div>';
}
// ---- coleção: lista de jogadores com procura, ordem e filtro por escalão ----
S.colView = { q: '', sort: 'uses', tier: '' };
function colToolbar() {
  const V = S.colView, col = (S.profile || {}).collection || {};
  const has = {}; Object.values(col.players || {}).forEach(c => Object.keys(tierCounts(col, c)).forEach(t => { has[t] = 1; }));
  return '<div class="col-tools"><input class="field" id="colSearch" type="search" placeholder="Search player or team…" value="' + esc(V.q) + '" autocomplete="off" aria-label="Search the collection">' +
    '<div class="chips scroll" role="group" aria-label="Sort">' + [['uses', 'Most uses'], ['pts', 'Most points'], ['moments', 'Most Moments']].map(([k, l]) => '<button type="button" data-action="col-sort" data-v="' + k + '" aria-pressed="' + (V.sort === k) + '">' + l + '</button>').join('') + '</div>' +
    // Common, Rare e Legendary sempre (mesmo sem nenhum); os outros escalões só se houver
    ('<div class="chips scroll" role="group" aria-label="Tier"><button type="button" data-action="col-tier" data-v="" aria-pressed="' + !V.tier + '">All</button>' + TIERS.slice().reverse().filter(t => has[t] || ['Common', 'Rare', 'Legendary'].includes(t)).map(t => '<button type="button" data-action="col-tier" data-v="' + t + '" aria-pressed="' + (V.tier === t) + '">' + t + '</button>').join('') + '</div>') + '</div>';
}
function colRows() {
  const col = (S.profile || {}).collection; if (!col) return '';
  const V = S.colView, qn = norm(V.q), roster = (S.runId && S.mine && S.mine.roster) || null;
  let list = Object.entries(col.players || {}).map(([id, c]) => { const p = S.players.get(String(id)) || { name: c.name, team: '' }; return { id, c, p, tc: tierCounts(col, c), uses: tierUsesOf(col, c), pts: (p.avg && +p.avg.pts) || 0 }; });
  if (qn) list = list.filter(x => norm(x.p.name || x.c.name).includes(qn) || String(x.p.team || '').toLowerCase().includes(qn));
  if (V.tier) list = list.filter(x => x.tc[V.tier]);
  const by = { uses: (a, b) => ((b.uses || 0) - (a.uses || 0)) || (b.pts - a.pts), pts: (a, b) => b.pts - a.pts, moments: (a, b) => (b.c.moments - a.c.moments) || (b.pts - a.pts), name: (a, b) => String(a.p.name || '').localeCompare(String(b.p.name || '')) };
  list.sort(by[V.sort] || by.uses);
  S.colN = list.length; const cnt = $('colCount'); if (cnt) cnt.textContent = list.length + ' players';
  if (!list.length) return '<li class="row small muted">No player with that filter.</li>';
  return list.map(({ id, c, p, tc, uses }) => {
    const inR = roster && roster[id];
    // cartas: escalão e conta de cada uma (Rare · Main, Common ×2 · Terose)
    const g = {}; (c.ids || []).forEach(f => { const it = (col.items || {})[f]; if (!it) return; const k = momentTier(col, f) + '|' + (groupMode() ? it.a || 'main' : ''); g[k] = (g[k] || 0) + 1; });
    const cards = Object.keys(g).length ? Object.entries(g).sort((a, b) => TIERS.indexOf(b[0].split('|')[0]) - TIERS.indexOf(a[0].split('|')[0])).map(([k, n]) => { const [t, a] = k.split('|'); return '<span class="tpill t-' + TIER_CLS[t] + '">' + t + (n > 1 ? ' <b>×' + n + '</b>' : '') + (a ? ' <span class="tp-acc">· ' + esc(accLabel(a)) + '</span>' : '') + '</span>'; }).join('') : tierPills(tc);
    return '<li><button class="row col-row" type="button" data-action="pform" data-id="' + esc(id) + '"><span class="who">' + face(id, 'sm') +
      '<div style="min-width:0;flex:1"><div class="pn"><span class="nm">' + esc(p.name || c.name) + '</span>' + (inR ? '<span class="badge">in roster</span>' : '') + '</div>' +
      '<div class="ps">' + teamTag(p.team) + (p.avg ? ' · ' + f1(+p.avg.pts || 0) + ' PTS' : '') + '</div>' +
      (cards ? '<div class="tpills">' + cards + '</div>' : '') + '</div></span>' +
      '<div class="pv col-uses"><div class="v num">' + (uses != null ? usesN(uses) : '–') + '</div><div class="u">uses/run</div></div></button></li>';
  }).join('');
}
function renderColList() { const el = $('colList'); if (el) el.innerHTML = colRows(); }
// campo de texto com o cursor lá dentro (não redesenhar por cima do que se está a escrever)
function typingField(id) { const ae = document.activeElement, box = $(id), t = !!(ae && box && box.contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)); if (t) S.typingSkip = true; return t; }
// um desenho saltado enquanto escrevias: faz-se quando sais do campo (depois do toque acabar, para não o perder)
document.addEventListener('focusout', () => { if (!S.typingSkip) return; S.typingSkip = false;
  setTimeout(() => { const ae = document.activeElement; if (!(ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) && S.session) render(); }, 350); });
function renderPlantel() {
  const el = $('tab-plantel');
  if (S.loading) { el.innerHTML = empty('Loading…', 'Reading the run and your roster.'); return; }
  const sub = subOf('plantel');
  if (!$('plSubBar')) el.innerHTML = '<div id="plSubBar"></div><div id="plSub" class="stack"></div>';
  $('plSubBar').innerHTML = subBar('plantel');
  const box = $('plSub');
  if (box.dataset.sub !== sub) { box.innerHTML = ''; box.dataset.sub = sub; }
  else if (sub !== 'plantel' && typingField('plSub')) return;
  if (sub === 'forma') { box.innerHTML = formaHtml(); return; }
  if (sub === 'lesoes') { if (typingField('plSub')) return; box.innerHTML = lesoesHtml(); injFilter(); return; }
  if (sub === 'comprar') { box.innerHTML = buyHtml(); return; }
  if (sub === 'vender') { if (typingField('plSub')) return; box.innerHTML = sellHtml(); sellFilter(); return; }
  if (sub === 'colecao') { box.innerHTML = collectionCard(false); return; }
  if (!S.runId || S.calcError) {
    box.innerHTML = collectionCard(false) + (S.calcError ? empty('Error', S.calcError) : '');
    return;
  }
  const ids = Object.keys(S.mine.roster || {});
  if (!$('rosterFilter')) {
    box.innerHTML = '<div class="toolbar"><input class="field" id="rosterFilter" type="search" placeholder="Search the roster…" value="' + esc(S.filter) + '" aria-label="Search the squad"></div><div id="plBody" class="stack"></div>';
  }
  const body = $('plBody'), run = curRun() || {};
  if (!ids.length) {
    const prev = S.runs.filter(x => x.id !== S.runId), col = (S.profile || {}).collection, nCol = col ? Object.keys(col.players || {}).length : 0;
    body.innerHTML = collectionCard(true) + empty('Empty roster', nCol ? 'Add the players from your collection.' : 'Read your Moments from the wallet or add them by hand.',
      (nCol ? '<button class="btn primary" type="button" data-action="col-to-roster" style="width:100%;max-width:340px">Add the ' + nCol + ' players from the collection</button>' : '<button class="btn primary" type="button" data-action="wallet-sheet" style="width:100%;max-width:340px">Read the wallet</button>') +
      '<button class="btn" type="button" data-action="add-player" style="width:100%;max-width:340px">Add by hand</button>' +
      (prev.length ? '<button class="btn link" type="button" data-action="copy-roster">Copy the roster from another run</button>' : ''));
    return;
  }
  if (!S.result) { body.innerHTML = '<div class="note info">Calculating the plan…</div>'; return; }
  const r = S.result, v = view(), days = S.days, nd = nextDay();
  const planned = {};
  v.days.forEach(d => d.lineup.forEach(id => { (planned[id] = planned[id] || new Set()).add(d.date); }));
  const played = curPlan().played || {};
  // com smurfs: noites em que outra conta usa o jogador (um Moment só joga por uma conta em cada noite)
  const elsewhere = {};
  if (S.multi) accounts().filter(a => a.id !== S.acc).forEach(a => {
    const ra = S.multi.byKey[a.id]; if (!ra) return;
    const pa = planOf(a.id), va = ra.normal;
    va.days.forEach(d => d.lineup.forEach(id => { ((elsewhere[id] = elsewhere[id] || {})[d.date] = elsewhere[id][d.date] || []).push(a.label); }));
    Object.entries(pa.played || {}).forEach(([dt, pl]) => { if (pl && pl.done) (pl.lineup || []).forEach(id => { ((elsewhere[id] = elsewhere[id] || {})[dt] = elsewhere[id][dt] || []).push(a.label); }); });
  });
  const qq = norm(S.filter);
  const list = r.model.players.filter(p => !qq || norm(p.name).includes(qq) || p.team.toLowerCase().includes(qq));
  const ctx = { r, v, days, nd, planned, played, elsewhere, list };
  const PV = S.plView;
  const view3 = PV.mode === 'valor' ? plHeatHtml(ctx) : plListHtml(ctx);
  const totalU = r.model.uses.reduce((a, b) => a + b, 0), totalP = Object.values(v.usage).reduce((a, b) => a + b, 0);
  let usedTot = 0; Object.values(played).forEach(pl => { if (pl && pl.done) usedTot += (pl.lineup || []).length; });
  const closed = Object.values(played).filter(pl => pl && pl.done).length;
  body.innerHTML = accSwitch() +
    '<div class="card"><div class="list-head"><h2>Uses' + (groupMode() ? ' · ' + esc(accLabel(S.acc)) : '') + ' ' + helpBtn('plantel') + '</h2></div>' +
    '<div class="kv" style="padding:0 16px 12px"><div><div class="label">Used</div><div class="v num">' + usedTot + '</div><div class="small muted">' + plural(closed, 'day', 'days') + '</div></div><div><div class="label">Left</div><div class="v num">' + totalU + '</div><div class="small muted">' + ids.length + ' players</div></div><div><div class="label">In the plan</div><div class="v num">' + totalP + '</div><div class="small muted">until the end</div></div></div>' +
    '<div class="seg pl-seg" role="group" aria-label="How to view the roster">' + [['plano', 'Plan by day'], ['valor', 'Value by day']].map(([k, l]) => '<button type="button" data-action="pl-view" data-v="' + k + '" aria-pressed="' + ((PV.mode === 'valor') === (k === 'valor')) + '">' + l + '</button>').join('') + '</div>' +
    view3 + '</div>';
}
// ---- Plantel: duas maneiras de ver (plano por dia, com as médias de cada jogador; valor por dia) ----
S.plView = { mode: 'plano', sort: 'plano', filter: 'todos' };
try { Object.assign(S.plView, JSON.parse(localStorage.getItem('fb-plv') || '{}')); } catch (e) {}
function setPlView(patch) { Object.assign(S.plView, patch); try { localStorage.setItem('fb-plv', JSON.stringify(S.plView)); } catch (e) {} renderPlantel(); }
// estatísticas que ainda saem na run (para as médias de cada jogador), as mais frequentes primeiro
function runStats(days, from) {
  const n = {}; days.forEach(d => { if (from && d.date < from) return; (d.objectives || []).forEach(o => { if (o && o.stat) FB.statTerms(o.stat).forEach(t => { if (t.sign > 0) n[t.s] = (n[t.s] || 0) + 1; }); }); });
  return Object.keys(n).sort((a, b) => n[b] - n[a]);
}
// quanto do alvo do dia um jogador faz sozinho (média dos objetivos, 0–1); null se não joga
function shareOf(md, pi) {
  if (!md || !md.objs.length || !md.teams.has((S.result.model.players[pi] || {}).team)) return null;
  return md.objs.reduce((t, o, k) => t + ((md.info[pi][k] || {}).mu || 0) / Math.max(1, md.T[k]), 0) / md.objs.length;
}
function plFacts(ctx, p) {
  const { r, days, nd, planned, played, elsewhere } = ctx, pi = r.model.pIndex.get(p.id), today = nd ? nd.date : '9999';
  const left = days.filter(d => d.date >= today && FB.teamsOn(d).has(p.team));
  const mdNext = nd ? r.model.days.find(m => m.day.date === nd.date) : null;
  const sh = mdNext ? shareOf(mdNext, pi) : null;
  const usedN = Object.values(played).filter(pl => pl && pl.done && (pl.lineup || []).includes(p.id)).length;
  const ir = injRec(p.id), col = (S.profile || {}).collection, ci = col && (col.players || {})[p.id];
  const fStats = nd ? [...new Set((nd.objectives || []).filter(o => o && o.stat).map(o => o.stat))] : [];
  return { pi, left, sh, mdNext, usedN, plan: (planned[p.id] || new Set()).size, uses: p.uses || 0, ir: ir && !p.injIgnore ? ir : null, tier: ci && ci.bySet ? bestTier(col, ci) : null, other: Object.keys(elsewhere[p.id] || {}).length, fStats, fp: formDay(p.id, fStats.length ? fStats : ['pts']) };
}
const PL_SORTS = [['plano', 'In the plan'], ['proximo', 'Next day'], ['forma', 'Form'], ['usos', 'Uses'], ['jogos', 'Games'], ['nome', 'Name']];
const PL_FILTERS = [['todos', 'All'], ['proximo', 'Play on the next day'], ['plano', 'In the plan'], ['quente', 'In form'], ['frio', 'Out of form'], ['sobram', 'Uses to spare'], ['semusos', 'No uses'], ['lesao', 'Injured']];
function plFilter(ctx) {
  const PV = S.plView, facts = new Map(ctx.list.map(p => [p.id, plFacts(ctx, p)]));
  const test = { todos: () => true, proximo: f => f.sh != null, plano: f => f.plan > 0, quente: f => f.fp != null && f.fp >= 0.08, frio: f => f.fp != null && f.fp <= -0.08, sobram: f => f.uses > f.plan, semusos: f => f.uses <= 0, lesao: f => !!f.ir };
  const counts = {}; PL_FILTERS.forEach(([k]) => { counts[k] = ctx.list.filter(p => test[k](facts.get(p.id))).length; });
  const fk = test[PV.filter] ? PV.filter : 'todos';
  const by = {
    plano: (a, b) => (b.f.plan - a.f.plan) || (b.f.uses - a.f.uses) || ((b.f.sh || 0) - (a.f.sh || 0)),
    proximo: (a, b) => ((b.f.sh == null ? -1 : b.f.sh) - (a.f.sh == null ? -1 : a.f.sh)) || (b.f.plan - a.f.plan),
    usos: (a, b) => (b.f.uses - a.f.uses) || (b.f.plan - a.f.plan),
    jogos: (a, b) => (b.f.left.length - a.f.left.length) || (b.f.uses - a.f.uses),
    nome: (a, b) => String(a.p.name).localeCompare(String(b.p.name)),
    forma: (a, b) => (b.f.fp == null ? -9 : b.f.fp) - (a.f.fp == null ? -9 : a.f.fp),
  };
  const rows = ctx.list.map(p => ({ p, f: facts.get(p.id) })).filter(x => test[fk](x.f)).sort(by[PV.sort] || by.plano);
  return { rows, counts, fk };
}
function plToolbar(counts, fk, withFilter) {
  const PV = S.plView;
  return '<div class="pl-tools"><div class="chips scroll" role="group" aria-label="Sort"><span class="chips-lbl">Sort</span>' + PL_SORTS.map(([k, l]) => '<button type="button" data-action="pl-sort" data-v="' + k + '" aria-pressed="' + (PV.sort === k) + '">' + l + '</button>').join('') + '</div>' +
    (withFilter ? '<div class="chips scroll" role="group" aria-label="Show">' + PL_FILTERS.filter(([k]) => k === 'todos' || counts[k] || k === fk).map(([k, l]) => '<button type="button" data-action="pl-filter" data-v="' + k + '" aria-pressed="' + (fk === k) + '">' + l + ' <span class="cnt-s">' + counts[k] + '</span></button>').join('') + '</div>' : '') + '</div>';
}
// os dias da run numa faixa de quadradinhos, alinhada com os números do cabeçalho: usado, no plano, na outra conta,
// tem jogo, não joga
function plDays(ctx, p) {
  const { days, nd, planned, played, elsewhere } = ctx, set = planned[p.id] || new Set();
  return '<span class="pl-days" style="--nd:' + days.length + '">' + days.map(day => {
    const pl = played[day.date], nx = nd && nd.date === day.date ? ' nx' : '', oth = (elsewhere[p.id] || {})[day.date];
    const k = pl && pl.done ? ((pl.lineup || []).includes(p.id) ? 'u' : 'p') : set.has(day.date) ? 'on' : oth ? 'ot' : FB.teamsOn(day).has(p.team) ? 'g' : 'n';
    const t = { u: 'used', on: 'in the plan', ot: oth ? 'plays for ' + oth.join(' and ') : '', g: 'has a game' }[k];
    return '<span class="pc"' + (t ? ' title="Day ' + (day.idx + 1) + ': ' + esc(t) + '"' : '') + '><i class="s-' + k + nx + '"></i></span>';
  }).join('') + '</span>';
}
const plDayHead = ctx => '<div class="pl-dhead" aria-hidden="true"><span class="pl-days" style="--nd:' + ctx.days.length + '">' + ctx.days.map((d, i) => '<span class="pc' + (ctx.nd && ctx.nd.date === d.date ? ' nx' : '') + '">' + (i + 1) + '</span>').join('') + '</span></div>';
function plListHtml(ctx) {
  const { rows, counts, fk } = plFilter(ctx), nd = ctx.nd, stats = runStats(ctx.days, nd && nd.date).slice(0, 4);
  const nxt = nd ? 'Day ' + (nd.idx + 1) : '';
  const items = rows.map(({ p, f }) => {
    const st = (f.ir ? '<span class="pill ' + INJ_PILL[f.ir.status] + '">' + esc(INJ_LABEL[f.ir.status]) + '</span>' : '');
    const nextTxt = !nd ? '' : f.sh == null ? '<span class="muted">doesn\'t play on ' + nxt + '</span>' : nxt + ': ' + (f.mdNext.objs.length ? f.mdNext.objs.map((o, k) => '<b class="num">' + f1((f.mdNext.info[f.pi][k] || {}).mu || 0) + '</b> ' + esc(statShort(o.stat))).join(' · ') : 'plays');
    const avgs = stats.map(s => { const a = FB.avgOf({ avg: p.avg }, s); if (!a) return ''; const fi = FB.formInfo(p, s), d = fi && (fi.n5 || 0) >= 3 && fi.season ? (fi.l5 - fi.season) / Math.max(1, Math.abs(fi.season)) : 0;
      return '<span>' + esc(statShort(s)) + ' <b class="num">' + f1(a.v) + '</b>' + (d >= 0.08 ? '<i class="up">▲</i>' : d <= -0.08 ? '<i class="down">▼</i>' : '') + '</span>'; }).filter(Boolean).join('');
    const full = f.uses > 0 && f.plan >= f.uses, none = f.uses <= 0;
    return '<li><button class="row pl-card" type="button" data-action="pl-sheet" data-id="' + esc(p.id) + '">' + face(p.id, 'md') +
      '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span>' + (f.tier ? '<span class="tpill t-' + TIER_CLS[f.tier] + '">' + f.tier + '</span>' : '') + st + '</div>' +
      '<div class="ps">' + teamTag(p.team) + ' · ' + plural(f.left.length, 'game', 'games') + ' until the end' + (nextTxt ? ' · ' + nextTxt : '') + '</div>' + (f.sh != null ? fxHtml(p.id, nd, f.fStats.length ? f.fStats : ['pts']) : '') + '</div>' +
      '<div class="pl-uses' + (none ? ' none' : full ? ' full' : '') + '"><b class="num">' + (f.uses >= UNL - 30 ? '∞' : f.uses) + '</b><span>' + (f.uses === 1 ? 'use' : 'uses') + '</span><small>' + (f.plan ? 'plan ' + f.plan : 'not in the plan') + (f.usedN ? ' · used ' + f.usedN : '') + '</small></div>' +
      plDays(ctx, p) + (avgs ? '<div class="pl-avgs">' + avgs + '</div>' : '') + '</button></li>';
  }).join('');
  return plToolbar(counts, fk, true) + (items ? plDayHead(ctx) : '') + '<ul class="list pl-list">' + (items || '<li class="row small muted">No player with this filter.</li>') + '</ul>' +
    '<div class="legend"><span><i class="ls s-u"></i>used</span><span><i class="ls s-on"></i>in the plan</span>' + (S.multi ? '<span><i class="ls s-ot"></i>on the other account</span>' : '') + '<span><i class="ls s-g"></i>has a game</span><span>▲▼ form over the last 5 games</span></div>';
}
// valor por dia: quanto do alvo de cada dia o jogador faz sozinho (mapa de calor); contorno = no plano
function plHeatHtml(ctx) {
  const { r, days, nd, planned, played } = ctx, { rows, counts, fk } = plFilter(ctx);
  const mdOf = new Map(r.model.days.map(m => [m.day.date, m]));
  const size = ((r.model.days[0] || {}).size) || 5, par = 1 / size;
  const cols = 'minmax(80px,96px) repeat(' + days.length + ', 25px)';
  const head = '<div class="mx-row head hm-head" style="grid-template-columns:' + cols + '"><span style="text-align:left">Player</span>' + days.map((d, i) => { const os = (d.objectives || []).filter(o => o && o.stat);
    return '<span class="' + (nd && nd.date === d.date ? 'nx' : '') + '">' + (i + 1) + '<small>' + esc(os.length ? statShort(os[0].stat).slice(0, 4) + (os.length > 1 ? '+' : '') : '–') + '</small></span>'; }).join('') + '</div>';
  const body = rows.map(({ p, f }) => {
    const set = planned[p.id] || new Set();
    const cells = days.map(day => {
      const nx = nd && nd.date === day.date ? ' nx' : '', pl = played[day.date];
      if (pl && pl.done) return '<span class="cell hm' + nx + '">' + ((pl.lineup || []).includes(p.id) ? '<i class="dot used"></i>' : '') + '</span>';
      const sh = shareOf(mdOf.get(day.date), f.pi);
      if (sh == null) return '<span class="cell hm' + nx + '"></span>';
      const lv = sh >= par * 1.3 ? 4 : sh >= par * 1.05 ? 3 : sh >= par * 0.8 ? 2 : sh >= par * 0.5 ? 1 : 0;
      return '<span class="cell hm' + nx + '"><b class="hv h' + lv + (set.has(day.date) ? ' inp' : '') + '">' + Math.round(sh * 100) + '</b></span>';
    }).join('');
    return '<button class="mx-row" type="button" data-action="pl-sheet" data-id="' + esc(p.id) + '" style="grid-template-columns:' + cols + '"><span class="mx-name"><span style="overflow:hidden;text-overflow:ellipsis">' + esc(lastName(p.id)) + '</span><small class="num">' + f.uses + 'u</small></span>' + cells + '</button>';
  }).join('');
  return plToolbar(counts, fk, true) + '<div class="mx-wrap"><div class="mx hm-grid">' + head + (body || '<div class="mx-row muted small">No player found.</div>') + '</div></div>' +
    '<div class="legend"><span>% of the day’s target he makes alone (' + Math.round(par * 100) + '% = one player’s share)</span><span><b class="hv h4 inp" style="width:auto;padding:0 4px">25</b> in the plan</span><span><i class="dot used"></i>already used</span><span>Nu = uses left</span></div>';
}
// jogadores do plantel que estão no relatório de lesões
// ---- cores das equipas (pontinho ao lado da sigla) ----
const TEAM_COLOR = { ATL: '#E03A3E', BOS: '#007A33', BKN: '#3A3A3A', CHA: '#1D1160', CHI: '#CE1141', CLE: '#860038', DAL: '#00538C', DEN: '#0E2240', DET: '#C8102E', GSW: '#1D428A', HOU: '#CE1141', IND: '#002D62', LAC: '#C8102E', LAL: '#552583', MEM: '#5D76A9', MIA: '#98002E', MIL: '#00471B', MIN: '#236192', NOP: '#0C2340', NYK: '#F58426', OKC: '#007AC1', ORL: '#0077C0', PHI: '#006BB6', PHX: '#E56020', POR: '#E03A3E', SAC: '#5A2D81', SAS: '#8A8D8F', TOR: '#CE1141', UTA: '#753BBD', WAS: '#002B5C' };
const teamTag = t => (t ? '<span class="tdot" style="background:' + (TEAM_COLOR[t] || 'var(--faint)') + '" aria-hidden="true"></span> ' + esc(t) : '—');
const playerObj = id => { const c = S.players.get(String(id)) || {}, e = (S.mine.roster || {})[id] || {}; return { id: String(id), name: e.name || c.name || String(id), team: e.team || c.team || '', avg: e.avg || c.avg || null }; };
// ---- Forma: últimos 5 jogos face à época ----
S.forma = { day: null };
const FORM_STATS = ['pts', 'reb', 'ast', 'fg3', 'stl', 'blk', 'min'];
const statName = k => (k === 'min' ? 'MIN' : statShort(k));
function gameVals(g) { const o = {}; GK.forEach((k, i) => { o[k] = g[2 + i]; }); return o; }
// barras dos últimos jogos (do mais antigo para o mais recente) e a média da época como linha
function sparkSvg(games, stat, avg, season) {
  const vals = (games || []).slice().reverse().map(g => Math.max(0, FB.statValue(gameVals(g), stat, avg) || 0));
  if (!vals.length) return '<span></span>';
  const W = 52, H = 26, n = vals.length, bw = 7, gap = n > 1 ? (W - n * bw) / (n - 1) : 0;
  const top = Math.max(1, ...vals, season != null ? season * 1.35 : 0), y = x => H - 1 - x / top * (H - 3);
  return '<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + vals.map((x, i) => '<rect class="' + (season != null && x > season ? 'hi' : '') + '" x="' + (i * (bw + gap)).toFixed(1) + '" y="' + y(x).toFixed(1) + '" width="' + bw + '" height="' + Math.max(1.5, H - 1 - y(x)).toFixed(1) + '" rx="1.5"></rect>').join('') +
    (season != null ? '<line x1="0" x2="' + W + '" y1="' + y(season).toFixed(1) + '" y2="' + y(season).toFixed(1) + '"></line>' : '') + '</svg>';
}
// forma numa estatística: últimos 5 jogos face à época ({pct, l5, season}; null com menos de 3 jogos)
function formPct(id, stat) {
  const fi = FB.formInfo(playerObj(id), stat);
  if (!fi || fi.l5 == null || fi.season == null || (fi.n5 || 0) < 3) return null;
  return { pct: (fi.l5 - fi.season) / Math.max(1, Math.abs(fi.season)), l5: fi.l5, season: fi.season };
}
// forma média nas estatísticas de um dia (as do objetivo)
function formDay(id, stats) { const xs = stats.map(st => formPct(id, st)).filter(Boolean); return xs.length ? xs.reduce((t, x) => t + x.pct, 0) / xs.length : null; }
// minutos nos últimos 5 jogos face à época ({l5, season, d})
function minTrend(id) {
  const c = S.players.get(String(canon(id))), avg = c && c.avg, f = avg && avg.form;
  if (!f || !Array.isArray(f.games) || !(+avg.min > 0)) return null;
  const ms = f.games.slice(0, 5).map(g => +gameVals(g).min || 0).filter(m => m > 0);
  if (ms.length < 3) return null;
  const l5 = ms.reduce((t, x) => t + x, 0) / ms.length; return { l5, season: +avg.min, d: l5 - +avg.min };
}
// jogo desequilibrado (o favorito ganha em ≥ 85% pelas odds da ESPN): quem joga muitos minutos pode jogar menos
// (descanso no fim de um jogo decidido, ou poupado contra uma equipa muito má)
function blowout(id, day) {
  if (!day) return null;
  const t = pTeam(id), g = FB.gameOf(day, t); if (!g) return null;
  const o = ((S.gOdds[day.date] || {}).m || {})[g[0] + '@' + g[1]]; if (!o || o.pHome == null) return null;
  const pf = Math.max(o.pHome, 1 - o.pHome); if (pf < 0.85) return null;
  const c = S.players.get(String(canon(id))); if (!c || !(+((c.avg || {}).min) >= 28)) return null;
  const fav = o.pHome >= 0.5 ? g[1] : g[0]; return { fav, p: pf, mine: fav === t };
}
const boTxt = b => 'Lopsided game (' + esc(b.fav) + ' ' + Math.round(b.p * 100) + '%): ' + (b.mine ? 'may be rested' : 'may play fewer minutes');
// linha da forma (estatísticas do dia e minutos) e o aviso de jogo desequilibrado, para o lineup e o plantel
function fxHtml(id, day, stats) {
  const parts = [];
  stats.forEach(st => { const f = formPct(id, st); if (f && Math.abs(f.pct) >= 0.08) parts.push('<b class="' + (f.pct > 0 ? 'c-good' : 'c-bad') + '">' + (f.pct > 0 ? '▲ +' : '▼ −') + Math.round(Math.abs(f.pct) * 100) + '%</b> ' + esc(statShort(st))); });
  const m = minTrend(id); if (m && Math.abs(m.d) >= 3) parts.push('<b class="' + (m.d > 0 ? 'c-good' : 'c-bad') + '">' + f0(m.l5) + ' min</b> (' + (m.d > 0 ? '+' : '−') + f0(Math.abs(m.d)) + ')');
  const b = blowout(id, day);
  return (parts.length ? '<div class="ps fx">' + parts.join(' · ') + ' <span class="muted">over the last 5</span></div>' : '') + (b ? '<div class="risk-sub">⚠ ' + boTxt(b) + '</div>' : '');
}
// ---- Forma da run: para cada um dos próximos dias, quem dos teus está quente ou frio no que o dia pede ----
function formaHtml() {
  const r = S.result, v = view();
  if (!r || !v || !r.model.days.length) return '<div class="note info">Form shows up once the run is calculated.</div>';
  const mds = r.model.days.filter(md => md.objs.length).slice(0, 6);
  if (!mds.length) return '<div class="note info">No goals for the next days yet.</div>';
  const md = mds.find(x => x.day.date === S.forma.day) || mds[0], day = md.day, dn = dayNo(day.date);
  if (!S.gOdds[day.date]) loadGameOdds(day.date);
  const stats = [...new Set(md.objs.map(o => o.stat))], lu = new Set(((v.days.find(x => x.date === day.date)) || {}).lineup || []);
  const ids = md.elig.map(pi => r.model.players[pi].id).filter(id => (S.mine.roster || {})[id]);
  const st0 = stats[0], u = esc(statShort(st0));
  const rowOf = (id, extra) => {
    const p = playerObj(id), f = formPct(id, st0), fd = formDay(id, stats), pc = fd == null ? null : Math.round(fd * 100);
    return '<li><button class="frow" type="button" data-action="pform" data-id="' + esc(id) + '"><span class="who">' + face(id, 'sm') + '<span style="min-width:0"><span class="pn"><span class="nm">' + esc(p.name) + '</span>' + (lu.has(id) ? '<span class="pill prov">in the plan</span>' : '') + '</span>' +
      '<span class="ps">' + teamTag(p.team) + ' ' + esc(opp(p.team, day)) + (f ? ' · last 5: <b class="num">' + f1(f.l5) + '</b> ' + u + ' · season ' + f1(f.season) : '') + '</span>' + (extra || '') + '</span></span>' +
      sparkSvg(((p.avg || {}).form || {}).games, st0, p.avg, f ? f.season : null) +
      '<span class="delta ' + (pc >= 8 ? 'up' : pc <= -8 ? 'down' : '') + ' num">' + (pc == null ? '—' : (pc > 0 ? '+' : pc < 0 ? '−' : '') + Math.abs(pc) + '%') + '<small>vs season</small></span></button></li>';
  };
  const withF = ids.map(id => ({ id, fd: formDay(id, stats) })).filter(x => x.fd != null);
  const hot = withF.filter(x => x.fd >= 0.08).sort((a, b) => b.fd - a.fd), cold = withF.filter(x => x.fd <= -0.08 && lu.has(x.id)).sort((a, b) => a.fd - b.fd);
  const mins = ids.map(id => ({ id, m: minTrend(id) })).filter(x => x.m && Math.abs(x.m.d) >= 3).sort((a, b) => Math.abs(b.m.d) - Math.abs(a.m.d));
  const bos = ids.map(id => ({ id, b: blowout(id, day) })).filter(x => x.b).sort((a, b) => (lu.has(b.id) ? 1 : 0) - (lu.has(a.id) ? 1 : 0));
  const minRow = x => { const p = playerObj(x.id), m = x.m;
    return '<li><button class="frow" type="button" data-action="pform" data-id="' + esc(x.id) + '"><span class="who">' + face(x.id, 'sm') + '<span style="min-width:0"><span class="pn"><span class="nm">' + esc(p.name) + '</span>' + (lu.has(x.id) ? '<span class="pill prov">in the plan</span>' : '') + '</span><span class="ps">' + f0(m.l5) + ' min over the last 5 · season ' + f0(m.season) + '</span></span></span>' +
      sparkSvg(((p.avg || {}).form || {}).games, 'min', p.avg, m.season) + '<span class="delta ' + (m.d > 0 ? 'up' : 'down') + ' num">' + (m.d > 0 ? '+' : '−') + f0(Math.abs(m.d)) + '<small>min</small></span></button></li>'; };
  const boRow = x => { const p = playerObj(x.id);
    return '<li><button class="row" type="button" data-action="pform" data-id="' + esc(x.id) + '"><span class="who">' + face(x.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span>' + (lu.has(x.id) ? '<span class="pill prov">in the plan</span>' : '') + '</div><div class="ps">' + teamTag(p.team) + ' ' + esc(opp(p.team, day)) + '</div><div class="risk-sub">⚠ ' + boTxt(x.b) + '</div></div></span></button></li>'; };
  const card = (title, note, list, empty) => '<div class="card"><div class="list-head"><h2>' + title + '</h2><span class="small muted">' + note + '</span></div>' + (list ? '<ul class="list">' + list + '</ul>' : '<div class="row small muted">' + empty + '</div>') + '</div>';
  return '<div class="card panel filters"><h2>Run form ' + helpBtn('forma') + '</h2><div class="small muted">For the next days: which of your players are hot or cold in what the day asks for, who is gaining or losing minutes and who might play less.</div>' +
    '<div class="chips scroll" role="group" aria-label="Day">' + mds.map(x => '<button type="button" data-action="forma-day" data-v="' + x.day.date + '" aria-pressed="' + (x === md) + '">Day ' + dayNo(x.day.date) + ' · ' + esc(x.objs.map(o => statShort(o.stat)).join(' + ')) + '</button>').join('') + '</div></div>' +
    card('Hot for day ' + dn, 'yours who play', hot.map(x => rowOf(x.id)).join(''), 'None of yours is above his season in these stats.') +
    card('Cold in the plan for day ' + dn, 'consider swapping', cold.map(x => rowOf(x.id)).join(''), 'No one in this day’s plan is below his season.') +
    card('Minutes changing', 'last 5 vs season', mins.map(minRow).join(''), 'None of yours playing this day changed minutes (±3).') +
    (bos.length ? card('Might play less', 'lopsided games', bos.map(boRow).join(''), '') : '');
}
// ---- Lesões: o teu plantel primeiro, depois os jogadores importantes do resto da NBA ----
const INJ_ORDER = { ofs: 0, out: 1, doubtful: 2, questionable: 3, dtd: 4, probable: 5 };
const TEAM_NICK = { ATL: 'Hawks', BOS: 'Celtics', BKN: 'Nets', CHA: 'Hornets', CHI: 'Bulls', CLE: 'Cavaliers', DAL: 'Mavericks', DEN: 'Nuggets', DET: 'Pistons', GSW: 'Warriors', HOU: 'Rockets', IND: 'Pacers', LAC: 'Clippers', LAL: 'Lakers', MEM: 'Grizzlies', MIA: 'Heat', MIL: 'Bucks', MIN: 'Timberwolves', NOP: 'Pelicans', NYK: 'Knicks', OKC: 'Thunder', ORL: 'Magic', PHI: '76ers', PHX: 'Suns', POR: 'Trail Blazers', SAC: 'Kings', SAS: 'Spurs', TOR: 'Raptors', UTA: 'Jazz', WAS: 'Wizards' };
// uma linha por jogador: nome e estado em cima; lesão e regresso em baixo; a nota da ESPN curta (o resto na ficha)
function injRow(rec, action, opt) {
  const c = S.players.get(rec.id) || {}, o = opt || {}, t = c.team || rec.team || '';
  const sub = [o.team ? teamTag(t) : '', rec.detail ? esc(rec.detail) : '', rec.return_date ? 'back ~' + dShort(rec.return_date) : ''].filter(Boolean).join(' · ');
  return '<li data-n="' + esc(norm((c.name || rec.name || '') + ' ' + t + ' ' + (TEAM_NICK[t] || ''))) + '"' + (o.minor ? ' data-minor="1" hidden' : '') + '><button class="row" type="button" data-action="' + action + '" data-id="' + esc(rec.id) + '"><span class="who">' + face(rec.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(c.name || rec.name) + '</span><span class="pill ' + INJ_PILL[rec.status] + '">' + esc(INJ_LABEL[rec.status]) + '</span></div>' +
    (sub ? '<div class="ps">' + sub + '</div>' : '') + (rec.comment ? '<div class="ps inj-note">' + esc(rec.comment) + '</div>' : '') + '</div></span></button></li>';
}
function lesoesHtml() {
  if (!S.injOk) return '<div class="note info">The injury report isn’t connected yet (admin: new supabase/schema.sql and the "Lesões" job).</div>';
  const all = Object.values(S.injuries || {}).sort((a, b) => (INJ_ORDER[a.status] - INJ_ORDER[b.status]) || String(a.name).localeCompare(String(b.name)));
  const ros = S.mine.roster || {}, mine = all.filter(x => ros[x.id]);
  const imp = x => { const c = S.players.get(x.id); return c && c.avg && ((+c.avg.min || 0) >= 20 || (+c.avg.pts || 0) >= 12); };
  const teamOf = x => (S.players.get(x.id) || {}).team || x.team || '?';
  const by = {}; all.filter(x => !ros[x.id]).forEach(x => (by[teamOf(x)] = by[teamOf(x)] || []).push(x));
  const teams = Object.keys(by).sort();
  const nImp = all.filter(x => !ros[x.id] && imp(x)).length;
  const grp = t => { const xs = by[t], n = xs.filter(imp).length;
    return '<li class="inj-team" data-t="' + esc(t) + '"' + (n ? '' : ' hidden') + '><div class="inj-th">' + teamTag(t) + ' <span class="muted">' + esc(TEAM_NICK[t] || '') + '</span></div><ul class="list">' + xs.map(x => injRow(x, 'pform', { minor: !imp(x) })).join('') + '</ul></li>'; };
  return '<div class="card inj-list"><div class="list-head"><h2>Injuries ' + helpBtn('lesoes') + '</h2><span class="small muted">ESPN, ' + esc(ago(S.injAt)) + '</span></div>' +
    '<div class="lu-search"><input class="field" id="injSearch" type="search" placeholder="Player or team…" autocomplete="off" aria-label="Search player or team" value="' + esc(S.injQ || '') + '"></div>' +
    '<div class="inj-sec"><h3>In your roster</h3>' + (mine.length ? '<ul class="list" id="injMine">' + mine.map(x => injRow(x, 'pl-sheet', { team: true })).join('') + '</ul>' : '<div class="row small muted" style="display:block">Nobody injured. ✓</div>') + '</div>' +
    '<div class="inj-sec"><h3>Rest of the NBA <span class="small muted" id="injCount">' + nImp + ' important · search to see everyone</span></h3>' +
    (teams.length ? '<ul class="inj-teams" id="injTeams">' + teams.map(grp).join('') + '</ul>' : '') +
    (nImp ? '' : '<div class="row small muted inj-zero" style="display:block">No important player in the report.</div>') + '<div class="row small muted inj-none" hidden>No injured player with that name or team.</div></div></div>';
}
// procurar: sem texto mostra os importantes; com texto, todos os do relatório que batem
function injFilter() {
  const q = norm(($('injSearch') || {}).value || ''); let n = 0;
  document.querySelectorAll('#injMine > li').forEach(li => { li.hidden = !!q && !li.dataset.n.includes(q); if (!li.hidden) n++; });
  document.querySelectorAll('#injTeams > .inj-team').forEach(g => {
    let k = 0; const tq = q && norm(g.dataset.t + ' ' + (TEAM_NICK[g.dataset.t] || '')).includes(q);
    g.querySelectorAll('li[data-n]').forEach(li => { const ok = q ? (tq || li.dataset.n.includes(q)) : !li.dataset.minor; li.hidden = !ok; if (ok) k++; });
    g.hidden = !k; n += k;
  });
  const none = document.querySelector('#plSub .inj-none'); if (none) none.hidden = !(q && !n);
  const zero = document.querySelector('#plSub .inj-zero'); if (zero) zero.hidden = !!q;
}
// ficha de um jogador que não está no plantel (forma, lesões, compras)
function catalogSheet(id) {
  const c = S.players.get(String(id)); if (!c) return;
  if ((S.mine.roster || {})[id]) { rosterSheet(id); return; }
  const avg = c.avg, fi = avg ? FB.formInfo({ avg }, 'pts') : null;
  openSheet('<h3>' + esc(c.name) + '</h3><div class="small muted">' + teamTag(c.team) + (c.gp ? ' · ' + c.gp + ' games this season' : '') + '</div>' + injuryBlock(String(id), null, null) +
    (avg ? '<div><div class="label" style="margin-bottom:6px">Averages per game</div><div class="kv sm">' + AVG_SHOW.map(k => { const a = FB.avgOf({ avg }, k); return a ? '<div><div class="label">' + STATS[k].short + (a.est ? '*' : '') + '</div><div class="v num">' + f1(a.v) + '</div></div>' : ''; }).join('') + '</div></div>' : '<div class="note info">No averages yet.</div>') +
    gamesTable(avg) +
    '<div class="btns">' + (S.runId ? '<button class="btn primary" type="button" data-action="buy-eval" data-id="' + esc(id) + '">See if it\'s worth buying</button>' : '<span></span>') + '<button class="btn" type="button" data-action="add-id" data-id="' + esc(id) + '">Add to roster</button></div>');
}
// ---- dicas de compra: refaz a run com cada candidato ----
function buyHtml() {
  const r = mainResult(), B = S.buy;
  if (!S.runId || !r || !r.model.days.length) return '<div class="note info">' + (S.runId ? 'The run has already finished.' : 'No runs yet.') + '</div>' + specHtml();
  return buyTipsCard(6) + '<div class="card panel"><h2>Look for buys ' + helpBtn('comprar') + '</h2>' +
    '<div class="seg acc-seg" role="group" aria-label="What to buy"><button type="button" data-action="buy-mode" data-mode="new" aria-pressed="' + (B.mode === 'new') + '">All</button><button type="button" data-action="buy-mode" data-mode="more" aria-pressed="' + (B.mode === 'more') + '">Upgrade yours</button></div>' +
    '<div><div class="label" style="margin-bottom:6px">Moment tier</div><div class="chips" role="group" aria-label="Moment tier">' + [1, 2, 4].map(n => '<button type="button" data-action="buy-uses" data-n="' + n + '" aria-pressed="' + (B.uses === n) + '">' + tierName(n) + ' · ' + plural(n, 'use', 'uses') + '</button>').join('') + '</div></div>' +
    (B.mode !== 'more' ? '<label class="small muted">Max price (optional, in $)<input class="field" id="buyMax" type="number" inputmode="decimal" min="0" step="1" placeholder="e.g. 6" value="' + (B.max || '') + '" autocomplete="off"></label>' : '') +
    '<button class="btn primary" type="button" data-action="buy-run">' + (B.mode === 'new' ? 'Find the best buys' : 'See who is worth upgrading') + '</button>' +
    '<label class="small muted">Check a player<input class="field" id="buySearch" type="search" placeholder="Name, e.g. Curry…" autocomplete="off"></label><div id="buyFound" class="search-list" hidden></div></div>' +
    '<div id="buyOut" class="stack">' + (B.results ? buyResultsHtml(B.results) : '') + '</div>' + specHtml();
}
// ---- Especialistas: os melhores da NBA em cada estatística (época atual misturada com a passada) ----
S.spec = { stat: null };
const SPEC_STATS = ['fg3', 'reb', 'ast', 'stl', 'blk', 'oreb', 'pts', 'dreb', 'tov', 'fgm', 'fg3a', 'ftm', 'pip'];
function specHtml() {
  if (!S.hist) setTimeout(loadHistory, 0);
  const F = statFrequency(), today = todayET();
  const freq = {}; ((F && F.stats) || []).forEach(e => FB.statTerms(e.stat).forEach(t => { if (t.sign > 0) freq[t.s] = (freq[t.s] || 0) + e.n; }));
  const runDays = {}; S.days.forEach((d, i) => { if (d.date < today) return; (d.objectives || []).forEach(o => { if (o && o.stat) FB.statTerms(o.stat).forEach(t => { if (t.sign > 0 && SPEC_STATS.includes(t.s)) (runDays[t.s] = runDays[t.s] || []).push(i + 1); }); }); });
  const order = SPEC_STATS.map((k, i) => [k, i]).sort((a, b) => ((freq[b[0]] || 0) - (freq[a[0]] || 0)) || (a[1] - b[1])).map(x => x[0]);
  const nd = S.days.find(d => d.date >= today && (d.objectives || []).some(o => o && o.stat && FB.statTerms(o.stat).some(t => SPEC_STATS.includes(t.s))));
  const def = nd ? FB.statTerms(nd.objectives.find(o => o && o.stat).stat).map(t => t.s).find(s => SPEC_STATS.includes(s)) : null;
  const stat = S.spec.stat && SPEC_STATS.includes(S.spec.stat) ? S.spec.stat : def || order[0];
  const total = Object.values(freq).reduce((a, b) => a + b, 0);
  const pool = [...S.players.values()].filter(p => p.team && p.avg && (+p.avg.min || 0) >= 12);
  const val = (p, s) => { const a = FB.avgOf({ avg: p.avg }, s); return a ? a.v : null; };
  const ranked = pool.map(p => ({ p, v: val(p, stat) })).filter(x => x.v != null && x.v > 0).sort((a, b) => b.v - a.v);
  const ptsRank = new Map(pool.map(p => ({ id: p.id, v: val(p, 'pts') || 0 })).sort((a, b) => b.v - a.v).map((x, i) => [x.id, i + 1]));
  const disp = ranked.slice(0, 80).map(x => ((x.p.avg.hist || {}).d || {})[stat]).filter(x => x > 0), dMed = median(disp);
  const rank = new Map(ranked.map((x, i) => [x.p.id, i + 1]));
  const top = ranked.filter(x => S.spec.scope !== 'new' || !(S.mine.roster || {})[x.p.id]).slice(0, 15), u = esc(statShort(stat));
  // intervalo de cada um: o mais baixo e o mais alto dos últimos jogos (≥ 3) ou, sem jogos, a média ± o desvio da época passada
  const gv = (g, k) => { const v = j => g[2 + GK.indexOf(j)]; if (k === 'dreb') return v('reb') != null && v('oreb') != null ? v('reb') - v('oreb') : null; return GK.includes(k) ? v(k) : null; };
  const rangeOf = x => {
    const vals = ((((x.p.avg || {}).form) || {}).games || []).map(g => gv(g, stat)).filter(v => v != null);
    if (vals.length >= 3) return { lo: Math.min(...vals), hi: Math.max(...vals), txt: Math.min(...vals) + '–' + Math.max(...vals) + ' in the last ' + vals.length + ' games' };
    const d = (((x.p.avg || {}).hist || {}).d || {})[stat]; if (!(d > 0)) return null;
    const sd = Math.sqrt(d * x.v); return { lo: Math.max(0, x.v - sd), hi: x.v + sd, txt: 'usually ' + f0(Math.max(0, x.v - sd)) + '–' + f0(x.v + sd) };
  };
  const rgs = new Map(top.map(x => [x.p.id, rangeOf(x)])), sc = Math.max(1, ...top.map(x => Math.max(x.v, (rgs.get(x.p.id) || {}).hi || 0))) * 1.05;
  const rows = top.map(x => {
    const p = x.p, i = rank.get(p.id) - 1, rg = rgs.get(p.id), pr = ptsRank.get(p.id) || 999, d = ((p.avg.hist || {}).d || {})[stat], ir = injRec(p.id);
    const reg = d > 0 && dMed ? (d <= dMed * 0.85 ? '<span class="badge" title="Varies little from game to game (last season)">consistent</span>' : d >= dMed * 1.2 ? '<span class="pill duv" title="Varies a lot from game to game (last season)">streaky</span>' : '') : '';
    const spec = stat !== 'pts' && i < 30 && pr > 75 ? '<span class="pill ok" title="At the top of this stat but outside the 75 best scorers">specialist</span>' : '';
    return '<li><button class="row spec-row" type="button" data-action="pform" data-id="' + esc(p.id) + '"><span class="who">' + face(p.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + (i + 1) + '. ' + esc(p.name) + '</span>' + spec + reg + (ir ? '<span class="pill ' + INJ_PILL[ir.status] + '">' + INJ_SHORT[ir.status] + '</span>' : '') + '</div>' +
      '<div class="ps">' + teamTag(p.team) + (stat !== 'pts' ? ' · ' + ord(pr) + ' in PTS' : '') + '</div>' +
      (rg ? '<div class="sp-rng" aria-hidden="true"><i class="r" style="left:' + (rg.lo / sc * 100).toFixed(1) + '%;width:' + Math.max(1.5, (rg.hi - rg.lo) / sc * 100).toFixed(1) + '%"></i><i class="m" style="left:' + (x.v / sc * 100).toFixed(1) + '%"></i></div><div class="ps sp-txt">' + rg.txt + '</div>' : '') +
      '</div></span><div class="pv"><div class="v num">' + f1(x.v) + '</div><div class="u">' + u + '</div></div></button></li>';
  }).join('');
  const rd = runDays[stat];
  return '<div class="card"><div class="list-head"><h2>Specialists ' + helpBtn('especialistas') + '</h2><span class="small muted">per game</span></div>' +
    '<div class="chips" role="group" aria-label="Stat" style="padding:0 14px 8px">' + order.map(k => '<button type="button" data-action="spec-stat" data-v="' + k + '" aria-pressed="' + (k === stat) + '">' + esc(statShort(k)) + (runDays[k] ? ' ●' : '') + '</button>').join('') + '</div>' +
    '<div class="seg acc-seg" role="group" aria-label="Which players" style="margin:0 14px 8px"><button type="button" data-action="spec-scope" data-v="all" aria-pressed="' + (S.spec.scope !== 'new') + '">All</button><button type="button" data-action="spec-scope" data-v="new" aria-pressed="' + (S.spec.scope === 'new') + '">The ones you don\'t have</button></div>' +
    (rd ? '<div class="row small muted" style="display:block"><b>In this run:</b> ' + u + (rd.length === 1 ? ' on day ' : ' on days ') + spans(rd) + '</div>' : '') +
    (rows ? '<ul class="list">' + rows + '</ul>' : '<div class="row small muted" style="display:block">No averages yet.</div>') + '</div>';
}
function renderBuySearch(qs) {
  const box = $('buyFound'); if (!box) return;
  box.hidden = !String(qs || '').trim();
  if (box.hidden) { box.innerHTML = ''; return; }
  box.innerHTML = searchPlayers(qs, 6).map(p => '<div class="row"><span class="who">' + face(p.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span></div><div class="ps">' + esc(p.team || '—') + (S.mine.roster[p.id] ? ' · you own him (' + plural(perRunUses(p.id), 'use', 'uses') + ' per run)' : '') + '</div></div></span><button class="btn small" type="button" data-action="buy-pick" data-id="' + esc(p.id) + '">Evaluate</button></div>').join('') || '<div class="row muted small">No player with that name.</div>';
}
// plano refeito com o plantel mudado (mod), da mesma maneira que o plano que vês: conta principal, ou o plano
// conjunto com as smurf
function planWith(mod, kicks) {
  if (!S.multi) { const y = engineInputs('main'); mod(y.roster.players); const r2 = FB.planRun(y.run, y.roster, y.odds, y.plan, engOpts()); return { res: r2.normal, total: r2.normal.objective }; }
  const base = engineInputs('main');
  const list = accounts().map(a => { const y = a.id === 'main' ? base : engineInputs(a.id); const ro = clone(y.roster); mod(ro.players); return { key: a.id, roster: ro, plan: y.plan }; });
  const g = FB.planGroup(base.run, list, base.odds, Object.assign(engOpts(), kicks != null ? { kicks } : {}));
  return { res: g.byKey.main.normal, total: g.objective, group: g };
}
// o plano atual (o que está no ecrã) serve de base para comparar
const planNow = () => (S.multi ? { res: S.multi.byKey.main.normal, total: S.multi.objective, group: S.multi } : { res: mainResult().normal, total: mainResult().normal.objective });
const tick = ms => new Promise(res => setTimeout(res, ms || 20));
// Melhores compras para a run: pré-seleção rápida e depois a run refeita com cada candidato.
// alive() a devolver false pára a meio; kicks (só com smurfs) faz um cálculo mais leve, comparado com uma base igual.
// usos por run que um jogador do plantel já tem (os do melhor Moment) e quantos ganha com um Moment de U usos:
// só sobe se o novo for de um escalão acima (uma Rare de quem tem um Common dá +1, não +2)
function perRunUses(id) {
  const e = S.mine.roster[id]; if (!e) return 0;
  if (e.tierUses != null) return +e.tierUses;
  const c = ((((S.profile || {}).collection) || {}).players || {})[id];
  const t = c && c.bySet ? tierUsesOf(S.profile.collection, c) : null;
  return t != null ? t : (+e.uses || 0) + usedCount('main', id);
}
const usesGain = (id, U) => (S.mine.roster[id] ? Math.max(0, U - perRunUses(id)) : U);
async function computeBuy({ onlyId, ids, mode, U, topN, alive, prog, kicks, refineN, maxPrice }) {
  const r = mainResult(); if (!r || !r.model.days.length) return null;
  const owned = id => !!S.mine.roster[id];
  let pool;
  if (onlyId) pool = [String(onlyId)];
  else if (ids) pool = ids.map(String); // "Testar mais": estes, já escolhidos
  else if (mode === 'new' || mode === 'mix') {
    const teams = new Set(); r.model.days.forEach(md => { if (md.objs.length) md.teams.forEach(t => teams.add(t)); });
    // jogadores novos e também um Moment de escalão acima de quem já tens (p. ex. um Rare de quem só tem um Common)
    pool = [...S.players.values()].filter(p => p.team && p.avg && teams.has(p.team) && (!owned(p.id) || (r.model.pIndex.get(String(p.id)) != null && usesGain(p.id, U) > 0))).map(p => String(p.id));
    // com smurfs: também um 2.º Moment de quem só tens um (para as duas contas o usarem na mesma noite)
    if (mode === 'mix') pool = [...new Set(pool.concat(Object.keys(S.mine.roster).filter(id => r.model.pIndex.get(id) != null && collectionInfo(id).copies === 1)))];
  } else pool = Object.keys(S.mine.roster).filter(id => r.model.pIndex.get(id) != null && (usesGain(id, U) > 0 || (S.multi && collectionInfo(id).copies === 1)));
  // com os preços do Top Shot lidos: fora quem não tem um Moment desse escalão à venda
  let unsold = 0;
  if (!onlyId && !ids && pxReady()) { const n0 = pool.length; pool = pool.filter(id => buyable(id, U)); unsold = n0 - pool.length; }
  // preço máximo: só quem tem um Moment desse escalão à venda até esse preço (mercado do Top Shot)
  let priced = null;
  if (maxPrice > 0 && !onlyId && !ids) { if (prog) prog('Checking marketplace prices…'); if ((await mktLoad(pool)) || pxIndex().size) { priced = pool.length; pool = pool.filter(id => { const p = mktOf(id, U); return p && p.ask != null && p.ask <= maxPrice; }); } }
  if (!pool.length) return { list: [], U, mode, base: null, single: !!onlyId, noPool: true, priced, maxPrice, unsold };
  // compra: jogador novo com U usos (fica na conta principal), ou mais U usos (e mais um Moment) para quem já tens
  const add = id => pl => {
    if (pl[id]) { pl[id].uses = (+pl[id].uses || 0) + usesGain(id, U); pl[id].copies = (pl[id].copies || 1) + 1; pl[id].owner = null; }
    else { const c = S.players.get(String(id)) || {}; pl[id] = { name: c.name || id, team: c.team || '', uses: U, status: 'ok', avg: c.avg || null, copies: 1, owner: 'main' }; }
  };
  const accs = S.multi ? accounts().map(a => a.id) : ['main'];
  let shortlist = pool, rank = null;
  if (!ids && pool.length > 1) {
    // 1.ª peneira (todos): o ganho direto de cada um no dia em que mais ajuda, com o plano atual
    const score = {};
    accs.forEach(k => {
      const x = engineInputs(k), wide = clone(x.roster), rk = S.multi ? S.multi.byKey[k] : r; if (!rk) return;
      pool.forEach(id => add(id)(wide.players));
      const mw = FB.buildModel(x.run, wide, x.odds, x.plan, engOpts());
      FB.buyScreen(mw, rk.normal, pool.map(id => mw.pIndex.get(id)).filter(i => i != null), U).forEach(z => { score[z.id] = (score[z.id] || 0) + z.score; });
    });
    const pre = Object.entries(score).filter(([, v]) => v > 1e-5).sort((a, b) => b[1] - a[1]).slice(0, refineN || 120).map(([id]) => id);
    // 2.ª peneira (os melhores da 1.ª): a run de cada um refeita com trocas simples a partir do plano atual, o que
    // já conta os usos que ele liberta a outros jogadores (no outro fio, o ecrã não congela)
    const gain = {};
    if (pre.length > topN) {
      if (prog) prog('Comparing the ' + pre.length + ' most promising (of ' + pool.length + ')…');
      for (const k of accs) {
        if (alive && !alive()) return null;
        const x = engineInputs(k), wide = clone(x.roster), rk = S.multi ? S.multi.byKey[k] : r; if (!rk) continue;
        pre.forEach(id => add(id)(wide.players));
        try { (await engineCall('buyRank', [x.run, wide, x.roster, x.odds, x.plan, { days: rk.normal.days.map(d => ({ date: d.date, lineup: d.lineup })) }, pre, engOpts()])).forEach(z => { gain[z.id] = (gain[z.id] || 0) + z.gain; }); }
        catch (e) { console.warn('purchases: 2nd pass', e); }
      }
    }
    rank = pre.slice().sort((a, b) => ((gain[b] || 0) - (gain[a] || 0)) || (score[b] - score[a]));
    shortlist = rank.slice(0, topN);
  }
  const list = [];
  let base = null;
  if (shortlist.length) {
    base = kicks != null && S.multi ? await planWithAsync(() => {}, kicks) : planNow();
    for (let k = 0; k < shortlist.length; k++) {
      if (alive && !alive()) return null;
      const id = shortlist[k];
      if (prog) prog('Redoing the run with ' + nameOf(id) + '… ' + (k + 1) + ' of ' + shortlist.length);
      await tick();
      if (alive && !alive()) return null;
      try { list.push({ id, ev: await planWithAsync(add(id), kicks) }); } catch (e) { console.warn(e); }
    }
  }
  list.sort((a, b) => b.ev.total - a.ev.total);
  return { list, U, mode, base, single: !!onlyId, rank, pool: pool.length, unsold, maxPrice: priced != null ? maxPrice : null };
}
async function buyRun(onlyId) {
  const B = S.buy, out = $('buyOut'); if (!out) return;
  const mode = onlyId ? (S.mine.roster[onlyId] ? 'more' : 'new') : B.mode;
  out.innerHTML = '<div class="small muted" id="buyProg">Picking candidates…</div>';
  await tick(30);
  const mx = parseFloat(String((($('buyMax') || {}).value) || B.max || '').replace(',', '.')); B.max = mx > 0 ? mx : null;
  const res = await computeBuy({ onlyId, mode, U: B.uses, maxPrice: B.max, topN: S.multi ? 5 : 8, alive: () => !!$('buyOut'), prog: t => { const el = $('buyProg'); if (el) el.textContent = t; } });
  if (!res || !$('buyOut')) return;
  if (res.noPool) { $('buyOut').innerHTML = '<div class="note info">' + (res.priced != null ? 'No ' + tierName(B.uses) + ' with games in the remaining days is listed up to ' + usd(res.maxPrice) + '. Raise the max price.' : mode === 'more' ? 'Nobody in your roster gains uses with a ' + tierName(B.uses) + (res.unsold ? ' that is for sale' : '') + '. Try a tier higher.' : res.unsold ? 'None of the candidates has a ' + tierName(B.uses) + ' for sale.' : 'There are no candidates with games in the remaining days.') + '</div>'; return; }
  if (onlyId && S.mine.roster[onlyId] && !usesGain(onlyId, B.uses) && !(S.multi && collectionInfo(onlyId).copies === 1)) { $('buyOut').innerHTML = '<div class="note info">You already have ' + esc(nameOf(onlyId)) + ' with ' + plural(perRunUses(onlyId), 'use', 'uses') + ' per run: pick a tier higher.</div>'; return; }
  B.results = res;
  $('buyOut').innerHTML = buyResultsHtml(res);
}
// "Testar mais": a run refeita a sério com os seguintes da lista (pela ordem das peneiras)
async function buyMore() {
  const B = S.buy, R = B.results; if (!R || !R.rank || B.moreBusy) return;
  const seen = new Set(R.list.map(x => String(x.id)).concat(R.skip || [])), next = R.rank.filter(id => !seen.has(id)).slice(0, S.multi ? 5 : 8);
  if (!next.length) return;
  B.moreBusy = true;
  const el = $('buyMoreBox'); if (el) el.innerHTML = '<div class="small muted" id="buyMoreProg">Redoing the run…</div>';
  try {
    const res = await computeBuy({ ids: next, mode: R.mode, U: R.U, topN: next.length, alive: () => !!$('buyOut') && B.results === R, prog: t => { const p = $('buyMoreProg'); if (p) p.textContent = t; } });
    if (!res || B.results !== R) return;
    R.list = R.list.concat(res.list).sort((a, b) => b.ev.total - a.ev.total);
    R.skip = (R.skip || []).concat(next.filter(id => !res.list.some(x => String(x.id) === id)));
  } finally { B.moreBusy = false; }
  if ($('buyOut') && B.results === R) $('buyOut').innerHTML = buyResultsHtml(R);
}
// nome do escalão pelos usos do Moment a comprar (Common 1, Rare 2, Legendary 4)
const tierName = n => (n === 1 ? 'Common' : n === 2 ? 'Rare' : n === 3 ? 'Rare+' : n === 4 ? 'Legendary' : n + ' uses');
const tierTxt = n => ([1, 2, 3, 4].includes(n) ? tierName(n) + ' (' + n + ' use' + (n > 1 ? 's' : '') + ')' : n + ' uses');
// Sugestões de compra calculadas sozinhas (jogadores novos, Moment Rare = 2 usos), para Hoje e Run
S.autoBuy = null;
let autoBuyTimer = null, autoBuyBusy = null;
function autoBuyKey() {
  const r = mainResult(), run = curRun();
  if (!S.runId || !run || !r || !r.model.days.length || !Object.keys(S.mine.roster || {}).length || !S.players.size) return null;
  return [S.runId, Object.keys(S.mine.roster).length, S.injAt || '', S.pxMine && S.pxMine.at || '', Object.keys(curPlan().played || {}).length, r.normal.objective.toFixed(3), S.multi ? S.multi.objective.toFixed(3) : ''].join('|');
}
// as sugestões só se refazem quando muda o plantel, as lesões, os preços ou os dias jogados; se só mexeu o plano
// (odds novas, ao vivo), no máximo de 15 em 15 min. Entretanto ficam as anteriores à vista.
const autoBuyStable = k => String(k || '').split('|').slice(0, 5).join('|');
// ---- Procurar um plano melhor (em segundo plano, no outro fio) ----
// A pesquisa do plano muda um jogador de cada vez e pára quando nenhuma troca sozinha ajuda; às vezes há planos
// melhores que só aparecem mudando várias coisas juntas (fixar alguém num dia e refazer o resto). Aqui faz-se isso
// sozinho: para os próximos dias, fixa um a um os melhores que estão de fora e refaz a run; se a run ficar melhor,
// esse plano passa a ser o ponto de partida do cálculo (plan.hint) e a sugestão melhora.
let impKey = null, impBusy = false, impTimer = null, impWait = null;
const IMP_DAYS = 6, IMP_CAND = 3;
function improveKey() { return calcKey && S.result && !S.calcError ? calcKey : null; }
function scheduleImprove() {
  const key = improveKey();
  if (!key || impBusy || impKey === key || impWait === key || document.visibilityState !== 'visible') return;
  const nd = nextDay(); if (nd && liveOn(nd.date)) return; // durante os jogos o plano muda a cada minuto
  clearTimeout(impTimer); impWait = key;
  impTimer = setTimeout(() => { impWait = null; if (improveKey() === key && !impBusy) improveRun(key); }, 8000);
}
// o plano melhor encontrado: passa a ser o ponto de partida do cálculo (a sugestão do plano muda para ele)
function useBetter() {
  const B = S.better; if (!B) return;
  S.mine.plan.hint = { run: S.runId, at: new Date().toISOString(), acc: B.acc };
  Object.entries(B.acc || {}).forEach(([k, days]) => { const h = holdOn(k), ids = h && days[h.d]; if (!ids || !ids.length) return;
    const outs = h.ids.filter(id => !ids.includes(id)), ins = ids.filter(id => !h.ids.includes(id)); if (!outs.length && !ins.length) return;
    holdLog(k, h.d, { k: 'mine', outs, ins, prev: h.ids.slice(), ids: ids.slice() }); planOf(k).hold = { d: h.d, ids: ids.slice() }; });
  S.better = null; saveMine(); schedule();
  toast('Better plan applied.');
}
function betterCard() {
  const B = S.better; if (!B || B.key !== improveKey() || !B.changes.length) return '';
  const multi = !!S.multi, gain = B.e1 - B.e0;
  const rows = B.changes.slice(0, 5).map(c => '<li class="row lu-ch"><span><b>Day ' + (c.idx + 1) + '</b>' + (multi ? ' · ' + esc(accLabel(c.k)) : '') + ' ' + pct(c.P0) + ' → <b class="' + (c.P1 >= c.P0 ? 'up' : 'down') + '">' + pct(c.P1) + '</b>' +
    (c.outs.length ? ' · out ' + c.outs.map(id => esc(lastName(id))).join(', ') : '') + (c.ins.length ? ' · in ' + c.ins.map(id => esc(lastName(id))).join(', ') : '') + '</span></li>').join('');
  return '<div class="card better"><div class="list-head"><h2>There is a better plan</h2><span class="small muted">expected wins ' + f1(B.e0) + ' → <b class="up">' + f1(B.e1) + '</b></span></div>' +
    '<div class="small muted" style="padding:0 16px">Found by trying several player swaps at once. Nothing changes unless you want it to.</div>' +
    '<ul class="list">' + rows + (B.changes.length > 5 ? '<li class="row small muted" style="display:block">and ' + plural(B.changes.length - 5, 'day', 'days') + '</li>' : '') + '</ul>' +
    '<div class="foot"><button class="btn primary" type="button" data-action="better-use">Use this plan</button><button class="btn" type="button" data-action="better-no">Ignore</button></div></div>';
}
async function improveRun(key) {
  impBusy = true; impKey = key;
  try {
    const multi = !!S.multi, accs = multi ? accounts().map(a => a.id) : ['main'];
    const baseTotal = multi ? S.multi.objective : S.result.normal.objective;
    const expOf = out => multi ? Object.values(out.group.byKey).reduce((t, g) => t + (g.normal.expected || 0) + (g.wins || 0), 0) : (out.res.expected || 0) + (S.result.wins || 0);
    const baseExp = multi ? Object.values(S.multi.byKey).reduce((t, g) => t + (g.normal.expected || 0) + (g.wins || 0), 0) : (S.result.normal.expected || 0) + (S.result.wins || 0);
    // experiências: conta × dia (os próximos, ainda por começar) × os melhores que estão de fora nesse dia
    const exps = [];
    accs.forEach(acc => {
      const R = multi ? S.multi.byKey[acc] : S.result; if (!R) return;
      R.normal.days.slice(0, IMP_DAYS).forEach((d, i) => {
        const md = R.model.days[i]; if (!md || md.day.date !== d.date) return;
        const tip = firstTipOf(md.day); if (tip != null && Date.now() >= tip - 10 * 60e3) return;
        const locks = ((planOf(acc).locks || {})[d.date]) || [], bans = ((planOf(acc).bans || {})[d.date]) || [];
        if (locks.length >= md.size) return;
        const w = pi => md.objs.reduce((t, _, k) => t + (md.mu[pi][k] || 0) / (md.T[k] || 1), 0);
        md.elig.filter(pi => { const id = R.model.players[pi].id; return !d.lineup.includes(id) && !bans.includes(id) && (R.model.uses[pi] || 0) > 0; })
          .sort((a, b) => w(b) - w(a)).slice(0, IMP_CAND).forEach(pi => exps.push({ acc, date: d.date, id: R.model.players[pi].id }));
      });
    });
    let best = null;
    for (const x of exps) {
      // com uma folha aberta ou sugestões de compra a calcular, espera (o outro fio fica livre para o que estás a ver)
      while ((!$('sheet').hidden || autoBuyBusy) && improveKey() === key) await tick(1500);
      if (improveKey() !== key || document.visibilityState !== 'visible') { impKey = null; return; } // mudou alguma coisa: recomeça depois
      const run = S.runs.find(r => r.id === S.runId) || {}, base = engineInputs('main');
      const lockIn = plan => { plan.locks = plan.locks || {}; plan.locks[x.date] = ((plan.locks[x.date]) || []).concat([x.id]); };
      let out;
      try {
        if (!multi) { const plan = clone(base.plan); modCap(lockIn, plan); out = await engineCall('planRun', [base.run, base.roster, base.odds, plan, engOpts()]); }
        else {
          const list = accs.map(a => { const y = a === 'main' ? base : engineInputs(a); let plan = y.plan; if (a === x.acc) { plan = clone(plan); modCap(lockIn, plan); } return { key: a, roster: y.roster, plan }; });
          out = await engineCall('planGroup', [base.run, list, base.odds, engOpts()], 'main');
        }
      } catch (e) { continue; }
      if (out && out.total > (best ? best.total : baseTotal) + 1e-6 * Math.max(1, Math.abs(baseTotal))) best = { total: out.total, out, x };
      await tick(150);
    }
    window.FB_IMP = { exps: exps.length, found: !!best };
    if (best && improveKey() === key) {
      // não muda nada sozinho: fica como sugestão na Jornada (Usar este plano / Ignorar)
      const acc = {}, changes = [];
      const lineups = multi ? Object.fromEntries(Object.entries(best.out.group.byKey).map(([k, g]) => [k, g.normal])) : { main: best.out.res };
      Object.entries(lineups).forEach(([k, n]) => { acc[k] = {}; const cur = multi ? S.multi.byKey[k].normal : S.result.normal;
        n.days.forEach(d => { acc[k][d.date] = d.lineup.slice(); const c = cur.days.find(y => y.date === d.date); if (!c) return;
          const ins = d.lineup.filter(x => !c.lineup.includes(x)), outs = c.lineup.filter(x => !d.lineup.includes(x));
          if (ins.length || outs.length) changes.push({ k, date: d.date, idx: d.idx, ins, outs, P0: c.P, P1: d.P }); }); });
      S.better = { key, acc, changes, e0: baseExp, e1: expOf(best.out), at: Date.now() };
      if (S.tab === 'hoje') render();
    }
  } catch (e) { console.warn('procurar plano melhor', e); }
  finally { impBusy = false; }
}
function scheduleAutoBuy() {
  const key = autoBuyKey();
  if (!key || (S.autoBuy && S.autoBuy.key === key) || autoBuyBusy === key) return;
  if (S.autoBuy && autoBuyStable(S.autoBuy.key) === autoBuyStable(key) && Date.now() - (S.autoBuy.at || 0) < 15 * 60e3) return;
  clearTimeout(autoBuyTimer);
  autoBuyTimer = setTimeout(async () => {
    if (autoBuyKey() !== key || document.visibilityState !== 'visible') return;
    autoBuyBusy = key;
    try {
      const res = await computeBuy({ mode: S.multi ? 'mix' : 'new', U: 2, topN: S.multi ? 4 : 6, alive: () => autoBuyKey() === key, kicks: S.multi ? 10 : null });
      if (res && autoBuyKey() === key) { S.autoBuy = Object.assign({ key, at: Date.now() }, res); S.autoBuyErr = null; autoBuyBusy = null; /* antes de desenhar: senão fica "a atualizar…" */ if (S.tab === 'hoje' || S.tab === 'run' || (S.tab === 'plantel' && subOf('plantel') === 'comprar')) render(); }
    } catch (e) { console.warn('sugestões de compra', e); S.autoBuyErr = key; render(); }
    finally {
      if (autoBuyBusy === key) {
        autoBuyBusy = null;
        // parou a meio (mudou o plano): tira o "a atualizar…" dos cartões que estão à vista
        if ((S.tab === 'hoje' || S.tab === 'run' || (S.tab === 'plantel' && subOf('plantel') === 'comprar'))) render();
      }
    }
  }, S.multi ? 6000 : 2500);
}
// resumo de uma compra: o prémio que mais sobe, as vitórias esperadas e os dias em que passa a jogar
function buySummary(R, x) {
  const prizes = mainResult().prizes, keys = R.base.group ? R.base.group.keys : ['main'], id = String(x.id);
  const resOf = (ev, k) => (ev.group ? ev.group.byKey[k].normal : ev.res);
  let best = null;
  prizes.forEach((p, i) => keys.forEach(k => { const b = resOf(R.base, k).prizeProbs[i], a = resOf(x.ev, k).prizeProbs[i]; if (!best || a - b > best.dl) best = { k, p, dl: a - b, from: b, to: a }; }));
  const wk = k => (R.base.group ? R.base.group.byKey[k].wins : mainResult().wins) || 0;
  const e0 = keys.reduce((t, k) => t + wk(k) + resOf(R.base, k).expected, 0), e1 = keys.reduce((t, k) => t + wk(k) + resOf(x.ev, k).expected, 0);
  const days = new Set();
  keys.forEach(k => { const bd = new Map(resOf(R.base, k).days.map(d => [d.date, d])); resOf(x.ev, k).days.forEach(d => { const b0 = bd.get(d.date); if (d.lineup.includes(id) && !(b0 && b0.lineup.includes(id))) days.add(d.idx + 1); }); });
  const byPrize = !!best && Math.round(best.to * 100) - Math.round(best.from * 100) >= 1;
  return { id, best, e0, e1, byPrize, worth: byPrize || e1 - e0 >= 0.15, days: [...days].sort((a, b) => a - b), multi: keys.length > 1 };
}
// uma compra numa linha: cara, nome, equipa e dias, preço; à direita a chance nova do prémio que mais sobe (grande)
// e por baixo quanto sobe e quanto era. Tocar abre os detalhes.
function buyRow(R, t, i, src) {
  const c = S.players.get(t.id) || {}, own = !!S.mine.roster[t.id], g = usesGain(t.id, R.U);
  const tn = tierName(R.U), badge = '<span class="tpill t-' + (TIER_CLS[tn] || 'r') + '">' + tn + '</span>' + (own ? '<span class="badge">' + (g > 0 ? '+' + plural(g, 'use', 'uses') : '2nd Moment') + '</span>' : '');
  const sub = teamTag(c.team) + (t.days.length ? ' · plays ' + (t.days.length > 1 ? 'days ' : 'day ') + t.days.join(', ') : '');
  const right = t.byPrize
    ? '<span class="bg-top">' + t.best.p.wins + ' wins' + (t.multi ? ' · ' + esc(accLabel(t.best.k)) : '') + '</span><span class="bg-big up">' + pct(t.best.to) + '</span><span class="bg-was"><b class="up">▲ ' + (Math.round(t.best.to * 100) - Math.round(t.best.from * 100)) + '</b> · was ' + pct(t.best.from) + '</span>'
    : '<span class="bg-top">expected</span><span class="bg-big' + (t.worth ? ' up' : ' muted') + '">' + f1(t.e1) + '</span><span class="bg-was">' + (t.worth ? '<b class="up">▲ ' + f1(t.e1 - t.e0) + '</b> · ' : '') + 'was ' + f1(t.e0) + '</span>';
  return '<li><button class="row buy-row" type="button" data-action="buy-detail" data-id="' + esc(t.id) + '" data-src="' + src + '"><span class="who">' + face(t.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + (i + 1) + '. ' + esc(c.name || nameOf(t.id)) + '</span></div><div class="ps buy-tags">' + badge + '</div><div class="ps">' + sub + '</div><div class="ps">' + mktSpan(t.id, R.U) + '</div></div></span><span class="bg">' + right + '</span></button></li>';
}
// detalhes de uma compra (folha): o que muda na run, dia a dia e nos prémios, e o preço
function buyDetailSheet(src, id) {
  const R = src === 'auto' ? S.autoBuy : S.buy.results, x = R && R.list.find(z => String(z.id) === String(id)); if (!x) return;
  openSheet(buyResultsHtml(Object.assign({}, R, { list: [x], single: true, detail: true })) + '<button class="btn" type="button" data-action="buy-player" data-id="' + esc(id) + '" data-src="' + src + '">Player sheet</button>');
}
// lista curta de sugestões (Hoje e Run)
function buyTipsCard(limit, jornada) {
  const A = S.autoBuy, key = autoBuyKey();
  if (!key) return '';
  const head = '<div class="list-head"><h2>' + (jornada ? 'Best buys' : 'The Rares worth the most') + '</h2><span class="small muted">' + (autoBuyBusy ? 'updating…' : 'Rare Moment') + '</span></div>';
  if (S.autoBuyErr === key) return '<div class="card">' + head + '<div class="row small muted" style="display:block">Couldn’t calculate. <button class="btn link small" type="button" data-action="buy-retry">Try again</button></div></div>';
  if (!A) return '<div class="card">' + head + '<div class="row small muted" style="display:block">Testing each Rare in your run…</div></div>';
  // os melhores primeiro, mesmo os que mudam pouco (assim vês sempre qual é o Rare que mais compensa)
  const tips = A.list.map(x => buySummary(A, x)).slice(0, limit);
  if (!tips.length) return '<div class="card">' + head + '<div class="row small muted" style="display:block">' + (A.noPool ? 'There are no candidates with games in the remaining days.' : 'No Rare changes your run.') + '</div></div>';
  return '<div class="card">' + head + '<ul class="list">' + tips.map((t, i) => buyRow(A, t, i, 'auto')).join('') +
    '</ul>' + (jornada ? '<button class="btn link small buy-more-link" type="button" data-action="goto" data-tab="plantel" data-sub="comprar">See more buys ›</button>' : '') + '</div>';
}
function buyResultsHtml(R) {
  const usesTxt = n => n + ' use' + (n > 1 ? 's' : '');
  if (!R.list.length) return '<div class="note info">' + (R.single ? 'He doesn’t play on the remaining days (or has no averages).' : 'No ' + tierTxt(R.U) + ' changes your run.') + '</div>';
  const prizes = mainResult().prizes, keys = R.base.group ? R.base.group.keys : ['main'], multi = keys.length > 1;
  const resOf = (ev, k) => (ev.group ? ev.group.byKey[k].normal : ev.res);
  const seen = new Set(R.list.map(x => String(x.id)).concat(R.skip || [])), left = R.rank ? R.rank.filter(id => !seen.has(id)).length : 0;
  const intro = R.single || !R.rank ? '' : '<div class="small muted buy-intro">Looked at the ' + R.pool + ' players with games in the remaining days' + (R.maxPrice ? ' and a ' + tierName(R.U) + ' listed up to ' + usd(R.maxPrice) : '') + ' and fully re-ran the run with the ' + R.list.length + ' most promising.' + (R.unsold ? ' Left out ' + R.unsold + ' with no ' + tierName(R.U) + ' for sale.' : '') + '</div>';
  const moreBtn = left ? '<div id="buyMoreBox"><button class="btn" type="button" data-action="buy-more">Test the next ' + Math.min(left, S.multi ? 5 : 8) + '</button></div>' : '';
  const andList = a => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '');
  const pp = x => Math.round(x * 100);
  if (!R.single) return intro + '<div class="card"><ul class="list">' + R.list.map((x, n) => buyRow(R, buySummary(R, x), n, 'res')).join('') + '</ul></div>' + moreBtn;
  return R.list.map((x, n) => {
    const id = String(x.id), c = S.players.get(id) || {}, more = R.mode === 'more' || !!S.mine.roster[id];
    // dias em que passa a jogar (que antes não jogava), com a vitória desse dia antes → depois, por conta
    const byDay = new Map();
    keys.forEach(k => {
      const bd = new Map(resOf(R.base, k).days.map(d => [d.date, d]));
      resOf(x.ev, k).days.forEach(d => { const b0 = bd.get(d.date); if (!d.lineup.includes(id) || (b0 && b0.lineup.includes(id))) return; (byDay.get(d.date) || byDay.set(d.date, { d, acc: [] }).get(d.date)).acc.push({ k, P0: b0 ? b0.P : null, P1: d.P }); });
    });
    const days = [...byDay.values()].sort((p, q) => p.d.date.localeCompare(q.d.date));
    // prémios que mudam (pelo menos 1 pp)
    let best = null; const moved = [];
    prizes.forEach((p, i) => keys.forEach(k => { const b = resOf(R.base, k).prizeProbs[i], a = resOf(x.ev, k).prizeProbs[i]; if (!best || a - b > best.dl) best = { k, p, dl: a - b, from: b, to: a }; if (Math.abs(pp(a) - pp(b)) >= 1) moved.push({ k, p, b, a }); }));
    const wk = k => (R.base.group ? R.base.group.byKey[k].wins : mainResult().wins) || 0; // vitórias já feitas
    const e0 = keys.reduce((t, k) => t + wk(k) + resOf(R.base, k).expected, 0), e1 = keys.reduce((t, k) => t + wk(k) + resOf(x.ev, k).expected, 0);
    const byPrize = best && pp(best.to) - pp(best.from) >= 1, worth = byPrize || e1 - e0 >= 0.15;
    const head = !worth ? '<div class="buy-gain muted">Not worth it: the run barely changes.</div>'
      : byPrize ? '<div class="buy-gain">' + best.p.wins + ' wins' + (multi ? ' (' + esc(accLabel(best.k)) + ')' : '') + ': ' + pct(best.from) + ' → <span class="up">' + pct(best.to) + '</span> <small>+' + (pp(best.to) - pp(best.from)) + ' pp</small></div>'
      : '<div class="buy-gain">Expected wins: ' + f1(e0) + ' → <span class="up">' + f1(e1) + '</span></div>';
    // só com um Moment dele é que o segundo deixa duas contas jogá-lo na mesma noite; com mais, o ganho são os usos
    const twoSame = multi && more && collectionInfo(id).copies === 1 && days.some(z => z.acc.length > 1);
    const why = !days.length ? 'Doesn’t play new days: frees up other players.'
      : (twoSame ? 'Two accounts can play him on the same day. ' : more ? (usesGain(id, R.U) ? 'With ' + usesTxt(usesGain(id, R.U)) + (multi ? ' in each account' : '') + ', ' : 'With a 2nd Moment (both accounts on the same night), ') : '') + (more && !twoSame ? 'he plays' : 'Plays') + (days.length > 1 ? ' on days ' : ' on day ') + andList(days.map(z => String(z.d.idx + 1))) + (keys.some(k => resOf(R.base, k).days.some(d => d.lineup.includes(id))) ? ' (on top of the ones he already played)' : '') + ':';
    const dayLines = days.map(z => { const day = S.days.find(q => q.date === z.d.date) || {};
      return '<li><b>Day ' + (z.d.idx + 1) + '</b> · ' + dWeek(z.d.date) + ' ' + dShort(z.d.date) + ' · ' + esc(objsText(day)) + ' — ' + z.acc.map(a => (multi ? esc(accLabel(a.k)) + ' ' : 'win ') + (a.P0 != null ? pct(a.P0) + ' → ' : '') + '<b>' + pct(a.P1) + '</b>').join(' · ') + '</li>'; }).join('');
    const tiers = [...new Set(moved.map(m => m.p.wins))];
    const prizeLine = tiers.length ? 'Prizes that change: ' + tiers.map(w => w + 'V ' + moved.filter(m => m.p.wins === w).map(m => (multi ? esc(accLabel(m.k)) + ' ' : '') + pct(m.b) + ' → ' + pct(m.a)).join(', ')).join(' · ') + '. ' : '';
    const tierLab = more ? 'Moment ' + tierName(R.U) + (usesGain(id, R.U) ? ', +' + usesTxt(usesGain(id, R.U)) : ', 2nd Moment') : 'Moment ' + tierTxt(R.U);
    if (R.detail) {
      // folha: cabeçalho, três caixas (prémio, vitórias esperadas, preço), dias novos e prémios que mudam
      const mk = mktOf(id, R.U);
      const tile = (lab, v, sub) => '<div class="bd-tile"><span class="label">' + lab + '</span><b>' + v + '</b><span class="small muted">' + sub + '</span></div>';
      const tiles = '<div class="bd-tiles">' +
        (byPrize ? tile('Prize', pct(best.from) + ' → <span class="up">' + pct(best.to) + '</span>', best.p.wins + ' wins' + (multi ? ' · ' + esc(accLabel(best.k)) : '')) : '') +
        tile('Expected wins', f1(e0) + ' → <span class="' + (e1 - e0 >= 0.15 ? 'up' : '') + '">' + f1(e1) + '</span>', multi ? 'all accounts' : 'in the run') +
        tile('Price', mk && mk.ask != null ? '<span class="up">' + usd(mk.ask) + '</span>' : '—', mk && mk.ask != null ? tierName(R.U) + ', cheapest' : mk && mk.ts ? 'no ' + tierName(R.U) + ' for sale' : 'not read yet') + '</div>';
      const prizeRows = tiers.length ? '<div class="label" style="margin-top:4px">Prizes that change</div><div class="bd-prizes">' + tiers.map(w => '<b>' + w + 'W</b><span>' + moved.filter(m => m.p.wins === w).map(m => (multi ? esc(accLabel(m.k)) + ' ' : '') + pct(m.b) + ' → <b class="' + (m.a > m.b ? 'up' : '') + '">' + pct(m.a) + '</b>').join(' · ') + '</span>').join('') + '</div>' : '';
      return '<div class="buy-detail stack"><div class="bd-head">' + face(id, 'lg') + '<div style="min-width:0"><h3>' + esc(nameOf(id)) + '</h3><div class="small muted">' + teamTag(c.team) + ' · ' + tierLab + '</div></div></div>' + (worth ? '' : '<div class="note">Not worth it: the run barely changes.</div>') + tiles +
        '<div><div class="label">' + (days.length ? 'New days he plays' : 'Days') + '</div><div class="small" style="margin:4px 0">' + why + '</div>' + (dayLines ? '<ul class="small buy-days">' + dayLines + '</ul>' : '') + '</div>' + prizeRows + '</div>';
    }
    return '<div class="card panel buy-card"><div class="list-head" style="padding:0"><span class="who">' + face(id) + '<h2>' + esc(nameOf(id)) + '</h2></span><span class="small muted">' + esc(c.team || '') + ' · ' + tierLab + '</span></div>' +
      head + '<div class="small">' + mktSpan(id, R.U) + '</div>' + '<div class="small">' + why + '</div>' + (dayLines ? '<ul class="small buy-days">' + dayLines + '</ul>' : '') +
      '<div class="small muted">' + prizeLine + 'Expected wins' + (multi ? ' (all accounts)' : '') + ': ' + f1(e0) + ' → ' + f1(e1) + '.</div></div>';
  }).join('');
}

// ---- Grupo ----
// ---------- partilha com o grupo: plano, lineups e empréstimos ----------
// O que cada um partilha no resumo (se não desligou no perfil): usos de cada jogador, em que dias o plano o usa
// (em qualquer das contas) e o lineup planeado da conta principal para cada dia que falta.
function shareDoc() {
  if ((S.profile || {}).share_plan === false || S.noShareCol) return null;
  const roster = {}, use = {}, lineups = {};
  accounts().forEach(a => {
    const r = S.multi ? S.multi.byKey[a.id] : (a.id === 'main' ? S.result : null); if (!r) return;
    r.normal.days.forEach(d => {
      d.lineup.forEach(id => { const u = (use[id] = use[id] || []); if (!u.includes(d.date)) u.push(d.date); });
      if (a.id === 'main' && d.lineup.length) lineups[d.date] = d.lineup.slice();
    });
  });
  Object.entries(S.mine.roster || {}).forEach(([id, e]) => { const left = usesEff(e, id, 'main'), tot = left + usedCount('main', id); if (tot > 0) roster[id] = [left, tot, collectionInfo(id).copies]; });
  Object.values(use).forEach(l => l.sort());
  // jogadores fixados (decididos) em cada dia que falta, e no dia a decorrer os que já entraram em jogo
  const locks = {}, pm = planOf('main'), today = todayET();
  Object.entries(pm.locks || {}).forEach(([d, ids]) => { if (d >= today && (ids || []).length) locks[d] = ids.slice(); });
  Object.entries(pm.live || {}).forEach(([d, l]) => { if (d < today || !l || !l.active) return; Object.entries(l.players || {}).forEach(([id, e]) => { if (e && (e.state === 'jogo' || e.state === 'fim')) { const a = (locks[d] = locks[d] || []); if (!a.includes(id)) a.push(id); } }); });
  // as smurfs: o lineup do plano em cada dia e o que está fixado (para o grupo ver em Lineups)
  const al = {};
  if (S.multi) accounts().forEach(a => { if (a.id === 'main') return; const r = S.multi.byKey[a.id]; if (!r) return; const lu = {}, lk = {};
    r.normal.days.forEach(d => { if (d.lineup.length) lu[d.date] = d.lineup.slice(); });
    Object.entries(planOf(a.id).locks || {}).forEach(([d, ids]) => { if (d >= today && (ids || []).length) lk[d] = ids.slice(); });
    if (Object.keys(lu).length) al[a.id] = { label: a.label, lu, lk }; });
  return Object.assign({ roster, use, lineups, locks }, Object.keys(al).length ? { al } : {});
}
const groupName = uid => (S.group.profiles.find(p => p.user_id === uid) || {}).display_name || 'No name';
const sharing = s => !!(s && s.share && s.share.roster) && ((S.group.profiles.find(p => p.user_id === s.user_id) || {}).share_plan !== false);
// Lineups planeados de cada um nos dias que faltam
function lineupsHtml() {
  const r = mainResult(), me = S.session.user.id;
  if (!r || !r.model.days.length) return '<div class="note info">' + (S.runId ? 'The run has already finished.' : 'No runs yet.') + '</div>';
  const mineIds = new Set(Object.keys(S.mine.roster || {}));
  const others = S.group.summaries.filter(s => s.user_id !== me && S.group.members.some(m => m.user_id === s.user_id));
  const shared = others.filter(sharing), hidden = S.group.members.filter(m => m.user_id !== me && !shared.some(s => s.user_id === m.user_id));
  const myV = view();
  const cards = r.model.days.filter(md => md.objs.length).slice(0, 6).map(md => {
    const day = md.day, mine = ((myV.days.find(d => d.date === day.date) || {}).lineup) || [];
    const myLocks = (((curPlan().locks || {})[day.date]) || []).concat(Object.entries((((curPlan().live || {})[day.date]) || {}).players || {}).filter(([, e]) => e && (e.state === 'jogo' || e.state === 'fim')).map(([id]) => id));
    // por jogador: quem o leva neste dia (os mais escolhidos em cima), com cadeado em quem o fixou
    // cada conta é uma linha: a principal de cada um e, a seguir, as smurfs (as minhas do plano; as dos outros do que partilharam)
    const myName = (S.profile || {}).display_name || 'You';
    const people = [{ uid: me, key: me, name: myName, ids: mine, lk: new Set(myLocks) }];
    if (S.multi) accounts().forEach(a => { if (a.id === 'main') return; const rr = S.multi.byKey[a.id], ids = ((rr && rr.normal.days.find(d => d.date === day.date)) || {}).lineup || [];
      if (ids.length) people.push({ uid: me, key: me + ':' + a.id, name: a.label, smurf: true, ids, lk: new Set(((planOf(a.id).locks || {})[day.date]) || []) }); });
    shared.forEach(s => {
      people.push({ uid: s.user_id, key: s.user_id, name: groupName(s.user_id), at: s.updated_at, ids: ((s.share.lineups || {})[day.date]) || [], lk: new Set((s.share.locks || {})[day.date] || []) });
      const al = s.share.al || {}, accs = s.share.accs || {};
      [...new Set(Object.keys(al).concat(Object.keys(accs)))].filter(k => k !== 'main').forEach(k => { const x = al[k] || {}, ids = (x.lu || {})[day.date] || ((accs[k] || {}).lu || {})[day.date] || [];
        if (ids.length) people.push({ uid: s.user_id, key: s.user_id + ':' + k, name: x.label || (accs[k] || {}).label || k, smurf: true, at: s.updated_at, ids, lk: new Set((x.lk || {})[day.date] || []) }); });
    });
    const by = new Map(); people.forEach(p => p.ids.forEach(id => { (by.get(id) || by.set(id, []).get(id)).push(p); }));
    const list = [...by.entries()].sort((a, b) => (b[1].length - a[1].length) || ((a[1][0].uid === me ? 0 : 1) - (b[1][0].uid === me ? 0 : 1)) || String(lastName(a[0])).localeCompare(String(lastName(b[0]))));
    const myLu = new Set(mine);
    if (S.luView === 'pessoa') {
      // por pessoa: o lineup de cada um; em destaque os jogadores que também estão no teu
      const prow = p => {
        const pl = id => { const same = p.uid !== me && myLu.has(id), lk = p.lk.has(id);
          return '<button type="button" class="lp-pl' + (same ? ' same' : '') + '" data-action="pform" data-id="' + esc(id) + '" title="' + esc(nameOf(id)) + (lk ? ' (locked)' : '') + (same ? ' · also in yours' : '') + '">' + face(id, 'sm') + (lk ? '<i class="lp-lk">' + icoLock + '</i>' : '') + '<span class="lp-nm">' + esc(lastName(id) || id) + '</span></button>'; };
        const sub = p.smurf ? 'smurf' + (p.uid === me ? '' : ' of ' + groupName(p.uid)) : p.at ? ago(p.at) : '';
        return '<li class="row lp-row' + (p.smurf ? ' smurf' : '') + '"><div class="lp-who">' + avatar(p.key, p.name) + '<div style="min-width:0"><div class="nm">' + esc(p.key === me ? 'You' : p.name) + '</div>' + (sub ? '<div class="small muted lp-sub">' + esc(sub) + '</div>' : '') + '</div></div>' +
          '<div class="lp-pls">' + (p.ids.length ? p.ids.map(pl).join('') : '<span class="small muted">no players</span>') + '</div></li>'; };
      return '<div class="card"><div class="list-head"><h2>Day ' + (day.idx + 1) + ' · ' + esc(objsText(day)) + '</h2><span class="small muted">' + dWeek(day.date) + ', ' + dShort(day.date) + '</span></div><ul class="list">' + people.map(prow).join('') + '</ul></div>';
    }
    const rows = list.map(([id, ps]) => '<li' + (myLu.has(id) ? ' class="lu-mine"' : '') + '><button class="row lu-pl" type="button" data-action="pform" data-id="' + esc(id) + '"><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(id)) + '</span></div>' +
      '<div class="ps">' + esc(((S.players.get(String(canon(id))) || {}).team) || '') + '</div></div></span>' +
      '<span class="lu-who">' + ps.map(p => '<span class="lu-av' + (p.lk.has(id) ? ' lk' : '') + '" title="' + esc(p.key === me ? 'You' : p.name) + (p.lk.has(id) ? ' (locked)' : '') + '">' + avatar(p.key, p.name) + (p.lk.has(id) ? '<i>' + icoLock + '</i>' : '') + '</span>').join('') + '</span><b class="lu-n num">' + ps.length + '</b></button></li>').join('');
    return '<div class="card"><div class="list-head"><h2>Day ' + (day.idx + 1) + ' · ' + esc(objsText(day)) + '</h2><span class="small muted">' + dWeek(day.date) + ', ' + dShort(day.date) + '</span></div>' + (rows ? '<ul class="list">' + rows + '</ul>' : '<div class="row small muted">Nobody has a lineup for this day.</div>') + '</div>';
  });
  const pv = S.luView === 'pessoa';
  return '<div class="seg pl-seg lu-seg" role="group" aria-label="How to view lineups">' + [['jogador', 'By player'], ['pessoa', 'By person']].map(([k, l]) => '<button type="button" data-action="lu-view" data-v="' + k + '" aria-pressed="' + ((k === 'pessoa') === pv) + '">' + l + '</button>').join('') + '</div>' +
    '<div class="sec-head"><span class="small muted">' + (pv ? 'Each person’s lineup · <span class="lp-ring" aria-hidden="true"></span> also in yours' : 'Who takes each player · <span class="lu-mine-key">highlighted</span>: in your lineup') + ' · ' + icoLock + ' locked</span>' + helpBtn('lineups') + '</div>' +
    (shared.length ? '' : '<div class="note info">Nobody in the group has shared their plan yet.</div>') + cards.join('') +
    (hidden.length ? '<p class="small muted" style="margin:0 4px">No shared plan: ' + hidden.map(m => esc(groupName(m.user_id))).join(', ') + '.</p>' : '');
}
// Empréstimos: Moments dos amigos que podes pedir nos dias em que eles não os usam
S.borrow = { results: null, busy: false };
function borrowOffers() {
  const r = mainResult(), me = S.session.user.id; if (!r) return [];
  const open = r.model.days.filter(md => md.objs.length).map(md => md.day);
  const offers = new Map();
  S.group.summaries.forEach(s => {
    if (s.user_id === me || !sharing(s) || !S.group.members.some(m => m.user_id === s.user_id)) return;
    Object.entries(s.share.roster).forEach(([id, x]) => {
      if ((S.mine.roster || {})[id]) return;
      const c = S.players.get(String(id)); if (!c || !c.team || !c.avg) return;
      const total = +x[1] || 0, copies = Math.max(1, +x[2] || 1); if (total <= 0) return;
      const busy = ((s.share.use || {})[id]) || [];
      const dates = open.filter(d => !busy.includes(d.date) && FB.teamsOn(d).has(c.team)).map(d => d.date);
      if (!dates.length) return;
      const o = { id, uid: s.user_id, from: groupName(s.user_id), U: Math.max(1, Math.ceil(total / copies)), dates, busy: busy.filter(d => open.some(x => x.date === d)).sort(), at: s.updated_at, others: [] };
      const cur = offers.get(id), w = z => Math.min(z.U, z.dates.length) * 100 + z.dates.length;
      if (!cur) offers.set(id, o); else if (w(o) > w(cur)) { o.others = cur.others.concat([cur.from]); offers.set(id, o); } else cur.others.push(o.from);
    });
  });
  return [...offers.values()];
}
const borrowEntry = o => { const c = S.players.get(String(o.id)) || {}; return { name: c.name || o.id, team: c.team || '', uses: o.U, status: 'ok', avg: c.avg || null, copies: 1, owner: 'main', availDates: o.dates.slice() }; };
async function borrowRun() {
  if (S.borrow.busy) return;
  const out = $('borrowOut'); if (!out) return;
  const offers = borrowOffers();
  if (!offers.length) { S.borrow.results = { list: [], none: true }; renderGrupo(); return; }
  S.borrow.busy = true; out.innerHTML = '<div class="small muted" id="borrowProg">Choosing among ' + plural(offers.length, 'Moment', 'Moments') + ' from friends…</div>';
  await tick(30);
  try {
    const r = mainResult(), x = engineInputs('main'), wide = clone(x.roster);
    offers.forEach(o => { wide.players[o.id] = borrowEntry(o); });
    const mw = FB.buildModel(x.run, wide, x.odds, x.plan, engOpts());
    const byU = {}; offers.forEach(o => { (byU[o.U] = byU[o.U] || []).push(o); });
    let scr = [];
    Object.entries(byU).forEach(([U, list]) => { scr = scr.concat(FB.buyScreen(mw, r.normal, list.map(o => mw.pIndex.get(o.id)).filter(i => i != null), +U)); });
    const short = scr.filter(z => z.score > 1e-5).sort((a, b) => b.score - a.score).slice(0, 6).map(z => offers.find(o => o.id === z.id));
    const base = planNow(), list = [];
    for (let k = 0; k < short.length; k++) {
      const o = short[k], p = $('borrowProg'); if (p) p.textContent = 'Redoing the run with ' + nameOf(o.id) + ' (from ' + o.from + ')… ' + (k + 1) + ' of ' + short.length;
      await tick();
      try { list.push({ o, ev: await planWithAsync(pl => { pl[o.id] = borrowEntry(o); }) }); } catch (e) { console.warn(e); }
    }
    list.sort((a, b) => b.ev.total - a.ev.total);
    S.borrow.results = { list: list.filter(z => z.ev.total > base.total + 1e-6), base, at: Date.now(), n: offers.length };
  } catch (e) { console.error(e); S.borrow.results = { list: [], err: errText(e) }; }
  S.borrow.busy = false;
  if (S.tab === 'grupo') renderGrupo();
}
function borrowCard(z, base, i) {
  const o = z.o, ev = z.ev, P = mainResult().prizes;
  const used = ev.res.days.filter(d => d.lineup.includes(o.id)).map(d => d.date);
  const dn = ds => ds.map(d => S.days.findIndex(x => x.date === d) + 1).filter(n => n > 0);
  const k = P.length ? P.map((p, j) => [p, j]).sort((a, b) => (ev.res.prizeProbs[b[1]] - base.res.prizeProbs[b[1]]) - (ev.res.prizeProbs[a[1]] - base.res.prizeProbs[a[1]]))[0] : null;
  const W0 = mainResult().wins, gain = k ? k[0].wins + ' wins: ' + pct(base.res.prizeProbs[k[1]]) + ' → <span class="up">' + pct(ev.res.prizeProbs[k[1]]) + '</span>' : 'Expected wins: ' + f1(W0 + base.res.expected) + ' → <span class="up">' + f1(W0 + ev.res.expected) + '</span>';
  const pp = k ? Math.round((ev.res.prizeProbs[k[1]] - base.res.prizeProbs[k[1]]) * 100) : null;
  const first = used[0], last = used[used.length - 1];
  const between = o.busy.filter(d => first && d > first && d < last), after = o.busy.filter(d => last && d > last);
  const days = used.map(d => { const b = base.res.days.find(x => x.date === d), a = ev.res.days.find(x => x.date === d), day = S.days.find(x => x.date === d);
    return '<li><b>Day ' + (day ? S.days.indexOf(day) + 1 : '?') + '</b> · ' + dWeek(d) + ' ' + dShort(d) + ' · ' + esc(objsText(day)) + ' — win ' + (b ? pct(b.P) : '–') + ' → <b>' + (a ? pct(a.P) : '–') + '</b></li>'; }).join('');
  const msg = 'Borrow <b>' + esc(nameOf(o.id)) + '</b> from <b>' + esc(o.from) + '</b> for ' + (used.length === 1 ? 'day ' : 'days ') + spans(dn(used)) + '.';
  const safe = o.busy.length ? 'O ' + esc(o.from) + ' uses it ' + (o.busy.length === 1 ? 'on day ' : 'on days ') + spans(dn(o.busy)) + (between.length ? ': give it back before day ' + dn(between)[0] + ' and ask again.' : after.length ? ': give it back by day ' + dn(after)[0] + '.' : '.') : 'The plan of ' + esc(o.from) + ' doesn\'t use it in the rest of the run.';
  return '<div class="card panel buy-card"><div class="list-head" style="padding:0"><h2>' + (i + 1) + '. ' + esc(nameOf(o.id)) + '</h2><span class="small muted">' + teamTag((S.players.get(o.id) || {}).team) + ' · from ' + esc(o.from) + '</span></div>' +
    '<div>' + msg + '</div><div class="buy-gain">' + gain + (pp != null && pp > 0 ? ' <small>+' + pp + ' pp</small>' : '') + '</div>' +
    (days ? '<ul class="small buy-days">' + days + '</ul>' : '') +
    '<div class="small muted">Expected wins: ' + f1(mainResult().wins + base.res.expected) + ' → ' + f1(mainResult().wins + ev.res.expected) + '. ' + safe + (o.others.length ? ' Also has him: ' + o.others.map(esc).join(', ') + '.' : '') + '</div></div>';
}
function emprestimosHtml() {
  const r = mainResult(), B = S.borrow.results;
  if (!S.runId || !r || !r.model.days.length) return '<div class="note info">' + (S.runId ? 'The run has already finished.' : 'No runs yet.') + '</div>';
  const n = borrowOffers().length;
  let out = '';
  if (S.borrow.busy) out = '<div class="small muted" id="borrowProg">Calculating…</div>';
  else if (B && B.err) out = '<div class="note">Error: ' + esc(B.err) + '</div>';
  else if (B && B.none) out = '<div class="note info">None of your friends’ Moments helps right now.</div>';
  else if (B) out = B.list.length ? B.list.map((z, i) => borrowCard(z, B.base, i)).join('') : '<div class="note info">None of the ' + B.n + ' available Moments improves your run.</div>';
  return '<div class="card panel"><h2>Borrow ' + helpBtn('emprestimos') + '</h2>' +
    '<div class="small"><b>' + plural(n, 'Moment', 'Moments') + '</b> of ' + plural(new Set(borrowOffers().map(o => o.uid)).size, 'friend', 'friends') + ', on days they don’t use them.</div>' +
    '<button class="btn primary" type="button" data-action="borrow-run"' + (n && !S.borrow.busy ? '' : ' disabled') + '>See what\'s worth asking for</button></div>' +
    '<div id="borrowOut" class="stack">' + out + '</div>';
}
function renderGrupo() {
  const el = $('tab-grupo');
  if (S.loading) { el.innerHTML = empty('Loading…', 'Reading the group.'); return; }
  if (!S.runId) { el.innerHTML = empty('No runs yet', 'The standings show up when there is a run.'); return; }
  const gsub = subOf('grupo');
  if (gsub === 'lineups') { el.innerHTML = subBar('grupo') + '<div class="stack">' + lineupsHtml() + '</div>'; return; }
  if (gsub === 'emprestimos') { el.innerHTML = subBar('grupo') + '<div class="stack">' + emprestimosHtml() + '</div>'; return; }
  const nd = nextDay(), R = groupRanks(), people = groupEntries();
  // com os lugares do Top Shot, a ordem é a da classificação oficial (vitórias e o desempate deles)
  if (R) people.sort((a, b) => ((a.rk && a.rk.found ? a.rk.rank : 1e9) - (b.rk && b.rk.found ? b.rk.rank : 1e9)) || (b.wins - a.wins));
  // grelha: uma linha por conta, o lugar na run (com o prémio que daria hoje) e o lugar em cada dia já jogado
  const run = curRun() || {}, today = todayET();
  const days = S.days.filter(d => d.date <= today || (nd && nd.date === d.date) || people.some(x => x.daysRes[d.date]));
  const money = c => { const v = c / 100; return '$' + (v % 1 ? v.toFixed(2).replace('.', ',') : v.toLocaleString('en-GB')); };
  const prizeAt = r => { const b = R && (R.bands || []).find(z => r >= z[0] && r <= z[1]); return !b ? '' : b[2] ? money(b[2]) : b[3] || ''; };
  // prémio de um dia (créditos): pelas faixas desse dia (ou as do Classic: 150, 100, 50, 20, 10, 5, 3, 2 até ao 100.º), pelo lugar, mesmo que se tenha perdido o dia
  const dayPrize = (d, dr) => { if (!dr || !dr.rank) return 0; const bands = d && d.bands && d.bands.length ? d.bands : DAY_BANDS, b = bands.find(z => dr.rank >= z[0] && dr.rank <= z[1]); return b ? b[2] : 0; };
  const rdays = (R && R.days) || [];
  const lastPaid = R && (R.bands || []).length ? Math.max(...R.bands.map(b => b[1])) : null, qual = R && R.qual;
  const zone = r => (qual && r <= qual ? ' z-q' : lastPaid && r <= lastPaid ? ' z-p' : '');
  const cell = (x, d) => {
    const dr = dayRankOf(x.addr, d.date), no = !(dr && dr.rank) && tsNoEntry(x.addr, d.date); // no: não levou lineup
    const res = dr && dr.rank ? (dr.won ? 'win' : 'loss') : no ? null : x.daysRes[d.date], pz = dayPrize(rdays.find(z => z.date === d.date), dr);
    const cls = res === 'win' ? 'w' : res === 'loss' ? 'l' : 'n', tip = dShort(d.date) + (no ? ': no lineup' : res ? (res === 'win' ? ': won' : ': lost') : '') + (dr && dr.rank && dr.total ? ' · ' + dr.rank + ' of ' + dr.total : '');
    return '<td class="c ' + cls + (nd && nd.date === d.date && !res ? ' now' : '') + '" title="' + esc(tip) + '">' + (dr && dr.rank ? dr.rank.toLocaleString('en-GB') + '.º' + (pz ? '<small class="dz">+' + money(pz) + '</small>' : '') : res ? (res === 'win' ? '✓' : '✕') : '—') + '</td>';
  };
  const rows = people.map(x => {
    const rk = x.rk && x.rk.found ? x.rk : null, pz = rk ? prizeAt(rk.rank) : '';
    const won = rdays.reduce((t, d) => t + dayPrize(d, x.addr ? (d.accs || {})[addrKey(x.addr)] : null), 0);
    return '<tr' + (x.uid === S.session.user.id ? ' class="me"' : '') + ' data-action="friend" data-id="' + esc(x.uid) + '" data-acc="' + esc(x.acc) + '" tabindex="0" role="button"><td class="who2">' + avatar(x.acc === 'main' ? x.uid : x.uid + '|' + x.acc, x.name) +
      '<span><b>' + esc(x.name) + '</b>' + (x.acc !== 'main' ? '<small>smurf' + (x.owner ? ' of ' + esc(x.owner) : '') + '</small>' : x.uid === S.session.user.id ? '<small>you</small>' : '') + '</span></td>' +
      '<td class="rr' + (rk ? zone(rk.rank) : '') + '">' + (rk ? '<b>' + rk.rank.toLocaleString('en-GB') + '.º</b><small>' + plural(rk.wins != null ? rk.wins : x.wins, 'win', 'wins') + (pz ? ' · ' + esc(pz) : '') + '</small>' : '<b class="muted">—</b><small>' + plural(x.wins, 'win', 'wins') + '</small>') + '</td>' +
      days.map(d => cell(x, d)).join('') + '<td class="money">' + (won ? money(won) : '—') + '</td></tr>';
  }).join('');
  // linha do grupo: o que se ganhou em cada dia e quantas contas ganharam o dia
  const dayTot = d => { const rd = rdays.find(z => z.date === d.date); let t = 0, w = 0, any = false; people.forEach(x => { const dr = dayRankOf(x.addr, d.date), res = dr && dr.rank ? (dr.won ? 'win' : 'loss') : tsNoEntry(x.addr, d.date) ? null : x.daysRes[d.date]; if (res) any = true; if (res === 'win') w++; t += dayPrize(rd, dr); }); return { t, w, any }; };
  const allWon = people.reduce((t, x) => t + rdays.reduce((u, d) => u + dayPrize(d, x.addr ? (d.accs || {})[addrKey(x.addr)] : null), 0), 0);
  const totRow = people.length > 1 ? '<tr class="tot"><td class="who2"><span><b>Group</b></span></td><td></td>' + days.map(d => { const z = dayTot(d); return '<td><b>' + (z.t ? money(z.t) : '—') + '</b>' + (z.any ? '<small>' + z.w + ' ✓</small>' : '') + '</td>'; }).join('') + '<td class="money"><b>' + (allWon ? money(allWon) : '—') + '</b></td></tr>' : '';
  const hasLu = d => { const rd = rdays.find(z => z.date === d.date); return !!(rd && Object.values(rd.accs || {}).some(a => Array.isArray(a.lu) && a.lu.length)); };
  const head = '<tr><th class="who2">Account</th><th>Run</th>' + days.map((d, k) => '<th title="' + esc(objsText(d)) + '">' + (hasLu(d) ? '<button class="gc-day" type="button" data-action="day-lus" data-date="' + d.date + '" aria-label="Lineups for day ' + (S.days.indexOf(d) + 1) + '">Day ' + (S.days.indexOf(d) + 1) + ' ›</button>' : 'Day ' + (S.days.indexOf(d) + 1)) + '</th>').join('') + '<th>Won</th></tr>';
  const info = R ? esc(run.name || 'Run') + (R.total ? ' · ' + R.total.toLocaleString('en-GB') + ' players' : '') + ' · ranks ' + ago(R.at) : 'Top Shot ranks not read yet';
  el.innerHTML = subBar('grupo') + '<div class="card"><div class="list-head"><h2>Standings ' + helpBtn('classif') + '</h2></div><div class="small muted" style="padding:0 16px 6px">' + info + '</div>' +
    '<div class="gc-wrap"><table class="gc"><thead>' + head + '</thead><tbody>' + (rows || '<tr><td class="muted small">No members yet.</td></tr>') + totRow + '</tbody></table></div>' +
    // só a linha de corte (vitórias para entrar no top 50 / nos prémios), se for conhecida; a legenda saiu
    (R && R.cut && Object.keys(R.cut).length ? '<div class="small muted gc-leg">Wins to get in: ' + Object.entries(R.cut).map(([k, w]) => 'top ' + k + ' ' + w).join(', ') + '</div>' : '') + '</div>' +
    // lugares e preços: só quem gere o grupo (admin) os vai ler ao Top Shot; os outros veem o que ele leu
    '<div class="foot" style="padding:0;border:0;grid-template-columns:1fr"><button class="btn" type="button" data-action="group-refresh">Refresh</button></div>';
}
// uma entrada por conta de cada membro (principal e smurfs): resultados da blockchain, depois os do próprio (resumo
// publicado) e, nos dias que ainda não têm, o resultado pelas fichas da ESPN com o lineup partilhado (prov: por confirmar)
// os lineups que cada conta do grupo levou num dia (lidos no Top Shot com os lugares), do melhor lugar para o pior
function dayLineupsSheet(date) {
  const R = groupRanks(), rd = R && (R.days || []).find(z => z.date === date), day = S.days.find(d => d.date === date) || {}; if (!rd) return;
  const ppl = groupEntries().map(x => ({ x, a: x.addr ? (rd.accs || {})[addrKey(x.addr)] : null })).filter(z => z.a && z.a.rank).sort((p, q) => p.a.rank - q.a.rank);
  const pl = z => { const id = tsIdOf(z[1]); return '<span class="lp-pl">' + (id ? face(id, 'sm') : '<span class="face sm"><b>' + esc(initials(z[1] || '?')) + '</b></span>') + '<span class="lp-nm">' + esc(id ? lastName(id) : (z[1] || '?').split(' ').slice(-1)[0]) + '</span></span>'; };
  const row = ({ x, a }) => '<li class="row lp-row' + (x.acc !== 'main' ? ' smurf' : '') + '"><div class="lp-who">' + avatar(x.acc === 'main' ? x.uid : x.uid + '|' + x.acc, x.name) + '<div style="min-width:0"><div class="nm">' + esc(x.name) + '</div><div class="small ' + (a.won ? 'c-good' : 'c-bad') + '">' + (a.won ? '✓ ' : '✕ ') + a.rank.toLocaleString('en-GB') + '.º' + (rd.total ? ' of ' + rd.total.toLocaleString('en-GB') : '') + '</div></div></div>' +
    '<div class="lp-pls">' + (Array.isArray(a.lu) && a.lu.length ? a.lu.map(pl).join('') : '<span class="small muted">' + (a.luh ? 'lineup hidden' : 'no lineup read') + '</span>') + '</div></li>';
  openSheet('<h3>Lineups for day ' + (S.days.indexOf(day) + 1) + '</h3><div class="small muted">' + dWeek(date) + ', ' + dShort(date) + ' · ' + esc(objsText(day)) + '</div>' +
    (ppl.length ? '<div class="card"><ul class="list lp-list">' + ppl.map(row).join('') + '</ul></div>' : '<div class="note info">No lineups read for this day yet.</div>') +
    '<div class="small muted">Read on Top Shot with the ranks ' + ago(R.at) + '.</div>');
}
function groupEntries() {
  const memberIds = new Set(S.group.members.map(m => m.user_id)), profs = new Map(S.group.profiles.map(p => [p.user_id, p])), sums = new Map(S.group.summaries.map(s => [s.user_id, s]));
  const chainBy = {};
  S.group.chain.forEach(c => { const k = c.user_id + '|' + (c.account || 'main'); (chainBy[k] = chainBy[k] || {})[c.date] = c; });
  const out = [];
  [...memberIds].forEach(uid => {
    const p = profs.get(uid) || {}, own = S.session && uid === S.session.user.id ? accSummaries() : null; // as minhas contas: o que está no ecrã, sem esperar pelo resumo gravado
    const s = own && own.main ? Object.assign({}, sums.get(uid) || {}, own.main) : sums.get(uid) || null, accs = own && Object.keys(own).length ? own : (s && s.share && s.share.accs) || {};
    const list = [{ id: 'main', name: p.display_name || 'No name' }].concat((Array.isArray(p.smurfs) ? p.smurfs : []).filter(x => x && x.id).map((x, k) => ({ id: x.id, name: x.topshot_username || (accs[x.id] || {}).label || 'Smurf ' + (k + 1) })));
    list.forEach(a => {
      const sa = a.id === 'main' ? (s ? Object.assign({}, s, accs.main || {}) : null) : accs[a.id] || null, ch = chainBy[uid + '|' + a.id] || {};
      if (a.id !== 'main' && !sa && !Object.keys(ch).length) return; // smurf sem nada: não aparece
      const daysRes = Object.assign({}, (sa && sa.days) || {}), prov = {};
      Object.values(ch).forEach(c => { if (c.win != null && c.date) daysRes[c.date] = c.win ? 'win' : 'loss'; });
      const lu = (accs[a.id] && accs[a.id].lu) || (a.id === 'main' && s && s.share && s.share.lineups) || {};
      S.days.forEach(day => { if (daysRes[day.date] || !lu[day.date]) return; const c = groupCalc(lu[day.date], day); if (c) { daysRes[day.date] = c.res; prov[day.date] = true; } });
      const wins = Object.values(daysRes).filter(x => x === 'win').length, losses = Object.values(daysRes).filter(x => x === 'loss').length;
      const fa = a.id === 'main' ? p.flow_address : ((Array.isArray(p.smurfs) ? p.smurfs : []).find(x => x && x.id === a.id) || {}).flow_address;
      out.push({ addr: fa, rk: rankOf(fa), uid, acc: a.id, name: a.name, owner: a.id !== 'main' ? p.display_name || '' : '', s: sa, daysRes, prov, lu, ch, wins, losses, chain: Object.keys(ch).length > 0, exp: sa && sa.expected != null ? +sa.expected : null });
    });
  });
  return out.sort((a, b) => (b.wins - a.wins) || ((b.exp || 0) - (a.exp || 0)) || a.name.localeCompare(b.name));
}
// resultado de um dia de outra pessoa pelas fichas da ESPN (só com os jogos do lineup todos acabados)
function groupCalc(ids, day) {
  const objs = (day.objectives || []).filter(o => o && o.stat && +o.target > 0);
  if (!objs.length || objs.some(o => /pip/.test(o.stat)) || !Array.isArray(ids) || !ids.length) return null;
  const tip = firstTipOf(day); if (tip == null || Date.now() < tip) return null;
  const vals = ids.map(id => { const b = boxFor(day.date, id); if (b === null) return null; if (b && b.fin) return objs.map(o => rnd(FB.statValue(b.v, o.stat, pAvg(id)))); return undefined; });
  if (vals.some(v => v === undefined)) return null;
  const tot = objs.map((o, k) => rnd(vals.reduce((t, v) => t + (v ? +v[k] || 0 : 0), 0)));
  const win = objs.every((o, k) => (o.each ? vals.every(v => v && +v[k] >= +o.target) : tot[k] >= +o.target));
  return { res: win ? 'win' : 'loss', tot, objs };
}
function friendSheet(uid, acc) {
  acc = acc || 'main';
  const p = S.group.profiles.find(x => x.user_id === uid) || {};
  const E = groupEntries().find(x => x.uid === uid && x.acc === acc) || { daysRes: {}, prov: {}, ch: {}, lu: {}, name: p.display_name };
  const ch = E.ch, sm = acc !== 'main' ? ((Array.isArray(p.smurfs) ? p.smurfs : []).find(x => x && x.id === acc) || {}) : null;
  const rows = S.days.map((d, i) => {
    const c = ch[d.date], r = E.daysRes[d.date] || null, pv = E.prov[d.date];
    const lineup = c && Array.isArray(c.lineup) && c.lineup.length ? c.lineup.join(' · ') : pv && E.lu[d.date] ? E.lu[d.date].map(nameOf).join(' · ') : '';
    return '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">Day ' + (i + 1) + ' · ' + esc(objsText(d)) + '</span></div><div class="ps">' + dShort(d.date) + (c && c.points != null ? ' · ' + f0(+c.points) + ' scored' : '') + (lineup ? ' · ' + esc(lineup) : '') + '</div></div>' +
      (r ? '<span class="pchip ' + (r === 'win' ? 'p-good' : 'p-bad') + '">' + (r === 'win' ? 'W' : 'L') + '</span>' : '<span class="pchip p-done">—</span>') + '</li>';
  }).join('');
  const ts = sm ? sm.topshot_username : p.topshot_username;
  openSheet('<h3>' + esc(E.name || 'No name') + '</h3><div class="small muted">' + (sm ? 'Smurf of ' + esc(p.display_name || '?') + ' · ' : '') + (ts ? 'Top Shot: ' + esc(ts) : 'No Top Shot username in the profile') + '</div>' +
    '<ul class="list card">' + rows + '</ul>');
}

// ---- Ajustes ----
function renderAjustes() {
  const el = $('tab-ajustes'), me = S.profile || {}, run = curRun(), sub = subOf('ajustes'), html = [subBar('ajustes')];
  if (sub === 'perfil') html.push('<div class="card panel"><h2>Profile</h2><form id="pfForm" class="stack">' +
    '<label class="small muted">Name the group sees<input class="field" id="pfName2" maxlength="40" value="' + esc(me.display_name || '') + '"></label>' +
    '<label class="small muted">Top Shot username<input class="field" id="pfTs2" maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false" value="' + esc(me.topshot_username || '') + '"></label>' +
    '<div class="field-lbl"><label class="small muted" for="pfFlow2">Flow address (Dapper wallet)</label>' + helpBtn('flow') + '</div><input class="field" id="pfFlow2" maxlength="18" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="0x…" value="' + esc(me.flow_address || '') + '">' +
    smurfFormHtml() +
    '<div class="btns"><button class="btn quiet" type="button" data-action="logout">Sign out</button><button class="btn primary" type="submit">Save profile</button></div></form></div>' +
    '<div class="card panel"><h2>Share with the group ' + helpBtn('partilha') + '</h2>' +
    '<div class="seg acc-seg" role="group" aria-label="Share the plan"><button type="button" data-action="share-plan" data-v="1" aria-pressed="' + (me.share_plan !== false) + '">Share</button><button type="button" data-action="share-plan" data-v="0" aria-pressed="' + (me.share_plan === false) + '">Don\'t share</button></div></div>');
  if (sub === 'prefs' && S.runs.length) {
    html.push('<div class="card panel"><h2>Run shown</h2><select class="field" id="runPick" aria-label="Choose run">' + S.runs.map(x => '<option value="' + esc(x.id) + '"' + (x.id === S.runId ? ' selected' : '') + '>' + esc(x.name) + ' · ' + dShort(x.start_date) + (x.active ? ' (active)' : '') + '</option>').join('') + '</select></div>');
  }
  if (sub === 'prefs') html.push('<div class="card panel"><h2>Language · Língua</h2>' +
    '<div class="seg acc-seg" role="group" aria-label="Language · Língua">' + [['pt', 'Português'], ['en', 'English']].map(([k, l]) => '<button type="button" data-action="lang" data-v="' + k + '" aria-pressed="' + (LANG === k) + '">' + l + '</button>').join('') + '</div></div>');
  if (sub === 'prefs') html.push('<div class="card panel"><h2>Appearance</h2>' +
    '<div class="seg acc-seg" role="group" aria-label="Appearance">' + [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => '<button type="button" data-action="theme" data-v="' + k + '" aria-pressed="' + (theme === k) + '">' + l + '</button>').join('') + '</div></div>');
  if (sub === 'prefs' && accounts().length > 1) {
    const p = (S.mine.plan || {}).prio || 'auto', au = prioAuto();
    html.push('<div class="card panel"><h2>Priority between accounts ' + helpBtn('prio') + '</h2>' +
      '<div class="chips" role="group" aria-label="Priority between accounts">' + [['auto', 'Automatic']].concat(accounts().map(a => [a.id, accLabel(a.id)])).concat([['eq', 'Equal']]).map(([k, l]) => '<button type="button" data-action="prio" data-v="' + esc(k) + '" aria-pressed="' + (p === k) + '">' + esc(l) + '</button>').join('') + '</div>' +
      '<div class="small muted">' + (p === 'auto' ? (au ? 'The best Moments go first to <b>' + esc(accLabel(au.id)) + '</b>, the best ranked (' + esc(ord(au.rank)) + ' in the Overall).' : 'No places read yet: no priority.') : p === 'eq' ? 'No priority: the plan can put the best Moments in either account.' : 'The best Moments go first to <b>' + esc(accLabel(p)) + '</b>.') + '</div></div>');
  }
  if (sub === 'prefs') html.push('<div class="card panel"><h2>Calculation without odds ' + helpBtn('avancado') + '</h2>' +
    '<div class="label">Back-to-backs</div><div class="seg acc-seg" role="group" aria-label="Back-to-backs"><button type="button" data-action="b2b" data-v="1" aria-pressed="' + b2bOn + '">Adjust</button><button type="button" data-action="b2b" data-v="0" aria-pressed="' + !b2bOn + '">Don’t adjust</button></div>' +
    '<div class="label">Weight of recent form</div><div class="seg acc-seg" role="group" aria-label="Form weight">' + FORM_LEVELS.map(([k, l]) => '<button type="button" data-action="form-level" data-level="' + k + '" aria-pressed="' + (formLevel === k) + '">' + l + '</button>').join('') + '</div></div>');
  if (sub === 'prefs') html.push(telegramHtml()); // avisos no grupo do Telegram (os avisos pessoais, alertsHtml, ficam guardados)
  if (sub === 'admin') html.push(adminHtml(run));
  if (sub === 'dados') html.push(dataHtml());
  el.innerHTML = html.join('');
  if (sub === 'admin' && S.role === 'admin' && S.jobReq === undefined) loadJobReq();
  if (sub === 'admin' && S.role === 'admin' && S.invite == null) { sb.rpc('get_invite_code').then(({ data }) => { S.invite = data || ''; if (S.tab === 'ajustes' && !typingIn('tab-ajustes')) renderAjustes(); }); }
}
// avisos no grupo do Telegram: a tarefa "Lesões" manda-os com o bot do grupo (segredo TELEGRAM_BOT_TOKEN no GitHub)
function telegramHtml() {
  return '<div class="card panel"><h2>Telegram alerts</h2>' +
    '<div class="small muted">The Telegram group bot posts to the group, from everyone’s lineups (the one submitted in Top Shot or, if not yet, the plan’s; anyone who turned sharing off in Profile is left out):</div>' +
    '<ul class="steps"><li><b>Injuries</b>: when someone in a lineup enters the NBA report, changes status or leaves it (✅ should play), with whose lineup it is.</li><li><b>Status update</b>: at 11 pm Lisbon (or 2 h before the game) for anyone still questionable.</li><li><b>Today’s specialists</b>: the best in today’s stat (top 8 in each) who are questionable, even if they aren’t in any lineup.</li><li><b>Done your lineups?</b>: one hour before the first game of the day, with who hasn’t submitted yet.</li><li><b>Last call</b>: half an hour before the first game of the day, if anyone is still questionable.</li></ul>' +
    (S.role === 'admin' ? '<details class="small"><summary><b>Admin: set up the bot</b></summary><ol class="steps"><li>In Telegram, talk to <b>@BotFather</b>, type <span class="kbd">/newbot</span> and pick a name. It gives you a token.</li><li>On GitHub: Settings → Secrets and variables → Actions → New repository secret, name <span class="kbd">TELEGRAM_BOT_TOKEN</span>, value the token.</li><li>Add the bot to the group and type <span class="kbd">/start@bot_name</span> there.</li><li>In Actions → Lesões → Run workflow: the bot finds the group by itself.</li></ol></details>' : '') + '</div>';
}
// avisos antes dos jogos: email e/ou notificações no telemóvel (app ntfy, grátis, sem conta)
function alertsHtml() {
  const a = S.alerts || {}, email = ((S.session || {}).user || {}).email || '';
  const head = '<div class="card panel"><h2>Phone alerts</h2>';
  if (S.alertsOk === false) return head + '<div class="small muted">To turn on alerts, the admin has to run the new supabase/schema.sql in Supabase (SQL Editor).</div></div>';
  return head + '<div class="small muted">An automatic task checks the NBA injury report every 15 minutes at night and sends you:</div>' +
    '<ul class="steps"><li><b>Injury in your lineup</b>: when someone in today’s lineup enters the report, changes status or leaves it (✅ should play).</li><li><b>Status update</b>: at 11 pm Lisbon (or 2 h before the game) for anyone still questionable.</li><li><b>Last call</b>: about 15–30 min before the game, if still questionable.</li><li><b>Done your lineup?</b>: one hour before the first game of the day, with the site’s suggestion (not sent if you already submitted on every account).</li></ul>' +
    '<div class="small muted">The lineup is the one you submitted in Top Shot (read from the blockchain) or, if you haven’t yet, the plan’s.</div>' +
    (a.ntfy ? '<div class="label">On your phone</div><ol class="steps small"><li>Install the <b>ntfy</b> app (free, Android and iPhone).</li><li>Tap <b>+</b> and subscribe to this topic: <span class="kbd" id="ntfyTopic">' + esc(a.ntfy) + '</span> <button class="btn link small" type="button" data-action="copy-topic">copy</button></li><li>Tap <b>Test</b>: a notification should arrive.</li></ol>' +
      '<div class="small muted">Anyone who knows the topic also gets your messages: don\'t share it.</div><div class="btns"><button class="btn" type="button" data-action="alerts-test">Test</button><button class="btn quiet" type="button" data-action="alerts-ntfy-off">Turn off</button></div>'
      : '<button class="btn" type="button" data-action="alerts-ntfy-on">Turn on phone notifications</button>') +
    '<button class="switch" type="button" data-action="alerts-email" aria-pressed="' + !!a.email + '"><i></i>By email' + (email ? ' (' + esc(email) + ')' : '') + '</button>' +
    (S.role === 'admin' ? '<div class="small muted">Admin: emails need the SMTP_USER and SMTP_PASS secrets on GitHub and the "Lesões" task (see README).</div>' : '') + '</div>';
}
async function saveAlerts(patch) {
  const row = Object.assign({ email: false, ntfy: null }, S.alerts || {}, patch, { user_id: S.session.user.id });
  delete row.updated_at;
  try { await q(sb.from('alerts').upsert(row, { onConflict: 'user_id' })); S.alerts = row; S.alertsOk = true; return true; }
  catch (e) { toast(/alerts/.test(errText(e)) ? 'To turn on alerts, the admin has to run the new supabase/schema.sql.' : 'Not saved: ' + errText(e)); return false; }
}
function newTopic() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789', b = new Uint8Array(16);
  (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
  return 'fastbreak-' + Array.from(b, x => abc[x % abc.length]).join('');
}
async function testNtfy() {
  const topic = (S.alerts || {}).ntfy; if (!topic) return;
  try {
    const res = await fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify({ topic, title: 'Fast Break · test', message: 'Alerts arrive here. Before the games, if anyone in your lineup is injured, you get a message like this.', tags: ['basketball'] }) });
    toast(res.ok ? 'Sent. If it didn\'t arrive, check the topic in the ntfy app.' : 'ntfy refused (' + res.status + '). Try again in a bit.');
  } catch (e) { toast('Couldn\'t reach ntfy.sh. Check your internet.'); }
}
// contas smurf no perfil (até 2): o plano junta as coleções e diz que Moments mandar para que conta
function smurfFormHtml() {
  const sms = S.smDraft || (S.smDraft = smurfList().map(x => Object.assign({}, x)));
  return '<div class="field-lbl"><span class="label">Smurf accounts</span>' + helpBtn('smurf') + '</div>' +
    sms.map((x, i) => '<div class="smurf-row stack"><div class="label">Smurf ' + (i + 1) + '</div>' +
      '<label class="small muted">Top Shot username<input class="field" id="smTs' + i + '" maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false" value="' + esc(x.topshot_username || '') + '"></label>' +
      '<label class="small muted">Flow address<input class="field" id="smFlow' + i + '" maxlength="18" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="0x…" value="' + esc(x.flow_address || '') + '"></label>' +
      '<button class="btn small quiet" type="button" data-action="sm-del" data-i="' + i + '">Remove this smurf</button></div>').join('') +
    (sms.length < 2 ? '<button class="btn" type="button" data-action="sm-add">Add smurf</button>' : '');
}
// guarda no rascunho o que está escrito nos campos das smurf
function smurfReadInputs() {
  (S.smDraft || []).forEach((x, i) => {
    const t = $('smTs' + i), f = $('smFlow' + i);
    if (t) x.topshot_username = t.value.trim().replace(/^@+/, '').replace(/^https?:\/\/[^/]*\/user\/@?/i, '');
    if (f) x.flow_address = f.value.trim();
  });
  return S.smDraft || [];
}
function smurfsToSave() {
  const list = smurfReadInputs().filter(x => x.topshot_username || x.flow_address);
  const taken = new Set(list.map(x => x.id).filter(Boolean));
  return list.map((x, i) => {
    if (x.flow_address && !/^0x[0-9a-fA-F]{16}$/.test(x.flow_address)) throw new Error('The Flow address of smurf ' + (i + 1) + ' has to be 0x followed by 16 characters.');
    let id = x.id; if (!id) { id = ['s1', 's2'].find(k => !taken.has(k)); taken.add(id); }
    return { id, topshot_username: x.topshot_username || null, flow_address: x.flow_address || null };
  });
}
// apaga de uma vez todas as runs de teste (fictícias); os dias, planteis e resumos delas vão com elas
async function deleteTestRuns() {
  const list = S.runs.filter(r => r.fictitious); if (!list.length) return;
  if (!confirm('Delete ' + (list.length === 1 ? 'the test run' : 'the ' + list.length + ' test runs') + '? Everyone\'s rosters and plans in those runs also disappear.')) return;
  let n = 0;
  for (const r of list) if (await adminWrite(sb.from('runs').delete().eq('id', r.id))) n++;
  toast(n === 1 ? 'Test run deleted.' : n + ' test runs deleted.');
  try { if (list.some(r => r.id === localStorage.getItem('fb-run'))) localStorage.removeItem('fb-run'); } catch (e) {}
  await loadShared(); await loadRun(pickRun()); compute(); render(); renderAjustes();
}
async function deleteRun(run) {
  if (!run || !run.fictitious) return;
  if (!confirm('Delete "' + run.name + '"? Everyone\'s rosters and plans in this run also disappear.')) return;
  if (!(await adminWrite(sb.from('runs').delete().eq('id', run.id), 'Run deleted.'))) return;
  await loadShared(); await loadRun(pickRun());
  renderAjustes();
}
// runs da blockchain a decorrer ou a começar que ainda não estão no site: importam-se com um toque
const etDay = ms => new Date(ms - 4 * 3600e3).toISOString().slice(0, 10);
function chainImportCard() {
  const now = Date.now() / 1000, linked = new Set(S.runs.map(r => r.chain_run_id).filter(Boolean));
  const list = (S.chainRuns || []).filter(c => c.run_end && c.run_end > now && c.run_start && c.run_start < now + 30 * 86400 && !linked.has(c.id));
  if (!list.length) return '';
  return '<div class="card"><div class="list-head"><h2>Blockchain runs to import</h2><span class="small muted">' + list.length + '</span></div><ul class="list">' +
    list.map(c => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(c.name || c.id) + '</span></div><div class="ps">' + dShort(etDay(c.run_start * 1000)) + ' – ' + dShort(etDay((c.run_end - 12 * 3600) * 1000)) + '</div></div><button class="btn small primary" type="button" data-action="chain-import" data-id="' + esc(c.id) + '">Import</button></li>').join('') +
    '</ul><div class="row small muted" style="display:block">It’s linked and active right away. Goals and games arrive with the GitHub jobs (run them in Actions to get them now).</div></div>';
}
async function chainImport(cid) {
  const c = (S.chainRuns || []).find(x => x.id === cid); if (!c) return;
  const start = etDay(c.run_start * 1000), endD = etDay((c.run_end - 12 * 3600) * 1000), end = endD < start ? start : endD;
  const n = (c.name || '').match(/run\s*(\d+)/i);
  const name = n ? 'Run ' + n[1] + (/classic/i.test(c.name || '') ? ' · Classic' : '') : (c.name || 'Run');
  const id = ((c.name || 'run').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)) || 'run-' + start.replace(/-/g, '');
  if (S.runs.some(r => r.id === id)) { toast('There is already a run with that name on the site.'); return; }
  const dates = []; for (let d = start; d <= end && dates.length < 40;) { dates.push(d); const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); d = x.toISOString().slice(0, 10); }
  if (S.runs.some(r => r.active)) await adminWrite(sb.from('runs').update({ active: false }).eq('active', true));
  if (!(await adminWrite(sb.from('runs').insert({ id, name, mode: 'classic', start_date: start, end_date: end, prizes: [], active: true, chain_run_id: c.id, fictitious: false })))) return;
  await adminWrite(sb.from('run_days').insert(dates.map(date => ({ run_id: id, date }))), name + ' imported: ' + dates.length + ' days. Run the tasks in Actions so the goals and games arrive now.');
  try { localStorage.removeItem('fb-run'); } catch (e) {}
  await loadShared(); await loadRun(id); compute(); render(); renderAjustes();
}
// ---- run lida no Top Shot (botão "Run e prémios" do Admin): cria ou completa a run do site ----
// Serve de reserva à tarefa da blockchain: dias, objetivos de cada dia e prémios (da run e de cada dia).
const runSlug = n => (String(n || 'run').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)) || 'run';
const tsObjs = d => (d.objs || []).map(o => { const stat = FB.mapStat(o.k) || FB.mapStat(o.a), x = { stat, target: +o.t || 0, name: o.a || o.k || '?' }; if (/INDIVIDUAL|EACH|PER_PLAYER|SINGLE/i.test(String(o.ty || (o.raw || {}).type || ''))) x.each = true; return x; });
const objKey = list => JSON.stringify((list || []).filter(o => o && o.stat && +o.target > 0).map(o => [o.stat, +o.target, !!o.each]));
async function runPlan(x) {
  const days = (x.days || []).filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));
  const start = days.length ? days[0].date : x.starts ? etDay(Date.parse(x.starts)) : null;
  const end = days.length ? days[days.length - 1].date : x.ends ? etDay(Date.parse(x.ends) - 12 * 3600e3) : start;
  if (!start) return null;
  const n = String(x.name || x.id || '').match(/run\s*(\d+)/i);
  const name = n ? 'Run ' + n[1] + ' · Classic' : (x.name || 'Run Classic');
  const site = S.runs.find(r => !r.fictitious && r.start_date && Math.abs(Date.parse(r.start_date) - Date.parse(start)) <= 3 * 864e5) || null;
  let have = [];
  if (site) have = site.id === S.runId ? S.days : ((await q(sb.from('run_days').select('date,objectives').eq('run_id', site.id)).catch(() => [])) || []);
  const byDate = new Map(have.map(d => [d.date, d]));
  const unknown = new Set();
  const rows = days.map(d => {
    const objs = tsObjs(d); objs.filter(o => !o.stat).forEach(o => unknown.add(o.name));
    const ok = objs.filter(o => o.stat && o.target > 0).map(o => { const y = { stat: o.stat, target: o.target }; if (o.each) y.each = true; return y; });
    const h = byDate.get(d.date);
    const kind = !h ? 'k-new' : !ok.length ? 'k-same' : objKey(h.objectives) === objKey(ok) ? 'k-same' : 'k-chg';
    return { date: d.date, objs: ok, old: h ? h.objectives || [] : null, kind, n: d.n, unk: objs.filter(o => !o.stat).map(o => o.name) };
  });
  const id = site ? site.id : (S.runs.some(r => r.id === runSlug(name)) ? runSlug(name) + '-' + start.replace(/-/g, '').slice(2) : runSlug(name));
  return { x, start, end, name: site ? site.name : name, id, site, rows, unknown: [...unknown], extend: site && (start < site.start_date || end > site.end_date) };
}
async function runReviewSheet() {
  const R = S.runRead; if (!R) return;
  const money = c => { const v = c / 100; return '$' + (v % 1 ? v.toFixed(2).replace('.', ',') : v.toLocaleString('en-GB')); };
  const bandTxt = bs => (bs || []).map(b => (b[0] === b[1] ? b[0] + '.º' : b[0] + '–' + b[1]) + ' ' + (b[2] ? money(b[2]) : esc(b[3] || ''))).join(' · ');
  const plans = [];
  for (const x of R.runs) plans.push(await runPlan(x));
  const today = todayET(), prev = S.runs.filter(r => !r.fictitious && (r.prizes || []).length).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0];
  const card = (P, i) => {
    if (!P) return '<div class="note">' + esc(R.runs[i].name || R.runs[i].id) + ': no dates (Top Shot doesn’t show the days yet).</div>';
    const x = P.x, ch = P.rows.filter(r => r.kind !== 'k-same').length + (P.extend ? 1 : 0), withObj = P.rows.filter(r => r.objs.length).length;
    const rows = P.rows.map((r, k) => '<li class="row"><span><b>Day ' + (k + 1) + '</b> <span class="muted">' + dWeek(r.date) + ' ' + dShort(r.date) + '</span><br>' + (r.objs.length ? esc(objsText({ objectives: r.objs })) : r.unk.length ? '<span class="muted">' + esc(r.unk.join(' + ')) + ' (unknown stat)</span>' : '<span class="muted">goal not out yet</span>') +
      (r.kind === 'k-chg' ? '<br><span class="small muted">before: ' + esc(objsText({ objectives: r.old })) + '</span>' : '') + '</span><span class="pill' + (r.kind === 'k-new' ? ' ok' : r.kind === 'k-chg' ? ' duv' : '') + '">' + (r.kind === 'k-new' ? 'new' : r.kind === 'k-chg' ? 'changes' : 'same') + '</span></li>').join('');
    const dayBands = ((x.days || []).find(d => (d.bands || []).length) || {}).bands || [];
    return '<div class="card"><div class="list-head"><h2>' + esc(P.name) + '</h2><span class="small muted">' + dShort(P.start) + ' – ' + dShort(P.end) + ' · ' + plural(P.rows.length || 0, 'day', 'days') + '</span></div>' +
      '<div class="row small" style="display:block">' + (P.site ? 'Already on the site' + (P.site.chain_run_id ? ' (linked to the blockchain)' : '') + '. ' : 'Not on the site yet: it will be created. ') + withObj + ' of ' + P.rows.length + ' days with a goal.' + (P.extend ? ' The dates change to ' + dShort(P.start) + ' – ' + dShort(P.end) + '.' : '') + '</div>' +
      (P.unknown.length ? '<div class="note">Stat I don’t know: ' + esc(P.unknown.join(', ')) + ' (those goals are left out).</div>' : '') +
      (x.daysErr ? '<div class="note">Couldn’t read the days: ' + esc(x.daysErr) + '</div>' : '') +
      (rows ? '<ul class="list">' + rows + '</ul>' : '') +
      '<div class="row small" style="display:block"><b>Run prizes</b>' + (x.qual ? ' (top ' + x.qual + ' qualify)' : '') + ': ' + (x.bands.length ? bandTxt(x.bands) : '<span class="muted">Top Shot didn’t show them</span>') + '</div>' +
      (dayBands.length ? '<div class="row small" style="display:block"><b>Daily prizes</b>: ' + bandTxt(dayBands) + '</div>' : '') +
      (!P.site ? '<div class="row small muted" style="display:block">Win tiers for the plan: ' + (prev ? 'those of ' + esc(prev.name) + ' (' + prev.prizes.map(p => p.wins + 'W').join(' · ') + ')' : 'none') + '. ' + (P.start <= today || !S.runs.some(r => r.active && !r.fictitious && r.end_date >= today) ? 'It becomes the active run.' : 'It becomes active when it starts (tap Run and prizes again that day).') + '</div>' : '') +
      '<div class="btns" style="padding:4px 16px 14px"><button class="btn primary" type="button" data-action="run-apply" data-i="' + i + '"' + (ch || !P.site || (P.start <= today && !P.site.active && P.site.end_date >= today) ? '' : ' disabled') + '>' + (!P.site ? 'Create the run' : ch ? 'Apply ' + plural(ch, 'change', 'changes') : P.start <= today && !P.site.active && P.site.end_date >= today ? 'Activate the run' : 'Nothing to change') + '</button></div></div>';
  };
  const raw = R.runs.length ? JSON.stringify({ run: R.runs[0].raw, dia: ((R.runs[0].days || [])[0] || {}).raw, objetivo: ((((R.runs[0].days || [])[0] || {}).objs || [])[0] || {}).raw }, null, 1) : '';
  openSheet('<h3>Run read on Top Shot</h3><div class="small muted">' + (R.at ? 'Read ' + ago(R.at) + '. ' : '') + 'Check before applying.</div>' +
    (R.err ? '<div class="note">Didn’t work: ' + esc(R.err) + '</div>' : '') +
    (!R.runs.length && !R.err ? '<div class="note info">Top Shot didn’t show any NBA Classic run. If the new run hasn’t started yet, try on its first day.</div>' : '') +
    plans.map(card).join('') +
    (raw ? '<details class="small muted"><summary>Fields read (for troubleshooting)</summary><pre style="white-space:pre-wrap;word-break:break-all">' + esc(raw) + '</pre></details>' : ''));
}
async function runApply(i) {
  const R = S.runRead, x = R && R.runs[i]; if (!x) return;
  const P = await runPlan(x); if (!P) return;
  const today = todayET(), others = S.runs.filter(r => r.active && !r.fictitious && r.id !== P.id);
  let ok = true, active = false;
  if (!P.site) {
    active = P.start <= today || !S.runs.some(r => r.active && !r.fictitious && r.end_date >= today);
    const prev = S.runs.filter(r => !r.fictitious && (r.prizes || []).length).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0];
    if (active && S.runs.some(r => r.active)) ok = await adminWrite(sb.from('runs').update({ active: false }).eq('active', true));
    if (ok) ok = await adminWrite(sb.from('runs').insert({ id: P.id, name: P.name, mode: 'classic', start_date: P.start, end_date: P.end, prizes: prev ? prev.prizes : [], active, fictitious: false }));
  } else {
    const patch = {};
    if (P.start < P.site.start_date) patch.start_date = P.start;
    if (P.end > P.site.end_date) patch.end_date = P.end;
    if (P.start <= today && !P.site.active && P.site.end_date >= today) { patch.active = true; active = true; if (others.length) ok = await adminWrite(sb.from('runs').update({ active: false }).eq('active', true)); }
    if (ok && Object.keys(patch).length) ok = await adminWrite(sb.from('runs').update(patch).eq('id', P.id));
    active = active || P.site.active;
  }
  if (!ok) return;
  let nNew = 0, nCh = 0;
  for (const r of P.rows) {
    if (r.kind === 'k-new') {
      let games = [];
      try { games = (await espnBoard(r.date)).filter(g => g.away && g.home).map(g => [g.away, g.home, g.start || null, 'espn:' + g.id]); } catch (e) { /* os jogos chegam com a tarefa do calendário */ }
      if (await adminWrite(sb.from('run_days').upsert({ run_id: P.id, date: r.date, objectives: r.objs, games }, { onConflict: 'run_id,date' }))) nNew++;
    } else if (r.kind === 'k-chg') {
      if (await adminWrite(sb.from('run_days').update({ objectives: r.objs }).eq('run_id', P.id).eq('date', r.date))) nCh++;
    }
  }
  toast((P.site ? P.name + ': ' : P.name + ' created: ') + [nNew ? plural(nNew, 'new day', 'new days') : '', nCh ? plural(nCh, 'goal changed', 'goals changed') : ''].filter(Boolean).join(', ') + (active ? ' · active run' : '') + '.');
  try { if (active) localStorage.removeItem('fb-run'); } catch (e) {}
  await loadShared();
  if (active || P.id === S.runId) await loadRun(P.id);
  compute(); render(); renderAjustes();
  runReviewSheet();
}
// ---- Tarefas pedidas no site (ler as odds agora): o pedido fica na base e a tarefa "Pedidos do site" corre-o ----
async function loadJobReq() {
  S.jobReq = null; // a carregar
  const { data, error } = await sb.rpc('job_requests');
  const was = S.jobReqWas, odds = !error && data ? data.odds : null;
  S.jobReq = error ? false : (data || {});
  // acabou de correr: lê as odds novas (o plano refaz-se sozinho)
  if (was && odds && odds.done && odds.at === was) { S.jobReqWas = null; refreshOdds(); toast(odds.ok === false ? 'Reading the odds failed (check the job on GitHub).' : 'Odds read.'); }
  if (odds && !odds.done) { S.jobReqWas = odds.at; clearTimeout(S.jobReqT); S.jobReqT = setTimeout(() => { if (S.tab === 'ajustes' && subOf('ajustes') === 'admin') loadJobReq(); else S.jobReq = undefined; }, 60e3); }
  const el = $('jobsCard'); if (el) el.outerHTML = jobsCard(); // só este cartão (pode haver um campo a meio)
}
function jobsCard() {
  const J = S.jobReq, o = J ? J.odds : null, pending = !!(o && !o.done);
  const last = Object.values(S.odds || {}).map(x => x.updated_at).filter(Boolean).sort().pop();
  const status = J === false ? '<div class="note">For this button to work, run the new <span class="kbd">supabase/schema.sql</span> in Supabase (SQL Editor).</div>'
    : '<div class="small muted">' + (pending ? 'Requested at ' + hm(o.at) + '. The job picks it up in 5–15 min and the app redoes the plan by itself.' : 'Odds read ' + (last ? ago(last) : 'not yet') + (o && o.ran ? ' · last request ' + ago(o.ran) + (o.ok === false ? ' (failed)' : '') : '') + '.') + '</div>';
  return '<div class="card panel" id="jobsCard"><h2>Jobs</h2><div class="ts-read"><button class="btn" type="button" data-action="job-odds"' + (pending || J === false || J == null ? ' disabled' : '') + '>Read the odds now</button><span class="small muted">Today and tomorrow. Uses The Odds API credits (~1 per game).</span></div>' + status + '</div>';
}
async function jobOdds() {
  const { data, error } = await sb.rpc('request_job', { kind: 'odds' });
  if (error) { toast(errText(error)); return; }
  if (data && data.ok === false) toast('There’s already a request from ' + hm(data.at) + ' waiting.');
  else toast('Requested. The odds arrive in 5–15 min.');
  loadJobReq();
}
function adminHtml(run) {
  const out = [];
  const site = location.origin + location.pathname;
  // leituras no Top Shot (só o admin): cada uma abre o Fast Break no Top Shot e volta com o que leu
  out.push('<div class="card panel"><h2>Read on Top Shot</h2>' +
    (S.edPending && edOn() ? '<div class="note sug"><div>Card reading waiting for your OK (rarity and ASP).</div><div class="btns"><button class="btn primary" type="button" data-action="ed-review">See what changes</button></div></div>' : '') +
    // leituras juntas (pedido do João): o dia a dia num botão, os preços noutro
    '<div class="ts-read"><button class="btn primary" type="button" data-action="ranks-go" data-do="ranks,picks,lu,hist">Standings, picks, lineups and Historic</button><span class="small muted">1–2 minutes. Once a day, in the morning or before the games.</span></div>' +
    '<div class="ts-read"><button class="btn" type="button" data-action="ranks-go" data-do="' + (edOn() ? 'px,ed' : 'px') + '">Player prices' + (edOn() ? ' and card ASP' : '') + '</button><span class="small muted">2–4 minutes. Every now and then.</span></div>' +
    '<div class="ts-read"><button class="btn" type="button" data-action="ranks-go" data-do="pro">Pro prices</button><span class="small muted">2–3 minutes. The cheapest card of each Pro set family. Once a day is enough.</span></div>' +
    '<div class="ts-read"><button class="btn" type="button" data-action="ranks-go" data-do="run">Run and prizes</button><span class="small muted">Quick. When a new run comes out, if the blockchain doesn’t bring it.</span></div>' +
    (S.runRead ? '<div class="note sug"><div>Run read on Top Shot.</div><div class="btns"><button class="btn primary" type="button" data-action="run-review">See what changes</button></div></div>' : '') +
    '<div class="small muted">On Top Shot tap the <b>FB lugares</b> bookmark and then <b>Leaderboard</b>. <a href="' + siteBase() + 'lugares.html" target="_blank" rel="noopener">How to install</a></div></div>');
  out.push(jobsCard());
  const imp = chainImportCard(); if (imp) out.push(imp);
  if (S.runs.some(r => r.fictitious)) out.push('<div class="card panel"><button class="btn quiet" type="button" data-action="del-tests">Delete the test runs (' + S.runs.filter(r => r.fictitious).length + ')</button></div>');
  out.push('<div class="card panel"><h2>Invite friends</h2><div class="small muted">Send them the link and the code.</div>' +
    '<div class="status-line"><span>Site</span><span class="kbd">' + esc(site) + '</span></div>' +
    '<div class="status-line"><span>Current code</span><span class="kbd">' + (S.invite == null ? '…' : S.invite ? esc(S.invite) : 'none') + '</span></div>' +
    '<form id="inviteForm" class="toolbar"><input class="field" id="invCode" placeholder="New code (min. 4)" autocomplete="off" autocapitalize="none" spellcheck="false"><button class="btn" type="submit">Change</button></form></div>');
  const members = S.group.members.map(m => { const p = S.group.profiles.find(x => x.user_id === m.user_id) || {}; return { m, p }; });
  if (members.length) out.push('<div class="card"><div class="list-head"><h2>Members</h2><span class="small muted">' + members.length + '</span></div><ul class="list">' + members.map(({ m, p }) => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.display_name || 'No name') + '</span>' + (m.role === 'admin' ? '<span class="badge">admin</span>' : '') + '</div><div class="ps">' + esc(p.topshot_username || 'no Top Shot username') + '</div></div>' + (m.user_id !== S.session.user.id ? '<button class="btn small quiet" type="button" data-action="kick" data-id="' + esc(m.user_id) + '">Remove</button>' : '<span></span>') + '</li>').join('') + '</ul></div>');
  return out.join('');
}
function dataHtml() {
  const lines = [];
  const playersUpd = [...S.players.values()].reduce((m, p) => p.updated_at > m ? p.updated_at : m, '');
  lines.push(['NBA players', S.players.size ? S.players.size + ' · ' + ago(playersUpd) : 'none yet']);
  const oddsDates = Object.keys(S.odds).sort();
  lines.push(['Odds', oddsDates.length ? oddsDates.map(dShort).join(', ') + ' · ' + ago(S.odds[oddsDates[oddsDates.length - 1]].updated_at) : 'none for this run yet']);
  const withGames = S.days.filter(d => (d.games || []).length).length;
  lines.push(['Schedule', S.days.length ? withGames + ' of ' + S.days.length + ' days with games' : '—']);
  lines.push(['Injuries', S.injOk ? Object.keys(S.injuries).length + ' on the report · ' + ago(S.injAt) : 'the new supabase/schema.sql still has to be run']);
  lines.push(['Blockchain', S.chainRuns.length ? S.chainRuns.length + ' runs read' : 'waiting for the first read']);
  return '<div class="card panel"><h2>Data ' + helpBtn('dados') + '</h2>' + lines.map(([a, b]) => '<div class="status-line"><span>' + esc(a) + '</span><span class="muted">' + esc(b) + '</span></div>').join('') + '</div>';
}

// ---------- folhas ----------
// a folha é um diálogo: o resto da app fica inerte enquanto está aberta, o foco entra nela e volta ao botão que a abriu
// em cima: ‹ para voltar à folha anterior (quando há) e × para fechar; o botão/gesto de voltar do telemóvel faz o mesmo
const icoBack = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const icoX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
function openSheet(html, back) {
  S.sheetBack = back || null;
  const p = $('sheetPanel');
  if (S.lu && $('luBody')) S.lu.y = p.scrollTop; // ao sair do Mudar para outra folha (jogador, quem entra): voltar ao mesmo sítio
  if ($('sheet').hidden) S.sheetFrom = document.activeElement;
  p.innerHTML = '<div class="sheet-bar">' + (back ? '<button class="sheet-ic" type="button" data-action="sheet-back" aria-label="Back">' + icoBack + '</button>' : '<span></span>') +
    '<div class="grab" aria-hidden="true"></div><button class="sheet-ic" type="button" data-action="close-sheet" aria-label="Close">' + icoX + '</button></div>' + html;
  const h = p.querySelector('h2, h3');
  if (h) p.setAttribute('aria-labelledby', h.id || (h.id = 'sheetTitle')); else p.removeAttribute('aria-labelledby');
  p.querySelectorAll('[id$="Prog"]').forEach(x => x.setAttribute('role', 'status')); // "a calcular…" lido pelo leitor de ecrã
  $('sheet').hidden = false; $('app').inert = true; p.scrollTop = 0;
  if (!p.contains(document.activeElement)) p.focus({ preventScroll: true });
  sheetGuard();
}
function closeSheet(fromBack) {
  $('sheet').hidden = true; $('sheetPanel').innerHTML = ''; S.sheetBack = null; S.sheetPl = null; S.lu = null; $('app').inert = false; sheetFit();
  const f = S.sheetFrom; S.sheetFrom = null;
  if (f && f.isConnected && typeof f.focus === 'function') f.focus({ preventScroll: true });
  if (!fromBack) sheetUnguard();
}
// botão/gesto de voltar do telemóvel: com uma folha aberta, volta à folha anterior ou fecha-a (em vez de sair da app).
// Enquanto há uma folha aberta fica uma entrada a mais no histórico; ao fechar de outra maneira (×, fundo, Esc) sai.
// teclado do telemóvel: no iPhone o teclado tapa o fundo do ecrã sem encolher a página, e a folha (presa ao fundo)
// ficava por baixo dele. Com o teclado aberto a folha ocupa só a parte visível; a procura do Mudar sobe para o topo.
function sheetFit() {
  const vv = window.visualViewport, sh = $('sheet'); if (!vv || !sh) return;
  const kb = !sh.hidden && vv.scale < 1.05 && window.innerHeight - vv.height > 80, was = sh.classList.contains('kb');
  sh.classList.toggle('kb', kb);
  if (kb) { sh.style.top = vv.offsetTop + 'px'; sh.style.height = vv.height + 'px'; sh.style.bottom = 'auto'; sh.style.setProperty('--vvh', vv.height + 'px'); }
  else if (was) { sh.style.top = sh.style.height = sh.style.bottom = ''; sh.style.removeProperty('--vvh'); }
  const a = document.activeElement;
  if (kb && !was && a && a.id === 'luSearch') luSearchTop(a);
}
if (window.visualViewport) { visualViewport.addEventListener('resize', sheetFit); visualViewport.addEventListener('scroll', sheetFit); }
function luSearchTop(inp) {
  const p = $('sheetPanel'); if (!p || !p.contains(inp)) return;
  const c = inp.closest('.card') || inp, bar = p.querySelector('.sheet-bar');
  p.scrollTop += c.getBoundingClientRect().top - p.getBoundingClientRect().top - (bar ? bar.offsetHeight : 0) - 4;
}
document.addEventListener('focusin', e => { if (e.target && e.target.id === 'luSearch') { const t = e.target; luSearchTop(t); setTimeout(() => { if (document.activeElement === t) { sheetFit(); luSearchTop(t); } }, 350); } });
function sheetGuard() { try { if (!(history.state && history.state.fbSheet)) history.pushState({ fbSheet: 1 }, ''); } catch (e) { /* sem histórico: só os botões */ } }
function sheetUnguard() { setTimeout(() => { try { if ($('sheet').hidden && history.state && history.state.fbSheet) { S.popIgnore = true; history.back(); } } catch (e) {} }, 0); }
window.addEventListener('popstate', () => {
  if (S.popIgnore) { S.popIgnore = false; return; }
  if ($('sheet').hidden) return;
  const fn = S.sheetBack;
  if (fn) fn(); else closeSheet(true);
});
function dayInfo(date) { const r = S.result; const md = r && r.model.days.find(x => x.day.date === date); const d = md && view().days.find(x => x.date === date); return { md, d }; }

// ---- comparar os jogadores de um dia (forma, minutos, lançamentos, adversário) ----
const GK = ['min', 'pts', 'reb', 'ast', 'fg3', 'fgm', 'fga', 'fg3a', 'ftm', 'fta', 'tov', 'stl', 'blk', 'oreb']; // ordem dos jogos guardados
const nn = x => (x != null && x !== '' && isFinite(+x) ? +x : null);
const ratio = (a, b) => (nn(a) != null && nn(b) > 0 ? 100 * a / b : null);
// "Shai Gilgeous-Alexander" → "S. Gilgeous-Alexander" (para colunas estreitas)
const shortName = n => { const t = String(n || '').trim().split(/\s+/); return t.length > 1 ? t[0][0] + '. ' + t.slice(1).join(' ') : t[0] || ''; };
function compareCard(md, d, date, inTab) {
  const r = S.result, objs = md.objs || [], kq = Math.min(S.cmpObj || 0, Math.max(0, objs.length - 1)), o = objs[kq], v = view();
  if (!o || !md.elig.length) return '';
  // colunas de todas as estatísticas do dia; projeção e forma da escolhida
  const terms = objs.flatMap(x => FB.statTerms(x.stat).map(t => t.s)), has = list => terms.some(t => list.includes(t));
  const locks = new Set(((curPlan().locks || {})[date]) || []);
  const rows = md.elig.map(pi => {
    const p = r.model.players[pi], info = md.info[pi][kq], a = p.avg || {}, f = a.form || null, l5 = (f && f.l5) || {}, fi = FB.formInfo(p, o.stat) || {};
    const g = FB.gameOf(md.day, p.team), opp = g ? (g[0] === p.team ? g[1] : g[0]) : null, home = g ? g[1] === p.team : false, m = FB.matchup(S.teams, opp, o.stat);
    return { p, info, a, f, l5, fi, g, opp, home, m, inL: d.lineup.includes(p.id), locked: locks.has(p.id), planned: (v.usage || {})[p.id] || 0 };
  });
  // colunas: [id, título, valor para ordenar, html, ajuda]
  const two = (now, season, fmt) => (now == null && season == null ? '<span class="muted">–</span>' : '<b>' + (now != null ? fmt(now) : '–') + '</b>' + (season != null ? '<small>' + fmt(season) + '</small>' : ''));
  const one = (x, fmt) => (x == null ? '<span class="muted">–</span>' : fmt(x));
  const pf = x => Math.round(x) + '%';
  const cols = [
    ['proj', 'Proj.', x => x.info.mu, x => '<b>' + f1(x.info.mu) + '</b>' + (x.info.src === 'odds' ? '<small>line ' + f1(x.info.line) + '</small>' : x.info.src === 'proxy' ? '<small>line ' + esc((STATS[x.info.via] || {}).short || '') + '</small>' : '<small>' + esc(srcShort(x.info)) + '</small>'), 'What the plan expects today (odds if available; otherwise averages with form and opponent)'],
    ['l5', 'Last 5', x => x.fi.l5, x => one(x.fi.l5, f1), 'Average over the last 5 games'],
    ['l10', 'Last 10', x => x.fi.l10, x => one(x.fi.l10, f1), 'Average over the last 10 games'],
    ['season', 'Season', x => x.fi.season, x => one(x.fi.season, f1), 'Season average'],
    ['min', 'MIN', x => nn(x.l5.min) != null ? x.l5.min : nn(x.a.min), x => two(nn(x.l5.min), nn(x.a.min), f0), 'Minutes: last 5 games (below, season)'],
  ];
  if (has(['pts', 'fgm', 'fga', 'fg3', 'fg3a', 'pip', 'ftm', 'fta'])) cols.push(
    ['fga', 'FGA', x => nn(x.l5.fga) != null ? x.l5.fga : nn(x.a.fga), x => two(nn(x.l5.fga), nn(x.a.fga), f1), 'Field goals attempted'],
    ['fgp', 'FG%', x => ratio(x.l5.fgm, x.l5.fga) != null ? ratio(x.l5.fgm, x.l5.fga) : ratio(x.a.fgm, x.a.fga), x => two(ratio(x.l5.fgm, x.l5.fga), ratio(x.a.fgm, x.a.fga), pf), 'Field goal percentage'],
    ['fg3a', '3PA', x => nn(x.l5.fg3a) != null ? x.l5.fg3a : nn(x.a.fg3a), x => two(nn(x.l5.fg3a), nn(x.a.fg3a), f1), 'Threes attempted'],
    ['fg3p', '3P%', x => ratio(x.l5.fg3, x.l5.fg3a) != null ? ratio(x.l5.fg3, x.l5.fg3a) : ratio(x.a.fg3, x.a.fg3a), x => two(ratio(x.l5.fg3, x.l5.fg3a), ratio(x.a.fg3, x.a.fg3a), pf), 'Three-point percentage'],
    ['fta', 'FTA', x => nn(x.l5.fta) != null ? x.l5.fta : nn(x.a.fta), x => two(nn(x.l5.fta), nn(x.a.fta), f1), 'Free throws attempted']);
  if (has(['reb', 'oreb', 'dreb'])) cols.push(
    ['oreb', 'OREB', x => nn(x.l5.oreb) != null ? x.l5.oreb : nn(x.a.oreb), x => two(nn(x.l5.oreb), nn(x.a.oreb), f1), 'Offensive rebounds'],
    ['dreb', 'DREB', x => nn(x.l5.dreb) != null ? x.l5.dreb : nn(x.a.dreb), x => two(nn(x.l5.dreb), nn(x.a.dreb), f1), 'Defensive rebounds']);
  if (has(['ast', 'tov'])) cols.push(
    ['ast', 'AST', x => nn(x.l5.ast) != null ? x.l5.ast : nn(x.a.ast), x => two(nn(x.l5.ast), nn(x.a.ast), f1), 'Assists'],
    ['tov', 'TOV', x => nn(x.l5.tov) != null ? x.l5.tov : nn(x.a.tov), x => two(nn(x.l5.tov), nn(x.a.tov), f1), 'Turnovers']);
  if (has(['stl', 'blk'])) cols.push(
    ['stl', 'STL', x => nn(x.l5.stl) != null ? x.l5.stl : nn(x.a.stl), x => two(nn(x.l5.stl), nn(x.a.stl), f1), 'Steals'],
    ['blk', 'BLK', x => nn(x.l5.blk) != null ? x.l5.blk : nn(x.a.blk), x => two(nn(x.l5.blk), nn(x.a.blk), f1), 'Blocks']);
  cols.push(
    ['opp', 'Opp.', x => (x.m ? x.m.f : 1), x => (x.m ? '<b class="' + (x.m.f >= 1.03 ? 'up' : x.m.f <= 0.97 ? 'down' : '') + '">' + (x.m.f >= 1 ? '+' : '−') + Math.round(Math.abs(x.m.f - 1) * 100) + '%</b><small>' + esc(x.opp) + '</small>' : '<span class="muted">–</span><small>' + (x.g && x.g[2] ? hm(x.g[2]) : '') + '</small>'), 'How much the opponent allows of this stat versus the league average (last 10 games)'],
    ['uses', 'Uses', x => x.p.uses || 0, x => '<b>' + (x.p.uses || 0) + '</b><small>plan ' + x.planned + '</small>', 'Uses left and how many the plan uses until the end']);
  const sort = S.cmpSort || { col: 'proj', dir: -1 }, col = cols.find(c => c[0] === sort.col) || cols[0];
  rows.sort((x, y) => { const a = col[2](x), b = col[2](y); if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1; return (a - b) * sort.dir; });
  const head = '<tr><th class="sticky">Player</th>' + cols.map(c => '<th><button type="button" data-action="cmp-sort" data-col="' + c[0] + '" data-date="' + date + '"' + (inTab ? ' data-in="tab"' : '') + ' title="' + esc(c[4]) + '" aria-sort="' + (sort.col === c[0] ? (sort.dir < 0 ? 'descending' : 'ascending') : 'none') + '">' + c[1] + (sort.col === c[0] ? (sort.dir < 0 ? ' ↓' : ' ↑') : '') + '</button></th>').join('') + '</tr>';
  const body = rows.map(x => '<tr class="' + (x.inL ? 'inl' : '') + '" data-action="player" data-id="' + esc(x.p.id) + '" data-date="' + date + '" tabindex="0"><th class="sticky"><span class="cn" title="' + esc(x.p.name) + '">' + (x.locked ? icoLock : x.inL ? '<i class="dot on" title="in the plan\'s lineup"></i>' : '') + esc(shortName(x.p.name)) + '</span><small>' + esc(x.p.team) + (x.opp ? (x.home ? ' vs ' : ' @ ') + esc(x.opp) : '') + (x.info.status !== 'ok' ? ' · ' + esc(STATUS[x.info.status].label) : '') + (x.info.b2b ? ' · back-to-back' : '') + '</small></th>' + cols.map(c => '<td>' + c[3](x) + '</td>').join('') + '</tr>').join('');
  const objChips = objs.length > 1 ? '<div class="chips" role="group" aria-label="Stat of the day" style="padding:0 14px 8px">' + objs.map((x, k) => '<button type="button" data-action="cmp-obj" data-k="' + k + '" data-date="' + date + '"' + (inTab ? ' data-in="tab"' : '') + ' aria-pressed="' + (k === kq) + '">' + esc(statShort(x.stat)) + ' · target ' + x.target + '</button>').join('') + '</div>' : '';
  return '<div class="card"><div class="list-head"><h2>Compare ' + helpBtn('comparar') + '</h2><span class="small muted">' + rows.length + ' play</span></div>' + objChips +
    '<div class="cmp-wrap" id="cmpWrap"><table class="cmp"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></div>';
}
// últimos jogos de um jogador (guardados pela tarefa diária)
function gamesTable(a) {
  const games = (((a || {}).form) || {}).games;
  if (!games || !games.length) return '';
  const ix = k => 2 + GK.indexOf(k), val = (g, k) => g[ix(k)];
  const pair = (g, m, t) => (val(g, m) != null ? val(g, m) + '-' + val(g, t) : '–');
  return '<div class="card"><div class="list-head"><h2>Last games</h2></div><div class="cmp-wrap"><table class="cmp games"><thead><tr><th class="sticky">Date</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th><th>FG</th><th>3PT</th><th>FT</th><th>TO</th><th>STL</th><th>BLK</th></tr></thead><tbody>' +
    games.map(g => '<tr><th class="sticky"><span class="cn">' + dShort(g[0]) + '</span><small>' + (g[1] ? esc(g[1]) : '') + '</small></th>' + ['min', 'pts', 'reb', 'ast', 'fg3'].map(k => '<td>' + (val(g, k) != null ? val(g, k) : '–') + '</td>').join('') +
      '<td>' + pair(g, 'fgm', 'fga') + '</td><td>' + pair(g, 'fg3', 'fg3a') + '</td><td>' + pair(g, 'ftm', 'fta') + '</td>' + ['tov', 'stl', 'blk'].map(k => '<td>' + (val(g, k) != null ? val(g, k) : '–') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></div>';
}
function playerSheet(id, date, back) {
  const r = S.result, pi = r.model.pIndex.get(id), p = r.model.players[pi];
  const { md, d } = dayInfo(date); if (!md) return;
  const day = md.day, o = (day.objectives || [])[0] || { stat: 'pts' }, info = md.info[pi][0] || { mu: 0, src: 'sem', status: 'ok', pPlay: 1 };
  const locked = (((curPlan().locks || {})[date]) || []).includes(id);
  const inPlan = view().days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1);
  const live = date === (nextDay() || {}).date && liveOn(date) && !!d.live, sub = live && d.live.submitted.includes(id);
  let liveHtml = '';
  if (live && sub) {
    const e = (((liveDoc(date) || {}).players || {})[id]) || {}, state = e.state || 'por';
    const objs = md.objs.length ? md.objs : [o];
    liveHtml = '<div class="card panel" style="gap:10px"><div class="label">Live</div><div class="chips" role="group" aria-label="Game status">' + [['por', 'Not started'], ['jogo', 'Playing'], ['fim', 'Finished']].map(([k, l]) => '<button type="button" data-action="live-state" data-id="' + esc(id) + '" data-state="' + k + '" aria-pressed="' + (state === k) + '">' + l + '</button>').join('') + '</div>' +
      (state !== 'por' ? objs.map((ob, k) => { const val = Math.round(FB.statValue(e.vals || {}, ob.stat, p.avg) * 10) / 10;
        return '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div class="stepper"><button type="button" data-action="live-val" data-id="' + esc(id) + '" data-k="' + k + '" data-d="-1" aria-label="One less">−</button><input class="num" id="liveVal-' + k + '" type="number" inputmode="decimal"' + (/-/.test(ob.stat) ? '' : ' min="0"') + ' value="' + val + '" data-action="live-input" data-id="' + esc(id) + '" data-k="' + k + '" aria-label="' + esc(statShort(ob.stat)) + ' so far"><button type="button" data-action="live-val" data-id="' + esc(id) + '" data-k="' + k + '" data-d="1" aria-label="One more">+</button></div><span class="small muted">' + esc(statShort(ob.stat)) + (state === 'fim' ? ' at the end' : ' so far') + '</span></div>'; }).join('') : '') +
      (state === 'jogo' ? '<div class="chips" role="group" aria-label="Quarter">' + [1, 2, 3, 4].map(qn => '<button type="button" data-action="live-q" data-id="' + esc(id) + '" data-q="' + qn + '" aria-pressed="' + (+e.q === qn) + '">' + qn + '.º</button>').join('') + '</div>' : '') + '</div>';
  } else if (live) liveHtml = '<div class="note info">Not in the submitted lineup.</div>';
  // por partes: Resumo (esperado, usos, fixar/tirar, ao vivo, lesão), Porquê (em que se baseia) e Últimos jogos
  const games = gamesTable(p.avg), PT = [['res', 'Summary'], ['porque', 'Why']].concat(games ? [['jogos', 'Last games']] : []);
  if (S.pTabId !== id) { S.pTab = 'res'; S.pTabId = id; } // outro jogador abre no Resumo
  const cur = PT.some(x => x[0] === S.pTab) ? S.pTab : 'res', part = (k, h) => '<div class="ptab stack" data-ptab="' + k + '"' + (k === cur ? '' : ' hidden') + '>' + h + '</div>';
  openSheet('<div class="who ph">' + face(id, 'lg') + '<div style="min-width:0"><h3>' + esc(p.name) + '</h3><div class="small muted">' + esc(p.team) + ' ' + esc(opp(p.team, day)) + ' · Day ' + (day.idx + 1) + ', ' + dShort(date) + '</div></div></div>' +
    '<div class="seg ptabs" role="tablist" aria-label="Card sections">' + PT.map(([k, l]) => '<button type="button" role="tab" data-action="ptab" data-v="' + k + '" aria-selected="' + (k === cur) + '" aria-pressed="' + (k === cur) + '">' + l + '</button>').join('') + '</div>' +
    part('res', '<div class="kv"><div><div class="label">Expected</div><div class="v num">' + (md.objs.length > 1 ? md.objs.map((x, k) => f1((md.info[pi][k] || {}).mu || 0)).join('<small> / </small>') : f1(info.mu)) + '</div><div class="small muted">' + (md.objs.length > 1 ? md.objs.map(x => esc(statShort(x.stat))).join(' / ') : esc(statShort(o.stat))) + '</div></div><div><div class="label">Uses</div><div class="v num">' + (p.uses || 0) + '</div><div class="small muted">left</div></div><div><div class="label">In the plan</div><div class="v num">' + inPlan.length + '</div><div class="small muted">' + (inPlan.length ? 'days ' + inPlan.join(', ') : '—') + '</div></div></div>' +
    '<div class="btns">' + (locked ? '<button class="btn" type="button" data-action="unlock" data-id="' + esc(id) + '" data-date="' + date + '">Unlock</button>' : '<button class="btn primary" type="button" data-action="lock" data-id="' + esc(id) + '" data-date="' + date + '">Lock on this day</button>') +
    '<button class="btn" type="button" data-action="ban" data-id="' + esc(id) + '" data-date="' + date + '">Remove from this day</button></div>' +
    liveHtml + injuryBlock(id, info.injury, date)) +
    part('porque', md.objs.length > 1 ? md.objs.map((x, k) => basisHtml(p, md.info[pi][k], x, md, id, true)).join('') : basisHtml(p, info, o, md, id)) + (games ? part('jogos', games) : ''), back);
}
function rosterSheet(id) {
  const e = S.mine.roster[id]; if (!e) return;
  S.sheetPl = id;
  const c = S.players.get(String(id)) || {}, v = view();
  const inPlan = v ? v.days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1) : [];
  const team = e.team || c.team || '', goneNote = gone(id) ? '<div class="note">He’s no longer on any NBA team (retired or unsigned): the plan doesn’t use him.</div>' : '';
  // usos de cada conta: usados nesta run, restantes (editáveis) e quantos o plano usa
  const planOfAcc = k => { const r = S.multi ? S.multi.byKey[k] : S.result; return r ? r.normal.days.filter(x => x.lineup.includes(id)).length : 0; };
  const usesRows = accounts().map(a => {
    const pk = a.id + '|' + id, left = S.pendingUses[pk] != null ? S.pendingUses[pk] : usesEff(e, id, a.id), usedN = usedCount(a.id, id);
    const top = colTopUses(id); // com Moments na coleção os usos vêm da melhor carta e não se mexem
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><div class="label">' + (groupMode() ? esc(a.label) : 'Uses left') + '</div><div class="small muted">' + (usedN ? 'used ' + usedN + '× · ' : '') + 'the plan uses ' + planOfAcc(a.id) + '</div>' +
      (top ? '<div class="small muted">from the best card: ' + esc(bestTierName(id)) + ' · ' + usesTxt(top) + '</div>' : '') + '</div>' +
      (top ? '<output class="num uses-fixed" id="usesOut-' + esc(a.id) + '">' + (top >= UNL ? '∞' : left) + '</output></div>' : '<div class="stepper"><button type="button" data-action="uses" data-acc="' + esc(a.id) + '" data-id="' + esc(id) + '" data-d="-1" aria-label="One use less">−</button><output class="num" id="usesOut-' + esc(a.id) + '" data-uses-out="' + esc(pk) + '">' + left + '</output><button type="button" data-action="uses" data-acc="' + esc(a.id) + '" data-id="' + esc(id) + '" data-d="1" aria-label="One use more">+</button></div></div>');
  }).join('');
  const games = S.days.filter(d => FB.teamsOn(d).has(team)).length;
  const avg = e.avg || c.avg;
  openSheet('<div class="who ph">' + face(id, 'lg') + '<div style="min-width:0"><h3>' + esc(nameOf(id)) + '</h3><div class="small muted">' + esc(team || 'no team') + ' · ' + games + ' games in the run · in the plan: ' + (inPlan.length ? 'days ' + inPlan.join(', ') : 'no day') + '</div></div></div>' + goneNote +
    (() => { const ci = ((((S.profile || {}).collection) || {}).players || {})[id] || (e.moments ? { moments: e.moments, sets: e.sets } : null); if (!ci) return '';
      const col = (S.profile || {}).collection;
      return ci.ids && col && col.items ? '' : '<div class="small muted">In the wallet: ' + (groupMode() && ci.owners ? Object.entries(ci.owners).map(([k, n]) => esc(accLabel(k)) + ' ' + n).join(' · ') : plural(ci.moments || 1, 'Moment', 'Moments')) + (ci.bySet ? ' · ' + esc(usesWhy(col, ci)) : '') + '</div>'; })() +
    injuryBlock(id, null, null) + cardsBlock(id) +
    (groupMode() ? '<div class="small muted">Uses left in each account</div>' : '') + usesRows + momentsBlock(id) + mktBlock(id) +
    (avg ? '<div><div class="label" style="margin-bottom:6px">Averages per game' + (c.gp ? ' (' + c.gp + ' games)' : '') + '</div><div class="kv sm">' + AVG_SHOW.map(k => { const a = FB.avgOf({ avg }, k); return a ? '<div><div class="label">' + STATS[k].short + (a.est ? '*' : '') + '</div><div class="v num">' + f1(a.v) + '</div></div>' : ''; }).join('') + '</div>' + (AVG_SHOW.some(k => (FB.avgOf({ avg }, k) || {}).est) ? '<div class="small muted" style="margin-top:6px">* estimated from the other averages</div>' : '') + '</div>' : '<div class="note info">No averages yet.</div>') +
    gamesTable(avg) +
    '<button class="btn" type="button" data-action="remove-player" data-id="' + esc(id) + '">Remove from roster</button>');
}
// ---------- mercado do Top Shot (tarefa "Mercado", lido da blockchain): preço mais baixo à venda e últimas vendas ----------
// S.mkt: pk → {at, asks: [{price, tier, serial, minted, set_name}], sales: [{price, tier, sold_at}]}; pk = nome normalizado
S.mkt = new Map();
// a tarefa Mercado (blockchain) foi desligada a 22 out: os preços vêm só do Top Shot (pxOf); as tabelas antigas não se leem
S.mktOff = true;
const mktKey = id => norm(nameOf(id)).replace(/ /g, '-');
const MKT_TIER = { 1: ['Common', 'Fandom'], 2: ['Rare'], 4: ['Legendary', 'Ultimate'] };
let mktBusy = null, mktWant = new Set();
function mktNeed(ids) {
  if (S.mktOff || !S.session) return;
  ids.forEach(id => { const k = mktKey(id), m = S.mkt.get(k); if (!m || Date.now() - m.at > 10 * 60e3) mktWant.add(k); });
  if (!mktWant.size || mktBusy) return;
  mktBusy = setTimeout(mktFetch, 50);
}
async function mktFetch() {
  const keys = [...mktWant]; mktWant = new Set();
  try {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [asks, sales] = await Promise.all([
      q(sb.from('market_asks').select('player_id,price,tier,serial,minted,set_name').in('player_id', keys).eq('active', true).order('price', { ascending: true }).limit(600)),
      q(sb.from('market_sales').select('player_id,price,tier,sold_at').in('player_id', keys).gte('sold_at', since).order('sold_at', { ascending: false }).limit(800)),
    ]);
    keys.forEach(k => S.mkt.set(k, { at: Date.now(), asks: (asks || []).filter(r => r.player_id === k), sales: (sales || []).filter(r => r.player_id === k) }));
  } catch (e) { if (/market_|relation|does not exist|schema cache/i.test(String(e && e.message))) S.mktOff = true; else console.warn('mercado', e); }
  mktBusy = null;
  mktFill();
  if (mktWant.size) mktNeed([]);
}
async function mktLoad(ids) {
  if (S.mktOff) return false;
  const keys = [...new Set(ids.map(mktKey))].filter(k => { const m = S.mkt.get(k); return !m || Date.now() - m.at > 10 * 60e3; });
  try {
    for (let i = 0; i < keys.length; i += 150) {
      const part = keys.slice(i, i + 150), asks = await q(sb.from('market_asks').select('player_id,price,tier,serial,minted,set_name').in('player_id', part).eq('active', true).order('price', { ascending: true }).limit(5000));
      part.forEach(k => S.mkt.set(k, { at: Date.now(), asks: (asks || []).filter(r => r.player_id === k), sales: [] }));
    }
    return true;
  } catch (e) { if (/market_|relation|does not exist|schema cache/i.test(String(e && e.message))) S.mktOff = true; return false; }
}
// preço de um jogador num escalão (uses: 1, 2 ou 4): {ask, serial, last, lastAt, n}
function mktOf(id, uses) {
  const x = pxOf(id);
  if (x) { const v = x.c[pxCol(uses)]; return { ask: v != null ? v / 100 : null, serial: null, last: null, lastAt: null, n: 0, ts: x.at }; }
  const m = S.mkt.get(mktKey(id)); if (!m) return null;
  const ts = MKT_TIER[uses] || ['Common', 'Fandom'], a = m.asks.filter(r => ts.includes(r.tier)), sl = m.sales.filter(r => ts.includes(r.tier));
  return { ask: a.length ? +a[0].price : null, serial: a.length ? a[0].serial : null, last: sl.length ? +sl[0].price : null, lastAt: sl.length ? sl[0].sold_at : null, n: sl.length };
}
const usd = x => '$' + (x >= 100 || Math.abs(x - Math.round(x)) < 0.005 ? f0(x) : (Math.round(x * 100) / 100).toFixed(2).replace('.', ','));
function mktTxt(id, uses) {
  const p = mktOf(id, uses);
  if (p && p.ask != null) return 'listed from <b class="num">' + usd(p.ask) + '</b>';
  if (p && p.ts) return '<span class="muted">no ' + tierName(uses) + ' for sale</span>';
  if (pxMiss(id)) return '<span class="muted">not found on Top Shot</span>';
  return '';
}
// marcador que se preenche quando os preços chegam
function mktSpan(id, uses) { if (S.mktOff && !pxOf(id)) return ''; if (!pxOf(id)) mktNeed([id]); return '<span class="mkt" data-mk="' + esc(id) + '" data-u="' + uses + '">' + mktTxt(id, uses) + '</span>'; }
function mktFill() {
  document.querySelectorAll('.mkt[data-mk]').forEach(el => { el.innerHTML = mktTxt(el.dataset.mk, +el.dataset.u); });
  document.querySelectorAll('.mkt-box[data-mk]').forEach(el => { el.outerHTML = mktBlock(el.dataset.mk); });
}
// ficha do jogador: um preço por escalão
function mktBlock(id) {
  const x = pxOf(id), upd = '';
  if (x) {
    const rows = [1, 2, 4].map((u, i) => '<div class="row" style="padding:8px 0;display:flex;justify-content:space-between;gap:10px"><span><b>' + tierName(u) + '</b></span><span class="small" style="text-align:right">' + (x.c[i] != null ? 'listed from <b class="num">' + usd(x.c[i] / 100) + '</b>' : '<span class="muted">none for sale</span>') + '</span></div>').join('');
    return '<div class="mkt-box"><div class="list-head" style="margin-bottom:4px"><span class="label">Top Shot market</span><span class="small muted">' + esc(ago(x.at)) + '</span></div>' + rows + (Date.now() - Date.parse(x.at) > 6 * 3600e3 ? upd : '') + '</div>';
  }
  if (S.mktOff) return '<div class="mkt-box"><div class="label" style="margin-bottom:4px">Top Shot market</div><div class="small muted">No prices read for this player yet.</div>' + upd + '</div>';
  const m = S.mkt.get(mktKey(id)); mktNeed([id]);
  const rows = m ? [1, 2, 4].map(u => { const p = mktOf(id, u); return p && p.ask != null ? '<div class="row" style="padding:8px 0;display:flex;justify-content:space-between;gap:10px"><span><b>' + tierName(u) + '</b></span><span class="small" style="text-align:right">listed from <b class="num">' + usd(p.ask) + '</b>' + (p.serial ? ' (#' + p.serial + ')' : '') + '</span></div>' : ''; }).join('') : '';
  return '<div class="mkt-box"' + (m ? '' : ' data-mk="' + esc(id) + '"') + '><div class="label" style="margin-bottom:4px">Top Shot marketplace</div>' + (m ? (rows ? rows + '<div class="small muted">Approximate (read from the blockchain). For the exact price, update on Top Shot.</div>' : '<div class="small muted">None of his Moments seen listed.</div>') + upd : '<div class="small muted">Reading prices…</div>') + '</div>';
}
// ---------- Vender ----------
// Três listas, das cartas de todas as tuas contas (procura por jogador, equipa ou raridade):
// · Não usadas: jogadores que nenhuma conta usa no resto da run (todas as cartas deles)
// · Repetidas: jogadores com mais de uma carta, com quantas de cada raridade; ao tocar, cada carta com o preço
// · Poupar: trocar a tua por uma igual (os mesmos usos ou mais) à venda mais barata; poupas a diferença (−5% na venda)
// O preço de cada carta é a mais barata à venda da mesma edição (low ask), lida com as Cartas (ASP) no Admin.
const SELL_FEE = 0.05;
const nContas = n => n + (n === 1 ? ' account' : ' accounts');
S.sellTab = (() => { try { return localStorage.getItem('fb-sell-tab') || 'naousadas'; } catch (e) { return 'naousadas'; } })();
function mkOf(id) {
  let best = null;
  [S.edMine].concat(((S.group || {}).summaries || []).map(x => x.share && x.share.ed)).forEach(d => { if (!d || !d.mk || !d.mk[id]) return; const at = (d.t || {})[id] || d.at; if (!best || at > best.at) best = { list: d.mk[id], at }; });
  return best;
}
function planDaysOf(id) {
  const k = String(canon(id)), rs = S.multi ? Object.values(S.multi.byKey) : [S.result];
  return rs.reduce((n, r) => n + ((r && r.normal && r.normal.days) || []).filter(d => d.lineup.some(x => String(canon(x)) === k)).length, 0);
}
// quantas vezes cada conta o usa nesta run: dias já jogados + o plano para os que faltam
function usageOf(id) {
  const k = String(canon(id)), per = {};
  accounts().forEach(a => {
    const played = Object.values(planOf(a.id).played || {}).filter(p => p && p.done && (p.lineup || []).some(x => String(canon(x)) === k)).length;
    const r = S.multi ? S.multi.byKey[a.id] : a.id === 'main' ? S.result : null;
    const plan = ((r && r.normal && r.normal.days) || []).filter(d => d.lineup.some(x => String(canon(x)) === k)).length;
    if (played + plan) per[a.id] = played + plan;
  });
  const ns = Object.values(per);
  return { per, total: ns.reduce((t, x) => t + x, 0), max: ns.length ? Math.max(...ns) : 0, accs: ns.length };
}
// jogadores usados nas outras runs (por run): {runId: Set(ids)}; lido uma vez quando se abre o Vender
async function loadPastUse() {
  if (S.pastUse || S.pastUseBusy || !S.session) return; S.pastUseBusy = true;
  try {
    const rows = (await q(sb.from('user_runs').select('run_id,plan').eq('user_id', S.session.user.id))) || [], out = {};
    rows.filter(r => r.run_id !== S.runId && S.runs.some(x => x.id === r.run_id && !x.fictitious)).forEach(r => {
      const pls = [r.plan || {}].concat(Object.values(((r.plan || {}).smurfs) || {})), set = new Set(); let any = false;
      pls.forEach(pl => Object.values(pl.played || {}).forEach(p => { if (p && p.done) { any = true; (p.lineup || []).forEach(x => set.add(String(canon(x)))); } }));
      if (any) out[r.run_id] = set;
    });
    S.pastUse = out;
  } catch (e) { S.pastUse = {}; }
  S.pastUseBusy = false; render();
}
// por jogador: as cartas (com usos, raridade e preço), o uso nesta run e que cartas chegam para ele.
// Cada conta que o usa n vezes precisa de uma carta com ≥ n usos (cada carta só joga numa conta por noite);
// escolhem-se as mais baratas que cheguem. As outras podem ir.
function sellPlayers() {
  const col = (S.profile || {}).collection; if (!col || !col.items) return null;
  const N = Math.max(1, accounts().length), by = {};
  Object.entries(col.items).forEach(([f, it]) => { if (it && it.p != null) (by[it.p] = by[it.p] || []).push(f); });
  return Object.entries(by).map(([id, fs]) => {
    const cards = fs.map(f => { const it = col.items[f], e = cardEd(col, f), u = cardUses(col, f), t = (e && e.tier) || momentTier(col, f); return { f, it, e, u, t, ask: e && e.ask ? e.ask : null, asp: e && e.asp > 0 ? e.asp : null }; })
      .sort((a, b) => (b.u - a.u) || ((a.ask == null ? 1e12 : a.ask) - (b.ask == null ? 1e12 : b.ask)));
    const use = S.result ? usageOf(id) : null;
    cards.forEach(c => { c.keep = false; });
    if (use && use.total) {
      Object.values(use.per).sort((a, b) => b - a).forEach(n => {
        const c = cards.filter(x => !x.keep && x.u >= n).sort((a, b) => (a.u - b.u) || ((a.ask == null ? 1e12 : a.ask) - (b.ask == null ? 1e12 : b.ask)))[0]
          || cards.filter(x => !x.keep).sort((a, b) => b.u - a.u)[0];
        if (c) c.keep = true;
      });
    } else if (!use) cards.slice(0, N).forEach(c => { c.keep = true; });
    const tc = {}; cards.forEach(c => { tc[c.t] = (tc[c.t] || 0) + 1; });
    const extra = cards.filter(c => !c.keep);
    return { id, cards, tc, N, use, days: S.result ? planDaysOf(id) : null, value: cards.reduce((t, c) => t + (c.ask || 0), 0), extra: extra.reduce((t, c) => t + (c.ask || 0), 0), nExtra: extra.length, team: pTeam(id) || '' };
  });
}
const tcTxt = tc => TIERS.slice().reverse().filter(t => tc[t]).map(t => tc[t] + ' ' + t).join(' · ');
const useTxt = u => !u || !u.total ? 'not used this run' : 'used ' + plural(u.total, 'time', 'times') + ' this run' + (u.accs > 1 ? ' (up to ' + u.max + ' per account)' : '');
// trocas que poupam: a tua carta (à venda por X) por uma do mesmo jogador da mesma raridade (por Y)
function sellSwaps(ps) {
  const out = [];
  ps.forEach(P => { const mk = mkOf(P.id); if (!mk) return;
    P.cards.forEach(c => { if (!c.ask) return;
      const [cb, ...cs] = String(c.it.s || '').split(' · '), same = m => (c.it.si != null && m[6] != null ? +m[6] === +c.it.si && +m[7] === +c.it.pi : setBaseN(m[4]) === setBaseN(cb) && (isStd(m[5]) ? !cs.length : norm(m[5]) === norm(cs.join(' · '))));
      // a mesma raridade (de qualquer set); de preferência com os mesmos usos ou mais
      const pool = mk.list.filter(m => TS_TIER(m[2]) === c.t && !same(m)).sort((a, b) => a[1] - b[1]);
      const alt = pool.find(m => m[0] >= c.u) || pool[0];
      if (!alt) return; const save = c.ask * (1 - SELL_FEE) - alt[1];
      if (save >= 100) out.push({ P, c, alt, save, less: alt[0] < c.u });
    }); });
  return out.sort((a, b) => b.save - a.save);
}
// rara a mais: o plano usa-o poucas vezes (por conta) e a carta que o joga dá mais usos do que precisa; vender essa e
// comprar a mais barata que chegue (quando não tens outra que chegue)
function sellDowngrades(ps) {
  const out = [];
  ps.forEach(P => { if (!P.use || !P.use.total) return; const mk = mkOf(P.id);
    P.cards.filter(c => c.keep && c.ask && c.u > 1).forEach(c => {
      const need = P.use.max; if (need >= c.u) return;
      const alt = mk ? mk.list.filter(m => m[0] >= need && m[0] < c.u).sort((a, b) => a[1] - b[1])[0] : null;
      if (!alt) return; const save = c.ask * (1 - SELL_FEE) - alt[1];
      if (save >= 100) out.push({ P, c, alt, save, need });
    }); });
  return out.sort((a, b) => b.save - a.save);
}
function sellHtml() {
  const col = (S.profile || {}).collection;
  if (!col || !col.items) return '<div class="note info">Read your wallet first (Players → Collection).</div>';
  loadPastUse();
  const ps = sellPlayers() || [], hasPx = ps.some(P => P.cards.some(c => c.ask));
  const past = S.pastUse || {}, pastIds = Object.keys(past);
  ps.forEach(P => { P.idle = 1 + pastIds.filter(r => !past[r].has(String(canon(P.id)))).length; }); // runs seguidas... e as outras em que não o usaste
  const unused = S.result ? ps.filter(P => P.use && !P.use.total).sort((a, b) => (b.idle - a.idle) || (b.value - a.value)) : [];
  const reps = ps.filter(P => P.cards.length > 1 && P.use && P.use.total && P.nExtra).sort((a, b) => (b.extra - a.extra) || (b.nExtra - a.nExtra));
  const swaps = sellSwaps(ps), downs = sellDowngrades(ps);
  S.sellData = { ps, swaps, downs };
  const tabs = [['naousadas', 'Not used', unused.length], ['repetidas', 'Duplicates', reps.length], ['raras', 'Spare rare', downs.length], ['poupar', 'Save', swaps.length]];
  const tab = tabs.some(x => x[0] === S.sellTab) ? S.sellTab : 'naousadas';
  const keyOf = P => esc(norm(nameOf(P.id)) + ' ' + String(P.team).toLowerCase() + ' ' + Object.keys(P.tc).join(' ').toLowerCase());
  const prow = (P, sub, rep) => { const v = rep ? P.extra : P.value, lbl = rep ? (P.nExtra > 1 ? 'low ask, extras' : 'low ask') : P.cards.length > 1 ? 'low ask, all' : 'low ask';
    return '<li data-n="' + keyOf(P) + '"><button class="row sell-row" type="button" data-action="sell-player" data-id="' + esc(P.id) + '"><span class="who">' + face(P.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(P.id)) + '</span></div>' +
    '<div class="ps">' + esc(P.team) + ' · ' + esc(tcTxt(P.tc)) + '</div>' + (sub ? '<div class="ps sell-why">' + sub + '</div>' : '') + '</div></span>' +
    '<span class="sell-g' + (v ? '' : ' none') + '"><b class="num">' + (v ? usd(v / 100) : '—') + '</b><small>' + (v ? lbl : 'no price') + '</small></span></button></li>'; };
  const srow = (x, i, act, line) => { const it = x.c.it, [base] = String(it.s || '').split(' · ');
    return '<li data-n="' + keyOf(x.P) + '"><button class="row sell-row" type="button" data-action="' + act + '" data-i="' + i + '"><span class="who">' + face(x.P.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(x.P.id)) + '</span></div>' +
      '<div class="ps"><span class="tpill t-' + (TIER_CLS[x.c.t] || 'c') + '">' + esc(x.c.t) + '</span> ' + esc(base) + (it.n ? ' #' + f0(it.n) : '') + (groupMode() ? ' · ' + esc(accLabel(it.a)) : '') + '</div>' +
      '<div class="ps sell-why">' + line + '</div></div></span>' +
      '<span class="sell-g"><b class="num">+' + usd(x.save / 100) + '</b><small>saved</small></span></button></li>'; };
  const idleTxt = P => P.idle > 1 ? '<b class="c-warn">Unused in ' + P.idle + ' runs</b> (this one and ' + plural(P.idle - 1, 'another', 'others') + ')' : 'Not used in the whole run (days played and plan)';
  let list = '', empty = '';
  if (tab === 'naousadas') { list = unused.map(P => prow(P, idleTxt(P))).join(''); empty = S.result ? 'All your players are used this run.' : 'No plan calculated.'; }
  if (tab === 'repetidas') { list = reps.map(P => prow(P, esc(useTxt(P.use)) + ' · ' + plural(P.nExtra, 'extra card', 'extra cards'), true)).join(''); empty = 'No player with more cards than the plan uses.'; }
  if (tab === 'raras') { list = downs.map((x, i) => srow(x, i, 'sell-down', esc(useTxt(x.P.use)) + ' · enough: ' + (x.need === 1 ? 'a Common' : 'one with ' + usesTxt(x.need)) + ' for <b class="num">' + usd(x.alt[1] / 100) + '</b>')).join(''); empty = hasPx ? 'No card with more uses than the plan needs that’s worth swapping.' : 'Market prices are missing.'; }
  if (tab === 'poupar') { list = swaps.map((x, i) => srow(x, i, 'sell-swap', 'Sell for <b class="num">' + usd(x.c.ask / 100) + '</b> · buy for <b class="num">' + usd(x.alt[1] / 100) + '</b>' + (x.less ? ' · <span class="c-warn">gives ' + usesTxt(x.alt[0]) + '</span>' : ''))).join(''); empty = hasPx ? 'No swap that saves at least $1.' : 'Market prices are missing.'; }
  const ed = S.edMine && S.edMine.at ? S.edMine.at : null;
  return '<div class="card"><div class="list-head"><h2>Sell ' + helpBtn('vender') + '</h2><span class="small muted">prices ' + (ed ? ago(ed) : 'not read yet') + '</span></div>' +
    '<div class="lu-search"><input class="field" id="sellSearch" type="search" placeholder="Player, team or rarity…" autocomplete="off" aria-label="Search player, team or rarity" value="' + esc(S.sellQ || '') + '"></div>' +
    '<div class="chips scroll" role="group" aria-label="List" style="padding:0 16px 8px">' + tabs.map(([v, l, n]) => '<button type="button" data-action="sell-tab" data-v="' + v + '" aria-pressed="' + (tab === v) + '">' + l + ' <span class="muted">' + n + '</span></button>').join('') + '</div>' +
    (!hasPx ? '<div class="note info" style="margin:0 16px 10px">' + (S.edPending ? 'There’s a card reading waiting to be applied: Settings → Admin → <b>See what changes</b> → <b>Apply</b>.' : 'Card prices are missing: ' + (S.role === 'admin' ? 'read them in Settings → Admin → <b>Cards (ASP)</b>.' : 'ask the group admin to read the <b>Cards (ASP)</b>.')) +
      (S.edMine && S.edMine.at ? '<div class="small" style="margin-top:6px">Last reading ' + ago(S.edMine.at) + ': ' + (S.edMine.nAsk != null ? S.edMine.nAsk + ' editions with a price' : 'no prices (old script: reinstall it or use the bookmark)') + (S.edMine.askKeys ? ' · fields: ' + esc(S.edMine.askKeys.join(', ')) : '') + '</div>' : '') + '</div>' : '') +
    (list ? '<ul class="list" id="sellList">' + list + '<li class="row small muted sell-none" hidden>No one with that name, team or rarity.</li></ul>' : '<div class="row small muted">' + empty + '</div>') + '</div>';
}
function sellFilter() {
  const ul = $('sellList'); if (!ul) return;
  const q = norm(($('sellSearch') || {}).value || ''); let n = 0;
  ul.querySelectorAll('li[data-n]').forEach(li => { const ok = !q || li.dataset.n.includes(q); li.hidden = !ok; if (ok) n++; });
  const none = ul.querySelector('.sell-none'); if (none) none.hidden = !(q && !n);
}
// uma carta numa linha: raridade, set, número, conta, usos e o preço (low ask e ASP)
function sellCardLi(c, tag) {
  const it = c.it, [base, ...sub] = String(it.s || '').split(' · ');
  return '<li class="row sell-card"><div style="min-width:0;flex:1"><div class="pn"><span class="tpill t-' + (TIER_CLS[c.t] || 'c') + '">' + esc(c.t) + '</span>' + (tag ? '<span class="badge">' + tag + '</span>' : '') + '</div>' +
    '<div class="mo-set">' + esc(base) + (sub.length ? ' <span class="muted">· ' + esc(sub.join(' · ')) + '</span>' : '') + '</div>' +
    // os detalhes em linhas separadas (numa só, o ASP ficava cortado)
    [[it.n ? '#' + f0(it.n) + (it.m ? ' of ' + f0(it.m) : '') : '', groupMode() ? accLabel(it.a) : ''].filter(Boolean).join(' · '), usesTxt(c.u) + ' · ' + (c.asp ? 'ASP ' + usd(c.asp / 100) : 'ASP —')].filter(Boolean).map(x => '<div class="ps sell-d">' + esc(x) + '</div>').join('') + '</div>' +
    '<div class="sell-g' + (c.ask ? '' : ' none') + '"><b class="num">' + (c.ask ? usd(c.ask / 100) : '—') + '</b><small>' + (c.ask ? 'low ask' : 'no price') + '</small>' + (c.ask ? '<small>you get ' + usd(c.ask * (1 - SELL_FEE) / 100) + '</small>' : '') + '</div></li>';
}
function sellPlayerSheet(id) {
  const P = ((S.sellData || {}).ps || []).find(x => String(x.id) === String(id)); if (!P) return;
  const rep = P.cards.length > 1;
  openSheet('<h3>' + esc(nameOf(P.id)) + '</h3><div class="small muted">' + esc(P.team) + ' · ' + esc(tcTxt(P.tc)) + ' · ' + esc(useTxt(P.use)) + '</div>' +
    (P.use && !P.use.total ? '<div class="note info">None of your accounts used him or uses him for the rest of the run' + (P.idle > 1 ? ', and you also didn’t use him in ' + plural(P.idle - 1, 'another run', 'other runs') : '') + '.</div>' : '') +
    (rep && P.use && P.use.total ? '<div class="small muted">Each account that uses him n times needs a card with at least n uses, and each card plays for one account per night. For what the plan uses, the ones marked "keep" are enough (the cheapest that do); you can sell the others.</div>' : '') +
    '<div class="card"><ul class="list">' + P.cards.map(c => sellCardLi(c, rep ? (c.keep ? 'keep' : 'extra') : '')).join('') + '</ul></div>' +
    '<div class="small muted">Low ask = the cheapest listing of that edition right now. You get = low ask − Top Shot’s 5%; to sell faster, list a bit below.</div>');
}
function sellSwapSheet(i, down) {
  const x = ((S.sellData || {})[down ? 'downs' : 'swaps'] || [])[i]; if (!x) return;
  const a = x.alt;
  openSheet('<h3>' + esc(nameOf(x.P.id)) + '</h3><div class="small muted">' + (down ? 'Spare rare: ' + esc(useTxt(x.P.use)) : 'Swap for a cheaper equivalent') + '</div>' +
    (down ? '<div class="note info">The plan uses him at most ' + plural(x.need, 'time', 'times') + ' per account this run: a card with ' + esc(usesTxt(x.need)) + ' is enough. If you want to use him more in the next runs, yours gives ' + esc(usesTxt(x.c.u)) + '.</div>' : '') +
    '<div class="card"><div class="list-head"><h2>Yours</h2></div><ul class="list">' + sellCardLi(x.c, '') + '</ul></div>' +
    '<div class="card"><div class="list-head"><h2>The one you buy</h2></div><ul class="list"><li class="row sell-card"><div style="min-width:0;flex:1"><div class="pn"><span class="tpill t-' + (TIER_CLS[TS_TIER(a[2])] || 'c') + '">' + esc(TS_TIER(a[2]) || a[2]) + '</span></div><div class="mo-set">' + esc(a[4]) + (a[5] && !isStd(a[5]) ? ' <span class="muted">· ' + esc(a[5]) + '</span>' : '') + '</div><div class="ps sell-d">' + esc(usesTxt(a[0])) + ' · ' + (a[3] > 0 ? 'ASP ' + usd(a[3] / 100) : 'ASP —') + '</div></div><div class="sell-g"><b class="num">' + usd(a[1] / 100) + '</b><small>low ask</small></div></li></ul></div>' +
    '<div class="card panel">' + [['Sell yours (low ask)', usd(x.c.ask / 100)], ['Fee (5%)', '−' + usd(x.c.ask * SELL_FEE / 100)], ['Buy the other (low ask)', '−' + usd(a[1] / 100)], ['You save', '<b class="c-good">+' + usd(x.save / 100) + '</b>']].map(([k, v]) => '<div class="status-line"><span>' + k + '</span><span>' + v + '</span></div>').join('') + '</div>' +
    (down ? '' : x.less ? '<div class="note">The other one gives ' + esc(usesTxt(x.alt[0])) + ' per run and yours gives ' + esc(usesTxt(x.c.u)) + ' (its ASP is lower).</div>' : '<div class="small muted">Same rarity, with the same uses (' + esc(usesTxt(x.c.u)) + ') or more.</div>') +
    '<div class="small muted">Market prices ' + ago(mkOf(x.P.id).at) + ': check on Top Shot before selling.</div>');
}
// as cartas (Moments) de um jogador, cada uma com o escalão que tem: muda-se carta a carta
// (p. ex. dos dois Luka, só um é Rare); os usos por run do jogador são os da melhor carta
function cardsBlock(id) {
  const col = (S.profile || {}).collection, c = col && (col.players || {})[id];
  if (!c) return '';
  if (!c.ids || !col.items) return '<div class="note info">To pick each card’s tier, read the wallet again (Players → Collection).</div>';
  const its = c.ids.map(f => ({ f, it: col.items[f], t: momentTier(col, f), u: cardUses(col, f), e: cardEd(col, f) })).filter(x => x.it).sort((a, b) => (b.u - a.u) || tierRank(a.t, b.t) || String(a.it.s).localeCompare(String(b.it.s)) || (a.it.n || 0) - (b.it.n || 0));
  if (!its.length) return '';
  const u = tierUsesOf(col, c), lab = tierLabels(col);
  const WHY = { 1: 'yours', 2: 'learned', 3: 'set changed', 4: 'from the group' };
  // cada carta: raridade (e a faixa do ASP quando dá mais usos), set, série/número, conta, ASP e os usos dela
  const rows = its.map(({ f, it, t, u: cu, e }) => {
    const w = momentTierWhy(col, f, lab).why, b = e && aspBand(e.asp), up = b && b[1] > (TIER_USES[t] || 1);
    const [base, ...sub] = String(it.s || '').split(' · ');
    return '<li class="row mo-row"><div style="min-width:0;flex:1"><div class="pn"><span class="tpill t-' + TIER_CLS[t] + '">' + esc(t) + '</span>' + (up ? '<span class="tpill t-asp">' + esc(b[2]) + '</span>' : '') + (w !== 5 && WHY[w] ? '<span class="badge">' + WHY[w] + '</span>' : '') + (it.v ? '<span class="pill prov">for sale</span>' : '') + '</div>' +
      '<div class="mo-set">' + esc(base) + (sub.length ? ' <span class="muted">· ' + esc(sub.join(' · ')) + '</span>' : '') + '</div>' +
      '<div class="ps">' + [it.n ? '#' + f0(it.n) + (it.m ? ' of ' + f0(it.m) : '') : it.m ? 'mint count ' + f0(it.m) : '', groupMode() ? accLabel(it.a) : '', e && e.ask ? 'listed from ' + usd(e.ask / 100) : '', e && e.asp > 0 ? 'ASP ' + usd(e.asp / 100) : e ? 'no sales' : 'no Top Shot data'].filter(Boolean).map(esc).join(' · ') + '</div>' +
      (e && e.tier ? '' : '<select class="field tier-sel" data-mo-tier="' + esc(f) + '" aria-label="Tier of this card">' + TIERS.map(z => '<option value="' + z + '"' + (z === t ? ' selected' : '') + '>' + z + ' · ' + usesTxt(TIER_USES[z]) + '</option>').join('') + '</select>') + '</div>' +
      '<div class="pv mo-u' + (cu === u ? ' top' : '') + '"><div class="v num">' + usesN(cu) + '</div><div class="u">' + (cu === 1 ? 'use' : 'uses') + '</div></div></li>'; }).join('');
  const tc = {}; its.forEach(x => { tc[x.t] = (tc[x.t] || 0) + 1; });
  return '<div class="card"><div class="list-head"><h2>Your cards ' + helpBtn('cartas') + '</h2><span class="small muted">' + TIERS.slice().reverse().filter(z => tc[z]).map(z => tc[z] + ' ' + z).join(' · ') + '</span></div>' +
    '<div class="small muted" style="padding:0 16px 6px">' + usesTxt(u || 1) + ' per run: the card with the most uses counts.</div><ul class="list">' + rows + '</ul></div>';
}
// depois de uma carta mudar: usos por run de todos os jogadores com cartas desse set (o da carta deixa de ter os
// usos acertados à mão; os outros só mudam se não os acertaste). Devolve os outros jogadores cujos usos mudaram.
function refreshTierUses(col, id0, setKey) {
  const others = [];
  Object.entries(col.players || {}).forEach(([id, c]) => {
    if (id !== id0 && !(c.ids || []).some(f => (col.items[f] || {}).s === setKey)) return;
    const before = c.uses; c.uses = tierUsesOf(col, c);
    const e = (S.mine.roster || {})[id];
    if (S.runId && e && (id === id0 || !e.usesManual)) { if (id === id0) e.usesManual = false; e.uses = Math.max(0, c.uses - usedCount('main', id)); e.tierUses = c.uses; }
    if (id !== id0 && before !== c.uses) others.push(id);
  });
  return others;
}
// muda o escalão de uma carta (e ensina as outras do mesmo set; os usos por run de cada jogador são os da melhor carta)
async function momentTierChange(fid, tier) {
  const col = (S.profile || {}).collection, it = col && col.items && col.items[fid]; if (!it || !TIERS.includes(tier)) return;
  col.mt = col.mt || {}; col.mt[fid] = tier; // fica marcada mesmo que seja igual ao palpite: é o que ensina as outras
  col.tl = tierLabels(col);
  const id = it.p, c = (col.players || {})[id];
  const learned = refreshTierUses(col, id, it.s);
  if (S.runId) { saveMine(); schedule(); }
  const panel = $('sheetPanel'), y = panel.scrollTop;
  if (!$('sheet').hidden && S.sheetPl === id) { rosterSheet(id); panel.scrollTop = y; }
  if (S.tab === 'plantel') renderPlantel();
  toast(nameOf(id) + ': ' + plural(c ? c.uses : 1, 'use', 'uses') + ' per run (best card ' + (bestTier(col, c) || tier) + ')' + (learned.length ? ' · learned: ' + learned.slice(0, 3).map(lastName).join(', ') + (learned.length > 3 ? ' and another ' + (learned.length - 3) : '') : ''));
  try { await q(sb.from('profiles').update({ collection: col }).eq('user_id', S.session.user.id)); } catch (err) { toast('Not saved: ' + errText(err)); }
}
// com smurfs: em que noites cada conta o usa e, com um só Moment, se compensa um 2.º
function momentsBlock(id) {
  if (!S.multi) return '';
  const ci = collectionInfo(id), copies = ci.copies;
  const daysOf = k => { const r = S.multi.byKey[k]; const ds = new Set(r ? r.normal.days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1) : []);
    Object.entries(planOf(k).played || {}).forEach(([dt, pl]) => { if (pl && pl.done && (pl.lineup || []).includes(id)) { const i = S.days.findIndex(x => x.date === dt); if (i >= 0) ds.add(i + 1); } }); return [...ds]; };
  const per = accounts().map(a => ({ a, ds: daysOf(a.id) })).filter(x => x.ds.length);
  const nights = per.length ? per.map(x => esc(x.a.label) + ': ' + (x.ds.length === 1 ? 'day ' : 'days ') + spans(x.ds)).join(' · ') : 'no account uses him in the plan';
  const inWallet = !!((((S.profile || {}).collection) || {}).players || {})[id], nAcc = accounts().length;
  return '<div class="note' + (copies === 1 ? ' info' : '') + '" style="display:grid;gap:8px"><div>' + (copies === 1
    ? '<b>1 Moment' + (inWallet ? '' : ' (not in the wallets read)') + ':</b> plays for one account at a time. ' + nights + '.'
    : ci.nTop && ci.nTop < copies && ci.topUses > 1
      ? '<b>' + copies + ' Moments, ' + ci.nTop + ' ' + esc(bestTierName(id)) + ':</b> each account has ' + usesTxt(ci.topUses) + '. Each account’s 1st play can use any card' + (ci.topUses >= 4 ? ', the 2nd needs a Rare or better and the 3rd and 4th a Legendary' : ci.topUses === 3 ? ', the 2nd and 3rd need the ' + esc(bestTierName(id)) : ', the 2nd needs the ' + esc(bestTierName(id))) + '; each card plays for one account per night (the plan says when to move it). ' + nights + '.'
      : '<b>' + copies + ' Moments:</b> ' + (copies >= nAcc ? 'every account can use him on the same night' : 'up to ' + copies + ' accounts on the same night') + '. ' + nights + '.') + '</div>' +
    (copies === 1 && S.runId ? '<button class="btn small" type="button" data-action="buy-eval" data-id="' + esc(id) + '" style="justify-self:start">See if a 2nd Moment is worth it</button>' : '') + '</div>';
}
function addPlayerSheet() {
  openSheet('<h3>Add player</h3><input class="field" id="apSearch" type="search" placeholder="Player name…" autocomplete="off" aria-label="Search player"><div id="apResults" class="search-list"></div>' +
    '<div class="small muted"><button class="btn link small" type="button" data-action="paste-sheet">Paste a list</button> · <button class="btn link small" type="button" data-action="custom-player">Player not listed</button></div>');
  renderSearch(''); setTimeout(() => { const f = $('apSearch'); if (f) f.focus(); }, 50);
}
function searchPlayers(qs, limit) {
  const qn = norm(qs); const toks = qn.split(' ').filter(Boolean);
  const all = [...S.players.values()];
  const res = toks.length ? all.filter(p => { const n = norm(p.name); return toks.every(t => n.includes(t)); }) : all;
  return res.sort((a, b) => ((b.avg && +b.avg.pts) || 0) - ((a.avg && +a.avg.pts) || 0)).slice(0, limit || 30);
}
function renderSearch(qs) {
  const box = $('apResults'); if (!box) return;
  if (!S.players.size) { box.innerHTML = '<div class="row muted small">The player catalogue is still empty.</div>'; return; }
  const res = searchPlayers(qs, 30);
  box.innerHTML = res.map(p => { const inR = !!S.mine.roster[p.id]; return '<div class="row"><span class="who">' + face(p.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span></div><div class="ps">' + esc(p.team || '—') + (p.avg ? ' · ' + f1(+p.avg.pts || 0) + ' PTS · ' + f1(+p.avg.reb || 0) + ' REB · ' + f1(+p.avg.ast || 0) + ' AST' : '') + '</div></div></span>' + (inR ? '<span class="small muted">in roster</span>' : '<button class="btn small" type="button" data-action="add-id" data-id="' + esc(p.id) + '">Add</button>') + '</div>'; }).join('') || '<div class="row muted small">No player with that name.</div>';
}
function customPlayerSheet() {
  openSheet('<h3>Add by hand</h3><input class="field" id="cpName" placeholder="Name" aria-label="Player name"><div class="grid2"><select class="field" id="cpTeam" aria-label="Team">' + TEAMS.map(t => '<option>' + t + '</option>').join('') + '</select><input class="field num" id="cpUses" type="number" min="0" max="20" value="1" aria-label="Uses"></div>' +
    '<div class="small muted">Without averages, he only enters the plan on days with odds.</div><div class="btns"><button class="btn quiet" type="button" data-action="sheet-back">Cancel</button><button class="btn primary" type="button" data-action="save-custom">Add</button></div>', addPlayerSheet);
}
// "Jokic 2, Tatum 3" → [{text, uses, match}]
function parseList(text) {
  const parts = String(text).split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const all = [...S.players.values()].map(p => ({ p, n: norm(p.name), last: norm(p.name).split(' ').slice(-1)[0] }));
  return parts.map(raw => {
    const m = raw.match(/^(.*?)[\s:x×\-–]*(\d{1,2})?\s*(usos?|uses?|x)?\s*$/i);
    const name = (m ? m[1] : raw).trim(), uses = m && m[2] ? +m[2] : 1, qn = norm(name);
    let match = all.find(a => a.n === qn);
    if (!match) { const byLast = all.filter(a => a.last === qn); if (byLast.length === 1) match = byLast[0]; }
    if (!match) { const toks = qn.split(' ').filter(Boolean); const c = all.filter(a => toks.every(t => a.n.includes(t))); if (c.length === 1) match = c[0]; else if (c.length > 1) match = c.sort((x, y) => ((y.p.avg && +y.p.avg.pts) || 0) - ((x.p.avg && +x.p.avg.pts) || 0))[0]; }
    return { raw, name, uses, match: match ? match.p : null };
  });
}
function pasteSheet() {
  openSheet('<h3>Paste list</h3><div class="small muted">One per line, with the uses. E.g. <span class="kbd">Jokic 2</span> <span class="kbd">Curry 1</span></div>' +
    '<textarea class="field" id="pasteText" rows="6" aria-label="List of players"></textarea><button class="btn" type="button" data-action="paste-preview">See matches</button><div id="pasteOut"></div>', addPlayerSheet);
}

// ---------- carteira: Moments lidos da blockchain Flow, diretamente no browser ----------
// A API pública da Flow aceita pedidos de qualquer site. Os usos não estão na blockchain (dependem do escalão de cada Moment).
const FLOW_REST = 'https://rest-mainnet.onflow.org/v1';
const CAD_ROW = `let series: UInt32 = TopShot.getSetSeries(setID: m.data.setID) ?? 0
        let sub = TopShot.getSubeditionByNFTID(id)
        out.append([TopShot.getPlayMetaDataByField(playID: m.data.playID, field: "FullName") ?? "", TopShot.getSetName(setID: m.data.setID) ?? "", series.toString(), id.toString(), m.data.setID.toString(), m.data.playID.toString(), TopShot.getPlayMetaDataByField(playID: m.data.playID, field: "Tier") ?? "", sub?.name ?? "", m.data.serialNumber.toString(), TopShot.getPlayMetaDataByField(playID: m.data.playID, field: "DateOfMoment") ?? ""])`;
const CAD_IDS = `import TopShot from 0x0b2a3299cc857e29
access(all) fun main(addr: Address): [UInt64] {
  if let col = getAccount(addr).capabilities.borrow<&{TopShot.MomentCollectionPublic}>(/public/MomentCollection) { return col.getIDs() }
  return []
}`;
const CAD_MOMENTS = `import TopShot from 0x0b2a3299cc857e29
access(all) fun main(addr: Address, ids: [UInt64]): [[String]] {
  let out: [[String]] = []
  if let col = getAccount(addr).capabilities.borrow<&{TopShot.MomentCollectionPublic}>(/public/MomentCollection) {
    for id in ids {
      if let m = col.borrowMoment(id: id) {
        ${CAD_ROW}
      }
    }
  }
  return out
}`;
const CAD_LISTED = `import TopShot from 0x0b2a3299cc857e29
import TopShotMarketV3 from 0xc1e4f4f4c4257510
access(all) fun main(addr: Address): [[String]] {
  let out: [[String]] = []
  if let sale = getAccount(addr).capabilities.borrow<&TopShotMarketV3.SaleCollection>(/public/topshotSalev3Collection) {
    for id in sale.getIDs() {
      if let m = sale.borrowMoment(id: id) {
        ${CAD_ROW}
      }
    }
  }
  return out
}`;
function cadDecode(v) {
  if (v == null) return null;
  const { type, value } = v;
  if (type === 'Optional') return value == null ? null : cadDecode(value);
  if (type === 'Array') return (value || []).map(cadDecode);
  if (type === 'Dictionary') { const o = {}; (value || []).forEach(kv => { o[String(cadDecode(kv.key))] = cadDecode(kv.value); }); return o; }
  if (type === 'Bool') return !!value;
  if (type === 'Address' || type === 'String' || type === 'Character') return value;
  if (/^U?Int\d*$|^Word\d+$|Fix64$/.test(type)) return type === 'UInt64' || type === 'Int64' ? String(value) : Number(value);
  return value;
}
async function flowRun(code, args) {
  const enc = str => btoa(unescape(encodeURIComponent(str)));
  const res = await fetch(FLOW_REST + '/scripts?block_height=sealed', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ script: enc(code), arguments: (args || []).map(a => enc(JSON.stringify(a))) }) });
  const text = await res.text();
  if (!res.ok) throw new Error('Flow ' + res.status + ': ' + text.slice(0, 200));
  const bin = atob(JSON.parse(text));
  return cadDecode(JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))));
}
// ---------- escalões: deduzidos da blockchain (set, tiragem da edição, subedição) ----------
// O contrato do Top Shot não guarda o escalão nem o ASP. Cada set é de um escalão e a tiragem confirma-o; o que for
// deduzido mal corrige-se uma vez por set em Jogadores → Coleção → Escalões. Usos por Moment em cada run:
const TIERS = ['Common', 'Fandom', 'Rare', 'Rare+', 'Legendary', 'Ultimate']; // Rare+: os Rare que dão 3 usos
const UNL = 99; // usos ilimitados (Ultimate, ou ASP acima de $1000)
const TIER_USES = { Common: 1, Fandom: 1, Rare: 2, 'Rare+': 3, Legendary: 4, Ultimate: UNL };
const usesN = u => u >= UNL ? '∞' : String(u);
const usesTxt = u => u >= UNL ? 'unlimited uses' : plural(u, 'use', 'uses');
// faixas do ASP (average sale price da edição): só sobem os usos de uma carta, nunca descem. $0.00 = sem vendas, não conta
const ASP_BANDS = [[1000, 1, 'Draft Pick'], [5000, 2, 'Starter'], [30000, 3, 'All-Star'], [100000, 4, 'MVP'], [Infinity, UNL, 'Hall of Fame']];
const aspBand = c => (c > 0 ? ASP_BANDS.find(b => c <= b[0]) : null) || null;
// raridade e ASP de cada carta, lidos no Top Shot pelo script (por jogador: as edições dos sets que o grupo tem)
// S.edMine = {at, p: {id: [[set, paralelo, escalão, ASP, tiragem, série, setID, playID]]}}; vai no resumo (share.ed) e o
// grupo usa, jogador a jogador, o mais recente
try { S.edMine = JSON.parse(localStorage.getItem('fb-ed') || 'null'); } catch (e) { S.edMine = null; }
// uma leitura nova fica por confirmar (S.edPending) até o admin ver o que muda e carregar em «Aplicar»
try { S.edPending = JSON.parse(localStorage.getItem('fb-ed-pending') || 'null'); } catch (e) { S.edPending = null; }
function edTake(ed) { S.edPending = ed; S.edReview = true; try { localStorage.setItem('fb-ed-pending', JSON.stringify(ed)); } catch (e) {} }
function edApply() {
  const ed = S.edPending; if (!ed) return;
  const old = S.edMine && S.edMine.p ? S.edMine : { p: {}, t: {} }, t = Object.assign({}, old.t || {});
  Object.keys(ed.p || {}).forEach(id => { t[id] = ed.at; });
  S.edMine = { at: ed.at, p: Object.assign({}, old.p, ed.p), mk: Object.assign({}, old.mk || {}, ed.mk || {}), t, keys: ed.keys || old.keys, askKeys: ed.askKeys || null, nAsk: ed.nAsk || 0, miss: (ed.miss || []).slice(0, 200) }; S.edIdx = null;
  try { localStorage.setItem('fb-ed', JSON.stringify(S.edMine)); localStorage.removeItem('fb-ed-pending'); } catch (e) {}
  S.edPending = null; S.lastSummary = ''; colTopMemo.col = null;
  if (S.mineLoaded) syncTierUses();
  publishSummary(); render();
}
// a leitura das cartas no Top Shot só conta a partir da próxima run (decidido a 23 out)
const edOn = () => true; // ligado (o João quis ler já nesta run)
const edMapOf = ed => new Map(Object.entries((ed && ed.p) || {}).map(([id, rows]) => [id, { rows, at: ed.at }]));
// o que muda com a leitura por confirmar: por pessoa do grupo, os jogadores cujos usos por run mudam, e porquê
const cardTxt = (it, e) => [e && e.tier ? e.tier : null, String(it.s || ''), e && e.asp > 0 ? 'ASP ' + usd(e.asp / 100) + (aspBand(e.asp) ? ' (' + aspBand(e.asp)[2] + ')' : '') : null].filter(Boolean).join(' · ');
async function edReviewSheet() {
  const ed = S.edPending; if (!ed) return;
  openSheet('<h3>Card rarity and ASP</h3><div id="edRv" class="small muted">Comparing with what we have…</div>');
  const idx = new Map([...edIndex(), ...edMapOf(ed)]), me = S.session.user.id;
  let others = [];
  try { others = (await q(sb.from('profiles').select('user_id,it:collection->items'))) || []; } catch (e) { console.warn(e); }
  if (!$('edRv')) return;
  let nCards = 0, nOk = 0, nTier = 0; const loose = new Map();
  // uma pessoa: cartas por jogador → usos de agora e com a leitura nova
  const person = (uid, col, oldOf) => {
    const by = {}; Object.entries(col.items || {}).forEach(([f, it]) => { if (it && it.p != null) (by[it.p] = by[it.p] || []).push(f); });
    const out = [];
    Object.entries(by).forEach(([id, fs]) => {
      let best = null, bu = 0, all = true;
      fs.forEach(f => { nCards++; const e = cardEd(col, f, idx), it = col.items[f];
        if (!e) { all = false; const k = String(it.s || '?'); loose.set(k, (loose.get(k) || 0) + 1); return; }
        nOk++; if (uid === me && e.tier && e.tier !== momentTier(col, f)) nTier++;
        const u = uid === me ? cardUses(col, f, idx) : Math.max(TIER_USES[e.tier || 'Common'] || 1, (aspBand(e.asp) || [0, 0])[1]);
        if (u > bu) { bu = u; best = { it, e }; } });
      const old = oldOf(id); if (old == null && !best) return;
      const nu = uid === me ? Math.max(1, ...fs.map(f => cardUses(col, f, idx))) : all ? bu : Math.max(bu, old || 0);
      if (old != null && nu !== old) out.push({ id, old, nu, best });
    });
    return out.sort((a, b) => Math.abs(b.nu - b.old) - Math.abs(a.nu - a.old) || String(nameOf(a.id)).localeCompare(String(nameOf(b.id))));
  };
  const myCol = (S.profile || {}).collection || {};
  const groups = [{ uid: me, rows: person(me, myCol, id => colTopUses(id)) }];
  others.forEach(r => {
    const its = r.it || (r.collection && r.collection.items);
    if (r.user_id === me || !S.group.members.some(m => m.user_id === r.user_id) || !its) return;
    const sm = S.group.summaries.find(x => x.user_id === r.user_id), ro = (sm && sm.share && sm.share.roster) || {};
    groups.push({ uid: r.user_id, rows: person(r.user_id, { items: its }, id => (ro[id] ? +ro[id][1] : null)) });
  });
  const row = x => '<li class="row ed-row"><span class="who">' + face(x.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(x.id)) + '</span></div>' +
    (x.best ? '<div class="ps">' + esc(cardTxt(x.best.it, x.best.e)) + '</div>' : '') + '</div></span><span class="ed-ch num">' + usesN(x.old) + ' → <b class="' + (x.nu > x.old ? 'up' : 'down') + '">' + usesN(x.nu) + '</b></span></li>';
  const changed = groups.filter(g => g.rows.length);
  $('edRv').outerHTML = '<div class="small">Read on Top Shot ' + esc(ago(ed.at)) + ': <b>' + nOk + '</b> of ' + nCards + ' cards matched to an edition' + (nTier ? ' · ' + nTier + ' of yours change rarity' : '') + '.</div>' +
    (changed.length ? changed.map(g => '<div class="card"><div class="list-head"><h2>' + esc(g.uid === me ? 'You' : groupName(g.uid)) + '</h2><span class="small muted">' + plural(g.rows.length, 'player changes', 'players change') + '</span></div><ul class="list">' + g.rows.map(row).join('') + '</ul></div>').join('')
      : '<div class="note info">Nobody’s uses change with this reading.</div>') +
    (loose.size ? '<details class="ed-loose"><summary class="small muted">' + plural(nCards - nOk, 'card without an edition', 'cards without an edition') + ' (they stay as they are)</summary><div class="small muted">' + [...loose.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, n]) => esc(k) + (n > 1 ? ' ×' + n : '')).join(' · ') + '</div></details>' : '') +
    (ed.err ? '<div class="note">' + esc(ed.err) + '</div>' : '') +
    '<div class="btns"><button class="btn quiet" type="button" data-action="close-sheet">Not now</button><button class="btn primary" type="button" data-action="ed-apply">Apply</button></div>';
}
function edIndex() {
  const key = [(S.group || {}).summaries, S.edMine && S.edMine.at];
  if (S.edIdx && S.edIdx.k[0] === key[0] && S.edIdx.k[1] === key[1]) return S.edIdx.m;
  const m = new Map(), docs = [S.edMine].concat(((S.group || {}).summaries || []).map(x => x.share && x.share.ed)).filter(d => d && d.at && d.p);
  docs.forEach(d => Object.entries(d.p).forEach(([id, rows]) => { const at = (d.t || {})[id] || d.at, o = m.get(id); if (Array.isArray(rows) && (!o || at > o.at)) m.set(id, { rows, at }); }));
  S.edIdx = { k: key, m };
  return m;
}
const TS_TIER = t => { const x = /ULTIMATE|LEGENDARY|RARE|FANDOM|COMMON/i.exec(String(t || '')); return x ? x[0][0] + x[0].slice(1).toLowerCase() : null; };
const setBaseN = n => norm(n).replace(/\s*\d+$/, ''); // "Base Set6" (blockchain) = "Base Set" (Top Shot)
const isStd = p => !p || /^(standard|base|none|default)$/i.test(String(p).trim());
// edição do Top Shot de uma carta: mesmo jogador e set; depois paralelo, série, setID/playID e tiragem. Se ficarem
// várias, o escalão só conta se for o mesmo em todas e o ASP é o mais baixo (nunca dá usos a mais)
function cardEd(col, fid, idx) {
  const it = ((col || {}).items || {})[fid]; if (!it) return null;
  const E = (idx || edIndex()).get(String(it.p)); if (!E) return null;
  const [base, ...rest] = String(it.s || '').split(' · '), sub = rest.join(' · ');
  let c = E.rows.filter(r => setBaseN(r[0]) === setBaseN(base));
  c = c.filter(r => sub ? !isStd(r[1]) && (norm(r[1]) === norm(sub) || norm(r[1]).includes(norm(sub)) || norm(sub).includes(norm(r[1]))) : isStd(r[1]));
  const narrow = f => { const d = c.filter(f); if (d.length) c = d; };
  if (it.se != null) narrow(r => r[5] == null || +r[5] === +it.se);
  if (it.si != null && it.pi != null) narrow(r => r[6] != null && r[7] != null && +r[6] === +it.si && +r[7] === +it.pi);
  // a data da jogada separa duas jogadas do mesmo set e da mesma versão (até 1 dia de diferença, pelos fusos)
  if (it.d) narrow(r => r[8] && Math.abs(Date.parse(String(r[8]).slice(0, 10)) - Date.parse(it.d)) <= 864e5);
  if (it.m) narrow(r => r[4] != null && +r[4] === +it.m);
  if (!c.length) return null;
  const tiers = [...new Set(c.map(r => TS_TIER(r[2])).filter(Boolean))];
  const asps = c.map(r => r[3]);
  const asks = c.map(r => r[9]).filter(x => x > 0); // a mais barata à venda desta edição (leituras novas)
  return { tier: tiers.length === 1 ? tiers[0] : null, asp: asps.every(a => a != null) ? Math.min(...asps) : null, ask: asks.length ? Math.min(...asks) : null, n: c.length, at: E.at };
}
// usos de uma carta: o mínimo do escalão, e o ASP pode subir
function cardUses(col, f, idx) {
  const e = cardEd(col, f, idx), t = (e && e.tier) || momentTier(col, f), b = e && aspBand(e.asp);
  return Math.max(TIER_USES[t] || 1, b ? b[1] : 0);
}
const TIER_SETS = { 'base set': 'Common', 'metallic gold le': 'Rare' }; // sets conhecidos
function tierAuto(setName, meta, counts) {
  const m = String(meta || '').toLowerCase();
  const byMeta = TIERS.find(t => m.includes(t.toLowerCase()));
  if (byMeta) return { tier: byMeta, how: 'blockchain' };
  const known = TIER_SETS[String(setName || '').toLowerCase().trim()];
  if (known) return { tier: known, how: 'set' };
  // o nome do set às vezes diz o escalão ("2025 NBA Playoffs: Common")
  const nm = /\b(ultimate|legendary|rare|fandom|common)\b/i.exec(String(setName || ''));
  if (nm) return { tier: nm[1][0].toUpperCase() + nm[1].slice(1).toLowerCase(), how: 'set' };
  const xs = (counts || []).filter(x => x > 0).sort((a, b) => a - b);
  if (!xs.length) return { tier: 'Common', how: 'no data' };
  const med = xs[(xs.length - 1) >> 1];
  // Rare vai até /1000 (os Common recentes têm /1114, /1149, /1190…)
  return { tier: med <= 5 ? 'Ultimate' : med <= 149 ? 'Legendary' : med <= 1000 ? 'Rare' : 'Common', how: 'tiragem' };
}
// palpite de um set guardado (refeito com as regras de agora; o que veio da blockchain fica)
const setAuto = (k, x) => (x && (x.how === 'blockchain') ? x.auto : tierAuto(k, '', x && x.med ? [x.med] : []).tier) || (x && x.auto) || 'Common';
const setTier = (col, k) => { const x = ((col || {}).sets || {})[k] || {}; return x.tier || setAuto(k, x); };
// usos de um jogador numa run: os do seu melhor Moment (uma Rare e três Common dão 2, não 5). Ter mais Moments do
// mesmo jogador não soma usos; só deixa usá-lo em duas contas no mesmo dia
// ---- escalão de cada carta, e o que o site aprende com as tuas escolhas ----
// Cada carta que marcas (col.mt) ensina o escalão do set dela: as outras cartas desse set passam a ter o mesmo.
// Se no mesmo set marcaste escalões diferentes, cada carta segue a marcada com a tiragem mais parecida.
// As tuas marcações vão também para o grupo (col.tl) e ensinam os sets que os amigos ainda não marcaram.
// Ordem: a tua escolha nessa carta → o que aprendeste das tuas outras cartas → o set que mudaste em Coleção →
// o que o grupo aprendeu → o palpite pelo set e pela tiragem.
function tierLabels(col) {
  const out = {}; Object.entries((col && col.mt) || {}).forEach(([f, t]) => { const it = ((col && col.items) || {})[f]; if (it) (out[it.s] = out[it.s] || []).push([it.m || 0, t]); });
  return out;
}
function learnFrom(L, m) {
  if (!L || !L.length) return null;
  if (L.every(x => x[1] === L[0][1])) return L[0][1];
  let best = null, bd = Infinity;
  if (m) L.forEach(([mm, t]) => { if (!mm) return; const d = Math.abs(Math.log(m) - Math.log(mm)); if (d < bd) { bd = d; best = t; } });
  return best;
}
// escalão de uma carta e de onde vem: 1 marcada por ti · 2 aprendido das tuas cartas · 3 set mudado · 4 do grupo · 0 palpite
function momentTierWhy(col, fid, lab) {
  const it = ((col || {}).items || {})[fid];
  const ts = it && cardEd(col, fid); if (ts && ts.tier) return { t: ts.tier, why: 5 }; // lido no Top Shot: manda sobre tudo
  if (((col || {}).mt || {})[fid]) return { t: col.mt[fid], why: 1 };
  if (!it) return { t: 'Common', why: 0 };
  const own = learnFrom((lab || tierLabels(col))[it.s], it.m); if (own) return { t: own, why: 2 };
  const x = ((col || {}).sets || {})[it.s] || {};
  if (x.tier) return { t: x.tier, why: 3 };
  const grp = learnFrom((S.groupTL || {})[it.s], it.m); if (grp) return { t: grp, why: 4 };
  return { t: setAuto(it.s, x), why: 0 };
}
const momentTier = (col, fid, lab) => momentTierWhy(col, fid, lab).t;
// escalões dos Moments de um jogador, um por carta (coleções lidas antes da 22 não têm as cartas: vai pelos sets)
function momentTiers(col, c) {
  if (c && c.ids && col && col.items) { const lab = tierLabels(col); return c.ids.filter(f => col.items[f]).map(f => momentTier(col, f, lab)); }
  const out = []; Object.entries((c && c.bySet) || {}).forEach(([k, n]) => { for (let i = 0; i < n; i++) out.push(setTier(col, k)); }); return out;
}
const tierRank = (a, b) => (TIER_USES[b] || 1) - (TIER_USES[a] || 1) || TIERS.indexOf(b) - TIERS.indexOf(a);
const bestTier = (col, c) => momentTiers(col, c).sort(tierRank)[0] || null;
const tierUsesOf = (col, c) => { if (!c || !(c.bySet || c.ids)) return null; if (c.ids && col && col.items) { const fs = c.ids.filter(f => col.items[f]); if (fs.length) return Math.max(1, ...fs.map(f => cardUses(col, f))); } const ts = momentTiers(col, c); return Math.max(1, ...ts.map(t => TIER_USES[t] || 1)); };
// texto curto: "Rare · Common ×3 → 2 usos (o da Rare)"
const usesWhy = (col, c) => { const u = tierUsesOf(col, c), b = bestTier(col, c), n = momentTiers(col, c).length; return tierMix(col, c) + ' → ' + usesTxt(u) + ' per run' + (n > 1 ? ' (the best one counts: ' + b + ')' : ''); };
// plantel da run guardado com a regra antiga (somava os usos de todos os Moments): acerta pelo melhor Moment
function syncTierUses() {
  const col = (S.profile || {}).collection; if (!col || !col.players || !S.runId) return;
  let changed = 0;
  Object.entries(S.mine.roster || {}).forEach(([id, e]) => {
    // com Moments lidos das carteiras os usos são os da melhor carta: apaga o que foi posto à mão (principal e smurfs)
    const top = colTopUses(id);
    if (top) {
      const u = Math.max(0, top - usedCount('main', id));
      if (e.uses !== u || e.su || e.sm || e.usesManual || e.tierUses !== top) { e.uses = u; e.tierUses = top; delete e.su; delete e.sm; delete e.usesManual; changed++; }
      return;
    }
    const c = col.players[id]; if (!c || !c.bySet || e.usesManual || e.tierUses == null) return;
    const tot = tierUsesOf(col, c); if (tot === e.tierUses) return;
    e.uses = Math.max(0, tot - usedCount('main', id)); e.tierUses = tot; c.uses = tot; changed++;
  });
  if (changed) { saveMine(); schedule(); }
}
const tierMix = (col, c) => { const o = tierCounts(col, c); return TIERS.slice().reverse().filter(t => o[t]).map(t => t + (o[t] > 1 ? ' ×' + o[t] : '')).join(' · '); };
const CAD_EDITIONS = `import TopShot from 0x0b2a3299cc857e29
access(all) fun main(sets: [UInt32]): {UInt32: {UInt32: UInt32}} {
  let out: {UInt32: {UInt32: UInt32}} = {}
  for s in sets {
    if let d = TopShot.getSetData(setID: s) { out[s] = d.getNumberMintedPerPlay() }
  }
  return out
}`;
// tiragem de cada edição (set + jogada) dos sets que tens; lotes de 12 sets, partidos ao meio se a Flow recusar
async function readEditions(setIds) {
  const out = {};
  async function batch(b) {
    try { Object.assign(out, await flowRun(CAD_EDITIONS, [{ type: 'Array', value: b.map(x => ({ type: 'UInt32', value: String(x) })) }]) || {}); }
    catch (e) { if (b.length > 1) { const h = b.length >> 1; await batch(b.slice(0, h)); await batch(b.slice(h)); } else console.warn('tiragem do set', b[0], e); }
  }
  const ids = [...new Set(setIds.map(String))].filter(x => x !== '' && x !== 'undefined');
  for (let i = 0; i < ids.length; i += 12) await batch(ids.slice(i, i + 12));
  return out;
}
async function readWallet(addr, progress) {
  const A = { type: 'Address', value: addr };
  const ids = await flowRun(CAD_IDS, [A]) || [];
  const rows = [];
  // lotes de 200; se a Flow recusar (limite de cálculo), parte o lote ao meio
  async function batch(b) {
    try { return await flowRun(CAD_MOMENTS, [A, { type: 'Array', value: b.map(x => ({ type: 'UInt64', value: String(x) })) }]) || []; }
    catch (e) { if (b.length > 20) { const h = b.length >> 1; return (await batch(b.slice(0, h))).concat(await batch(b.slice(h))); } throw e; }
  }
  const lots = []; for (let i = 0; i < ids.length; i += 200) lots.push(ids.slice(i, i + 200));
  let done = 0, next = 0;
  await Promise.all(Array.from({ length: Math.min(4, lots.length) }, async () => {
    while (next < lots.length) { const b = lots[next++]; rows.push(...await batch(b)); done += b.length; if (progress) progress(done, ids.length); }
  }));
  let listed = [];
  try { listed = await flowRun(CAD_LISTED, [A]) || []; } catch (e) { /* sem Moments à venda, ou mercado indisponível */ }
  // No mercado atual (V3) os Moments à venda continuam na coleção: contam uma vez só. Os do mercado antigo (V1)
  // saíram da coleção e entram aqui à parte.
  const own = new Set(ids.map(String)), sale = new Set(listed.map(r => String(r[3])));
  return { total: ids.length, rows, extra: listed.filter(r => !own.has(String(r[3]))), sale, listedAll: listed.length };
}
// nome completo do Top Shot → jogador do catálogo (nome igual; ou primeiro + último nome; ou todas as palavras, se só houver um)
function catalogIndex() {
  const all = [...S.players.values()].map(p => ({ p, n: norm(p.name) }));
  const exact = new Map(), short = new Map();
  all.forEach(a => { exact.set(a.n, a.p); const t = a.n.split(' '); if (t.length > 2) short.set(t[0] + ' ' + t[t.length - 1], a.p); });
  return name => {
    const qn = norm(name); if (!qn) return null;
    if (exact.has(qn)) return exact.get(qn);
    const t = qn.split(' ');
    if (t.length > 2 && exact.has(t[0] + ' ' + t[t.length - 1])) return exact.get(t[0] + ' ' + t[t.length - 1]);
    if (short.has(qn)) return short.get(qn);
    const c = all.filter(a => t.every(w => a.n.split(' ').includes(w)));
    if (c.length === 1) return c[0].p;
    // diminutivo: "Steph Curry" = Stephen Curry (mesmo apelido, primeiro nome abreviado, só um)
    if (t.length >= 2) { const last = t.slice(1).join(' '), d = all.filter(a => { const w = a.n.split(' '); return w.slice(1).join(' ') === last && sameFirst(t[0], w[0]); }); if (d.length === 1) return d[0].p; }
    return null;
  };
}
// Lê as carteiras de todas as contas (principal e smurf) e junta os Moments por jogador do catálogo
async function walletSheet() {
  const seenAddr = new Set(), dupAddr = [];
  const accs = accounts().filter(a => /^0x[0-9a-fA-F]{16}$/.test((a.flow || '').trim())).filter(a => { const k = a.flow.trim().toLowerCase(); if (seenAddr.has(k)) { dupAddr.push(a.label); return false; } seenAddr.add(k); return true; });
  if (!accs.length) {
    openSheet('<h3>Read wallet</h3><div class="small muted">Your profile is missing the Flow address (Dapper wallet).</div><div class="btns"><button class="btn quiet" type="button" data-action="close-sheet">Cancel</button><button class="btn primary" type="button" data-action="goto" data-tab="ajustes" data-sub="perfil">Go to Settings</button></div>');
    return;
  }
  openSheet('<h3>Read wallet' + (accs.length > 1 ? 's' : '') + '</h3><div class="small muted" id="wProg">Reading your Moments on the blockchain…</div>');
  const reads = [], failed = [];
  for (const a of accs) {
    try { reads.push({ a, w: await readWallet(a.flow.trim(), (d, t) => { const el = $('wProg'); if (el) el.textContent = 'Reading ' + a.label + '… ' + d + ' of ' + t + ' Moments'; }) }); }
    catch (e) { console.warn(e); failed.push(a.label + ': ' + String(e.message || e).slice(0, 120)); }
  }
  if (!$('wProg')) return; // fechou a folha entretanto
  if (!reads.length) { $('wProg').innerHTML = '<span class="down">Couldn\'t read the wallet.</span> ' + esc(failed.join(' · ')) + '<br>Check the Flow address in your profile and try again.'; return; }
  // tiragem das edições (para o escalão de cada set)
  if ($('wProg')) $('wProg').textContent = 'Checking each set\'s tier…';
  let editions = {};
  try { editions = await readEditions(reads.flatMap(({ w }) => w.rows.concat(w.extra).map(r => r[4]).filter(x => x != null))); } catch (e) { console.warn('tiragens', e); }
  if (!$('wProg')) return;
  const prevCol = ((S.profile || {}).collection) || {}, prevSets = prevCol.sets || {}, prevMt = prevCol.mt || {};
  const items = {}, mt = {};
  const sets = {};
  const setKey = r => (r[1] || '?') + (r[7] && r[7] !== 'Standard' ? ' · ' + r[7] : '');
  reads.forEach(({ w }) => w.rows.concat(w.extra).forEach(r => {
    if (!r[0]) return;
    const k = setKey(r), x = (sets[k] = sets[k] || { n: 0, counts: [], meta: '', name: r[1] || '' });
    x.n++; const sub = /\/\s*(\d+)/.exec(r[7] || ''); const cnt = sub ? +sub[1] : +(((editions[String(r[4])] || {})[String(r[5])]) || 0); if (cnt) x.counts.push(cnt); if (r[6]) x.meta = r[6];
  }));
  Object.entries(sets).forEach(([k, x]) => { const a = tierAuto(x.name, x.meta, x.counts), xs = x.counts.slice().sort((p, q) => p - q);
    sets[k] = Object.assign({ n: x.n, auto: a.tier, how: a.how }, xs.length ? { med: xs[(xs.length - 1) >> 1] } : {}, prevSets[k] && prevSets[k].tier ? { tier: prevSets[k].tier } : {}); });
  const find = catalogIndex();
  const by = new Map(), outside = new Map(), accTot = {};
  reads.forEach(({ a, w }) => {
    accTot[a.id] = { moments: w.total + w.extra.length, listed: w.listedAll };
    const add = (r, sale) => {
      const name = r[0]; if (!name) return;
      const p = find(name);
      if (!p) { outside.set(norm(name), name); return; }
      const e = by.get(p.id) || { p, n: 0, sale: 0, owners: {}, sets: {}, bySet: {}, ids: [] };
      const fid = String(r[3]), sub = /\/\s*(\d+)/.exec(r[7] || ''), mint = sub ? +sub[1] : +(((editions[String(r[4])] || {})[String(r[5])]) || 0);
      if (!items[fid]) { items[fid] = Object.assign({ p: p.id, s: setKey(r), a: a.id }, +r[8] ? { n: +r[8] } : {}, mint ? { m: mint } : {}, r[2] ? { se: +r[2] } : {}, r[4] != null && r[4] !== '' ? { si: +r[4], pi: +r[5] } : {}, /^\d{4}-\d{2}-\d{2}/.test(r[9] || '') ? { d: String(r[9]).slice(0, 10) } : {}, sale ? { v: 1 } : {}); e.ids.push(fid); if (prevMt[fid]) mt[fid] = prevMt[fid]; }
      e.n++; if (sale) e.sale++; e.owners[a.id] = (e.owners[a.id] || 0) + 1; e.sets[r[1] || '?'] = (e.sets[r[1] || '?'] || 0) + 1; e.bySet[setKey(r)] = (e.bySet[setKey(r)] || 0) + 1;
      by.set(p.id, e);
    };
    w.rows.forEach(r => add(r, w.sale.has(String(r[3])))); w.extra.forEach(r => add(r, true));
  });
  const found = [...by.values()].sort((x, y) => ((y.p.avg && +y.p.avg.pts) || 0) - ((x.p.avg && +x.p.avg.pts) || 0));
  // coleção guardada no perfil (serve para todas as runs e para saber onde está cada Moment)
  const players = {}, colTmp = { sets, items, mt };
  found.forEach(e => { players[e.p.id] = { name: e.p.name, moments: e.n, owners: e.owners, sets: Object.keys(e.sets).slice(0, 8), bySet: e.bySet, ids: e.ids }; players[e.p.id].uses = tierUsesOf(colTmp, players[e.p.id]); });
  S.walletCol = { read_at: new Date().toISOString(), accounts: accTot, players, sets, items, mt, outside: [...outside.values()].slice(0, 60) };
  S.walletCol.tl = tierLabels(S.walletCol);
  const hasRun = !!S.runId && S.mineLoaded;
  const inWallet = new Set(found.map(e => String(e.p.id)));
  const gone = hasRun ? Object.keys(S.mine.roster || {}).filter(id => !inWallet.has(String(id)) && S.players.has(String(id))) : [];
  const fresh = hasRun ? found.filter(e => !S.mine.roster[e.p.id]) : [];
  S.walletGone = gone;
  // usos que mudam no plantel (os que acertaste à mão ficam)
  const ups = hasRun ? found.map(e => { const r0 = S.mine.roster[e.p.id]; if (!r0 || r0.usesManual) return null; const nv = Math.max(0, players[e.p.id].uses - usedCount('main', e.p.id)), cur = +r0.uses || 0; const to = r0.tierUses != null ? nv : Math.max(cur, nv); return to !== cur ? { e, cur, to } : null; }).filter(Boolean) : [];
  const tierCount = {}; Object.keys(items).forEach(f => { const t = momentTier(S.walletCol, f); tierCount[t] = (tierCount[t] || 0) + 1; });
  const tot = Object.entries(accTot).map(([k, t]) => (groupMode() ? esc(accLabel(k)) + ' ' : '') + t.moments + ' Moments' + (t.listed ? ' (' + t.listed + ' for sale)' : '')).join(' · ');
  // o que mudou desde a última leitura: Moments novos, que saíram e que mudaram de conta
  const prevItems = prevCol.items || null, diff = []; S.walletNew = 0;
  if (prevItems) {
    const grp = (list, src, col, extra) => { const g = new Map(); list.forEach(f => { const it = src[f] || {}, k = it.p + '|' + momentTier(col, f) + (extra ? '|' + extra(f) : ''); g.set(k, (g.get(k) || 0) + 1); });
      return [...g].map(([k, n]) => { const [pid, t, x] = k.split('|'); return '<b>' + esc(nameOf(pid)) + '</b> <span class="muted">' + esc(t) + '</span>' + (n > 1 ? ' ×' + n : '') + (x ? ' ' + x : ''); }).slice(0, 12).join(', ') + (g.size > 12 ? ' and more' : ''); };
    const add = Object.keys(items).filter(f => !prevItems[f]), rem = Object.keys(prevItems).filter(f => !items[f]);
    const moved = groupMode() ? Object.keys(items).filter(f => prevItems[f] && prevItems[f].a && items[f].a !== prevItems[f].a) : [];
    S.walletNew = add.length;
    if (add.length) diff.push('<div><b class="up">+' + plural(add.length, 'new Moment', 'new Moments') + ':</b> ' + grp(add, items, S.walletCol) + '.</div>');
    if (rem.length) diff.push('<div><b class="down">−' + plural(rem.length, 'Moment gone', 'Moments gone') + ':</b> ' + grp(rem, prevItems, prevCol) + '.</div>');
    if (moved.length) diff.push('<div><b>' + plural(moved.length, 'Moment moved', 'Moments moved') + ' to another account:</b> ' + grp(moved, items, S.walletCol, f => '→ ' + esc(accLabel(items[f].a))) + '.</div>');
  }
  openSheet('<h3>Your collection</h3><div class="small muted">' + tot + ' · ' + found.length + ' NBA players this season</div>' +
    (failed.length ? '<div class="note">Couldn\'t read: ' + esc(failed.join(' · ')) + '</div>' : '') +
    (dupAddr.length ? '<div class="note">' + esc(dupAddr.join(', ')) + ' has the same Flow address as another account: I only read that wallet once. Check the addresses in Settings → Profile.</div>' : '') +
    (diff.length ? '<div class="note info">' + diff.join('') + '</div>' : prevItems ? '<div class="small muted">No new Moments since the last read.</div>' : '') +
    '<div class="small muted">Tiers: ' + TIERS.slice().reverse().filter(t => tierCount[t]).map(t => '<b>' + t + '</b> ' + tierCount[t]).join(' · ') + '</div>' +
    (ups.length ? '<div class="small">Uses that change: ' + ups.slice(0, 12).map(u => esc(u.e.p.name) + ' ' + u.cur + ' → <b>' + u.to + '</b>').join(' · ') + (ups.length > 12 ? ' and another ' + (ups.length - 12) : '') + '.</div>' : '') +
    // só o que muda (a lista toda fica em Jogadores → Coleção)
    (!found.length ? '<div class="small muted">No Moment of a player with an NBA team this season.</div>'
      : fresh.length ? '<div class="small"><b>' + plural(fresh.length, 'new player', 'new players') + ':</b> ' + fresh.slice(0, 12).map(e => esc(e.p.name)).join(', ') + (fresh.length > 12 ? ' and another ' + (fresh.length - 12) : '') + '.</div>'
      : hasRun && !ups.length && diff.length ? '<div class="small muted">Uses in your roster stay the same.</div>' : '') +
    (gone.length ? '<label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="wGone"> <span>Remove from the roster whoever is no longer in the wallet: ' + gone.map(id => esc(nameOf(id))).join(', ') + '</span></label>' : '') +
    '<button class="btn primary" type="button" data-action="wallet-apply" style="width:100%">' + (hasRun ? (fresh.length ? 'Save and add ' + fresh.length + ' player' + (fresh.length > 1 ? 's' : '') + ' to the roster' : 'Save and update the roster') : 'Save the collection') + '</button>');
}
async function walletApply() {
  const col = S.walletCol; if (!col) return;
  // guarda no perfil
  try { await q(sb.from('profiles').update({ collection: col }).eq('user_id', S.session.user.id)); S.profile = Object.assign({}, S.profile, { collection: col }); }
  catch (e) { toast(/collection/.test(errText(e)) ? 'To save the collection, run the new supabase/schema.sql in Supabase.' : 'The collection was not saved: ' + errText(e)); S.profile = Object.assign({}, S.profile, { collection: col }); }
  let added = 0, removed = 0;
  if (S.runId && S.mineLoaded) {
    Object.entries(col.players).forEach(([id, c]) => {
      const info = { moments: c.moments, sets: c.sets }, tot = tierUsesOf(col, c) || 1, left = Math.max(0, tot - usedCount('main', id));
      const e = S.mine.roster[id];
      if (e) {
        Object.assign(e, info);
        // usos pelo escalão: os acertados à mão ficam; os antigos (de antes dos escalões) só sobem
        if (!e.usesManual) { e.uses = e.tierUses != null ? left : Math.max(+e.uses || 0, left); e.tierUses = tot; }
      } else { S.mine.roster[id] = Object.assign({ uses: left, tierUses: tot, status: 'ok' }, info); added++; }
    });
    const box = $('wGone');
    if (box && box.checked) (S.walletGone || []).forEach(id => { delete S.mine.roster[id]; removed++; });
    applyChainResults(); saveMine();
  }
  S.walletCol = null; S.walletGone = null;
  closeSheet(); schedule();
  const nm = S.walletNew || 0; S.walletNew = 0;
  toast((nm ? '+' + plural(nm, 'new Moment', 'new Moments') + ' in your collection. ' : '') + (S.runId ? (added ? plural(added, 'new player', 'new players') + ' in the roster' : 'Roster updated') + (removed ? ', ' + plural(removed, 'removed', 'removed') : '') + '.' : 'Collection saved.'));
}
// junta ao plantel da run os jogadores da coleção guardada (1 uso cada; acertam-se depois)
function collectionToRoster() {
  const col = (S.profile || {}).collection; if (!col || !S.runId) return;
  let added = 0;
  Object.entries(col.players || {}).forEach(([id, c]) => { if (!S.mine.roster[id] && S.players.has(String(id))) { const tot = tierUsesOf(col, c) || 1; S.mine.roster[id] = { uses: Math.max(0, tot - usedCount('main', id)), tierUses: tot, status: 'ok', moments: c.moments, sets: c.sets }; added++; } });
  applyChainResults(); schedule(); saveMine();
  toast(added + ' player' + (added === 1 ? '' : 's') + ' from the collection added to the roster.');
}

// ---------- ações ----------
function deepMerge(a, b) {
  Object.keys(b).forEach(k => {
    if (b[k] == null) a[k] = null; // null apaga o valor (o clone transformava-o em {})
    else if (typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], b[k]);
    else a[k] = clone(b[k]);
  });
  return a;
}
// Nunca mais dias fixados do que usos: o cadeado novo fica (com carimbo em plan.lockAt) e o jogador sai dos
// cadeados dos outros dias, primeiro os mais antigos e os mais longe. before = plan.locks antes da mudança.
// Devolve [[data, id], …] dos cadeados tirados.
function capLocks(plan, before, acc) {
  const L = plan.locks || {}, pl = plan.played || {}, now = Date.now(), dropped = [];
  const fresh = [];
  Object.entries(L).forEach(([d, ids]) => (ids || []).forEach(id => { if (!((before || {})[d] || []).includes(id)) fresh.push([d, id]); }));
  if (!fresh.length) return dropped;
  plan.lockAt = Object.assign({}, plan.lockAt);
  const roster = engineInputs(acc || S.acc).roster.players, today = todayET();
  fresh.forEach(([d, id]) => {
    plan.lockAt[d + '|' + id] = now;
    const u = Math.max(0, Math.floor(+((roster[id] || {}).uses || 0)));
    const others = Object.keys(L).filter(x => x !== d && x >= today && !(pl[x] && pl[x].done) && (L[x] || []).includes(id))
      .sort((a, b) => ((plan.lockAt[b + '|' + id] || 0) - (plan.lockAt[a + '|' + id] || 0)) || a.localeCompare(b));
    others.slice(Math.max(0, u - 1)).forEach(x => { L[x] = L[x].filter(y => y !== id); dropped.push([x, id]); });
  });
  Object.keys(plan.lockAt).forEach(k => { const i = k.indexOf('|'); if (!(L[k.slice(0, i)] || []).includes(k.slice(i + 1))) delete plan.lockAt[k]; });
  return dropped;
}
// um dia passado corrigido gastou mais um uso (ex.: o jogador estava fixado em todos os usos que restavam):
// tira os cadeados a mais, dos dias mais longe para os mais perto (os do dia que já começou ficam)
function capOver(plan, ids, acc) {
  const L = plan.locks || {}, pl = plan.played || {}, today = todayET(), dropped = [];
  const roster = engineInputs(acc || S.acc).roster.players, started = d => { const day = S.days.find(x => x.date === d), t = day ? firstTipOf(day) : null; return t != null && Date.now() >= t; };
  [...new Set(ids)].forEach(id => {
    const u = Math.max(0, Math.floor(+((roster[id] || {}).uses || 0)));
    const on = Object.keys(L).filter(d => d >= today && !(pl[d] && pl[d].done) && (L[d] || []).includes(id)).sort();
    const fixed = on.filter(started), free = on.filter(d => !started(d));
    free.slice(Math.max(0, u - fixed.length)).forEach(d => {
      L[d] = L[d].filter(y => y !== id); dropped.push([d, id]);
      if (plan.keep && plan.keep[d]) plan.keep[d] = plan.keep[d].filter(y => y !== id);
      if (plan.lockAt) delete plan.lockAt[d + '|' + id];
    });
  });
  return dropped;
}
const dayNo = date => S.days.findIndex(d => d.date === date) + 1;
const capMsg = dr => (dr.length ? ' No uses for more days: removed the lock of ' + [...new Set(dr.map(([, id]) => id))].map(id => { const n = dr.filter(x => x[1] === id).map(x => dayNo(x[0])).sort((a, b) => a - b); return lastName(id) + (n.length > 1 ? ' on days ' : ' on day ') + n.join(', '); }).join('; ') + '.' : '');
// muda o plano (cópia ou o verdadeiro) e aplica a regra dos usos aos cadeados novos
function modCap(mod, plan) {
  const before = clone(plan.locks || {}), bb = clone(plan.bans || {}), kb = clone(plan.keep || {}); mod(plan);
  const same = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
  // um dia com cadeados ou tirados mudados deixa de manter o lineup, a não ser que a própria mudança o mantenha
  if (plan.keep) Object.keys(plan.keep).forEach(d => { if (same(plan.keep[d], kb[d]) && (!same((plan.locks || {})[d], before[d]) || !same((plan.bans || {})[d], bb[d]))) delete plan.keep[d]; });
  return capLocks(plan, before);
}
// keepDay: mudança que mantém o lineup do dia (tirar um cadeado); as outras mudanças num dia (fixar, tirar, voltar à
// sugestão) deixam o plano voltar a escolher esse dia
function planPatch(patch, keepDay) {
  const p = curPlan(), before = clone(p.locks || {}), today = todayET();
  if (p.keep) { Object.keys(p.keep).forEach(d => { if (d < today || (!keepDay && ((patch.locks && d in patch.locks) || (patch.bans && d in patch.bans)))) delete p.keep[d]; }); }
  deepMerge(p, patch); const dr = patch.locks ? capLocks(p, before) : []; schedule(); saveMine(); return dr;
}
// Fixar quem o plano não põe nesse dia (ou tirar quem ele põe): antes de mudar, mostra o que custa — vitória nesse
// dia, prémios e vitórias esperadas da run, quem sai do lineup e em que dias o jogador deixa de jogar
async function choiceSheet(id, date, kind) {
  const r = S.result, cur = view(); if (!r || !cur) return;
  const d0 = cur.days.find(x => x.date === date), inPlan = !!(d0 && d0.lineup.includes(id));
  if (kind === 'lock' && (inPlan || !d0)) { lockToggle(id, date, true); luBack(date); return; }
  if (kind === 'ban' && !inPlan) { banToggle(id, date, true); luBack(date); return; }
  const day = S.days.find(x => x.date === date) || {}, dn = S.days.indexOf(day) + 1, name = esc(nameOf(id));
  const title = kind === 'lock' ? 'Lock ' + name + ' on day ' + dn + '?' : 'Remove ' + name + ' of day ' + dn + '?';
  const back = () => playerSheet(id, date, S.lu && S.lu.date === date ? () => lineupSheet(date) : null);
  openSheet('<h3>' + title + '</h3><div class="small muted" id="choiceProg">Redoing the run…</div>', back);
  await new Promise(res => setTimeout(res, 30));
  let ev;
  try {
    ev = await evalAltAsync(kind === 'lock'
      ? (kw => plan => { plan.locks = plan.locks || {}; plan.bans = plan.bans || {}; plan.locks[date] = [...new Set((plan.locks[date] || []).concat([id]))]; plan.bans[date] = (plan.bans[date] || []).filter(x => x !== id); if (kw) { plan.keep = Object.assign({}, plan.keep || {}, { [date]: kw }); } })(keepWith(date, id))
      : altMods.ban(date, id));
  } catch (e) { console.warn(e); if ($('choiceProg')) $('choiceProg').innerHTML = '<span class="down">Couldn’t calculate:</span> ' + esc(errText(e)); return; }
  if (!$('choiceProg')) return; // fechou a folha
  const res = ev.res, d1 = res.days.find(x => x.date === date) || { P: 0, lineup: [] };
  const pp = x => Math.round(x * 100), diff = (a, b) => { const k = pp(b) - pp(a); return k === 0 ? '' : ' <small class="' + (k > 0 ? 'up' : 'down') + '">' + (k > 0 ? '+' : '−') + Math.abs(k) + ' pp</small>'; };
  const arrow = (a, b, f) => f(a) + ' → <b class="' + (b > a + 1e-9 ? 'up' : b < a - 1e-9 ? 'down' : '') + '">' + f(b) + '</b>';
  const lines = [];
  // o dia escolhido
  const outs = d0.lineup.filter(x => !d1.lineup.includes(x)), ins = d1.lineup.filter(x => !d0.lineup.includes(x) && x !== id);
  lines.push(['Day ' + dn, 'win ' + arrow(d0.P, d1.P, pct) + diff(d0.P, d1.P) + (outs.length || ins.length ? '<br><span class="muted">' + (ins.length ? 'In' + (ins.length > 1 ? '' : '') + ': ' + ins.map(x => esc(lastName(x))).join(', ') + '. ' : '') + (outs.length ? 'Out' + (outs.length > 1 ? '' : '') + ': ' + outs.map(x => esc(lastName(x))).join(', ') + '.' : '') + '</span>' : '')]);
  // os dias do jogador
  const dOf = v => v.days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1);
  const before = dOf(cur), after = dOf(res), lost = before.filter(x => !after.includes(x)), gained = after.filter(x => !before.includes(x) && x !== dn);
  lines.push([esc(lastName(id)), (before.length ? 'in the plan he played ' + (before.length > 1 ? 'on days ' : 'on day ') + before.join(', ') : 'the plan didn\'t use him') + ' → ' + (after.length ? (after.length > 1 ? 'days ' : 'day ') + after.join(', ') : 'doesn\'t play') + (lost.length ? '. <span class="down">He no longer plays ' + (lost.length > 1 ? 'on days ' : 'on day ') + lost.join(', ') + '</span>' : '') + (gained.length ? '. He now plays ' + (gained.length > 1 ? 'on days ' : 'on day ') + gained.join(', ') : '') + '.']);
  // outros dias que mudam (≥ 3 pp)
  const others = cur.days.filter(x => x.date !== date).map(x => ({ x, y: res.days.find(z => z.date === x.date) })).filter(o => o.y && Math.abs(pp(o.y.P) - pp(o.x.P)) >= 3);
  if (others.length) lines.push(['Other days', others.slice(0, 6).map(o => 'day ' + (o.x.idx + 1) + ' ' + arrow(o.x.P, o.y.P, pct)).join(' · ') + (others.length > 6 ? ' and another ' + (others.length - 6) : '')]);
  // a run toda
  const ew0 = r.wins + cur.expected, ew1 = r.wins + res.expected;
  lines.push(['Run', (r.prizes.length ? r.prizes.map((p, i) => p.wins + 'V ' + arrow(cur.prizeProbs[i], res.prizeProbs[i], pct)).join(' · ') + '<br>' : '') + 'expected wins ' + arrow(ew0, ew1, f1)]);
  // as outras contas (plano conjunto)
  if (ev.group && S.multi) {
    const acc = ev.group.keys.filter(k => k !== S.acc).map(k => { const a = S.multi.byKey[k], b = ev.group.byKey[k]; if (!a || !b) return ''; const e0 = a.wins + a.normal.expected, e1 = b.wins + b.normal.expected; return Math.abs(e1 - e0) >= 0.05 ? esc(accLabel(k)) + ' ' + arrow(e0, e1, f1) : ''; }).filter(Boolean);
    if (acc.length) lines.push(['Other accounts', 'expected wins: ' + acc.join(' · ')]);
  }
  const loss = ew1 < ew0 - 0.05 || r.prizes.some((p, i) => pp(res.prizeProbs[i]) < pp(cur.prizeProbs[i]));
  const gain = !loss && (ew1 > ew0 + 0.05 || r.prizes.some((p, i) => pp(res.prizeProbs[i]) > pp(cur.prizeProbs[i])));
  const verdict = loss ? '<div class="note">It <b>costs</b> your run. Do it anyway if you know something the plan doesn’t (minutes, injury).</div>'
    : gain ? '<div class="note info">It <b>raises</b> your chances. Worth it.</div>'
    : '<div class="note info">Barely changes anything.</div>';
  openSheet('<h3>' + title + '</h3>' + verdict + '<div class="card">' + lines.map(([a, b]) => '<div class="status-line basis-line"><span class="bl">' + a + '</span><span>' + b + '</span></div>').join('') + '</div>' +
    '<div class="btns"><button class="btn quiet" type="button" data-action="sheet-back">Cancel</button><button class="btn ' + (loss ? '' : 'primary') + '" type="button" data-action="' + (kind === 'lock' ? 'lock-yes' : 'ban-yes') + '" data-id="' + esc(id) + '" data-date="' + date + '">' + (kind === 'lock' ? 'Lock anyway' : 'Remove anyway') + '</button></div>', back);
}
// lineup de um dia com este jogador lá dentro, sem mexer nos outros (se não houver lugar, sai quem menos pesa)
function keepWith(date, id, out) {
  const v = view(), dd = v && v.days.find(x => x.date === date), { md } = dayInfo(date);
  if (!dd || !md) return null;
  let L = dd.lineup.filter(x => x !== out);
  if (L.includes(id)) return L;
  if (L.length >= md.size) {
    const locks = new Set(((curPlan().locks || {})[date]) || []);
    let best = null; L.forEach(x => { if (locks.has(x)) return; const P = lineupP(md, L.filter(y => y !== x).concat([id])); if (!best || P > best.P) best = { x, P }; });
    if (!best) return null;
    L = L.filter(y => y !== best.x);
  }
  return L.concat([id]);
}
// fixar o lineup todo desse dia (os que lá estão agora, menos os lugares livres) ou soltar todos (o lineup fica igual)
function lockAll(date, on) {
  const { md, d } = dayInfo(date); if (!md || !d) return;
  const gaps = (S.lu && S.lu.date === date && S.lu.out) || [];
  if (on) {
    const ids = d.lineup.filter(id => !gaps.includes(id)).slice(0, md.size);
    const dr = planPatch({ locks: { [date]: ids }, bans: { [date]: (((curPlan().bans || {})[date]) || []).filter(x => !ids.includes(x)) } });
    toast(plural(ids.length, 'player locked', 'players locked') + '.' + capMsg(dr));
  } else {
    planPatch({ locks: { [date]: [] }, keep: { [date]: d.lineup.slice() } }, true);
    toast('All unlocked. The lineup stays the same.');
  }
}
function lockToggle(id, date, on) {
  const cur = new Set(((curPlan().locks || {})[date]) || []);
  if (on) {
    const lim = (S.days.find(d => d.date === date) || {}).numPlayers || 5;
    if (cur.size >= lim) { toast('You already have ' + lim + ' players locked on this day.'); return false; }
    cur.add(id);
    // o resto do lineup desse dia fica (só tu é que trocas); se ele não estava e o lineup está cheio, sai quem menos
    // falta faz nesse dia
    const keep = keepWith(date, id);
    const dr = planPatch(Object.assign({ locks: { [date]: [...cur] }, bans: { [date]: (((curPlan().bans || {})[date]) || []).filter(x => x !== id) } }, keep ? { keep: { [date]: keep } } : {}), !!keep);
    toast(lastName(id) + ' locked.' + (keep ? ' The rest of the lineup stays.' : ' Plan redone.') + capMsg(dr));
  } else {
    // tirar o cadeado não muda o lineup desse dia: fica como está (o plano só volta a escolher se mudares outra coisa)
    const v = view(), dd = v && v.days.find(x => x.date === date);
    cur.delete(id); planPatch({ locks: { [date]: [...cur] }, keep: { [date]: dd ? dd.lineup.slice() : null } }, true);
    toast(lastName(id) + ' unlocked. The lineup stays the same.');
  }
  return true;
}
function banToggle(id, date, on) {
  const cur = new Set(((curPlan().bans || {})[date]) || []);
  on ? cur.add(id) : cur.delete(id);
  planPatch({ bans: { [date]: [...cur] }, locks: { [date]: (((curPlan().locks || {})[date]) || []).filter(x => !on || x !== id) } });
  if (on) toast(lastName(id) + ' out of this day. Plan redone.');
}
// ---- Mudar o lineup de um dia: fixar, tirar e pôr jogadores um a um. Cada mudança refaz a run e a folha mostra o que
// muda face à sugestão do plano (o plano sem as tuas escolhas nesse dia): vitória do dia, vitórias esperadas, prémios e
// os outros dias em que entra ou sai alguém. S.lu = {date, base, busy, all, toTop}; fecha-se com a folha.
const icoPlus = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const icoClock = '<svg class="ico-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const icoLockBtn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const luSnap = (wins, v, date) => { const d = v.days.find(x => x.date === date) || { P: 0, lineup: [] }; return { P: d.P, lineup: d.lineup.slice(), ew: wins + v.expected, probs: (v.prizeProbs || []).slice(), days: v.days.map(x => ({ date: x.date, idx: x.idx, P: x.P, lineup: x.lineup.slice() })) }; };
async function lineupSheet(date) {
  const r = S.result, v = view(); if (!r || !v) return;
  if (!S.lu || S.lu.date !== date) {
    const mine = (((curPlan().locks || {})[date]) || []).length + (((curPlan().bans || {})[date]) || []).length;
    S.lu = { date, base: mine ? null : luSnap(r.wins, v, date), toTop: true }; // sem escolhas neste dia: a sugestão é o plano que se vê
  }
  luRender();
  const L = S.lu;
  if (L.base || L.busy) return;
  L.busy = true;
  await new Promise(ok => setTimeout(ok, 30));
  try { L.base = luSnap(r.wins, (await evalAltAsync(altMods.clear(date))).res, date); } catch (e) { console.warn(e); L.err = true; }
  L.busy = false;
  if (S.lu === L && $('luBody')) luRender();
}
// com várias contas: pôr o jogador nesta conta nesta noite exige uma carta que já está a ser usada noutra conta?
// (a k-ésima jogada de cada conta precisa de uma carta com ≥ k usos e cada carta só joga numa conta por noite)
function tierBlocked(id, acc, date) {
  if (!S.multi) return null;
  const cd = (collectionInfo(id).cards || []).slice().sort((a, b) => b - a); if (!cd.length) return null;
  const nth = k => { const r = S.multi.byKey[k]; return usedCount(k, id) + (r ? r.normal.days.filter(d => d.date < date && d.lineup.includes(id)).length : 0) + 1; };
  // o lineup que a outra conta joga nessa noite: o submetido/ao vivo, se já se sabe; senão o do plano
  const luOf = k => lineupFor(k, date) || ((((S.multi.byKey[k] || {}).normal || { days: [] }).days.find(d => d.date === date) || {}).lineup || []);
  const others = accounts().map(a => a.id).filter(k => k !== acc && luOf(k).includes(id));
  const req = others.concat([acc]).map(nth).sort((a, b) => b - a);
  return req.some((r, j) => r > (cd[j] || 0)) ? { others, need: nth(acc), top: cd[0] } : null;
}
// 2.ª linha de quem pode entrar: os usos que tem e os dias em que o plano o usa; aviso a amarelo se hoje não dá
function candLine(r, pi, tb, ds, tir, date) {
  const nd = nextDay(), dn = S.days.findIndex(x => x.date === date) + 1;
  // ninguém mais o usa nessa noite: é esta conta que já gastou o que as cartas dão
  if (tb && !tb.others.length) return '<span class="lu-l2 lu-warn">⚠ No uses left on this account: the best card gives ' + esc(usesTxt(tb.top)) + ', already spent or planned on other days</span>';
  if (tb) return '<span class="lu-l2 lu-warn">⚠ Needed Moment already plays on ' + esc(tb.others.map(accLabel).join(' and on ')) + (nd && nd.date === date ? '' : ' on day ' + dn) + '</span>';
  const u = r.model.uses[pi] || 0;
  if (!u) return '<span class="lu-l2">no uses left</span>';
  return '<span class="lu-l2"><b>' + (u >= UNL ? 'unlimited uses' : plural(u, 'use', 'uses')) + '</b> · ' + (ds.length ? 'plays ' + (ds.length > 1 ? 'on days ' : 'on day ') + ds.join(', ') : 'not in the plan') + '</span>';
}
function luRender() {
  const L = S.lu, r = S.result, v = view(); if (!L || !r || !v) return;
  const date = L.date, { md, d } = dayInfo(date), day = S.days.find(x => x.date === date) || {}, dn = S.days.indexOf(day) + 1;
  const p0 = $('sheetPanel'), keep = L.toTop ? 0 : $('luBody') ? p0.scrollTop : L.y || 0; L.toTop = false; L.y = 0;
  const tip = firstTipOf(day);
  if (!md || !d || (tip != null && Date.now() >= tip)) { openSheet('<h3>Lineup for day ' + dn + '</h3><div class="note info" id="luBody">This day’s games have already started: changes are made in Suggestions for today.</div>'); return; }
  const locks = new Set(((curPlan().locks || {})[date]) || []), bans = ((curPlan().bans || {})[date]) || [], size = md.size;
  const B = L.base, pp = x => Math.round(x * 100), ew = r.wins + v.expected, mine = locks.size + bans.length > 0;
  const sgn = (n, s) => (n > 0 ? '+' : '−') + s;
  // em cima: hoje e a run, face à sugestão
  let head;
  if (!B) head = '<div class="small muted" id="luProg">' + (L.err ? '<span class="down">Couldn’t work out the plan’s suggestion.</span>' : 'Working out the plan’s suggestion…') + '</div>';
  else {
    // hoje e o resto da run em separado: o que a escolha de hoje faz aos outros dias (vitórias esperadas neles)
    const rest = days => days.filter(x => x.date !== date).reduce((t, x) => t + (x.P || 0), 0);
    const dP = pp(d.P) - pp(B.P), rNow = rest(v.days), rB = rest(B.days), dR = rNow - rB;
    const f2 = x => (Math.round(x * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    head = '<div class="kv lu-kv"><div><div class="label">Win today</div><div class="v num c-' + tone(d.P) + '">' + pct(d.P) + '</div><div class="small muted">' + (!mine ? 'the plan’s suggestion' : 'suggestion ' + pct(B.P) + (dP ? ' · <b class="' + (dP > 0 ? 'up' : 'down') + '">' + sgn(dP, Math.abs(dP) + '%') + '</b>' : '')) + '</div></div>' +
      '<div><div class="label">Rest of the run</div><div class="v num">' + f1(rNow) + '</div><div class="small muted">' + (!mine ? 'expected wins on the other days' : Math.abs(dR) < 0.05 ? 'same as the suggestion' : 'suggestion ' + f1(rB) + ' · <b class="' + (dR > 0 ? 'up' : 'down') + '">' + sgn(dR, f2(Math.abs(dR))) + '</b>') + '</div></div></div>';
    if (mine) {
      const pz = r.prizes.map((p, i) => ({ p, a: B.probs[i] || 0, b: v.prizeProbs[i] || 0 })).filter(x => pp(x.a) !== pp(x.b));
      const todayTxt = dP ? ' (today ' + sgn(dP, Math.abs(dP) + '%') + ')' : '';
      head += (dR <= -0.3 ? '<div class="note"><b>Affects the rest of the run:</b> ' + sgn(dR, f2(Math.abs(dR))) + ' expected wins on the other days' + todayTxt + '. Keep it if you know something the plan doesn’t (minutes, injury).</div>'
        : dR <= -0.05 ? '<div class="note info"><b>Barely touches the rest of the run:</b> ' + sgn(dR, f2(Math.abs(dR))) + ' wins on the other days' + todayTxt + '.</div>'
        : dR >= 0.05 ? '<div class="note info"><b>Improves the rest of the run:</b> ' + sgn(dR, f2(dR)) + ' wins on the other days' + todayTxt + '.</div>'
        : '<div class="note info"><b>The rest of the run doesn’t change.</b> ' + (dP ? 'The difference is only today' + todayTxt + '.' : 'Same as the plan’s suggestion.') + '</div>') +
        (pz.length ? '<div class="small muted">Prizes: ' + pz.map(x => x.p.wins + 'V ' + pct(x.a) + ' → ' + pct(x.b)).join(' · ') + '</div>' : '');
    }
  }
  // no lineup: cadeado (fixar / soltar) e × (tirar deste dia; o plano põe outro)
  const nameBtn = (id, p, pi, sub) => { const st = (md.info[pi][0] || {}).status; return '<button class="lu-main" type="button" data-action="lu-player" data-id="' + esc(id) + '" data-date="' + date + '">' + face(id, 'sm') + '<span class="lu-t"><span class="pn">' + (locks.has(id) ? icoLock : '') + '<span class="nm">' + esc(p.name) + '</span>' + (st && st !== 'ok' ? '<span class="pill ' + st + '">' + esc(STATUS[st].label) + '</span>' : '') + '</span><span class="ps">' + sub + '</span></span></button>'; };
  const later = id => v.days.filter(x => x.date !== date && x.lineup.includes(id)).map(x => x.idx + 1);
  const gaps = (L.out || []).filter(id => d.lineup.includes(id));
  const inRows = d.lineup.map(id => {
    const pi = r.model.pIndex.get(id), p = r.model.players[pi]; if (pi == null) return '';
    if (gaps.includes(id)) return '<li class="lu-row lu-gap"><div class="gapb"><button class="gapb-go" type="button" data-action="lu-pick" data-id="' + esc(id) + '" data-date="' + date + '"><span class="gapb-ic">' + icoPlus + '</span><span class="gapb-t"><b>Add player</b><span>out: ' + esc(p.name) + '</span></span></button>' +
      '<button class="btn link small gapb-keep" type="button" data-action="lu-undo" data-id="' + esc(id) + '" data-date="' + date + '">keep</button></div></li>';
    const lk = locks.has(id);
    return '<li class="lu-row">' + nameBtn(id, p, pi, esc(p.team) + ' ' + esc(opp(p.team, day)) + (lk ? ' · locked' : '')) + pvHtml(objVals(md, pi, false)) +
      '<button class="lu-ic' + (lk ? ' on' : '') + '" type="button" data-action="lu-lock" data-id="' + esc(id) + '" data-date="' + date + '" aria-pressed="' + lk + '" aria-label="Lock ' + esc(p.name) + '" title="' + (lk ? 'Locked (tap to unlock)' : 'Lock') + '">' + icoLockBtn + '</button>' +
      '<button class="lu-ic" type="button" data-action="lu-ban" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Remove ' + esc(p.name) + ' from this day" title="Remove from this day">' + icoX + '</button></li>';
  }).join('');
  // os outros dias que mudam (quem entra e quem sai), face à sugestão
  let chHtml = '';
  if (B && mine) {
    const ch = v.days.filter(x => x.date !== date).map(x => { const b = B.days.find(y => y.date === x.date); if (!b) return null; const ins = x.lineup.filter(id => !b.lineup.includes(id)), outs = b.lineup.filter(id => !x.lineup.includes(id)); return ins.length || outs.length || Math.abs(pp(x.P) - pp(b.P)) >= 3 ? { x, b, ins, outs } : null; }).filter(Boolean);
    if (ch.length) chHtml = '<div class="card"><div class="list-head"><h2>Changes on other days</h2><span class="small muted">compared with the suggestion</span></div><ul class="list">' +
      ch.slice(0, 6).map(c => '<li class="row lu-ch"><span><b>Day ' + (c.x.idx + 1) + '</b> ' + pct(c.b.P) + ' → <b class="' + (pp(c.x.P) > pp(c.b.P) ? 'up' : pp(c.x.P) < pp(c.b.P) ? 'down' : '') + '">' + pct(c.x.P) + '</b>' + (c.outs.length ? ' · out ' + c.outs.map(id => esc(lastName(id))).join(', ') : '') + (c.ins.length ? ' · in ' + c.ins.map(id => esc(lastName(id))).join(', ') : '') + '</span></li>').join('') +
      (ch.length > 6 ? '<li class="row small muted" style="display:block">and ' + plural(ch.length - 6, 'day', 'days') + '</li>' : '') + '</ul></div>';
  }
  // pôr no lineup: quem joga neste dia e não está, do que mais rende para o que menos (com os dias em que o plano o usa)
  const weight = luSortKey(md);
  const playing = FB.teamsOn(day), banPis = bans.map(id => r.model.pIndex.get(id)).filter(pi => pi != null && playing.has(r.model.players[pi].team) && !md.elig.includes(pi));
  // quem acabou de sair (lugar livre) fica no topo da lista: o + volta a pô-lo, sem ter de pôr outro primeiro
  const outPis = gaps.map(id => r.model.pIndex.get(id)).filter(pi => pi != null);
  const cand = outPis.concat(md.elig.filter(pi => !d.lineup.includes(r.model.players[pi].id)).sort((a, b) => weight(b) - weight(a)));
  void banPis;
  const full = locks.size >= size, banSet = new Set(bans);
  // todos na lista (para a procura encontrar qualquer um); sem procura, só os 8 primeiros até "Ver todos"
  const candRows = cand.map((pi, k) => {
    const p = r.model.players[pi], id = p.id, tb = tierBlocked(id, S.acc, date), uses = tb ? 0 : r.model.uses[pi] || 0, ds = later(id), tir = banSet.has(id);
    if (gaps.includes(id)) return '<li class="lu-row" data-n="' + esc(norm(p.name) + ' ' + String(p.team || '').toLowerCase()) + '">' + nameBtn(id, p, pi, esc(p.team) + ' ' + esc(opp(p.team, day)) + '<span class="lu-l2">just left · + puts him back · × takes him out of this day</span>') + pvHtml(objVals(md, pi, false)) +
      '<button class="lu-ic add" type="button" data-action="lu-undo" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Put back ' + esc(p.name) + ' in the lineup" title="Put back">' + icoPlus + '</button>' +
      '<button class="lu-ic" type="button" data-action="lu-auto" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Remove ' + esc(p.name) + ' out of this day (the plan puts in the next best)" title="Take out of this day">' + icoX + '</button></li>';
    return '<li class="lu-row' + (k >= 8 && !L.all ? ' lu-more' : '') + '" data-n="' + esc(norm(p.name) + ' ' + String(p.team || '').toLowerCase()) + '">' + nameBtn(id, p, pi, esc(p.team) + ' ' + esc(opp(p.team, day)) + candLine(r, pi, tb, ds, tir, date)) + pvHtml(objVals(md, pi, false)) +
      (gaps.length ? '<button class="lu-ic add" type="button" data-action="lu-fill" data-out="' + esc(gaps[0]) + '" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Add ' + esc(p.name) + ' in place of ' + esc(nameOf(gaps[0])) + '" title="Put in the empty spot"' + (uses ? '' : ' disabled') + '>' + icoPlus + '</button>' :
      '<button class="lu-ic add" type="button" data-action="lu-add" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Add ' + esc(p.name) + ' to the lineup" title="' + (full ? 'You already have ' + size + ' locked: unlock one first' : 'Add to the lineup and lock') + '"' + (uses && !full ? '' : ' disabled') + '>' + icoPlus + '</button>') + '' +
      '<button class="lu-ic" type="button" data-action="lu-excl" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Remove ' + esc(p.name) + ' from this day" title="Remove from this day">' + icoX + '</button></li>';
  }).join('');
  const bad = (d.badLocks || []).map(id => esc(nameOf(id)) + ' <button class="btn link small" type="button" data-action="lu-lock" data-id="' + esc(id) + '" data-date="' + date + '">unlock</button>').join(' · ');
  const html = '<h3>Lineup for day ' + dn + ' ' + helpBtn('mudar') + '</h3><div class="small muted">' + dWeek(date) + ', ' + dShort(date) + ' · ' + esc(objsText(day)) + '</div><div id="luBody" class="stack">' + head +
    (gaps.length ? '<div class="note info">Tap + to choose who comes in' + (gaps.length > 1 ? ' for each empty spot' : '') + ', or the × of who left (in Add to lineup) to take him out of this day: the plan puts in the next best right away. Until then, the numbers are the lineup’s before the swap.</div>' : '') +
    '<div class="card"><div class="list-head"><h2>In the lineup</h2><span class="small muted">' + d.lineup.length + ' of ' + size + (locks.size ? ' · ' + plural(locks.size, 'locked', 'locked') : '') + '</span></div>' +
      (d.lineup.length ? (d.lineup.every(id => locks.has(id)) ? '<div class="lu-all"><button class="btn small" type="button" data-action="lu-lockall" data-on="0" data-date="' + date + '">' + icoLockBtn + ' Unlock all</button></div>' : '<div class="lu-all"><button class="btn small" type="button" data-action="lu-lockall" data-on="1" data-date="' + date + '">' + icoLockBtn + ' Lock all</button></div>') : '') + (inRows ? '<ul class="list">' + inRows + '</ul>' : '<div class="row small muted">Nobody in the lineup: the plan saves the uses for other days.</div>') + '</div>' +
    (bad ? '<div class="note">Locked but can’t play this day: ' + bad + '</div>' : '') + chHtml +
    (cand.length ? '<div class="card"><div class="list-head"><h2>Add to the lineup</h2><span class="small muted" id="luCount">' + plural(cand.length, 'player', 'players') + '</span></div>' +
      '<div class="lu-search"><input class="field" id="luSearch" type="search" placeholder="Search player or team…" autocomplete="off" aria-label="Search player" value="' + esc(L.q || '') + '"></div>' + luSortChips(md, 'data-date="' + date + '"') +
      '<ul class="list" id="luCand">' + candRows + '<li class="row small muted lu-none" hidden>Nobody with that name plays on this day.</li></ul>' + (cand.length > 8 && !L.all ? '<button class="btn quiet" type="button" id="luAllBtn" data-action="lu-all" data-date="' + date + '" style="margin:4px 16px 14px">See all (' + cand.length + ')</button>' : '') + '</div>' : '') +
    (bans.length ? '<div class="card"><div class="list-head"><h2>Out of this day</h2><span class="small muted">the plan doesn’t use them on day ' + dn + '</span></div><ul class="list">' + bans.map(id => '<li class="lu-row"><div class="lu-main">' + face(id, 'sm') + '<span class="lu-t"><span class="pn"><span class="nm">' + esc(nameOf(id)) + '</span></span><span class="ps">' + esc(pTeam(id)) + ' ' + esc(opp(pTeam(id), day)) + '</span></span></div>' +
      '<button class="btn small" type="button" data-action="lu-unban" data-id="' + esc(id) + '" data-date="' + date + '">Restore</button></li>').join('') + '</ul></div>' : '') +
    (mine ? '<button class="btn" type="button" data-action="lu-reset" data-date="' + date + '">Back to the plan’s suggestion</button>' : '') + '</div>';
  openSheet(html);
  luFilter();
  if (keep) p0.scrollTop = keep;
}
// procura em "Pôr no lineup": mostra só quem tem o nome (ou a equipa) escrito, entre todos os que jogam nesse dia
function luFilter() {
  const ul = $('luCand'); if (!ul) return;
  const inp = $('luSearch'), qn = norm(inp ? inp.value : ''), rows = [...ul.querySelectorAll('li[data-n]')];
  let n = 0;
  rows.forEach(li => { const ok = qn ? li.dataset.n.includes(qn) : !li.classList.contains('lu-more'); li.hidden = !ok; if (ok) n++; });
  const none = ul.querySelector('.lu-none'); if (none) none.hidden = !(qn && !n);
  const all = $('luAllBtn'); if (all) all.hidden = !!qn;
}
// ordem de quem pode entrar: pelos objetivos juntos (o que mais rende) ou só por uma das estatísticas do dia
S.luSort = null;
function luSortKey(md) { const k = S.luSort != null && S.luSort < md.objs.length ? S.luSort : null; return pi => k == null ? md.objs.reduce((t, _, j) => t + (md.mu[pi][j] || 0) / (md.T[j] || 1), 0) : (md.mu[pi][k] || 0); }
function luSortChips(md, attrs) {
  if (md.objs.length < 2) return '';
  const cur = S.luSort != null && S.luSort < md.objs.length ? S.luSort : -1;
  return '<div class="chips lu-sort" role="group" aria-label="Sort by">' + [-1].concat(md.objs.map((_, k) => k)).map(k => '<button type="button" data-action="lu-sort" data-k="' + k + '" ' + attrs + ' aria-pressed="' + (k === cur) + '">' + (k < 0 ? 'Combined' : esc(statShort(md.objs[k].stat))) + '</button>').join('') + '</div>';
}
// Quem entra no lugar de quem saiu: os que jogam neste dia e não estão no lineup, do que mais rende para o que
// menos; ou deixar o plano escolher
function luPickSheet(date, out) {
  const r = S.result, v = view(), { md, d } = dayInfo(date); if (!r || !v || !md || !d) return;
  const day = md.day, bans = new Set(((curPlan().bans || {})[date]) || []);
  const weight = luSortKey(md);
  const later = id => v.days.filter(x => x.date !== date && x.lineup.includes(id)).map(x => x.idx + 1);
  // também os tirados deste dia (voltam a entrar com um toque)
  const playing = FB.teamsOn(day), banPis = [...bans].map(id => r.model.pIndex.get(id)).filter(pi => pi != null && playing.has(r.model.players[pi].team) && !md.elig.includes(pi) && r.model.players[pi].id !== out);
  const outPi = r.model.pIndex.get(out);
  const cand = md.elig.filter(pi => { const id = r.model.players[pi].id; return !d.lineup.includes(id); }).sort((a, b) => weight(b) - weight(a)).concat(banPis);
  const back = outPi == null ? '' : (p => '<li data-n="' + esc(norm(p.name) + ' ' + String(p.team || '').toLowerCase()) + '"><button class="row" type="button" data-action="lu-undo" data-back="1" data-id="' + esc(out) + '" data-date="' + date + '"><span class="who">' + face(out, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span></div><div class="ps">' + esc(p.team) + ' ' + esc(opp(p.team, day)) + '<span class="lu-l2">just taken out · tap to keep him</span></div></div></span>' + pvHtml(objVals(md, outPi, false)) + '</button></li>')(r.model.players[outPi]);
  const rows = back + cand.map(pi => {
    const p = r.model.players[pi], id = p.id, tb = tierBlocked(id, S.acc, date), uses = tb ? 0 : r.model.uses[pi] || 0, ds = later(id), st = (md.info[pi][0] || {}).status;
    return '<li data-n="' + esc(norm(p.name) + ' ' + String(p.team || '').toLowerCase()) + '"><button class="row" type="button" data-action="lu-fill" data-out="' + esc(out) + '" data-id="' + esc(id) + '" data-date="' + date + '"' + (uses ? '' : ' disabled') + '><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span>' + (st && st !== 'ok' ? '<span class="pill ' + st + '">' + esc(STATUS[st].label) + '</span>' : '') + '</div>' +
      '<div class="ps">' + esc(p.team) + ' ' + esc(opp(p.team, day)) + candLine(r, pi, tb, ds, bans.has(id), date) + '</div></div></span>' + pvHtml(objVals(md, pi, false)) + '</button></li>';
  }).join('');
  if (S.lu) S.lu.q = '';
  openSheet('<h3>Who comes in?</h3><div class="small muted">In place of ' + esc(nameOf(out)) + ' · day ' + (day.idx + 1) + ', ' + dShort(date) + '</div>' +
    (rows ? '<div class="lu-search"><input class="field" id="luSearch" type="search" placeholder="Search player or team…" autocomplete="off" aria-label="Search player"></div>' : '') + luSortChips(md, 'data-date="' + date + '" data-out="' + esc(out) + '"') + (rows ? '<ul class="list card" id="luCand">' + rows + '<li class="row small muted lu-none" hidden>Nobody with that name plays on this day.</li></ul>' : '<div class="note info">None of your other players has a game this day.</div>') +
    '<button class="btn" type="button" data-action="lu-auto" data-id="' + esc(out) + '" data-date="' + date + '">Let the plan choose</button>', () => lineupSheet(date));
}
// troca: sai quem estava no lugar livre (tirado do dia), entra o escolhido (fixado); a run é refeita e o Mudar mostra o efeito
function luFill(date, out, pick) {
  const P = curPlan(), size = ((dayInfo(date).md) || {}).size || 5;
  const locks = new Set(((P.locks || {})[date]) || []); locks.delete(out); locks.add(pick);
  if (locks.size > size) { toast('You already have ' + size + ' players locked this day: unlock one first.'); return; }
  const keep = keepWith(date, pick, out);
  // com o lineup mantido (keep) quem sai não fica "tirado": continua na lista para voltar a entrar com um toque
  const bans = [...new Set((((P.bans || {})[date]) || []).concat(keep ? [] : [out]))].filter(x => x !== pick);
  if (S.lu) S.lu.out = (S.lu.out || []).filter(x => x !== out);
  lineupSheet(date); luBusy(true);
  planPatch(Object.assign({ locks: { [date]: [...locks] }, bans: { [date]: bans } }, keep ? { keep: { [date]: keep } } : {}), !!keep);
}
// enquanto a run é refeita: a folha fica esbatida (e volta ao topo quando a mudança mexe no lineup)
function luBusy(top) { const b = $('luBody'); if (b) b.classList.add('busy'); if (S.lu) S.lu.toTop = !!top; }
// depois de fixar/tirar pela ficha do jogador: volta ao "Mudar lineup" se veio de lá, senão fecha
function luBack(date) { if (S.lu && S.lu.date === date) { S.lu.toTop = true; lineupSheet(date); } else closeSheet(); }
function setStatus(id, status) { if (!S.mine.roster[id]) return; S.mine.roster[id].status = status; schedule(); saveMine(); }
const useTimers = {};
function changeUses(id, delta, acc) {
  acc = acc || S.acc;
  const e = S.mine.roster[id]; if (!e || colTopUses(id)) return;
  const pk = acc + '|' + id;
  const cur = S.pendingUses[pk] != null ? S.pendingUses[pk] : usesEff(e, id, acc);
  const nv = Math.max(0, Math.min(20, cur + delta));
  S.pendingUses[pk] = nv; schedule();
  const out = $('usesOut-' + acc); if (out) out.textContent = nv;
  document.querySelectorAll('[data-uses-out="' + CSS.escape(pk) + '"]').forEach(o => { o.textContent = nv; });
  clearTimeout(useTimers[pk]);
  useTimers[pk] = setTimeout(() => { const e2 = S.mine.roster[id]; if (e2 && S.pendingUses[pk] != null) { setUsesOf(e2, acc, S.pendingUses[pk]); if (acc === 'main') e2.usesManual = true; } delete S.pendingUses[pk]; saveMine(); schedule(); }, 400);
}
function addToRoster(id, uses, extra) {
  S.mine.roster[id] = Object.assign({ uses: uses == null ? 1 : uses, status: 'ok' }, extra || {});
  applyChainResults(); schedule(); saveMine();
}
// o lineup de um dia para fechar à mão: o que jogou (blockchain, ao vivo, plano guardado) ou o do plano
function sheetLineup(date) {
  const d = (view() || { days: [] }).days.find(x => x.date === date);
  return lineupFor(S.acc, date) || (d ? d.lineup.slice() : []);
}
// mudar quem jogou num dia já passado (o Top Shot não diz o lineup submetido): o resultado é refeito pelas
// estatísticas e os usos acertam-se (os de quem saiu voltam, os de quem entrou descontam)
function luEditSheet() {
  const E = S.luEdit, day = S.days.find(d => d.date === E.date); if (!day) return;
  const date = E.date, dn = S.days.indexOf(day) + 1, lim = day.numPlayers || 5, teams = new Set((day.games || []).flatMap(g => [g[0], g[1]]));
  const objs = (day.objectives || []).filter(o => o && o.stat && +o.target > 0);
  // lê já as fichas dos jogos desse dia (para os números e o resultado saírem logo); quando chegam, redesenha
  const run = curRun(), B = S.box[date], rosterTeams = new Set(Object.keys(S.mine.roster || {}).map(pTeam).filter(t => teams.has(t)));
  if (run && !run.fictitious && (!B || (!B.busy && Date.now() - B.at > 120e3))) boxLoad(date, rosterTeams).then(() => { if (S.luEdit && S.luEdit.date === date && $('pastLu')) luEditSheet(); });
  const keep = $('pastLu') ? $('sheetPanel').scrollTop : 0;
  // ao vivo (o dia de hoje, jogos a decorrer): o que cada um leva até agora, das fichas da ESPN
  const live = !!E.live;
  const liveVals = id => { const b = boxFor(date, id); if (b === null) return 'dnp'; return b ? objs.map(o => ({ v: rnd(FB.statValue(b.v, o.stat, pAvg(id))) || 0, o, fin: b.fin })) : []; };
  const valsOf = live ? liveVals : id => { const a = objs.length ? valsFor(S.acc, date, id, objs) : undefined; return a === null ? 'dnp' : a ? objs.map((o, k) => ({ v: +a[k] || 0, o, fin: true })) : []; };
  const weight = id => { const a = valsOf(id); return a === 'dnp' ? -1 : a.reduce((t, x, k) => t + x.v / (+objs[k].target || 1), 0); };
  const sub = id => { const b = live ? boxFor(date, id) : undefined; return esc(pTeam(id)) + ' ' + (b ? (b.fin ? '· <span class="pill fim">Final</span>' : '· <span class="pill jogo">Playing</span>') : esc(opp(pTeam(id), day))); };
  const pv = id => { const a = valsOf(id); return a === 'dnp' ? '<div class="pv"><div class="u">did not play</div></div>' : pvHtml(a); };
  const row = (id, inLu, k) => '<li class="lu-row' + (!inLu && k >= 10 && !E.all ? ' lu-more' : '') + '"' + (inLu ? '' : ' data-n="' + esc(norm(nameOf(id)) + ' ' + String(pTeam(id) || '').toLowerCase()) + '"') + '><div class="lu-main">' + face(id, 'sm') + '<span class="lu-t"><span class="pn"><span class="nm">' + esc(nameOf(id)) + '</span></span><span class="ps">' + sub(id) + '</span></span></div>' + pv(id) +
    (inLu ? '<button class="lu-ic" type="button" data-action="past-lu-pick" data-id="' + esc(id) + '" aria-label="Remove ' + esc(nameOf(id)) + '" title="Remove">' + icoX + '</button>'
      : '<button class="lu-ic add" type="button" data-action="past-lu-pick" data-id="' + esc(id) + '" aria-label="Add ' + esc(nameOf(id)) + '" title="' + (E.ids.length >= lim ? 'You already have ' + lim + ': remove one first' : 'Add to lineup') + '"' + (E.ids.length >= lim ? ' disabled' : '') + '>' + icoPlus + '</button>') + '</li>';
  // em cima: o que este lineup fez nesse dia e o resultado
  const c = !live && E.ids.length ? dayCalc(S.acc, day, E.ids) : null;
  const lt = live ? objs.map((o, k) => E.ids.reduce((t, id) => { const a = liveVals(id); return t + (a === 'dnp' || !a[k] ? 0 : a[k].v); }, 0)) : null;
  const head = live ? '<div class="kv lu-kv"><div><div class="label">So far</div><div class="v num">' + objs.map((o, k) => f0(lt[k]) + '<small>/' + o.target + ' ' + esc(statShort(o.stat)) + '</small>').join('<br>') + '</div></div></div>' +
      '<div class="small muted">Put here the lineup you submitted on Top Shot, even players who already started. When you save, the app follows these players’ stats and redoes today’s win chance.</div>'
    : c ? '<div class="kv lu-kv"><div><div class="label">Made</div><div class="v num">' + c.objs.map((o, k) => f0(c.tot[k]) + '<small>/' + o.target + ' ' + esc(statShort(o.stat)) + '</small>').join('<br>') + '</div></div><div><div class="label">Result</div><div class="v num ' + (c.res === 'win' ? 'c-good' : 'c-bad') + '">' + (c.res === 'win' ? '✓ win' : '✕ loss') + '</div></div></div>'
    : '<div class="small muted">' + (E.ids.length ? 'Waiting for the box scores…' : 'Pick who played.') + '</div>';
  const inRows = E.ids.map(id => row(id, true)).join('') + Array.from({ length: Math.max(0, lim - E.ids.length) }, () => '<li class="lu-row lu-gap"><div class="gapb"><span class="gapb-go" style="cursor:default"><span class="gapb-ic">' + icoPlus + '</span><span class="gapb-t"><b>Empty spot</b><span>add someone from the list below</span></span></span></div></li>').join('');
  const cand = Object.keys(S.mine.roster || {}).filter(id => !E.ids.includes(id) && teams.has(pTeam(id))).sort((a, b) => weight(b) - weight(a) || nameOf(a).localeCompare(nameOf(b)));
  openSheet('<h3>' + (live ? 'Today’s lineup' : 'Lineup of day ' + dn) + '</h3><div class="small muted">' + dWeek(date) + ', ' + dShort(date) + ' · ' + esc(objsText(day)) + '</div><div id="pastLu" class="stack">' + head +
    '<div class="card"><div class="list-head"><h2>In the lineup</h2><span class="small muted">' + E.ids.length + ' of ' + lim + '</span></div><ul class="list">' + inRows + '</ul></div>' +
    '<button class="btn primary" type="button" data-action="' + (live ? 'live-lu-save' : 'past-lu-save') + '"' + (E.ids.length ? '' : ' disabled') + '>Save</button>' +
    (cand.length ? '<div class="card"><div class="list-head"><h2>Add to lineup</h2><span class="small muted">' + (live ? 'what they have so far' : 'what they did that day') + '</span></div>' +
      '<div class="lu-search"><input class="field" id="luSearch" type="search" placeholder="Search player or team…" autocomplete="off" aria-label="Search player" value="' + esc(E.q || '') + '"></div>' +
      '<ul class="list" id="luCand">' + cand.map((id, k) => row(id, false, k)).join('') + '<li class="row small muted lu-none" hidden>Nobody with that name plays on this day.</li></ul>' + (cand.length > 10 && !E.all ? '<button class="btn quiet" type="button" id="luAllBtn" data-action="past-lu-all" style="margin:4px 16px 14px">See all (' + cand.length + ')</button>' : '') + '</div>' : '') +
    (live ? '' : '<button class="btn link small" type="button" data-action="undo-result" data-date="' + date + '">I didn’t play this day</button>') + '</div>');
  luFilter();
  if (keep) $('sheetPanel').scrollTop = keep;
}
// hoje, com os jogos a decorrer: o lineup que levaste passa a ser o do ao vivo (a app não é o Top Shot: dá para pôr
// quem já começou a jogar, p. ex. se te esqueceste de atualizar a app); lê logo as estatísticas deles
async function liveLuSave() {
  const E = S.luEdit; if (!E || !E.ids.length) return;
  const date = E.date, plan = curPlan(), lv = (plan.live || {})[date] || {};
  const old = lv.lineup || [], outs = old.filter(id => !E.ids.includes(id)), ins = E.ids.filter(id => !old.includes(id));
  plan.live = Object.assign({}, plan.live, { [date]: Object.assign({}, lv, { active: true, lineup: E.ids.slice() }) });
  S.luEdit = null; closeSheet(); saveMine(); schedule();
  toast(outs.length || ins.length ? 'Today’s lineup fixed' + (outs.length ? ': out ' + outs.map(lastName).join(', ') : '') + (ins.length ? (outs.length ? ', in ' : ': in ') + ins.map(lastName).join(', ') : '') + '. The app follows these.' : 'Today’s lineup saved.');
  try { await liveFetch(true); schedule(); } catch (e) { /* sem rede: lê no próximo minuto */ }
}
function luEditSave() {
  const E = S.luEdit; if (!E || !E.ids.length) return;
  const date = E.date, day = S.days.find(d => d.date === date), cur = ((curPlan().played || {})[date]) || {}, old = cur.done ? (cur.lineup || []) : [];
  if (cur.done) {
    // usos de quem não tem Moments lidos (os da coleção contam-se sozinhos pelos dias jogados)
    old.filter(id => !E.ids.includes(id)).forEach(id => { const e = S.mine.roster[id]; if (e && !colTopUses(id)) setUsesOf(e, S.acc, usesEff(e, id, S.acc) + 1); });
    E.ids.filter(id => !old.includes(id)).forEach(id => { const e = S.mine.roster[id]; if (e && !colTopUses(id)) setUsesOf(e, S.acc, Math.max(0, usesEff(e, id, S.acc) - 1)); });
  }
  const c = day ? dayCalc(S.acc, day, E.ids) : null;
  // dia que ainda não estava fechado (ex.: começaste a usar o site a meio da run) e fecha agora: desconta os usos
  if (!cur.done && c) E.ids.forEach(id => { const e = S.mine.roster[id]; if (e && !colTopUses(id)) setUsesOf(e, S.acc, Math.max(0, usesEff(e, id, S.acc) - 1)); });
  const patch = { lineup: E.ids.slice(), edited: true, chain: false, noAuto: false };
  if (c) Object.assign(patch, { done: true, result: c.res, box: true, tot: c.tot, points: c.objs.length === 1 ? c.tot[0] : null });
  else if (cur.done) Object.assign(patch, { box: false, tot: null, points: null });
  planPatch({ played: { [date]: patch } });
  const dr = capOver(curPlan(), E.ids.filter(id => !old.includes(id)));
  if (dr.length) { schedule(); saveMine(); }
  S.luEdit = null; closeSheet();
  if (!c) setTimeout(() => { const B = S.box[date]; if (B) B.at = 0; boxTick(); }, 0);
  if (!c && dr.length) setTimeout(() => toast(capMsg(dr).trim()), 3500); // o aviso do resultado refeito vem por cima: repete este depois
  toast((c ? 'Lineup changed: ' + (c.res === 'win' ? 'win' : 'loss') + ' (' + madeTxt(c.objs, c.tot) + ').' : 'Lineup changed. The result is redone once the box scores are in.') + capMsg(dr));
}
function recordResult(date, res) {
  const cur = ((curPlan().played || {})[date]) || null;
  // dia já fechado: muda só o resultado (os usos já foram descontados)
  if (cur && cur.done) { planPatch({ played: { [date]: { result: res, chain: false, box: false, tot: null, points: null } } }); toast((res === 'win' ? 'Win' : 'Loss') + ' recorded.'); return; }
  const lineup = sheetLineup(date);
  if (!lineup.length) toast('No lineup saved for that day: set the uses by hand.');
  lineup.forEach(id => { const e = S.mine.roster[id]; if (e) setUsesOf(e, S.acc, Math.max(0, usesEff(e, id, S.acc) - 1)); });
  planPatch({ played: { [date]: { done: true, result: res, lineup, noAuto: false } } });
  toast((res === 'win' ? 'Win' : 'Loss') + ' recorded. Uses deducted and plan redone.');
}
// "Não joguei": o dia fica sem resultado (não conta) e não volta a fechar sozinho; repõe os usos se estava fechado
function undoResult(date) {
  const pl = ((curPlan().played || {})[date]) || {};
  if (pl.done) (pl.lineup || []).forEach(id => { const e = S.mine.roster[id]; if (e) setUsesOf(e, S.acc, usesEff(e, id, S.acc) + 1); });
  planPatch({ played: { [date]: { done: false, result: null, lineup: [], noAuto: true, box: false, chain: false, points: null, tot: null } } });
  toast(pl.done ? 'Day without a result. Uses restored.' : 'Day without a result.');
}
function liveSet(id, patch) { const nd = nextDay(); if (nd) planPatch({ live: { [nd.date]: { players: { [id]: patch } } } }); }
function swapDone() { const nd = nextDay(), d = view().days[0]; planPatch({ live: { [nd.date]: { lineup: d.lineup.slice() } } }); toast('Lineup updated.'); }
// ESPN: estatísticas de um jogo (summary) → {nomeNormalizado: {t: equipa, v: {pts, reb, ast, fg3, stl, blk, tov, oreb, dreb, fgm, fga, fg3a, ftm, fta}}}
function espnBox(json) {
  const out = {};
  for (const team of (((json || {}).boxscore || {}).players) || []) {
    const t = espnAbbr((team.team || {}).abbreviation);
    for (const st of team.statistics || []) {
      const keys = st.keys || [], labels = (st.labels || []).map(l => String(l).toUpperCase());
      const idx = (k, l) => { let i = keys.findIndex(x => x === k || String(x).startsWith(k)); if (i < 0) i = labels.indexOf(l); return i; };
      const fg = idx('fieldGoalsMade', 'FG'), tp = idx('threePointFieldGoalsMade', '3PT'), ft = idx('freeThrowsMade', 'FT');
      // [coluna, parte]: "8-15" → parte 0 = marcados, parte 1 = tentados
      const I = { pts: [idx('points', 'PTS'), 0], reb: [idx('rebounds', 'REB'), 0], ast: [idx('assists', 'AST'), 0], fg3: [tp, 0], stl: [idx('steals', 'STL'), 0], blk: [idx('blocks', 'BLK'), 0],
        tov: [idx('turnovers', 'TO'), 0], oreb: [idx('offensiveRebounds', 'OREB'), 0], dreb: [idx('defensiveRebounds', 'DREB'), 0], fgm: [fg, 0], fga: [fg, 1], fg3a: [tp, 1], ftm: [ft, 0], fta: [ft, 1] };
      for (const a of st.athletes || []) {
        if (a.didNotPlay || !(a.stats || []).length) continue;
        const v = {}; for (const [k, [i, part]] of Object.entries(I)) if (i >= 0) v[k] = parseFloat(String(a.stats[i] || '0').split('-')[part]) || 0;
        out[norm((a.athlete || {}).displayName)] = { t, v };
      }
    }
  }
  return out;
}
// estado do jogo no summary da ESPN: 'pre' | 'in' | 'post' (null se não vier)
function espnState(json) { const c = ((((json || {}).header || {}).competitions) || [])[0] || {}, t = (c.status || {}).type || {}; return t.state || (t.completed ? 'post' : null); }
const ESPN_SUMMARY = id => 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=' + id;
// linhas por equipa numa ficha de jogo (para saber se a ficha veio completa)
const boxCount = box => { const n = {}; Object.values(box).forEach(x => { n[x.t] = (n[x.t] || 0) + 1; }); return n; };
const pTeam = id => { const e = ((S.mine || {}).roster || {})[id] || {}, c = S.players.get(String(id)) || {}; return e.team || c.team || ''; };
const pAvg = id => { const e = ((S.mine || {}).roster || {})[id] || {}, c = S.players.get(String(id)) || {}; return e.avg || c.avg || null; };
// estatísticas de um jogador num jogo → valores guardados (as do jogo + o valor de cada objetivo do dia)
function liveVals(nd, raw, id) {
  const vals = Object.assign({}, raw), avg = (S.result.model.players[S.result.model.pIndex.get(id)] || {}).avg;
  (nd.objectives || []).forEach(o => { if (o && o.stat) vals[o.stat] = Math.round(FB.statValue(raw, o.stat, avg) * 10) / 10; });
  return vals;
}
// Vai buscar as estatísticas ao vivo dos jogadores do lineup submetido (ESPN; NBA para ids antigos)
async function liveFetch(quiet) {
  const nd = nextDay(); if (!nd) return;
  const sub = ((liveDoc(nd.date) || {}).lineup) || [];
  const gameIds = new Set(), gidOf = {};
  sub.forEach(id => { const team = (S.result.model.players[S.result.model.pIndex.get(id)] || {}).team; const g = FB.gameOf(nd, team); if (g && g[3]) { gameIds.add(g[3]); gidOf[id] = g[3]; } });
  if (!gameIds.size) { if (!quiet) toast('No game id in the schedule. Enter the values by hand.'); return; }
  const players = {}; let ok = 0;
  const byName = new Map(sub.map(id => [norm(nameOf(id)), id]));
  const espnIds = [...gameIds].filter(g => String(g).startsWith('espn:'));
  // estado dos jogos (por começar / a decorrer / terminado) e período, de uma vez para o dia todo
  const status = {};
  if (espnIds.length) {
    try {
      const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + nd.date.replace(/-/g, ''), { cache: 'no-store' });
      if (res.ok) ((await res.json()).events || []).forEach(ev => { const st = ev.status || ((ev.competitions || [])[0] || {}).status || {}; status['espn:' + ev.id] = { state: (st.type || {}).state, period: +st.period || 1 }; });
    } catch (e) { /* sem estado: assume a decorrer */ }
  }
  await Promise.all([...gameIds].map(async gid => {
    try {
      if (String(gid).startsWith('espn:')) {
        const stt = status[gid] || { state: 'in', period: 1 };
        if (stt.state === 'pre') return;
        const res = await fetch(ESPN_SUMMARY(String(gid).slice(5)), { cache: 'no-store' });
        if (!res.ok) return;
        const js = await res.json(), box = espnBox(js), fin = (espnState(js) || stt.state) === 'post'; ok++;
        Object.entries(box).forEach(([nm, x]) => {
          const id = byName.get(nm); if (!id) return;
          const vals = liveVals(nd, x.v, id);
          players[id] = fin ? { state: 'fim', vals } : { state: 'jogo', q: Math.min(4, Math.max(1, stt.period)), vals };
        });
        // jogo acabado e o jogador não aparece na ficha (a equipa dele aparece completa): não jogou, conta zero
        if (fin) { const n = boxCount(box); sub.forEach(id => { if (!players[id] && gidOf[id] === gid && (n[pTeam(id)] || 0) >= 5) players[id] = { state: 'fim', vals: liveVals(nd, {}, id), dnp: true }; }); }
        return;
      }
      const res = await fetch('https://cdn.nba.com/static/json/liveData/boxscore/boxscore_' + gid + '.json', { cache: 'no-store' });
      if (!res.ok) return;
      const js = await res.json(), g = js.game; if (!g || g.gameStatus < 2) return;
      ok++;
      [g.homeTeam, g.awayTeam].forEach(t => (t.players || []).forEach(pl => {
        const nm = norm(pl.name || [pl.firstName, pl.familyName].filter(Boolean).join(' '));
        const id = byName.get(nm) || (sub.includes(String(pl.personId)) ? String(pl.personId) : null); if (!id) return;
        const raw = {}; Object.entries(LIVE_STAT).forEach(([k, f]) => { const x = (pl.statistics || {})[f]; if (x != null && isFinite(+x)) raw[k] = +x; });
        const vals = liveVals(nd, raw, id);
        players[id] = g.gameStatus === 3 ? { state: 'fim', vals } : { state: 'jogo', q: Math.min(4, Math.max(1, +g.period || 1)), vals };
      }));
    } catch (e) { /* bloqueado ou sem rede */ }
  }));
  if (!ok) { if (!quiet) toast('No live stats yet. Try again shortly or enter the numbers by hand.'); return; }
  if (Object.keys(players).length) planPatch({ live: { [nd.date]: { players } } });
  S.liveAt = Date.now();
  if (!quiet) toast('Live stats updated.');
}

// ---------- fichas finais dos jogos (ESPN, do browser): o resultado de cada dia sem o registar à mão ----------
// S.box[data] = {at, busy, err, board: placar (espnBoard), lines: {nome: {t, v, st}}, gs: {equipa: {id, st}}, n: {equipa: linhas
// na ficha}, fin: {jogo: true}, done: {equipa: true}}. Só lê os jogos das equipas que faltam; um jogo acabado não se relê.
// estatísticas de um jogo (ficha da ESPN): as duas equipas, cada jogador com MIN, PTS, REB, AST, 3PT, STL, BLK, TO;
// os teus jogadores em destaque. Lê de novo a cada abertura (e com «Atualizar»)
async function gameBoxSheet(gid, pid, date) {
  const id = String(gid).replace(/^espn:/, '');
  openSheet('<h3>Game stats</h3><div id="gbProg" class="small muted">Reading the box score…</div>');
  let js = null; try { const res = await fetch(ESPN_SUMMARY(id), { cache: 'no-store' }); if (res.ok) js = await res.json(); } catch (e) {}
  if (!$('gbProg')) return;
  // vindo de um jogador do lineup: mantém-no no «Atualizar»
  const boxMore = pid ? ' data-id="' + esc(pid) + '" data-date="' + esc(date || '') + '"' : '';
  const boxHand = '';
  if (!js) { $('gbProg').outerHTML = '<div class="note">No answer from ESPN. Try again.</div><button class="btn" type="button" data-action="game-box" data-gid="' + esc(gid) + '"' + boxMore + '>Try again</button>' + boxHand; return; }
  const comp = (((js.header || {}).competitions) || [])[0] || {}, cs = comp.competitors || [], stt = ((comp.status || {}).type) || {};
  const tm = c => ({ t: espnAbbr(((c || {}).team || {}).abbreviation), sc: (c || {}).score });
  const away = tm(cs.find(c => c.homeAway === 'away')), home = tm(cs.find(c => c.homeAway === 'home'));
  const mine = new Map(Object.keys(S.mine.roster || {}).map(x => [norm(nameOf(x)), x])), v = view(), luIds = new Set(((v && v.days[0]) || {}).lineup || []);
  const COLS = [['MIN', 'MIN'], ['PTS', 'PTS'], ['REB', 'REB'], ['AST', 'AST'], ['3PT', '3PT'], ['STL', 'STL'], ['BLK', 'BLK'], ['TO', 'TO']];
  const teamTbl = team => {
    const st = ((team || {}).statistics || [])[0] || {}, labels = (st.labels || []).map(l => String(l).toUpperCase()), t = espnAbbr(((team || {}).team || {}).abbreviation);
    const ix = COLS.map(([l]) => labels.indexOf(l));
    const rows = (st.athletes || []).map(a => {
      const nm = (a.athlete || {}).displayName || '', pid = mine.get(norm(nm)), dnp = a.didNotPlay || !(a.stats || []).length;
      return '<tr class="' + (pid ? 'mine' : '') + (pid && luIds.has(pid) ? ' lu' : '') + (dnp ? ' dnp' : '') + '"><th class="sticky"><span class="cn">' + esc(((a.athlete || {}).shortName) || nm) + (a.starter ? '' : '') + '</span></th>' +
        (dnp ? '<td colspan="' + COLS.length + '" class="muted">' + esc(a.reason || 'did not play') + '</td>' : ix.map(i => '<td>' + (i >= 0 ? esc(a.stats[i]) : '–') + '</td>').join('')) + '</tr>';
    }).join('');
    return '<div class="card"><div class="list-head"><h2>' + teamLogo(t) + ' ' + esc(t) + '</h2></div><div class="cmp-wrap"><table class="cmp games gbox"><thead><tr><th class="sticky">Player</th>' + COLS.map(([, l]) => '<th>' + l + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  };
  const teams = ((js.boxscore || {}).players) || [];
  const order = [away.t, home.t].map(t => teams.find(x => espnAbbr(((x.team || {}).abbreviation)) === t)).filter(Boolean);
  $('gbProg').outerHTML = '<div class="gb-head"><span class="g-tm">' + teamLogo(away.t) + '<b>' + esc(away.t) + '</b><span class="g-sc num">' + esc(away.sc || '') + '</span></span><span class="muted">–</span><span class="g-tm">' + teamLogo(home.t) + '<b>' + esc(home.t) + '</b><span class="g-sc num">' + esc(home.sc || '') + '</span></span><span class="small muted">' + esc(stt.shortDetail || stt.detail || '') + '</span></div>' +
    (order.length ? order.map(teamTbl).join('') : '<div class="note info">ESPN doesn’t have this game’s box score yet.</div>') +
    '<div class="small muted">In bold: your players (shaded: in today’s lineup).</div><button class="btn" type="button" data-action="game-box" data-gid="' + esc(gid) + '"' + boxMore + '>Refresh</button>' + boxHand;
}
async function boxLoad(date, teams) {
  const day = S.days.find(d => d.date === date); if (!day) return null;
  const B = S.box[date] || (S.box[date] = { at: 0, board: null, lines: {}, gs: {}, n: {}, fin: {}, done: {} });
  if (B.busy) return B;
  B.busy = true;
  try {
    const st = {};
    try { B.board = await espnBoard(date); B.board.forEach(g => { st[g.id] = g.state; }); B.err = false; } catch (e) { B.err = true; }
    const ids = {};
    (day.games || []).forEach(g => { const gid = String(g[3] || ''); if (gid.startsWith('espn:') && (teams.has(g[0]) || teams.has(g[1]))) ids[gid.slice(5)] = [g[0], g[1]]; });
    await Promise.all(Object.keys(ids).filter(id => !B.fin[id] && st[id] !== 'pre').map(async id => {
      try {
        const res = await fetch(ESPN_SUMMARY(id), { cache: 'no-store' }); if (!res.ok) return;
        const js = await res.json(), box = espnBox(js), s = espnState(js) || st[id] || 'in', n = boxCount(box);
        Object.entries(box).forEach(([nm, x]) => { B.lines[nm] = { t: x.t, v: x.v, st: s }; });
        ids[id].forEach(t => { B.gs[t] = { id, st: s }; B.n[t] = n[t] || 0; });
        if (s === 'post') B.fin[id] = true;
      } catch (e) { /* bloqueado ou sem rede: tenta mais tarde */ }
    }));
    // equipas resolvidas: o jogo acabou e foi lido, ou não há jogo dela neste dia (não se volta a pedir)
    teams.forEach(t => { const id = Object.keys(ids).find(k => ids[k].includes(t)); if (!id || B.fin[id]) B.done[t] = true; });
  } finally { B.at = Date.now(); B.busy = false; }
  return B;
}
// valor de um jogador num dia pelas fichas: {v, fin} | null (o jogo dele acabou e ele não jogou) | undefined (não se sabe)
function boxFor(date, id) {
  const B = S.box[date]; if (!B) return undefined;
  const ln = B.lines[norm(nameOf(id))];
  if (ln) return { v: ln.v, fin: ln.st === 'post' };
  const t = pTeam(id), g = B.gs[t];
  return g && g.st === 'post' && (B.n[t] || 0) >= 5 ? null : undefined;
}
// valor real de um jogador num dia, por objetivo: do ao vivo (fim), das fichas da ESPN, do já guardado ou dos últimos
// jogos (tarefa das médias). null = não jogou; undefined = ainda não se sabe
function valsFor(acc, date, id, objs) {
  const pa = planOf(acc), e = (((((pa.live || {})[date]) || {}).players) || {})[id], avg = pAvg(id);
  const of = v => objs.map(o => rnd(FB.statValue(v, o.stat, avg)));
  if (e && e.state === 'fim' && e.vals && objs.every(o => e.vals[o.stat] != null)) return of(e.vals);
  const b = boxFor(date, id);
  if (b === null) return null;
  if (b && b.fin) return of(b.v);
  const sn = (pa.proj || {})[date], a = sn && sn.act ? sn.act[id] : undefined;
  if (a !== undefined && (sn.o || []).map(o => o.stat).join() === objs.map(o => o.stat).join()) return a;
  return actualFor(id, date, objs);
}
// o lineup que jogou num dia: o da blockchain, o do ao vivo (o submetido) ou o do plano guardado antes do 1.º jogo
// ---- lineups levados, lidos no Top Shot com os lugares (classificação de cada dia): [[id NBA, nome normalizado]] ----
const tsNorm = n => String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.'’`]/g, '').replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
let tsIdx = null;
function tsIdOf(nm) {
  if (!tsIdx || tsIdx.n !== S.players.size) {
    const byName = new Map(), byLast = new Map();
    S.players.forEach((p, id) => { const k = tsNorm(p.name); if (!k) return; byName.set(k, id); const w = k.split(' '); if (w.length > 1) { const kk = w.slice(1).join(' ') + '|' + w[0][0]; byLast.set(kk, byLast.has(kk) ? null : id); } });
    Object.keys(S.mine.roster || {}).forEach(id => { const k = tsNorm(nameOf(id)); if (k && !byName.has(k)) byName.set(k, id); });
    tsIdx = { n: S.players.size, byName, byLast };
  }
  const k = tsNorm(nm); if (!k) return null;
  let id = tsIdx.byName.get(k);
  if (!id) { const w = k.split(' '); id = w.length > 1 ? tsIdx.byLast.get(w.slice(1).join(' ') + '|' + w[0][0]) || null : null; }
  if (!id) return null;
  const roster = S.mine.roster || {}; if (roster[id]) return id;
  return Object.keys(roster).find(r => String(canon(r)) === String(canon(id))) || id;
}
// endereço Flow de uma conta (a principal ou uma smurf) de um membro
function accAddr(uid, acc) {
  const p = (S.group.profiles || []).find(x => x.user_id === uid) || (S.session && uid === S.session.user.id ? S.profile : null) || {};
  if (!acc || acc === 'main') return p.flow_address || null;
  const sm = (Array.isArray(p.smurfs) ? p.smurfs : []).find(x => x && x.id === acc); return (sm && sm.flow_address) || null;
}
// o lineup que uma conta levou num dia (ids do site), se foi lido e todos os nomes ligam; senão null
function tsLineup(addr, date) {
  if (!addr) return null;
  const R = groupRanks(), d = R && (R.days || []).find(x => x.date === date), a = d && (d.accs || {})[addrKey(addr)];
  if (!a || !Array.isArray(a.lu) || !a.lu.length || a.luh) return null;
  const ids = a.lu.map(z => tsIdOf(Array.isArray(z) ? z[1] : ''));
  return ids.every(Boolean) ? ids : null;
}
function lineupFor(acc, date) {
  const uid = S.session.user.id, roster = S.mine.roster || {};
  const ed = (planOf(acc).played || {})[date]; if (ed && ed.edited && (ed.lineup || []).length) return ed.lineup.slice(); // corrigido à mão
  const ts = tsLineup(accAddr(uid, acc), date); if (ts) return ts; // o que o Top Shot diz que levou

  const c = ((S.group || {}).chain || []).find(x => x.user_id === uid && x.date === date && (x.account || 'main') === acc && (x.lineup || []).length);
  if (c) { const byName = new Map(Object.keys(roster).map(id => [norm(nameOf(id)), id])), ids = c.lineup.map(n => byName.get(norm(n))).filter(Boolean); if (ids.length === c.lineup.length) return ids; }
  const pa = planOf(acc), lv = (pa.live || {})[date], sn = (pa.proj || {})[date];
  if (lv && (lv.lineup || []).length) return lv.lineup.slice();
  if (sn && (sn.lineup || []).length) return sn.lineup.slice();
  return null;
}
// resultado de um dia pelas estatísticas do lineup que jogou: {res, tot, ids, objs}, ou null enquanto não se sabe
function dayCalc(acc, day, ids0) {
  const objs = (day.objectives || []).filter(o => o && o.stat && +o.target > 0);
  if (!objs.length || objs.some(o => /pip/.test(o.stat))) return null; // pontos na área: só estimados, não fecham sozinhos
  const tip = firstTipOf(day); if (tip == null || Date.now() < tip) return null;
  const ids = ids0 || lineupFor(acc, day.date); if (!ids || !ids.length) return null;
  const vals = ids.map(id => valsFor(acc, day.date, id, objs));
  if (vals.some(v => v === undefined)) return null;
  const tot = objs.map((o, k) => rnd(vals.reduce((s, v) => s + (v ? +v[k] || 0 : 0), 0)));
  const win = objs.every((o, k) => (o.each ? vals.every(v => v && +v[k] >= +o.target) : tot[k] >= +o.target));
  return { res: win ? 'win' : 'loss', tot, ids, objs };
}
// total feito num dia fechado (um por objetivo), se se souber; ✓/✕ quando não se sabe
const doneTot = (pl, day) => { if (!pl || !pl.done) return null; const n = ((day || {}).objectives || []).filter(o => o && o.stat).length; return Array.isArray(pl.tot) && pl.tot.length ? pl.tot : pl.points != null && typeof pl.points !== 'object' && isFinite(+pl.points) && n === 1 ? [+pl.points] : null; };
const resMark = res => (res === 'win' ? '✓' : '✕');
// "98" ou "15 3PM · 28 3PA"
const madeTxt = (objs, tot) => objs.length === 1 ? f0(tot[0]) : objs.map((o, k) => f0(tot[k] || 0) + ' ' + statShort(o.stat)).join(' · ');
// Fecha sozinho os dias em que os jogos do lineup já acabaram (desconta os usos, como ao registar à mão). Um dia
// registado à mão com o mesmo resultado passa a "pelas estatísticas", com o total. A blockchain, se chegar, confirma.
function autoResults() {
  const run = curRun(); if (!run || run.fictitious || !S.mineLoaded || !S.session) return 0;
  const today = todayET(), nd = nextDay(), closed = []; let n = 0;
  accounts().forEach(a => {
    const pa = planOf(a.id);
    S.days.forEach((day, i) => {
      if (day.date > today) return;
      const cur = (pa.played || {})[day.date];
      if (cur && cur.done && cur.none) return; // não levou lineup no Top Shot: fica 0, sem total do lineup sugerido
      // fechado pelas estatísticas: se o lineup mudou depois (lido do Top Shot), o total é refeito com o lineup certo
      if (cur && cur.done && !cur.chain && (cur.lineup || []).length && (cur.box || cur.ts) && !(doneTot(cur, day) || []).length) {
        const c = dayCalc(a.id, day, cur.lineup); if (!c || c.res !== cur.result) return;
        Object.assign(cur, { box: true, tot: c.tot }, c.objs.length === 1 && cur.points == null ? { points: c.tot[0] } : {}); n++; return;
      }
      if (cur && cur.done && cur.box && !cur.chain && (cur.lineup || []).length) {
        const c = dayCalc(a.id, day, cur.lineup), t0 = doneTot(cur, day);
        if (c && t0 && c.tot.join() !== t0.join()) {
          if (c.res === cur.result) { cur.tot = c.tot; if (c.objs.length === 1) cur.points = c.tot[0]; }
          else { delete cur.tot; delete cur.points; } // o resultado veio do Top Shot e as fichas não batem: fica só ✓/✕
          n++;
        }
        return;
      }
      if (cur && (cur.chain || cur.box || (cur.noAuto && !cur.done))) return; // "não joguei" fica
      const c = dayCalc(a.id, day); if (!c) return;
      const extra = Object.assign({ box: true, tot: c.tot }, c.objs.length === 1 ? { points: c.tot[0] } : {});
      if (cur && cur.done) { if (cur.result === c.res || cur.edited) { if (cur.result !== c.res) closed.push({ a: a.id, i, c }); Object.assign(cur, extra, { result: c.res }); n++; } return; }
      c.ids.forEach(id => { const e = S.mine.roster[id]; if (e) setUsesOf(e, a.id, Math.max(0, usesEff(e, id, a.id) - 1)); });
      pa.played = Object.assign({}, pa.played, { [day.date]: Object.assign({ done: true, result: c.res, lineup: c.ids }, extra) });
      n++; closed.push({ a: a.id, i, c });
      if (a.id === S.acc && S.tab === 'hoje' && !S.hd && nd && nd.date === day.date) S.hd = day.date; // quem está a ver o dia continua nele
    });
  });
  if (closed.length === 1) { const { a, i, c } = closed[0]; toast((a !== 'main' ? accLabel(a) + ' · ' : '') + 'Day ' + (i + 1) + ': ' + (c.res === 'win' ? 'win' : 'loss') + ' (' + c.objs.map((o, k) => f0(c.tot[k]) + '/' + o.target + ' ' + statShort(o.stat)).join(', ') + ').'); }
  else if (closed.length) toast(closed.length + ' days closed from the box scores.');
  return n;
}
// dias com fichas por ler: lineup por fechar (ou registado à mão, para confirmar) e, nos últimos 3 dias, jogadores do
// plantel sem valor real (Análise). [[data, equipas]]
function boxDates() {
  const run = curRun(); if (!run || run.fictitious) return [];
  const today = todayET(), lim = new Date(Date.parse(today + 'T12:00:00Z') - 3 * 864e5).toISOString().slice(0, 10), now = Date.now(), nd = nextDay(), out = [];
  S.days.forEach(day => {
    if (day.date > today) return;
    const tip = firstTipOf(day); if (tip == null || now < tip + 100 * 60e3) return; // nenhum jogo acaba antes de 1 h 40
    const B = S.box[day.date] || { done: {} }, teams = new Set(), add = id => { const t = pTeam(id); if (t && !B.done[t]) teams.add(t); };
    const objs = (day.objectives || []).filter(o => o && o.stat && +o.target > 0), today0 = !!nd && nd.date === day.date;
    accounts().forEach(a => {
      const pa = planOf(a.id), cur = (pa.played || {})[day.date], sn = (pa.proj || {})[day.date];
      if (today0 && ((((pa.live || {})[day.date]) || {}).active)) return; // o ao vivo desta conta já lê este dia
      if (objs.length && !(cur && (cur.chain || cur.box || (cur.noAuto && !cur.done)))) (lineupFor(a.id, day.date) || []).forEach(id => { if (valsFor(a.id, day.date, id, objs) === undefined) add(id); });
      // fechado e com o lineup acertado depois (Top Shot): as fichas desse lineup para refazer o total
      if (objs.length && cur && cur.done && !cur.chain && (cur.box || cur.ts) && (day.date >= lim || !(doneTot(cur, day) || []).length)) (cur.lineup || []).forEach(id => { if (valsFor(a.id, day.date, id, objs) === undefined) add(id); });
      if (day.date >= lim && sn && sn.pl) Object.keys(sn.pl).forEach(id => { if ((sn.act || {})[id] === undefined) add(id); });
    });
    if (objs.length && day.date >= lim && S.tab === 'grupo') groupEntries().forEach(x => { const ids = !x.daysRes[day.date] && x.lu[day.date]; (ids || []).forEach(id => { if (boxFor(day.date, id) === undefined) add(id); }); });
    if (teams.size) out.push([day.date, teams]);
  });
  return out;
}
// a cada desenho e a cada minuto: fecha o que já se sabe e lê (2 dias de cada vez, no máximo de 4 em 4 min) o que falta
function boxTick() {
  if (!S.session || !S.mineLoaded || !S.runId || document.visibilityState === 'hidden') return;
  if (autoResults()) { saveMine(); schedule(); return; }
  boxDates().slice(0, 2).forEach(([date, teams]) => {
    const B = S.box[date];
    if (B && (B.busy || Date.now() - B.at < (B.err ? 120e3 : 240e3))) return;
    boxLoad(date, teams).then(() => { const a = fillActuals(), b = autoResults(); if (a || b) { saveMine(); schedule(); } else if (S.tab === 'hoje' || S.tab === 'run' || S.tab === 'grupo') render(); });
  });
}
async function adminWrite(promise, okMsg) { try { await q(promise); if (okMsg) toast(okMsg); return true; } catch (e) { toast(errText(e)); return false; } }
// muda a estatística k do dia i sem mexer nas outras (dias de combinação)
async function setObjective(i, stat, target, k) {
  const day = S.days[i]; if (!day) return;
  k = k || 0;
  const list = (day.objectives || []).filter(x => x && x.stat).map(x => Object.assign({}, x));
  const o = Object.assign({ stat: 'pts', target: 0 }, list[k]);
  if (stat != null) o.stat = stat; if (target != null) o.target = target;
  if (!(+o.target > 0)) return;
  list[k] = o; day.objectives = list.filter(x => x && +x.target > 0); schedule();
  await adminWrite(sb.from('run_days').update({ objectives: day.objectives }).eq('run_id', S.runId).eq('date', day.date));
}
async function setPrizes(prizes) {
  const run = curRun(); if (!run) return;
  run.prizes = prizes; schedule();
  await adminWrite(sb.from('runs').update({ prizes }).eq('id', run.id));
}
async function createRun(form) {
  const name = $('nrName').value.trim(), start = $('nrStart').value, n = Math.max(1, Math.min(31, parseInt($('nrDays').value, 10) || 0));
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !n) { toast('Fill in the name, the first day and the number of days.'); return; }
  const slug = (name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'run') + '-' + start.slice(2, 4) + start.slice(5, 7) + start.slice(8, 10);
  const dates = []; for (let i = 0; i < n; i++) { const d = new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10) + i)); dates.push(d.toISOString().slice(0, 10)); }
  const prev = curRun();
  const ok = await adminWrite(sb.from('runs').insert({ id: slug, name, start_date: dates[0], end_date: dates[n - 1], prizes: prev ? prev.prizes || [] : [], active: !S.runs.length }));
  if (!ok) return;
  await adminWrite(sb.from('run_days').insert(dates.map(date => ({ run_id: slug, date }))), 'Run created. Set the goals; the games come from the NBA schedule.');
  await loadShared(); await loadRun(slug);
  if (document.activeElement) document.activeElement.blur();
  renderAjustes();
}

// ---------- eventos ----------
let liveInputTimer = null;
document.addEventListener('submit', async e => {
  const f = e.target; e.preventDefault();
  if (f.id === 'authForm') submitAuth(f);
  if (f.id === 'joinForm') submitJoin(f);
  if (f.id === 'profForm') { try { await submitProfile($('pfName'), $('pfTs'), null); await enterApp(); } catch (err) { renderProfileSetup(errText(err)); } }
  if (f.id === 'pfForm') { try { await submitProfile($('pfName2'), $('pfTs2'), $('pfFlow2'), smurfsToSave()); S.smDraft = null; toast('Profile saved.'); if (document.activeElement) document.activeElement.blur(); schedule(); renderAjustes(); } catch (err) { toast(errText(err)); } }
  if (f.id === 'inviteForm') { const c = $('invCode').value.trim(); if (await adminWrite(sb.rpc('set_invite_code', { code: c }), 'Code changed.')) { S.invite = c; renderAjustes(); } }
  if (f.id === 'newRunForm') createRun(f);
});
// linhas de tabela que abrem fichas: Enter também abre
document.addEventListener('input', e => { if (e.target && e.target.id === 'buyMax') { const v = parseFloat(String(e.target.value).replace(',', '.')); S.buy.max = v > 0 ? v : null; } });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-action]')) e.target.click(); });
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action], [data-tab]');
  if (!b || b.disabled) return;
  if (b.matches('.tab')) { if (b.dataset.tab === 'hoje' && S.tab === 'hoje' && S.hd) { S.hd = null; S.hdCenter = true; } setTab(b.dataset.tab); return; }
  const a = b.dataset.action, id = b.dataset.id, date = b.dataset.date, nd = nextDay();
  switch (a) {
    case 'auth-mode': renderAuth(b.dataset.mode); break;
    case 'logout': if (mineTimer) { clearTimeout(mineTimer); await saveNow(); } else await mineSaving; clearTimeout(sumTimer); await sb.auth.signOut(); S.session = null; S.role = null; S.profile = null; S.invite = null; closeSheet(); renderAuth(); break;
    case 'goto': closeSheet(); if (b.dataset.sub) setSub(b.dataset.tab, b.dataset.sub); setTab(b.dataset.tab); break;
    case 'sub': setSub(b.dataset.stab, b.dataset.sub); if (document.activeElement) document.activeElement.blur(); render(); window.scrollTo(0, 0); break;
    case 'acc-run': S.acc = b.dataset.acc; if (S.multi && S.multi.byKey[S.acc]) S.result = S.multi.byKey[S.acc]; setSub('run', 'premios'); render(); window.scrollTo(0, 0); break;
    case 'close-sheet': closeSheet(); break;
    case 'sheet-back': { const fn = S.sheetBack; fn ? fn() : closeSheet(); break; }
    case 'player': playerSheet(id, date); break;
    case 'day': S.hd = date; S.hdCenter = true; closeSheet(); setSub('hoje', 'lineup'); setTab('hoje'); break;
    case 'help': helpSheet(b.dataset.k, b); break;
    case 'opcoes': await opcoesSheet(); break;
    case 'hold-hist': holdHistSheet(b.dataset.date); break;
    case 'h-day': S.hday = id; S.hdCenter = true; renderHoje(); break;
    case 'h-acc': S.hacc = +b.dataset.i || 0; renderHoje(); break;
    case 'pro-day': S.proDay = date; S.hdCenter = true; renderHoje(); break;
    case 'pro-card': proCardSheet(date, b.dataset.i); break;
    case 'h-fix': if (b.dataset.close) closeSheet(); hFix(b.dataset.day, id); break;
    case 'h-ban': if (b.dataset.close) closeSheet(); hBan(b.dataset.day, id); break;
    case 'h-reset': S.hsel[b.dataset.day] = { fix: [], ban: [] }; hSave(); renderHoje(); break;
    case 'h-card': hCardSheet(b.dataset.day, id); break;
    case 'h-disc': { const v = +b.dataset.v || 0; if (v) S.hdisc[id] = v; else delete S.hdisc[id]; hSave(); closeSheet(); renderHoje(); toast(v ? 'Card saved: costs ' + v + '%.' : 'No card.'); break; }
    case 'prio': S.mine.plan.prio = b.dataset.v; saveMine(); schedule(); renderAjustes(); toast('Priority saved: the plan was redone.'); break;
    case 'hold-undo': holdUndoSheet(b.dataset.acc, b.dataset.date, b.dataset.i); break;
    case 'hold-undo-ok': holdUndoOk(b.dataset.acc, b.dataset.date, b.dataset.i); break;
    case 'op-pick': opPick(id); break;
    case 'op-use': opUse(b.dataset.i); break;
    case 'hd': S.hd = date; S.hdCenter = true; renderHoje(); break;
    case 'pl-sheet': rosterSheet(id); break;
    case 'friend': friendSheet(id, b.dataset.acc); break;
    case 'copy-site': { const u = siteBase(); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('Address copied: paste it in Safari.'), () => toast(u)); break; }
    case 'job-odds': await jobOdds(); break;
    case 'ranks-go': { const what = String(b.dataset.do || 'ranks,picks').split(',');
      if (!b.dataset.ready && what.includes('ed')) { const lbl = b.innerHTML; b.disabled = true; b.textContent = 'Preparing…'; loadGroupCards().finally(() => { b.disabled = false; b.innerHTML = lbl; b.dataset.ready = '1'; b.click(); }); break; }
      delete b.dataset.ready; const J = rankJob(what); if (!J.accs.length) { toast('Nobody in the group has a Flow address in their profile.'); break; }
      // na app do ecrã principal o Top Shot abre numa janela à parte, sem a tua sessão e sem favoritos: tem de ser no Safari
      if (navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)) { openSheet('<h3>Open in Safari</h3><div class="small">In the home-screen app, Top Shot opens in a separate window, without your session and without your bookmarks. Open <b>' + esc(siteBase().replace(/^https?:\/\//, '')) + '</b> in <b>Safari</b> (sign in the first time) and tap <b>Update ranks</b> there.</div><div class="btns" style="margin-top:12px"><button class="btn primary" type="button" data-action="copy-site">Copy the address</button></div>'); break; } const e = b64u.enc(J); try { window.name = 'fbsync:' + e; } catch (er) {}
      // no telemóvel, um toque num endereço do Top Shot abre a app deles (sem o leitor). Mudar de página já fora do
      // toque (passado mais de 1 s) faz o Safari/Chrome abrir o site no próprio browser.
      b.disabled = true; toast('Opening Top Shot in the browser…'); setTimeout(() => { location.href = 'https://nbatopshot.com/fastbreak#fbsync=' + e; }, 1300); setTimeout(() => { b.disabled = false; }, 4000); break; }
    case 'lock': choiceSheet(id, date, 'lock'); break;
    case 'lock-yes': lockToggle(id, date, true); luBack(date); break;
    case 'unlock': lockToggle(id, date, false); luBack(date); break;
    case 'ban': choiceSheet(id, date, 'ban'); break;
    case 'ban-yes': banToggle(id, date, true); luBack(date); break;
    case 'unban': banToggle(id, date, false); luBack(date); break;
    // Mudar o lineup (folha com o que muda face à sugestão do plano)
    case 'lu-edit': S.lu = null; lineupSheet(date); break;
    case 'lu-lockall': luBusy(); lockAll(date, b.dataset.on === '1'); break;
    case 'odds-keep': oddsKeep(+b.dataset.i, b.dataset.k); break;
    case 'odds-see': closeSheet(); S.hd = date; setSub('hoje', 'lineup'); setTab('hoje'); render(); break;
    case 'lu-lock': { const on = !(((curPlan().locks || {})[date]) || []).includes(id); luBusy(); if (!lockToggle(id, date, on)) luRender(); break; }
    case 'lu-add': luBusy(true); if (!lockToggle(id, date, true)) luRender(); break;
    case 'lu-ban': if (S.lu) { S.lu.out = (S.lu.out || []).concat([id]); luRender(); } break; // fica um lugar livre: nada muda até escolheres
    case 'lu-undo': if (S.lu) { S.lu.out = (S.lu.out || []).filter(x => x !== id); if (b.dataset.back) lineupSheet(date); else luRender(); } break;
    case 'lu-pick': luPickSheet(date, id); break;
    case 'lu-fill': luFill(date, b.dataset.out, id); break;
    case 'lu-auto': if (S.lu) S.lu.out = (S.lu.out || []).filter(x => x !== id); lineupSheet(date); luBusy(); banToggle(id, date, true); break;
    case 'lu-unban': luBusy(); banToggle(id, date, false); toast(lastName(id) + ' is back: the plan can use him this day.'); break;
    case 'lu-excl': luBusy(); banToggle(id, date, true); break;
    case 'lu-reset': luBusy(true); { const h = planOf(S.acc).hold; if (h && h.d === date) planOf(S.acc).hold = null; } /* volta a sugestão inteira, sem o lineup mantido */ planPatch({ locks: { [date]: [] }, bans: { [date]: [] } }); toast('Back to the plan’s suggestion.'); break;
    case 'ptab': { S.pTab = b.dataset.v; document.querySelectorAll('#sheetPanel .ptab').forEach(x => { x.hidden = x.dataset.ptab !== S.pTab; }); document.querySelectorAll('#sheetPanel .ptabs button').forEach(x => { const on = x.dataset.v === S.pTab; x.setAttribute('aria-selected', on); x.setAttribute('aria-pressed', on); }); break; }
    case 'buy-more': buyMore(); break;
    case 'keep-clear': planPatch({ keep: { [b.dataset.date]: null } }, true); toast('The plan picks this day again.'); break;
    case 'locks-fix': { const r = S.result, L = {}; ((r && r.model.droppedLocks) || []).forEach(x => { L[x.date] = (L[x.date] || (curPlan().locks || {})[x.date] || []).filter(id => id !== x.player); }); if (Object.keys(L).length) { planPatch({ locks: L }); toast('Extra locks removed. Plan redone.'); } break; }
    case 'todo-tick': { const k = b.dataset.k; if (TODO_DONE[k]) delete TODO_DONE[k]; else { TODO_DONE[k] = Date.now(); toast('Done ✓'); } todoSave(); if (/\|tr\|/.test(k)) schedule(); else render(); break; } // Moment mandado: o plano conta já com ele na outra conta
    case 'todo-show': S.todoShow = !S.todoShow; render(); break;
    case 'fold': { const k = b.dataset.k; S.fold[k] = !S.fold[k]; try { localStorage.setItem('fb-fold', JSON.stringify(S.fold)); } catch (e) {} render(); break; }
    case 'lu-all': if (S.lu) { S.lu.all = true; luRender(); } break;
    case 'lu-view': S.luView = b.dataset.v === 'pessoa' ? 'pessoa' : null; try { localStorage.setItem('fb-luview', S.luView || ''); } catch (e) {} render(); break;
    case 'lu-sort': S.luSort = +b.dataset.k < 0 ? null : +b.dataset.k; if (b.dataset.out) luPickSheet(date, b.dataset.out); else if (S.lu) luRender(); break;
    case 'lu-player': playerSheet(id, date, () => lineupSheet(date)); break;
    case 'set-status': setStatus(id, b.dataset.status); rosterSheet(id); break;
    case 'uses': changeUses(id, +b.dataset.d, b.dataset.acc); break;
    case 'acc': S.acc = b.dataset.acc; if (S.multi && S.multi.byKey[S.acc]) S.result = S.multi.byKey[S.acc]; render(); break;
    case 'remove-player': delete S.mine.roster[id]; closeSheet(); schedule(); saveMine(); toast('Removed from the roster.'); break;
    case 'result-sheet': {
      const day = S.days.find(x => x.date === date), pl = ((curPlan().played || {})[date]) || {}, done = !!pl.done;
      const lineup = done && (pl.lineup || []).length ? pl.lineup : sheetLineup(date);
      openSheet('<h3>' + (done ? 'Change the result of day ' : 'Close day ') + (S.days.indexOf(day) + 1) + '</h3><div class="small muted">' +
        (done ? 'Uses stay as they are.' : lineup.length ? 'These players’ uses are deducted.' : 'No saved lineup: afterwards, adjust the uses of whoever played.') + ' Usually not needed: when the lineup’s games end, the day closes by itself with the stats.</div>' +
        (lineup.length ? '<ul class="list card">' + lineup.map(x => '<li class="row"><span>' + esc(nameOf(x)) + '</span></li>').join('') + '</ul>' : '') + '<div class="btns"><button class="btn" type="button" data-action="result" data-date="' + date + '" data-res="loss">I lost</button><button class="btn primary" type="button" data-action="result" data-date="' + date + '" data-res="win">I won</button></div>' +
        '<button class="btn" type="button" data-action="past-lu" data-date="' + date + '">Change the players</button>' +
        '<button class="btn link small" type="button" data-action="undo-result" data-date="' + date + '">I didn’t play this day</button>');
      break;
    }
    case 'result': recordResult(date, b.dataset.res); closeSheet(); break;
    case 'past-lu': S.luEdit = { date, ids: sheetLineup(date) }; luEditSheet(); break;
    case 'past-lu-pick': { const E = S.luEdit; if (!E) break; const lim = (S.days.find(d => d.date === E.date) || {}).numPlayers || 5; if (E.ids.includes(id)) E.ids = E.ids.filter(x => x !== id); else if (E.ids.length < lim) E.ids.push(id); else { toast('You already have ' + lim + ' players: remove one first.'); break; } luEditSheet(); break; }
    case 'past-lu-save': luEditSave(); break;
    case 'live-lu': S.luEdit = { date, ids: (((curPlan().live || {})[date] || {}).lineup || sheetLineup(date)).slice(), live: true }; luEditSheet(); break;
    case 'live-lu-save': await liveLuSave(); break;
    case 'past-lu-all': if (S.luEdit) { S.luEdit.all = true; luEditSheet(); } break;
    case 'undo-result': undoResult(date); closeSheet(); break;
    case 'swap-done': swapDone(); break;
    case 'live-state': liveSet(id, { state: b.dataset.state }); playerSheet(id, nd.date, S.sheetBack); break;
    case 'live-q': liveSet(id, { q: +b.dataset.q }); playerSheet(id, nd.date, S.sheetBack); break;
    case 'live-val': {
      const k = +b.dataset.k || 0, inp = $('liveVal-' + k), stat = (((nd.objectives || []).filter(x => x && x.stat && +x.target > 0))[k] || {}).stat || 'pts';
      let nv = Math.round(((parseFloat(inp.value) || 0) + (+b.dataset.d)) * 10) / 10; if (!/-/.test(stat)) nv = Math.max(0, nv); inp.value = nv;
      clearTimeout(liveInputTimer); liveInputTimer = setTimeout(() => liveSet(id, { vals: { [stat]: nv } }), 400); break;
    }
    case 'add-player': addPlayerSheet(); break;
    case 'add-id': addToRoster(id, 1); toast(nameOf(id) + ' added with 1 use.'); renderSearch(($('apSearch') || {}).value || ''); break;
    case 'custom-player': customPlayerSheet(); break;
    case 'save-custom': {
      const name = ($('cpName').value || '').trim(); if (!name) { toast('Write the name.'); return; }
      const cid = 'x-' + (name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now());
      addToRoster(cid, Math.max(0, parseInt($('cpUses').value, 10) || 0), { name, team: $('cpTeam').value }); closeSheet(); toast(name + ' added.'); break;
    }
    case 'paste-sheet': pasteSheet(); break;
    case 'wallet-sheet': await walletSheet(); break;
    case 'ed-review': edReviewSheet(); break;
    case 'run-review': runReviewSheet(); break;
    case 'sell-player': sellPlayerSheet(id); break;
    case 'sell-swap': sellSwapSheet(+b.dataset.i); break;
    case 'sell-down': sellSwapSheet(+b.dataset.i, true); break;
    case 'sell-tab': S.sellTab = b.dataset.v; try { localStorage.setItem('fb-sell-tab', S.sellTab); } catch (e) {} render(); sellFilter(); break;
    case 'day-lus': dayLineupsSheet(date); break;
    case 'run-apply': b.disabled = true; await runApply(+b.dataset.i); break;
    case 'ed-apply': closeSheet(); edApply(); toast('Rarity and ASP applied: the group’s uses were adjusted.'); break;
    case 'wallet-apply': b.disabled = true; await walletApply(); break;
    case 'col-to-roster': collectionToRoster(); break;
    case 'col-sheet': closeSheet(); setSub('plantel', 'colecao'); setTab('plantel'); break;
    case 'pl-view': setPlView({ mode: b.dataset.v }); break;
    case 'pl-sort': setPlView({ sort: b.dataset.v }); break;
    case 'pl-filter': setPlView({ filter: b.dataset.v }); break;
    case 'cmp-obj':
    case 'cmp-sort': {
      if (a === 'cmp-obj') S.cmpObj = +b.dataset.k || 0;
      else { const c = b.dataset.col, cur = S.cmpSort || {}; S.cmpSort = { col: c, dir: cur.col === c ? -cur.dir : -1 }; }
      const left = ($('cmpWrap') || {}).scrollLeft || 0;
      { const y = window.scrollY; renderHoje(); window.scrollTo(0, y); }
      if ($('cmpWrap')) $('cmpWrap').scrollLeft = left;
      break;
    }
    case 'inj-ignore': {
      const e = S.mine.roster[id]; if (!e) break;
      if (b.dataset.on === '1') e.injIgnore = true; else delete e.injIgnore;
      saveMine(); recalcNow();
      if (date && dayInfo(date).md) playerSheet(id, date, S.sheetBack); else rosterSheet(id);
      toast(e.injIgnore ? 'The plan ignores the injury report for ' + lastName(id) + '.' : 'The plan uses the report again for ' + lastName(id) + '.');
      break;
    }
    case 'alerts-email': if (await saveAlerts({ email: !(S.alerts || {}).email })) { renderAjustes(); toast((S.alerts || {}).email ? 'Email alerts on.' : 'Email alerts off.'); } break;
    case 'alerts-ntfy-on': if (await saveAlerts({ ntfy: newTopic() })) { renderAjustes(); toast('Now subscribe to the topic in the ntfy app.'); } break;
    case 'alerts-ntfy-off': if (await saveAlerts({ ntfy: null })) { renderAjustes(); toast('Phone notifications off.'); } break;
    case 'alerts-test': b.disabled = true; await testNtfy(); b.disabled = false; break;
    case 'copy-topic': try { await navigator.clipboard.writeText((S.alerts || {}).ntfy || ''); toast('Topic copied.'); } catch (err) { toast('Couldn\'t copy: select the text.'); } break;
    case 'buy-sheet': closeSheet(); setSub('plantel', 'comprar'); setTab('plantel'); break;
    case 'buy-retry': S.autoBuyErr = null; S.autoBuy = null; autoBuyBusy = null; render(); scheduleAutoBuy(); break;
    case 'better-use': useBetter(); break;
    case 'lu-share': shareLineup(date); break;
    case 'game-box': e.preventDefault(); gameBoxSheet(b.dataset.gid, b.dataset.id, b.dataset.date); break;
    case 'share-go': shareGo(); break;
    case 'better-no': S.better = null; render(); break;
    case 'buy-detail': buyDetailSheet(b.dataset.src, id); break;
    case 'buy-player': S.mine.roster[id] ? rosterSheet(id) : catalogSheet(id); break;
    case 'buy-open': if (S.autoBuy) { S.buy.uses = S.autoBuy.U; S.buy.mode = 'new'; S.buy.results = S.autoBuy; } closeSheet(); setSub('plantel', 'comprar'); setTab('plantel'); break;
    case 'buy-eval': closeSheet(); setSub('plantel', 'comprar'); setTab('plantel'); await buyRun(id); break;
    case 'buy-mode': S.buy.mode = b.dataset.mode; S.buy.results = null; renderPlantel(); break;
    case 'buy-uses': S.buy.uses = +b.dataset.n; S.buy.results = null; renderPlantel(); break;
    case 'pform': S.mine.roster[id] ? rosterSheet(id) : catalogSheet(id); break;
    case 'forma-day': S.forma.day = b.dataset.v; renderPlantel(); break;
    case 'borrow-run': b.disabled = true; await borrowRun(); break;
    case 'share-plan': {
      const v = b.dataset.v === '1';
      try { await q(sb.from('profiles').update({ share_plan: v }).eq('user_id', S.session.user.id)); S.profile.share_plan = v; S.lastSummary = ''; publishSummary(); renderAjustes(); toast(v ? 'The group sees your plan.' : 'You stopped sharing your plan.'); }
      catch (err) { toast(/share_plan/.test(String(err && err.message)) ? 'The new supabase/schema.sql still has to be run in Supabase.' : errText(err)); }
      break;
    }
    case 'spec-stat': S.spec.stat = b.dataset.v; renderPlantel(); break;
    case 'theme': applyTheme(b.dataset.v); renderAjustes(); break;
    case 'lang': if (b.dataset.v !== LANG) setLang(b.dataset.v); break;
    case 'col-sort': S.colView.sort = b.dataset.v; renderPlantel(); break;
    case 'col-tier': S.colView.tier = b.dataset.v; renderPlantel(); break;
    case 'run-go': S.loading = true; render(); await loadRun(id); S.loading = false; compute(); render(); break;
    case 'spec-scope': S.spec.scope = b.dataset.v; renderPlantel(); break;
    case 'buy-run': b.disabled = true; await buyRun(null); if (b.isConnected) b.disabled = false; break;
    case 'buy-pick': await buyRun(id); break;
    case 'b2b': b2bOn = b.dataset.v === '1'; try { localStorage.setItem('fb-b2b', b2bOn ? '1' : '0'); } catch (e) {} schedule(); renderAjustes(); toast(b2bOn ? 'Back-to-backs: the plan adjusts.' : 'Back-to-backs: no adjustment.'); break;
    case 'form-level': formLevel = b.dataset.level; try { localStorage.setItem('fb-form', formLevel); } catch (e) {} FB.setForm(+formLevel); schedule(); renderAjustes(); toast('Weight of form: ' + FORM_LEVELS.find(x => x[0] === formLevel)[1] + '.'); break;
    case 'sm-add': smurfReadInputs(); S.smDraft.push({}); renderAjustes(); break;
    case 'sm-del': smurfReadInputs(); S.smDraft.splice(+b.dataset.i, 1); renderAjustes(); break;
    case 'del-tests': b.disabled = true; await deleteTestRuns(); break;
    case 'chain-import': b.disabled = true; await chainImport(id); break;
    case 'del-run': await deleteRun(curRun()); break;
    case 'paste-preview': {
      const items = parseList($('pasteText').value); S.pasteItems = items;
      const okN = items.filter(x => x.match).length;
      $('pasteOut').innerHTML = items.length ? '<ul class="ops">' + items.map(x => '<li>' + (x.match ? esc(x.match.name) + ' <span class="muted">(' + esc(x.match.team || '—') + ')</span> · ' + x.uses + ' use' + (x.uses > 1 ? 's' : '') : '<span class="down">Didn\'t find “' + esc(x.name) + '”</span>') + '</li>').join('') + '</ul>' +
        (okN ? '<button class="btn primary" type="button" data-action="paste-apply" style="width:100%;margin-top:8px">Add ' + okN + ' player' + (okN > 1 ? 's' : '') + '</button>' : '') : '<div class="small muted">Write at least one player.</div>';
      break;
    }
    case 'paste-apply': { const items = (S.pasteItems || []).filter(x => x.match); items.forEach(x => { S.mine.roster[x.match.id] = Object.assign({ status: 'ok' }, S.mine.roster[x.match.id] || {}, { uses: x.uses }); }); closeSheet(); applyChainResults(); schedule(); saveMine(); toast(items.length + ' players in the roster.'); break; }
    case 'copy-roster': {
      const others = S.runs.filter(x => x.id !== S.runId);
      openSheet('<h3>Copy roster</h3><div class="small muted">Copies the players from another run. Uses go back to 1; set them afterwards.</div><div class="stack">' + others.map(x => '<button class="btn" type="button" data-action="copy-from" data-id="' + esc(x.id) + '">' + esc(x.name) + '</button>').join('') + '</div>');
      break;
    }
    case 'copy-from': {
      try {
        const row = await q(sb.from('user_runs').select('roster').eq('run_id', id).eq('user_id', S.session.user.id).maybeSingle());
        const ro = (row && row.roster) || {}; const n = Object.keys(ro).length;
        if (!n) { toast('That run has no roster of yours.'); return; }
        Object.entries(ro).forEach(([pid, e]) => { S.mine.roster[pid] = Object.assign({}, e, { uses: 1, status: 'ok' }); });
        closeSheet(); schedule(); saveMine(); toast(n + ' players copied. Set the uses.');
      } catch (err) { toast(errText(err)); }
      break;
    }
    case 'group-refresh': b.disabled = true; try { await loadGroup(); applyChainResults(); schedule(); toast('Group updated.'); } catch (err) { toast(errText(err)); } b.disabled = false; break;
    case 'kick': {
      const p = S.group.profiles.find(x => x.user_id === id) || {};
      openSheet('<h3>Remove ' + esc(p.display_name || 'member') + '?</h3><div class="small muted">They stop seeing the group. Their data stays saved and they come back in if they use the invite code.</div><div class="btns"><button class="btn quiet" type="button" data-action="close-sheet">Cancel</button><button class="btn primary" type="button" data-action="kick-yes" data-id="' + esc(id) + '">Remove</button></div>');
      break;
    }
    case 'kick-yes': closeSheet(); if (await adminWrite(sb.from('members').delete().eq('user_id', id), 'Member removed.')) { await loadGroup(); renderAjustes(); } break;
    case 'set-active': {
      if (!(await adminWrite(sb.from('runs').update({ active: false }).neq('id', S.runId)))) return;
      if (await adminWrite(sb.from('runs').update({ active: true }).eq('id', S.runId), 'Run active for everyone.')) { S.runs.forEach(r => { r.active = r.id === S.runId; }); renderAjustes(); }
      break;
    }
    case 'obj-add': { const day = S.days[+b.dataset.i]; if (!day) break; day.objectives = (day.objectives || []).concat([{ stat: 'reb', target: '' }]); renderAjustes(); toast('Choose the stat and the target: it saves when you set the target.'); break; }
    case 'obj-del': {
      const i = +b.dataset.i, day = S.days[i]; if (!day) break;
      day.objectives = (day.objectives || []).filter(x => x && x.stat).filter((x, k) => k !== +b.dataset.k); schedule();
      await adminWrite(sb.from('run_days').update({ objectives: day.objectives.filter(x => +x.target > 0) }).eq('run_id', S.runId).eq('date', day.date), 'Stat removed from day ' + (i + 1) + '.'); renderAjustes(); break;
    }
    case 'pz-add': { const run = curRun(); const pz = clone(run.prizes || []); const last = pz.length ? pz[pz.length - 1].wins : 3; pz.push({ wins: Math.min(31, last + 2), value: 1 }); await setPrizes(pz); renderAjustes(); break; }
    case 'pz-del': { const run = curRun(); const pz = clone(run.prizes || []); pz.splice(+b.dataset.i, 1); await setPrizes(pz); renderAjustes(); break; }
  }
});
document.addEventListener('change', async e => {
  const t = e.target, a = t.dataset.action;
  if (t.dataset && t.dataset.moTier) { await momentTierChange(t.dataset.moTier, t.value); return; }
  if (t.id === 'jmode') { S.jmode = t.value; try { localStorage.setItem('fb-jmode', t.value); } catch (e2) {} t.blur(); S.hdCenter = true; renderHeader(); renderHoje(); return; }
  if (t.id === 'runPick') { S.loading = true; render(); await loadRun(t.value); S.loading = false; t.blur(); compute(); render(); renderAjustes(); return; }
  if (t.id === 'chainPick') { const run = curRun(); if (await adminWrite(sb.from('runs').update({ chain_run_id: t.value || null }).eq('id', run.id), t.value ? 'Run linked to the blockchain.' : 'Link removed.')) { run.chain_run_id = t.value || null; await loadGroup(); schedule(); } return; }
  if (a === 'obj-stat') setObjective(+t.dataset.i, t.value, null, +t.dataset.k || 0);
  if (a === 'obj-target') { const n = parseInt(t.value, 10); if (n > 0) setObjective(+t.dataset.i, null, n, +t.dataset.k || 0); }
  if (a === 'pz-w' || a === 'pz-v') {
    const run = curRun(), pz = clone(run.prizes || []), i = +t.dataset.i; if (!pz[i]) return;
    const n = parseFloat(t.value); if (!(n >= 0)) return;
    if (a === 'pz-w') pz[i].wins = Math.max(1, Math.round(n)); else pz[i].value = n;
    setPrizes(pz);
  }
  if (a === 'live-input') { const nd = nextDay(), stat = (((nd.objectives || []).filter(x => x && x.stat && +x.target > 0))[+t.dataset.k || 0] || {}).stat || 'pts'; const x = parseFloat(t.value) || 0; liveSet(t.dataset.id, { vals: { [stat]: /-/.test(stat) ? x : Math.max(0, x) } }); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'rosterFilter') { S.filter = e.target.value; renderPlantel(); }
  if (e.target.id === 'apSearch') renderSearch(e.target.value);
  if (e.target.id === 'buySearch') renderBuySearch(e.target.value);
  if (e.target.id === 'colSearch') { S.colView.q = e.target.value; renderColList(); }
  if (e.target.id === 'sellSearch') { S.sellQ = e.target.value; sellFilter(); }
  if (e.target.id === 'hSearch') { S.hq = e.target.value; hFilter(); }
  if (e.target.id === 'injSearch') { S.injQ = e.target.value; injFilter(); }
  if (e.target.id === 'luSearch') { if (S.lu && $('luCount')) S.lu.q = e.target.value; if (S.luEdit && $('pastLu')) S.luEdit.q = e.target.value; luFilter(); }
});
// (sem redesenhar Ajustes ao sair de um campo: isso apagava o formulário a meio de um clique em Guardar)
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });
// Ao voltar à app, relê o plano (pode ter sido mudado noutro dispositivo) e o grupo
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !S.runId || !S.session) return;
  try {
    await mineRefresh();
    await Promise.all([loadGroup(), loadInjuries()]); applyChainResults(); schedule();
    refreshOdds();
  } catch (err) { /* sem rede: fica como está */ }
});
function setTabUI() { TABS.forEach(t => { $('tab-' + t).hidden = t !== S.tab; $('t-' + t).setAttribute('aria-selected', String(t === S.tab)); }); const me = $('meBtn'); if (me) { if (S.tab === 'ajustes') me.setAttribute('aria-current', 'page'); else me.removeAttribute('aria-current'); } }
function setTab(tab) {
  S.tab = tab; setTabUI();
  try { localStorage.setItem('fb-tab3', tab); } catch (e) {}
  render(); window.scrollTo(0, 0);
}
// ---------- gestos ----------
// Jornada: deslizar para a esquerda/direita muda de dia (setas do teclado também). Não conta quando o dedo começa na
// faixa dos dias, em tabelas ou chips que rolam de lado, ou em campos.
function jornadaGo(step) {
  if (S.tab !== 'hoje' || !S.result) return false;
  const J = jornadaDay(); if (!J) return false;
  const i = S.days.findIndex(x => x.date === J.date), nx = S.days[i + step]; if (!nx) return false;
  const nd = nextDay(); S.hd = nd && nd.date === nx.date ? null : nx.date; S.hdCenter = true;
  renderHoje(); window.scrollTo(0, 0); return true;
}
let swipe = null;
document.addEventListener('touchstart', e => {
  swipe = null;
  if (S.tab !== 'hoje' || e.touches.length !== 1 || !$('sheet').hidden) return;
  const t = e.target; if (!t.closest || !t.closest('#tab-hoje') || t.closest('.day-strip, .chips, .subtabs, table, .cmp-wrap, .mx-wrap, input, select, textarea')) return;
  swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
document.addEventListener('touchend', e => {
  const sw = swipe; swipe = null; if (!sw || !e.changedTouches.length) return;
  const dx = e.changedTouches[0].clientX - sw.x, dy = e.changedTouches[0].clientY - sw.y;
  if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - sw.t < 700) jornadaGo(dx < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener('keydown', e => {
  if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || !$('sheet').hidden) return;
  const ae = document.activeElement; if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return;
  if (jornadaGo(e.key === 'ArrowRight' ? 1 : -1)) e.preventDefault();
});
// Folhas: puxar para baixo (com a folha no topo) fecha-a; se largar antes do fim, volta ao sítio
let sdrag = null;
(function sheetDrag() {
  const P = $('sheetPanel'); if (!P) return;
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  P.addEventListener('touchstart', e => {
    sdrag = null;
    if (e.touches.length !== 1 || P.scrollTop > 0 || (e.target.closest && e.target.closest('input, select, textarea, table, .chips, .cmp-wrap, .mx-wrap'))) return;
    sdrag = { y: e.touches[0].clientY, x: e.touches[0].clientX, t: Date.now(), dy: 0, on: false };
  }, { passive: true });
  P.addEventListener('touchmove', e => {
    if (!sdrag) return;
    const dy = e.touches[0].clientY - sdrag.y, dx = e.touches[0].clientX - sdrag.x;
    if (!sdrag.on) { if (dy > 10 && dy > Math.abs(dx) && P.scrollTop <= 0) sdrag.on = true; else if (dy < -5 || Math.abs(dx) > 10) { sdrag = null; return; } else return; }
    sdrag.dy = Math.max(0, dy); e.preventDefault();
    P.style.transition = 'none'; P.style.transform = 'translateY(' + sdrag.dy + 'px)';
  }, { passive: false });
  P.addEventListener('touchend', () => {
    const d = sdrag; sdrag = null; if (!d || !d.on) return;
    const fast = d.dy / Math.max(1, Date.now() - d.t) > 0.6;
    if (d.dy > Math.min(140, P.offsetHeight * 0.3) || (fast && d.dy > 40)) {
      P.style.transition = reduce() ? 'none' : 'transform .16s ease-in'; P.style.transform = 'translateY(100%)';
      setTimeout(() => { P.style.transition = ''; P.style.transform = ''; closeSheet(); }, reduce() ? 0 : 160);
    } else { P.style.transition = reduce() ? 'none' : 'transform .18s ease-out'; P.style.transform = ''; setTimeout(() => { P.style.transition = ''; }, 200); }
  });
})();
// a cada minuto: quando o 1.º jogo começa passa sozinho a ao vivo; o relógio decide que jogos já começaram, as
// estatísticas ao vivo atualizam de 2 em 2 minutos e o placar dos jogos de hoje enquanto há jogos
setInterval(() => {
  if (!S.session || document.visibilityState !== 'visible') return;
  boxTick(); // fichas finais: fecham os dias que acabaram
  const nd = nextDay(); if (!nd) return;
  if (!liveOn(nd.date)) ensureLive();
  if (liveOn(nd.date)) { schedule(); if (Date.now() - (S.liveAt || 0) > 115e3) { S.liveAt = Date.now(); liveFetch(true); } }
  if (S.tab === 'hoje' && gamesWindow(nd)) refreshBoard(nd.date);
  if (Date.now() - (S.oddsAt || 0) > 10 * 60e3) refreshOdds();
}, 60000);

// ---------- arranque ----------
(async function init() {
  staticTexts();
  try { if (history.state && history.state.fbSheet) history.replaceState(null, ''); } catch (e) {} // recarregou com uma folha aberta
  if (!sb) { showGate(brand() + '<div class="err">The site isn\'t connected to Supabase yet.</div><p class="small muted" style="margin:0">Put the Project URL and the anon/publishable key in <span class="kbd">docs/config.js</span>.</p>'); return; }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { S.session = null; } });
  try { await afterLogin(); } catch (e) { renderAuth('login', errText(e)); }
})();
