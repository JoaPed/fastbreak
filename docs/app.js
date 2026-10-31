// Fastbreak Run Planner — site. Dados no Supabase; cálculo no browser (core.js → window.FB).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

const FB = window.FB;
const CFG = window.FB_CONFIG || {};
const STATS = FB.STATS, STATUS = FB.STATUS;
const TEAMS = ['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'];
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const QLABEL = { 1: '1.º período', 2: '2.º período', 3: '3.º período', 4: '4.º período' };
const TABS = ['hoje', 'run', 'plantel', 'grupo', 'ajustes'];
const LIVE_STAT = { pts: 'points', reb: 'reboundsTotal', ast: 'assists', fg3: 'threePointersMade', stl: 'steals', blk: 'blocks', tov: 'turnovers', oreb: 'reboundsOffensive', dreb: 'reboundsDefensive', fgm: 'fieldGoalsMade', fga: 'fieldGoalsAttempted', fg3a: 'threePointersAttempted', ftm: 'freeThrowsMade', fta: 'freeThrowsAttempted', pip: 'pointsInThePaint' };
// estatísticas que se podem escolher como objetivo à mão (as da blockchain entram sozinhas)
const OBJ_STATS = ['pts', 'reb', 'ast', 'fg3', 'stl', 'blk', 'oreb', 'dreb', 'tov', 'ast-tov', 'fgm', 'fga', 'fg3a', 'ftm', 'fta', 'pip', 'pts+reb', 'pts+ast', 'pts+reb+ast', 'stl+blk'];
const AVG_SHOW = ['pts', 'reb', 'ast', 'fg3', 'stl', 'blk', 'tov', 'oreb', 'dreb', 'fgm', 'fga', 'fg3a', 'ftm', 'fta', 'pip'];

// peso da forma recente (últimos 5 e 10 jogos) nas médias: guardado neste browser
const FORM_LEVELS = [['0', 'Só a época'], ['1', 'Normal'], ['1.5', 'Forte']];
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
  hoje: () => [['lineup', 'Lineup'], ['porque', 'Porquê'], ['comparar', 'Comparar']],
  run: () => [['premios', 'Prémios'], ['dias', 'Dias']].concat(S.multi ? [['contas', 'Contas']] : []).concat([['analise', 'Análise'], ['historico', 'Histórico']]),
  plantel: () => [['plantel', 'Plantel'], ['forma', 'Forma'], ['lesoes', 'Lesões'], ['comprar', 'Comprar'], ['vender', 'Vender'], ['colecao', 'Coleção']],
  grupo: () => [['classif', 'Classificação'], ['lineups', 'Lineups'], ['emprestimos', 'Empréstimos']],
  ajustes: () => [['perfil', 'Perfil'], ['prefs', 'Preferências']].concat(S.role === 'admin' ? [['admin', 'Admin']] : []).concat([['dados', 'Dados']]),
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
  return '<nav class="subtabs" aria-label="Partes de ' + esc(tab) + '"><div class="subtabs-in" role="tablist">' + SUBS[tab]().map(([k, l]) => '<button type="button" role="tab" data-action="sub" data-stab="' + tab + '" data-sub="' + k + '" aria-selected="' + (cur === k) + '">' + l + (counts[k] ? '<span class="cnt" aria-label="' + counts[k] + ' no relatório">' + counts[k] + '</span>' : '') + '</button>').join('') + '</div></nav>';
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
  const tabs = { hoje: 'Jornada', run: 'Run', plantel: 'Jogadores', grupo: 'Grupo', ajustes: 'Ajustes' };
  Object.entries(tabs).forEach(([k, label]) => { const b = $('t-' + k); if (b && b.lastChild && b.lastChild.nodeType === 3) b.lastChild.textContent = label; });
  const lbl = (id, text) => { const e = $(id); if (e) e.setAttribute('aria-label', text); };
  lbl('meBtn', 'Ajustes e perfil');
  const nav = document.querySelector('.tabbar'); if (nav) nav.setAttribute('aria-label', 'Secções');
  const bg = document.querySelector('.sheet-bg'); if (bg) bg.setAttribute('aria-label', 'Fechar');
  const meta = $('runMeta'); if (meta && /carregar|Loading/.test(meta.textContent)) meta.textContent = 'A carregar…';
  document.documentElement.lang = LANG === 'en' ? 'en' : 'pt-PT';
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
  const what = e.t === 'game_winner' ? '<b>' + esc(o[0]) + '</b> ganha' : e.t === 'player_duel' ? '<b>' + esc(o[0]) + '</b> marca mais que ' + esc(other[0]) : '<b>' + esc(String(e.d).replace(/^Will\s+/i, '').replace(/\s+record.*$/i, '')) + '</b> · ' + esc(o[0]);
  const team = e.t === 'game_winner' ? (String(o[2]) === String(e.hid) ? e.home : e.away) : null;
  return '<div class="card pick-card"><div class="pk-top"><span class="eyebrow">Pick do dia ' + helpBtn('picks') + '</span></div>' +
    '<div class="pk-main">' + (team ? teamLogo(teamFix(team)) : '') + '<div style="min-width:0;flex:1"><div class="pk-what">' + what + '</div><div class="ps">' + hm(Date.parse(e.lock)) + ' · ' + (best.ours ? 'odds ' + pct(best.p) + ' · pessoal ' + Math.round(o[1]) + '%' : 'pessoal ' + Math.round(o[1]) + '% (ainda sem odds)') + '</div></div>' +
    '<div class="pk-pts num"><b>' + cap + '</b><small>pontos</small></div></div></div>';
}

// ---------- utilidades ----------
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o == null ? {} : o));
const f1 = n => (Math.round(n * 10) / 10).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f0 = n => Math.round(n).toLocaleString('pt-PT');
const f2 = n => (+n || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = p => p < 0.005 ? '<1%' : p > 0.995 ? '>99%' : Math.round(p * 100) + '%';
const tone = p => p >= 0.65 ? 'good' : p >= 0.4 ? 'warn' : 'bad';
const dt = s => new Date(s + 'T12:00:00Z');
const dShort = s => { const d = dt(s); return d.getUTCDate() + ' ' + MO[d.getUTCMonth()]; };
const dWeek = s => WD[dt(s).getUTCDay()];
const hm = iso => { try { return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const ago = iso => { if (!iso) return 'nunca'; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); if (m < 2) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 36) return 'há ' + h + ' h'; return 'há ' + Math.round(h / 24) + ' dias'; };
const statShort = st => FB.statTerms(st).map((t, i) => (i ? (t.sign < 0 ? '−' : '+') : t.sign < 0 ? '−' : '') + ((STATS[t.s] || {}).short || t.s.toUpperCase())).join('');
const statLabel = st => FB.statTerms(st).map((t, i) => (i ? (t.sign < 0 ? ' − ' : ' + ') : t.sign < 0 ? '− ' : '') + ((STATS[t.s] || {}).label || t.s)).join('');
const objOne = o => o.target + '+ ' + statShort(o.stat) + (o.each ? ' cada' : '');
// objetivo no placar grande: um por linha nos dias de combinação (sem o "e")
function goalBig(objs) {
  const l = (objs || []).filter(x => x && x.stat);
  if (!l.length) return '<div class="goal"><small>Objetivo por definir</small></div>';
  const one = x => x.target + '<small>' + esc(statShort(x.stat)) + (x.each ? ' cada' : '') + '</small>';
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
    '<div class="wr-v"><b class="num">' + (big != null ? big : pct(P)) + '</b><span>' + (label || 'vitória') + '</span></div></div>';
}
// tom de um dia: cinzento quando o plano o dá por perdido (guarda os usos para outros dias)
const dTone = P => (P < 0.05 ? 'mute' : tone(P));
const objsText = day => { const list = ((day || {}).objectives || []).filter(o => o && o.stat); return list.length ? list.map(objOne).join(' e ') : 'Objetivo por definir'; };
// de onde vem o valor esperado de um jogador (texto curto para as listas)
// seta de forma ao lado do valor: últimos 5 jogos acima/abaixo da média da época na estatística do dia
function formMark(p, o) {
  if (!o) return '';
  const f = FB.formInfo(p, o.stat); if (!f || !f.n5 || f.n5 < 3) return '';
  return f.trend >= 0.12 ? ' <i class="fm up" title="Em forma" aria-label="em forma">▲</i>' : f.trend <= -0.12 ? ' <i class="fm down" title="Fora de forma" aria-label="fora de forma">▼</i>' : '';
}
function srcShort(info) {
  if (info.src === 'odds') return 'linha ' + f1(info.line);
  if (info.src === 'proxy') return 'linha de ' + ((STATS[info.via] || {}).short || info.via) + ' ' + f1(info.line);
  if (info.src === 'misto') return 'odds + média';
  if (info.src === 'media') return 'média';
  if (info.src === 'estimativa') return 'estimativa';
  return 'sem dados';
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
const INJ_SHORT = { out: 'Fora', ofs: 'Fora', doubtful: 'Dúv.', questionable: 'Dúv.', dtd: 'Dúv.', probable: 'Prov.' };
function injLine(rec) {
  if (!rec) return '';
  return esc(INJ_LABEL[rec.status] || rec.label || rec.status) + (rec.detail ? ' · ' + esc(rec.detail) : '') + (rec.return_date ? ' · regresso previsto ' + dShort(rec.return_date) : '');
}
// relatório de lesões nas fichas, com o botão para o ignorar
function injuryBlock(id, j, date) {
  const rec = injRec(id); if (!rec) return '';
  const ign = !!((S.mine.roster[id] || {}).injIgnore);
  let how = '';
  if (j && !ign && j.k != null) how = (j.k === 0 ? 'Este é o próximo jogo dele' : 'Este é o ' + (j.k + 1) + '.º jogo dele a contar de agora') + ': ' + (j.status ? 'o plano conta com ' + Math.round(STATUS[j.status].play * 100) + '% de ele jogar.' : 'o plano já conta com ele normal.');
  return '<div class="note' + (rec.status === 'probable' ? ' info' : '') + ' stack" style="gap:6px"><div><b>Relatório de lesões:</b> ' + injLine(rec) + '. <span class="small">(ESPN, ' + esc(ago(rec.updated_at)) + ')</span></div>' +
    (rec.comment ? '<div class="small">' + esc(rec.comment) + '</div>' : '') + (how ? '<div class="small">' + how + '</div>' : '') +
    (ign ? '<div class="small"><b>Relatório ignorado</b>: o plano conta com ele.</div>' : '') +
    ((S.mine.roster || {})[id] ? '<button class="btn small" type="button" data-action="inj-ignore" data-id="' + esc(id) + '"' + (date ? ' data-date="' + date + '"' : '') + ' data-on="' + (ign ? '0' : '1') + '">' + (ign ? 'Voltar a usar o relatório' : 'Vai jogar (ignorar o relatório)') + '</button>' : '') + '</div>';
}
// ---------- em que se baseia cada valor ----------
const formName = () => (FORM_LEVELS.find(x => x[0] === formLevel) || ['1', 'Normal'])[1];
function partBasis(p, part, md, id, opp) {
  const u = esc((STATS[part.stat] || {}).short || part.stat);
  const raw = (md.oddsDay || {})[id] || {};
  if (part.src === 'odds') {
    const o = raw[part.stat] || {};
    return '<b>Odds</b> de ' + u + ': linha ' + f1(+o.line) + ' · odd do mais <b class="num">' + esc(fmtOdd(o.over)) + '</b> / do menos <b class="num">' + esc(fmtOdd(o.under)) + '</b>' + (o.books ? ' (consenso de ' + o.books + ' casa' + (o.books > 1 ? 's' : '') + ')' : '') + ' → ' + pct(FB.devig(o.over, o.under)) + ' de passar a linha, já sem a margem da casa → média <b class="num">' + f1(part.mu) + '</b>. As odds já contam com a forma, o adversário e os minutos.';
  }
  if (part.src === 'proxy') {
    const o = raw[part.via] || {}, vs = esc((STATS[part.via] || {}).short || part.via), a = FB.avgOf(p, part.stat), aq = FB.avgOf(p, part.via);
    return '<b>Sem odds de ' + u + '</b>: usa a linha de ' + vs + ' ' + f1(+o.line) + ' (' + pct(FB.devig(o.over, o.under)) + ' de passar) e a proporção ' + u + '/' + vs + ' nas médias dele (' + (a && aq && aq.v > 0 ? (a.v / aq.v).toLocaleString('pt-PT', { maximumFractionDigits: 2 }) : '–') + ') → <b class="num">' + f1(part.mu) + '</b>.';
  }
  if (part.src === 'media' || part.src === 'estimativa') {
    const fi = FB.formInfo(p, part.stat) || {}, m = opp ? FB.matchup(S.teams, opp, part.stat) : null;
    let t = '<b>Sem odds</b>: médias de ' + u + ' — época ' + (fi.season != null ? f1(fi.season) : '–') + (fi.n10 ? ' · últimos 10 ' + (fi.l10 != null ? f1(fi.l10) : '–') + ' · últimos 5 ' + (fi.l5 != null ? f1(fi.l5) : '–') + (fi.used != null ? ' → com a forma (' + esc(formName().toLowerCase()) + ') ' + f1(fi.used) : '') : ' (ainda sem jogos desta época)');
    if (part.src === 'estimativa') t += part.stat === 'pip' ? '. A ESPN não dá pontos na área por jogador: estimativa a partir dos lançamentos de 2 marcados' : '. Estimativa a partir das outras médias dele (menos certeza)';
    if (m) t += '. Adversário ' + esc(opp) + ': concede ' + (m.f >= 1 ? '+' : '−') + Math.round(Math.abs(m.f - 1) * 100) + '% desta estatística face à média da liga → ajuste ' + (m.used >= 1 ? '+' : '−') + Math.round(Math.abs(m.used - 1) * 100) + '%';
    return t + ' → <b class="num">' + f1(part.mu) + '</b>.';
  }
  return 'Sem dados de ' + u + '.';
}
function playBasis(info) {
  const j = info.injury, pp = pPlayOf(info);
  if (j && !j.ignored && j.risk) return '<b>Disponibilidade</b>: ' + pct(pp) + ' de jogar — relatório de lesões: ' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + (j.rec.detail ? ' (' + esc(j.rec.detail) + ')' : '') + '. O plano conta com ele a jogar (100%), porque dá para o trocar até ao jogo se ficar de fora.';
  if (j && !j.ignored && j.status) return '<b>Disponibilidade</b>: ' + pct(pp) + ' de jogar — relatório de lesões: ' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + (j.rec.detail ? ' (' + esc(j.rec.detail) + ')' : '') + (j.k === 0 ? ', para o próximo jogo dele.' : ', no ' + (j.k + 1) + '.º jogo dele a contar de agora.') + (info.status !== j.status ? ' Puseste-o como ' + esc(STATUS[info.status].label.toLowerCase()) + ' no plantel: conta o pior.' : '');
  if (info.status !== 'ok') return '<b>Disponibilidade</b>: ' + pct(pp) + ' de jogar (estado "' + esc(STATUS[info.status].label) + '" posto por ti no plantel).';
  if (j && j.ignored) return '<b>Disponibilidade</b>: 100% — estás a ignorar o relatório de lesões para ele.';
  if (j) return '<b>Disponibilidade</b>: 100% — está no relatório (' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + '), mas ' + (j.k == null ? 'este jogo já começou ou já passou.' : 'neste jogo já conta normal.');
  return '<b>Disponibilidade</b>: 100% — não está no relatório de lesões' + (S.injOk && S.injAt ? ' (ESPN, ' + esc(ago(S.injAt)) + ')' : S.injOk === false ? ' (o relatório ainda não está ligado)' : '') + '.';
}
function basisHtml(p, info, o, md, id, many) {
  const g = FB.gameOf(md.day, p.team), opp = g ? (g[0] === p.team ? g[1] : g[0]) : null;
  const u = esc(statShort(o.stat)), parts = info.parts || [], steps = [];
  parts.forEach(part => steps.push((parts.length > 1 && part.sign < 0 ? 'A subtrair. ' : '') + partBasis(p, part, md, id, opp)));
  if (parts.length > 1) steps.push('<b>Soma</b>: ' + parts.map((x, i) => (x.sign < 0 ? '− ' : i ? '+ ' : '') + f1(x.mu) + ' ' + esc((STATS[x.stat] || {}).short || x.stat)).join(' ') + ' = ' + f1(info.muIf != null ? info.muIf : info.mu) + ' ' + u + '.');
  if (info.b2b) { const h = (p.avg || {}).hist, b = h && h.b2b, pc = Math.round((1 - info.b2b.f) * 100);
    steps.push('<b>Jogos seguidos</b>: jogou ontem. ' + (info.src === 'odds' ? 'As odds já contam com isso.' : 'Sem odds, conta ' + (pc > 0 ? pc + '% menos' : pc < 0 ? Math.abs(pc) + '% mais' : 'o mesmo') + (b && b.n >= 6 ? ' (na época passada fez ' + plural(b.n, 'jogo seguido', 'jogos seguidos') + ' e rendeu ' + Math.round(((b.r || {})[FB.statTerms(o.stat)[0].s] || 1) * 100) + '% do normal)' : ' (o normal nestes jogos)') + '.')); }
  steps.push(playBasis(info));
  { const t0 = FB.statTerms(o.stat)[0].s, k = FB.kOf(p, t0), k0 = (STATS[t0] || {}).k, h = (p.avg || {}).hist;
    if (h && h.n >= 15 && k0) steps.push('<b>Regularidade</b> (' + h.n + ' jogos da época passada): ' + (k / k0 >= 1.2 ? 'varia muito de jogo para jogo' : k / k0 <= 0.85 ? 'é regular, costuma andar perto da média' : 'normal para esta estatística') + '.'); }
  const muIf = info.muIf != null ? info.muIf : info.mu;
  steps.push('<b>No plano</b>: ' + (info.pPlay < 1 ? pct(info.pPlay) + ' × ' + f1(muIf) + ' = ' : '') + '<b class="num">' + f1(info.mu) + '</b> ' + u + ' esperados (± ' + f1(Math.sqrt(info.v || 0)) + ').');
  return '<div class="card panel basis"><h2>Em que se baseia' + (many ? ' · ' + u : '') + '</h2><ol class="steps">' + steps.map(x => '<li>' + x + '</li>').join('') + '</ol></div>';
}
const icoShare = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
const icoLock = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-label="Fixado"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
// ---------- ajuda: as explicações ficam atrás de um (?) ao lado dos títulos ----------
const HELP = {
  lineup: ['Lineup', 'O lineup que o plano sugere para este dia, a pensar na run toda: pode guardar jogadores para dias em que valem mais. O número à direita é o que cada um deve fazer. Em Mudar fixas, tiras e pões jogadores um a um e vês o que isso faz à run. Toca num jogador para ver em que se baseia.'],
  aovivo: ['Ao vivo', 'Quando o primeiro jogo começa, a app prende quem já jogou, lê os pontos da ESPN de 2 em 2 minutos e refaz o resto da run. Quando os jogos do lineup acabam, o dia fecha sozinho. Se o lineup que submeteste no Top Shot for outro, corrige-o em Sugestões para hoje. Toca num jogador do lineup para ver as estatísticas do jogo dele. Se a ESPN falhar durante o jogo, os valores entram quando o jogo acabar.'],
  opcoes: ['Sugestões para hoje', '<b>Antes dos jogos</b>: compara o plano com ir com tudo hoje ou guardar um jogador para outro dia (para escolheres tu jogador a jogador, usa Mudar no lineup).<br><b>Durante os jogos</b>: com os pontos que já entraram, compara manter, tirar ou poupar quem ainda não jogou.<br>Cada opção refaz a run toda com os usos que sobram; “o melhor” é a que mais sobe as hipóteses de prémio. Quem sai antes de o jogo dele começar não gasta o uso.'],
  jogosdia: ['Jogos do dia', 'Hora de cá. Debaixo de cada jogo, os teus jogadores (a negrito os do lineup). Durante os jogos: resultado ao vivo e os valores de quem está no lineup.'],
  lesoesforma: ['Lesões e forma', '<b>Lesões</b>: relatório da ESPN para quem joga neste dia, com a probabilidade com que o plano conta. O relatório para a run toda está em Jogadores → Lesões. <b>Forma</b>: média dos últimos 5 jogos face à da época, na estatística do dia.'],
  porque: ['Em que se baseia', 'Odds das casas de apostas quando há; senão médias da época com a forma e o adversário. O número de cada jogador (pp) é quanto ele soma à vitória do dia: sem ele, entrava o melhor que sobra. “Poupa outros”: está aqui para guardar alguém melhor para outro dia. Os de fora estão guardados para outros dias ou rendem menos.'],
  comparar: ['Comparar', 'Todos os teus jogadores com jogo neste dia. Números grandes: últimos 5 jogos; pequenos: época. Adv.: quanto o adversário concede desta estatística. Toca num título para ordenar e num jogador para abrir a ficha.'],
  transf: ['Transferências', 'Um Moment só joga por uma conta em cada noite. Antes da noite indicada, oferece o Moment à outra conta no Top Shot e depois lê as carteiras outra vez (Jogadores → Coleção).'],
  vender: ['Vender', 'Cartas de todas as tuas contas. Não usadas: jogadores que nenhuma conta usou nem usa no resto da run (e em quantas runs isso já aconteceu). Repetidas: jogadores com cartas a mais para o que o plano usa (cada conta que o usa n vezes precisa de uma carta com pelo menos n usos, e cada carta só joga numa conta por noite). Rara a mais: o plano usa-o poucas vezes e uma carta mais barata, com menos usos, chega. Poupar: trocar a tua por uma do mesmo jogador e da mesma raridade à venda mais barata. Low ask = a carta mais barata à venda dessa edição; ao vender o Top Shot fica com 5%.'],
  premios: ['Prémios', 'Cada aro é a probabilidade de acabares a run com pelo menos esse número de vitórias: cheio é certo. Verde provável, amarelo meio-meio, vermelho difícil. O plano escolhe os lineups para subir estas probabilidades.'],
  dist: ['Vitórias no fim', 'A probabilidade de cada total de vitórias no fim da run. As cores marcam os patamares de prémio; o contorno é o total mais provável.'],
  contas: ['Contas', 'O plano junta as coleções das tuas contas como se fossem uma só e escolhe o lineup de cada uma. Toca numa conta para ver os prémios dela.'],
  picks: ['Pick do dia', 'Dos picks do Fast Break de hoje (lidos no Top Shot quando o admin atualiza), o mais seguro: o favorito com as odds mais baixas, para dobrar os pontos do dia. A probabilidade vem das casas de apostas (linha de vitória do jogo; nos jogadores, as odds de pontos); «pessoal» é a % de quem já o escolheu no Top Shot. Sem odds, vai pela % do pessoal.'],
  mudar: ['Mudar o lineup', 'Toca no cadeado para fixar quem tem de jogar, no × para tirar alguém deste dia (fica um lugar livre: no + escolhes quem entra, ou deixas o plano escolher) e no + de Pôr no lineup para meter um jogador que o plano deixou de fora. O plano completa o resto e refaz a run a cada mudança. Em cima vês o que muda face à sugestão do plano: a vitória do dia, as vitórias esperadas na run, os prémios e os outros dias em que entra ou sai alguém (os usos gastos hoje deixam de estar lá). Para desfazer, toca outra vez no cadeado ou em Voltar à sugestão do plano.'],
  dias: ['Dias', 'A run toda: o objetivo de cada dia, o lineup do plano e a vitória prevista. Nos dias que passaram, o resultado e o total feito, que entram sozinhos com as estatísticas dos jogos. Toca num dia para o abrir na Jornada.'],
  analise: ['Análise', 'A previsão de cada dia fica guardada até ao primeiro jogo. Depois vês o previsto ao lado do que aconteceu: vitórias, totais e cada jogador (100% = fez o previsto). Com poucos dias, a sorte pesa muito.'],
  historico: ['Histórico', 'Os teus dias de Fast Break lidos da blockchain, de todas as runs. Os dias antigos entram aos poucos.'],
  plantel: ['Plantel', 'Os teus jogadores nesta run. Usos: quantos dias ainda podem jogar (os da melhor carta: Common 1, Rare 2, Legendary 4; mais cartas do mesmo jogador não somam). A faixa são os dias da run: usado, no plano, na outra conta, tem jogo. Toca num jogador para mudar os usos, as cartas ou o estado.'],
  cartas: ['As tuas cartas', 'Cada Moment com a raridade e o ASP lidos no Top Shot. A raridade dá o mínimo de usos (Common 1, Rare 2, Legendary 4, Ultimate ilimitados) e o ASP só sobe: até $10 Draft Pick (1), até $50 Starter (2), até $300 All-Star (3), até $1000 MVP (4), acima Hall of Fame (ilimitados). O jogador fica com os usos da melhor carta. Cartas sem dados do Top Shot: o site adivinha a raridade pelo set e pela tiragem, e podes escolher a certa.'],
  colecao: ['Coleção', 'Os teus Moments lidos da blockchain (todas as contas), guardados no perfil para todas as runs. Usos por run de cada jogador: os da melhor carta. Moments de jogadores fora da NBA desta época não contam.'],
  comprar: ['Comprar', 'A run é refeita com cada candidato: vês quanto sobem os prémios e em que dias ele jogaria. Usos por run: Common 1 (2 se o ASP passar dos 10 $), Rare 2, Legendary 4. “Todos” inclui jogadores novos e um Moment de escalão acima de quem já tens (um Rare de quem só tem um Common dá +1 uso); “Reforçar os teus” vê só esses. Num jogador que já tens, só ganha se o novo for de um escalão acima. Os preços não entram: esses vês tu no marketplace.'],
  especialistas: ['Especialistas', 'Os melhores da NBA em cada estatística (época atual misturada com a passada). As estatísticas estão pela ordem de quantas vezes saem nos dias de Fast Break; ● = sai no resto desta run. <b>Especialista</b>: no topo desta estatística mas fora dos 75 melhores marcadores. <b>Regular/irregular</b>: quanto varia de jogo para jogo.'],
  forma: ['Forma da run', 'Escolhe um dos próximos dias. Quentes: os teus que jogam nesse dia com a média dos últimos 5 jogos acima da época (≥ 8%) nas estatísticas do objetivo. Frios: os do plano desse dia abaixo da época. Minutos: quem joga mais ou menos 3 minutos do que a média da época. Pode jogar menos: jogos em que o favorito ganha em 85% ou mais (odds da ESPN, só perto do jogo) — se ficar decidido cedo, as estrelas descansam ou são poupadas. As barras são os últimos jogos (o mais recente à direita); a linha é a média da época.'],
  historic: ['Historic', 'Jogos simulados entre lendas (médias de carreira, 36 minutos). Escolhes 5 dentro de 350 Roster Points; ganha quem soma mais Fast Break Points (PTS 1, REB 1, AST 2, STL 3, BLK 3, perda −1, triplo +0,5, duplo-duplo +5, triplo-duplo +10). Os pontos esperados de cada lenda vêm dos jogos simulados até agora, puxados para o que o custo prevê quando há poucos jogos, e do adversário. A sugestão é a equipa que mais vezes chega aos 40 primeiros quando o dia é simulado 3000 vezes, comparada com os pontos que deram prémio em dias parecidos. + fixa uma lenda, × tira-a do dia, tocar no nome guarda a tua carta (o desconto baixa o custo).'],
  prio: ['Prioridade entre contas', 'O plano junta as tuas contas e procura o máximo de prémio somando as duas. Como os prémios vão para quem chega mais longe, compensa juntar os melhores Moments numa conta, e sem prioridade pode calhar a qualquer uma. Com prioridade, cada vitória esperada da conta escolhida vale 20% mais e os melhores Moments vão primeiro para ela; a outra joga com o resto. <b>Automática</b> = a mais bem classificada na Geral (dos lugares lidos no Top Shot). <b>Iguais</b> = sem prioridade.'],
  lesoes: ['Lesões', 'Relatório da ESPN. No plano: fora → não joga; pouco provável → 25%; dúvida ou dia a dia → 50%; provável → 90% (no próximo jogo dele, e menos nos seguintes). Na ficha do jogador podes ignorar o relatório. No resto da NBA, por equipa, aparecem os importantes (20+ minutos ou 12+ pontos); procura um nome ou equipa para ver todos. Toca num jogador para ver a nota completa da ESPN.'],
  classif: ['Classificação', 'Vitórias e derrotas de cada conta, smurfs incluídas: mal os jogos acabam, os dias fecham com as estatísticas dos jogos e o lineup que cada um partilhou. Os aros são a probabilidade de cada um chegar aos prémios. O admin convida amigos em Ajustes → Admin.'],
  lineups: ['Lineups do grupo', 'Para cada dia, os jogadores que o plano de cada um põe no lineup (muda até ao jogo), os mais escolhidos em cima, e quem os leva. Cadeado: essa pessoa já o fixou ou já está em jogo. Em destaque: os que estão no teu lineup desse dia. «Por pessoa» mostra o lineup de cada um, com um anel nos jogadores que também estão no teu.'],
  emprestimos: ['Empréstimos', 'Refaz a tua run com Moments dos amigos, só nos dias em que o plano deles não os usa. Conta com os usos de um Moment dele numa run. No Top Shot ele oferece-te o Moment e tu devolves depois de jogares esse dia.'],
  partilha: ['Partilhar', 'O grupo vê o lineup que o teu plano sugere e os usos dos teus jogadores, e pode pedir-te Moments nos dias em que não os usas. O plantel e o plano continuam só teus.'],
  smurf: ['Contas smurf', 'Até 2 contas extra tuas. O plano junta as coleções e diz que Moments mandar para que conta antes de cada noite (um Moment só joga por uma conta em cada noite).'],
  flow: ['Endereço Flow', 'O endereço da tua carteira Dapper: 0x e 16 letras ou números (está na Dapper e no perfil do Top Shot). Serve para ler os teus Moments e os teus resultados da blockchain.'],
  avancado: ['Cálculo', '<b>Jogos seguidos</b>: no 2.º de dois jogos em dias seguidos, sem odds, o plano tira ~3% (ou o que esse jogador fez nesses jogos na época passada). <b>Forma</b>: sem odds, mistura a época com os últimos 10 e 5 jogos (normal: 50/30/20%). As odds já contam com as duas coisas.'],
  dados: ['Dados', 'Atualizados sozinhos: calendário e médias de manhã, odds à tarde e ao início da noite (hora de Lisboa), blockchain e lesões de 30 em 30 minutos.'],
};
const helpBtn = k => '<button class="help-btn" type="button" data-action="help" data-k="' + k + '" aria-label="' + esc('Ajuda: ' + (HELP[k] || ['?'])[0]) + '">?</button>';
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
  // letras que não se desfazem em letra + acento (ı turco, ł, ø, đ, ß, æ, œ): à mão, para "Sengun" achar "Şengün" e afins
  return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ı/g, 'i').replace(/ł/g, 'l').replace(/ø/g, 'o').replace(/[đð]/g, 'd').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe')
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
  if (/Invalid login credentials/i.test(m)) return 'Email ou palavra-passe errados.';
  if (/already registered|already been registered/i.test(m)) return 'Já existe uma conta com este email. Usa “Entrar”.';
  if (/Password should be at least/i.test(m)) return 'A palavra-passe precisa de pelo menos 6 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Demasiadas tentativas seguidas. Espera um minuto.';
  if (/Email not confirmed/i.test(m)) return 'Falta confirmar o email. Abre a mensagem que recebeste.';
  if (/Código de convite errado/.test(m)) return 'Código de convite errado. Pede-o a quem te convidou.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem ligação ao servidor. Verifica a internet.';
  return m || 'Algo correu mal. Tenta outra vez.';
}
async function q(promise) { const { data, error } = await promise; if (error) throw error; return data; }

// ---------- entrada (login, convite, perfil) ----------
function showGate(html) { $('app').hidden = true; $('gate').hidden = false; $('gate').innerHTML = '<div class="gate"><div class="card gate-card">' + html + '</div></div>'; }
function brand() { return '<h1 class="brand">Fastbreak<br><span>Run Planner</span></h1>'; }

function renderAuth(mode, err) {
  mode = mode || 'login';
  showGate(brand() +
    '<p class="small muted" style="margin:0">Planeia os lineups da run inteira e acompanha o teu grupo.</p>' +
    '<form id="authForm" class="stack" novalidate>' +
    (mode === 'signup' ? '<label>Nome que o grupo vê<input class="field" id="auName" autocomplete="nickname" maxlength="40" required></label>' : '') +
    '<label>Email<input class="field" id="auEmail" type="email" autocomplete="email" required></label>' +
    '<label>Palavra-passe<input class="field" id="auPass" type="password" autocomplete="' + (mode === 'signup' ? 'new-password' : 'current-password') + '" minlength="6" required></label>' +
    (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') +
    '<button class="btn primary" type="submit" id="auSubmit">' + (mode === 'signup' ? 'Criar conta' : 'Entrar') + '</button></form>' +
    '<button class="btn link" type="button" data-action="auth-mode" data-mode="' + (mode === 'signup' ? 'login' : 'signup') + '">' + (mode === 'signup' ? 'Já tenho conta: entrar' : 'Ainda não tenho conta: criar') + '</button>');
  $('authForm').dataset.mode = mode;
  setTimeout(() => { const f = $(mode === 'signup' ? 'auName' : 'auEmail'); if (f) f.focus(); }, 30);
}
async function submitAuth(form) {
  const mode = form.dataset.mode;
  const email = $('auEmail').value.trim(), password = $('auPass').value;
  const name = mode === 'signup' ? $('auName').value.trim() : '';
  if (!email || !password || (mode === 'signup' && !name)) { renderAuth(mode, 'Preenche todos os campos.'); return; }
  $('auSubmit').disabled = true;
  try {
    if (mode === 'signup') {
      const data = await q(sb.auth.signUp({ email, password, options: { data: { name } } }));
      if (!data.session) { renderAuth('login', 'Conta criada. Confirma o email que recebeste e depois entra.'); return; }
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
  catch (e) { showGate(brand() + '<div class="err">' + esc(errText(e)) + '</div><p class="small muted">Se acabaste de criar o projeto, confirma que correste o ficheiro <span class="kbd">supabase/schema.sql</span> no SQL Editor.</p><button class="btn" type="button" data-action="logout">Sair</button>'); return; }
  S.role = status && status.role;
  if (!S.role) { renderJoin(!!(status && status.has_members)); return; }
  await loadProfile();
  if (!S.profile || !S.profile.display_name) { renderProfileSetup(); return; }
  await enterApp();
}
function renderJoin(hasMembers, err) {
  showGate(brand() + (hasMembers
    ? '<p style="margin:0">Para entrares no grupo precisas do código de convite.</p><form id="joinForm" class="stack"><label>Código de convite<input class="field" id="joinCode" autocomplete="off" spellcheck="false" autocapitalize="none" required></label>' + (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') + '<button class="btn primary" type="submit">Entrar no grupo</button></form>'
    : '<p style="margin:0">Ainda não há ninguém no grupo. Ficas como <b>admin</b>: crias as runs, defines os objetivos e escolhes o código de convite para os teus amigos.</p>' + (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') + '<form id="joinForm"><button class="btn primary" type="submit" style="width:100%">Criar o grupo</button></form>') +
    '<button class="btn link" type="button" data-action="logout">Sair desta conta</button>');
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
  showGate(brand() + '<p style="margin:0">Só falta o teu perfil. O nome de utilizador do Top Shot serve para ler os teus resultados da blockchain.</p>' +
    '<form id="profForm" class="stack"><label>Nome que o grupo vê<input class="field" id="pfName" maxlength="40" value="' + esc(name) + '" required></label>' +
    '<label>Utilizador do Top Shot (opcional)<input class="field" id="pfTs" maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false" value="' + esc((S.profile || {}).topshot_username || '') + '"></label>' +
    (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') + '<button class="btn primary" type="submit">Continuar</button></form>');
}
async function submitProfile(nameEl, tsEl, flowEl, smurfs) {
  const ts = tsEl.value.trim().replace(/^@+/, '').replace(/^https?:\/\/[^/]*\/user\/@?/i, '');
  const row = { user_id: S.session.user.id, display_name: nameEl.value.trim().slice(0, 40), topshot_username: ts || null };
  if (flowEl) { const fa = flowEl.value.trim(); if (fa && !/^0x[0-9a-fA-F]{16}$/.test(fa)) throw new Error('O endereço Flow tem o formato 0x seguido de 16 caracteres.'); row.flow_address = fa || null; }
  if (!row.display_name) throw new Error('Escreve o teu nome.');
  if (smurfs !== undefined && (smurfs.length || 'smurfs' in (S.profile || {}))) row.smurfs = smurfs; // base de dados antiga sem a coluna: só falha quem quer smurfs
  try { await q(sb.from('profiles').upsert(row, { onConflict: 'user_id' })); }
  catch (e) { if (/smurfs/.test(errText(e))) throw new Error('Para guardar contas smurf, o admin tem de correr o supabase/schema.sql novo no Supabase (SQL Editor).'); throw e; }
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
    if (S.switchedTo) { toast('A ver a run ativa: ' + S.switchedTo + '. Outras runs em Ajustes → Preferências.'); S.switchedTo = null; }
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
  toast('Jogador repetido junto: ' + names.join(', ') + '.');
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
    if (await loadOdds()) { schedule(); if (nd && !had && S.odds[nd.date] && Object.keys(S.odds[nd.date].players || {}).length) toast('Chegaram as odds de hoje: o plano foi refeito com elas.'); }
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
    if (d && d.pro && d.pro.p) { S.proMine = d.pro; S.proMemo = null; try { localStorage.setItem('fb-pro', JSON.stringify(d.pro)); } catch (e) {} S.pickNote = (S.pickNote || '') + ' Pro: preços de ' + Object.keys(d.pro.p).length + ' jogadores' + (d.pro.err ? ' (' + d.pro.err + ')' : '') + '.'; delete d.pro; }
    // que script correu: sem "sv" (ou antigo) é o automático antigo, que não lê os picks
    S.pickNote = !d || !Array.isArray(d.accs) || (Array.isArray(d.do) && !d.do.includes('picks')) ? null : d.picks && Array.isArray(d.picks.ev) ? ' Picks: ' + d.picks.ev.length + ' jogos.' : d.picksErr ? ' Picks: não deu (' + d.picksErr + ').' : (+d.sv || 0) < 8 ? ' Picks: o script do Top Shot é antigo — se usas o automático (Tampermonkey/Userscripts), reinstala-o ou desliga-o e usa o favorito.' : ' Picks: nenhum aberto.';
    if (d && d.picks && Array.isArray(d.picks.ev)) { S.picksMine = d.picks; try { localStorage.setItem('fb-picks', JSON.stringify(d.picks)); } catch (e) {} delete d.picks; }
    if (d && d.hist && Array.isArray(d.hist.days)) { histTake(d.hist); delete d.hist; }
    else if (d && d.histErr) S.pickNote = (S.pickNote || '') + ' Historic: não deu (' + d.histErr + ').';
    if (d && d.ed && d.ed.p) { edTake(d.ed); S.edNew = { n: Object.keys(d.ed.p).length, err: d.ed.err || null }; delete d.ed; }
    if (d && Array.isArray(d.do) && d.do.includes('run')) { S.runRead = { at: d.at, runs: Array.isArray(d.runs) ? d.runs : [], err: d.runErr || null }; S.runReview = true; S.pickNote = (S.pickNote || '') + (d.runs ? ' Run: ' + (d.runs.length ? d.runs.map(r => r.days.length + ' dias').join(', ') : 'nenhuma run Classic') + '.' : ' Run: não deu (' + (d.runErr || '?') + ').'); delete d.runs; }
    const gotRanks = d && Array.isArray(d.accs) && (!Array.isArray(d.do) || d.do.includes('ranks') || d.do.includes('lu'));
    if (d && !gotRanks) setTimeout(() => toast('Lido no Top Shot.' + (S.pxNew != null ? ' Preços de ' + S.pxNew + ' jogadores' + (S.pxMissN ? ' (' + S.pxMissN + ' não encontrados)' : '') + '.' : '') + (S.edNew ? (S.edNew.err ? ' Cartas: ' + S.edNew.err + '.' : ' Raridade e ASP das cartas de ' + S.edNew.n + ' jogadores.') : '') + (S.pickNote || '')), 300);
    if (gotRanks) { const luN = (d.days || []).reduce((t, x) => t + Object.values(x.accs || {}).filter(a => a.lu && a.lu.length).length, 0), luD = (d.days || []).length; const old = groupRanks(); d.days = mergeRankDays((old && old.run && d.run && old.run.id === d.run.id ? old.days : null) || [], d.days || []); S.ranksMine = d; try { localStorage.setItem('fb-ranks', JSON.stringify(d)); } catch (e) {} setTimeout(() => toast('Lugares atualizados: ' + d.accs.filter(x => x.found).length + ' contas na classificação do Top Shot.' + (Array.isArray(d.do) && d.do.includes('lu') ? ' Lineups: ' + luN + ' em ' + plural(luD, 'dia', 'dias') + '.' : '') + (S.pxNew != null ? ' Preços de ' + S.pxNew + ' jogadores' + (S.pxMissN ? ' (' + S.pxMissN + ' não encontrados no Top Shot)' : '') + '.' : '') + (S.edNew ? (S.edNew.err ? ' Cartas: ' + S.edNew.err + '.' : ' Raridade e ASP das cartas de ' + S.edNew.n + ' jogadores.') : '') + (S.pickNote || '')), 300); S.lastSummary = ''; }
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
    if (!fixes.length && nNone === changed) toast(nNone === 1 ? 'Um dia sem lineup no Top Shot: fica sem jogadores e os usos voltam.' : nNone + ' dias sem lineup no Top Shot: ficam sem jogadores e os usos voltam.');
    else if (!fixes.length) toast(nTs === changed ? (changed === 1 ? 'Um dia acertado pelo lineup que levaste (Top Shot).' : changed + ' dias acertados pelos lineups que levaste (Top Shot).') : changed === 1 ? 'Um resultado lido da blockchain.' : changed + ' resultados lidos da blockchain.');
  }
}

// "O lineup que levaste não era o da app": dias acertados pelo lineup lido no Top Shot (quem estava na app e quem
// levaste mesmo); os usos já foram acertados
function luFixShow() {
  const F = S.luFix; if (!F || !F.length) return;
  if (!$('sheet').hidden) { setTimeout(luFixShow, 2000); return; }
  S.luFix = null;
  const multi = accounts().length > 1;
  const who = (id, k) => '<span class="op-p ' + k + '">' + face(id, 'sm') + '<span class="op-t"><span class="op-l">' + (k === 'op-out' ? 'Na app' : 'Levaste') + '</span><span class="op-n">' + esc(nameOf(id)) + '</span></span></span>';
  const card = f => {
    const outs = f.old.filter(id => !f.now.includes(id)), ins = f.now.filter(id => !f.old.includes(id)), n = Math.max(outs.length, ins.length);
    return '<div class="card op-card"><div class="list-head"><h2>Dia ' + dayNo(f.date) + (multi ? ' · ' + esc(accLabel(f.acc)) : '') + '</h2><span class="small muted">' + dWeek(f.date) + ', ' + dShort(f.date) + '</span></div><ul class="list">' +
      Array.from({ length: n }, (_, i) => '<li class="op-pair">' + (outs[i] ? who(outs[i], 'op-out') : '<span></span>') + '<span class="op-arrow" aria-hidden="true">→</span>' + (ins[i] ? who(ins[i], 'op-in') : '<span></span>') + '</li>').join('') + '</ul></div>';
  };
  openSheet('<h3>Lineups acertados</h3><div class="small muted">Os lineups que levaste no Top Shot não eram os que estavam na app. A app passou a usar os que levaste e acertou os usos desses jogadores.</div>' +
    F.slice().sort((x, y) => x.date.localeCompare(y.date)).map(card).join('') + '<button class="btn primary" type="button" data-action="close-sheet">OK</button>');
}
// ---------- contas (principal + smurf) ----------
const smurfList = () => { const x = (S.profile || {}).smurfs; return Array.isArray(x) ? x.filter(a => a && a.id) : []; };
const groupMode = () => smurfList().length > 0;
function accounts() {
  const me = S.profile || {};
  return [{ id: 'main', label: 'Principal', nick: me.topshot_username, flow: me.flow_address }]
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
  }).catch(e => toast('Não guardou: ' + errText(e)));
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
      else toast('Lineup de hoje atualizado: ' + diffs.map(x => (diffs.length > 1 || accounts().length > 1 ? accLabel(x.k) + ' ' : '') + pct(x.P0) + ' → ' + pct(x.P1)).join(', ') + ' de vitória hoje.');
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
const HOLD_WHY = { fora: 'fora no relatório', semjogo: 'sem jogo', semusos: 'sem usos', '': 'deixou de estar disponível' };
const holdWhyTxt = why => (why || []).map(w => w === 'odds' ? 'odds novas' : w === 'inj' ? 'relatório de lesões' : '').filter(Boolean).join(' e ');
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
  const t = e.k === 'upd' ? 'Atualizado às ' + hm(e.t) + (pt ? ': hoje ' + pt : '') : e.k === 'keep' ? 'Mantido às ' + hm(e.t) + (pt ? ': a troca dava ' + pt : '') : e.k === 'out' ? 'Trocado às ' + hm(e.t) + ': ' + e.outs.map(id => esc(lastName(id))).join(', ') + ' ' + (HOLD_WHY[(e.why || [])[0]] || 'não joga') : e.k === 'mine' ? 'Mudado por ti às ' + hm(e.t) : 'Lineup do dia desde as ' + hm(e.t);
  return '<button class="row small hold-line" type="button" data-action="hold-hist" data-date="' + date + '"><span>' + icoClock + ' ' + t + '</span><span class="muted">Histórico ›</span></button>';
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
    const head = e.k === 'upd' ? '<span class="pill ok">Atualizado</span>' + (pt ? ' <b class="up">' + pt + '</b> hoje' : '') : e.k === 'keep' ? '<span class="pill mute">Mantido</span> <span class="muted">' + (pt ? 'a troca dava ' + pt + ' hoje' : 'a troca não compensava') + '</span>'
      : e.k === 'out' ? '<span class="pill duv">Trocado</span> <span class="muted">' + e.outs.map((id, k) => esc(lastName(id)) + ' ' + (HOLD_WHY[(e.why || [])[k]] || 'não joga')).join(', ') + '</span>'
      : e.k === 'mine' ? '<span class="pill mute">Mudado por ti</span>' + (pt ? ' <span class="muted">' + pt + ' hoje</span>' : '') : '<span class="pill mute">Lineup do dia</span>' + (e.P1 != null ? ' <span class="muted">' + pct(e.P1) + ' hoje</span>' : '');
    const sub = [e.k === 'upd' || e.k === 'keep' ? holdWhyTxt(e.why) ? 'Com ' + holdWhyTxt(e.why) : '' : '', e.g != null && (e.k === 'upd' || e.k === 'keep') ? 'run +' + gainTxt(e.g) + ' (troca a partir de ' + gainTxt(HOLD_MIN) + ')' : ''].filter(Boolean).join(' · ');
    const o = e.outs || [], n = e.ins || [];
    const body = e.k === 'start' ? '<div class="hh-ids">' + mini(e.ids || [], '') + '</div>' : '<div class="hh-pairs">' + Array.from({ length: Math.max(o.length, n.length) }, (_, k) => '<div class="hh-pair">' + (o[k] ? mini([o[k]], 'op-out') : '<span></span>') + '<span class="op-arrow" aria-hidden="true">→</span>' + (n[k] ? mini([n[k]], 'op-in') : '<span></span>') + '</div>').join('') + '</div>';
    const u = open && holdUndo(acc, date, e);
    const btn = u ? '<button class="btn small hh-btn" type="button" data-action="hold-undo" data-acc="' + esc(acc) + '" data-date="' + date + '" data-i="' + i + '">' + (u.back ? 'Reverter' : 'Fazer esta troca') + '</button>' : '';
    return '<li class="hh-ev"><span class="hh-t num">' + hm(e.t) + '</span><div style="min-width:0"><div>' + head + '</div>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + body + btn + '</div></li>';
  };
  const cards = accounts().map(a => { const H = ((planOf(a.id).lhist || {})[date]) || []; if (!H.length) return '';
    return '<div class="card">' + (multi ? '<div class="list-head"><h2>' + esc(accLabel(a.id)) + '</h2></div>' : '') + '<ul class="list hh-list">' + H.map((e, i) => [e, i]).reverse().map(([e, i]) => ev(a.id, e, i)).join('') + '</ul></div>'; }).join('');
  openSheet('<h3>Histórico do lineup</h3><div class="small muted">Dia ' + dayNo(date) + ' · ' + dWeek(date) + ', ' + dShort(date) + '. O lineup do dia só muda sozinho se alguém não puder jogar ou se houver um claramente melhor (pelo menos +' + gainTxt(HOLD_MIN) + ' de vitórias esperadas na run).</div>' +
    (cards || '<div class="small muted">Ainda nada neste dia.</div>'));
}
// "Reverter" / "Fazer esta troca": mostra como fica (quem sai e entra, a vitória de hoje) antes de confirmar
function holdUndoSheet(acc, date, i) {
  const e = (((planOf(acc).lhist || {})[date]) || [])[+i], u = e && holdUndo(acc, date, e); if (!u) return;
  const R = S.multi ? S.multi.byKey[acc] : S.result, md = R && R.model.days.find(x => x.day.date === date); if (!md) return;
  const cur = planOf(acc).hold.ids, p0 = luP(R, md, cur), p1 = luP(R, md, u.target);
  const bad = u.ins.filter(id => { const pi = R.model.pIndex.get(id); return pi == null || !md.eligSet.has(pi); });
  const who = (id, k) => '<span class="op-p ' + k + '">' + face(id, 'sm') + '<span class="op-t"><span class="op-l">' + (k === 'op-out' ? 'Sai' : 'Entra') + '</span><span class="op-n">' + esc(nameOf(id)) + '</span></span></span>';
  const n = Math.max(u.outs.length, u.ins.length);
  openSheet('<h3>' + (u.back ? 'Reverter a troca' : 'Fazer esta troca') + '</h3><div class="small muted">' + (accounts().length > 1 ? esc(accLabel(acc)) + ' · ' : '') + 'Dia ' + dayNo(date) + '. Assim fica o lineup de hoje:</div>' +
    '<div class="card op-card"><ul class="list">' + Array.from({ length: n }, (_, k) => '<li class="op-pair">' + (u.outs[k] ? who(u.outs[k], 'op-out') : '<span></span>') + '<span class="op-arrow" aria-hidden="true">→</span>' + (u.ins[k] ? who(u.ins[k], 'op-in') : '<span></span>') + '</li>').join('') + '</ul>' +
      '<div class="kv lu-kv hu-kv"><div><div class="label">Vitória hoje</div><div class="v num">' + pct(p0) + ' → <span class="' + (p1 >= p0 ? 'up' : 'down') + '">' + pct(p1) + '</span></div></div></div>' +
      '<div class="hh-ids hu-ids">' + u.target.map(id => '<span class="hh-p">' + face(id, 'sm') + '<span>' + esc(lastName(id)) + '</span></span>').join('') + '</div></div>' +
    (bad.length ? '<div class="note warn">' + bad.map(id => '<b>' + esc(nameOf(id)) + '</b>').join(', ') + ' não pode jogar hoje (' + bad.map(id => HOLD_WHY[holdWhy(acc, md, id)] || 'não joga').join(', ') + ').</div>'
      : '<div class="small muted">O lineup fica fixado (cadeado), para o plano não o voltar a trocar sozinho. Tiras o cadeado em Mudar o lineup.</div>') +
    '<div class="btns">' + (bad.length ? '' : '<button class="btn primary" type="button" data-action="hold-undo-ok" data-acc="' + esc(acc) + '" data-date="' + date + '" data-i="' + i + '">Confirmar</button>') + '<button class="btn" type="button" data-action="hold-hist" data-date="' + date + '">Voltar ao histórico</button></div>');
}
function holdUndoOk(acc, date, i) {
  const e = (((planOf(acc).lhist || {})[date]) || [])[+i], u = e && holdUndo(acc, date, e); if (!u) return;
  if (acc !== S.acc) { S.acc = acc; if (S.multi && S.multi.byKey[acc]) S.result = S.multi.byKey[acc]; }
  const dr = planPatch({ locks: { [date]: u.target.slice() }, bans: { [date]: (((curPlan().bans || {})[date]) || []).filter(x => !u.target.includes(x)) } });
  closeSheet(); toast((u.back ? 'Troca revertida' : 'Troca feita') + ': lineup de hoje fixado.' + capMsg(dr));
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
  const who = (id, k) => '<span class="op-p ' + k + '">' + face(id, 'sm') + '<span class="op-t"><span class="op-l">' + (k === 'op-out' ? 'Sai' : 'Entra') + '</span><span class="op-n">' + esc(nameOf(id)) + '</span></span></span>';
  const pairs = c => { const n = Math.max(c.outs.length, c.ins.length); return Array.from({ length: n }, (_, i) => '<li class="op-pair">' + (c.outs[i] ? who(c.outs[i], 'op-out') : '<span></span>') + '<span class="op-arrow" aria-hidden="true">→</span>' + (c.ins[i] ? who(c.ins[i], 'op-in') : '<span></span>') + '</li>').join(''); };
  const outTxt = P.out ? P.ch.map(c => c.outs.map((id, i) => '<b>' + esc(nameOf(id)) + '</b> ' + (HOLD_WHY[(c.why || [])[i]] || 'não joga')).join(', ')).join('; ') : '';
  const sub = P.out ? outTxt + ': entrou outro no lugar. O resto do lineup ficou igual.' : P.g != null ? (holdWhyTxt(P.why) ? 'Com ' + holdWhyTxt(P.why) + ', há' : 'Há') + ' um lineup melhor e o plano trocou para ele (vitórias esperadas na run <b class="up">+' + gainTxt(P.g) + '</b>). Se preferes o de antes, mantém-no.' : 'Chegaram as odds de hoje e o plano trocou jogadores. Se preferes o lineup de antes, mantém-no.';
  openSheet('<h3>O lineup de hoje mudou</h3><div class="small muted">' + sub + '</div>' +
    P.ch.map((c, i) => '<div class="card op-card">' + (multi ? '<div class="list-head"><h2>' + esc(accLabel(c.acc)) + '</h2></div>' : '') + '<ul class="list">' + pairs(c) + '</ul>' + (c.P0 != null && c.P1 != null ? '<div class="small muted op-pp">Vitória hoje ' + pct(c.P0) + ' → <b class="' + (c.P1 >= c.P0 ? 'up' : 'down') + '">' + pct(c.P1) + '</b></div>' : '') +
      (P.out ? '' : '<div class="op-btns" id="opb-' + i + '"><button class="btn" type="button" data-action="odds-keep" data-k="old" data-i="' + i + '">Manter o lineup</button></div>') + '</div>').join('') +
    '<div class="op-foot"><button class="btn quiet" type="button" data-action="odds-see" data-date="' + P.date + '">Ver o lineup</button>' + (P.g != null || P.out ? '<button class="btn quiet" type="button" data-action="hold-hist" data-date="' + P.date + '">Histórico</button>' : '') + '</div>' + (P.out ? '<button class="btn primary" type="button" data-action="close-sheet">OK</button>' : ''));
}
// fixa o lineup escolhido (o novo do plano ou o de antes das odds) nessa conta
function oddsKeep(i, which) {
  const P = S.oddsPopLast, c = P && P.ch[i]; if (!c) return;
  if (c.acc !== S.acc) { S.acc = c.acc; if (S.multi && S.multi.byKey[c.acc]) S.result = S.multi.byKey[c.acc]; }
  const { md } = dayInfo(P.date), ids = (which === 'old' ? c.old : c.now).slice(0, (md && md.size) || 5);
  const dr = planPatch({ locks: { [P.date]: ids }, bans: { [P.date]: (((curPlan().bans || {})[P.date]) || []).filter(x => !ids.includes(x)) } });
  const box = $('opb-' + i); if (box) box.innerHTML = '<span class="op-done">' + (which === 'old' ? 'Ficou o lineup anterior ✓' : 'Ficou o lineup novo ✓') + '</span>';
  toast((which === 'old' ? 'Lineup anterior fixado.' : 'Lineup novo fixado.') + capMsg(dr));
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
  // durante os jogos o lineup levado não muda sozinho: quem ainda não jogou fica (só sai se não puder jogar); trocas
  // melhores só nas Sugestões para hoje (pedido do João)
  if (!raw) Object.entries(pa.live || {}).forEach(([d, l]) => { if (l && l.active && Array.isArray(l.lineup) && l.lineup.length && !((pa.played || {})[d] || {}).done) pa = Object.assign({}, pa, { keep: Object.assign({}, pa.keep || {}, { [d]: l.lineup.slice() }) }); });
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
  } catch (e) { console.error(e); S.calcError = 'Erro no cálculo: ' + (e && e.message); }
}
const mainResult = () => S.multi ? S.multi.byKey.main : S.result;
const curRun = () => S.runs.find(r => r.id === S.runId) || null;
const nextDay = () => { const r = S.result; return r && r.model.days.length ? r.model.days[0].day : null; };
const liveDoc = date => ((curPlan().live || {})[date]) || null;
const liveOn = date => { const l = liveDoc(date); return !!(l && l.active); };
function view() { const r = S.result; return r ? r.normal : null; }
function opp(team, day) {
  const g = FB.gameOf(day, team);
  if (!g) return 'sem jogo';
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
  if (pick && S.jmode === 'pro') { $('runName').innerHTML = modeTitle(run); $('runMeta').textContent = 'Ensaio na ' + (run ? run.name.replace(/ · .*$/, '') : 'run'); return; }
  if (!run) { if (pick) $('runName').innerHTML = modeTitle(run); else $('runName').textContent = 'Fastbreak'; $('runMeta').textContent = S.loading ? 'A carregar…' : 'Sem run'; return; }
  if (pick) $('runName').innerHTML = modeTitle(run); else $('runName').textContent = run.name;
  const bits = [];
  if (run.fictitious) bits.push('<span class="chip">Teste</span>');
  // uma linha só: em que dia vai e o registo (as datas estão na faixa da Jornada)
  // com smurfs: o registo e as bolinhas da conta com mais vitórias (em empate, a principal); depois de escolheres uma conta, os dessa
  if (r) { const nd = nextDay(), bk = S.tab === 'hoje' && S.accPicked && S.multi && S.multi.byKey[S.acc] ? S.acc : bestAcc(), m = S.multi ? S.multi.byKey[bk] : r; bits.push('<span>' + (nd ? 'Dia ' + (nd.idx + 1) + ' de ' + S.days.length : 'Terminada') + '</span>', runDots(nd, bk) + recChip(m.wins, m.losses) + (S.multi && accounts().length > 1 ? '<span class="rec-acc">' + esc(accLabel(bk)) + '</span>' : '')); }
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
const recordTxt = (w, l) => (w + l === 0 ? 'ainda sem resultados' : plural(w, 'vitória', 'vitórias') + ', ' + plural(l, 'derrota', 'derrotas'));
// probabilidade em palavras
const likely = p => (p >= 0.95 ? 'Quase garantido' : p >= 0.75 ? 'Muito provável' : p >= 0.55 ? 'Provável' : p >= 0.4 ? 'Meio-meio' : p >= 0.2 ? 'Possível' : p >= 0.05 ? 'Difícil' : 'Muito difícil');
// aro de cesto que enche com a probabilidade (um por patamar de prémio)
function aro(p, center, size, extra) {
  const v = Math.max(0, Math.min(1, +p || 0));
  return '<span class="aro t-' + tone(v) + (size < 40 ? ' sm' : '') + '" style="--p:' + (v * 100).toFixed(1) + ';--s:' + size + 'px" role="img" aria-label="' + esc(center) + ' vitórias: ' + pct(v) + '" title="' + esc(center) + ' vitórias: ' + pct(v) + (extra ? ' · ' + esc(extra) : '') + '"><b>' + esc(center) + '</b></span>';
}
const miniAros = (prizes, probs) => '<span class="aros-mini">' + prizes.map((p, i) => aro(probs[i], p.wins, 30)).join('') + '</span>';
function empty(title, text, btn) { return '<div class="card empty"><h2>' + esc(title) + '</h2><p class="muted small" style="margin:0;max-width:44ch">' + esc(text) + '</p>' + (btn || '') + '</div>'; }
function guard(el, needRoster) {
  if (S.loading) { el.innerHTML = empty('A carregar…', 'A ler a run e o teu plantel.'); return false; }
  if (!S.runId) {
    el.innerHTML = S.role === 'admin' ? empty('Ainda não há runs', 'As runs chegam sozinhas da blockchain quando começam.')
      : empty('Ainda não há runs', 'O admin do grupo ainda não criou a run. Volta mais tarde.');
    return false;
  }
  if (S.calcError) { el.innerHTML = empty('Erro', S.calcError); return false; }
  if (needRoster && !Object.keys(S.mine.roster || {}).length) {
    el.innerHTML = empty('Falta o teu plantel', 'Junta os teus jogadores e o plano aparece.', '<button class="btn primary" type="button" data-action="goto" data-tab="plantel">Montar plantel</button>');
    return false;
  }
  return !!S.result;
}

// ---- valores por objetivo (num dia de combinação há um por estatística: 3PM e 3PA, AST e STL…) ----
// ---- ao vivo (pistas): por estatística, o que cada jogador já fez, até onde deve ir e o que se esperava antes do jogo ----
function liveLine(md, pi, k) {
  const info = (md.info[pi] || [])[k] || {}, st = info.liveState, known = +info.known || 0, exp = +info.mu || 0;
  const end = st === 'fim' ? known : st === 'jogo' ? known + (+info.muLeft || 0) : exp;
  return { st, known, exp, end, started: st === 'fim' || st === 'jogo' || st === 'jogo?' };
}
// régua de cada estatística: a mesma para o lineup todo (dá para comparar os jogadores)
function liveScale(md, ids, r) {
  return md.objs.map((o, k) => Math.max(1, ...ids.map(id => { const pi = r.model.pIndex.get(id); if (pi == null) return 0; const x = liveLine(md, pi, k); return Math.max(x.known, x.end, x.exp); })) * 1.08);
}
const lvNum = v => (Math.abs(v) >= 10 || Number.isInteger(v) ? f0(v) : f1(v));
function liveTrack(x, mx) {
  const pc = v => Math.max(0, Math.min(100, v / mx * 100)).toFixed(1), e = '<em style="left:' + pc(x.exp) + '%"></em>';
  if (x.st === 'fim') return '<div class="lv-trk"><i class="end" style="width:' + pc(x.known) + '%"></i>' + e + '</div>';
  if (!x.started) return '<div class="lv-trk"><u class="pre" style="left:0;width:' + pc(x.end) + '%"></u>' + e + '</div>';
  return '<div class="lv-trk"><i style="width:' + pc(x.known) + '%"></i><u style="left:' + pc(x.known) + '%;width:' + (+pc(x.end) - +pc(x.known)).toFixed(1) + '%"></u>' + e + '</div>';
}
// linha de um jogador ao vivo: nome e estado; uma pista por estatística; à direita o que já fez
function liveRow(r, md, nd, id, scale, extra) {
  const pi = r.model.pIndex.get(id), p = r.model.players[pi], xs = md.objs.map((o, k) => liveLine(md, pi, k)), x0 = xs[0] || {};
  const st = x0.st, info = md.info[pi][0] || {};
  const chip = st === 'fim' ? '<span class="lv-chip end">Terminado</span>' : st === 'jogo' ? '<span class="lv-chip on"><i></i>' + (info.q ? 'Q' + info.q : 'Em jogo') + '</span>' : st === 'jogo?' ? '<span class="lv-chip on"><i></i>Em jogo</span>' : '<span class="lv-chip pre">' + esc(tipOf(nd, id) || '–') + '</span>';
  const many = md.objs.length > 1;
  // para onde vai (só a jogar): verde se acima do que se esperava, vermelho se abaixo
  const tone = x => (x.end >= x.exp * 1.1 ? ' up' : x.end <= x.exp * 0.9 ? ' down' : '');
  const sub = st === 'jogo' ? '≈ ' + md.objs.map((o, k) => '<span class="' + tone(xs[k]).trim() + '">' + lvNum(xs[k].end) + (many ? ' ' + esc(statShort(o.stat)) : '') + '</span>').join(' · ')
    : st === 'fim' ? 'previsto ' + md.objs.map((o, k) => lvNum(xs[k].exp) + (many ? ' ' + esc(statShort(o.stat)) : '')).join(' · ')
    : teamMini(p.team) + esc(p.team) + ' ' + esc(opp(p.team, nd).replace(/ · \d\d:\d\d$/, '')); // a hora já está no selo
  const tracks = md.objs.map((o, k) => '<div class="lv-tk' + (many ? ' many' : '') + '">' + (many ? '<span class="lb">' + esc(statShort(o.stat)) + '</span>' : '') + liveTrack(xs[k], scale[k]) + (many ? '<b class="num' + (xs[k].started ? '' : ' dim') + '">' + (xs[k].started ? lvNum(xs[k].known) : lvNum(xs[k].end)) + '</b>' : '') + '</div>').join('');
  const right = many ? '' : '<div class="pv"><div class="v num' + (x0.started ? '' : ' dim') + '">' + (x0.started ? lvNum(x0.known) : lvNum(x0.end)) + '</div><div class="u">' + (x0.started ? esc(statShort(md.objs[0].stat)) : 'previsto') + '</div></div>';
  const gid = x0.started ? ((FB.gameOf(nd, p.team) || [])[3] || '') : '';
  return '<li class="lv-li' + (x0.started ? '' : ' lv-pre') + '"><button class="row lv-row" type="button" ' + (/^espn:/.test(gid) ? 'data-action="game-box" data-gid="' + esc(gid) + '"' : 'data-action="player"') + ' data-id="' + esc(id) + '" data-date="' + nd.date + '"><span class="who">' + face(id) + '<div style="min-width:0;flex:1"><div class="pn"><span class="nm">' + esc(p.name) + '</span>' + chip + (extra || '') + '</div><div class="ps">' + sub + '</div>' + tracks + '</div></span>' + right + '</button></li>';
}
// placar ao vivo do dia: por estatística, o feito em grande, a barra (feito + previsto) com o alvo e o que falta
function liveBoard(d, part) {
  const many = d.totals.length > 1, pc = (v, mx) => Math.max(0, Math.min(100, v / mx * 100)).toFixed(1);
  const big = x => '<div class="lv-big"><b class="num">' + f0(x.known) + '</b><span>/ ' + x.target + '</span></div>';
  const sub = x => { const left = Math.max(0, x.target - x.known), P = FB.probAtLeast(x.mu, x.sd * x.sd, x.target);
    // com duas estatísticas há pouco espaço: só o fim previsto e a hipótese dessa estatística
    return '<div class="lv-sub">' + (many ? (left > 0 ? '' : '<b class="up">alvo feito</b> · ') + 'fim ≈ <b>' + f0(x.mu) + '</b> · ' + pct(P) : (left > 0 ? 'faltam <b>' + f0(left) + '</b> · ' : '<b class="up">alvo feito</b> · ') + 'fim previsto <b>' + f0(x.mu) + '</b>') + '</div>'; };
  const bar = x => { const mx = Math.max(x.target * 1.15, x.mu * 1.05, x.known, 1);
    return '<div class="lv-bar" aria-hidden="true"><i style="width:' + pc(x.known, mx) + '%"></i><u style="left:' + pc(x.known, mx) + '%;width:' + Math.max(0, pc(x.mu, mx) - pc(x.known, mx)).toFixed(1) + '%"></u><em style="left:' + pc(x.target, mx) + '%"></em><small style="left:' + pc(x.target, mx) + '%">' + x.target + '</small></div>'; };
  // uma estatística: o número e o que falta ao lado do anel (part 'top'); a barra a toda a largura por baixo ('bar')
  if (!many) { const x = d.totals[0]; return part === 'top' ? big(x) + sub(x) : bar(x); }
  return '<div class="lv-board many">' + d.totals.map(x => '<div class="lv-st"><div class="lv-lab">' + esc(statShort(x.stat)) + '</div>' + big(x) + bar(x) + sub(x) + '</div>').join('') + '</div>';
}
// ---- o melhor lineup do dia (com o que cada um já fez): com os teus jogadores e na NBA toda ----
// pelas fichas da ESPN de todos os jogos do dia (relidas de 2 em 2 minutos enquanto se vê). Uma estatística: os 5 que
// mais fizeram; duas ou mais: os 5 que deixam a pior delas mais perto (ou mais acima) do alvo
S.topAt = {};
function topLoad(date) {
  const day = S.days.find(d => d.date === date), B = S.box[date]; if (!day || (B && B.busy)) return;
  if (Date.now() - (S.topAt[date] || 0) < 110e3) return;
  S.topAt[date] = Date.now();
  const teams = new Set(); (day.games || []).forEach(g => { teams.add(g[0]); teams.add(g[1]); });
  boxLoad(date, teams).then(() => { if (S.tab === 'hoje') renderHoje(); });
}
function topBest(cands, T) {
  const sc = c => c.vals.reduce((t, v, k) => t + v / T[k], 0);
  const top = cands.slice().sort((a, b) => sc(b) - sc(a));
  if (T.length === 1 || top.length <= 5) return top.slice(0, 5);
  // várias estatísticas: todas as combinações de 5 entre os 18 melhores no conjunto (8568)
  const pool = top.slice(0, 18); let best = null, bv = -Infinity;
  const rec = (st, cur) => {
    if (cur.length === 5) { const r = T.map((t, k) => cur.reduce((u, c) => u + c.vals[k], 0) / t), v = Math.min(...r) + 0.01 * r.reduce((x, y) => x + y, 0); if (v > bv) { bv = v; best = cur.slice(); } return; }
    for (let i = st; i <= pool.length - (5 - cur.length); i++) { cur.push(pool[i]); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return best.sort((a, b) => sc(b) - sc(a));
}
function topLineupCard(r, day, mine, live) {
  const objs = (day.objectives || []).filter(o => o && o.stat && +o.target > 0); if (!objs.length || !r) return '';
  topLoad(day.date);
  const title = live ? 'Os melhores até agora' : 'Os melhores do dia';
  const B = S.box[day.date], lines = B ? Object.entries(B.lines || {}) : [];
  if (!lines.length) return '<div class="card top-lu"><div class="list-head"><h2>' + title + '</h2></div><div class="pad small muted">' + (B && !B.busy && B.err ? 'A ESPN não respondeu. Tenta daqui a pouco.' : 'A ler as fichas dos jogos…') + '</div></div>';
  const T = objs.map(o => +o.target), many = objs.length > 1;
  const val = (v, id) => objs.map(o => Math.max(0, +FB.statValue(v, o.stat, id ? pAvg(id) : null) || 0));
  const byNorm = new Map(); S.players.forEach(p => { if (p && p.name) byNorm.set(norm(p.name), p); });
  // os teus: o plantel desta conta (ao vivo, só os que ainda têm usos) que jogou nesse dia
  const ros = r.model.players.filter((p, i) => !live || r.model.uses[i] > 0 || mine.includes(p.id)).map(p => { const b = boxFor(day.date, p.id); return b ? { id: p.id, vals: val(b.v, p.id) } : null; }).filter(Boolean);
  const owned = new Set(r.model.players.map(p => p.id));
  const all = lines.map(([nm, ln]) => { const p = byNorm.get(nm), id = p ? String(canon(p.id)) : null; return { id, nm, t: ln.t, e: ln.e, vals: val(ln.v, id) }; });
  const myL = mine.map(id => { const b = boxFor(day.date, id); return { id, vals: b ? val(b.v, id) : T.map(() => 0), dnp: !b }; });
  const sums = l => T.map((t, k) => l.reduce((u, c) => u + c.vals[k], 0));
  const views = [['lu', 'O teu lineup', myL], ['mine', 'Com os teus', topBest(ros, T)], ['nba', 'Na NBA', topBest(all, T)]].filter(v => v[2].length);
  const cur = views.find(v => v[0] === S.topView) || views[views.length - 1];
  const nmOf = c => c.id ? nameOf(c.id) : c.nm.replace(/(^|[\s'-])\S/g, x => x.toUpperCase());
  const ava = c => c.id ? face(c.id, 'sm') : '<span class="face sm" style="--av:' + (TEAM_COLOR[c.t] || 'var(--muted)') + '" aria-hidden="true"><b>' + esc(initials(nmOf(c))) + '</b>' +
    (c.e ? '<img src="https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/' + encodeURIComponent(c.e) + '.png&w=96&h=70" width="96" height="70" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</span>';
  const tag = c => cur[0] !== 'lu' && mine.includes(c.id) ? '<span class="top-tag on">no lineup</span>' : cur[0] === 'nba' && owned.has(c.id) ? '<span class="top-tag">tens</span>' : '';
  const row = c => '<li class="row top-row">' + ava(c) + '<span class="top-nm"><b>' + esc(nmOf(c)) + '</b>' + tag(c) + '</span>' +
    '<span class="top-v">' + c.vals.map((v, k) => '<span><b class="num' + (c.dnp ? ' dim' : '') + '">' + lvNum(v) + '</b>' + (many ? '<small>' + esc(statShort(objs[k].stat)) + '</small>' : '') + '</span>').join('') + '</span></li>';
  // três totais lado a lado (o teu, o melhor com os teus, o melhor na NBA); o escolhido mostra os 5 por baixo
  const tile = ([k, lab, l]) => '<button type="button" class="top-tile' + (k === cur[0] ? ' on' : '') + '" data-action="top-view" data-v="' + k + '" aria-pressed="' + (k === cur[0]) + '"><span class="top-lab">' + lab + '</span><span class="top-tot">' +
    sums(l).map((v, k2) => '<span><b class="num ' + (v >= T[k2] ? 'c-ok' : live ? '' : 'c-no') + '">' + f0(v) + '</b>' + (many ? '<small>' + esc(statShort(objs[k2].stat)) + '</small>' : '') + '</span>').join('') + '</span></button>';
  return '<div class="card top-lu' + (many ? ' many' : '') + '"><div class="list-head"><h2>' + title + '</h2><span class="small muted">alvo ' + objs.map(o => f0(o.target) + ' ' + esc(statShort(o.stat))).join(' + ') + '</span></div>' +
    '<div class="top-tiles" style="--n:' + views.length + '">' + views.map(tile).join('') + '</div>' +
    '<ul class="list top-list">' + cur[2].map(row).join('') + '</ul>' + (live ? '<div class="pad small muted">Com o que cada um já fez; atualiza com os jogos.</div>' : '') + '</div>';
}
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
      '<div class="bar-cap">' + (live && t.known ? '<span>' + lbl + 'Feito <b class="num">' + f0(t.known) + '</b> · faltam <b class="num">' + f0(Math.max(0, t.target - t.known)) + '</b></span><span>final ≈ <b class="num">' + f1(t.mu) + '</b>' + (many ? ' · <b class="num">' + pct(pk) + '</b>' : '') + '</span>'
        : '<span>' + lbl + (many ? '' : 'Projeção ') + '<b class="num">' + f1(t.mu) + '</b> <span class="num">± ' + f1(t.sd) + '</span></span><span>alvo <b class="num">' + t.target + '</b>' + (many ? ' · <b class="num">' + pct(pk) + '</b>' : '') + '</span>') + '</div></div>';
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
  return '<div class="day-strip" role="group" aria-label="Dias da run">' + S.days.map((day, i) => {
    const p = pl[day.date], { md, d } = dayInfo(day.date), now = !!nd0 && nd0.date === day.date;
    let val = '–', cls = '', sr = '';
    if (p && p.done && (p.result === 'win' || p.result === 'loss')) {
      // dia jogado: caixa como as outras com um degradê verde ou vermelho por baixo e ✓ / ✕ no lugar da percentagem
      val = p.result === 'win' ? '✓' : '✕'; cls = p.result === 'win' ? ' win' : ' loss'; sr = '<span class="vh">' + (p.result === 'win' ? 'vitória' : 'derrota') + '</span>';
    }
    else if (md && d && !d.noObjective && d.lineup.length) { val = pct(d.P); cls = ' c-' + dTone(d.P); }
    else if (!md && !(p && p.noAuto) && lineupFor(S.acc, day.date)) val = '…'; // passou: à espera das estatísticas
    const inj = md && d ? lineupInjured(r, md, d.lineup).length : 0;
    return '<button type="button" class="ds' + cls + (now ? ' now' : '') + '" data-action="hd" data-date="' + day.date + '" aria-pressed="' + (day.date === sel) + '"><b class="num">' + (i + 1) + '</b><small>' + (now ? 'Hoje' : dWeek(day.date)) + '</small><span class="ds-v num">' + val + '</span>' + sr + (inj ? '<i class="ds-inj" title="Lesão no lineup"></i>' : '') + '</button>';
  }).join('') + '</div>';
}
async function shareLineup(date) {
  const r = S.result, v = view(), { md, d } = dayInfo(date); if (!r || !md || !d || !d.lineup.length) return;
  const day = md.day, objLine = (day.objectives || []).filter(x => x && x.stat).map(x => x.target + ' ' + statShort(x.stat)).join(' + ');
  const text = 'Fast Break · Dia ' + (day.idx + 1) + ' (' + dWeek(date) + ' ' + dShort(date) + ')\n' + objLine;
  toast('A preparar a imagem…');
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
  if (!blob) { try { await navigator.clipboard.writeText(text); } catch (e) {} toast('Não deu para fazer a imagem. O texto ficou copiado.'); return; }
  // a partilha precisa de um toque "fresco" (o iPhone recusa depois de esperar pelas fotos): mostra a imagem e o botão
  const file = new File([blob], 'lineup-dia-' + (day.idx + 1) + '.png', { type: 'image/png' }), url = URL.createObjectURL(blob);
  S.shareDoc = { file, text, url };
  openSheet('<h3>Partilhar o lineup</h3><div class="small muted" style="white-space:pre-line">' + esc(text) + '</div><img class="share-img" src="' + url + '" alt="Lineup do dia ' + (day.idx + 1) + '">' +
    '<button class="btn primary" type="button" data-action="share-go">' + icoShare + ' Partilhar</button>');
}
async function shareGo() {
  const D = S.shareDoc; if (!D) return;
  // o WhatsApp às vezes larga o texto quando vai com uma imagem: fica também copiado, para colar como legenda
  try { await navigator.clipboard.writeText(D.text); } catch (e) {}
  try { if (navigator.canShare && navigator.canShare({ files: [D.file] })) { await navigator.share({ files: [D.file], text: D.text, title: D.text.split('\n')[0] }); toast('Se o texto não aparecer no WhatsApp, cola-o: ficou copiado.'); return; } }
  catch (e) { if (e && e.name === 'AbortError') return; }
  // sem partilha de ficheiros (computador): descarrega a imagem e copia o texto
  const a = document.createElement('a'); a.href = D.url; a.download = D.file.name; document.body.appendChild(a); a.click(); a.remove();
  try { await navigator.clipboard.writeText(D.text); } catch (e) {}
  toast('Imagem descarregada e texto copiado: cola no WhatsApp.');
}
function jornadaNav(date, sub) {
  const accs = groupMode() ? accounts().map(a => {
    const R = S.multi && S.multi.byKey[a.id], dd = R && R.normal.days.find(x => x.date === date), pl = ((planOf(a.id).played || {})[date]) || null;
    const v = pl && pl.done ? (pl.result === 'win' ? '<b class="c-ok">✓</b>' : pl.result === 'loss' ? '<b class="c-no">✕</b>' : '') : dd ? (dd.lineup.length ? '<b class="c-' + dTone(dd.P) + '">' + pct(dd.P) + '</b>' : '<span class="muted">–</span>') : '';
    return '<button type="button" class="acc-chip" data-action="acc" data-acc="' + esc(a.id) + '" aria-pressed="' + (S.acc === a.id) + '">' + esc(a.label) + ' ' + v + '</button>';
  }).join('') : '';
  const links = SUBS.hoje().map(([k, l]) => '<button type="button" class="btn link small" data-action="sub" data-stab="hoje" data-sub="' + k + '" aria-pressed="' + (k === sub) + '">' + l + '</button>').join('<span aria-hidden="true">·</span>');
  // com várias contas: as contas numa linha (desliza de lado se não couberem) e os separadores por baixo
  return '<div class="j-nav' + (accs ? ' multi' : '') + '"><div class="j-accs" role="group" aria-label="Conta">' + accs + '</div><div class="j-links">' + links + '</div></div>';
}
// ---------- Jornada → modo: Classic (o plano da run) ou Historic (lendas simuladas, orçamento de Roster Points) ----------
S.jmode = (() => { try { return localStorage.getItem('fb-jmode') || 'classic'; } catch (e) { return 'classic'; } })();
const JMODES = [['classic', 'Classic'], ['historic', 'Historic'], ['pro', 'Pro']];
// o modo escolhe-se no título (na Jornada): "Run 1 · Classic ▾" — não ocupa uma linha por cima do lineup
function modeTitle(run) {
  const lab = { classic: 'Classic', historic: 'Historic', pro: 'Pro' }; // só o modo (o n.º da run não é preciso aqui)
  return '<span class="mode-pick">' + esc(lab[S.jmode] || lab.classic) + '<svg class="caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '<select id="jmode" aria-label="Modo da Jornada">' + JMODES.map(([k]) => '<option value="' + k + '"' + (S.jmode === k ? ' selected' : '') + '>' + esc(lab[k]) + '</option>').join('') + '</select></span>';
}
// ---- Pro ----
// Cada noite do Pro só conta cartas de certos sets (os grandes Rare e Legendary, as estreias, cartas com emblemas).
// Enquanto a Run 2 não abre: o que o grupo já tem de cada família. Quando abrir, o leitor traz as regras de cada
// noite e os preços das cartas que contam (sonda-pro.html para ver primeiro o formato).
const PRO_FAM = [
  { k: 'mgle', name: 'Metallic Gold LE', short: 'MGLE', re: /metallic gold/i },
  { k: 'holo', name: 'Holo Icon', short: 'Holo', re: /holo|top shot 50|cosmic/i },
  { k: 'debut', name: 'Estreias (Debut)', short: 'Debut', re: /debut/i },
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
    row('Carta que conta (a mais barata à venda)', esc(tierTxt(st.row[1])) + ' · ' + esc(st.row[2] || X.rule.name) + ' · ' + usdC(st.pr)) +
    (own ? row('A tua carta mais valiosa dele', esc(own.set) + (own.tier ? ' · ' + esc(own.tier) : '') + ' · ' + (own.asp ? 'ASP ' + usdC(own.asp) : 'sem ASP lido')) +
      (own.asp ? row('Diferença (se venderes a tua)', (st.pr - own.asp > 0 ? '+' : '−') + usdC(Math.abs(st.pr - own.asp))) : '') : row('A tua carta dele', 'não tens')) +
    (mine.length > 1 ? '<div class="small muted">Tens também: ' + mine.slice(1).map(c => esc(c.set) + (c.asp ? ' (ASP ' + usdC(c.asp) + ')' : '')).join(', ') + '</div>' : '') +
    row('Neste dia', pct(st.P0) + ' → <span class="c-good">' + pct(st.P) + '</span>' + (st.out ? ' · sai ' + esc(nameOf(st.out)) : '')) +
    (st.row && st.row[3] ? '<div class="small muted">ASP da carta que conta: ' + usdC(st.row[3]) + '</div>' : '') +
    '<div class="btns"><button class="btn primary" type="button" data-action="close-sheet">OK</button></div>');
}
const usdC = c => usd(c / 100); // preços do Top Shot vêm em cêntimos
function renderPro(el) {
  const fams = proOwned(), multi = accounts().length > 1, hasCol = !!(((S.profile || {}).collection || {}).items);
  const today = todayET(), days = S.days.map((d, i) => ({ d, i })).filter(x => x.d.date >= today);
  if (!days.some(x => x.d.date === S.proDay)) S.proDay = days.length ? days[0].d.date : null;
  const intro = '<div class="note info">Ensaio do Pro na run Classic: cada dia leva uma regra inventada (Metallic Gold LE, Holo Icon, estreias, à vez). Na Run 2 as regras vêm do Top Shot.</div>';
  const strip = days.length ? '<div class="day-strip" role="group" aria-label="Dias do ensaio">' + days.map(({ d, i }) => '<button type="button" class="ds" data-action="pro-day" data-date="' + d.date + '" aria-pressed="' + (d.date === S.proDay) + '"><b class="num">' + (i + 1) + '</b><small>' + dWeek(d.date) + '</small><span class="ds-v">' + esc(proRule(i).short) + '</span></button>').join('') + '</div>' : '';
  let dayHtml = '';
  if (S.proDay) {
    const X = S.result ? proDay(S.proDay) : null, P = groupPro(), dn = S.days.findIndex(d => d.date === S.proDay) + 1, rule = proRule(dn - 1);
    const objs = ((S.days[dn - 1] || {}).objectives || []).filter(o => o && o.stat).map(o => o.target + ' ' + statShort(o.stat)).join(' + ');
    const li = (id, right, sub) => '<li class="row pro-row">' + face(id, 'sm') + '<span class="pro-n"><b>' + esc(nameOf(id)) + '</b><small class="muted">' + sub + '</small></span>' + right + '</li>';
    const head = '<div class="card hero day-hero">' + COURT + '<div class="hero-top"><span class="eyebrow">Pro (ensaio) · Dia ' + dn + ' · ' + esc(objs) + '</span></div><div class="small muted" style="margin-top:4px">Só contam cartas de <b>' + esc(rule.name) + '</b></div>' +
      (X ? '<div class="score"><div class="gblocks"><div class="gb"><span class="gb-st">Com o que tens</span><span class="gb-n">' + pct(X.base.P) + '</span><span class="gb-t">' + plural(X.base.ids.length, 'carta que conta', 'cartas que contam') + ' a jogar</span></div></div>' + winRing(X.final.P, tone(X.final.P), pct(X.final.P), X.steps.length ? 'compras' : 'vitória') + '</div>' : '') + '</div>';
    if (!X) dayHtml = head + '<div class="note">Ainda a calcular o plano…</div>';
    else {
      const baseCard = '<div class="card"><div class="list-head"><h2>O teu lineup só com o que tens</h2><span class="small muted">' + pct(X.base.P) + '</span></div>' + (X.base.ids.length ? '<ul class="list">' + X.base.ids.map(id => { const c = proMyCards(id).find(x => rule.re.test(x.set)); return li(id, '', esc((S.players.get(id) || {}).team || '') + (c ? ' · ' + esc(c.set) + (c.asp ? ' · ASP ' + usdC(c.asp) : '') : '')); }).join('') + '</ul>' : '<div class="pad small muted">Não tens nenhuma carta de ' + esc(rule.name) + ' de quem joga neste dia.</div>') + (X.base.ids.length && X.base.ids.length < X.size ? '<div class="pad small muted">Faltam ' + (X.size - X.base.ids.length) + ' para um lineup completo.</div>' : '') + '</div>';
      let buyCard;
      if (!P) buyCard = '<div class="card"><div class="list-head"><h2>Para ficar competitivo</h2></div><div class="pad small muted">Faltam os preços: ' + (S.role === 'admin' ? '<button class="btn small" type="button" data-action="ranks-go" data-do="pro">Ler os preços do Pro</button>' : 'o admin lê-os em Ajustes → Admin → Ler no Top Shot → Preços do Pro.') + '</div></div>';
      else if (!X.steps.length) buyCard = '<div class="card"><div class="list-head"><h2>Para ficar competitivo</h2></div><div class="pad small muted">' + (X.base.P >= 0.5 ? 'Já estás bem com o que tens.' : 'Nenhuma carta à venda sobe a hipótese deste dia.') + '</div></div>';
      else {
        let tot = 0, reach = null;
        const rows = X.steps.map((st, k) => { tot += st.pr; if (reach == null && st.P >= 0.5) reach = { k: k + 1, tot };
          const own = proOwnValue(st.id);
          const sub = esc(st.row[1] ? st.row[1].charAt(0) + st.row[1].slice(1).toLowerCase() + ' · ' : '') + '<b>' + usdC(st.pr) + '</b>' + (own ? ' · tens ' + esc(own.set) + (own.asp ? ' (' + usdC(own.asp) + ')' : '') : '');
          return '<li><button class="row pro-row" type="button" data-action="pro-card" data-date="' + S.proDay + '" data-i="' + k + '">' + face(st.id, 'sm') + '<span class="pro-n"><b>' + esc(nameOf(st.id)) + '</b><small class="muted">' + sub + '</small></span><span class="pro-p num">' + pct(st.P) + '</span></button></li>'; }).join('');
        const sumTxt = reach ? 'Com <b>' + plural(reach.k, 'carta', 'cartas') + ' (' + usdC(reach.tot) + ')</b> passas de ' + pct(X.base.P) + ' para mais de 50%.' : 'Com estas ' + plural(X.steps.length, 'carta', 'cartas') + ' (' + usdC(tot) + ') chegas a ' + pct(X.final.P) + '.';
        buyCard = '<div class="card"><div class="list-head"><h2>Para ficar competitivo</h2><span class="small muted">preços de ' + esc(ago(P.at)) + '</span></div><div class="pad small">' + sumTxt + '</div><ul class="list">' + rows + '</ul></div>';
      }
      dayHtml = head + baseCard + buyCard;
    }
  }
  const famCard = x => {
    const list = [...x.by.values()].sort((a, b) => (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0) || String(nameOf(a.id)).localeCompare(nameOf(b.id)));
    return '<div class="card"><div class="list-head"><h2>' + esc(x.f.name) + '</h2><span class="small muted">' + plural(list.length, 'jogador', 'jogadores') + '</span></div>' +
      (list.length ? '<ul class="list">' + list.map(e => '<li class="row pro-row">' + face(e.id, 'sm') + '<span class="pro-n"><b>' + esc(nameOf(e.id)) + '</b><small class="muted">' + esc([...e.sets].join(', ')) + ((c => c && c.asp ? ' · ASP ' + usdC(c.asp) : '')(proMyCards(e.id).find(y => x.f.re.test(y.set)))) + (multi ? ' · ' + [...e.accs].map(a => esc(accLabel(a))).join(', ') : '') + '</small></span>' + (e.tier ? '<span class="pill">' + esc(e.tier) + (e.n > 1 ? ' ×' + e.n : '') + '</span>' : '') + '</li>').join('') + '</ul>' : '<div class="pad small muted">Nenhuma carta destes sets na tua coleção.</div>') + '</div>';
  };
  const owned = hasCol ? '<h2 class="sec-h">O que já tens para o Pro</h2>' + fams.map(famCard).join('') : empty('A tua coleção', 'Ainda não leste a tua coleção: em Jogadores → Coleção, para veres que cartas tens para o Pro.');
  const admin = S.role === 'admin' ? '<div class="card"><div class="pad small">Para preparar a Run 2: abre a <a href="sonda-pro.html" target="_blank" rel="noopener">sonda do Pro</a> no computador, corre-a no Top Shot e manda-me o resultado.</div></div>' : '';
  el.innerHTML = intro + strip + dayHtml + owned + admin;
}
// Historic: o dia que vem (para a linha debaixo do título)
function histMeta() {
  const H = groupHist(); if (!H) return 'Sem dados';
  const now = Date.now(), nd = H.days.find(d => d.players && d.players.length && Date.parse(d.locks) > now);
  return nd ? 'Dia ' + histDayNo(nd.id) + ' de ' + H.days.length : 'Terminada';
}
// o que o leitor do Top Shot trouxe do Historic (fica no meu resumo; o grupo usa o mais recente)
try { S.histMine = JSON.parse(localStorage.getItem('fb-hist') || 'null'); } catch (e) { S.histMine = null; }
function histTake(h) {
  S.histMine = h; S.histMemo = null; S.histCache = {};
  try { localStorage.setItem('fb-hist', JSON.stringify(h)); } catch (e) {}
  const nd = (h.days || []).find(d => d.players && d.players.length && Date.parse(d.locks) > Date.now());
  S.pickNote = (S.pickNote || '') + ' Historic: ' + plural((h.days || []).filter(d => d.lines && d.lines.length).length, 'dia jogado', 'dias jogados') + (nd ? ', ' + nd.players.length + ' lendas no dia ' + histDayNo(nd.id) : '') + '.';
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
const hRipTag = x => hRip(x) ? ' <span class="h-rip" title="Descansa em paz (' + hRip(x) + ')">🕊️ RIP</span>' : '';
// cara de uma lenda: iniciais na cor da equipa e a foto da NBA por cima (se houver)
const hFace = (x, cls) => '<span class="face' + (cls ? ' ' + cls : '') + '" style="--av:' + (TEAM_COLOR[hTeam(x.team)] || 'var(--muted)') + '" aria-hidden="true"><b>' + esc(initials(x.name)) + '</b><img src="https://cdn.nba.com/headshots/nba/latest/260x190/' + encodeURIComponent(x.id) + '.png" width="96" height="70" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>';
// escolhas guardadas neste aparelho: fixados e tirados de cada dia, e a melhor carta de cada lenda (desconto)
const hLoad = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
S.hsel = hLoad('fb-hsel', {}); S.hdisc = hLoad('fb-hdisc', {});
const hSave = () => { try { localStorage.setItem('fb-hsel', JSON.stringify(S.hsel)); localStorage.setItem('fb-hdisc', JSON.stringify(S.hdisc)); } catch (e) {} };
const H_DISC = [[0, 'Nenhuma'], [5, 'Common ou Fandom'], [10, 'Rare'], [15, 'Legendary'], [20, 'Ultimate']];
// desconto de colecionador no Historic pelo escalão da melhor carta da lenda (regras do Top Shot)
const H_TIER_PCT = { Common: 5, Fandom: 5, Rare: 10, 'Rare+': 10, Legendary: 15, Ultimate: 20 };
// pela carteira lida no site: a melhor carta de cada lenda numa conta → {nomeNormalizado: {pct, tier}}
function hWalletDisc(acc) {
  const col = (S.profile || {}).collection || {}, out = {};
  Object.entries(col.lg || {}).forEach(([k, L]) => ((L && L.c && L.c[acc]) || []).forEach(sk => { const t = setTier(col, sk), v = H_TIER_PCT[t] || 5; if (!out[k] || v > out[k].pct) out[k] = { pct: v, tier: t }; }));
  return out;
}
// descontos de uma conta para as lendas de um dia ({id: %}): os da carteira dessa conta; a carta marcada à mão numa
// lenda vale para todas as contas (se for maior)
function hDiscs(acc, rows) {
  const w = hWalletDisc(acc), d = {};
  rows.forEach(x => { const v = Math.max((w[norm(x.name)] || {}).pct || 0, +S.hdisc[x.id] || 0); if (v) d[x.id] = v; });
  return d;
}
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
  const accs = accounts(), dd = (H.days || []).find(d => d.id === dayId), prow = ((dd && dd.players) || []).map(p => ({ id: p[0], name: p[1] }));
  // cada conta com os descontos das cartas dela (carteira) e os marcados à mão
  const discs = accs.map(a => hDiscs(a.id, prow));
  const sel = S.hsel[dayId] || { fix: [], ban: [] }, key = [H.at, dayId, JSON.stringify(sel), JSON.stringify(discs), accs.length, nArch].join('|');
  // guardadas por dia (a faixa dos dias mostra a hipótese de cada dia aberto)
  const hc = S.histCache || (S.histCache = {}); if (hc[key]) return hc[key];
  if (Object.keys(hc).length > 40) S.histCache = {};
  const M0 = FB.histModel(histData(H), dayId, {}); if (!M0) return null;
  const Ms = discs.map(d => Object.assign({}, M0, { rows: M0.rows.map(x => Object.assign({}, x, { cost: x.rp * (1 - (+d[x.id] || 0) / 100) })) }));
  const cost = Ms.map(M => new Map(M.rows.map(x => [x.id, x.cost])));
  const costIn = (ids, k) => ids.reduce((t, id) => t + (cost[k].get(id) || 0), 0), fits = (e, k) => costIn(e.ids, k) <= M0.budget + 1e-9;
  // candidatas: as melhores equipas que cabem no orçamento de cada conta (com as cartas dela), juntas
  const seen = new Map(), done = new Set();
  discs.forEach((d, k) => { const js = JSON.stringify(d); if (done.has(js)) return; done.add(js); FB.histBest(Ms[k], 200, sel.fix, sel.ban).forEach(t => { const kk = t.ids.slice().sort().join(); if (!seen.has(kk)) seen.set(kk, t); }); });
  // a sugestão: a que mais vezes chega aos prémios (40 primeiros); desempata pelos pontos
  const ev = FB.histEval(M0, [...seen.values()], 3000).sort((p, q) => (q.p40 - p.p40) || (q.mean - p.mean));
  // com smurfs: uma equipa diferente por conta, que caiba no orçamento dela (juntas, mais vezes pelo menos uma chega aos prémios)
  const nAcc = accs.length, port = nAcc > 1 ? FB.histPortfolio(ev, nAcc, 2, fits).map((e, k) => Object.assign({}, e, { cost: costIn(e.ids, k) })) : null;
  const ev0 = nAcc > 1 ? ev : ev.filter(e => fits(e, 0)).map(e => Object.assign({}, e, { cost: costIn(e.ids, 0) }));
  return (S.histCache[key] = { key, M: Ms[0], Ms, ev: ev0, sel, port, fits, costIn, discs });
}
// faixa dos dias como a da run: nos abertos a hipótese de top 40 da equipa sugerida, nos que acabaram o lugar da conta
function histStrip(H, open, day, C) {
  const ai0 = S.hacc || 0, today = todayET(), acc = accounts()[ai0] || accounts()[0], ak = addrKey(accAddr(S.session.user.id, (acc || {}).id || 'main'));
  return '<div class="day-strip" role="group" aria-label="Dias do Historic">' + H.days.map(d => {
    const isOpen = open.includes(d), done = !!(d.lines && d.lines.length), c = isOpen ? (d === day && C ? C : histCalc(H, d.id)) : null;
    if (c) hSugSave(d.id, c);
    const t = c && c.ev.length ? (c.port && c.port.length ? c.port[Math.min(ai0, c.port.length - 1)] : c.ev[0]) : null, now = d === open[0];
    const me = done ? ((d.mine || {})[ak] || (S.role === 'admin' && ai0 === 0 ? (d.mine || {})._me : null)) : null, paid = me && me.rank && me.rank <= hLastPaid(d);
    const val = t ? pct(t.p40) : me && me.rank ? me.rank + '.º' : '–', cls = t ? ' c-' + tone(Math.min(1, t.p40 * 2)) : paid ? ' win' : me && me.rank ? ' loss' : '';
    return '<button type="button" class="ds' + cls + (now ? ' now' : '') + '" data-action="h-day" data-id="' + esc(d.id) + '" aria-pressed="' + (d === day) + '"' + (isOpen || done ? '' : ' disabled title="Ainda sem resultados"') + '><b class="num">' + histDayNo(d.id) + '</b><small>' + (now && histDate(d) === today ? 'Hoje' : dWeek(histDate(d))) + '</small><span class="ds-v num">' + val + '</span></button>';
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
  const accBar = accs.length > 1 ? '<div class="j-accs h-accs" role="group" aria-label="Contas">' + accs.map((a, i) => { const m = mineOf(a); return '<button type="button" class="acc-chip" data-action="h-acc" data-i="' + i + '" aria-pressed="' + (i === ai) + '">' + esc(a.label) + (m && m.rank ? ' <b class="num ' + (m.rank <= paidTo ? 'c-good' : '') + '">' + m.rank + '.º</b>' : '') + '</button>'; }).join('') + '</div>' : '';
  const cut = k => top[k - 1] != null ? f0(top[k - 1]) : '–';
  const cuts = top.length ? '1.º ' + cut(1) + ' · 10.º ' + cut(10) + ' · 40.º ' + cut(40) + ' pts' + (entries ? ' · ' + entries.toLocaleString('pt-PT') + ' equipas' : '') : '';
  const lu = me && me.lu && me.lu.length ? me.lu : null, myPts = me ? (me.score != null ? me.score : lu ? sum(lu) : null) : null;
  const ring = me && me.rank ? winRing(1, me.rank <= paidTo ? 'good' : 'bad', me.rank <= paidTo ? '✓' : '✕', me.rank <= paidTo ? 'prémio' : 'sem prémio') : winRing(0, 'mute', '–', noLu ? 'sem lineup' : 'por ler');
  const hero = '<div class="card hero day-hero past h-hero">' + COURT + '<div class="hero-top"><span class="eyebrow">Historic · Dia ' + histDayNo(day.id) + ' · ' + dWeek(histDate(day)) + ', ' + dShort(histDate(day)) + '</span><span class="small muted">acabou</span></div>' +
    '<div class="score"><div class="gblocks"><div class="gb"><span class="gb-st">' + (me ? 'Lugar' : 'Pontos') + '</span><span class="gb-n">' + (me && me.rank ? me.rank.toLocaleString('pt-PT') + '.º' : '–') + '</span><span class="gb-t">' + (myPts != null ? f1(myPts) + ' pts' : noLu ? 'não levaste lineup' : 'o admin lê em Ler no Top Shot → Historic') + '</span></div></div>' + ring + '</div>' +
    (cuts ? '<div class="small muted h-odds">' + esc(cuts) + '</div>' : '') +
    (lu ? '<ul class="list jc-list">' + lu.slice().sort((a, b) => ((pts.get(b) || {}).v || 0) - ((pts.get(a) || {}).v || 0)).map(id => line(id)).join('') + '</ul>' : '') + '</div>';
  // a sugestão da app nesse dia (guardada neste aparelho) e onde teria ficado
  const sg = S.hsug[day.id], sIds = sg && sg.t ? sg.t[Math.min(ai, sg.t.length - 1)] : null;
  const sTot = sIds ? sum(sIds) : null, sRank = sTot != null ? rankOfScore(sTot) : null;
  const sugCard = sIds ? '<div class="card"><div class="list-head"><h2>A sugestão da app</h2><span class="small muted"><b class="num">' + f1(sTot) + ' pts</b> · ' + (sRank ? 'teria ficado em ' + sRank + '.º' : 'fora dos 40 primeiros') + '</span></div><ul class="list">' + sIds.slice().sort((a, b) => ((pts.get(b) || {}).v || 0) - ((pts.get(a) || {}).v || 0)).map(id => line(id, lu && lu.includes(id) ? ' <span class="pill ok">levaste</span>' : '')).join('') + '</ul></div>' : '';
  // a melhor equipa possível (com os pontos que saíram e os Roster Points do dia, com as tuas cartas)
  const dsc = hDiscs(acc.id, [...pts.values()]);
  const rows = [...pts.values()].filter(x => rp.has(x.id)).map(x => ({ id: x.id, mu: x.v, cost: rp.get(x.id) * (1 - (+dsc[x.id] || 0) / 100) })).sort((a, b) => b.mu - a.mu);
  const ideal = rows.length >= 5 ? (FB.histBest({ rows, budget: +((H.budget || {}).limit) || 350 }, 1) || [])[0] : null;
  const idealCard = ideal ? '<div class="card"><div class="list-head"><h2>A melhor equipa possível</h2><span class="small muted"><b class="num">' + f1(ideal.ev) + ' pts</b> · ' + f0(ideal.cost) + ' RP</span></div><ul class="list">' + ideal.ids.map(id => line(id)).join('') + '</ul></div>' : '';
  const best = [...pts.values()].sort((a, b) => b.v - a.v).slice(0, 10);
  const bestCard = '<div class="card"><div class="list-head"><h2>As lendas que mais fizeram</h2></div><ul class="list">' + best.map(x => line(x.id)).join('') + '</ul></div>';
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
    el.innerHTML = head + empty('Historic', H ? 'Os dados do Top Shot já não têm dias por jogar. O admin lê-os outra vez em Ajustes → Admin → Ler no Top Shot → Historic.' : 'Ainda não há dados do Historic. O admin lê-os em Ajustes → Admin → Ler no Top Shot → Historic.',
      S.role === 'admin' ? '<button class="btn primary" type="button" data-action="ranks-go" data-do="hist">Ler o Historic</button>' : '');
    return;
  }
  if (!open.some(d => d.id === S.hday)) S.hday = open[0].id;
  const day = open.find(d => d.id === S.hday);
  const C = S.histMemo = histCalc(H, day.id);
  const strip = histStrip(H, open, day, C);
  if (!C || !C.ev.length) { el.innerHTML = head + strip + '<div class="note">Não há nenhuma equipa de 5 que caiba no orçamento com estas escolhas. Solta um fixado ou repõe alguém.</div>' + histLegendsCard(C, day); return; }
  const sel = C.sel, accs = accounts(), port = C.port && C.port.length ? C.port : null;
  const ai = port ? Math.min(S.hacc || 0, port.length - 1) : 0, best = port ? port[ai] : C.ev[0];
  const M = (C.Ms && C.Ms[ai]) || C.M, byId = new Map(M.rows.map(x => [x.id, x]));
  // com smurfs: uma equipa por conta (botões com a hipótese de cada uma) e a hipótese de pelo menos uma chegar lá
  const accBar = port ? '<div class="j-accs h-accs" role="group" aria-label="Contas">' + port.map((p, i) => '<button type="button" class="acc-chip" data-action="h-acc" data-i="' + i + '" aria-pressed="' + (i === ai) + '">' + esc(accLabel((accs[i] || {}).id || 'main')) + ' <b class="num c-' + tone(Math.min(1, p.p40 * 2)) + '">' + pct(p.p40) + '</b></button>').join('') + '</div>' +
    '<div class="small muted h-port">Uma equipa diferente para cada conta: juntas, pelo menos uma fica nos 40 primeiros em <b>' + pct(port[port.length - 1].union) + '</b> (só com a melhor: ' + pct(port[0].p40) + ').</div>' : '';
  const cutTxt = M.cuts.length ? 'Em dias com ' + plural((day.games || []).length, 'jogo', 'jogos') + ', o 40.º lugar (o último com prémio) fez ' + f0(M.cuts[39] != null ? M.cuts[39] : M.cuts[M.cuts.length - 1]) + ' e o 10.º ' + f0(M.cuts[9] != null ? M.cuts[9] : M.cuts[0]) + '.' : '';
  // de quantos dias jogados aprende o modelo (os do Top Shot e os do arquivo de outras runs)
  const nRuns = new Set(M.dayIds.map(id => String(id).replace(/-d\d+$/, ''))).size;
  const learnTxt = ' Aprende com ' + plural(M.dayIds.length, 'dia jogado', 'dias jogados') + (nRuns > 1 ? ' de ' + nRuns + ' runs' : '') + '.';
  const row = id => {
    const x = byId.get(id), fx = sel.fix.includes(id), opp = x.opp ? (day.games.some(g => g[1] === x.team) ? 'vs ' : '@ ') + hTeam(x.opp) : '';
    return '<li><button class="row" type="button" data-action="h-card" data-id="' + esc(id) + '" data-day="' + esc(day.id) + '"><span class="who">' + hFace(x) + '<div style="min-width:0"><div class="pn">' + (fx ? icoLock : '') + '<span class="nm">' + esc(x.name) + '</span>' + hRipTag(x) + '</div>' +
      '<div class="ps">' + esc(hTeam(x.team)) + ' ' + esc(opp) + ' · ' + f0(x.cost) + ' RP' + (x.cost < x.rp - 1e-9 ? ' <span class="h-disc">−' + Math.round((1 - x.cost / x.rp) * 100) + '%</span>' : '') + ' · ' + (x.own != null ? pct(x.own / 100) + ' escolhem' : '') + '</div>' +
      '<div class="ps">' + (x.n ? 'média ' + f0(x.avg) + ' em ' + plural(x.n, 'jogo', 'jogos') : 'ainda sem jogos') + '</div></div></span>' +
      '<div class="pv"><div class="v num">' + f0(x.mu) + '</div><div class="u">pts</div></div></button></li>';
  };

  const hero = '<div class="card hero day-hero h-hero">' + COURT + '<div class="hero-top"><span class="eyebrow">Historic · Dia ' + histDayNo(day.id) + ' · ' + dWeek(histDate(day)) + ', ' + dShort(histDate(day)) + '</span><span class="small muted">fecha às ' + hm(day.locks) + '</span></div>' +
    '<div class="score"><div class="gblocks"><div class="gb"><span class="gb-st">Pontos esperados</span><span class="gb-n">' + f0(best.mean) + '</span><span class="gb-t">± ' + f0(best.sd) + ' · ' + f0(best.cost) + ' de ' + M.budget + ' RP</span></div></div>' +
    winRing(best.p40, tone(Math.min(1, best.p40 * 2)), pct(best.p40), 'top 40') + '</div>' +
    '<div class="small muted h-odds">Top 10 ' + pct(best.p10) + ' · 1.º lugar ' + pct(best.p1) + '. ' + esc(cutTxt + learnTxt) + '</div>' +
    '<ul class="list jc-list">' + best.ids.map(row).join('') + '</ul>' +
    (sel.fix.length || sel.ban.length ? '<div class="jc-btns"><button class="btn hero-btn" type="button" data-action="h-reset" data-day="' + esc(day.id) + '">Voltar à sugestão</button></div>' : '') + '</div>';
  const alts = C.ev.filter(r => !(port || [best]).some(p => p.ids.join() === r.ids.join()) && (!C.fits || C.fits(r, ai))).slice(0, 3).map(r => Object.assign({}, r, { cost: C.costIn ? C.costIn(r.ids, ai) : r.cost })).map(r => '<li class="row h-alt"><div style="min-width:0"><div class="pn"><b class="num">' + f0(r.mean) + ' pts</b><span class="small muted"> · top 40 ' + pct(r.p40) + ' · top 10 ' + pct(r.p10) + ' · ' + f0(r.cost) + ' RP</span></div><div class="ps">' + r.ids.map(id => esc(byId.get(id).name)).join(', ') + '</div></div></li>').join('');
  const H0 = groupHist(), src = '<div class="small muted h-src">Dados do Top Shot de ' + esc(ago(H0.at)) + ' · ' + plural(M.dayIds.length, 'dia jogado', 'dias jogados') + ' na simulação' + (S.role === 'admin' ? ' · <button class="btn link small" type="button" data-action="ranks-go" data-do="hist">ler outra vez</button>' : '') + '</div>';
  el.innerHTML = head + strip + accBar + hero + (alts ? '<div class="card"><div class="list-head"><h2>Outras equipas</h2><span class="small muted">pela mesma conta</span></div><ul class="list">' + alts + '</ul></div>' : '') + histLegendsCard(C, day) + src;
  hFilter();
}
// todas as lendas do dia: pontos esperados, custo, quem escolhe; + fixa, × tira, tocar no nome = a tua carta (desconto)
function histLegendsCard(C, day) {
  if (!C) return '';
  const ai = C.port && C.port.length ? Math.min(S.hacc || 0, C.port.length - 1) : 0, team = C.port && C.port.length ? C.port[ai] : C.ev[0];
  const sel = C.sel, inBest = new Set(team ? team.ids : []), M = (C.Ms && C.Ms[ai]) || C.M;
  const rows = M.rows.map(x => { const ban = sel.ban.includes(x.id), fx = sel.fix.includes(x.id);
    return '<li class="lu-row' + (ban ? ' h-ban' : '') + '" data-n="' + esc(norm(x.name) + ' ' + hTeam(x.team).toLowerCase()) + '"><button class="lu-main" type="button" data-action="h-card" data-id="' + esc(x.id) + '" data-day="' + esc(day.id) + '">' + hFace(x, 'sm') + '<span class="lu-t"><span class="pn">' + (fx ? icoLock : '') + '<span class="nm">' + esc(x.name) + '</span>' + hRipTag(x) + '</span>' +
      '<span class="ps">' + (inBest.has(x.id) ? '<b class="c-good">na equipa</b> · ' : '') + esc(hTeam(x.team)) + ' · ' + f0(x.cost) + ' RP' + (x.cost < x.rp - 1e-9 ? ' <span class="h-disc">−' + Math.round((1 - x.cost / x.rp) * 100) + '%</span>' : '') + (x.n ? ' · média ' + f0(x.avg) : '') + (x.own != null ? ' · ' + pct(x.own / 100) : '') + '</span></span></button>' +
      '<div class="pv"><div class="v num">' + f0(x.mu) + '</div><div class="u">pts</div></div>' +
      (ban ? '<button class="btn small" type="button" data-action="h-ban" data-id="' + esc(x.id) + '" data-day="' + esc(day.id) + '">Repor</button>'
        : '<button class="lu-ic add" type="button" data-action="h-fix" data-id="' + esc(x.id) + '" data-day="' + esc(day.id) + '" aria-pressed="' + fx + '" aria-label="Fixar ' + esc(x.name) + '" title="Fixar na equipa">' + (fx ? icoLockBtn : icoPlus) + '</button>' +
          '<button class="lu-ic" type="button" data-action="h-ban" data-id="' + esc(x.id) + '" data-day="' + esc(day.id) + '" aria-label="Tirar ' + esc(x.name) + ' deste dia" title="Tirar deste dia">' + icoX + '</button>') + '</li>'; }).join('');
  return '<div class="card"><div class="list-head"><h2>Lendas do dia ' + histDayNo(day.id) + ' ' + helpBtn('historic') + '</h2><span class="small muted">' + plural(M.rows.length, 'lenda', 'lendas') + '</span></div>' +
    '<div class="lu-search"><input class="field" id="hSearch" type="search" placeholder="Procurar lenda ou equipa…" autocomplete="off" aria-label="Procurar lenda ou equipa" value="' + esc(S.hq || '') + '"></div>' +
    '<ul class="list" id="hList">' + rows + '<li class="row small muted lu-none" hidden>Nenhuma lenda com esse nome ou equipa.</li></ul></div>';
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
  else { if (s.fix.length >= 5) { toast('Já tens 5 fixados: solta um primeiro.'); return; } s.fix.push(id); s.ban = s.ban.filter(x => x !== id); }
  hSave(); renderHoje();
}
function hBan(day, id) {
  const s = hSel(day);
  if (s.ban.includes(id)) s.ban = s.ban.filter(x => x !== id); else { s.ban.push(id); s.fix = s.fix.filter(x => x !== id); }
  hSave(); renderHoje();
}
function hCardSheet(day, id) {
  const C = S.histMemo, x = C && C.M.rows.find(r => r.id === id); if (!x) return;
  const accs = accounts(), wl = accs.map(a => ({ a, w: hWalletDisc(a.id)[norm(x.name)] })).filter(z => z.w);
  const wTxt = wl.length ? '<div class="note info h-wal">Na carteira: ' + wl.map(z => '<b>' + esc(z.w.tier) + '</b>' + (accs.length > 1 ? ' na ' + esc(accLabel(z.a.id)) : '') + ' (−' + z.w.pct + '%)').join(' · ') + '</div>' : '';
  const cur = +S.hdisc[id] || 0, sl = S.hsel[day] || { fix: [], ban: [] }, fixed = sl.fix.includes(id), banned = sl.ban.includes(id);
  openSheet('<div class="h-sheet-top">' + hFace(x, 'lg') + '<h3>' + esc(x.name) + '</h3></div>' + (hRip(x) ? '<div class="note info">🕊️ Descansa em paz (' + hRip(x) + '). Na simulação continua a fazer 36 minutos por jogo, sem se queixar das pernas.</div>' : '') + '<div class="small muted">' + esc(hTeam(x.team)) + ' · ' + x.rp + ' RP · ' + (x.n ? 'média ' + f1(x.avg) + ' pts em ' + plural(x.n, 'jogo', 'jogos') + ' (' + x.hist.map(f0).join(', ') + ')' : 'ainda sem jogos') + ' · esperado hoje ' + f1(x.mu) + '</div>' +
    wTxt + '<div class="label" style="margin-top:6px">' + (wl.length ? 'Outra carta (à mão)' : 'A tua melhor carta dele') + '</div><div class="chips" role="group" aria-label="A tua melhor carta">' + H_DISC.map(([v, l]) => '<button type="button" data-action="h-disc" data-id="' + esc(id) + '" data-v="' + v + '" aria-pressed="' + (cur === v) + '">' + l + (v ? ' · −' + v + '%' : '') + '</button>').join('') + '</div>' +
    '<div class="small muted">Com uma carta dele custa menos Roster Points. As cartas vêm da carteira de cada conta (Jogadores → Coleção → Ler carteira); a marcada aqui vale para todas as contas.</div>' +
    '<div class="btns"><button class="btn" type="button" data-action="h-fix" data-id="' + esc(id) + '" data-day="' + esc(day) + '" data-close="1">' + (fixed ? 'Soltar' : 'Fixar na equipa') + '</button><button class="btn" type="button" data-action="h-ban" data-id="' + esc(id) + '" data-day="' + esc(day) + '" data-close="1">' + (banned ? 'Repor neste dia' : 'Tirar deste dia') + '</button></div>');
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
  const src = none ? 'sem lineup no Top Shot' : pl && pl.chain ? 'lido da blockchain' : done && pl.box ? 'pelas estatísticas' : done ? 'registado à mão' : wait ? 'à espera dos jogos' : 'sem resultado';
  // placar desse dia (uma leitura): os resultados ao lado das equipas
  const B = S.box[J.date], run = curRun();
  if (run && !run.fictitious && (!B || (!B.board && !B.busy && Date.now() - B.at > 120e3))) setTimeout(() => { boxLoad(J.date, new Set()).then(() => { if (S.tab === 'hoje') renderHoje(); }); }, 0);
  // o mesmo cartão da previsão: feito / alvo em cima (verde se chegou, vermelho se não), anel com ✓ ou ✕ e as barras do feito
  const madeOf = (pl0, c0, r0) => { const t0 = pl0 && pl0.done ? doneTot(pl0, day) : null; return t0 && objs.length && t0.length >= objs.length ? t0 : c0 && c0.tot && (!r0 || c0.res === r0) ? c0.tot : null; };
  const made = none ? objs.map(() => 0) : madeOf(pl, calc, res); // sem lineup: 0 em tudo
  const ok = (o, k) => +made[k] >= +o.target;
  // um bloco por estatística: nome, o que se fez (grande) e o alvo com a diferença
  const goal = made ? '<div class="gblocks">' + objs.map((o, k) => { const d = Math.round(made[k] - o.target); return '<div class="gb"><span class="gb-st">' + esc(statShort(o.stat)) + '</span><span class="gb-n ' + (ok(o, k) ? 'g-ok' : 'g-no') + '">' + f0(made[k]) + '</span><span class="gb-t">alvo ' + o.target + ' · ' + (ok(o, k) ? '<b class="c-ok">✓ +' + d + '</b>' : '<b class="c-no">✕ −' + (-d) + '</b>') + '</span></div>'; }).join('') + '</div>' : goalBig(objs);
  const ring = res ? winRing(1, res === 'win' ? 'good' : 'bad', res === 'win' ? '✓' : '✕', res === 'win' ? 'vitória' : 'derrota') : winRing(0, 'mute', wait ? '…' : '–', wait ? 'à espera' : 'sem resultado');
  const bars = made ? objs.map((o, k) => {
    const M = Math.max(+o.target * 1.25, +made[k] * 1.12, 1), w = Math.min(100, made[k] / M * 100), tl = Math.min(99, o.target / M * 100), d = Math.round(made[k] - o.target);
    return '<div class="obj-bar"><div class="bar" aria-hidden="true"><i class="k ' + (ok(o, k) ? 'kok' : 'kno') + '" style="width:' + w.toFixed(1) + '%"></i><i class="t" style="left:' + tl.toFixed(1) + '%"></i></div>' +
      '</div>';
  }).join('') : '';
  // com smurfs: uma linha por conta com o que fez em cada estatística e o resultado
  const accs = groupMode() ? '<div class="acc-res" style="--n:' + objs.length + '">' + accounts().map(a => {
    const p2 = ((planOf(a.id).played || {})[J.date]) || null, r2 = p2 && p2.done ? p2.result : null, n2 = r2 && p2.none && !(p2.lineup || []).length, m2 = n2 ? objs.map(() => 0) : madeOf(p2, a.id === S.acc ? calc : dayCalc(a.id, day), r2);
    return '<div class="ar' + (a.id === S.acc ? ' me' : '') + '"><span class="ar-n">' + esc(a.label) + '</span>' + objs.map((o, k) => '<span class="ar-v">' + (m2 ? '<b class="' + (+m2[k] >= +o.target ? 'c-ok' : 'c-no') + '">' + f0(m2[k]) + '</b>' : '<b>–</b>') + ' <small>' + esc(statShort(o.stat)) + '</small></span>').join('') +
      '<span class="ar-r">' + (n2 ? '<b class="muted">sem lineup</b>' : r2 === 'win' ? '<b class="c-ok">✓ vitória</b>' : r2 === 'loss' ? '<b class="c-no">✕ derrota</b>' : '<b>–</b>') + '</span></div>';
  }).join('') + '</div>' : '';
  const out = ['<div class="card hero day-hero past">' + COURT + '<div class="hero-top"><span class="eyebrow">Dia ' + (J.idx + 1) + ' · ' + dWeek(J.date) + ', ' + dShort(J.date) + '</span><span class="small muted">' + src + '</span></div>' +
    '<div class="score">' + goal + ring + '</div>' + bars + accs + '</div>'];
  if (done && !pl.chain && !pl.box && calc && calc.res !== res) out.push('<div class="note">Pelas estatísticas deste lineup: ' + (calc.res === 'win' ? 'vitória' : 'derrota') + ' (' + madeTxt(calc.objs, calc.tot) + '). Se foi este o lineup, muda o resultado.</div>');
  out.push((none ? '' : predVsActualHtml(J.date)) || '<div class="card"><div class="list-head"><h2>Lineup</h2></div><ul class="list">' + (lineupDoneRows(J.date, lineup, objs) || '<li class="row muted small">' + (none ? 'Não levaste lineup neste dia: o Top Shot não te tem na classificação do dia. Os usos dos jogadores não se gastaram.' : 'Sem jogadores registados.') + '</li>') + '</ul></div>');
  out.push('<div class="ctr-btn"><button class="btn' + (lineup.length ? '' : ' primary') + '" type="button" data-action="past-lu" data-date="' + J.date + '">' + (lineup.length ? 'Mudar os jogadores' : 'Escolher os jogadores') + '</button></div>');
  if (run && !run.fictitious && (day.games || []).length) out.push(topLineupCard(r, day, lineup, false));
  if ((day.games || []).length) {
    // valor de cada jogador do plantel nesse dia (do guardado ou das fichas), por baixo do jogo dele
    const lp = {};
    Object.keys(S.mine.roster || {}).forEach(id => { const v = valsFor(S.acc, J.date, id, objs); if (v) { const vals = {}; objs.forEach((o, k) => { vals[o.stat] = v[k]; }); lp[id] = { vals }; } });
    const board = B && B.board && B.board.length ? B.board : null;
    out.push('<div class="card"><div class="list-head"><h2>Jogos do dia</h2><span class="small muted">' + plural(day.games.length, 'jogo', 'jogos') + (board ? '' : ' · hora de cá') + '</span></div><ul class="list">' + gameRows(day, r, lineup, board, lp, day.objectives) + '</ul></div>');
  }
  return out.join('');
}
function renderJornada(el) {
  if (S.jmode === 'historic') { renderHistoric(el); return; }
  if (S.jmode === 'pro') { renderPro(el); return; }
  if (!guard(el, true)) return;
  const r = S.result, v = view(), J = jornadaDay();
  if (!J) { el.innerHTML = empty('Run terminada', 'Acabaste com ' + r.wins + ' vitórias em ' + r.playedCount + ' dias.'); return; }
  const sub = subOf('hoje'), html = [dayStrip(J.date), jornadaNav(J.date, sub)];
  const run = curRun() || {}, real = S.runs.find(x => x.active && !x.fictitious && x.id !== run.id);
  if (run.fictitious) html.push('<div class="note">Run de teste: jogos e objetivos inventados.' + (real ? ' <button class="btn link small" type="button" data-action="run-go" data-id="' + esc(real.id) + '">Ver a ' + esc(real.name) + '</button>' : '') + '</div>');
  if (J.past) {
    html.push(sub === 'lineup' ? pastDayHtml(J) : '<div class="note info">Dia já jogado: o resultado está em Lineup.</div>');
    el.innerHTML = html.join(''); return;
  }
  const { md, d } = J, nd = md.day, o = (nd.objectives || [])[0], isCur = J.cur;
  const live = isCur && liveOn(nd.date) && !!d.live, t = d.totals[0]; // d.live só existe depois de recalcular
  const noneTxt = isCur ? 'Nenhum jogador teu joga hoje.' : 'Nenhum jogador teu joga neste dia.';
  if (sub === 'porque' || sub === 'comparar') {
    html.push((sub === 'porque' ? basisDayCard(r, v, d, md, nd) : compareCard(md, d, nd.date, true)) || '<div class="note info">' + (d.noObjective ? 'Este dia ainda não tem objetivo.' : noneTxt) + '</div>');
    el.innerHTML = html.join(''); return;
  }
  const tips = (nd.games || []).map(g => g[2]).filter(Boolean).sort();
  const right = live ? '<span class="pill jogo">Ao vivo</span>' : tips.length ? '<span class="small muted">1.º jogo ' + hm(tips[0]) + '</span>' : '';
  // fora dos jogos ao vivo: o placar leva o lineup dentro (preenche-se mais abaixo, quando as linhas estão feitas)
  const compact = true, heroAt = html.length; // também durante os jogos (o placar mostra o que já se fez)
  // placar do dia: objetivo, vitória, barra(s); no dia em curso, o botão das opções
  html.push('<div class="card hero day-hero">' + COURT + '<div class="hero-top"><span class="eyebrow">Dia ' + (nd.idx + 1) + ' · ' + dWeek(nd.date) + ', ' + dShort(nd.date) + '</span>' + right + '</div>' +
    '<div class="score">' + goalBig(nd.objectives) +
    (d.noObjective ? '' : winRing(d.P, dTone(d.P))) + '</div>' + (t ? objBars(d, live) : '') +
    (S.multi ? groupLine(nd) : '') +
    (isCur && !d.noObjective && (d.lineup.length || live) ? '<button class="btn hero-btn" type="button" data-action="opcoes">Sugestões para hoje</button>' : !isCur ? '' : '') + '</div>');
  const luAt = html.length; // o lineup vem logo a seguir ao placar (sem ter de descer)
  if (isCur && !live) html.push(picksCard());
  if (isCur) html.push(todoCard(r, v, d, md, nd, live, tips));
  // ao vivo: o plano sugere mudar quem ainda não jogou
  if (live && d.live && (d.live.out.length || d.live.in.length)) {
    const pSub = lineupP(md, d.live.submitted);
    html.push('<div class="note sug"><div><b>Sugestão:</b> ' + [d.live.out.length ? 'tirar ' + d.live.out.map(id => esc(lastName(id))).join(', ') : '', d.live.in.length ? 'pôr ' + d.live.in.map(id => esc(lastName(id))).join(', ') : ''].filter(Boolean).join(' e ') +
      ' · hoje ' + pct(pSub) + ' → <b>' + pct(d.P) + '</b>' + (d.P + 0.15 < pSub ? ' (poupa usos para a run)' : '') + '</div><div class="btns"><button class="btn" type="button" data-action="opcoes">Sugestões</button><button class="btn primary" type="button" data-action="swap-done">Já mudei</button></div></div>');
  }
  html.push(liveGamesCard(r, md, nd, live && d.live ? d.live.submitted : d.lineup, live, true));
  // avisos curtos
  const note = (txt, info) => html.push('<div class="note' + (info ? ' info' : '') + '">' + txt + '</div>');
  if (S.multi) {
    const cl = S.multi.clashes.filter(c => c.date === nd.date && !c.tier); if (cl.length) note('Fixado em duas contas: ' + cl.map(c => esc(nameOf(c.id)) + ' (' + c.accounts.map(accLabel).map(esc).join(', ') + ')').join(' · ') + '. Só joga por uma.');
    // cartas que não chegam: ex. 2.ª jogada nas duas contas com um só Rare
    S.multi.clashes.filter(c => c.date === nd.date && c.tier).forEach(c => { const top = c.req[0], n = c.cards.filter(u => u >= top).length;
      note('<b>' + esc(nameOf(c.id)) + '</b> hoje em ' + c.accounts.map(accLabel).map(esc).join(' + ') + ': para isto são precisas ' + c.req.length + ' cartas com pelo menos ' + top + ' usos e tens ' + n + ' (cartas dele: ' + c.cards.map(usesN).join(' · ') + '). Tira-o ou solta o cadeado numa das contas.'); });
  }
  if (d.noObjective) note('Este dia ainda não tem objetivo.', true);
  if (d.perPlayer) note('Objetivo por jogador: cada um tem de lá chegar sozinho. Confirma o lineup à mão.');
  if ((nd.objectives || []).some(x => x && /pip/.test(x.stat))) note('Pontos na área: estimados a partir dos lançamentos de 2.', true);
  else if (!(nd.games || []).length) note('Os jogos deste dia ainda não chegaram.', true);
  if (((curPlan().keep || {})[nd.date] || []).length) note('Lineup mantido como estava quando tiraste o cadeado. <button class="btn link small" type="button" data-action="keep-clear" data-date="' + nd.date + '">Deixar o plano escolher</button>', true);
  const drop = (r.model.droppedLocks || []).filter(x => x.date >= nd.date);
  if (drop.length) { const ids = [...new Set(drop.map(x => x.player))]; note('Fixado em mais dias do que os usos: ' + ids.map(id => '<b>' + esc(nameOf(id)) + '</b> (o cadeado ' + (drop.filter(x => x.player === id).length > 1 ? 'dos dias ' : 'do dia ') + drop.filter(x => x.player === id).map(x => dayNo(x.date)).join(', ') + ' não conta)').join(', ') + '. <button class="btn link small" type="button" data-action="locks-fix">Tirar esses cadeados</button>'); }
  if (r.normal.conflicts.length) note('Fixados mais vezes do que os usos: ' + r.normal.conflicts.map(c => esc(nameOf(c.player)) + ' (' + c.used + ' de ' + c.uses + ')').join(', ') + '.');
  if (d.badLocks && d.badLocks.length) {
    const plays = FB.teamsOn(nd), teamOf = id => (r.model.players[r.model.pIndex.get(id)] || {}).team;
    const noGame = d.badLocks.filter(id => !plays.has(teamOf(id))), outNow = d.badLocks.filter(id => plays.has(teamOf(id)));
    if (noGame.length) note('Fixados sem jogo neste dia: ' + noGame.map(id => esc(nameOf(id))).join(', ') + '.');
    if (outNow.length) note('Fixados mas fora: ' + outNow.map(id => esc(nameOf(id)) + (injRec(id) ? ' (' + esc((INJ_LABEL[injRec(id).status] || '').toLowerCase()) + ')' : '')).join(', ') + '. Solta-o ou ignora o relatório na ficha.');
  }
  // lineup
  const locks = new Set(((curPlan().locks || {})[nd.date]) || []), bans = ((curPlan().bans || {})[nd.date]) || [];
  const lp = live ? ((liveDoc(nd.date) || {}).players || {}) : {};
  // ao vivo: pistas (feito, previsto até ao fim, o que se esperava), por estado: a jogar, terminados, por começar
  const lvScale = live ? liveScale(md, d.lineup, r) : null;
  const lvOrder = id => { const x = liveLine(md, r.model.pIndex.get(id), 0); return x.st === 'jogo' || x.st === 'jogo?' ? 0 : x.st === 'fim' ? 1 : 2; };
  const rows = live ? d.lineup.slice().sort((a, b) => lvOrder(a) - lvOrder(b)).map(id => {
    const tr = S.multi && (S.profile || {}).collection ? S.multi.transfers.find(x => x.id === id && x.to === S.acc && x.before <= nd.date) : null;
    return liveRow(r, md, nd, id, lvScale, (tr ? '<span class="pill prov">Mandar de ' + esc(accLabel(tr.from)) + '</span>' : '') + (d.live.submitted.includes(id) ? '' : '<span class="pill prov">Novo</span>'));
  }).join('') : d.lineup.map(id => {
    const pi = r.model.pIndex.get(id), p = r.model.players[pi], info = md.info[pi][0];
    let ps;
    if (live) {
      const st = info.liveState, sb2 = d.live.submitted.includes(id);
      if (st === 'fim') ps = '<span class="pill fim">Fim</span> ' + teamMini(p.team) + esc(p.team) + ' ' + esc(opp(p.team, nd));
      else if (st === 'jogo') ps = '<span class="pill jogo">' + (info.q ? QLABEL[info.q] : 'Em jogo') + '</span> ' + teamMini(p.team) + md.objs.map((ob, k) => f0(md.info[pi][k].known) + (md.objs.length > 1 ? ' ' + esc(statShort(ob.stat)) : '')).join(' · ') + ' até agora';
      else if (st === 'jogo?') ps = '<span class="pill jogo">Em jogo</span> ' + teamMini(p.team) + esc(p.team) + ' ' + esc(opp(p.team, nd));
      else ps = (sb2 ? '' : '<span class="pill prov">Novo</span> ') + teamMini(p.team) + esc(p.team) + ' ' + esc(opp(p.team, nd));
    } else ps = teamMini(p.team) + esc(p.team) + ' ' + esc(opp(p.team, nd)) + (info.b2b ? ' · 2.º seguido' : ''); // a fonte do valor fica em Porquê e na ficha; a lesão é a pílula do nome
    // Moment que ainda está noutra conta: tem de ser mandado antes deste jogo
    const tr = S.multi && (S.profile || {}).collection ? S.multi.transfers.find(x => x.id === id && x.to === S.acc && x.before <= nd.date) : null;
    if (tr) ps = '<span class="pill prov">Mandar de ' + esc(accLabel(tr.from)) + '</span> ' + ps;
    if (!live && !S.gOdds[nd.date]) loadGameOdds(nd.date);
    let stp = info.status !== 'ok' ? '<span class="pill ' + info.status + '">' + esc(STATUS[info.status].label) + '</span>' : '';
    let rl = '';
    if (!live && riskOf(md, id)) { const sb = riskSub(md, nd, d.lineup, id);
      stp += '<span class="pill duv risk" title="' + esc((INJ_LABEL[info.injury.rec.status] || '') + ': conta como se jogasse; se ficar de fora, troca-o antes do jogo') + '">⚠ ' + esc(INJ_LABEL[info.injury.rec.status] || 'Dúvida') + '</span>';
      rl = '<div class="risk-sub">se não jogar: ' + (sb ? '<b>' + esc(lastName(sb.id)) + '</b> (hoje ' + pct(sb.P) + ')' : 'não há troca depois do jogo dele') + '</div>'; }
    // ao vivo, com o jogo já começado: tocar abre as estatísticas do jogo
    const gid = live && /^(jogo\??|fim)$/.test(info.liveState || '') ? ((FB.gameOf(nd, p.team) || [])[3] || '') : '';
    return '<li><button class="row" type="button" ' + (/^espn:/.test(gid) ? 'data-action="game-box" data-gid="' + esc(gid) + '"' : 'data-action="player"') + ' data-id="' + esc(id) + '" data-date="' + nd.date + '"><span class="who">' + face(id) + '<div style="min-width:0"><div class="pn">' + (locks.has(id) ? icoLock : '') + '<span class="nm">' + esc(p.name) + '</span>' + stp + '</div><div class="ps">' + ps + '</div>' + rl + (live ? '' : fxHtml(id, nd, [...new Set(md.objs.map(x => x.stat))])) + '</div></span>' + pvHtml(objVals(md, pi, live), live ? '' : formMark(p, o)) + '</button></li>';
  }).join('');
  const allFinal = live && d.live.submitted.length && d.live.submitted.every(id => ((lp[id] || {}).state) === 'fim');
  // antes dos jogos: Mudar (fixar, tirar e pôr jogadores um a um, com o que muda face à sugestão)
  const tip0 = firstTipOf(nd), canEdit = !live && !(tip0 != null && Date.now() >= tip0) && md.elig.length > 0;
  const bansLine = bans.length ? '<div class="row small muted" style="display:block">Tirados deste dia: ' + bans.map(id => esc(lastName(id)) + ' <button class="btn link small" type="button" data-action="unban" data-id="' + esc(id) + '" data-date="' + nd.date + '">repor</button>').join(' · ') + '</div>' : '';
  if (compact) {
    const objLine = (nd.objectives || []).filter(x => x && x.stat).map(x => x.target + ' ' + esc(statShort(x.stat))).join(' + ');
    const perStat = t ? d.totals.map(x => '<span>' + esc(statShort(x.stat)) + ' ' + (live ? '<b class="num">' + f0(x.known) + '</b>/' + x.target + ' · fim ≈ ' + f1(x.mu) : '<b class="num">' + f1(x.mu) + '</b>/' + x.target) + ' · ' + pct(FB.probAtLeast(x.mu, x.sd * x.sd, x.target)) + '</span>').join('<span aria-hidden="true"> · </span>') : '';
    const LD = S.liveDiag, liveDiag = live ? '<div class="live-diag">' + (LD ? 'ESPN ' + ago(new Date(LD.at).toISOString()) + ': ' + LD.found + ' de ' + LD.sub + ' com estatísticas' + ((LD.miss || []).length ? ' (sem: ' + LD.miss.map(esc).join(', ') + ')' : '') + (LD.err ? ' · erro: ' + esc(LD.err) : '') + ' · ' : '') + '<button class="btn link small" type="button" data-action="live-refresh">Atualizar</button></div>' : '';
    const finalLine = allFinal && t ? '<div class="row small jc-final" style="display:block">Total ' + d.totals.map(x => '<b class="num">' + f0(x.known) + '</b> de ' + x.target + (d.totals.length > 1 ? ' ' + esc(statShort(x.stat)) : '')).join(' · ') + ' → ' + (d.totals.every(x => x.known >= x.target) ? '<b class="up">ganhaste</b>' : '<b class="down">perdeste</b>') + '</div>' : '';
    const btns = [isCur && !d.noObjective && (d.lineup.length || live) ? '<button class="btn hero-btn" type="button" data-action="opcoes">Sugestões para hoje</button>' : '', canEdit ? '<button class="btn hero-btn" type="button" data-action="lu-edit" data-date="' + nd.date + '">Mudar o lineup</button>' : isCur && (live || (tip0 != null && Date.now() >= tip0)) ? '<button class="btn hero-btn" type="button" data-action="live-lu" data-date="' + nd.date + '">Mudar o lineup</button>' : '', d.lineup.length ? '<button class="btn hero-btn jc-share" type="button" data-action="lu-share" data-date="' + nd.date + '" aria-label="Partilhar o lineup" title="Partilhar o lineup">' + icoShare + '</button>' : ''].filter(Boolean);
    html[heroAt] = '<div class="card hero day-hero jcompact">' + COURT + '<div class="jc-top"><div class="jc-txt"><span class="eyebrow">' + (isCur ? 'Hoje' : 'Dia ' + (nd.idx + 1)) + (objLine ? ' · ' + objLine : '') + ' ' + helpBtn(live ? 'aovivo' : 'lineup') + (live ? ' <span class="pill jogo">Ao vivo</span>' : '') + '</span>' +
      (live ? (d.totals.length === 1 && t ? liveBoard(d, 'top') : '') : '<div class="jc-sub">' + (d.noObjective ? 'Sem objetivo' : d.lineup.length ? perStat : '') + '</div>') + (live ? '' : '<div class="jc-sub">' + (isCur ? '' : dWeek(nd.date) + ' ' + dShort(nd.date) + (tips.length ? ' · ' : '')) + (tips.length ? '1.º jogo ' + hm(tips[0]) : '') + '</div>') + '</div>' + (d.noObjective ? '' : winRing(d.P, dTone(d.P))) + '</div>' +
      (live && t ? liveBoard(d, 'bar') : '') + liveDiag + (d.lineup.length ? '<ul class="list jc-list' + (live ? ' lv-list' : '') + '">' + rows + '</ul>' : '<div class="row muted small jc-empty">' + (S.multi && md.elig.length ? 'Esta conta não joga neste dia: os Moments rendem mais nas outras.' : noneTxt) + '</div>') + finalLine + bansLine + (isCur && !live ? holdLine(S.acc, nd.date) : '') +
      (btns.length ? '<div class="jc-btns">' + btns.join('') + '</div>' : '') + '</div>';
  } else html.splice(luAt, 0, '<div class="card"><div class="list-head"><h2>Lineup ' + helpBtn(live ? 'aovivo' : 'lineup') + '</h2>' + (canEdit ? '<button class="btn small" type="button" data-action="lu-edit" data-date="' + nd.date + '">Mudar</button>' : '<span class="small muted">' + (live ? 'pontos ao vivo' : d.lineup.length ? d.lineup.length + ' de ' + md.size : '') + '</span>') + '</div>' +
    (d.lineup.length ? '<ul class="list">' + rows + '</ul>' : '<div class="row muted small">' + (S.multi && md.elig.length ? 'Esta conta não joga neste dia: os Moments rendem mais nas outras.' : noneTxt) + '</div>') +
    (allFinal && t ? '<div class="row small" style="display:block">Total ' + d.totals.map(x => '<b class="num">' + f0(x.known) + '</b> de ' + x.target + (d.totals.length > 1 ? ' ' + esc(statShort(x.stat)) : '')).join(' · ') + ' → ' + (d.totals.every(x => x.known >= x.target) ? '<b class="up">ganhaste</b>' : '<b class="down">perdeste</b>') + '</div>' : '') +
    bansLine + '</div>');
  html.push(liveGamesCard(r, md, nd, live && d.live ? d.live.submitted : d.lineup, live, false));
  if (live) html.push(topLineupCard(r, nd, d.live ? d.live.submitted : d.lineup, true));
  html.push(todayPlayersCard(r, md, nd, isCur));
  if (isCur) html.push(betterCard(), buyLine());
  el.innerHTML = html.join('');
}
// Ao vivo: liga-se sozinho quando o 1.º jogo do dia começa, com o lineup submetido (lido da blockchain, se já lá
// estiver; senão o do plano). Prende quem já jogou, lê os pontos da ESPN de 2 em 2 minutos e refaz o resto da run.
function ensureLive() {
  // todas as contas ao mesmo tempo (não só a que estás a ver): cada uma com o lineup que tinha quando o 1.º jogo começou
  const nd = S.result ? nextDay() : null; if (!nd) return false;
  const tip = firstTipOf(nd); if (tip == null || Date.now() < tip) return false;
  let started = false;
  (S.multi ? accounts().map(a => a.id) : ['main']).forEach(k => {
    const pa = planOf(k), cur = (pa.live || {})[nd.date];
    if (cur && cur.active) return;
    const R = S.multi ? S.multi.byKey[k] : S.result, d0 = R && R.normal.days[0];
    if (!d0 || d0.date !== nd.date) return;
    const lineup = cur && cur.lineup && cur.lineup.length ? cur.lineup : chainLineupToday(nd.date, k) || d0.lineup.slice();
    if (!lineup.length) return;
    pa.live = Object.assign({}, pa.live || {}, { [nd.date]: Object.assign({}, cur || {}, { active: true, lineup, players: (cur && cur.players) || {} }) });
    started = true;
  });
  if (!started) return false;
  saveMine(); schedule();
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
    const top = '<span class="g-teams">' + teams + '</span>' + (started && gid ? '<button type="button" class="g-time num g-boxbtn" data-action="game-box" data-gid="' + esc(gid) + '" aria-label="Estatísticas ao vivo">' + right + ' <span aria-hidden="true">›</span></button>' : '<span class="g-time num">' + right + '</span>') + (mine.length ? '<span class="g-mine">' + chips + '</span>' : '');
    const all = rest.length ? '<div class="g-all">' + rest.map(id => esc(lastName(id)) + val(id)).join(' · ') + '</div>' : '';
    return '<li class="gcard' + (bg && bg.state === 'in' ? ' on' : '') + '">' + (all ? '<details><summary class="g-top">' + top + '</summary>' + all + '</details>' : '<div class="g-top">' + top + '</div>') + '</li>';
  }).join('');
}
// Jogos do dia: durante os jogos ficam por cima do lineup, com o placar da ESPN; antes, por baixo, com as horas
function liveGamesCard(r, md, nd, ids, live, above) {
  if (!(nd.games || []).length) return '';
  const inWin = gamesWindow(nd);
  if (inWin !== !!above) return '';
  const ttl = (nd.date === (nextDay() || {}).date ? 'Jogos de hoje' : 'Jogos do dia') + ' ' + helpBtn('jogosdia');
  if (inWin && (!S.board || S.board.date !== nd.date)) { setTimeout(() => refreshBoard(nd.date), 0); return '<div class="card"><div class="list-head"><h2>' + ttl + '</h2></div><div class="row small muted" style="display:block">A ler o placar…</div></div>'; }
  const B = inWin ? (S.board.games || []) : null, o = nd.objectives || [], lp = live ? ((liveDoc(nd.date) || {}).players || {}) : {};
  const many = o.filter(x => x && x.stat).length > 1;
  if (!inWin) { const tips = (nd.games || []).map(g => g[2]).filter(Boolean).sort(); return foldCard('jogos', nd.date === (nextDay() || {}).date ? 'Jogos de hoje' : 'Jogos do dia', helpBtn('jogosdia'), plural(nd.games.length, 'jogo', 'jogos') + (tips.length ? ' · 1.º às ' + hm(tips[0]) : ''), '<ul class="list">' + gameRows(nd, r, ids, null, lp, o) + '</ul>'); }
  return '<div class="card"><div class="list-head"><h2>' + ttl + '</h2><span class="small muted">' + (inWin ? (S.board.err ? 'sem ligação à ESPN' : 'ao vivo') : plural(nd.games.length, 'jogo', 'jogos')) + (inWin && live && many ? ' · ' + o.filter(x => x && x.stat).map(x => esc(statShort(x.stat))).join('/') : '') + '</span></div><ul class="list">' + gameRows(nd, r, ids, B, lp, o) + '</ul></div>';
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
    const li = '<li class="todo-li' + (on ? ' done' : '') + '">' + (k ? '<button class="todo-ck" type="button" data-action="todo-tick" data-k="' + esc(k) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Feito. Desmarcar' : 'Marcar como feito') + '">' + icoTick + '</button>' : '') +
      '<button class="row" type="button" ' + attrs + '><div style="min-width:0"><div class="todo-t">' + html + '</div>' + (sub && !on ? '<div class="ps">' + sub + '</div>' : '') + '</div><span class="muted" aria-hidden="true">›</span></button></li>';
    return on ? (done.push(li), '') : li;
  };
  const today = todayET(), at = (day, team) => { const tt = team ? FB.tipTime(day, team) : null; return tt ? 'até às ' + hm(new Date(tt).toISOString()) : 'antes do jogo dele'; };
  if (S.multi) {
    if (!(S.profile || {}).collection) items.push(btn('data-action="goto" data-tab="plantel" data-sub="colecao"', 'Lê as carteiras das tuas contas', 'Para saber o que mandar para cada conta.', 'wallet|' + today));
    else {
      const due = S.multi.transfers.filter(t => t.before <= nd.date), later = S.multi.transfers.filter(t => t.before > nd.date);
      // agrupadas pela conta de onde saem (entra-se numa conta de cada vez no Top Shot) e, dentro, uma linha por hora
      // limite com os Moments dessa hora; o visto marca a linha toda (cada Moment fica dado como mandado)
      const accOrder = accounts().map(a => a.id), tipOf = t => { const day = S.days.find(x => x.date === t.before) || nd, team = (r.model.players[r.model.pIndex.get(t.id)] || {}).team; return team ? FB.tipTime(day, team) : null; };
      // um grupo por par de contas (de onde sai → para onde vai): com 3 contas, "Main → Terose" e "Main → smurf" à parte
      const pairs = [...new Set(due.map(t => t.from + '>' + t.to))].map(k => k.split('>')).sort((a, b) => (accOrder.indexOf(a[0]) - accOrder.indexOf(b[0])) || (accOrder.indexOf(a[1]) - accOrder.indexOf(b[1])));
      let anyTr = false;
      pairs.forEach(([f, to]) => {
        const byTime = new Map();
        due.filter(t => t.from === f && t.to === to).forEach(t => { const tt = tipOf(t), k = tt ? hm(new Date(tt).toISOString()) : '—'; (byTime.get(k) || byTime.set(k, { tt: tt || Infinity, list: [] }).get(k)).list.push(t); });
        const lines = [...byTime.entries()].sort((a, b) => a[1].tt - b[1].tt).map(([k, g]) => {
          const tag = t => t.uses && collectionInfo(t.id).nTop < collectionInfo(t.id).copies ? '<span class="todo-tier">' + (t.uses >= 4 ? 'L' : t.uses >= 2 ? 'R' : 'C') + '</span>' : '';
          const keys = g.list.map(t => (S.runId || '') + '|tr|' + t.id + '|' + t.from + '>' + t.to + '|' + t.before), on = keys.every(x => TODO_DONE[x]);
          const html = '<span class="todo-at">' + (k === '—' ? 'antes do jogo' : 'até ' + k) + '</span> ' + g.list.map(t => '<b>' + esc(lastName(t.id)) + '</b>' + tag(t)).join(' · ');
          const li = '<li class="todo-li' + (on ? ' done' : '') + '"><button class="todo-ck" type="button" data-action="todo-tick" data-k="' + esc(keys.join(' ')) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Feito. Desmarcar' : 'Marcar como mandados') + '">' + icoTick + '</button><button class="row" type="button" data-action="todo-tick" data-k="' + esc(keys.join(' ')) + '"><div style="min-width:0"><div class="todo-t">' + html + '</div></div></button></li>';
          if (on) { done.push(li); return ''; } return li;
        }).filter(Boolean);
        if (lines.length) { anyTr = true; items.push('<li class="row small todo-grp" style="display:block">Da <b>' + esc(accLabel(f)) + '</b> para a <b>' + esc(accLabel(to)) + '</b></li>', ...lines); }
      });
      if (anyTr) items.push('<li class="row small muted" style="display:block">No Top Shot: oferece cada Moment à outra conta.</li>');
      if (later.length) items.push('<li class="row small muted" style="display:block">Depois: ' + later.slice(0, 3).map(t => esc(lastName(t.id)) + ' → ' + esc(accLabel(t.to)) + ' até ' + dShort(t.before)).join(' · ') + (later.length > 3 ? ' e mais ' + (later.length - 3) : '') + '.</li>');
    }
  }
  d.lineup.forEach(id => { const pi = r.model.pIndex.get(id), info = md.info[pi][0], j = info.injury;
    if (j && !j.ignored && j.status && !info.liveState) items.push(btn('data-action="player" data-id="' + esc(id) + '" data-date="' + nd.date + '"', '<b>' + esc(nameOf(id)) + '</b>' + (j.risk ? ' ⚠' : '') + ': ' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + ', ' + pct(pPlayOf(info)) + ' de jogar', (() => { const sb = j.risk ? riskSub(md, nd, d.lineup, id) : null; return 'Confirma ' + at(nd, r.model.players[pi].team) + '; se não jogar, ' + (sb ? 'troca-o por <b>' + esc(nameOf(sb.id)) + '</b> no Top Shot (hoje ' + pct(sb.P) + ').' : 'tira-o no Top Shot.'); })(), 'inj|' + id + '|' + nd.date + '|' + j.rec.status)); });
  // run a sério: dia que acabou há mais de 12 h e não fechou sozinho (sem lineup guardado, ou sem estatísticas)
  const run = curRun();
  if (run && !run.fictitious) {
    const lim = new Date(Date.parse(today + 'T12:00:00Z') - 3 * 864e5).toISOString().slice(0, 10), pl = curPlan().played || {};
    skippedDays(S.acc).filter(x => x.date >= lim && !(pl[x.date] && pl[x.date].noAuto) && (x.objectives || []).some(o => o && o.stat) && Date.now() > dayEnd(x) + 12 * 3600e3).forEach(x => {
      items.push(btn('data-action="past-lu" data-date="' + x.date + '"', 'Dia ' + (S.days.indexOf(x) + 1) + ' sem resultado', 'Não fechou sozinho. Se jogaste, regista-o.', 'res|' + x.date));
    });
  }
  const open = items.filter(x => x), n = open.filter(x => x.indexOf('<button') >= 0).length;
  if (!open.length && !done.length) return '';
  const doneRow = done.length ? '<li class="row small muted todo-more" style="display:block"><button class="btn link small" type="button" data-action="todo-show" aria-expanded="' + S.todoShow + '">' + (S.todoShow ? 'Esconder' : 'Ver') + ' ' + plural(done.length, 'feito', 'feitos') + '</button></li>' + (S.todoShow ? done.join('') : '') : '';
  if (!n) return '<div class="card todo all-done"><div class="list-head"><h2>A fazer</h2><span class="small muted">tudo feito ✓</span></div><ul class="list">' + open.join('') + doneRow + '</ul></div>';
  return '<div class="card todo"><div class="list-head"><h2>A fazer</h2><span class="small muted">' + n + '</span></div><ul class="list">' + open.join('') + doneRow + '</ul></div>';
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
      '<span class="inj-n"><span class="pn"><span class="nm">' + esc(nameOf(x.p.id)) + '</span>' + pill(rec) + (inLu.has(x.p.id) ? '<span class="badge">no lineup</span>' : '') + '</span>' +
      '<span class="ps">' + teamTag(x.p.team) + (rec.detail ? ' · ' + esc(rec.detail) : '') + (rec.return_date ? ' · volta ' + dShort(rec.return_date) : '') + '</span></span>' +
      '<span class="inj-p num' + (out ? ' c-bad' : '') + '">' + (out ? '0%' : pct(pPlayOf(x.info))) + '<small>joga</small></span></button></li>'; };
  // na run: cada jogador do relatório com a faixa dos dias que faltam (vermelho fora, amarelo em dúvida, azul claro provável)
  const runRows = runInj.filter(x => x.hits.length).sort((a, b) => b.hits.length - a.hits.length);
  const sec = (t, n, body) => '<div class="inj-sec"><div class="inj-h">' + t + (n != null ? ' <span class="muted">' + n + '</span>' : '') + '</div>' + body + '</div>';
  const formChips = (l, cls) => l.map(z => '<button class="f-chip ' + cls + '" type="button" data-action="player" data-id="' + esc(z.x.p.id) + '" data-date="' + nd.date + '">' + face(z.x.p.id, 'xs') + esc(lastName(z.x.p.id)) + ' ' + pcs(z) + '</button>').join('');
  let body = '<div class="small muted fold-sub">' + plural(mine.length, 'jogador teu joga', 'jogadores teus jogam') + '</div>';
  body += sec('Hoje', inj.length || null, !S.injOk ? '<div class="small muted inj-empty">O relatório de lesões ainda não está ligado.</div>' : inj.length ? '<ul class="list inj-list">' + injToday.map(rowT).join('') + '</ul>' : '<div class="small muted inj-empty">Ninguém teu que jogue está no relatório. ✓</div>');
  if (hot.length || cold.length) body += sec('Forma', null, '<div class="f-chips">' + formChips(hot, 'hot') + formChips(cold, 'cold') + '</div>');
  // o relatório todo (a run inteira) fica em Jogadores → Lesões
  if (S.injOk) body += '<button class="btn link small inj-all" type="button" data-action="goto" data-tab="plantel" data-sub="lesoes">' + (runRows.length ? 'Lesões na run toda (' + runRows.length + ') ›' : 'Relatório de lesões ›') + '</button>';
  const sum = [inj.length ? plural(inj.length, 'lesão', 'lesões') : 'sem lesões', (hot.length ? hot.length + ' ▲' : '') + (hot.length && cold.length ? ' ' : '') + (cold.length ? cold.length + ' ▼' : '')].filter(Boolean).join(' · ');
  return foldCard('lesoes', 'Lesões e forma', helpBtn('lesoesforma'), sum, body);
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
    ['Odds', hasOdds ? withOdds + ' de ' + rows.length + ' do lineup · ' + esc(ago(od.updated_at)) : 'ainda não há (chegam à tarde): usa as médias'],
    ['Lesões', S.injOk ? (injured.length ? injured.map(x => '<b>' + esc(lastName(x.id)) + '</b> ' + pct(pPlayOf(x.info)) + ' de jogar').join(' · ') : 'ninguém do lineup') : 'relatório ainda não ligado'],
    ['Seguidos', bb.length ? bb.map(x => '<b>' + esc(lastName(x.id)) + '</b>').join(', ') + ' jogou ontem' + (!b2bOn ? ' (sem ajuste)' : '') : 'ninguém jogou ontem'],
    ['Run', r.prizes.length ? r.prizes.map((p, i) => p.wins + 'V ' + pct(v.prizeProbs[i])).join(' · ') : 'o máximo de vitórias na run toda'],
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
    const reason = !(r.model.uses[pi] > 0) ? 'sem usos' : later.length ? 'guardado para ' + (later.length > 1 ? 'os dias ' : 'o dia ') + later.map(x => x.idx + 1).join(', ') : info.pPlay < 1 ? pct(info.pPlay) + ' de jogar' : 'rende menos';
    return { id, info, reason, swapP, swapOut };
  });
  const pp = x => Math.round(x * 100), signed = n => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');
  const row = (id, name, sub, val) => '<li><button class="row" type="button" data-action="player" data-id="' + esc(id) + '" data-date="' + date + '"><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + name + '</span></div><div class="ps">' + sub + '</div></div></span><div class="pv"><div class="v num">' + val + '</div><div class="u">pp</div></div></button></li>';
  return '<div class="card basis-day"><div class="list-head"><h2>Em que se baseia ' + helpBtn('porque') + '</h2><span class="small muted">' + dWeek(date) + ', ' + dShort(date) + '</span></div>' +
    lines.map(([a, b]) => '<div class="status-line basis-line"><span class="bl">' + a + '</span><span>' + b + '</span></div>').join('') +
    '<div class="list-head sub-head"><h3>Quanto vale cada um</h3></div><ul class="list">' +
    why.map(w => row(w.id, esc(nameOf(w.id)), esc(srcShort(w.info)) + (w.info.pPlay < 1 ? ' · ' + pct(w.info.pPlay) + ' de jogar' : '') + ' · sem ele ' + pct(w.without) + (w.sub ? ' (entra ' + esc(lastName(w.sub)) + ')' : '') + (pp(w.without) > pp(P) ? ' · poupa outros' : ''), signed(pp(P) - pp(w.without)))).join('') +
    outs.map(x => row(x.id, '<span class="muted">Fora:</span> ' + esc(nameOf(x.id)), esc(x.reason) + (x.swapOut ? ' · por ' + esc(lastName(x.swapOut)) + ': ' + pct(x.swapP) : ''), signed(x.swapOut ? pp(x.swapP) - pp(P) : 0))).join('') + '</ul></div>';
}
// várias contas: vitória de cada conta neste dia
function groupLine(nd) {
  const g = S.multi;
  return '<div class="impact"><div>' + g.keys.map(k => { const dd = g.byKey[k].normal.days.find(x => x.date === nd.date); return esc(accLabel(k)) + ' ' + (dd ? (dd.lineup.length ? '<b class="num">' + pct(dd.P) + '</b>' : 'não joga') : 'fechado'); }).join(' · ') + '</div></div>';
}
// Moments a mandar de uma conta para outra (Run → Contas)
function transfersCard() {
  const g = S.multi; if (!g) return '';
  if (!(S.profile || {}).collection) return '<div class="note info">Lê as carteiras (Jogadores → Coleção) para saber o que mandar para cada conta.</div>';
  const list = g.transfers;
  const row = t => '<li class="row"><span class="who">' + face(t.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(t.id)) + '</span>' + (t.uses && collectionInfo(t.id).nTop < collectionInfo(t.id).copies ? '<span class="badge">' + (t.uses >= 4 ? 'Legendary' : t.uses >= 2 ? 'Rare' : 'Common') + '</span>' : '') + '</div><div class="ps">' + esc(accLabel(t.from)) + ' → <b>' + esc(accLabel(t.to)) + '</b> · antes de ' + dWeek(t.before) + ', ' + dShort(t.before) + '</div></div></span></li>';
  return '<div class="card"><div class="list-head"><h2>Transferências ' + helpBtn('transf') + '</h2><span class="small muted">' + (list.length ? list.length + ' na run' : 'nenhuma') + '</span></div>' + (list.length ? '<ul class="list">' + list.map(row).join('') + '</ul>' : '<div class="row small muted">Cada conta joga com os Moments que tem.</div>') + '</div>';
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
function chainLineupToday(date, acc) {
  acc = acc || S.acc;
  const uid = S.session.user.id, rows = ((S.group || {}).chain || []).filter(c => c.user_id === uid && c.date === date && (c.account || 'main') === acc && (c.lineup || []).length);
  if (!rows.length) return null;
  const byName = new Map(Object.keys(S.mine.roster || {}).map(id => [norm(nameOf(id)), id]));
  const ids = rows[0].lineup.map(n => byName.get(norm(n))).filter(Boolean);
  return ids.length ? ids : null;
}
// topo das opções durante os jogos: feito até agora, vitória se ficar tudo como está, cada jogador do lineup submetido
function liveHead(nd) {
  const r = S.result, v = view(), d0 = v.days[0], md = r.model.days[0];
  if (!d0 || d0.date !== nd.date) return { html: '<div class="note info">' + 'Este dia já fechou.' + '</div>', closed: true };
  const lv = liveDoc(nd.date) || {}, sub = (lv.lineup || []).filter(id => r.model.pIndex.has(id));
  const started = new Set(((d0.live || {}).locked) || []), rem = sub.filter(id => !started.has(id));
  const eligIds = md.elig.map(pi => r.model.players[pi].id), pSub = lineupP(md, sub);
  const done = d0.totals.map(t => f0(t.known) + '<small> de ' + t.target + (d0.totals.length > 1 ? ' ' + esc(statShort(t.stat)) : '') + '</small>').join(' · ');
  const rows = sub.map(id => {
    const pi = r.model.pIndex.get(id), info = (md.info[pi] || [])[0] || {}, st = info.liveState;
    const ps = st === 'fim' ? '<span class="pill fim">Fim</span>'
      : st === 'jogo' || st === 'jogo?' ? '<span class="pill jogo">' + (info.q ? QLABEL[info.q] : 'Em jogo') + '</span> ' + md.objs.map((o, k) => f0((md.info[pi][k] || {}).known || 0) + (md.objs.length > 1 ? ' ' + esc(statShort(o.stat)) : '')).join(' · ') + ' até agora'
      : (tipOf(nd, id) ? 'jogo às ' + tipOf(nd, id) : '');
    return '<li class="row"><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn">' + (started.has(id) ? icoLock : '') + '<span class="nm">' + esc(nameOf(id)) + '</span></div><div class="ps">' + ps + '</div></div></span>' + pvHtml(objVals(md, pi, true)) + '</li>';
  }).join('');
  const chips = '<div class="chips" role="group" aria-label="Lineup submetido">' + eligIds.map(id => '<button type="button" data-action="op-pick" data-id="' + esc(id) + '" aria-pressed="' + sub.includes(id) + '">' + (started.has(id) ? icoLock : '') + esc(lastName(id)) + '</button>').join('') + '</div>';
  const html = '<div class="kv" style="grid-template-columns:1fr 1fr"><div><div class="label">Feito até agora</div><div class="v num">' + done + '</div></div><div><div class="label">Vitória hoje assim</div><div class="v num c-' + tone(pSub) + '">' + pct(pSub) + '</div></div></div>' +
    (rows ? '<ul class="list card">' + rows + '</ul>' : '') +
    '<div class="stack" style="gap:8px"><div class="label">Lineup submetido <span class="muted" style="font-weight:400">· toca para corrigir</span></div>' + chips + '</div>' +
    (rem.length ? '' : '<div class="note info">Todos os teus jogadores já começaram: hoje já não há nada a mudar.</div>');
  return { html, sub, started, rem, eligIds, closed: false };
}
const tipOf = (day, id) => { const r = S.result, team = (r.model.players[r.model.pIndex.get(id)] || {}).team, tt = team ? FB.tipTime(day, team) : null; return tt ? hm(new Date(tt).toISOString()) : ''; };
async function opcoesSheet(fetchLive) {
  const nd = nextDay(); if (!S.result || !nd) return;
  const date = nd.date, tip = firstTipOf(nd), during = tip != null && Date.now() >= tip;
  if (during) ensureLive();
  compute();
  const r0 = S.result;
  openSheet('<h3>Sugestões para hoje ' + helpBtn('opcoes') + '</h3><div id="opHead" class="stack">' + (during ? liveHead(nd).html : '') + '</div><div id="opCards" class="stack"><div class="small muted" id="opProg">' + (during ? 'A ler os pontos ao vivo…' : 'A refazer a run…') + '</div></div>');
  if (during && fetchLive !== false && gamesWindow(nd)) { try { await liveFetch(true); } catch (e) { /* sem rede: usa o que há */ } if (!$('opCards')) return; compute(); }
  const r = S.result || r0, cur = view(), d0 = cur.days[0];
  let opts = [];
  if (during) {
    const h = liveHead(nd); $('opHead').innerHTML = h.html;
    if (h.closed || !h.rem.length) { $('opCards').innerHTML = ''; return; }
    const { sub, started, rem, eligIds } = h;
    // só os escolhidos jogam hoje (os outros ficam de fora, para ninguém entrar no lugar)
    const keepOnly = keep => plan => { plan.locks = plan.locks || {}; plan.bans = plan.bans || {}; plan.locks[date] = keep.filter(id => !started.has(id)); plan.bans[date] = eligIds.filter(id => !keep.includes(id) && !started.has(id)); };
    // o plano livre (sem prender o lineup levado): é aqui que aparecem as trocas que valem a pena durante os jogos
    opts.push({ title: 'O que o plano sugere', mod: plan => { if (plan.keep && plan.keep[date]) { plan.keep = Object.assign({}, plan.keep); delete plan.keep[date]; } }, plan: true });
    opts.push({ title: rem.length > 1 ? 'Manter os ' + rem.length + ' que faltam' : 'Manter ' + nameOf(rem[0]), mod: keepOnly(sub) });
    if (rem.length > 1) rem.forEach(x => opts.push({ title: 'Tirar ' + nameOf(x), mod: keepOnly(sub.filter(y => y !== x)) }));
    opts.push({ title: rem.length > 1 ? 'Poupar os ' + rem.length + ' que faltam' : 'Tirar ' + nameOf(rem[0]), mod: keepOnly(sub.filter(y => started.has(y))) });
  } else {
    if (!d0 || d0.date !== date) { $('opCards').innerHTML = '<div class="note info">' + 'Este dia já fechou.' + '</div>'; return; }
    const fixed = (((curPlan().locks || {})[date]) || []).length + (((curPlan().bans || {})[date]) || []).length;
    opts.push({ title: 'O plano' + (fixed ? ' (com as tuas escolhas)' : ''), mod: () => {}, plan: true, now: true });
    if (fixed) opts.push({ title: 'O plano sem as tuas escolhas', mod: altMods.clear(date) });
    // alternativa sem riscos: sem quem está em dúvida hoje (o plano conta com eles a jogar)
    const md0 = r.model.days[0], risky = md0 ? md0.elig.map(pi => r.model.players[pi].id).filter(id => riskOf(md0, id)) : [];
    if (risky.length && d0.lineup.some(id => risky.includes(id))) opts.push({ title: 'Sem riscos de lesão (sem ' + risky.map(lastName).join(', ') + ')', mod: plan => { plan.bans = plan.bans || {}; plan.bans[date] = [...new Set((plan.bans[date] || []).concat(risky))]; if (plan.locks && plan.locks[date]) plan.locks[date] = plan.locks[date].filter(x => !risky.includes(x)); } });
    // com várias contas: quem não pode jogar hoje nesta conta porque a carta que chega já joga noutra fica de fora
    const blk = new Set(md0 ? md0.elig.filter(pi => tierBlocked(r.model.players[pi].id, S.acc, date)) : []);
    const mAlt = blk.size ? Object.assign({}, r.model, { uses: r.model.uses.map((u, i) => (blk.has(i) ? 0 : u)) }) : r.model;
    FB.alternativeSeeds(mAlt, cur).forEach(sd => {
      if (sd.kind === 'allin') opts.push({ title: 'Tudo pelo dia', mod: altMods.fix(date, sd.lineupIdx.map(i => r.model.players[i].id)) });
      else { const id = r.model.players[sd.player].id; opts.push({ title: 'Guardar ' + nameOf(id), mod: altMods.ban(date, id) }); }
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
    $('opCards').innerHTML = (busy ? '<div class="small muted" id="opProg">A refazer a run… ' + res.length + ' de ' + opts.length + '</div>' : '') + list.map((x, k) => {
      const ins = x.a0.lineup.filter(id => !base.includes(id)), outs = base.filter(id => !x.a0.lineup.includes(id));
      const later = outs.map(id => { const ds = x.ev.res.days.filter(dd => dd.date !== date && dd.lineup.includes(id)).map(dd => dd.idx + 1); return ds.length ? esc(lastName(id)) + ' fica para ' + (ds.length > 1 ? 'os dias ' : 'o dia ') + ds.join(', ') : ''; }).filter(Boolean);
      const tag = x === best ? '<span class="small up">o melhor</span>' : isNow(x) ? '<span class="small muted">o que tens</span>' : '';
      return '<div class="card panel op-card' + (x === best ? ' best' : '') + '"><div class="list-head" style="padding:0"><h2>' + esc(x.title) + '</h2>' + tag + '</div>' +
        '<div class="small">Hoje <b class="num c-' + tone(x.a0.P) + '">' + pct(x.a0.P) + '</b> · resto da run ≈ <b class="num">' + f1(x.ev.res.days.filter(dd => dd.date !== date).reduce((t, dd) => t + (dd.P || 0), 0)) + '</b> vitórias</div>' +
        (r.prizes.length ? '<div class="small muted">Prémios: ' + prizeTxt(x.ev.res) + '</div>' : '') +
        (() => { const rk = !during && r.model.days[0] ? x.a0.lineup.filter(id => riskOf(r.model.days[0], id)) : []; return rk.length ? '<div class="small c-warn">⚠ Conta com ' + rk.map(id => esc(lastName(id))).join(', ') + ' a jogar (' + esc((INJ_LABEL[(injRec(rk[0]) || {}).status] || 'dúvida').toLowerCase()) + ').</div>' : ''; })() +
        ((ins.length || outs.length) ? '<div class="small muted">' + cap([outs.length ? 'sai ' + outs.map(id => esc(lastName(id)) + (during && tipOf(nd, id) ? ' (' + tipOf(nd, id) + ')' : '')).join(', ') : '', ins.length ? 'entra ' + ins.map(id => esc(lastName(id))).join(', ') : ''].filter(Boolean).join(' · ')) + (later.length ? '. ' + later.join(' · ') : '') + '.</div>' : '') +
        (x.same && x.same.length ? '<div class="small muted">Dá o mesmo lineup: ' + x.same.map(esc).join(', ') + '</div>' : '') +
        (isNow(x) ? '' : '<button class="btn' + (x === best ? ' primary' : '') + '" type="button" data-action="op-use" data-i="' + k + '">Escolher</button>') + '</div>';
    }).join('') + (busy || list.length ? '' : '<div class="note info">Não deu para refazer a run.</div>') +
      (!busy && failed.length ? '<div class="small muted">Não deu para calcular: ' + failed.map(esc).join(', ') + '.</div>' : '');
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
  if (next.length > size) { toast('Máximo ' + size + ' jogadores.'); return; }
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
  toast(during && (outs.length || ins.length) ? 'No Top Shot: ' + [outs.length ? 'tira ' + outs.map(lastName).join(', ') : '', ins.length ? 'põe ' + ins.map(lastName).join(', ') : ''].filter(Boolean).join(' e ') + ' antes do jogo.' : 'Feito. O resto da run foi refeito.');
}

// ---- Run ----
function renderRun() {
  const el = $('tab-run');
  if (!guard(el, true)) return;
  const r = S.result, v = view(), sub = subOf('run'), html = [subBar('run')];
  if (sub === 'contas' && S.multi) {
    const g = S.multi, P = mainResult().prizes;
    html.push('<div class="card"><div class="list-head"><h2>As tuas contas ' + helpBtn('contas') + '</h2><span class="small muted">plano conjunto</span></div><ul class="list">' + g.keys.map(k => { const rk = g.byKey[k], vk = rk.normal;
      return '<li><button class="row" type="button" data-action="acc-run" data-acc="' + esc(k) + '"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(accLabel(k)) + '</span></div><div class="ps">' + recordTxt(rk.wins, rk.losses) + ' · esperadas ' + f1(rk.wins + vk.expected) + '</div></div>' + (P.length ? miniAros(P, vk.prizeProbs) : '') + '</button></li>'; }).join('') + '</ul></div>');
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
const goalHtml = day => { const l = ((day || {}).objectives || []).filter(o => o && o.stat); return l.length ? l.map(o => esc(objOne(o))).join('<small> e </small>') : esc('Objetivo por definir'); };
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
      chip = '<span class="pchip num ' + (win ? 'p-good' : 'p-bad') + '">' + (tot ? tot.map(f0).join('·') : resMark(pl.result)) + '<span class="vh"> ' + (win ? 'vitória' : 'derrota') + '</span></span>';
    } else if (d) {
      names = d.lineup;
      if (now && liveOn(day.date)) note = 'ao vivo';
      chip = d.noObjective || !d.lineup.length ? '<span class="pchip pred p-done">—</span>' : '<span class="pchip pred p-' + dTone(d.P) + ' num">' + pct(d.P) + '</span>'; // previsão: só a cor no número
    } else {
      const lu = pl && pl.noAuto ? null : lineupFor(S.acc, day.date);
      names = lu || []; note = lu ? 'à espera das estatísticas' : 'sem resultado';
      chip = '<span class="pchip p-done">' + (lu ? '…' : '—') + '</span>';
    }
    const md = d ? r.model.days.find(m => m.day.date === day.date) : null, hurt = md ? lineupInjured(r, md, d.lineup).length : 0;
    const sub = [dShort(day.date), note, names.length ? names.map(id => esc(lastName(id))).join(' · ') : (pl && pl.done) || note ? '' : 'sem jogadores'].filter(Boolean).join(' · ');
    return '<li' + (now ? ' class="is-next"' : '') + '><button class="drow" type="button" data-action="day" data-date="' + day.date + '"><span class="dn">' + (i + 1) + '<small>' + (now ? 'Hoje' : dWeek(day.date)) + '</small></span>' +
      '<span style="min-width:0"><span class="d1"><b>' + goalHtml(day) + '</b>' + (hurt ? '<span class="pill duv">lesão</span>' : '') + '</span>' +
      '<span class="d2" style="display:block">' + sub + '</span></span>' + chip + '</button></li>';
  }).join('');
  return '<div class="card"><div class="list-head"><h2>Dias ' + helpBtn('dias') + '</h2><span class="small muted">' + recordTxt(r.wins, r.losses) + '</span></div><ul class="list">' + rows + '</ul></div>';
}
// Placar da run: vitórias e derrotas, e um aro por patamar de prémio com a probabilidade em palavras
function runBoard(r, v) {
  const left = r.model.days.length, P = r.prizes;
  const head = '<div class="hero-top"><span class="eyebrow">' + (S.multi ? esc(accLabel(S.acc)) : 'A tua run') + ' ' + helpBtn('premios') + '</span><span class="small">' + (left ? plural(left, 'dia por jogar', 'dias por jogar') : 'run terminada') + '</span></div>';
  const rec = '<div class="rec-big num">' + r.wins + '<small>' + (r.wins === 1 ? 'vitória' : 'vitórias') + '</small>' + r.losses + '<small>' + (r.losses === 1 ? 'derrota' : 'derrotas') + '</small></div>';
  if (!P.length) return '<div class="card hero run-board">' + head + rec + '<div class="small">Esperadas no fim: <b>' + f1(r.wins + v.expected) + '</b> de ' + S.days.length + '.' + (S.role === 'admin' ? ' Define os prémios em Ajustes → Admin.' : '') + '</div></div>';
  const cols = P.map((p, i) => { const x = v.prizeProbs[i], need = p.wins - r.wins;
    return '<div class="aro-col">' + aro(x, p.wins, 64, likely(x)) + '<div><div class="pc num">' + pct(x) + '</div><div class="lk">' + likely(x) + '</div><div class="nd small">' + (need <= 0 ? 'já está' : need > left ? 'já não dá' : 'faltam ' + need + ' em ' + left) + '</div></div></div>'; }).join('');
  const withP = P.map((p, i) => [p, v.prizeProbs[i]]), sure = withP.filter(([, x]) => x >= 0.5).pop(), up = withP.find(([, x]) => x < 0.5);
  const line = sure ? 'A caminho do prémio das <b>' + sure[0].wins + ' vitórias</b>' + (up ? '; o das ' + up[0].wins + ' está em ' + pct(up[1]) + '.' : '.') : up ? 'O prémio mais perto é o das <b>' + up[0].wins + ' vitórias</b>: ' + likely(up[1]).toLowerCase() + '.' : '';
  const sh = r.model.prizeShift || {}, shTxt = (sh.dropped || []).length ? '<div class="small muted">Já não dá: ' + sh.dropped.join(' e ') + ' vitórias' + (sh.added.length ? '. Passa a contar: ' + sh.added.slice().sort((a, b) => a - b).join(' e ') + ' vitórias' : '') + '.</div>' : '';
  return '<div class="card hero run-board">' + head + rec + '<div class="aros">' + cols + '</div>' + (line ? '<div class="small">' + line + '</div>' : '') + shTxt + '</div>';
}
// Quantas vitórias no fim da run: probabilidade de cada total, com as zonas de prémio
function distCard(r, v) {
  const dist = v.winDist || [], P = r.prizes, base = r.wins;
  if (dist.length < 2) return '';
  const max = Math.max(...dist), modeK = dist.indexOf(max), n = P.length;
  const cls = i => (n === 1 ? 'z3' : n === 2 ? ['z2', 'z3'][i] : ['z1', 'z2', 'z3'][Math.min(2, i)]);
  const zone = w => { let z = -1; P.forEach((p, i) => { if (w >= p.wins) z = i; }); return z; };
  const bars = dist.map((x, k) => { const w = base + k, z = zone(w); return '<i class="' + (z >= 0 ? cls(z) : '') + (k === modeK ? ' mode' : '') + '" style="height:' + Math.max(2, x / max * 100).toFixed(1) + '%" title="' + w + ' vitórias: ' + pct(x) + '"></i>'; }).join('');
  const xs = dist.map((x, k) => { const w = base + k; return '<span class="' + (P.some(p => p.wins === w) ? 'tier' : '') + '">' + w + '</span>'; }).join('');
  const legend = P.map((p, i) => '<span><i class="' + cls(i) + '" style="background:var(--ball);opacity:' + [0.45, 0.72, 1][n === 1 ? 2 : n === 2 ? i + 1 : Math.min(2, i)] + '"></i>' + p.wins + ' ou mais' + (p.label ? ' · ' + esc(p.label) : '') + '</span>').join('') +
    '<span><i style="outline:2px solid var(--ink);background:transparent"></i>mais provável: ' + (base + modeK) + ' (' + pct(max) + ')</span>';
  return '<div class="card"><div class="list-head"><h2>Vitórias no fim ' + helpBtn('dist') + '</h2><span class="small muted">esperadas ' + f1(base + v.expected) + '</span></div>' +
    '<div class="dist" role="img" aria-label="Probabilidade de cada número de vitórias no fim da run; o mais provável é ' + (base + modeK) + '">' + bars + '</div><div class="dist-x" aria-hidden="true">' + xs + '</div><div class="dist-legend">' + legend + '</div></div>';
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
const spans = ns => { const a = [...new Set(ns)].sort((x, y) => x - y), out = []; for (let i = 0; i < a.length; i++) { let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; if (j - i >= 2) out.push(a[i] + '–' + a[j]); else for (let k = i; k <= j; k++) out.push(String(a[k])); i = j; } return out.length > 1 ? out.slice(0, -1).join(', ') + ' e ' + out[out.length - 1] : out.join(''); };
const signPct = x => (x > 0.005 ? '+' : x < -0.005 ? '−' : '') + Math.abs(Math.round(x * 100)) + '%';
function analiseHtml() {
  const A = analysisData(S.acc), rows = A.rows, html = [];
  const wn = A.waiting.map(d => S.days.findIndex(x => x.date === d) + 1).filter(n => n > 0);
  const waitTxt = wn.length ? 'Previsões à espera dos jogos: ' + (wn.length === 1 ? 'dia ' : 'dias ') + spans(wn) + '.' : '';
  if (!rows.length && !A.obs.length) return '<div class="card panel"><h2>Análise ' + helpBtn('analise') + '</h2><div class="small muted">Aparece depois dos primeiros dias jogados. ' + esc(waitTxt) + '</div></div>';
  if (rows.length) {
    const exp = rows.reduce((s, x) => s + x.P, 0), wins = rows.filter(x => x.win).length, fav = rows.filter(x => (x.P >= 0.5) === x.win).length;
    const tot = rows.filter(x => x.pred != null && x.actual != null), inside = tot.filter(x => x.sd > 0 && Math.abs(x.actual - x.pred) <= x.sd).length;
    const bias = tot.length ? tot.reduce((s, x) => s + (x.actual - x.pred) / Math.max(1, x.pred), 0) / tot.length : null;
    const buckets = [[0, 0.35, 'Menos de 35%'], [0.35, 0.65, '35% a 65%'], [0.65, 1.01, 'Mais de 65%']].map(([lo, hi, l]) => { const b = rows.filter(x => x.P >= lo && x.P < hi); return b.length ? { l, n: b.length, p: b.reduce((s, x) => s + x.P, 0) / b.length, w: b.filter(x => x.win).length } : null; }).filter(Boolean);
    html.push('<div class="card hero an-board"><div class="hero-top"><span class="eyebrow">' + (S.multi ? esc(accLabel(S.acc)) + ' · ' : '') + 'Previsto vs real ' + helpBtn('analise') + '</span><span class="small">' + plural(rows.length, 'dia fechado', 'dias fechados') + '</span></div>' +
      '<div class="an-kpis"><div><div class="label">Vitórias</div><div class="v num">' + wins + '<small> de ' + rows.length + '</small></div><div class="small">previstas ' + f1(exp) + '</div></div>' +
      '<div><div class="label">Favorito</div><div class="v num">' + fav + '<small> de ' + rows.length + '</small></div><div class="small">acertou quem ganhava</div></div>' +
      (tot.length ? '<div><div class="label">Total</div><div class="v num">' + inside + '<small> de ' + tot.length + '</small></div><div class="small">perto do previsto (normal: 7 em 10)</div></div>' : '') + '</div>' +
      '<div class="small">' + (bias != null ? 'Totais: <b>' + signPct(bias) + '</b> face ao previsto. ' : '') + (rows.length >= 4 ? (Math.abs(wins - exp) <= Math.max(1, Math.sqrt(rows.reduce((s, x) => s + x.P * (1 - x.P), 0))) ? 'Vitórias dentro do esperado.' : wins > exp ? 'Mais vitórias do que o previsto.' : 'Menos vitórias do que o previsto.') : 'Ainda poucos dias para tirar conclusões.') + '</div></div>');
    if (buckets.length > 1) html.push('<div class="card"><div class="list-head"><h2>A previsão acerta?</h2><span class="small muted">dias agrupados pela vitória prevista</span></div><ul class="list">' + buckets.map(b => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + b.l + '</span></div><div class="ps">' + plural(b.n, 'dia', 'dias') + ' · previsto em média ' + pct(b.p) + '</div></div><div class="pv"><div class="v num">' + Math.round(b.w / b.n * 100) + '%</div><div class="u">' + b.w + ' de ' + b.n + ' ganhos</div></div></li>').join('') + '</ul></div>');
    html.push('<div class="card"><div class="list-head"><h2>Dia a dia</h2><span class="small muted">previsto · feito</span></div><ul class="list">' + rows.map(x => {
      const diff = x.pred != null && x.actual != null ? x.actual - x.pred : null;
      return '<li><button class="drow" type="button" data-action="day" data-date="' + x.date + '"><span class="dn">' + (x.i + 1) + '<small>' + dWeek(x.date) + '</small></span><span style="min-width:0"><span class="d1"><b>' + esc(objsText(S.days[x.i])) + '</b><span class="small muted">previsto ' + pct(x.P) + (x.same ? '' : ' · lineup mudado') + '</span></span><span class="d2" style="display:block">' +
        (x.pred != null ? 'total previsto ' + f0(x.pred) + (x.actual != null ? ' · feito <b>' + f0(x.actual) + '</b> <span class="' + (diff >= 0 ? 'good-t' : 'warn-t') + '">(' + (diff >= 0 ? '+' : '−') + f0(Math.abs(diff)) + ')</span>' : ' · feito por saber') : 'sem previsão para o lineup jogado') + '</span></span>' +
        '<span class="pchip ' + (x.win ? 'p-good' : 'p-bad') + '">' + (x.win ? 'V' : 'D') + '</span></button></li>'; }).join('') + '</ul></div>');
  }
  const obs = A.obs;
  if (obs.length) {
    const byP = new Map(); obs.forEach(x => { (byP.get(x.id) || byP.set(x.id, []).get(x.id)).push(x); });
    const pr = [...byP.entries()].map(([id, l]) => ({ id, R: ratioOf(l), dnp: l.filter(x => x.act == null).length, n: l.length })).filter(x => x.R && x.R.n >= 2);
    const up = pr.filter(x => x.R.r >= 1.12).sort((a, b) => b.R.r - a.R.r).slice(0, 6), down = pr.filter(x => x.R.r <= 0.88).sort((a, b) => a.R.r - b.R.r).slice(0, 6);
    const prow = x => '<li><button class="row" type="button" data-action="pform" data-id="' + esc(x.id) + '"><span class="who">' + face(x.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(x.id)) + '</span></div><div class="ps">' + plural(x.R.n, 'jogo', 'jogos') + (x.dnp ? ' · faltou a ' + x.dnp : '') + '</div></div></span><span class="delta ' + (x.R.r >= 1 ? 'up' : 'down') + ' num">' + signPct(x.R.r - 1) + '<small>vs previsto</small></span></button></li>';
    if (up.length || down.length) html.push('<div class="card"><div class="list-head"><h2>Jogadores</h2><span class="small muted">o que fizeram face ao previsto</span></div><ul class="list">' + up.map(prow).join('') + down.map(prow).join('') + '</ul></div>');
    const odds = ratioOf(obs.filter(x => x.src === 'o')), avgs = ratioOf(obs.filter(x => x.src === 'a')), b2b = ratioOf(obs.filter(x => x.b2b)), rest = ratioOf(obs.filter(x => !x.b2b));
    const miss = obs.filter(x => x.act == null), missQ = miss.length ? miss.reduce((s, x) => s + x.q, 0) / miss.length : null;
    const line = (l, R, note) => R ? '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + l + '</span></div><div class="ps">' + plural(R.n, 'jogo', 'jogos') + ' · erro médio ' + Math.round(R.err * 100) + '%' + (note ? ' · ' + note : '') + '</div></div><div class="pv"><div class="v num">' + Math.round(R.r * 100) + '%</div><div class="u">do previsto</div></div></li>' : '';
    html.push('<div class="card"><div class="list-head"><h2>De onde veio a previsão</h2><span class="small muted">' + plural(obs.length, 'jogo', 'jogos') + '</span></div><ul class="list">' +
      line('Com odds', odds, 'linhas das casas de apostas') + line('Só com médias', avgs, 'sem linha para esse jogador') + line('Jogos seguidos (2.º dia)', b2b, b2bOn ? 'o plano tira ~3% sem odds' : 'ajuste desligado') + line('Com descanso', rest) +
      (miss.length ? '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">Não jogaram</span></div><div class="ps">' + plural(miss.length, 'vez', 'vezes') + ' · o plano dava-lhes em média ' + pct(missQ) + ' de jogar</div></div></li>' : '') +
      '</ul></div>');
  }
  if (waitTxt) html.push('<p class="small muted" style="margin:0 4px">' + esc(waitTxt) + '</p>');
  return html.join('');
}
// folha de um dia fechado: previsto ao lado do real, jogador a jogador
// lineup de um dia sem previsão guardada nesta conta (ex.: a smurf jogou num dia em que o plano não lhe dava lineup):
// o que cada um fez e, se outra conta guardou a previsão desse jogador, o previsto
S.luBoxAt = {};
function lineupDoneRows(date, lineup, objs) {
  if (!lineup.length) return '';
  const units = objs.map(o => esc(statShort(o.stat))), many = objs.length > 1;
  const predOf = id => { for (const a of accounts()) { const sn = (planOf(a.id).proj || {})[date]; if (sn && sn.pl && sn.pl[id] && (sn.o || []).map(x => x.stat).join() === objs.map(x => x.stat).join()) return sn.pl[id][0]; } return null; };
  const vals = lineup.map(id => (objs.length ? valsFor(S.acc, date, id, objs) : undefined));
  // valores que faltam: lê as fichas dos jogos desses jogadores (no máximo de 2 em 2 minutos)
  if (objs.length && vals.some(v => v === undefined) && Date.now() - (S.luBoxAt[date] || 0) > 120e3) {
    S.luBoxAt[date] = Date.now();
    setTimeout(() => { boxLoad(date, new Set(lineup.map(pTeam).filter(Boolean))).then(() => { if (S.tab === 'hoje') renderHoje(); }); }, 0);
  }
  return lineup.map((id, i) => {
    const a = vals[i], pr = predOf(id);
    const v = a === undefined ? '<div class="pv"><div class="v num muted">…</div></div>' : a === null ? '<div class="pv"><div class="small muted" style="font-weight:600">não jogou</div></div>' :
      many ? '<div class="pv pv-multi">' + objs.map((o, k) => '<div><b class="num">' + f1(a[k] || 0) + '</b><span class="u">' + units[k] + '</span></div>').join('') + '</div>' :
      '<div class="pv"><div class="v num">' + f1(a[0]) + '</div><div class="u">' + (pr ? '<span class="' + (a[0] >= pr[0] ? 'good-t' : 'warn-t') + '">' + (a[0] >= pr[0] ? '+' : '−') + f1(Math.abs(a[0] - pr[0])) + '</span>' : units[0]) + '</div></div>';
    return '<li class="row"><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(id)) + '</span></div>' +
      (pr ? '<div class="ps">previsto ' + pr.map((x, k) => f1(x) + (many ? ' ' + units[k] : '')).join(' · ') + '</div>' : '') + '</div></span>' + v + '</li>';
  }).join('');
}
function predVsActualHtml(date) {
  const sn = (curPlan().proj || {})[date]; if (!sn || !(sn.o || []).length) return '';
  const pl = ((curPlan().played || {})[date]) || {}, act = sn.act || {}, o = sn.o[0], u = esc(statShort(o.stat)), many = sn.o.length > 1;
  const lineup = (pl.lineup || []).length ? pl.lineup : (lineupFor(S.acc, date) || sn.lineup);
  const units = sn.o.map(x => esc(statShort(x.stat)));
  const val = a => (a === undefined ? '<div class="v num muted">…</div>' : a === null ? '<div class="small muted" style="font-weight:600">não jogou</div>' : '<div class="v num">' + f1(a[0]) + '</div>');
  // dia de combinação: um valor por estatística, empilhados
  const valMany = a => (a === undefined || a === null ? '<div class="pv">' + val(a) + '</div>' : '<div class="pv pv-multi">' + sn.o.map((x, k) => '<div><b class="num">' + f1(a[k] || 0) + '</b><span class="u">' + units[k] + '</span></div>').join('') + '</div>');
  const rows = lineup.map(id => { const x = sn.pl[id], a = act[id], d = x && a ? a[0] - x[0][0] : null;
    return '<li class="row"><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(id)) + '</span>' + (x && x[3] ? '<span class="badge">2.º seguido</span>' : '') + '</div><div class="ps">previsto ' + (x ? (many ? sn.o.map((z, k) => f1(x[0][k] || 0) + ' ' + units[k]).join(' · ') : f1(x[0][0])) + (x[4] < 1 ? ' (' + pct(x[4]) + ' de jogar)' : '') + ' · ' + (x[2] === 'o' ? 'odds' : 'médias') : '—') + '</div></div></span>' +
      (many ? valMany(a) : '<div class="pv">' + val(a) + '<div class="u">' + (d != null ? '<span class="' + (d >= 0 ? 'good-t' : 'warn-t') + '">' + (d >= 0 ? '+' : '−') + f1(Math.abs(d)) + '</span>' : u) + '</div></div>') + '</li>'; }).join('');
  const others = Object.entries(sn.pl).filter(([id]) => !lineup.includes(id) && act[id]).map(([id, x]) => ({ id, d: act[id][0] - x[0][0], a: act[id][0] })).filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
  const A = analysisData(S.acc).rows.find(x => x.date === date);
  let kv;
  if (many) {
    // por estatística: previsto para o lineup que jogou, alvo e feito
    const allKnown = lineup.length && lineup.every(id => sn.pl[id]), allAct = lineup.length && lineup.every(id => act[id] !== undefined);
    kv = '<div><div class="label">Vitória prevista</div><div class="v num">' + pct(sn.P) + '</div></div>' + sn.o.map((x, k) => {
      const pred = allKnown ? lineup.reduce((t, id) => t + sn.pl[id][4] * (sn.pl[id][0][k] || 0), 0) : x.mu;
      const done = allAct ? lineup.reduce((t, id) => t + (act[id] ? act[id][k] || 0 : 0), 0) : null;
      return '<div><div class="label">' + units[k] + ' · alvo ' + x.T + '</div><div class="v num' + (done != null ? (done >= x.T ? ' up' : ' down') : '') + '">' + (done != null ? f0(done) : '…') + '</div><div class="small muted">previsto ' + f0(pred) + '</div></div>';
    }).join('');
  } else kv = '<div><div class="label">Vitória prevista</div><div class="v num">' + pct(sn.P) + '</div></div><div><div class="label">Total previsto</div><div class="v num">' + (A && A.pred != null ? f0(A.pred) : f0(o.mu)) + '</div><div class="small muted">± ' + f0(A && A.sd != null ? A.sd : o.sd) + ' · alvo ' + o.T + '</div></div><div><div class="label">Feito</div><div class="v num">' + (A && A.actual != null ? f0(A.actual) : '…') + '</div></div>';
  return '<div class="card"><div class="list-head"><h2>Previsto vs real</h2><span class="small muted">previsão das ' + esc(hm(sn.at)) + '</span></div>' +
    '<div class="kv" style="padding:0 14px 10px">' + kv + '</div>' +
    '<ul class="list">' + rows + '</ul>' + (others.length ? '<div class="row small muted" style="display:block">Fora do lineup, quem fez mais do que o previsto' + (many ? ' em ' + u : '') + ': ' + others.map(x => esc(lastName(x.id)) + ' ' + f1(x.a) + ' (+' + f1(x.d) + ')').join(' · ') + '.</div>' : '') +
    (A && !A.same ? '<div class="row small muted" style="display:block">O lineup jogado não foi o da previsão: o total previsto é o dos jogadores que jogaram.</div>' : '') + '</div>';
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
  if (!H || H.loading) { if (!H) setTimeout(loadHistory, 0); return '<div class="note info">A ler o teu histórico…</div>'; }
  if (H.err) return '<div class="note">Não consegui ler o histórico: ' + esc(H.err) + '</div>';
  const res = H.res.filter(x => x.win != null), html = [];
  const F = statFrequency();
  if (!res.length && !(F && F.days)) return '<div class="card panel"><h2>Histórico ' + helpBtn('historico') + '</h2><div class="small muted">Ainda sem dias lidos da blockchain. Volta daqui a umas horas.</div></div>';
  const W = res.filter(x => x.win).length, runsSeen = new Set(res.map(x => x.chain_run_id));
  const accN = new Set(res.map(x => x.account || 'main')).size;
  html.push('<div class="card hero an-board"><div class="hero-top"><span class="eyebrow">O teu Fast Break ' + helpBtn('historico') + '</span><span class="small">' + plural(runsSeen.size, 'run', 'runs') + (accN > 1 ? ' · ' + accN + ' contas' : '') + '</span></div>' +
    '<div class="an-kpis"><div><div class="label">Dias jogados</div><div class="v num">' + res.length + '</div></div><div><div class="label">Vitórias</div><div class="v num">' + W + '</div><div class="small">' + (res.length ? Math.round(W / res.length * 100) + '% dos dias' : '') + '</div></div></div></div>');
  // estatísticas: quantas vezes saem, alvo típico e como te corre cada uma
  if (F && F.stats.length) {
    const mine = {}; res.forEach(x => { const g = H.games.get(x.game_id); gameObjs(g).forEach(o => { const e = (mine[o.stat] = mine[o.stat] || { n: 0, w: 0 }); e.n++; if (x.win) e.w++; }); });
    const max = F.stats[0].n;
    html.push('<div class="card"><div class="list-head"><h2>Estatísticas que mais saem</h2><span class="small muted">' + F.days + ' dias' + (F.classic ? ' Classic' : '') + ' · ' + plural(F.runs, 'run', 'runs') + '</span></div><ul class="list">' + F.stats.slice(0, 12).map(e => { const m = mine[e.stat];
      return '<li class="row hist-stat"><div style="min-width:0;flex:1"><div class="pn"><span class="nm">' + esc(statLabel(e.stat)) + '</span><span class="small muted">' + Math.round(e.n / F.days * 100) + '% dos dias</span></div><div class="hbar" aria-hidden="true"><i style="width:' + Math.max(3, e.n / max * 100).toFixed(1) + '%"></i></div>' +
        '<div class="ps">' + (e.med != null ? 'alvo típico <b class="num">' + f0(e.med) + '</b>' + (e.lo !== e.hi ? ' (' + f0(e.lo) + '–' + f0(e.hi) + ')' : '') : '') + (e.each ? (e.med != null ? ' · ' : '') + e.each + '× por jogador' : '') + (m ? ' · tu: ' + m.w + ' de ' + m.n + ' ganhos' : '') + '</div></div><div class="pv"><div class="v num">' + e.n + '</div><div class="u">dias</div></div></li>'; }).join('') + '</ul>' +
      '</div>');
  }
  if (res.length) {
    // jogadores que mais usaste
    const pu = {}; res.forEach(x => (x.lineup || []).filter(Boolean).forEach(n => { const e = (pu[n] = pu[n] || { n: 0, w: 0 }); e.n++; if (x.win) e.w++; }));
    const top = Object.entries(pu).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    if (top.length) html.push('<div class="card"><div class="list-head"><h2>Os jogadores que mais usaste</h2><span class="small muted">dias ganhos com ele</span></div><ul class="list">' + top.map(([n, e]) => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(n) + '</span></div><div class="ps">' + plural(e.n, 'dia', 'dias') + '</div></div><div class="pv"><div class="v num">' + Math.round(e.w / e.n * 100) + '%</div><div class="u">' + e.w + ' de ' + e.n + '</div></div></li>').join('') + '</ul></div>');
    // runs
    const byRun = {}; res.forEach(x => { const k = x.chain_run_id || '?'; const e = (byRun[k] = byRun[k] || { id: k, acc: {} }); const a = (e.acc[x.account || 'main'] = e.acc[x.account || 'main'] || { w: 0, l: 0 }); x.win ? a.w++ : a.l++; });
    const runs = Object.values(byRun).map(e => Object.assign(e, { r: H.runs.get(e.id) || {} })).sort((a, b) => (+b.r.run_start || 0) - (+a.r.run_start || 0));
    html.push('<div class="card"><div class="list-head"><h2>Runs</h2><span class="small muted">vitórias – derrotas</span></div><ul class="list">' + runs.map(e => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(e.r.name || 'Run ' + String(e.id).slice(0, 8)) + '</span></div><div class="ps">' + (e.r.run_start ? dShort(new Date(e.r.run_start * 1000).toISOString().slice(0, 10)) + (e.r.run_end ? ' – ' + dShort(new Date((e.r.run_end - 12 * 3600) * 1000).toISOString().slice(0, 10)) : '') : '') + '</div></div><div class="pv" style="text-align:right">' + Object.entries(e.acc).map(([k, a]) => '<div class="small"><span class="muted">' + (accN > 1 ? esc(accLabel(k)) + ' ' : '') + '</span><b class="num">' + a.w + '–' + a.l + '</b></div>').join('') + '</div></li>').join('') + '</ul></div>');
  }
  return html.join('');
}

// ---- Plantel ----
// seletor de conta (só com contas smurf)
function accSwitch() {
  if (!groupMode()) return '';
  return '<div class="seg acc-seg" role="group" aria-label="Conta">' + accounts().map(a => '<button type="button" data-action="acc" data-acc="' + esc(a.id) + '" aria-pressed="' + (S.acc === a.id) + '">' + esc(a.label) + '</button>').join('') + '</div>';
}
// coleção (lida das carteiras; não depende de haver run)
function collectionCard(compact) {
  const col = (S.profile || {}).collection, accs = accounts(), withFlow = accs.filter(a => /^0x[0-9a-fA-F]{16}$/.test((a.flow || '').trim()));
  if (!col) return '<div class="card panel"><h2>A tua coleção ' + helpBtn('colecao') + '</h2><div class="small muted">' + (withFlow.length ? 'Lê os teus Moments da blockchain.' : 'Põe o endereço Flow em Ajustes → Perfil para ler os teus Moments.') + '</div>' +
    (withFlow.length ? '<button class="btn primary" type="button" data-action="wallet-sheet">Ler carteira' + (withFlow.length > 1 ? 's' : '') + '</button>' : '<button class="btn" type="button" data-action="goto" data-tab="ajustes" data-sub="perfil">Ir a Ajustes</button>') + '</div>';
  const n = Object.keys(col.players || {}).length;
  const tot = Object.entries(col.accounts || {}).map(([k, t]) => (groupMode() ? esc(accLabel(k)) + ' ' : '') + t.moments + ' Moments').join(' · ');
  if (compact) return '<div class="card panel"><div class="list-head"><h2>A tua coleção</h2><span class="small muted">lida ' + esc(ago(col.read_at)) + '</span></div><div class="small muted">' + tot + ' · ' + n + ' jogadores na NBA</div><div class="btns"><button class="btn" type="button" data-action="wallet-sheet">Ler de novo</button><button class="btn" type="button" data-action="col-sheet">Ver coleção</button></div></div>';
  const rows = colRows();
  return colSummary(col) + '<div class="card"><div class="list-head"><h2>Jogadores</h2><span class="small muted" id="colCount">' + S.colN + ' jogadores</span></div>' + colToolbar() + '<ul class="list" id="colList">' + rows + '</ul></div>';
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
  const bar = sum ? '<div class="tier-bar" role="img" aria-label="Moments por escalão">' + TIERS.slice().reverse().filter(t => tt[t]).map(t => '<i class="t-' + TIER_CLS[t] + '" style="flex:' + tt[t] + '"></i>').join('') + '</div>' +
    '<div class="tier-legend">' + TIERS.slice().reverse().filter(t => tt[t]).map(t => '<span><i class="t-' + TIER_CLS[t] + '"></i>' + t + ' <b class="num">' + tt[t] + '</b></span>').join('') + '</div>' : '';
  const accLine = groupMode() ? '<div class="small muted">' + Object.entries(col.accounts || {}).map(([k, t]) => esc(accLabel(k)) + ' <b>' + t.moments + '</b>' + (t.listed ? ' (' + t.listed + ' à venda)' : '')).join(' · ') + '</div>' : '';
  return '<div class="card panel col-sum"><div class="list-head" style="padding:0"><h2>A tua coleção ' + helpBtn('colecao') + '</h2><span class="small muted">lida ' + esc(ago(col.read_at)) + '</span></div>' +
    '<div class="col-kpis"><div><b class="num">' + f0(moments) + '</b><span>Moments</span></div><div><b class="num">' + ps.length + '</b><span>jogadores na NBA</span></div><div><b class="num">' + (col.sets ? f0(uses) : '–') + '</b><span>usos por run</span></div></div>' +
    bar + accLine + (col.sets ? '' : '<div class="note info">Lê a carteira outra vez para veres o escalão de cada Moment.</div>') +
    (col.sets && col.items && Object.values(col.items).some(it => it && !it.d) ? '<div class="note info">Antes da próxima run, carrega em <b>Ler de novo</b>: assim cada carta fica com a raridade e o ASP certos do Top Shot.</div>' : '') +
    '<button class="btn" type="button" data-action="wallet-sheet">Ler de novo</button></div>';
}
// ---- coleção: lista de jogadores com procura, ordem e filtro por escalão ----
S.colView = { q: '', sort: 'uses', tier: '' };
function colToolbar() {
  const V = S.colView, col = (S.profile || {}).collection || {};
  const has = {}; Object.values(col.players || {}).forEach(c => Object.keys(tierCounts(col, c)).forEach(t => { has[t] = 1; }));
  return '<div class="col-tools"><input class="field" id="colSearch" type="search" placeholder="Procurar jogador ou equipa…" value="' + esc(V.q) + '" autocomplete="off" aria-label="Procurar na coleção">' +
    '<div class="chips scroll" role="group" aria-label="Ordenar">' + [['uses', 'Mais usos'], ['pts', 'Mais pontos'], ['moments', 'Mais Moments']].map(([k, l]) => '<button type="button" data-action="col-sort" data-v="' + k + '" aria-pressed="' + (V.sort === k) + '">' + l + '</button>').join('') + '</div>' +
    // Common, Rare e Legendary sempre (mesmo sem nenhum); os outros escalões só se houver
    ('<div class="chips scroll" role="group" aria-label="Escalão"><button type="button" data-action="col-tier" data-v="" aria-pressed="' + !V.tier + '">Todos</button>' + TIERS.slice().reverse().filter(t => has[t] || ['Common', 'Rare', 'Legendary'].includes(t)).map(t => '<button type="button" data-action="col-tier" data-v="' + t + '" aria-pressed="' + (V.tier === t) + '">' + t + '</button>').join('') + '</div>') + '</div>';
}
function colRows() {
  const col = (S.profile || {}).collection; if (!col) return '';
  const V = S.colView, qn = norm(V.q), roster = (S.runId && S.mine && S.mine.roster) || null;
  let list = Object.entries(col.players || {}).map(([id, c]) => { const p = S.players.get(String(id)) || { name: c.name, team: '' }; return { id, c, p, tc: tierCounts(col, c), uses: tierUsesOf(col, c), pts: (p.avg && +p.avg.pts) || 0 }; });
  if (qn) list = list.filter(x => norm(x.p.name || x.c.name).includes(qn) || String(x.p.team || '').toLowerCase().includes(qn));
  if (V.tier) list = list.filter(x => x.tc[V.tier]);
  const by = { uses: (a, b) => ((b.uses || 0) - (a.uses || 0)) || (b.pts - a.pts), pts: (a, b) => b.pts - a.pts, moments: (a, b) => (b.c.moments - a.c.moments) || (b.pts - a.pts), name: (a, b) => String(a.p.name || '').localeCompare(String(b.p.name || '')) };
  list.sort(by[V.sort] || by.uses);
  S.colN = list.length; const cnt = $('colCount'); if (cnt) cnt.textContent = list.length + ' jogadores';
  if (!list.length) return '<li class="row small muted">Nenhum jogador com esse filtro.</li>';
  return list.map(({ id, c, p, tc, uses }) => {
    const inR = roster && roster[id];
    // cartas: escalão e conta de cada uma (Rare · Main, Common ×2 · Terose)
    const g = {}; (c.ids || []).forEach(f => { const it = (col.items || {})[f]; if (!it) return; const k = momentTier(col, f) + '|' + (groupMode() ? it.a || 'main' : ''); g[k] = (g[k] || 0) + 1; });
    const cards = Object.keys(g).length ? Object.entries(g).sort((a, b) => TIERS.indexOf(b[0].split('|')[0]) - TIERS.indexOf(a[0].split('|')[0])).map(([k, n]) => { const [t, a] = k.split('|'); return '<span class="tpill t-' + TIER_CLS[t] + '">' + t + (n > 1 ? ' <b>×' + n + '</b>' : '') + (a ? ' <span class="tp-acc">· ' + esc(accLabel(a)) + '</span>' : '') + '</span>'; }).join('') : tierPills(tc);
    return '<li><button class="row col-row" type="button" data-action="pform" data-id="' + esc(id) + '"><span class="who">' + face(id, 'sm') +
      '<div style="min-width:0;flex:1"><div class="pn"><span class="nm">' + esc(p.name || c.name) + '</span>' + (inR ? '<span class="badge">no plantel</span>' : '') + '</div>' +
      '<div class="ps">' + teamTag(p.team) + (p.avg ? ' · ' + f1(+p.avg.pts || 0) + ' PTS' : '') + '</div>' +
      (cards ? '<div class="tpills">' + cards + '</div>' : '') + '</div></span>' +
      '<div class="pv col-uses"><div class="v num">' + (uses != null ? usesN(uses) : '–') + '</div><div class="u">usos/run</div></div></button></li>';
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
  if (S.loading) { el.innerHTML = empty('A carregar…', 'A ler a run e o teu plantel.'); return; }
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
    box.innerHTML = collectionCard(false) + (S.calcError ? empty('Erro', S.calcError) : '');
    return;
  }
  const ids = Object.keys(S.mine.roster || {});
  if (!$('rosterFilter')) {
    box.innerHTML = '<div class="toolbar"><input class="field" id="rosterFilter" type="search" placeholder="Procurar no plantel…" value="' + esc(S.filter) + '" aria-label="Procurar no plantel"></div><div id="plBody" class="stack"></div>';
  }
  const body = $('plBody'), run = curRun() || {};
  if (!ids.length) {
    const prev = S.runs.filter(x => x.id !== S.runId), col = (S.profile || {}).collection, nCol = col ? Object.keys(col.players || {}).length : 0;
    body.innerHTML = collectionCard(true) + empty('Plantel vazio', nCol ? 'Junta os jogadores da tua coleção.' : 'Lê os teus Moments da carteira ou junta-os à mão.',
      (nCol ? '<button class="btn primary" type="button" data-action="col-to-roster" style="width:100%;max-width:340px">Juntar os ' + nCol + ' jogadores da coleção</button>' : '<button class="btn primary" type="button" data-action="wallet-sheet" style="width:100%;max-width:340px">Ler a carteira</button>') +
      '<button class="btn" type="button" data-action="add-player" style="width:100%;max-width:340px">Adicionar à mão</button>' +
      (prev.length ? '<button class="btn link" type="button" data-action="copy-roster">Copiar o plantel de outra run</button>' : ''));
    return;
  }
  if (!S.result) { body.innerHTML = '<div class="note info">A calcular o plano…</div>'; return; }
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
    '<div class="card"><div class="list-head"><h2>Usos' + (groupMode() ? ' · ' + esc(accLabel(S.acc)) : '') + ' ' + helpBtn('plantel') + '</h2></div>' +
    '<div class="kv" style="padding:0 16px 12px"><div><div class="label">Usados</div><div class="v num">' + usedTot + '</div><div class="small muted">' + plural(closed, 'dia', 'dias') + '</div></div><div><div class="label">Restantes</div><div class="v num">' + totalU + '</div><div class="small muted">' + ids.length + ' jogadores</div></div><div><div class="label">No plano</div><div class="v num">' + totalP + '</div><div class="small muted">até ao fim</div></div></div>' +
    '<div class="seg pl-seg" role="group" aria-label="Como ver o plantel">' + [['plano', 'Plano por dia'], ['valor', 'Valor por dia']].map(([k, l]) => '<button type="button" data-action="pl-view" data-v="' + k + '" aria-pressed="' + ((PV.mode === 'valor') === (k === 'valor')) + '">' + l + '</button>').join('') + '</div>' +
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
const PL_SORTS = [['plano', 'No plano'], ['proximo', 'Próximo dia'], ['forma', 'Forma'], ['usos', 'Usos'], ['jogos', 'Jogos'], ['nome', 'Nome']];
const PL_FILTERS = [['todos', 'Todos'], ['proximo', 'Jogam no próximo dia'], ['plano', 'No plano'], ['quente', 'Em forma'], ['frio', 'Fora de forma'], ['sobram', 'Sobram usos'], ['semusos', 'Sem usos'], ['lesao', 'Lesionados']];
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
  return '<div class="pl-tools"><div class="chips scroll" role="group" aria-label="Ordenar"><span class="chips-lbl">Ordenar</span>' + PL_SORTS.map(([k, l]) => '<button type="button" data-action="pl-sort" data-v="' + k + '" aria-pressed="' + (PV.sort === k) + '">' + l + '</button>').join('') + '</div>' +
    (withFilter ? '<div class="chips scroll" role="group" aria-label="Mostrar">' + PL_FILTERS.filter(([k]) => k === 'todos' || counts[k] || k === fk).map(([k, l]) => '<button type="button" data-action="pl-filter" data-v="' + k + '" aria-pressed="' + (fk === k) + '">' + l + ' <span class="cnt-s">' + counts[k] + '</span></button>').join('') + '</div>' : '') + '</div>';
}
// os dias da run numa faixa de quadradinhos, alinhada com os números do cabeçalho: usado, no plano, na outra conta,
// tem jogo, não joga
function plDays(ctx, p) {
  const { days, nd, planned, played, elsewhere } = ctx, set = planned[p.id] || new Set();
  return '<span class="pl-days" style="--nd:' + days.length + '">' + days.map(day => {
    const pl = played[day.date], nx = nd && nd.date === day.date ? ' nx' : '', oth = (elsewhere[p.id] || {})[day.date];
    const k = pl && pl.done ? ((pl.lineup || []).includes(p.id) ? 'u' : 'p') : set.has(day.date) ? 'on' : oth ? 'ot' : FB.teamsOn(day).has(p.team) ? 'g' : 'n';
    const t = { u: 'usado', on: 'no plano', ot: oth ? 'joga pela ' + oth.join(' e ') : '', g: 'tem jogo' }[k];
    return '<span class="pc"' + (t ? ' title="Dia ' + (day.idx + 1) + ': ' + esc(t) + '"' : '') + '><i class="s-' + k + nx + '"></i></span>';
  }).join('') + '</span>';
}
const plDayHead = ctx => '<div class="pl-dhead" aria-hidden="true"><span class="pl-days" style="--nd:' + ctx.days.length + '">' + ctx.days.map((d, i) => '<span class="pc' + (ctx.nd && ctx.nd.date === d.date ? ' nx' : '') + '">' + (i + 1) + '</span>').join('') + '</span></div>';
function plListHtml(ctx) {
  const { rows, counts, fk } = plFilter(ctx), nd = ctx.nd, stats = runStats(ctx.days, nd && nd.date).slice(0, 4);
  const nxt = nd ? 'Dia ' + (nd.idx + 1) : '';
  const items = rows.map(({ p, f }) => {
    const st = (f.ir ? '<span class="pill ' + INJ_PILL[f.ir.status] + '">' + esc(INJ_LABEL[f.ir.status]) + '</span>' : '');
    const nextTxt = !nd ? '' : f.sh == null ? '<span class="muted">não joga no ' + nxt + '</span>' : nxt + ': ' + (f.mdNext.objs.length ? f.mdNext.objs.map((o, k) => '<b class="num">' + f1((f.mdNext.info[f.pi][k] || {}).mu || 0) + '</b> ' + esc(statShort(o.stat))).join(' · ') : 'joga');
    const avgs = stats.map(s => { const a = FB.avgOf({ avg: p.avg }, s); if (!a) return ''; const fi = FB.formInfo(p, s), d = fi && (fi.n5 || 0) >= 3 && fi.season ? (fi.l5 - fi.season) / Math.max(1, Math.abs(fi.season)) : 0;
      return '<span>' + esc(statShort(s)) + ' <b class="num">' + f1(a.v) + '</b>' + (d >= 0.08 ? '<i class="up">▲</i>' : d <= -0.08 ? '<i class="down">▼</i>' : '') + '</span>'; }).filter(Boolean).join('');
    const full = f.uses > 0 && f.plan >= f.uses, none = f.uses <= 0;
    return '<li><button class="row pl-card" type="button" data-action="pl-sheet" data-id="' + esc(p.id) + '">' + face(p.id, 'md') +
      '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span>' + (f.tier ? '<span class="tpill t-' + TIER_CLS[f.tier] + '">' + f.tier + '</span>' : '') + st + '</div>' +
      '<div class="ps">' + teamTag(p.team) + ' · ' + plural(f.left.length, 'jogo', 'jogos') + ' até ao fim' + (nextTxt ? ' · ' + nextTxt : '') + '</div>' + (f.sh != null ? fxHtml(p.id, nd, f.fStats.length ? f.fStats : ['pts']) : '') + '</div>' +
      '<div class="pl-uses' + (none ? ' none' : full ? ' full' : '') + '"><b class="num">' + (f.uses >= UNL - 30 ? '∞' : f.uses) + '</b><span>' + (f.uses === 1 ? 'uso' : 'usos') + '</span><small>' + (f.plan ? 'plano ' + f.plan : 'fora do plano') + (f.usedN ? ' · usado ' + f.usedN : '') + '</small></div>' +
      plDays(ctx, p) + (avgs ? '<div class="pl-avgs">' + avgs + '</div>' : '') + '</button></li>';
  }).join('');
  return plToolbar(counts, fk, true) + (items ? plDayHead(ctx) : '') + '<ul class="list pl-list">' + (items || '<li class="row small muted">Nenhum jogador com este filtro.</li>') + '</ul>' +
    '<div class="legend"><span><i class="ls s-u"></i>usado</span><span><i class="ls s-on"></i>no plano</span>' + (S.multi ? '<span><i class="ls s-ot"></i>na outra conta</span>' : '') + '<span><i class="ls s-g"></i>tem jogo</span><span>▲▼ forma nos últimos 5 jogos</span></div>';
}
// valor por dia: quanto do alvo de cada dia o jogador faz sozinho (mapa de calor); contorno = no plano
function plHeatHtml(ctx) {
  const { r, days, nd, planned, played } = ctx, { rows, counts, fk } = plFilter(ctx);
  const mdOf = new Map(r.model.days.map(m => [m.day.date, m]));
  const size = ((r.model.days[0] || {}).size) || 5, par = 1 / size;
  const cols = 'minmax(80px,96px) repeat(' + days.length + ', 25px)';
  const head = '<div class="mx-row head hm-head" style="grid-template-columns:' + cols + '"><span style="text-align:left">Jogador</span>' + days.map((d, i) => { const os = (d.objectives || []).filter(o => o && o.stat);
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
  return plToolbar(counts, fk, true) + '<div class="mx-wrap"><div class="mx hm-grid">' + head + (body || '<div class="mx-row muted small">Nenhum jogador encontrado.</div>') + '</div></div>' +
    '<div class="legend"><span>% do alvo do dia que faz sozinho (' + Math.round(par * 100) + '% = a parte de um)</span><span><b class="hv h4 inp" style="width:auto;padding:0 4px">25</b> no plano</span><span><i class="dot used"></i>já usado</span><span>Nu = usos restantes</span></div>';
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
const boTxt = b => 'Jogo desequilibrado (' + esc(b.fav) + ' ' + Math.round(b.p * 100) + '%): ' + (b.mine ? 'pode ser poupado' : 'pode jogar menos minutos');
// linha da forma (estatísticas do dia e minutos) e o aviso de jogo desequilibrado, para o lineup e o plantel
function fxHtml(id, day, stats) {
  const parts = [];
  stats.forEach(st => { const f = formPct(id, st); if (f && Math.abs(f.pct) >= 0.08) parts.push('<b class="' + (f.pct > 0 ? 'c-good' : 'c-bad') + '">' + (f.pct > 0 ? '▲ +' : '▼ −') + Math.round(Math.abs(f.pct) * 100) + '%</b> ' + esc(statShort(st))); });
  const m = minTrend(id); if (m && Math.abs(m.d) >= 3) parts.push('<b class="' + (m.d > 0 ? 'c-good' : 'c-bad') + '">' + f0(m.l5) + ' min</b> (' + (m.d > 0 ? '+' : '−') + f0(Math.abs(m.d)) + ')');
  const b = blowout(id, day);
  return (parts.length ? '<div class="ps fx">' + parts.join(' · ') + ' <span class="muted">nos últimos 5</span></div>' : '') + (b ? '<div class="risk-sub">⚠ ' + boTxt(b) + '</div>' : '');
}
// ---- Forma da run: para cada um dos próximos dias, quem dos teus está quente ou frio no que o dia pede ----
function formaHtml() {
  const r = S.result, v = view();
  if (!r || !v || !r.model.days.length) return '<div class="note info">A forma aparece com a run calculada.</div>';
  const mds = r.model.days.filter(md => md.objs.length).slice(0, 6);
  if (!mds.length) return '<div class="note info">Ainda não há objetivos para os próximos dias.</div>';
  const md = mds.find(x => x.day.date === S.forma.day) || mds[0], day = md.day, dn = dayNo(day.date);
  if (!S.gOdds[day.date]) loadGameOdds(day.date);
  const stats = [...new Set(md.objs.map(o => o.stat))], lu = new Set(((v.days.find(x => x.date === day.date)) || {}).lineup || []);
  const ids = md.elig.map(pi => r.model.players[pi].id).filter(id => (S.mine.roster || {})[id]);
  const st0 = stats[0], u = esc(statShort(st0));
  const rowOf = (id, extra) => {
    const p = playerObj(id), f = formPct(id, st0), fd = formDay(id, stats), pc = fd == null ? null : Math.round(fd * 100);
    return '<li><button class="frow" type="button" data-action="pform" data-id="' + esc(id) + '"><span class="who">' + face(id, 'sm') + '<span style="min-width:0"><span class="pn"><span class="nm">' + esc(p.name) + '</span>' + (lu.has(id) ? '<span class="pill prov">no plano</span>' : '') + '</span>' +
      '<span class="ps">' + teamTag(p.team) + ' ' + esc(opp(p.team, day)) + (f ? ' · últimos 5: <b class="num">' + f1(f.l5) + '</b> ' + u + ' · época ' + f1(f.season) : '') + '</span>' + (extra || '') + '</span></span>' +
      sparkSvg(((p.avg || {}).form || {}).games, st0, p.avg, f ? f.season : null) +
      '<span class="delta ' + (pc >= 8 ? 'up' : pc <= -8 ? 'down' : '') + ' num">' + (pc == null ? '—' : (pc > 0 ? '+' : pc < 0 ? '−' : '') + Math.abs(pc) + '%') + '<small>vs época</small></span></button></li>';
  };
  const withF = ids.map(id => ({ id, fd: formDay(id, stats) })).filter(x => x.fd != null);
  const hot = withF.filter(x => x.fd >= 0.08).sort((a, b) => b.fd - a.fd), cold = withF.filter(x => x.fd <= -0.08 && lu.has(x.id)).sort((a, b) => a.fd - b.fd);
  const mins = ids.map(id => ({ id, m: minTrend(id) })).filter(x => x.m && Math.abs(x.m.d) >= 3).sort((a, b) => Math.abs(b.m.d) - Math.abs(a.m.d));
  const bos = ids.map(id => ({ id, b: blowout(id, day) })).filter(x => x.b).sort((a, b) => (lu.has(b.id) ? 1 : 0) - (lu.has(a.id) ? 1 : 0));
  const minRow = x => { const p = playerObj(x.id), m = x.m;
    return '<li><button class="frow" type="button" data-action="pform" data-id="' + esc(x.id) + '"><span class="who">' + face(x.id, 'sm') + '<span style="min-width:0"><span class="pn"><span class="nm">' + esc(p.name) + '</span>' + (lu.has(x.id) ? '<span class="pill prov">no plano</span>' : '') + '</span><span class="ps">' + f0(m.l5) + ' min nos últimos 5 · época ' + f0(m.season) + '</span></span></span>' +
      sparkSvg(((p.avg || {}).form || {}).games, 'min', p.avg, m.season) + '<span class="delta ' + (m.d > 0 ? 'up' : 'down') + ' num">' + (m.d > 0 ? '+' : '−') + f0(Math.abs(m.d)) + '<small>min</small></span></button></li>'; };
  const boRow = x => { const p = playerObj(x.id);
    return '<li><button class="row" type="button" data-action="pform" data-id="' + esc(x.id) + '"><span class="who">' + face(x.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span>' + (lu.has(x.id) ? '<span class="pill prov">no plano</span>' : '') + '</div><div class="ps">' + teamTag(p.team) + ' ' + esc(opp(p.team, day)) + '</div><div class="risk-sub">⚠ ' + boTxt(x.b) + '</div></div></span></button></li>'; };
  const card = (title, note, list, empty) => '<div class="card"><div class="list-head"><h2>' + title + '</h2><span class="small muted">' + note + '</span></div>' + (list ? '<ul class="list">' + list + '</ul>' : '<div class="row small muted">' + empty + '</div>') + '</div>';
  return '<div class="card panel filters"><h2>Forma da run ' + helpBtn('forma') + '</h2><div class="small muted">Para os próximos dias: quem dos teus está quente ou frio no que o dia pede, quem está a ganhar ou a perder minutos e quem pode jogar menos.</div>' +
    '<div class="chips scroll" role="group" aria-label="Dia">' + mds.map(x => '<button type="button" data-action="forma-day" data-v="' + x.day.date + '" aria-pressed="' + (x === md) + '">Dia ' + dayNo(x.day.date) + ' · ' + esc(x.objs.map(o => statShort(o.stat)).join(' + ')) + '</button>').join('') + '</div></div>' +
    card('Quentes para o dia ' + dn, 'os teus que jogam', hot.map(x => rowOf(x.id)).join(''), 'Nenhum dos teus está acima da época nestas estatísticas.') +
    card('Frios no plano do dia ' + dn, 'pensa em trocar', cold.map(x => rowOf(x.id)).join(''), 'Ninguém do plano deste dia está abaixo da época.') +
    card('Minutos a mudar', 'últimos 5 face à época', mins.map(minRow).join(''), 'Nenhum dos teus que jogam neste dia mudou de minutos (±3).') +
    (bos.length ? card('Pode jogar menos', 'jogos desequilibrados', bos.map(boRow).join(''), '') : '');
}
// ---- Lesões: o teu plantel primeiro, depois os jogadores importantes do resto da NBA ----
const INJ_ORDER = { ofs: 0, out: 1, doubtful: 2, questionable: 3, dtd: 4, probable: 5 };
const TEAM_NICK = { ATL: 'Hawks', BOS: 'Celtics', BKN: 'Nets', CHA: 'Hornets', CHI: 'Bulls', CLE: 'Cavaliers', DAL: 'Mavericks', DEN: 'Nuggets', DET: 'Pistons', GSW: 'Warriors', HOU: 'Rockets', IND: 'Pacers', LAC: 'Clippers', LAL: 'Lakers', MEM: 'Grizzlies', MIA: 'Heat', MIL: 'Bucks', MIN: 'Timberwolves', NOP: 'Pelicans', NYK: 'Knicks', OKC: 'Thunder', ORL: 'Magic', PHI: '76ers', PHX: 'Suns', POR: 'Trail Blazers', SAC: 'Kings', SAS: 'Spurs', TOR: 'Raptors', UTA: 'Jazz', WAS: 'Wizards' };
// uma linha por jogador: nome e estado em cima; lesão e regresso em baixo; a nota da ESPN curta (o resto na ficha)
function injRow(rec, action, opt) {
  const c = S.players.get(rec.id) || {}, o = opt || {}, t = c.team || rec.team || '';
  const sub = [o.team ? teamTag(t) : '', rec.detail ? esc(rec.detail) : '', rec.return_date ? 'volta ~' + dShort(rec.return_date) : ''].filter(Boolean).join(' · ');
  return '<li data-n="' + esc(norm((c.name || rec.name || '') + ' ' + t + ' ' + (TEAM_NICK[t] || ''))) + '"' + (o.minor ? ' data-minor="1" hidden' : '') + '><button class="row" type="button" data-action="' + action + '" data-id="' + esc(rec.id) + '"><span class="who">' + face(rec.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(c.name || rec.name) + '</span><span class="pill ' + INJ_PILL[rec.status] + '">' + esc(INJ_LABEL[rec.status]) + '</span></div>' +
    (sub ? '<div class="ps">' + sub + '</div>' : '') + (rec.comment ? '<div class="ps inj-note">' + esc(rec.comment) + '</div>' : '') + '</div></span></button></li>';
}
function lesoesHtml() {
  if (!S.injOk) return '<div class="note info">O relatório de lesões ainda não está ligado (admin: supabase/schema.sql novo e a tarefa "Lesões").</div>';
  const all = Object.values(S.injuries || {}).sort((a, b) => (INJ_ORDER[a.status] - INJ_ORDER[b.status]) || String(a.name).localeCompare(String(b.name)));
  const ros = S.mine.roster || {}, mine = all.filter(x => ros[x.id]);
  const imp = x => { const c = S.players.get(x.id); return c && c.avg && ((+c.avg.min || 0) >= 20 || (+c.avg.pts || 0) >= 12); };
  const teamOf = x => (S.players.get(x.id) || {}).team || x.team || '?';
  const by = {}; all.filter(x => !ros[x.id]).forEach(x => (by[teamOf(x)] = by[teamOf(x)] || []).push(x));
  const teams = Object.keys(by).sort();
  const nImp = all.filter(x => !ros[x.id] && imp(x)).length;
  const grp = t => { const xs = by[t], n = xs.filter(imp).length;
    return '<li class="inj-team" data-t="' + esc(t) + '"' + (n ? '' : ' hidden') + '><div class="inj-th">' + teamTag(t) + ' <span class="muted">' + esc(TEAM_NICK[t] || '') + '</span></div><ul class="list">' + xs.map(x => injRow(x, 'pform', { minor: !imp(x) })).join('') + '</ul></li>'; };
  return '<div class="card inj-list"><div class="list-head"><h2>Lesões ' + helpBtn('lesoes') + '</h2><span class="small muted">ESPN, ' + esc(ago(S.injAt)) + '</span></div>' +
    '<div class="lu-search"><input class="field" id="injSearch" type="search" placeholder="Jogador ou equipa…" autocomplete="off" aria-label="Procurar jogador ou equipa" value="' + esc(S.injQ || '') + '"></div>' +
    '<div class="inj-sec"><h3>No teu plantel</h3>' + (mine.length ? '<ul class="list" id="injMine">' + mine.map(x => injRow(x, 'pl-sheet', { team: true })).join('') + '</ul>' : '<div class="row small muted" style="display:block">Ninguém lesionado. ✓</div>') + '</div>' +
    '<div class="inj-sec"><h3>Resto da NBA <span class="small muted" id="injCount">' + nImp + ' importantes · procura para ver todos</span></h3>' +
    (teams.length ? '<ul class="inj-teams" id="injTeams">' + teams.map(grp).join('') + '</ul>' : '') +
    (nImp ? '' : '<div class="row small muted inj-zero" style="display:block">Nenhum jogador importante no relatório.</div>') + '<div class="row small muted inj-none" hidden>Ninguém lesionado com esse nome ou equipa.</div></div></div>';
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
  openSheet('<h3>' + esc(c.name) + '</h3><div class="small muted">' + teamTag(c.team) + (c.gp ? ' · ' + c.gp + ' jogos esta época' : '') + '</div>' + injuryBlock(String(id), null, null) +
    (avg ? '<div><div class="label" style="margin-bottom:6px">Médias por jogo</div><div class="kv sm">' + AVG_SHOW.map(k => { const a = FB.avgOf({ avg }, k); return a ? '<div><div class="label">' + STATS[k].short + (a.est ? '*' : '') + '</div><div class="v num">' + f1(a.v) + '</div></div>' : ''; }).join('') + '</div></div>' : '<div class="note info">Ainda sem médias.</div>') +
    gamesTable(avg) +
    '<div class="btns">' + (S.runId ? '<button class="btn primary" type="button" data-action="buy-eval" data-id="' + esc(id) + '">Ver se compensa comprar</button>' : '<span></span>') + '<button class="btn" type="button" data-action="add-id" data-id="' + esc(id) + '">Juntar ao plantel</button></div>');
}
// ---- dicas de compra: refaz a run com cada candidato ----
function buyHtml() {
  const r = mainResult(), B = S.buy;
  if (!S.runId || !r || !r.model.days.length) return '<div class="note info">' + (S.runId ? 'A run já terminou.' : 'Ainda não há runs.') + '</div>' + specHtml();
  return buyTipsCard(6) + '<div class="card panel"><h2>Procurar compras ' + helpBtn('comprar') + '</h2>' +
    '<div class="seg acc-seg" role="group" aria-label="O que comprar"><button type="button" data-action="buy-mode" data-mode="new" aria-pressed="' + (B.mode === 'new') + '">Todos</button><button type="button" data-action="buy-mode" data-mode="more" aria-pressed="' + (B.mode === 'more') + '">Reforçar os teus</button></div>' +
    '<div><div class="label" style="margin-bottom:6px">Escalão do Moment</div><div class="chips" role="group" aria-label="Escalão do Moment">' + [1, 2, 4].map(n => '<button type="button" data-action="buy-uses" data-n="' + n + '" aria-pressed="' + (B.uses === n) + '">' + tierName(n) + ' · ' + plural(n, 'uso', 'usos') + '</button>').join('') + '</div></div>' +
    (B.mode !== 'more' ? '<label class="small muted">Preço máximo (opcional, em $)<input class="field" id="buyMax" type="number" inputmode="decimal" min="0" step="1" placeholder="ex.: 6" value="' + (B.max || '') + '" autocomplete="off"></label>' : '') +
    '<button class="btn primary" type="button" data-action="buy-run">' + (B.mode === 'new' ? 'Procurar as melhores compras' : 'Ver quem vale a pena reforçar') + '</button>' +
    '<label class="small muted">Avaliar um jogador<input class="field" id="buySearch" type="search" placeholder="Nome, ex.: Curry…" autocomplete="off"></label><div id="buyFound" class="search-list" hidden></div></div>' +
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
    if (vals.length >= 3) return { lo: Math.min(...vals), hi: Math.max(...vals), txt: Math.min(...vals) + '–' + Math.max(...vals) + ' nos últimos ' + vals.length + ' jogos' };
    const d = (((x.p.avg || {}).hist || {}).d || {})[stat]; if (!(d > 0)) return null;
    const sd = Math.sqrt(d * x.v); return { lo: Math.max(0, x.v - sd), hi: x.v + sd, txt: 'normalmente ' + f0(Math.max(0, x.v - sd)) + '–' + f0(x.v + sd) };
  };
  const rgs = new Map(top.map(x => [x.p.id, rangeOf(x)])), sc = Math.max(1, ...top.map(x => Math.max(x.v, (rgs.get(x.p.id) || {}).hi || 0))) * 1.05;
  const rows = top.map(x => {
    const p = x.p, i = rank.get(p.id) - 1, rg = rgs.get(p.id), pr = ptsRank.get(p.id) || 999, d = ((p.avg.hist || {}).d || {})[stat], ir = injRec(p.id);
    const reg = d > 0 && dMed ? (d <= dMed * 0.85 ? '<span class="badge" title="Varia pouco de jogo para jogo (época passada)">regular</span>' : d >= dMed * 1.2 ? '<span class="pill duv" title="Varia muito de jogo para jogo (época passada)">irregular</span>' : '') : '';
    const spec = stat !== 'pts' && i < 30 && pr > 75 ? '<span class="pill ok" title="No topo desta estatística mas fora dos 75 melhores marcadores">especialista</span>' : '';
    return '<li><button class="row spec-row" type="button" data-action="pform" data-id="' + esc(p.id) + '"><span class="who">' + face(p.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + (i + 1) + '. ' + esc(p.name) + '</span>' + spec + reg + (ir ? '<span class="pill ' + INJ_PILL[ir.status] + '">' + INJ_SHORT[ir.status] + '</span>' : '') + '</div>' +
      '<div class="ps">' + teamTag(p.team) + (stat !== 'pts' ? ' · ' + ord(pr) + ' em PTS' : '') + '</div>' +
      (rg ? '<div class="sp-rng" aria-hidden="true"><i class="r" style="left:' + (rg.lo / sc * 100).toFixed(1) + '%;width:' + Math.max(1.5, (rg.hi - rg.lo) / sc * 100).toFixed(1) + '%"></i><i class="m" style="left:' + (x.v / sc * 100).toFixed(1) + '%"></i></div><div class="ps sp-txt">' + rg.txt + '</div>' : '') +
      '</div></span><div class="pv"><div class="v num">' + f1(x.v) + '</div><div class="u">' + u + '</div></div></button></li>';
  }).join('');
  const rd = runDays[stat];
  return '<div class="card"><div class="list-head"><h2>Especialistas ' + helpBtn('especialistas') + '</h2><span class="small muted">por jogo</span></div>' +
    '<div class="chips" role="group" aria-label="Estatística" style="padding:0 14px 8px">' + order.map(k => '<button type="button" data-action="spec-stat" data-v="' + k + '" aria-pressed="' + (k === stat) + '">' + esc(statShort(k)) + (runDays[k] ? ' ●' : '') + '</button>').join('') + '</div>' +
    '<div class="seg acc-seg" role="group" aria-label="Que jogadores" style="margin:0 14px 8px"><button type="button" data-action="spec-scope" data-v="all" aria-pressed="' + (S.spec.scope !== 'new') + '">Todos</button><button type="button" data-action="spec-scope" data-v="new" aria-pressed="' + (S.spec.scope === 'new') + '">Os que não tens</button></div>' +
    (rd ? '<div class="row small muted" style="display:block"><b>Nesta run:</b> ' + u + (rd.length === 1 ? ' no dia ' : ' nos dias ') + spans(rd) + '</div>' : '') +
    (rows ? '<ul class="list">' + rows + '</ul>' : '<div class="row small muted" style="display:block">Ainda sem médias.</div>') + '</div>';
}
function renderBuySearch(qs) {
  const box = $('buyFound'); if (!box) return;
  box.hidden = !String(qs || '').trim();
  if (box.hidden) { box.innerHTML = ''; return; }
  box.innerHTML = searchPlayers(qs, 6).map(p => '<div class="row"><span class="who">' + face(p.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span></div><div class="ps">' + esc(p.team || '—') + (S.mine.roster[p.id] ? ' · já tens (' + plural(perRunUses(p.id), 'uso', 'usos') + ' por run)' : '') + '</div></div></span><button class="btn small" type="button" data-action="buy-pick" data-id="' + esc(p.id) + '">Avaliar</button></div>').join('') || '<div class="row muted small">Nenhum jogador com esse nome.</div>';
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
  if (maxPrice > 0 && !onlyId && !ids) { if (prog) prog('A ver os preços do mercado…'); if ((await mktLoad(pool)) || pxIndex().size) { priced = pool.length; pool = pool.filter(id => { const p = mktOf(id, U); return p && p.ask != null && p.ask <= maxPrice; }); } }
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
      if (prog) prog('A comparar os ' + pre.length + ' mais prometedores (de ' + pool.length + ')…');
      for (const k of accs) {
        if (alive && !alive()) return null;
        const x = engineInputs(k), wide = clone(x.roster), rk = S.multi ? S.multi.byKey[k] : r; if (!rk) continue;
        pre.forEach(id => add(id)(wide.players));
        try { (await engineCall('buyRank', [x.run, wide, x.roster, x.odds, x.plan, { days: rk.normal.days.map(d => ({ date: d.date, lineup: d.lineup })) }, pre, engOpts()])).forEach(z => { gain[z.id] = (gain[z.id] || 0) + z.gain; }); }
        catch (e) { console.warn('compras: 2.ª peneira', e); }
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
      if (prog) prog('A refazer a run com ' + nameOf(id) + '… ' + (k + 1) + ' de ' + shortlist.length);
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
  out.innerHTML = '<div class="small muted" id="buyProg">A escolher candidatos…</div>';
  await tick(30);
  const mx = parseFloat(String((($('buyMax') || {}).value) || B.max || '').replace(',', '.')); B.max = mx > 0 ? mx : null;
  const res = await computeBuy({ onlyId, mode, U: B.uses, maxPrice: B.max, topN: S.multi ? 5 : 8, alive: () => !!$('buyOut'), prog: t => { const el = $('buyProg'); if (el) el.textContent = t; } });
  if (!res || !$('buyOut')) return;
  if (res.noPool) { $('buyOut').innerHTML = '<div class="note info">' + (res.priced != null ? 'Nenhum ' + tierName(B.uses) + ' com jogos nos dias que faltam está à venda até ' + usd(res.maxPrice) + '. Sobe o preço máximo.' : mode === 'more' ? 'Ninguém do teu plantel ganha usos com um Moment ' + tierName(B.uses) + (res.unsold ? ' que esteja à venda' : '') + '. Experimenta um escalão acima.' : res.unsold ? 'Nenhum dos candidatos tem um ' + tierName(B.uses) + ' à venda.' : 'Não há candidatos com jogos nos dias que faltam.') + '</div>'; return; }
  if (onlyId && S.mine.roster[onlyId] && !usesGain(onlyId, B.uses) && !(S.multi && collectionInfo(onlyId).copies === 1)) { $('buyOut').innerHTML = '<div class="note info">Já tens ' + esc(nameOf(onlyId)) + ' com ' + plural(perRunUses(onlyId), 'uso', 'usos') + ' por run: escolhe um escalão acima.</div>'; return; }
  B.results = res;
  $('buyOut').innerHTML = buyResultsHtml(res);
}
// "Testar mais": a run refeita a sério com os seguintes da lista (pela ordem das peneiras)
async function buyMore() {
  const B = S.buy, R = B.results; if (!R || !R.rank || B.moreBusy) return;
  const seen = new Set(R.list.map(x => String(x.id)).concat(R.skip || [])), next = R.rank.filter(id => !seen.has(id)).slice(0, S.multi ? 5 : 8);
  if (!next.length) return;
  B.moreBusy = true;
  const el = $('buyMoreBox'); if (el) el.innerHTML = '<div class="small muted" id="buyMoreProg">A refazer a run…</div>';
  try {
    const res = await computeBuy({ ids: next, mode: R.mode, U: R.U, topN: next.length, alive: () => !!$('buyOut') && B.results === R, prog: t => { const p = $('buyMoreProg'); if (p) p.textContent = t; } });
    if (!res || B.results !== R) return;
    R.list = R.list.concat(res.list).sort((a, b) => b.ev.total - a.ev.total);
    R.skip = (R.skip || []).concat(next.filter(id => !res.list.some(x => String(x.id) === id)));
  } finally { B.moreBusy = false; }
  if ($('buyOut') && B.results === R) $('buyOut').innerHTML = buyResultsHtml(R);
}
// nome do escalão pelos usos do Moment a comprar (Common 1, Rare 2, Legendary 4)
const tierName = n => (n === 1 ? 'Common' : n === 2 ? 'Rare' : n === 3 ? 'Rare+' : n === 4 ? 'Legendary' : n + ' usos');
const tierTxt = n => ([1, 2, 3, 4].includes(n) ? tierName(n) + ' (' + n + ' uso' + (n > 1 ? 's' : '') + ')' : n + ' usos');
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
  toast('Plano melhor aplicado.');
}
function betterCard() {
  const B = S.better; if (!B || B.key !== improveKey() || !B.changes.length) return '';
  const multi = !!S.multi, gain = B.e1 - B.e0;
  const rows = B.changes.slice(0, 5).map(c => '<li class="row lu-ch"><span><b>Dia ' + (c.idx + 1) + '</b>' + (multi ? ' · ' + esc(accLabel(c.k)) : '') + ' ' + pct(c.P0) + ' → <b class="' + (c.P1 >= c.P0 ? 'up' : 'down') + '">' + pct(c.P1) + '</b>' +
    (c.outs.length ? ' · sai ' + c.outs.map(id => esc(lastName(id))).join(', ') : '') + (c.ins.length ? ' · entra ' + c.ins.map(id => esc(lastName(id))).join(', ') : '') + '</span></li>').join('');
  return '<div class="card better"><div class="list-head"><h2>Há um plano melhor</h2><span class="small muted">vitórias esperadas ' + f1(B.e0) + ' → <b class="up">' + f1(B.e1) + '</b></span></div>' +
    '<div class="small muted" style="padding:0 16px">Encontrei-o a experimentar trocas de vários jogadores ao mesmo tempo. Só muda se quiseres.</div>' +
    '<ul class="list">' + rows + (B.changes.length > 5 ? '<li class="row small muted" style="display:block">e mais ' + plural(B.changes.length - 5, 'dia', 'dias') + '</li>' : '') + '</ul>' +
    '<div class="foot"><button class="btn primary" type="button" data-action="better-use">Usar este plano</button><button class="btn" type="button" data-action="better-no">Ignorar</button></div></div>';
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
  const tn = tierName(R.U), badge = '<span class="tpill t-' + (TIER_CLS[tn] || 'r') + '">' + tn + '</span>' + (own ? '<span class="badge">' + (g > 0 ? '+' + plural(g, 'uso', 'usos') : '2.º Moment') + '</span>' : '');
  const sub = teamTag(c.team) + (t.days.length ? ' · joga ' + (t.days.length > 1 ? 'os dias ' : 'o dia ') + t.days.join(', ') : '');
  const right = t.byPrize
    ? '<span class="bg-top">' + t.best.p.wins + ' vitórias' + (t.multi ? ' · ' + esc(accLabel(t.best.k)) : '') + '</span><span class="bg-big up">' + pct(t.best.to) + '</span><span class="bg-was"><b class="up">▲ ' + (Math.round(t.best.to * 100) - Math.round(t.best.from * 100)) + '</b> · era ' + pct(t.best.from) + '</span>'
    : '<span class="bg-top">esperadas</span><span class="bg-big' + (t.worth ? ' up' : ' muted') + '">' + f1(t.e1) + '</span><span class="bg-was">' + (t.worth ? '<b class="up">▲ ' + f1(t.e1 - t.e0) + '</b> · ' : '') + 'era ' + f1(t.e0) + '</span>';
  return '<li><button class="row buy-row" type="button" data-action="buy-detail" data-id="' + esc(t.id) + '" data-src="' + src + '"><span class="who">' + face(t.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + (i + 1) + '. ' + esc(c.name || nameOf(t.id)) + '</span></div><div class="ps buy-tags">' + badge + '</div><div class="ps">' + sub + '</div><div class="ps">' + mktSpan(t.id, R.U) + '</div></div></span><span class="bg">' + right + '</span></button></li>';
}
// detalhes de uma compra (folha): o que muda na run, dia a dia e nos prémios, e o preço
function buyDetailSheet(src, id) {
  const R = src === 'auto' ? S.autoBuy : S.buy.results, x = R && R.list.find(z => String(z.id) === String(id)); if (!x) return;
  openSheet(buyResultsHtml(Object.assign({}, R, { list: [x], single: true, detail: true })) + '<button class="btn" type="button" data-action="buy-player" data-id="' + esc(id) + '" data-src="' + src + '">Ver a ficha do jogador</button>');
}
// lista curta de sugestões (Hoje e Run)
function buyTipsCard(limit, jornada) {
  const A = S.autoBuy, key = autoBuyKey();
  if (!key) return '';
  const head = '<div class="list-head"><h2>' + (jornada ? 'Melhores compras' : 'Os Rare que mais compensam') + '</h2><span class="small muted">' + (autoBuyBusy ? 'a atualizar…' : 'Moment Rare') + '</span></div>';
  if (S.autoBuyErr === key) return '<div class="card">' + head + '<div class="row small muted" style="display:block">Não deu para calcular. <button class="btn link small" type="button" data-action="buy-retry">Tentar outra vez</button></div></div>';
  if (!A) return '<div class="card">' + head + '<div class="row small muted" style="display:block">A testar cada Rare na tua run…</div></div>';
  // os melhores primeiro, mesmo os que mudam pouco (assim vês sempre qual é o Rare que mais compensa)
  const tips = A.list.map(x => buySummary(A, x)).slice(0, limit);
  if (!tips.length) return '<div class="card">' + head + '<div class="row small muted" style="display:block">' + (A.noPool ? 'Não há candidatos com jogos nos dias que faltam.' : 'Nenhum Rare muda a tua run.') + '</div></div>';
  return '<div class="card">' + head + '<ul class="list">' + tips.map((t, i) => buyRow(A, t, i, 'auto')).join('') +
    '</ul>' + (jornada ? '<button class="btn link small buy-more-link" type="button" data-action="goto" data-tab="plantel" data-sub="comprar">Ver mais compras ›</button>' : '') + '</div>';
}
function buyResultsHtml(R) {
  const usesTxt = n => n + ' uso' + (n > 1 ? 's' : '');
  if (!R.list.length) return '<div class="note info">' + (R.single ? 'Não joga nos dias que faltam (ou não tem médias).' : 'Nenhum Moment ' + tierTxt(R.U) + ' muda a tua run.') + '</div>';
  const prizes = mainResult().prizes, keys = R.base.group ? R.base.group.keys : ['main'], multi = keys.length > 1;
  const resOf = (ev, k) => (ev.group ? ev.group.byKey[k].normal : ev.res);
  const seen = new Set(R.list.map(x => String(x.id)).concat(R.skip || [])), left = R.rank ? R.rank.filter(id => !seen.has(id)).length : 0;
  const intro = R.single || !R.rank ? '' : '<div class="small muted buy-intro">Vi os ' + R.pool + ' jogadores com jogos nos dias que faltam' + (R.maxPrice ? ' e um ' + tierName(R.U) + ' à venda até ' + usd(R.maxPrice) : '') + ' e refiz a run a sério com os ' + R.list.length + ' mais prometedores.' + (R.unsold ? ' Ficaram de fora ' + R.unsold + ' sem nenhum ' + tierName(R.U) + ' à venda.' : '') + '</div>';
  const moreBtn = left ? '<div id="buyMoreBox"><button class="btn" type="button" data-action="buy-more">Testar os próximos ' + Math.min(left, S.multi ? 5 : 8) + '</button></div>' : '';
  const andList = a => (a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0] || '');
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
    const head = !worth ? '<div class="buy-gain muted">Não compensa: a run quase não muda.</div>'
      : byPrize ? '<div class="buy-gain">' + best.p.wins + ' vitórias' + (multi ? ' (' + esc(accLabel(best.k)) + ')' : '') + ': ' + pct(best.from) + ' → <span class="up">' + pct(best.to) + '</span> <small>+' + (pp(best.to) - pp(best.from)) + ' pp</small></div>'
      : '<div class="buy-gain">Vitórias esperadas: ' + f1(e0) + ' → <span class="up">' + f1(e1) + '</span></div>';
    // só com um Moment dele é que o segundo deixa duas contas jogá-lo na mesma noite; com mais, o ganho são os usos
    const twoSame = multi && more && collectionInfo(id).copies === 1 && days.some(z => z.acc.length > 1);
    const why = !days.length ? 'Não entra em dias novos: liberta outros jogadores.'
      : (twoSame ? 'Duas contas podem jogá-lo no mesmo dia. ' : more ? (usesGain(id, R.U) ? 'Com mais ' + usesTxt(usesGain(id, R.U)) + (multi ? ' em cada conta' : '') + ', ' : 'Com um 2.º Moment (as duas contas na mesma noite), ') : '') + (more && !twoSame ? 'joga' : 'Joga') + (days.length > 1 ? ' nos dias ' : ' no dia ') + andList(days.map(z => String(z.d.idx + 1))) + (keys.some(k => resOf(R.base, k).days.some(d => d.lineup.includes(id))) ? ' (além dos que já jogava)' : '') + ':';
    const dayLines = days.map(z => { const day = S.days.find(q => q.date === z.d.date) || {};
      return '<li><b>Dia ' + (z.d.idx + 1) + '</b> · ' + dWeek(z.d.date) + ' ' + dShort(z.d.date) + ' · ' + esc(objsText(day)) + ' — ' + z.acc.map(a => (multi ? esc(accLabel(a.k)) + ' ' : 'vitória ') + (a.P0 != null ? pct(a.P0) + ' → ' : '') + '<b>' + pct(a.P1) + '</b>').join(' · ') + '</li>'; }).join('');
    const tiers = [...new Set(moved.map(m => m.p.wins))];
    const prizeLine = tiers.length ? 'Prémios que mudam: ' + tiers.map(w => w + 'V ' + moved.filter(m => m.p.wins === w).map(m => (multi ? esc(accLabel(m.k)) + ' ' : '') + pct(m.b) + ' → ' + pct(m.a)).join(', ')).join(' · ') + '. ' : '';
    const tierLab = more ? 'Moment ' + tierName(R.U) + (usesGain(id, R.U) ? ', +' + usesTxt(usesGain(id, R.U)) : ', 2.º Moment') : 'Moment ' + tierTxt(R.U);
    if (R.detail) {
      // folha: cabeçalho, três caixas (prémio, vitórias esperadas, preço), dias novos e prémios que mudam
      const mk = mktOf(id, R.U);
      const tile = (lab, v, sub) => '<div class="bd-tile"><span class="label">' + lab + '</span><b>' + v + '</b><span class="small muted">' + sub + '</span></div>';
      const tiles = '<div class="bd-tiles">' +
        (byPrize ? tile('Prémio', pct(best.from) + ' → <span class="up">' + pct(best.to) + '</span>', best.p.wins + ' vitórias' + (multi ? ' · ' + esc(accLabel(best.k)) : '')) : '') +
        tile('Vitórias esperadas', f1(e0) + ' → <span class="' + (e1 - e0 >= 0.15 ? 'up' : '') + '">' + f1(e1) + '</span>', multi ? 'todas as contas' : 'na run') +
        tile('Preço', mk && mk.ask != null ? '<span class="up">' + usd(mk.ask) + '</span>' : '—', mk && mk.ask != null ? tierName(R.U) + ', o mais barato' : mk && mk.ts ? 'nenhum ' + tierName(R.U) + ' à venda' : 'por ler') + '</div>';
      const prizeRows = tiers.length ? '<div class="label" style="margin-top:4px">Prémios que mudam</div><div class="bd-prizes">' + tiers.map(w => '<b>' + w + 'V</b><span>' + moved.filter(m => m.p.wins === w).map(m => (multi ? esc(accLabel(m.k)) + ' ' : '') + pct(m.b) + ' → <b class="' + (m.a > m.b ? 'up' : '') + '">' + pct(m.a) + '</b>').join(' · ') + '</span>').join('') + '</div>' : '';
      return '<div class="buy-detail stack"><div class="bd-head">' + face(id, 'lg') + '<div style="min-width:0"><h3>' + esc(nameOf(id)) + '</h3><div class="small muted">' + teamTag(c.team) + ' · ' + tierLab + '</div></div></div>' + (worth ? '' : '<div class="note">Não compensa: a run quase não muda.</div>') + tiles +
        '<div><div class="label">' + (days.length ? 'Dias novos em que joga' : 'Dias') + '</div><div class="small" style="margin:4px 0">' + why + '</div>' + (dayLines ? '<ul class="small buy-days">' + dayLines + '</ul>' : '') + '</div>' + prizeRows + '</div>';
    }
    return '<div class="card panel buy-card"><div class="list-head" style="padding:0"><span class="who">' + face(id) + '<h2>' + esc(nameOf(id)) + '</h2></span><span class="small muted">' + esc(c.team || '') + ' · ' + tierLab + '</span></div>' +
      head + '<div class="small">' + mktSpan(id, R.U) + '</div>' + '<div class="small">' + why + '</div>' + (dayLines ? '<ul class="small buy-days">' + dayLines + '</ul>' : '') +
      '<div class="small muted">' + prizeLine + 'Vitórias esperadas' + (multi ? ' (todas as contas)' : '') + ': ' + f1(e0) + ' → ' + f1(e1) + '.</div></div>';
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
const groupName = uid => (S.group.profiles.find(p => p.user_id === uid) || {}).display_name || 'Sem nome';
const sharing = s => !!(s && s.share && s.share.roster) && ((S.group.profiles.find(p => p.user_id === s.user_id) || {}).share_plan !== false);
// Lineups planeados de cada um nos dias que faltam
function lineupsHtml() {
  const r = mainResult(), me = S.session.user.id;
  if (!r || !r.model.days.length) return '<div class="note info">' + (S.runId ? 'A run já terminou.' : 'Ainda não há runs.') + '</div>';
  const mineIds = new Set(Object.keys(S.mine.roster || {}));
  const others = S.group.summaries.filter(s => s.user_id !== me && S.group.members.some(m => m.user_id === s.user_id));
  const shared = others.filter(sharing), hidden = S.group.members.filter(m => m.user_id !== me && !shared.some(s => s.user_id === m.user_id));
  const myV = view();
  const cards = r.model.days.filter(md => md.objs.length).slice(0, 6).map(md => {
    const day = md.day, mine = ((myV.days.find(d => d.date === day.date) || {}).lineup) || [];
    const myLocks = (((curPlan().locks || {})[day.date]) || []).concat(Object.entries((((curPlan().live || {})[day.date]) || {}).players || {}).filter(([, e]) => e && (e.state === 'jogo' || e.state === 'fim')).map(([id]) => id));
    // por jogador: quem o leva neste dia (os mais escolhidos em cima), com cadeado em quem o fixou
    // cada conta é uma linha: a principal de cada um e, a seguir, as smurfs (as minhas do plano; as dos outros do que partilharam)
    const myName = (S.profile || {}).display_name || 'Tu';
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
          return '<button type="button" class="lp-pl' + (same ? ' same' : '') + '" data-action="pform" data-id="' + esc(id) + '" title="' + esc(nameOf(id)) + (lk ? ' (fixado)' : '') + (same ? ' · também no teu' : '') + '">' + face(id, 'sm') + (lk ? '<i class="lp-lk">' + icoLock + '</i>' : '') + '<span class="lp-nm">' + esc(lastName(id) || id) + '</span></button>'; };
        const sub = p.smurf ? 'smurf' + (p.uid === me ? '' : ' de ' + groupName(p.uid)) : p.at ? ago(p.at) : '';
        return '<li class="row lp-row' + (p.smurf ? ' smurf' : '') + '"><div class="lp-who">' + avatar(p.key, p.name) + '<div style="min-width:0"><div class="nm">' + esc(p.key === me ? 'Tu' : p.name) + '</div>' + (sub ? '<div class="small muted lp-sub">' + esc(sub) + '</div>' : '') + '</div></div>' +
          '<div class="lp-pls">' + (p.ids.length ? p.ids.map(pl).join('') : '<span class="small muted">sem jogadores</span>') + '</div></li>'; };
      return '<div class="card"><div class="list-head"><h2>Dia ' + (day.idx + 1) + ' · ' + esc(objsText(day)) + '</h2><span class="small muted">' + dWeek(day.date) + ', ' + dShort(day.date) + '</span></div><ul class="list">' + people.map(prow).join('') + '</ul></div>';
    }
    const rows = list.map(([id, ps]) => '<li' + (myLu.has(id) ? ' class="lu-mine"' : '') + '><button class="row lu-pl" type="button" data-action="pform" data-id="' + esc(id) + '"><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(id)) + '</span></div>' +
      '<div class="ps">' + esc(((S.players.get(String(canon(id))) || {}).team) || '') + '</div></div></span>' +
      '<span class="lu-who">' + ps.map(p => '<span class="lu-av' + (p.lk.has(id) ? ' lk' : '') + '" title="' + esc(p.key === me ? 'Tu' : p.name) + (p.lk.has(id) ? ' (fixado)' : '') + '">' + avatar(p.key, p.name) + (p.lk.has(id) ? '<i>' + icoLock + '</i>' : '') + '</span>').join('') + '</span><b class="lu-n num">' + ps.length + '</b></button></li>').join('');
    return '<div class="card"><div class="list-head"><h2>Dia ' + (day.idx + 1) + ' · ' + esc(objsText(day)) + '</h2><span class="small muted">' + dWeek(day.date) + ', ' + dShort(day.date) + '</span></div>' + (rows ? '<ul class="list">' + rows + '</ul>' : '<div class="row small muted">Ninguém tem lineup para este dia.</div>') + '</div>';
  });
  const pv = S.luView === 'pessoa';
  return '<div class="seg pl-seg lu-seg" role="group" aria-label="Como ver os lineups">' + [['jogador', 'Por jogador'], ['pessoa', 'Por pessoa']].map(([k, l]) => '<button type="button" data-action="lu-view" data-v="' + k + '" aria-pressed="' + ((k === 'pessoa') === pv) + '">' + l + '</button>').join('') + '</div>' +
    '<div class="sec-head"><span class="small muted">' + (pv ? 'O lineup de cada um · <span class="lp-ring" aria-hidden="true"></span> também no teu' : 'Quem leva cada jogador · <span class="lu-mine-key">em destaque</span>: no teu lineup') + ' · ' + icoLock + ' fixado</span>' + helpBtn('lineups') + '</div>' +
    (shared.length ? '' : '<div class="note info">Ainda ninguém do grupo partilhou o plano.</div>') + cards.join('') +
    (hidden.length ? '<p class="small muted" style="margin:0 4px">Sem plano partilhado: ' + hidden.map(m => esc(groupName(m.user_id))).join(', ') + '.</p>' : '');
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
  S.borrow.busy = true; out.innerHTML = '<div class="small muted" id="borrowProg">A escolher entre ' + plural(offers.length, 'Moment', 'Moments') + ' dos amigos…</div>';
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
      const o = short[k], p = $('borrowProg'); if (p) p.textContent = 'A refazer a run com ' + nameOf(o.id) + ' (do ' + o.from + ')… ' + (k + 1) + ' de ' + short.length;
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
  const W0 = mainResult().wins, gain = k ? k[0].wins + ' vitórias: ' + pct(base.res.prizeProbs[k[1]]) + ' → <span class="up">' + pct(ev.res.prizeProbs[k[1]]) + '</span>' : 'Vitórias esperadas: ' + f1(W0 + base.res.expected) + ' → <span class="up">' + f1(W0 + ev.res.expected) + '</span>';
  const pp = k ? Math.round((ev.res.prizeProbs[k[1]] - base.res.prizeProbs[k[1]]) * 100) : null;
  const first = used[0], last = used[used.length - 1];
  const between = o.busy.filter(d => first && d > first && d < last), after = o.busy.filter(d => last && d > last);
  const days = used.map(d => { const b = base.res.days.find(x => x.date === d), a = ev.res.days.find(x => x.date === d), day = S.days.find(x => x.date === d);
    return '<li><b>Dia ' + (day ? S.days.indexOf(day) + 1 : '?') + '</b> · ' + dWeek(d) + ' ' + dShort(d) + ' · ' + esc(objsText(day)) + ' — vitória ' + (b ? pct(b.P) : '–') + ' → <b>' + (a ? pct(a.P) : '–') + '</b></li>'; }).join('');
  const msg = 'Pede o <b>' + esc(nameOf(o.id)) + '</b> ao <b>' + esc(o.from) + '</b> para ' + (used.length === 1 ? 'o dia ' : 'os dias ') + spans(dn(used)) + '.';
  const safe = o.busy.length ? 'O ' + esc(o.from) + ' usa-o ' + (o.busy.length === 1 ? 'no dia ' : 'nos dias ') + spans(dn(o.busy)) + (between.length ? ': devolve-lho antes do dia ' + dn(between)[0] + ' e volta a pedir.' : after.length ? ': devolve-lho até ao dia ' + dn(after)[0] + '.' : '.') : 'O plano do ' + esc(o.from) + ' não o usa no resto da run.';
  return '<div class="card panel buy-card"><div class="list-head" style="padding:0"><h2>' + (i + 1) + '. ' + esc(nameOf(o.id)) + '</h2><span class="small muted">' + teamTag((S.players.get(o.id) || {}).team) + ' · do ' + esc(o.from) + '</span></div>' +
    '<div>' + msg + '</div><div class="buy-gain">' + gain + (pp != null && pp > 0 ? ' <small>+' + pp + ' pp</small>' : '') + '</div>' +
    (days ? '<ul class="small buy-days">' + days + '</ul>' : '') +
    '<div class="small muted">Vitórias esperadas: ' + f1(mainResult().wins + base.res.expected) + ' → ' + f1(mainResult().wins + ev.res.expected) + '. ' + safe + (o.others.length ? ' Também o tem: ' + o.others.map(esc).join(', ') + '.' : '') + '</div></div>';
}
function emprestimosHtml() {
  const r = mainResult(), B = S.borrow.results;
  if (!S.runId || !r || !r.model.days.length) return '<div class="note info">' + (S.runId ? 'A run já terminou.' : 'Ainda não há runs.') + '</div>';
  const n = borrowOffers().length;
  let out = '';
  if (S.borrow.busy) out = '<div class="small muted" id="borrowProg">A calcular…</div>';
  else if (B && B.err) out = '<div class="note">Erro: ' + esc(B.err) + '</div>';
  else if (B && B.none) out = '<div class="note info">Nenhum Moment dos amigos serve agora.</div>';
  else if (B) out = B.list.length ? B.list.map((z, i) => borrowCard(z, B.base, i)).join('') : '<div class="note info">Nenhum dos ' + B.n + ' Moments disponíveis melhora a tua run.</div>';
  return '<div class="card panel"><h2>Pedir emprestado ' + helpBtn('emprestimos') + '</h2>' +
    '<div class="small"><b>' + plural(n, 'Moment', 'Moments') + '</b> de ' + plural(new Set(borrowOffers().map(o => o.uid)).size, 'amigo', 'amigos') + ', em dias em que eles não os usam.</div>' +
    '<button class="btn primary" type="button" data-action="borrow-run"' + (n && !S.borrow.busy ? '' : ' disabled') + '>Ver o que compensa pedir</button></div>' +
    '<div id="borrowOut" class="stack">' + out + '</div>';
}
// ---- Classificação do Historic: o lugar de cada conta do grupo em cada dia (lido no Top Shot com o Historic) ----
// dias do documento mais recente; os lugares juntam as leituras de todos (a mais recente primeiro). "_me" é o lineup de
// quem leu (sem endereço): fica pela conta principal dessa pessoa
function histGroupDays() {
  const docs = [S.histMine && S.session ? { h: S.histMine, uid: S.session.user.id } : null].concat(((S.group || {}).summaries || []).map(x => x.share && x.share.hist ? { h: x.share.hist, uid: x.user_id } : null))
    .filter(z => z && z.h.at && Array.isArray(z.h.days)).sort((p, q) => String(q.h.at).localeCompare(String(p.h.at)));
  if (!docs.length) return null;
  const H = docs[0].h, by = new Map(H.days.map(d => [d.id, Object.assign({}, d, { mine: {}, no: new Set() })]));
  docs.forEach(({ h, uid }) => h.days.forEach(d => {
    const D = by.get(d.id); if (!D) return;
    Object.entries(d.mine || {}).forEach(([k, v]) => { const key = k === '_me' ? '_me:' + uid : k; if (v && v.rank && !D.mine[key]) D.mine[key] = v; });
    (d.no || []).forEach(k => D.no.add(k));
  }));
  return { H, at: H.at, days: [...by.values()].filter(d => (d.lines && d.lines.length) || Object.keys(d.mine).length) };
}
// "HISTORIC - RUN 1 - 2026-27 SEASON" → "Run 1"
const hRunShort = run => { const n = String((run || {}).name || ''), m = n.match(/run\s*(\d+)/i); return m ? 'Run ' + m[1] : n || 'Historic'; };
const hMineOf = (D, x) => { const ak = x.addr ? addrKey(x.addr) : null; return (ak && D.mine[ak]) || (x.acc === 'main' ? D.mine['_me:' + x.uid] : null) || null; };
const hPrize = (D, rank) => { const b = rank && (D.bands || []).find(z => rank >= z[0] && rank <= z[1]); return b ? +b[2] || 0 : 0; };
function histClassifHtml() {
  const G = histGroupDays(), money = c => usd(c / 100);
  if (!G || !G.days.length) return '<div class="card"><div class="list-head"><h2>Classificação do Historic</h2></div><div class="pad small muted">Ainda não há lugares do Historic: aparecem depois de se ler o Historic no Top Shot.</div></div>';
  const days = G.days;
  const people = groupEntries().map(x => {
    const cells = days.map(D => { const m = hMineOf(D, x), ak = x.addr ? addrKey(x.addr) : null; return { D, m, no: !m && ak && D.no.has(ak) }; });
    const played = cells.filter(c => c.m), paid = played.filter(c => c.m.rank <= hLastPaid(c.D));
    return { x, cells, played: played.length, paid: paid.length, won: played.reduce((t, c) => t + hPrize(c.D, c.m.rank), 0), best: played.length ? Math.min(...played.map(c => c.m.rank)) : 1e9 };
  }).filter(z => z.played).sort((a, b) => (b.won - a.won) || (b.paid - a.paid) || (a.best - b.best) || (b.played - a.played));
  if (!people.length) return '<div class="card"><div class="list-head"><h2>Classificação do Historic</h2></div><div class="pad small muted">Ainda ninguém do grupo tem lugar no Historic (só aparecem as contas com endereço Flow no perfil).</div></div>';
  const cell = c => {
    const r = c.m && c.m.rank, pz = r ? hPrize(c.D, r) : 0, tip = 'Dia ' + histDayNo(c.D.id) + (r ? ': ' + r + '.º' + (c.D.entries ? ' de ' + c.D.entries : '') + (c.m.score != null ? ' · ' + f1(c.m.score) + ' pontos' : '') : c.no ? ': sem lineup' : '');
    return '<td class="c ' + (r ? (r <= hLastPaid(c.D) ? 'w' : 'l') : 'n') + '" title="' + esc(tip) + '">' + (r ? r.toLocaleString('pt-PT') + '.º' + (pz ? '<small class="dz">+' + money(pz) + '</small>' : '') : '—') + '</td>';
  };
  const rows = people.map(z => '<tr' + (z.x.uid === S.session.user.id ? ' class="me"' : '') + ' data-action="friend" data-id="' + esc(z.x.uid) + '" data-acc="' + esc(z.x.acc) + '" tabindex="0" role="button"><td class="who2">' + avatar(z.x.acc === 'main' ? z.x.uid : z.x.uid + '|' + z.x.acc, z.x.name) +
    '<span><b>' + esc(z.x.name) + '</b>' + (z.x.acc !== 'main' ? '<small>smurf' + (z.x.owner ? ' de ' + esc(z.x.owner) : '') + '</small>' : z.x.uid === S.session.user.id ? '<small>tu</small>' : '') + '</span></td>' +
    z.cells.map(cell).join('') + '<td class="money">' + (z.won ? money(z.won) : '—') + '</td></tr>').join('');
  const dayTot = (D, k) => { let t = 0, w = 0, any = false; people.forEach(z => { const c = z.cells[k]; if (c.m) { any = true; if (c.m.rank <= hLastPaid(D)) w++; t += hPrize(D, c.m.rank); } }); return { t, w, any }; };
  const all = people.reduce((t, z) => t + z.won, 0);
  const totRow = people.length > 1 ? '<tr class="tot"><td class="who2"><span><b>Grupo</b></span></td>' + days.map((D, k) => { const q = dayTot(D, k); return '<td><b>' + (q.t ? money(q.t) : '—') + '</b>' + (q.any ? '<small>' + q.w + ' ✓</small>' : '') + '</td>'; }).join('') + '<td class="money"><b>' + (all ? money(all) : '—') + '</b></td></tr>' : '';
  const head = '<tr><th class="who2">Conta</th>' + days.map(D => '<th>Dia ' + histDayNo(D.id) + '</th>').join('') + '<th>Ganho</th></tr>';
  return '<div class="card"><div class="list-head"><h2>Classificação do Historic</h2></div><div class="small muted" style="padding:0 16px 6px">' + esc(hRunShort(G.H.run)) + ' · lugares ' + ago(G.at) + '</div>' +
    '<div class="gc-wrap"><table class="gc"><thead>' + head + '</thead><tbody>' + rows + totRow + '</tbody></table></div></div>';
}
// Classic ou Historic na Classificação (sem escolha: segue o modo da Jornada)
const gcMode = () => S.gcMode || (S.jmode === 'historic' ? 'historic' : 'classic');
const gcSeg = () => '<div class="seg gc-mode" role="group" aria-label="Modo">' + [['classic', 'Classic'], ['historic', 'Historic']].map(([k, l]) => '<button type="button" data-action="gc-mode" data-v="' + k + '" aria-pressed="' + (gcMode() === k) + '">' + l + '</button>').join('') + '</div>';
function renderGrupo() {
  const el = $('tab-grupo');
  if (S.loading) { el.innerHTML = empty('A carregar…', 'A ler o grupo.'); return; }
  if (!S.runId) { el.innerHTML = empty('Ainda não há runs', 'A classificação aparece quando houver uma run.'); return; }
  const gsub = subOf('grupo');
  if (gsub === 'lineups') { el.innerHTML = subBar('grupo') + '<div class="stack">' + lineupsHtml() + '</div>'; return; }
  if (gsub === 'emprestimos') { el.innerHTML = subBar('grupo') + '<div class="stack">' + emprestimosHtml() + '</div>'; return; }
  if (gcMode() === 'historic') { el.innerHTML = subBar('grupo') + gcSeg() + histClassifHtml(); return; }
  const nd = nextDay(), R = groupRanks(), people = groupEntries();
  // com os lugares do Top Shot, a ordem é a da classificação oficial (vitórias e o desempate deles)
  if (R) people.sort((a, b) => ((a.rk && a.rk.found ? a.rk.rank : 1e9) - (b.rk && b.rk.found ? b.rk.rank : 1e9)) || (b.wins - a.wins));
  // grelha: uma linha por conta, o lugar na run (com o prémio que daria hoje) e o lugar em cada dia já jogado
  const run = curRun() || {}, today = todayET();
  const days = S.days.filter(d => d.date <= today || (nd && nd.date === d.date) || people.some(x => x.daysRes[d.date]));
  const money = c => { const v = c / 100; return '$' + (v % 1 ? v.toFixed(2).replace('.', ',') : v.toLocaleString('pt-PT')); };
  const prizeAt = r => { const b = R && (R.bands || []).find(z => r >= z[0] && r <= z[1]); return !b ? '' : b[2] ? money(b[2]) : b[3] || ''; };
  // prémio de um dia (créditos): pelas faixas desse dia (ou as do Classic: 150, 100, 50, 20, 10, 5, 3, 2 até ao 100.º), pelo lugar, mesmo que se tenha perdido o dia
  const dayPrize = (d, dr) => { if (!dr || !dr.rank) return 0; const bands = d && d.bands && d.bands.length ? d.bands : DAY_BANDS, b = bands.find(z => dr.rank >= z[0] && dr.rank <= z[1]); return b ? b[2] : 0; };
  const rdays = (R && R.days) || [];
  const lastPaid = R && (R.bands || []).length ? Math.max(...R.bands.map(b => b[1])) : null, qual = R && R.qual;
  const zone = r => (qual && r <= qual ? ' z-q' : lastPaid && r <= lastPaid ? ' z-p' : '');
  const cell = (x, d) => {
    const dr = dayRankOf(x.addr, d.date), no = !(dr && dr.rank) && tsNoEntry(x.addr, d.date); // no: não levou lineup
    const res = dr && dr.rank ? (dr.won ? 'win' : 'loss') : no ? null : x.daysRes[d.date], pz = dayPrize(rdays.find(z => z.date === d.date), dr);
    const cls = res === 'win' ? 'w' : res === 'loss' ? 'l' : 'n', tip = dShort(d.date) + (no ? ': sem lineup' : res ? (res === 'win' ? ': ganhou' : ': perdeu') : '') + (dr && dr.rank && dr.total ? ' · ' + dr.rank + ' de ' + dr.total : '');
    return '<td class="c ' + cls + (nd && nd.date === d.date && !res ? ' now' : '') + '" title="' + esc(tip) + '">' + (dr && dr.rank ? dr.rank.toLocaleString('pt-PT') + '.º' + (pz ? '<small class="dz">+' + money(pz) + '</small>' : '') : res ? (res === 'win' ? '✓' : '✕') : '—') + '</td>';
  };
  const rows = people.map(x => {
    const rk = x.rk && x.rk.found ? x.rk : null, pz = rk ? prizeAt(rk.rank) : '';
    const won = rdays.reduce((t, d) => t + dayPrize(d, x.addr ? (d.accs || {})[addrKey(x.addr)] : null), 0);
    return '<tr' + (x.uid === S.session.user.id ? ' class="me"' : '') + ' data-action="friend" data-id="' + esc(x.uid) + '" data-acc="' + esc(x.acc) + '" tabindex="0" role="button"><td class="who2">' + avatar(x.acc === 'main' ? x.uid : x.uid + '|' + x.acc, x.name) +
      '<span><b>' + esc(x.name) + '</b>' + (x.acc !== 'main' ? '<small>smurf' + (x.owner ? ' de ' + esc(x.owner) : '') + '</small>' : x.uid === S.session.user.id ? '<small>tu</small>' : '') + '</span></td>' +
      '<td class="rr' + (rk ? zone(rk.rank) : '') + '">' + (rk ? '<b>' + rk.rank.toLocaleString('pt-PT') + '.º</b><small>' + plural(rk.wins != null ? rk.wins : x.wins, 'vitória', 'vitórias') + (pz ? ' · ' + esc(pz) : '') + '</small>' : '<b class="muted">—</b><small>' + plural(x.wins, 'vitória', 'vitórias') + '</small>') + '</td>' +
      days.map(d => cell(x, d)).join('') + '<td class="money">' + (won ? money(won) : '—') + '</td></tr>';
  }).join('');
  // linha do grupo: o que se ganhou em cada dia e quantas contas ganharam o dia
  const dayTot = d => { const rd = rdays.find(z => z.date === d.date); let t = 0, w = 0, any = false; people.forEach(x => { const dr = dayRankOf(x.addr, d.date), res = dr && dr.rank ? (dr.won ? 'win' : 'loss') : tsNoEntry(x.addr, d.date) ? null : x.daysRes[d.date]; if (res) any = true; if (res === 'win') w++; t += dayPrize(rd, dr); }); return { t, w, any }; };
  const allWon = people.reduce((t, x) => t + rdays.reduce((u, d) => u + dayPrize(d, x.addr ? (d.accs || {})[addrKey(x.addr)] : null), 0), 0);
  const totRow = people.length > 1 ? '<tr class="tot"><td class="who2"><span><b>Grupo</b></span></td><td></td>' + days.map(d => { const z = dayTot(d); return '<td><b>' + (z.t ? money(z.t) : '—') + '</b>' + (z.any ? '<small>' + z.w + ' ✓</small>' : '') + '</td>'; }).join('') + '<td class="money"><b>' + (allWon ? money(allWon) : '—') + '</b></td></tr>' : '';
  const hasLu = d => { const rd = rdays.find(z => z.date === d.date); return !!(rd && Object.values(rd.accs || {}).some(a => Array.isArray(a.lu) && a.lu.length)); };
  const head = '<tr><th class="who2">Conta</th><th>Run</th>' + days.map((d, k) => '<th title="' + esc(objsText(d)) + '">' + (hasLu(d) ? '<button class="gc-day" type="button" data-action="day-lus" data-date="' + d.date + '" aria-label="Lineups do dia ' + (S.days.indexOf(d) + 1) + '">Dia ' + (S.days.indexOf(d) + 1) + ' ›</button>' : 'Dia ' + (S.days.indexOf(d) + 1)) + '</th>').join('') + '<th>Ganho</th></tr>';
  const info = R ? esc(run.name || 'Run') + (R.total ? ' · ' + R.total.toLocaleString('pt-PT') + ' jogadores' : '') + ' · lugares ' + ago(R.at) : 'Lugares do Top Shot ainda não lidos';
  el.innerHTML = subBar('grupo') + gcSeg() + '<div class="card"><div class="list-head"><h2>Classificação ' + helpBtn('classif') + '</h2></div><div class="small muted" style="padding:0 16px 6px">' + info + '</div>' +
    '<div class="gc-wrap"><table class="gc"><thead>' + head + '</thead><tbody>' + (rows || '<tr><td class="muted small">Ainda não há membros.</td></tr>') + totRow + '</tbody></table></div>' +
    // só a linha de corte (vitórias para entrar no top 50 / nos prémios), se for conhecida; a legenda saiu
    (R && R.cut && Object.keys(R.cut).length ? '<div class="small muted gc-leg">Vitórias para entrar: ' + Object.entries(R.cut).map(([k, w]) => 'top ' + k + ' ' + w).join(', ') + '</div>' : '') + '</div>' +
    // lugares e preços: só quem gere o grupo (admin) os vai ler ao Top Shot; os outros veem o que ele leu
    '<div class="foot" style="padding:0;border:0;grid-template-columns:1fr"><button class="btn" type="button" data-action="group-refresh">Atualizar</button></div>';
}
// uma entrada por conta de cada membro (principal e smurfs): resultados da blockchain, depois os do próprio (resumo
// publicado) e, nos dias que ainda não têm, o resultado pelas fichas da ESPN com o lineup partilhado (prov: por confirmar)
// os lineups que cada conta do grupo levou num dia (lidos no Top Shot com os lugares), do melhor lugar para o pior
function dayLineupsSheet(date) {
  const R = groupRanks(), rd = R && (R.days || []).find(z => z.date === date), day = S.days.find(d => d.date === date) || {}; if (!rd) return;
  const ppl = groupEntries().map(x => ({ x, a: x.addr ? (rd.accs || {})[addrKey(x.addr)] : null })).filter(z => z.a && z.a.rank).sort((p, q) => p.a.rank - q.a.rank);
  const pl = z => { const id = tsIdOf(z[1]); return '<span class="lp-pl">' + (id ? face(id, 'sm') : '<span class="face sm"><b>' + esc(initials(z[1] || '?')) + '</b></span>') + '<span class="lp-nm">' + esc(id ? lastName(id) : (z[1] || '?').split(' ').slice(-1)[0]) + '</span></span>'; };
  const row = ({ x, a }) => '<li class="row lp-row' + (x.acc !== 'main' ? ' smurf' : '') + '"><div class="lp-who">' + avatar(x.acc === 'main' ? x.uid : x.uid + '|' + x.acc, x.name) + '<div style="min-width:0"><div class="nm">' + esc(x.name) + '</div><div class="small ' + (a.won ? 'c-good' : 'c-bad') + '">' + (a.won ? '✓ ' : '✕ ') + a.rank.toLocaleString('pt-PT') + '.º' + (rd.total ? ' de ' + rd.total.toLocaleString('pt-PT') : '') + '</div></div></div>' +
    '<div class="lp-pls">' + (Array.isArray(a.lu) && a.lu.length ? a.lu.map(pl).join('') : '<span class="small muted">' + (a.luh ? 'lineup escondido' : 'sem lineup lido') + '</span>') + '</div></li>';
  openSheet('<h3>Lineups do dia ' + (S.days.indexOf(day) + 1) + '</h3><div class="small muted">' + dWeek(date) + ', ' + dShort(date) + ' · ' + esc(objsText(day)) + '</div>' +
    (ppl.length ? '<div class="card"><ul class="list lp-list">' + ppl.map(row).join('') + '</ul></div>' : '<div class="note info">Ainda não há lineups lidos para este dia.</div>') +
    '<div class="small muted">Lidos no Top Shot com os lugares ' + ago(R.at) + '.</div>');
}
function groupEntries() {
  const memberIds = new Set(S.group.members.map(m => m.user_id)), profs = new Map(S.group.profiles.map(p => [p.user_id, p])), sums = new Map(S.group.summaries.map(s => [s.user_id, s]));
  const chainBy = {};
  S.group.chain.forEach(c => { const k = c.user_id + '|' + (c.account || 'main'); (chainBy[k] = chainBy[k] || {})[c.date] = c; });
  const out = [];
  [...memberIds].forEach(uid => {
    const p = profs.get(uid) || {}, own = S.session && uid === S.session.user.id ? accSummaries() : null; // as minhas contas: o que está no ecrã, sem esperar pelo resumo gravado
    const s = own && own.main ? Object.assign({}, sums.get(uid) || {}, own.main) : sums.get(uid) || null, accs = own && Object.keys(own).length ? own : (s && s.share && s.share.accs) || {};
    const list = [{ id: 'main', name: p.display_name || 'Sem nome' }].concat((Array.isArray(p.smurfs) ? p.smurfs : []).filter(x => x && x.id).map((x, k) => ({ id: x.id, name: x.topshot_username || (accs[x.id] || {}).label || 'Smurf ' + (k + 1) })));
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
    return '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">Dia ' + (i + 1) + ' · ' + esc(objsText(d)) + '</span></div><div class="ps">' + dShort(d.date) + (c && c.points != null ? ' · ' + f0(+c.points) + ' feitos' : '') + (lineup ? ' · ' + esc(lineup) : '') + '</div></div>' +
      (r ? '<span class="pchip ' + (r === 'win' ? 'p-good' : 'p-bad') + '">' + (r === 'win' ? 'V' : 'D') + '</span>' : '<span class="pchip p-done">—</span>') + '</li>';
  }).join('');
  const ts = sm ? sm.topshot_username : p.topshot_username;
  openSheet('<h3>' + esc(E.name || 'Sem nome') + '</h3><div class="small muted">' + (sm ? 'Smurf de ' + esc(p.display_name || '?') + ' · ' : '') + (ts ? 'Top Shot: ' + esc(ts) : 'Sem utilizador do Top Shot no perfil') + '</div>' +
    '<ul class="list card">' + rows + '</ul>');
}

// ---- Ajustes ----
function renderAjustes() {
  const el = $('tab-ajustes'), me = S.profile || {}, run = curRun(), sub = subOf('ajustes'), html = [subBar('ajustes')];
  if (sub === 'perfil') html.push('<div class="card panel"><h2>Perfil</h2><form id="pfForm" class="stack">' +
    '<label class="small muted">Nome que o grupo vê<input class="field" id="pfName2" maxlength="40" value="' + esc(me.display_name || '') + '"></label>' +
    '<label class="small muted">Utilizador do Top Shot<input class="field" id="pfTs2" maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false" value="' + esc(me.topshot_username || '') + '"></label>' +
    '<div class="field-lbl"><label class="small muted" for="pfFlow2">Endereço Flow (carteira Dapper)</label>' + helpBtn('flow') + '</div><input class="field" id="pfFlow2" maxlength="18" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="0x…" value="' + esc(me.flow_address || '') + '">' +
    smurfFormHtml() +
    '<div class="btns"><button class="btn quiet" type="button" data-action="logout">Terminar sessão</button><button class="btn primary" type="submit">Guardar perfil</button></div></form></div>' +
    '<div class="card panel"><h2>Partilhar com o grupo ' + helpBtn('partilha') + '</h2>' +
    '<div class="seg acc-seg" role="group" aria-label="Partilhar o plano"><button type="button" data-action="share-plan" data-v="1" aria-pressed="' + (me.share_plan !== false) + '">Partilhar</button><button type="button" data-action="share-plan" data-v="0" aria-pressed="' + (me.share_plan === false) + '">Não partilhar</button></div></div>');
  if (sub === 'prefs' && S.runs.length) {
    html.push('<div class="card panel"><h2>Run a ver</h2><select class="field" id="runPick" aria-label="Escolher run">' + S.runs.map(x => '<option value="' + esc(x.id) + '"' + (x.id === S.runId ? ' selected' : '') + '>' + esc(x.name) + ' · ' + dShort(x.start_date) + (x.active ? ' (ativa)' : '') + '</option>').join('') + '</select></div>');
  }
  if (sub === 'prefs') html.push('<div class="card panel"><h2>Língua · Language</h2>' +
    '<div class="seg acc-seg" role="group" aria-label="Língua · Language">' + [['pt', 'Português'], ['en', 'English']].map(([k, l]) => '<button type="button" data-action="lang" data-v="' + k + '" aria-pressed="' + (LANG === k) + '">' + l + '</button>').join('') + '</div></div>');
  if (sub === 'prefs') html.push('<div class="card panel"><h2>Aspeto</h2>' +
    '<div class="seg acc-seg" role="group" aria-label="Aspeto">' + [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([k, l]) => '<button type="button" data-action="theme" data-v="' + k + '" aria-pressed="' + (theme === k) + '">' + l + '</button>').join('') + '</div></div>');
  if (sub === 'prefs' && accounts().length > 1) {
    const p = (S.mine.plan || {}).prio || 'auto', au = prioAuto();
    html.push('<div class="card panel"><h2>Prioridade entre contas ' + helpBtn('prio') + '</h2>' +
      '<div class="chips" role="group" aria-label="Prioridade entre contas">' + [['auto', 'Automática']].concat(accounts().map(a => [a.id, accLabel(a.id)])).concat([['eq', 'Iguais']]).map(([k, l]) => '<button type="button" data-action="prio" data-v="' + esc(k) + '" aria-pressed="' + (p === k) + '">' + esc(l) + '</button>').join('') + '</div>' +
      '<div class="small muted">' + (p === 'auto' ? (au ? 'Os melhores Moments vão primeiro para a <b>' + esc(accLabel(au.id)) + '</b>, a mais bem classificada (' + esc(ord(au.rank)) + ' na Geral).' : 'Ainda sem lugares lidos: sem prioridade.') : p === 'eq' ? 'Sem prioridade: o plano pode pôr os melhores Moments em qualquer uma das contas.' : 'Os melhores Moments vão primeiro para a <b>' + esc(accLabel(p)) + '</b>.') + '</div></div>');
  }
  if (sub === 'prefs') html.push('<div class="card panel"><h2>Cálculo sem odds ' + helpBtn('avancado') + '</h2>' +
    '<div class="label">Jogos seguidos</div><div class="seg acc-seg" role="group" aria-label="Jogos seguidos"><button type="button" data-action="b2b" data-v="1" aria-pressed="' + b2bOn + '">Ajustar</button><button type="button" data-action="b2b" data-v="0" aria-pressed="' + !b2bOn + '">Não ajustar</button></div>' +
    '<div class="label">Peso da forma recente</div><div class="seg acc-seg" role="group" aria-label="Peso da forma">' + FORM_LEVELS.map(([k, l]) => '<button type="button" data-action="form-level" data-level="' + k + '" aria-pressed="' + (formLevel === k) + '">' + l + '</button>').join('') + '</div></div>');
  if (sub === 'prefs') html.push(telegramHtml()); // avisos no grupo do Telegram (os avisos pessoais, alertsHtml, ficam guardados)
  if (sub === 'admin') html.push(adminHtml(run));
  if (sub === 'dados') html.push(dataHtml());
  el.innerHTML = html.join('');
  if (sub === 'admin' && S.role === 'admin' && S.jobReq === undefined) loadJobReq();
  if (sub === 'admin' && S.role === 'admin' && S.invite == null) { sb.rpc('get_invite_code').then(({ data }) => { S.invite = data || ''; if (S.tab === 'ajustes' && !typingIn('tab-ajustes')) renderAjustes(); }); }
}
// avisos no grupo do Telegram: a tarefa "Lesões" manda-os com o bot do grupo (segredo TELEGRAM_BOT_TOKEN no GitHub)
function telegramHtml() {
  return '<div class="card panel"><h2>Avisos no Telegram</h2>' +
    '<div class="small muted">O bot do grupo do Telegram manda para o grupo, a partir dos lineups de toda a gente (o submetido no Top Shot ou, se ainda não, o do plano; quem desligou a partilha em Perfil fica de fora):</div>' +
    '<ul class="steps"><li><b>Lesões</b>: quando alguém de um lineup entra no relatório da NBA, muda de estado ou sai dele (✅ deve jogar), com de quem é o lineup.</li><li><b>Ponto da situação</b>: às 23h (ou 2 h antes do jogo) de quem continua em dúvida.</li><li><b>Especialistas do dia</b>: os melhores na estatística de hoje (os 8 primeiros em cada uma) que estejam em dúvida, mesmo sem estarem em nenhum lineup.</li><li><b>Já fizeram o lineup?</b>: uma hora antes do primeiro jogo do dia, com quem ainda não submeteu.</li><li><b>Última chamada</b>: meia hora antes do primeiro jogo do dia, se alguém continuar em dúvida.</li></ul>' +
    (S.role === 'admin' ? '<details class="small"><summary><b>Admin: ligar o bot</b></summary><ol class="steps"><li>No Telegram, fala com <b>@BotFather</b>, escreve <span class="kbd">/newbot</span> e escolhe um nome. Ele dá-te um token.</li><li>No GitHub: Settings → Secrets and variables → Actions → New repository secret, nome <span class="kbd">TELEGRAM_BOT_TOKEN</span>, valor o token.</li><li>Junta o bot ao grupo e escreve lá <span class="kbd">/start@nome_do_bot</span>.</li><li>Em Actions → Lesões → Run workflow: na meia hora seguinte o bot encontra o grupo sozinho.</li></ol></details>' : '') + '</div>';
}
// avisos antes dos jogos: email e/ou notificações no telemóvel (app ntfy, grátis, sem conta)
function alertsHtml() {
  const a = S.alerts || {}, email = ((S.session || {}).user || {}).email || '';
  const head = '<div class="card panel"><h2>Avisos no telemóvel</h2>';
  if (S.alertsOk === false) return head + '<div class="small muted">Para ligar avisos, o admin tem de correr o supabase/schema.sql novo no Supabase (SQL Editor).</div></div>';
  return head + '<div class="small muted">Uma tarefa automática vê o relatório de lesões da NBA de 15 em 15 minutos à noite e manda-te:</div>' +
    '<ul class="steps"><li><b>Lesão no lineup</b>: quando alguém do teu lineup de hoje entra no relatório, muda de estado ou sai dele (✅ deve jogar).</li><li><b>Ponto da situação</b>: às 23h (ou 2 h antes do jogo) de quem continua em dúvida.</li><li><b>Última chamada</b>: cerca de 15–30 min antes do jogo, se continuar em dúvida.</li><li><b>Já fizeste o lineup?</b>: uma hora antes do primeiro jogo do dia, com a sugestão do site (não chega se já submeteste em todas as contas).</li></ul>' +
    '<div class="small muted">O lineup é o que submeteste no Top Shot (lido da blockchain) ou, se ainda não submeteste, o do plano.</div>' +
    (a.ntfy ? '<div class="label">No telemóvel</div><ol class="steps small"><li>Instala a app <b>ntfy</b> (grátis, Android e iPhone).</li><li>Carrega em <b>+</b> e subscreve este tópico: <span class="kbd" id="ntfyTopic">' + esc(a.ntfy) + '</span> <button class="btn link small" type="button" data-action="copy-topic">copiar</button></li><li>Carrega em <b>Testar</b>: deve chegar uma notificação.</li></ol>' +
      '<div class="small muted">Quem souber o tópico também recebe as tuas mensagens: não o partilhes.</div><div class="btns"><button class="btn" type="button" data-action="alerts-test">Testar</button><button class="btn quiet" type="button" data-action="alerts-ntfy-off">Desligar</button></div>'
      : '<button class="btn" type="button" data-action="alerts-ntfy-on">Ligar notificações no telemóvel</button>') +
    '<button class="switch" type="button" data-action="alerts-email" aria-pressed="' + !!a.email + '"><i></i>Por email' + (email ? ' (' + esc(email) + ')' : '') + '</button>' +
    (S.role === 'admin' ? '<div class="small muted">Admin: os emails precisam dos segredos SMTP_USER e SMTP_PASS no GitHub e da tarefa "Lesões" (ver README).</div>' : '') + '</div>';
}
async function saveAlerts(patch) {
  const row = Object.assign({ email: false, ntfy: null }, S.alerts || {}, patch, { user_id: S.session.user.id });
  delete row.updated_at;
  try { await q(sb.from('alerts').upsert(row, { onConflict: 'user_id' })); S.alerts = row; S.alertsOk = true; return true; }
  catch (e) { toast(/alerts/.test(errText(e)) ? 'Para ligar avisos, o admin tem de correr o supabase/schema.sql novo.' : 'Não guardou: ' + errText(e)); return false; }
}
function newTopic() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789', b = new Uint8Array(16);
  (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
  return 'fastbreak-' + Array.from(b, x => abc[x % abc.length]).join('');
}
async function testNtfy() {
  const topic = (S.alerts || {}).ntfy; if (!topic) return;
  try {
    const res = await fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify({ topic, title: 'Fast Break · teste', message: 'Os avisos chegam aqui. Antes dos jogos, se alguém do teu lineup estiver lesionado, recebes uma mensagem destas.', tags: ['basketball'] }) });
    toast(res.ok ? 'Enviado. Se não chegou, confirma o tópico na app ntfy.' : 'O ntfy recusou (' + res.status + '). Tenta daqui a pouco.');
  } catch (e) { toast('Não consegui falar com o ntfy.sh. Verifica a internet.'); }
}
// contas smurf no perfil (até 2): o plano junta as coleções e diz que Moments mandar para que conta
function smurfFormHtml() {
  const sms = S.smDraft || (S.smDraft = smurfList().map(x => Object.assign({}, x)));
  return '<div class="field-lbl"><span class="label">Contas smurf</span>' + helpBtn('smurf') + '</div>' +
    sms.map((x, i) => '<div class="smurf-row stack"><div class="label">Smurf ' + (i + 1) + '</div>' +
      '<label class="small muted">Utilizador do Top Shot<input class="field" id="smTs' + i + '" maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false" value="' + esc(x.topshot_username || '') + '"></label>' +
      '<label class="small muted">Endereço Flow<input class="field" id="smFlow' + i + '" maxlength="18" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="0x…" value="' + esc(x.flow_address || '') + '"></label>' +
      '<button class="btn small quiet" type="button" data-action="sm-del" data-i="' + i + '">Tirar esta smurf</button></div>').join('') +
    (sms.length < 2 ? '<button class="btn" type="button" data-action="sm-add">Adicionar smurf</button>' : '');
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
    if (x.flow_address && !/^0x[0-9a-fA-F]{16}$/.test(x.flow_address)) throw new Error('O endereço Flow da smurf ' + (i + 1) + ' tem de ser 0x seguido de 16 caracteres.');
    let id = x.id; if (!id) { id = ['s1', 's2'].find(k => !taken.has(k)); taken.add(id); }
    return { id, topshot_username: x.topshot_username || null, flow_address: x.flow_address || null };
  });
}
// apaga de uma vez todas as runs de teste (fictícias); os dias, planteis e resumos delas vão com elas
async function deleteTestRuns() {
  const list = S.runs.filter(r => r.fictitious); if (!list.length) return;
  if (!confirm('Apagar ' + (list.length === 1 ? 'a run de teste' : 'as ' + list.length + ' runs de teste') + '? Os planteis e planos de todos nessas runs também desaparecem.')) return;
  let n = 0;
  for (const r of list) if (await adminWrite(sb.from('runs').delete().eq('id', r.id))) n++;
  toast(n === 1 ? 'Run de teste apagada.' : n + ' runs de teste apagadas.');
  try { if (list.some(r => r.id === localStorage.getItem('fb-run'))) localStorage.removeItem('fb-run'); } catch (e) {}
  await loadShared(); await loadRun(pickRun()); compute(); render(); renderAjustes();
}
async function deleteRun(run) {
  if (!run || !run.fictitious) return;
  if (!confirm('Apagar "' + run.name + '"? Os planteis e planos de todos nesta run também desaparecem.')) return;
  if (!(await adminWrite(sb.from('runs').delete().eq('id', run.id), 'Run apagada.'))) return;
  await loadShared(); await loadRun(pickRun());
  renderAjustes();
}
// runs da blockchain a decorrer ou a começar que ainda não estão no site: importam-se com um toque
const etDay = ms => new Date(ms - 4 * 3600e3).toISOString().slice(0, 10);
function chainImportCard() {
  const now = Date.now() / 1000, linked = new Set(S.runs.map(r => r.chain_run_id).filter(Boolean));
  const list = (S.chainRuns || []).filter(c => c.run_end && c.run_end > now && c.run_start && c.run_start < now + 30 * 86400 && !linked.has(c.id));
  if (!list.length) return '';
  return '<div class="card"><div class="list-head"><h2>Runs na blockchain por importar</h2><span class="small muted">' + list.length + '</span></div><ul class="list">' +
    list.map(c => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(c.name || c.id) + '</span></div><div class="ps">' + dShort(etDay(c.run_start * 1000)) + ' – ' + dShort(etDay((c.run_end - 12 * 3600) * 1000)) + '</div></div><button class="btn small primary" type="button" data-action="chain-import" data-id="' + esc(c.id) + '">Importar</button></li>').join('') +
    '</ul><div class="row small muted" style="display:block">Fica já ligada e ativa. Objetivos e jogos chegam com as tarefas do GitHub (corre-as em Actions para ser já).</div></div>';
}
async function chainImport(cid) {
  const c = (S.chainRuns || []).find(x => x.id === cid); if (!c) return;
  const start = etDay(c.run_start * 1000), endD = etDay((c.run_end - 12 * 3600) * 1000), end = endD < start ? start : endD;
  const n = (c.name || '').match(/run\s*(\d+)/i);
  const name = n ? 'Run ' + n[1] + (/classic/i.test(c.name || '') ? ' · Classic' : '') : (c.name || 'Run');
  const id = ((c.name || 'run').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)) || 'run-' + start.replace(/-/g, '');
  if (S.runs.some(r => r.id === id)) { toast('Já existe uma run com esse nome no site.'); return; }
  const dates = []; for (let d = start; d <= end && dates.length < 40;) { dates.push(d); const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); d = x.toISOString().slice(0, 10); }
  if (S.runs.some(r => r.active)) await adminWrite(sb.from('runs').update({ active: false }).eq('active', true));
  if (!(await adminWrite(sb.from('runs').insert({ id, name, mode: 'classic', start_date: start, end_date: end, prizes: [], active: true, chain_run_id: c.id, fictitious: false })))) return;
  await adminWrite(sb.from('run_days').insert(dates.map(date => ({ run_id: id, date }))), name + ' importada: ' + dates.length + ' dias. Corre as tarefas em Actions para os objetivos e os jogos chegarem já.');
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
  const money = c => { const v = c / 100; return '$' + (v % 1 ? v.toFixed(2).replace('.', ',') : v.toLocaleString('pt-PT')); };
  const bandTxt = bs => (bs || []).map(b => (b[0] === b[1] ? b[0] + '.º' : b[0] + '–' + b[1]) + ' ' + (b[2] ? money(b[2]) : esc(b[3] || ''))).join(' · ');
  const plans = [];
  for (const x of R.runs) plans.push(await runPlan(x));
  const today = todayET(), prev = S.runs.filter(r => !r.fictitious && (r.prizes || []).length).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0];
  const card = (P, i) => {
    if (!P) return '<div class="note">' + esc(R.runs[i].name || R.runs[i].id) + ': sem datas (o Top Shot ainda não mostra os dias).</div>';
    const x = P.x, ch = P.rows.filter(r => r.kind !== 'k-same').length + (P.extend ? 1 : 0), withObj = P.rows.filter(r => r.objs.length).length;
    const rows = P.rows.map((r, k) => '<li class="row"><span><b>Dia ' + (k + 1) + '</b> <span class="muted">' + dWeek(r.date) + ' ' + dShort(r.date) + '</span><br>' + (r.objs.length ? esc(objsText({ objectives: r.objs })) : r.unk.length ? '<span class="muted">' + esc(r.unk.join(' + ')) + ' (não conheço)</span>' : '<span class="muted">objetivo ainda não saiu</span>') +
      (r.kind === 'k-chg' ? '<br><span class="small muted">antes: ' + esc(objsText({ objectives: r.old })) + '</span>' : '') + '</span><span class="pill' + (r.kind === 'k-new' ? ' ok' : r.kind === 'k-chg' ? ' duv' : '') + '">' + (r.kind === 'k-new' ? 'novo' : r.kind === 'k-chg' ? 'muda' : 'igual') + '</span></li>').join('');
    const dayBands = ((x.days || []).find(d => (d.bands || []).length) || {}).bands || [];
    return '<div class="card"><div class="list-head"><h2>' + esc(P.name) + '</h2><span class="small muted">' + dShort(P.start) + ' – ' + dShort(P.end) + ' · ' + plural(P.rows.length || 0, 'dia', 'dias') + '</span></div>' +
      '<div class="row small" style="display:block">' + (P.site ? 'Já está no site' + (P.site.chain_run_id ? ' (ligada à blockchain)' : '') + '. ' : 'Ainda não está no site: vai ser criada. ') + withObj + ' de ' + P.rows.length + ' dias com objetivo.' + (P.extend ? ' As datas mudam para ' + dShort(P.start) + ' – ' + dShort(P.end) + '.' : '') + '</div>' +
      (P.unknown.length ? '<div class="note">Estatística que não conheço: ' + esc(P.unknown.join(', ')) + ' (esses objetivos ficam de fora).</div>' : '') +
      (x.daysErr ? '<div class="note">Não li os dias: ' + esc(x.daysErr) + '</div>' : '') +
      (rows ? '<ul class="list">' + rows + '</ul>' : '') +
      '<div class="row small" style="display:block"><b>Prémios da run</b>' + (x.qual ? ' (top ' + x.qual + ' qualifica)' : '') + ': ' + (x.bands.length ? bandTxt(x.bands) : '<span class="muted">o Top Shot não mostrou</span>') + '</div>' +
      (dayBands.length ? '<div class="row small" style="display:block"><b>Prémios de cada dia</b>: ' + bandTxt(dayBands) + '</div>' : '') +
      (!P.site ? '<div class="row small muted" style="display:block">Patamares de vitórias para o plano: ' + (prev ? 'os da ' + esc(prev.name) + ' (' + prev.prizes.map(p => p.wins + 'V').join(' · ') + ')' : 'nenhum') + '. ' + (P.start <= today || !S.runs.some(r => r.active && !r.fictitious && r.end_date >= today) ? 'Fica a run ativa.' : 'Fica ativa quando começar (carrega outra vez em Run e prémios nesse dia).') + '</div>' : '') +
      '<div class="btns" style="padding:4px 16px 14px"><button class="btn primary" type="button" data-action="run-apply" data-i="' + i + '"' + (ch || !P.site || (P.start <= today && !P.site.active && P.site.end_date >= today) ? '' : ' disabled') + '>' + (!P.site ? 'Criar a run' : ch ? 'Aplicar ' + plural(ch, 'mudança', 'mudanças') : P.start <= today && !P.site.active && P.site.end_date >= today ? 'Ativar a run' : 'Nada a mudar') + '</button></div></div>';
  };
  const raw = R.runs.length ? JSON.stringify({ run: R.runs[0].raw, dia: ((R.runs[0].days || [])[0] || {}).raw, objetivo: ((((R.runs[0].days || [])[0] || {}).objs || [])[0] || {}).raw }, null, 1) : '';
  openSheet('<h3>Run lida no Top Shot</h3><div class="small muted">' + (R.at ? 'Lida ' + ago(R.at) + '. ' : '') + 'Confirma antes de aplicar.</div>' +
    (R.err ? '<div class="note">Não deu: ' + esc(R.err) + '</div>' : '') +
    (!R.runs.length && !R.err ? '<div class="note info">O Top Shot não mostrou nenhuma run Classic da NBA. Se a run nova ainda não começou, tenta no primeiro dia.</div>' : '') +
    plans.map(card).join('') +
    (raw ? '<details class="small muted"><summary>Campos lidos (para diagnóstico)</summary><pre style="white-space:pre-wrap;word-break:break-all">' + esc(raw) + '</pre></details>' : ''));
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
  toast((P.site ? P.name + ': ' : P.name + ' criada: ') + [nNew ? plural(nNew, 'dia novo', 'dias novos') : '', nCh ? plural(nCh, 'objetivo mudado', 'objetivos mudados') : ''].filter(Boolean).join(', ') + (active ? ' · run ativa' : '') + '.');
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
  if (was && odds && odds.done && odds.at === was) { S.jobReqWas = null; refreshOdds(); toast(odds.ok === false ? 'A leitura das odds falhou (vê a tarefa no GitHub).' : 'Odds lidas.'); }
  if (odds && !odds.done) { S.jobReqWas = odds.at; clearTimeout(S.jobReqT); S.jobReqT = setTimeout(() => { if (S.tab === 'ajustes' && subOf('ajustes') === 'admin') loadJobReq(); else S.jobReq = undefined; }, 60e3); }
  const el = $('jobsCard'); if (el) el.outerHTML = jobsCard(); // só este cartão (pode haver um campo a meio)
}
function jobsCard() {
  const J = S.jobReq, o = J ? J.odds : null, pending = !!(o && !o.done);
  const last = Object.values(S.odds || {}).map(x => x.updated_at).filter(Boolean).sort().pop();
  const status = J === false ? '<div class="note">Para este botão funcionar, corre o <span class="kbd">supabase/schema.sql</span> novo no Supabase (SQL Editor).</div>'
    : '<div class="small muted">' + (pending ? 'Pedido às ' + hm(o.at) + '. A tarefa apanha-o em 5–15 min e a app refaz o plano sozinha.' : 'Odds lidas ' + (last ? ago(last) : 'ainda não') + (o && o.ran ? ' · último pedido ' + ago(o.ran) + (o.ok === false ? ' (falhou)' : '') : '') + '.') + '</div>';
  return '<div class="card panel" id="jobsCard"><h2>Tarefas</h2><div class="ts-read"><button class="btn" type="button" data-action="job-odds"' + (pending || J === false || J == null ? ' disabled' : '') + '>Ler as odds agora</button><span class="small muted">Hoje e amanhã. Gasta créditos da The Odds API (~1 por jogo).</span></div>' + status + '</div>';
}
async function jobOdds() {
  const { data, error } = await sb.rpc('request_job', { kind: 'odds' });
  if (error) { toast(errText(error)); return; }
  if (data && data.ok === false) toast('Já há um pedido de ' + hm(data.at) + ' à espera.');
  else toast('Pedido. As odds chegam em 5–15 min.');
  loadJobReq();
}
function adminHtml(run) {
  const out = [];
  const site = location.origin + location.pathname;
  // leituras no Top Shot (só o admin): cada uma abre o Fast Break no Top Shot e volta com o que leu
  out.push('<div class="card panel"><h2>Ler no Top Shot</h2>' +
    (S.edPending && edOn() ? '<div class="note sug"><div>Leitura das cartas por confirmar (raridade e ASP).</div><div class="btns"><button class="btn primary" type="button" data-action="ed-review">Ver o que muda</button></div></div>' : '') +
    // leituras juntas (pedido do João): o dia a dia num botão, os preços noutro
    '<div class="ts-read"><button class="btn primary" type="button" data-action="ranks-go" data-do="ranks,picks,lu,hist">Classificação, picks, lineups e Historic</button><span class="small muted">1–2 minutos. Uma vez por dia, de manhã ou antes dos jogos.</span></div>' +
    '<div class="ts-read"><button class="btn" type="button" data-action="ranks-go" data-do="' + (edOn() ? 'px,ed' : 'px') + '">Preços dos jogadores' + (edOn() ? ' e das cartas (ASP)' : '') + '</button><span class="small muted">2–4 minutos. De vez em quando.</span></div>' +
    '<div class="ts-read"><button class="btn" type="button" data-action="ranks-go" data-do="pro">Preços do Pro</button><span class="small muted">2–3 minutos. A carta mais barata de cada família de sets do Pro. Uma vez por dia chega.</span></div>' +
    '<div class="ts-read"><button class="btn" type="button" data-action="ranks-go" data-do="run">Run e prémios</button><span class="small muted">Rápido. Quando sai uma run nova, se a blockchain não a trouxer.</span></div>' +
    (S.runRead ? '<div class="note sug"><div>Run lida no Top Shot.</div><div class="btns"><button class="btn primary" type="button" data-action="run-review">Ver o que muda</button></div></div>' : '') +
    '<div class="small muted">No Top Shot toca no favorito <b>FB lugares</b> e depois em <b>Leaderboard</b>. <a href="' + siteBase() + 'lugares.html" target="_blank" rel="noopener">Como instalar</a></div></div>');
  out.push(jobsCard());
  const imp = chainImportCard(); if (imp) out.push(imp);
  if (S.runs.some(r => r.fictitious)) out.push('<div class="card panel"><button class="btn quiet" type="button" data-action="del-tests">Apagar as runs de teste (' + S.runs.filter(r => r.fictitious).length + ')</button></div>');
  out.push('<div class="card panel"><h2>Convidar amigos</h2><div class="small muted">Manda-lhes o link e o código.</div>' +
    '<div class="status-line"><span>Site</span><span class="kbd">' + esc(site) + '</span></div>' +
    '<div class="status-line"><span>Código atual</span><span class="kbd">' + (S.invite == null ? '…' : S.invite ? esc(S.invite) : 'nenhum') + '</span></div>' +
    '<form id="inviteForm" class="toolbar"><input class="field" id="invCode" placeholder="Novo código (mín. 4)" autocomplete="off" autocapitalize="none" spellcheck="false"><button class="btn" type="submit">Mudar</button></form></div>');
  const members = S.group.members.map(m => { const p = S.group.profiles.find(x => x.user_id === m.user_id) || {}; return { m, p }; });
  if (members.length) out.push('<div class="card"><div class="list-head"><h2>Membros</h2><span class="small muted">' + members.length + '</span></div><ul class="list">' + members.map(({ m, p }) => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.display_name || 'Sem nome') + '</span>' + (m.role === 'admin' ? '<span class="badge">admin</span>' : '') + '</div><div class="ps">' + esc(p.topshot_username || 'sem utilizador Top Shot') + '</div></div>' + (m.user_id !== S.session.user.id ? '<button class="btn small quiet" type="button" data-action="kick" data-id="' + esc(m.user_id) + '">Remover</button>' : '<span></span>') + '</li>').join('') + '</ul></div>');
  return out.join('');
}
function dataHtml() {
  const lines = [];
  const playersUpd = [...S.players.values()].reduce((m, p) => p.updated_at > m ? p.updated_at : m, '');
  lines.push(['Jogadores NBA', S.players.size ? S.players.size + ' · ' + ago(playersUpd) : 'ainda nenhum']);
  const oddsDates = Object.keys(S.odds).sort();
  lines.push(['Odds', oddsDates.length ? oddsDates.map(dShort).join(', ') + ' · ' + ago(S.odds[oddsDates[oddsDates.length - 1]].updated_at) : 'ainda nenhumas para esta run']);
  const withGames = S.days.filter(d => (d.games || []).length).length;
  lines.push(['Calendário', S.days.length ? withGames + ' de ' + S.days.length + ' dias com jogos' : '—']);
  lines.push(['Lesões', S.injOk ? Object.keys(S.injuries).length + ' no relatório · ' + ago(S.injAt) : 'falta correr o supabase/schema.sql novo']);
  lines.push(['Blockchain', S.chainRuns.length ? S.chainRuns.length + ' runs lidas' : 'à espera da primeira leitura']);
  return '<div class="card panel"><h2>Dados ' + helpBtn('dados') + '</h2>' + lines.map(([a, b]) => '<div class="status-line"><span>' + esc(a) + '</span><span class="muted">' + esc(b) + '</span></div>').join('') + '</div>';
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
  p.innerHTML = '<div class="sheet-bar">' + (back ? '<button class="sheet-ic" type="button" data-action="sheet-back" aria-label="Voltar">' + icoBack + '</button>' : '<span></span>') +
    '<div class="grab" aria-hidden="true"></div><button class="sheet-ic" type="button" data-action="close-sheet" aria-label="Fechar">' + icoX + '</button></div>' + html;
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
    ['proj', 'Proj.', x => x.info.mu, x => '<b>' + f1(x.info.mu) + '</b>' + (x.info.src === 'odds' ? '<small>linha ' + f1(x.info.line) + '</small>' : x.info.src === 'proxy' ? '<small>linha ' + esc((STATS[x.info.via] || {}).short || '') + '</small>' : '<small>' + esc(srcShort(x.info)) + '</small>'), 'O que o plano espera hoje (odds se houver; senão médias com forma e adversário)'],
    ['l5', 'Últ. 5', x => x.fi.l5, x => one(x.fi.l5, f1), 'Média nos últimos 5 jogos'],
    ['l10', 'Últ. 10', x => x.fi.l10, x => one(x.fi.l10, f1), 'Média nos últimos 10 jogos'],
    ['season', 'Época', x => x.fi.season, x => one(x.fi.season, f1), 'Média da época'],
    ['min', 'MIN', x => nn(x.l5.min) != null ? x.l5.min : nn(x.a.min), x => two(nn(x.l5.min), nn(x.a.min), f0), 'Minutos: últimos 5 jogos (em baixo, época)'],
  ];
  if (has(['pts', 'fgm', 'fga', 'fg3', 'fg3a', 'pip', 'ftm', 'fta'])) cols.push(
    ['fga', 'FGA', x => nn(x.l5.fga) != null ? x.l5.fga : nn(x.a.fga), x => two(nn(x.l5.fga), nn(x.a.fga), f1), 'Lançamentos tentados'],
    ['fgp', 'FG%', x => ratio(x.l5.fgm, x.l5.fga) != null ? ratio(x.l5.fgm, x.l5.fga) : ratio(x.a.fgm, x.a.fga), x => two(ratio(x.l5.fgm, x.l5.fga), ratio(x.a.fgm, x.a.fga), pf), 'Percentagem de lançamentos'],
    ['fg3a', '3PA', x => nn(x.l5.fg3a) != null ? x.l5.fg3a : nn(x.a.fg3a), x => two(nn(x.l5.fg3a), nn(x.a.fg3a), f1), 'Triplos tentados'],
    ['fg3p', '3P%', x => ratio(x.l5.fg3, x.l5.fg3a) != null ? ratio(x.l5.fg3, x.l5.fg3a) : ratio(x.a.fg3, x.a.fg3a), x => two(ratio(x.l5.fg3, x.l5.fg3a), ratio(x.a.fg3, x.a.fg3a), pf), 'Percentagem de triplos'],
    ['fta', 'FTA', x => nn(x.l5.fta) != null ? x.l5.fta : nn(x.a.fta), x => two(nn(x.l5.fta), nn(x.a.fta), f1), 'Lances livres tentados']);
  if (has(['reb', 'oreb', 'dreb'])) cols.push(
    ['oreb', 'OREB', x => nn(x.l5.oreb) != null ? x.l5.oreb : nn(x.a.oreb), x => two(nn(x.l5.oreb), nn(x.a.oreb), f1), 'Ressaltos ofensivos'],
    ['dreb', 'DREB', x => nn(x.l5.dreb) != null ? x.l5.dreb : nn(x.a.dreb), x => two(nn(x.l5.dreb), nn(x.a.dreb), f1), 'Ressaltos defensivos']);
  if (has(['ast', 'tov'])) cols.push(
    ['ast', 'AST', x => nn(x.l5.ast) != null ? x.l5.ast : nn(x.a.ast), x => two(nn(x.l5.ast), nn(x.a.ast), f1), 'Assistências'],
    ['tov', 'TOV', x => nn(x.l5.tov) != null ? x.l5.tov : nn(x.a.tov), x => two(nn(x.l5.tov), nn(x.a.tov), f1), 'Perdas de bola']);
  if (has(['stl', 'blk'])) cols.push(
    ['stl', 'STL', x => nn(x.l5.stl) != null ? x.l5.stl : nn(x.a.stl), x => two(nn(x.l5.stl), nn(x.a.stl), f1), 'Roubos de bola'],
    ['blk', 'BLK', x => nn(x.l5.blk) != null ? x.l5.blk : nn(x.a.blk), x => two(nn(x.l5.blk), nn(x.a.blk), f1), 'Desarmes de lançamento']);
  cols.push(
    ['opp', 'Adv.', x => (x.m ? x.m.f : 1), x => (x.m ? '<b class="' + (x.m.f >= 1.03 ? 'up' : x.m.f <= 0.97 ? 'down' : '') + '">' + (x.m.f >= 1 ? '+' : '−') + Math.round(Math.abs(x.m.f - 1) * 100) + '%</b><small>' + esc(x.opp) + '</small>' : '<span class="muted">–</span><small>' + (x.g && x.g[2] ? hm(x.g[2]) : '') + '</small>'), 'Quanto o adversário concede desta estatística face à média da liga (últimos 10 jogos)'],
    ['uses', 'Usos', x => x.p.uses || 0, x => '<b>' + (x.p.uses || 0) + '</b><small>plano ' + x.planned + '</small>', 'Usos restantes e quantos o plano usa até ao fim']);
  const sort = S.cmpSort || { col: 'proj', dir: -1 }, col = cols.find(c => c[0] === sort.col) || cols[0];
  rows.sort((x, y) => { const a = col[2](x), b = col[2](y); if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1; return (a - b) * sort.dir; });
  const head = '<tr><th class="sticky">Jogador</th>' + cols.map(c => '<th><button type="button" data-action="cmp-sort" data-col="' + c[0] + '" data-date="' + date + '"' + (inTab ? ' data-in="tab"' : '') + ' title="' + esc(c[4]) + '" aria-sort="' + (sort.col === c[0] ? (sort.dir < 0 ? 'descending' : 'ascending') : 'none') + '">' + c[1] + (sort.col === c[0] ? (sort.dir < 0 ? ' ↓' : ' ↑') : '') + '</button></th>').join('') + '</tr>';
  const body = rows.map(x => '<tr class="' + (x.inL ? 'inl' : '') + '" data-action="player" data-id="' + esc(x.p.id) + '" data-date="' + date + '" tabindex="0"><th class="sticky"><span class="cn" title="' + esc(x.p.name) + '">' + (x.locked ? icoLock : x.inL ? '<i class="dot on" title="no lineup do plano"></i>' : '') + esc(shortName(x.p.name)) + '</span><small>' + esc(x.p.team) + (x.opp ? (x.home ? ' vs ' : ' @ ') + esc(x.opp) : '') + (x.info.status !== 'ok' ? ' · ' + esc(STATUS[x.info.status].label) : '') + (x.info.b2b ? ' · 2.º seguido' : '') + '</small></th>' + cols.map(c => '<td>' + c[3](x) + '</td>').join('') + '</tr>').join('');
  const objChips = objs.length > 1 ? '<div class="chips" role="group" aria-label="Estatística do dia" style="padding:0 14px 8px">' + objs.map((x, k) => '<button type="button" data-action="cmp-obj" data-k="' + k + '" data-date="' + date + '"' + (inTab ? ' data-in="tab"' : '') + ' aria-pressed="' + (k === kq) + '">' + esc(statShort(x.stat)) + ' · alvo ' + x.target + '</button>').join('') + '</div>' : '';
  return '<div class="card"><div class="list-head"><h2>Comparar ' + helpBtn('comparar') + '</h2><span class="small muted">' + rows.length + ' jogam</span></div>' + objChips +
    '<div class="cmp-wrap" id="cmpWrap"><table class="cmp"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></div>';
}
// últimos jogos de um jogador (guardados pela tarefa diária)
function gamesTable(a) {
  const games = (((a || {}).form) || {}).games;
  if (!games || !games.length) return '';
  const ix = k => 2 + GK.indexOf(k), val = (g, k) => g[ix(k)];
  const pair = (g, m, t) => (val(g, m) != null ? val(g, m) + '-' + val(g, t) : '–');
  return '<div class="card"><div class="list-head"><h2>Últimos jogos</h2></div><div class="cmp-wrap"><table class="cmp games"><thead><tr><th class="sticky">Data</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th><th>FG</th><th>3PT</th><th>FT</th><th>TO</th><th>STL</th><th>BLK</th></tr></thead><tbody>' +
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
    liveHtml = '<div class="card panel" style="gap:10px"><div class="label">Ao vivo</div><div class="chips" role="group" aria-label="Estado do jogo">' + [['por', 'Por jogar'], ['jogo', 'Em jogo'], ['fim', 'Terminado']].map(([k, l]) => '<button type="button" data-action="live-state" data-id="' + esc(id) + '" data-state="' + k + '" aria-pressed="' + (state === k) + '">' + l + '</button>').join('') + '</div>' +
      (state !== 'por' ? objs.map((ob, k) => { const val = Math.round(FB.statValue(e.vals || {}, ob.stat, p.avg) * 10) / 10;
        return '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div class="stepper"><button type="button" data-action="live-val" data-id="' + esc(id) + '" data-k="' + k + '" data-d="-1" aria-label="Menos um">−</button><input class="num" id="liveVal-' + k + '" type="number" inputmode="decimal"' + (/-/.test(ob.stat) ? '' : ' min="0"') + ' value="' + val + '" data-action="live-input" data-id="' + esc(id) + '" data-k="' + k + '" aria-label="' + esc(statShort(ob.stat)) + ' até agora"><button type="button" data-action="live-val" data-id="' + esc(id) + '" data-k="' + k + '" data-d="1" aria-label="Mais um">+</button></div><span class="small muted">' + esc(statShort(ob.stat)) + (state === 'fim' ? ' no final' : ' até agora') + '</span></div>'; }).join('') : '') +
      (state === 'jogo' ? '<div class="chips" role="group" aria-label="Período">' + [1, 2, 3, 4].map(qn => '<button type="button" data-action="live-q" data-id="' + esc(id) + '" data-q="' + qn + '" aria-pressed="' + (+e.q === qn) + '">' + qn + '.º</button>').join('') + '</div>' : '') + '</div>';
  } else if (live) liveHtml = '<div class="note info">Não está no lineup submetido.</div>';
  // por partes: Resumo (esperado, usos, fixar/tirar, ao vivo, lesão), Porquê (em que se baseia) e Últimos jogos
  const games = gamesTable(p.avg), PT = [['res', 'Resumo'], ['porque', 'Porquê']].concat(games ? [['jogos', 'Últimos jogos']] : []);
  if (S.pTabId !== id) { S.pTab = 'res'; S.pTabId = id; } // outro jogador abre no Resumo
  const cur = PT.some(x => x[0] === S.pTab) ? S.pTab : 'res', part = (k, h) => '<div class="ptab stack" data-ptab="' + k + '"' + (k === cur ? '' : ' hidden') + '>' + h + '</div>';
  openSheet('<div class="who ph">' + face(id, 'lg') + '<div style="min-width:0"><h3>' + esc(p.name) + '</h3><div class="small muted">' + esc(p.team) + ' ' + esc(opp(p.team, day)) + ' · Dia ' + (day.idx + 1) + ', ' + dShort(date) + '</div></div></div>' +
    '<div class="seg ptabs" role="tablist" aria-label="Partes da ficha">' + PT.map(([k, l]) => '<button type="button" role="tab" data-action="ptab" data-v="' + k + '" aria-selected="' + (k === cur) + '" aria-pressed="' + (k === cur) + '">' + l + '</button>').join('') + '</div>' +
    part('res', '<div class="kv"><div><div class="label">Esperado</div><div class="v num">' + (md.objs.length > 1 ? md.objs.map((x, k) => f1((md.info[pi][k] || {}).mu || 0)).join('<small> / </small>') : f1(info.mu)) + '</div><div class="small muted">' + (md.objs.length > 1 ? md.objs.map(x => esc(statShort(x.stat))).join(' / ') : esc(statShort(o.stat))) + '</div></div><div><div class="label">Usos</div><div class="v num">' + (p.uses || 0) + '</div><div class="small muted">restantes</div></div><div><div class="label">No plano</div><div class="v num">' + inPlan.length + '</div><div class="small muted">' + (inPlan.length ? 'dias ' + inPlan.join(', ') : '—') + '</div></div></div>' +
    '<div class="btns">' + (locked ? '<button class="btn" type="button" data-action="unlock" data-id="' + esc(id) + '" data-date="' + date + '">Deixar de fixar</button>' : '<button class="btn primary" type="button" data-action="lock" data-id="' + esc(id) + '" data-date="' + date + '">Fixar neste dia</button>') +
    '<button class="btn" type="button" data-action="ban" data-id="' + esc(id) + '" data-date="' + date + '">Tirar deste dia</button></div>' +
    liveHtml + injuryBlock(id, info.injury, date)) +
    part('porque', md.objs.length > 1 ? md.objs.map((x, k) => basisHtml(p, md.info[pi][k], x, md, id, true)).join('') : basisHtml(p, info, o, md, id)) + (games ? part('jogos', games) : ''), back);
}
function rosterSheet(id) {
  const e = S.mine.roster[id]; if (!e) return;
  S.sheetPl = id;
  const c = S.players.get(String(id)) || {}, v = view();
  const inPlan = v ? v.days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1) : [];
  const team = e.team || c.team || '', goneNote = gone(id) ? '<div class="note">Já não está em nenhuma equipa da NBA (retirado ou sem contrato): o plano não o usa.</div>' : '';
  // usos de cada conta: usados nesta run, restantes (editáveis) e quantos o plano usa
  const planOfAcc = k => { const r = S.multi ? S.multi.byKey[k] : S.result; return r ? r.normal.days.filter(x => x.lineup.includes(id)).length : 0; };
  const usesRows = accounts().map(a => {
    const pk = a.id + '|' + id, left = S.pendingUses[pk] != null ? S.pendingUses[pk] : usesEff(e, id, a.id), usedN = usedCount(a.id, id);
    const top = colTopUses(id); // com Moments na coleção os usos vêm da melhor carta e não se mexem
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><div class="label">' + (groupMode() ? esc(a.label) : 'Usos restantes') + '</div><div class="small muted">' + (usedN ? 'usado ' + usedN + '× · ' : '') + 'o plano usa ' + planOfAcc(a.id) + '</div>' +
      (top ? '<div class="small muted">pela melhor carta: ' + esc(bestTierName(id)) + ' · ' + usesTxt(top) + '</div>' : '') + '</div>' +
      (top ? '<output class="num uses-fixed" id="usesOut-' + esc(a.id) + '">' + (top >= UNL ? '∞' : left) + '</output></div>' : '<div class="stepper"><button type="button" data-action="uses" data-acc="' + esc(a.id) + '" data-id="' + esc(id) + '" data-d="-1" aria-label="Menos um uso">−</button><output class="num" id="usesOut-' + esc(a.id) + '" data-uses-out="' + esc(pk) + '">' + left + '</output><button type="button" data-action="uses" data-acc="' + esc(a.id) + '" data-id="' + esc(id) + '" data-d="1" aria-label="Mais um uso">+</button></div></div>');
  }).join('');
  const games = S.days.filter(d => FB.teamsOn(d).has(team)).length;
  const avg = e.avg || c.avg;
  openSheet('<div class="who ph">' + face(id, 'lg') + '<div style="min-width:0"><h3>' + esc(nameOf(id)) + '</h3><div class="small muted">' + esc(team || 'sem equipa') + ' · ' + games + ' jogos na run · no plano: ' + (inPlan.length ? 'dias ' + inPlan.join(', ') : 'nenhum dia') + '</div></div></div>' + goneNote +
    (() => { const ci = ((((S.profile || {}).collection) || {}).players || {})[id] || (e.moments ? { moments: e.moments, sets: e.sets } : null); if (!ci) return '';
      const col = (S.profile || {}).collection;
      return ci.ids && col && col.items ? '' : '<div class="small muted">Na carteira: ' + (groupMode() && ci.owners ? Object.entries(ci.owners).map(([k, n]) => esc(accLabel(k)) + ' ' + n).join(' · ') : plural(ci.moments || 1, 'Moment', 'Moments')) + (ci.bySet ? ' · ' + esc(usesWhy(col, ci)) : '') + '</div>'; })() +
    injuryBlock(id, null, null) + cardsBlock(id) +
    (groupMode() ? '<div class="small muted">Usos restantes em cada conta</div>' : '') + usesRows + momentsBlock(id) + mktBlock(id) +
    (avg ? '<div><div class="label" style="margin-bottom:6px">Médias por jogo' + (c.gp ? ' (' + c.gp + ' jogos)' : '') + '</div><div class="kv sm">' + AVG_SHOW.map(k => { const a = FB.avgOf({ avg }, k); return a ? '<div><div class="label">' + STATS[k].short + (a.est ? '*' : '') + '</div><div class="v num">' + f1(a.v) + '</div></div>' : ''; }).join('') + '</div>' + (AVG_SHOW.some(k => (FB.avgOf({ avg }, k) || {}).est) ? '<div class="small muted" style="margin-top:6px">* estimativa a partir das outras médias</div>' : '') + '</div>' : '<div class="note info">Ainda sem médias.</div>') +
    gamesTable(avg) +
    '<button class="btn" type="button" data-action="remove-player" data-id="' + esc(id) + '">Tirar do plantel</button>');
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
  if (p && p.ask != null) return 'à venda desde <b class="num">' + usd(p.ask) + '</b>';
  if (p && p.ts) return '<span class="muted">nenhum ' + tierName(uses) + ' à venda</span>';
  if (pxMiss(id)) return '<span class="muted">não encontrado no Top Shot</span>';
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
    const rows = [1, 2, 4].map((u, i) => '<div class="row" style="padding:8px 0;display:flex;justify-content:space-between;gap:10px"><span><b>' + tierName(u) + '</b></span><span class="small" style="text-align:right">' + (x.c[i] != null ? 'à venda desde <b class="num">' + usd(x.c[i] / 100) + '</b>' : '<span class="muted">nenhum à venda</span>') + '</span></div>').join('');
    return '<div class="mkt-box"><div class="list-head" style="margin-bottom:4px"><span class="label">Mercado do Top Shot</span><span class="small muted">' + esc(ago(x.at)) + '</span></div>' + rows + (Date.now() - Date.parse(x.at) > 6 * 3600e3 ? upd : '') + '</div>';
  }
  if (S.mktOff) return '<div class="mkt-box"><div class="label" style="margin-bottom:4px">Mercado do Top Shot</div><div class="small muted">Sem preços lidos deste jogador.</div>' + upd + '</div>';
  const m = S.mkt.get(mktKey(id)); mktNeed([id]);
  const rows = m ? [1, 2, 4].map(u => { const p = mktOf(id, u); return p && p.ask != null ? '<div class="row" style="padding:8px 0;display:flex;justify-content:space-between;gap:10px"><span><b>' + tierName(u) + '</b></span><span class="small" style="text-align:right">à venda desde <b class="num">' + usd(p.ask) + '</b>' + (p.serial ? ' (#' + p.serial + ')' : '') + '</span></div>' : ''; }).join('') : '';
  return '<div class="mkt-box"' + (m ? '' : ' data-mk="' + esc(id) + '"') + '><div class="label" style="margin-bottom:4px">Mercado do Top Shot</div>' + (m ? (rows ? rows + '<div class="small muted">Aproximado (lido da blockchain). Para o preço certo, atualiza no Top Shot.</div>' : '<div class="small muted">Nenhum Moment dele à venda visto.</div>') + upd : '<div class="small muted">A ler os preços…</div>') + '</div>';
}
// ---------- Vender ----------
// Três listas, das cartas de todas as tuas contas (procura por jogador, equipa ou raridade):
// · Não usadas: jogadores que nenhuma conta usa no resto da run (todas as cartas deles)
// · Repetidas: jogadores com mais de uma carta, com quantas de cada raridade; ao tocar, cada carta com o preço
// · Poupar: trocar a tua por uma igual (os mesmos usos ou mais) à venda mais barata; poupas a diferença (−5% na venda)
// O preço de cada carta é a mais barata à venda da mesma edição (low ask), lida com as Cartas (ASP) no Admin.
const SELL_FEE = 0.05;
const nContas = n => n + (n === 1 ? ' conta' : ' contas');
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
const useTxt = u => !u || !u.total ? 'não usado nesta run' : 'usado ' + plural(u.total, 'vez', 'vezes') + ' nesta run' + (u.accs > 1 ? ' (até ' + u.max + ' por conta)' : '');
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
  if (!col || !col.items) return '<div class="note info">Lê a tua carteira primeiro (Jogadores → Coleção).</div>';
  loadPastUse();
  const ps = sellPlayers() || [], hasPx = ps.some(P => P.cards.some(c => c.ask));
  const past = S.pastUse || {}, pastIds = Object.keys(past);
  ps.forEach(P => { P.idle = 1 + pastIds.filter(r => !past[r].has(String(canon(P.id)))).length; }); // runs seguidas... e as outras em que não o usaste
  const unused = S.result ? ps.filter(P => P.use && !P.use.total).sort((a, b) => (b.idle - a.idle) || (b.value - a.value)) : [];
  const reps = ps.filter(P => P.cards.length > 1 && P.use && P.use.total && P.nExtra).sort((a, b) => (b.extra - a.extra) || (b.nExtra - a.nExtra));
  const swaps = sellSwaps(ps), downs = sellDowngrades(ps);
  S.sellData = { ps, swaps, downs };
  const tabs = [['naousadas', 'Não usadas', unused.length], ['repetidas', 'Repetidas', reps.length], ['raras', 'Rara a mais', downs.length], ['poupar', 'Poupar', swaps.length]];
  const tab = tabs.some(x => x[0] === S.sellTab) ? S.sellTab : 'naousadas';
  const keyOf = P => esc(norm(nameOf(P.id)) + ' ' + String(P.team).toLowerCase() + ' ' + Object.keys(P.tc).join(' ').toLowerCase());
  const prow = (P, sub, rep) => { const v = rep ? P.extra : P.value, lbl = rep ? (P.nExtra > 1 ? 'low ask, a mais' : 'low ask') : P.cards.length > 1 ? 'low ask, todas' : 'low ask';
    return '<li data-n="' + keyOf(P) + '"><button class="row sell-row" type="button" data-action="sell-player" data-id="' + esc(P.id) + '"><span class="who">' + face(P.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(P.id)) + '</span></div>' +
    '<div class="ps">' + esc(P.team) + ' · ' + esc(tcTxt(P.tc)) + '</div>' + (sub ? '<div class="ps sell-why">' + sub + '</div>' : '') + '</div></span>' +
    '<span class="sell-g' + (v ? '' : ' none') + '"><b class="num">' + (v ? usd(v / 100) : '—') + '</b><small>' + (v ? lbl : 'sem preço') + '</small></span></button></li>'; };
  const srow = (x, i, act, line) => { const it = x.c.it, [base] = String(it.s || '').split(' · ');
    return '<li data-n="' + keyOf(x.P) + '"><button class="row sell-row" type="button" data-action="' + act + '" data-i="' + i + '"><span class="who">' + face(x.P.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(x.P.id)) + '</span></div>' +
      '<div class="ps"><span class="tpill t-' + (TIER_CLS[x.c.t] || 'c') + '">' + esc(x.c.t) + '</span> ' + esc(base) + (it.n ? ' #' + f0(it.n) : '') + (groupMode() ? ' · ' + esc(accLabel(it.a)) : '') + '</div>' +
      '<div class="ps sell-why">' + line + '</div></div></span>' +
      '<span class="sell-g"><b class="num">+' + usd(x.save / 100) + '</b><small>poupas</small></span></button></li>'; };
  const idleTxt = P => P.idle > 1 ? '<b class="c-warn">Sem uso em ' + P.idle + ' runs</b> (esta e ' + plural(P.idle - 1, 'outra', 'outras') + ')' : 'Não usado em toda a run (dias jogados e plano)';
  let list = '', empty = '';
  if (tab === 'naousadas') { list = unused.map(P => prow(P, idleTxt(P))).join(''); empty = S.result ? 'Todos os teus jogadores são usados nesta run.' : 'Sem plano calculado.'; }
  if (tab === 'repetidas') { list = reps.map(P => prow(P, esc(useTxt(P.use)) + ' · ' + plural(P.nExtra, 'carta a mais', 'cartas a mais'), true)).join(''); empty = 'Nenhum jogador com cartas a mais para o que o plano usa.'; }
  if (tab === 'raras') { list = downs.map((x, i) => srow(x, i, 'sell-down', esc(useTxt(x.P.use)) + ' · chega ' + (x.need === 1 ? 'uma Common' : 'uma de ' + usesTxt(x.need)) + ' por <b class="num">' + usd(x.alt[1] / 100) + '</b>')).join(''); empty = hasPx ? 'Nenhuma carta com mais usos do que o plano precisa que compense trocar.' : 'Faltam os preços do mercado.'; }
  if (tab === 'poupar') { list = swaps.map((x, i) => srow(x, i, 'sell-swap', 'Vendes por <b class="num">' + usd(x.c.ask / 100) + '</b> · compras por <b class="num">' + usd(x.alt[1] / 100) + '</b>' + (x.less ? ' · <span class="c-warn">dá ' + usesTxt(x.alt[0]) + '</span>' : ''))).join(''); empty = hasPx ? 'Nenhuma troca que poupe pelo menos $1.' : 'Faltam os preços do mercado.'; }
  const ed = S.edMine && S.edMine.at ? S.edMine.at : null;
  return '<div class="card"><div class="list-head"><h2>Vender ' + helpBtn('vender') + '</h2><span class="small muted">preços ' + (ed ? ago(ed) : 'por ler') + '</span></div>' +
    '<div class="lu-search"><input class="field" id="sellSearch" type="search" placeholder="Jogador, equipa ou raridade…" autocomplete="off" aria-label="Procurar jogador, equipa ou raridade" value="' + esc(S.sellQ || '') + '"></div>' +
    '<div class="chips scroll" role="group" aria-label="Lista" style="padding:0 16px 8px">' + tabs.map(([v, l, n]) => '<button type="button" data-action="sell-tab" data-v="' + v + '" aria-pressed="' + (tab === v) + '">' + l + ' <span class="muted">' + n + '</span></button>').join('') + '</div>' +
    (!hasPx ? '<div class="note info" style="margin:0 16px 10px">' + (S.edPending ? 'Há uma leitura das cartas por aplicar: Ajustes → Admin → <b>Ver o que muda</b> → <b>Aplicar</b>.' : 'Faltam os preços das cartas: ' + (S.role === 'admin' ? 'lê-os em Ajustes → Admin → <b>Cartas (ASP)</b>.' : 'pede a quem gere o grupo para ler as <b>Cartas (ASP)</b>.')) +
      (S.edMine && S.edMine.at ? '<div class="small" style="margin-top:6px">Última leitura ' + ago(S.edMine.at) + ': ' + (S.edMine.nAsk != null ? S.edMine.nAsk + ' edições com preço' : 'sem preços (script antigo: reinstala-o ou usa o favorito)') + (S.edMine.askKeys ? ' · campos: ' + esc(S.edMine.askKeys.join(', ')) : '') + '</div>' : '') + '</div>' : '') +
    (list ? '<ul class="list" id="sellList">' + list + '<li class="row small muted sell-none" hidden>Ninguém com esse nome, equipa ou raridade.</li></ul>' : '<div class="row small muted">' + empty + '</div>') + '</div>';
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
    [[it.n ? '#' + f0(it.n) + (it.m ? ' de ' + f0(it.m) : '') : '', groupMode() ? accLabel(it.a) : ''].filter(Boolean).join(' · '), usesTxt(c.u) + ' · ' + (c.asp ? 'ASP ' + usd(c.asp / 100) : 'ASP —')].filter(Boolean).map(x => '<div class="ps sell-d">' + esc(x) + '</div>').join('') + '</div>' +
    '<div class="sell-g' + (c.ask ? '' : ' none') + '"><b class="num">' + (c.ask ? usd(c.ask / 100) : '—') + '</b><small>' + (c.ask ? 'low ask' : 'sem preço') + '</small>' + (c.ask ? '<small>recebes ' + usd(c.ask * (1 - SELL_FEE) / 100) + '</small>' : '') + '</div></li>';
}
function sellPlayerSheet(id) {
  const P = ((S.sellData || {}).ps || []).find(x => String(x.id) === String(id)); if (!P) return;
  const rep = P.cards.length > 1;
  openSheet('<h3>' + esc(nameOf(P.id)) + '</h3><div class="small muted">' + esc(P.team) + ' · ' + esc(tcTxt(P.tc)) + ' · ' + esc(useTxt(P.use)) + '</div>' +
    (P.use && !P.use.total ? '<div class="note info">Nenhuma das tuas contas o usou nem o usa no resto da run' + (P.idle > 1 ? ', e também não o usaste em ' + plural(P.idle - 1, 'outra run', 'outras runs') : '') + '.</div>' : '') +
    (rep && P.use && P.use.total ? '<div class="small muted">Cada conta que o usa n vezes precisa de uma carta com pelo menos n usos, e cada carta só joga numa conta por noite. Para o que o plano usa chegam as marcadas "fica" (as mais baratas que chegam); as outras podes vender.</div>' : '') +
    '<div class="card"><ul class="list">' + P.cards.map(c => sellCardLi(c, rep ? (c.keep ? 'fica' : 'a mais') : '')).join('') + '</ul></div>' +
    '<div class="small muted">Low ask = a mais barata à venda dessa edição agora. Recebes = low ask − 5% do Top Shot; para vender mais depressa, põe um pouco abaixo.</div>');
}
function sellSwapSheet(i, down) {
  const x = ((S.sellData || {})[down ? 'downs' : 'swaps'] || [])[i]; if (!x) return;
  const a = x.alt;
  openSheet('<h3>' + esc(nameOf(x.P.id)) + '</h3><div class="small muted">' + (down ? 'Rara a mais: ' + esc(useTxt(x.P.use)) : 'Trocar por uma igual mais barata') + '</div>' +
    (down ? '<div class="note info">O plano usa-o no máximo ' + plural(x.need, 'vez', 'vezes') + ' por conta nesta run: uma carta de ' + esc(usesTxt(x.need)) + ' chega. Se o quiseres usar mais vezes nas próximas runs, a tua dá ' + esc(usesTxt(x.c.u)) + '.</div>' : '') +
    '<div class="card"><div class="list-head"><h2>A tua</h2></div><ul class="list">' + sellCardLi(x.c, '') + '</ul></div>' +
    '<div class="card"><div class="list-head"><h2>A que compras</h2></div><ul class="list"><li class="row sell-card"><div style="min-width:0;flex:1"><div class="pn"><span class="tpill t-' + (TIER_CLS[TS_TIER(a[2])] || 'c') + '">' + esc(TS_TIER(a[2]) || a[2]) + '</span></div><div class="mo-set">' + esc(a[4]) + (a[5] && !isStd(a[5]) ? ' <span class="muted">· ' + esc(a[5]) + '</span>' : '') + '</div><div class="ps sell-d">' + esc(usesTxt(a[0])) + ' · ' + (a[3] > 0 ? 'ASP ' + usd(a[3] / 100) : 'ASP —') + '</div></div><div class="sell-g"><b class="num">' + usd(a[1] / 100) + '</b><small>low ask</small></div></li></ul></div>' +
    '<div class="card panel">' + [['Vendes a tua (low ask)', usd(x.c.ask / 100)], ['Comissão (5%)', '−' + usd(x.c.ask * SELL_FEE / 100)], ['Compras a outra (low ask)', '−' + usd(a[1] / 100)], ['Poupas', '<b class="c-good">+' + usd(x.save / 100) + '</b>']].map(([k, v]) => '<div class="status-line"><span>' + k + '</span><span>' + v + '</span></div>').join('') + '</div>' +
    (down ? '' : x.less ? '<div class="note">A outra dá ' + esc(usesTxt(x.alt[0])) + ' por run e a tua dá ' + esc(usesTxt(x.c.u)) + ' (o ASP dela é mais baixo).</div>' : '<div class="small muted">Mesma raridade, com os mesmos usos (' + esc(usesTxt(x.c.u)) + ') ou mais.</div>') +
    '<div class="small muted">Preços do mercado ' + ago(mkOf(x.P.id).at) + ': confirma no Top Shot antes de vender.</div>');
}
// as cartas (Moments) de um jogador, cada uma com o escalão que tem: muda-se carta a carta
// (p. ex. dos dois Luka, só um é Rare); os usos por run do jogador são os da melhor carta
function cardsBlock(id) {
  const col = (S.profile || {}).collection, c = col && (col.players || {})[id];
  if (!c) return '';
  if (!c.ids || !col.items) return '<div class="note info">Para escolheres o escalão de cada carta, lê a carteira outra vez (Jogadores → Coleção).</div>';
  const its = c.ids.map(f => ({ f, it: col.items[f], t: momentTier(col, f), u: cardUses(col, f), e: cardEd(col, f) })).filter(x => x.it).sort((a, b) => (b.u - a.u) || tierRank(a.t, b.t) || String(a.it.s).localeCompare(String(b.it.s)) || (a.it.n || 0) - (b.it.n || 0));
  if (!its.length) return '';
  const u = tierUsesOf(col, c), lab = tierLabels(col);
  const WHY = { 1: 'marcada', 2: 'aprendido', 3: 'set mudado', 4: 'do grupo' };
  // cada carta: raridade (e a faixa do ASP quando dá mais usos), set, série/número, conta, ASP e os usos dela
  const rows = its.map(({ f, it, t, u: cu, e }) => {
    const w = momentTierWhy(col, f, lab).why, b = e && aspBand(e.asp), up = b && b[1] > (TIER_USES[t] || 1);
    const [base, ...sub] = String(it.s || '').split(' · ');
    return '<li class="row mo-row"><div style="min-width:0;flex:1"><div class="pn"><span class="tpill t-' + TIER_CLS[t] + '">' + esc(t) + '</span>' + (up ? '<span class="tpill t-asp">' + esc(b[2]) + '</span>' : '') + (w !== 5 && WHY[w] ? '<span class="badge">' + WHY[w] + '</span>' : '') + (it.v ? '<span class="pill prov">à venda</span>' : '') + '</div>' +
      '<div class="mo-set">' + esc(base) + (sub.length ? ' <span class="muted">· ' + esc(sub.join(' · ')) + '</span>' : '') + '</div>' +
      '<div class="ps">' + [it.n ? '#' + f0(it.n) + (it.m ? ' de ' + f0(it.m) : '') : it.m ? 'tiragem ' + f0(it.m) : '', groupMode() ? accLabel(it.a) : '', e && e.ask ? 'à venda desde ' + usd(e.ask / 100) : '', e && e.asp > 0 ? 'ASP ' + usd(e.asp / 100) : e ? 'sem vendas' : 'sem dados do Top Shot'].filter(Boolean).map(esc).join(' · ') + '</div>' +
      (e && e.tier ? '' : '<select class="field tier-sel" data-mo-tier="' + esc(f) + '" aria-label="Escalão desta carta">' + TIERS.map(z => '<option value="' + z + '"' + (z === t ? ' selected' : '') + '>' + z + ' · ' + usesTxt(TIER_USES[z]) + '</option>').join('') + '</select>') + '</div>' +
      '<div class="pv mo-u' + (cu === u ? ' top' : '') + '"><div class="v num">' + usesN(cu) + '</div><div class="u">' + (cu === 1 ? 'uso' : 'usos') + '</div></div></li>'; }).join('');
  const tc = {}; its.forEach(x => { tc[x.t] = (tc[x.t] || 0) + 1; });
  return '<div class="card"><div class="list-head"><h2>As tuas cartas ' + helpBtn('cartas') + '</h2><span class="small muted">' + TIERS.slice().reverse().filter(z => tc[z]).map(z => tc[z] + ' ' + z).join(' · ') + '</span></div>' +
    '<div class="small muted" style="padding:0 16px 6px">' + usesTxt(u || 1) + ' por run: conta a carta com mais usos.</div><ul class="list">' + rows + '</ul></div>';
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
  toast(nameOf(id) + ': ' + plural(c ? c.uses : 1, 'uso', 'usos') + ' por run (melhor carta ' + (bestTier(col, c) || tier) + ')' + (learned.length ? ' · aprendido: ' + learned.slice(0, 3).map(lastName).join(', ') + (learned.length > 3 ? ' e mais ' + (learned.length - 3) : '') : ''));
  try { await q(sb.from('profiles').update({ collection: col }).eq('user_id', S.session.user.id)); } catch (err) { toast('Não guardou: ' + errText(err)); }
}
// com smurfs: em que noites cada conta o usa e, com um só Moment, se compensa um 2.º
function momentsBlock(id) {
  if (!S.multi) return '';
  const ci = collectionInfo(id), copies = ci.copies;
  const daysOf = k => { const r = S.multi.byKey[k]; const ds = new Set(r ? r.normal.days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1) : []);
    Object.entries(planOf(k).played || {}).forEach(([dt, pl]) => { if (pl && pl.done && (pl.lineup || []).includes(id)) { const i = S.days.findIndex(x => x.date === dt); if (i >= 0) ds.add(i + 1); } }); return [...ds]; };
  const per = accounts().map(a => ({ a, ds: daysOf(a.id) })).filter(x => x.ds.length);
  const nights = per.length ? per.map(x => esc(x.a.label) + ': ' + (x.ds.length === 1 ? 'dia ' : 'dias ') + spans(x.ds)).join(' · ') : 'nenhuma conta o usa no plano';
  const inWallet = !!((((S.profile || {}).collection) || {}).players || {})[id], nAcc = accounts().length;
  return '<div class="note' + (copies === 1 ? ' info' : '') + '" style="display:grid;gap:8px"><div>' + (copies === 1
    ? '<b>1 Moment' + (inWallet ? '' : ' (fora das carteiras lidas)') + ':</b> joga por uma conta de cada vez. ' + nights + '.'
    : ci.nTop && ci.nTop < copies && ci.topUses > 1
      ? '<b>' + copies + ' Moments, ' + ci.nTop + ' ' + esc(bestTierName(id)) + ':</b> cada conta tem ' + usesTxt(ci.topUses) + '. A 1.ª jogada de cada conta pode ser com qualquer carta' + (ci.topUses >= 4 ? ', a 2.ª precisa de um Rare ou melhor e a 3.ª e a 4.ª de um Legendary' : ci.topUses === 3 ? ', a 2.ª e a 3.ª precisam do ' + esc(bestTierName(id)) : ', a 2.ª precisa do ' + esc(bestTierName(id))) + '; cada carta só joga numa conta por noite (o plano diz quando a passar). ' + nights + '.'
      : '<b>' + copies + ' Moments:</b> ' + (copies >= nAcc ? 'todas as contas o podem usar na mesma noite' : 'até ' + copies + ' contas na mesma noite') + '. ' + nights + '.') + '</div>' +
    (copies === 1 && S.runId ? '<button class="btn small" type="button" data-action="buy-eval" data-id="' + esc(id) + '" style="justify-self:start">Ver se compensa um 2.º Moment</button>' : '') + '</div>';
}
function addPlayerSheet() {
  openSheet('<h3>Adicionar jogador</h3><input class="field" id="apSearch" type="search" placeholder="Nome do jogador…" autocomplete="off" aria-label="Procurar jogador"><div id="apResults" class="search-list"></div>' +
    '<div class="small muted"><button class="btn link small" type="button" data-action="paste-sheet">Colar uma lista</button> · <button class="btn link small" type="button" data-action="custom-player">Jogador que não aparece</button></div>');
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
  if (!S.players.size) { box.innerHTML = '<div class="row muted small">O catálogo de jogadores ainda está vazio.</div>'; return; }
  const res = searchPlayers(qs, 30);
  box.innerHTML = res.map(p => { const inR = !!S.mine.roster[p.id]; return '<div class="row"><span class="who">' + face(p.id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span></div><div class="ps">' + esc(p.team || '—') + (p.avg ? ' · ' + f1(+p.avg.pts || 0) + ' PTS · ' + f1(+p.avg.reb || 0) + ' REB · ' + f1(+p.avg.ast || 0) + ' AST' : '') + '</div></div></span>' + (inR ? '<span class="small muted">no plantel</span>' : '<button class="btn small" type="button" data-action="add-id" data-id="' + esc(p.id) + '">Adicionar</button>') + '</div>'; }).join('') || '<div class="row muted small">Nenhum jogador com esse nome.</div>';
}
function customPlayerSheet() {
  openSheet('<h3>Adicionar à mão</h3><input class="field" id="cpName" placeholder="Nome" aria-label="Nome do jogador"><div class="grid2"><select class="field" id="cpTeam" aria-label="Equipa">' + TEAMS.map(t => '<option>' + t + '</option>').join('') + '</select><input class="field num" id="cpUses" type="number" min="0" max="20" value="1" aria-label="Usos"></div>' +
    '<div class="small muted">Sem médias, só entra no plano nos dias com odds.</div><div class="btns"><button class="btn quiet" type="button" data-action="sheet-back">Cancelar</button><button class="btn primary" type="button" data-action="save-custom">Adicionar</button></div>', addPlayerSheet);
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
  openSheet('<h3>Colar lista</h3><div class="small muted">Um por linha, com os usos. Ex.: <span class="kbd">Jokic 2</span> <span class="kbd">Curry 1</span></div>' +
    '<textarea class="field" id="pasteText" rows="6" aria-label="Lista de jogadores"></textarea><button class="btn" type="button" data-action="paste-preview">Ver correspondências</button><div id="pasteOut"></div>', addPlayerSheet);
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
const usesTxt = u => u >= UNL ? 'usos ilimitados' : plural(u, 'uso', 'usos');
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
  openSheet('<h3>Raridade e ASP das cartas</h3><div id="edRv" class="small muted">A comparar com o que já temos…</div>');
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
  $('edRv').outerHTML = '<div class="small">Lidas no Top Shot ' + esc(ago(ed.at)) + ': <b>' + nOk + '</b> de ' + nCards + ' cartas ligadas a uma edição' + (nTier ? ' · ' + nTier + ' das tuas mudam de raridade' : '') + '.</div>' +
    (changed.length ? changed.map(g => '<div class="card"><div class="list-head"><h2>' + esc(g.uid === me ? 'Tu' : groupName(g.uid)) + '</h2><span class="small muted">' + plural(g.rows.length, 'jogador muda', 'jogadores mudam') + '</span></div><ul class="list">' + g.rows.map(row).join('') + '</ul></div>').join('')
      : '<div class="note info">Ninguém muda de usos com esta leitura.</div>') +
    (loose.size ? '<details class="ed-loose"><summary class="small muted">' + plural(nCards - nOk, 'carta sem edição', 'cartas sem edição') + ' (ficam como estão)</summary><div class="small muted">' + [...loose.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, n]) => esc(k) + (n > 1 ? ' ×' + n : '')).join(' · ') + '</div></details>' : '') +
    (ed.err ? '<div class="note">' + esc(ed.err) + '</div>' : '') +
    '<div class="btns"><button class="btn quiet" type="button" data-action="close-sheet">Agora não</button><button class="btn primary" type="button" data-action="ed-apply">Aplicar</button></div>';
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
  if (!xs.length) return { tier: 'Common', how: 'sem dados' };
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
const usesWhy = (col, c) => { const u = tierUsesOf(col, c), b = bestTier(col, c), n = momentTiers(col, c).length; return tierMix(col, c) + ' → ' + usesTxt(u) + ' por run' + (n > 1 ? ' (conta o melhor: ' + b + ')' : ''); };
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
    openSheet('<h3>Ler carteira</h3><div class="small muted">Falta o endereço Flow (carteira Dapper) no teu perfil.</div><div class="btns"><button class="btn quiet" type="button" data-action="close-sheet">Cancelar</button><button class="btn primary" type="button" data-action="goto" data-tab="ajustes" data-sub="perfil">Ir a Ajustes</button></div>');
    return;
  }
  openSheet('<h3>Ler carteira' + (accs.length > 1 ? 's' : '') + '</h3><div class="small muted" id="wProg">A ler os teus Moments na blockchain…</div>');
  const reads = [], failed = [];
  for (const a of accs) {
    try { reads.push({ a, w: await readWallet(a.flow.trim(), (d, t) => { const el = $('wProg'); if (el) el.textContent = 'A ler ' + a.label + '… ' + d + ' de ' + t + ' Moments'; }) }); }
    catch (e) { console.warn(e); failed.push(a.label + ': ' + String(e.message || e).slice(0, 120)); }
  }
  if (!$('wProg')) return; // fechou a folha entretanto
  if (!reads.length) { $('wProg').innerHTML = '<span class="down">Não consegui ler a carteira.</span> ' + esc(failed.join(' · ')) + '<br>Confirma o endereço Flow no perfil e tenta outra vez.'; return; }
  // tiragem das edições (para o escalão de cada set)
  if ($('wProg')) $('wProg').textContent = 'A ver o escalão de cada set…';
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
  const by = new Map(), outside = new Map(), accTot = {}, lg = {};
  reads.forEach(({ a, w }) => {
    accTot[a.id] = { moments: w.total + w.extra.length, listed: w.listedAll };
    const add = (r, sale) => {
      const name = r[0]; if (!name) return;
      const p = find(name);
      // lendas (e quem não é desta época): os sets de cada conta, para o desconto de colecionador do Historic
      if (!p || norm(p.name) !== norm(name)) { const L = lg[norm(name)] || (lg[norm(name)] = { n: name, c: {} }), ks = L.c[a.id] || (L.c[a.id] = []); if (!ks.includes(setKey(r))) ks.push(setKey(r)); }
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
  S.walletCol = { read_at: new Date().toISOString(), accounts: accTot, players, sets, items, mt, lg, outside: [...outside.values()].slice(0, 60) };
  S.walletCol.tl = tierLabels(S.walletCol);
  const hasRun = !!S.runId && S.mineLoaded;
  const inWallet = new Set(found.map(e => String(e.p.id)));
  const gone = hasRun ? Object.keys(S.mine.roster || {}).filter(id => !inWallet.has(String(id)) && S.players.has(String(id))) : [];
  const fresh = hasRun ? found.filter(e => !S.mine.roster[e.p.id]) : [];
  S.walletGone = gone;
  // usos que mudam no plantel (os que acertaste à mão ficam)
  const ups = hasRun ? found.map(e => { const r0 = S.mine.roster[e.p.id]; if (!r0 || r0.usesManual) return null; const nv = Math.max(0, players[e.p.id].uses - usedCount('main', e.p.id)), cur = +r0.uses || 0; const to = r0.tierUses != null ? nv : Math.max(cur, nv); return to !== cur ? { e, cur, to } : null; }).filter(Boolean) : [];
  const tierCount = {}; Object.keys(items).forEach(f => { const t = momentTier(S.walletCol, f); tierCount[t] = (tierCount[t] || 0) + 1; });
  const tot = Object.entries(accTot).map(([k, t]) => (groupMode() ? esc(accLabel(k)) + ' ' : '') + t.moments + ' Moments' + (t.listed ? ' (' + t.listed + ' à venda)' : '')).join(' · ');
  // o que mudou desde a última leitura: Moments novos, que saíram e que mudaram de conta
  const prevItems = prevCol.items || null, diff = []; S.walletNew = 0;
  if (prevItems) {
    const grp = (list, src, col, extra) => { const g = new Map(); list.forEach(f => { const it = src[f] || {}, k = it.p + '|' + momentTier(col, f) + (extra ? '|' + extra(f) : ''); g.set(k, (g.get(k) || 0) + 1); });
      return [...g].map(([k, n]) => { const [pid, t, x] = k.split('|'); return '<b>' + esc(nameOf(pid)) + '</b> <span class="muted">' + esc(t) + '</span>' + (n > 1 ? ' ×' + n : '') + (x ? ' ' + x : ''); }).slice(0, 12).join(', ') + (g.size > 12 ? ' e mais' : ''); };
    const add = Object.keys(items).filter(f => !prevItems[f]), rem = Object.keys(prevItems).filter(f => !items[f]);
    const moved = groupMode() ? Object.keys(items).filter(f => prevItems[f] && prevItems[f].a && items[f].a !== prevItems[f].a) : [];
    S.walletNew = add.length;
    if (add.length) diff.push('<div><b class="up">+' + plural(add.length, 'Moment novo', 'Moments novos') + ':</b> ' + grp(add, items, S.walletCol) + '.</div>');
    if (rem.length) diff.push('<div><b class="down">−' + plural(rem.length, 'Moment saiu', 'Moments saíram') + ':</b> ' + grp(rem, prevItems, prevCol) + '.</div>');
    if (moved.length) diff.push('<div><b>' + plural(moved.length, 'Moment mudou', 'Moments mudaram') + ' de conta:</b> ' + grp(moved, items, S.walletCol, f => '→ ' + esc(accLabel(items[f].a))) + '.</div>');
  }
  const hNames = new Set(); ((groupHist() || {}).days || []).forEach(d => (d.players || d.lines || []).forEach(x => hNames.add(norm(x[1]))));
  const nLg = Object.keys(lg).filter(k => hNames.has(k)).length;
  openSheet('<h3>A tua coleção</h3><div class="small muted">' + tot + ' · ' + found.length + ' jogadores na NBA esta época' + (nLg ? ' · ' + plural(nLg, 'lenda do Historic', 'lendas do Historic') + ' com carta (desconto)' : '') + '</div>' +
    (failed.length ? '<div class="note">Não consegui ler: ' + esc(failed.join(' · ')) + '</div>' : '') +
    (dupAddr.length ? '<div class="note">' + esc(dupAddr.join(', ')) + ' tem o mesmo endereço Flow de outra conta: só li essa carteira uma vez. Confirma os endereços em Ajustes → Perfil.</div>' : '') +
    (diff.length ? '<div class="note info">' + diff.join('') + '</div>' : prevItems ? '<div class="small muted">Nenhum Moment novo desde a última leitura.</div>' : '') +
    '<div class="small muted">Escalões: ' + TIERS.slice().reverse().filter(t => tierCount[t]).map(t => '<b>' + t + '</b> ' + tierCount[t]).join(' · ') + '</div>' +
    (ups.length ? '<div class="small">Usos que mudam: ' + ups.slice(0, 12).map(u => esc(u.e.p.name) + ' ' + u.cur + ' → <b>' + u.to + '</b>').join(' · ') + (ups.length > 12 ? ' e mais ' + (ups.length - 12) : '') + '.</div>' : '') +
    // só o que muda (a lista toda fica em Jogadores → Coleção)
    (!found.length ? '<div class="small muted">Nenhum Moment de um jogador com equipa NBA esta época.</div>'
      : fresh.length ? '<div class="small"><b>' + plural(fresh.length, 'jogador novo', 'jogadores novos') + ':</b> ' + fresh.slice(0, 12).map(e => esc(e.p.name)).join(', ') + (fresh.length > 12 ? ' e mais ' + (fresh.length - 12) : '') + '.</div>'
      : hasRun && !ups.length && diff.length ? '<div class="small muted">Os usos no plantel ficam iguais.</div>' : '') +
    (gone.length ? '<label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="wGone"> <span>Tirar do plantel quem já não está na carteira: ' + gone.map(id => esc(nameOf(id))).join(', ') + '</span></label>' : '') +
    '<button class="btn primary" type="button" data-action="wallet-apply" style="width:100%">' + (hasRun ? (fresh.length ? 'Guardar e juntar ' + fresh.length + ' jogador' + (fresh.length > 1 ? 'es' : '') + ' ao plantel' : 'Guardar e atualizar o plantel') : 'Guardar a coleção') + '</button>');
}
async function walletApply() {
  const col = S.walletCol; if (!col) return;
  // guarda no perfil
  try { await q(sb.from('profiles').update({ collection: col }).eq('user_id', S.session.user.id)); S.profile = Object.assign({}, S.profile, { collection: col }); }
  catch (e) { toast(/collection/.test(errText(e)) ? 'Para guardar a coleção, corre o supabase/schema.sql novo no Supabase.' : 'A coleção não ficou guardada: ' + errText(e)); S.profile = Object.assign({}, S.profile, { collection: col }); }
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
  toast((nm ? '+' + plural(nm, 'Moment novo', 'Moments novos') + ' na coleção. ' : '') + (S.runId ? (added ? plural(added, 'jogador novo', 'jogadores novos') + ' no plantel' : 'Plantel atualizado') + (removed ? ', ' + plural(removed, 'tirado', 'tirados') : '') + '.' : 'Coleção guardada.'));
}
// junta ao plantel da run os jogadores da coleção guardada (1 uso cada; acertam-se depois)
function collectionToRoster() {
  const col = (S.profile || {}).collection; if (!col || !S.runId) return;
  let added = 0;
  Object.entries(col.players || {}).forEach(([id, c]) => { if (!S.mine.roster[id] && S.players.has(String(id))) { const tot = tierUsesOf(col, c) || 1; S.mine.roster[id] = { uses: Math.max(0, tot - usedCount('main', id)), tierUses: tot, status: 'ok', moments: c.moments, sets: c.sets }; added++; } });
  applyChainResults(); schedule(); saveMine();
  toast(added + ' jogador' + (added === 1 ? '' : 'es') + ' da coleção no plantel.');
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
const capMsg = dr => (dr.length ? ' Sem usos para mais dias: tirei o cadeado de ' + [...new Set(dr.map(([, id]) => id))].map(id => { const n = dr.filter(x => x[1] === id).map(x => dayNo(x[0])).sort((a, b) => a - b); return lastName(id) + (n.length > 1 ? ' nos dias ' : ' no dia ') + n.join(', '); }).join('; ') + '.' : '');
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
  const title = kind === 'lock' ? 'Fixar ' + name + ' no dia ' + dn + '?' : 'Tirar ' + name + ' do dia ' + dn + '?';
  const back = () => playerSheet(id, date, S.lu && S.lu.date === date ? () => lineupSheet(date) : null);
  openSheet('<h3>' + title + '</h3><div class="small muted" id="choiceProg">A refazer a run…</div>', back);
  await new Promise(res => setTimeout(res, 30));
  let ev;
  try {
    ev = await evalAltAsync(kind === 'lock'
      ? (kw => plan => { plan.locks = plan.locks || {}; plan.bans = plan.bans || {}; plan.locks[date] = [...new Set((plan.locks[date] || []).concat([id]))]; plan.bans[date] = (plan.bans[date] || []).filter(x => x !== id); if (kw) { plan.keep = Object.assign({}, plan.keep || {}, { [date]: kw }); } })(keepWith(date, id))
      : altMods.ban(date, id));
  } catch (e) { console.warn(e); if ($('choiceProg')) $('choiceProg').innerHTML = '<span class="down">Não consegui calcular:</span> ' + esc(errText(e)); return; }
  if (!$('choiceProg')) return; // fechou a folha
  const res = ev.res, d1 = res.days.find(x => x.date === date) || { P: 0, lineup: [] };
  const pp = x => Math.round(x * 100), diff = (a, b) => { const k = pp(b) - pp(a); return k === 0 ? '' : ' <small class="' + (k > 0 ? 'up' : 'down') + '">' + (k > 0 ? '+' : '−') + Math.abs(k) + ' pp</small>'; };
  const arrow = (a, b, f) => f(a) + ' → <b class="' + (b > a + 1e-9 ? 'up' : b < a - 1e-9 ? 'down' : '') + '">' + f(b) + '</b>';
  const lines = [];
  // o dia escolhido
  const outs = d0.lineup.filter(x => !d1.lineup.includes(x)), ins = d1.lineup.filter(x => !d0.lineup.includes(x) && x !== id);
  lines.push(['Dia ' + dn, 'vitória ' + arrow(d0.P, d1.P, pct) + diff(d0.P, d1.P) + (outs.length || ins.length ? '<br><span class="muted">' + (ins.length ? 'Entra' + (ins.length > 1 ? 'm' : '') + ': ' + ins.map(x => esc(lastName(x))).join(', ') + '. ' : '') + (outs.length ? 'Sai' + (outs.length > 1 ? 'em' : '') + ': ' + outs.map(x => esc(lastName(x))).join(', ') + '.' : '') + '</span>' : '')]);
  // os dias do jogador
  const dOf = v => v.days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1);
  const before = dOf(cur), after = dOf(res), lost = before.filter(x => !after.includes(x)), gained = after.filter(x => !before.includes(x) && x !== dn);
  lines.push([esc(lastName(id)), (before.length ? 'no plano jogava ' + (before.length > 1 ? 'nos dias ' : 'no dia ') + before.join(', ') : 'o plano não o usava') + ' → ' + (after.length ? (after.length > 1 ? 'dias ' : 'dia ') + after.join(', ') : 'não joga') + (lost.length ? '. <span class="down">Deixa de jogar ' + (lost.length > 1 ? 'nos dias ' : 'no dia ') + lost.join(', ') + '</span>' : '') + (gained.length ? '. Passa a jogar ' + (gained.length > 1 ? 'nos dias ' : 'no dia ') + gained.join(', ') : '') + '.']);
  // outros dias que mudam (≥ 3 pp)
  const others = cur.days.filter(x => x.date !== date).map(x => ({ x, y: res.days.find(z => z.date === x.date) })).filter(o => o.y && Math.abs(pp(o.y.P) - pp(o.x.P)) >= 3);
  if (others.length) lines.push(['Outros dias', others.slice(0, 6).map(o => 'dia ' + (o.x.idx + 1) + ' ' + arrow(o.x.P, o.y.P, pct)).join(' · ') + (others.length > 6 ? ' e mais ' + (others.length - 6) : '')]);
  // a run toda
  const ew0 = r.wins + cur.expected, ew1 = r.wins + res.expected;
  lines.push(['Run', (r.prizes.length ? r.prizes.map((p, i) => p.wins + 'V ' + arrow(cur.prizeProbs[i], res.prizeProbs[i], pct)).join(' · ') + '<br>' : '') + 'vitórias esperadas ' + arrow(ew0, ew1, f1)]);
  // as outras contas (plano conjunto)
  if (ev.group && S.multi) {
    const acc = ev.group.keys.filter(k => k !== S.acc).map(k => { const a = S.multi.byKey[k], b = ev.group.byKey[k]; if (!a || !b) return ''; const e0 = a.wins + a.normal.expected, e1 = b.wins + b.normal.expected; return Math.abs(e1 - e0) >= 0.05 ? esc(accLabel(k)) + ' ' + arrow(e0, e1, f1) : ''; }).filter(Boolean);
    if (acc.length) lines.push(['Outras contas', 'vitórias esperadas: ' + acc.join(' · ')]);
  }
  const loss = ew1 < ew0 - 0.05 || r.prizes.some((p, i) => pp(res.prizeProbs[i]) < pp(cur.prizeProbs[i]));
  const gain = !loss && (ew1 > ew0 + 0.05 || r.prizes.some((p, i) => pp(res.prizeProbs[i]) > pp(cur.prizeProbs[i])));
  const verdict = loss ? '<div class="note"><b>Custa</b> à tua run. Faz na mesma se sabes algo que o plano não sabe (minutos, lesão).</div>'
    : gain ? '<div class="note info"><b>Sobe</b> as tuas hipóteses. Vale a pena.</div>'
    : '<div class="note info">Quase não muda nada.</div>';
  openSheet('<h3>' + title + '</h3>' + verdict + '<div class="card">' + lines.map(([a, b]) => '<div class="status-line basis-line"><span class="bl">' + a + '</span><span>' + b + '</span></div>').join('') + '</div>' +
    '<div class="btns"><button class="btn quiet" type="button" data-action="sheet-back">Cancelar</button><button class="btn ' + (loss ? '' : 'primary') + '" type="button" data-action="' + (kind === 'lock' ? 'lock-yes' : 'ban-yes') + '" data-id="' + esc(id) + '" data-date="' + date + '">' + (kind === 'lock' ? 'Fixar na mesma' : 'Tirar na mesma') + '</button></div>', back);
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
    toast(plural(ids.length, 'jogador fixado', 'jogadores fixados') + '.' + capMsg(dr));
  } else {
    planPatch({ locks: { [date]: [] }, keep: { [date]: d.lineup.slice() } }, true);
    toast('Todos sem cadeado. O lineup fica igual.');
  }
}
function lockToggle(id, date, on) {
  const cur = new Set(((curPlan().locks || {})[date]) || []);
  if (on) {
    const lim = (S.days.find(d => d.date === date) || {}).numPlayers || 5;
    if (cur.size >= lim) { toast('Já tens ' + lim + ' jogadores fixados neste dia.'); return false; }
    cur.add(id);
    // o resto do lineup desse dia fica (só tu é que trocas); se ele não estava e o lineup está cheio, sai quem menos
    // falta faz nesse dia
    const keep = keepWith(date, id);
    const dr = planPatch(Object.assign({ locks: { [date]: [...cur] }, bans: { [date]: (((curPlan().bans || {})[date]) || []).filter(x => x !== id) } }, keep ? { keep: { [date]: keep } } : {}), !!keep);
    toast(lastName(id) + ' fixado.' + (keep ? ' O resto do lineup fica.' : ' Plano refeito.') + capMsg(dr));
  } else {
    // tirar o cadeado não muda o lineup desse dia: fica como está (o plano só volta a escolher se mudares outra coisa)
    const v = view(), dd = v && v.days.find(x => x.date === date);
    cur.delete(id); planPatch({ locks: { [date]: [...cur] }, keep: { [date]: dd ? dd.lineup.slice() : null } }, true);
    toast(lastName(id) + ' sem cadeado. O lineup fica igual.');
  }
  return true;
}
function banToggle(id, date, on) {
  const cur = new Set(((curPlan().bans || {})[date]) || []);
  on ? cur.add(id) : cur.delete(id);
  planPatch({ bans: { [date]: [...cur] }, locks: { [date]: (((curPlan().locks || {})[date]) || []).filter(x => !on || x !== id) } });
  if (on) toast(lastName(id) + ' fora deste dia. Plano refeito.');
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
  if (tb && !tb.others.length) return '<span class="lu-l2 lu-warn">⚠ Sem usos nesta conta: a melhor carta dá ' + esc(usesTxt(tb.top)) + ', já gastos ou no plano de outros dias</span>';
  if (tb) return '<span class="lu-l2 lu-warn">⚠ O Moment necessário já joga na ' + esc(tb.others.map(accLabel).join(' e na ')) + (nd && nd.date === date ? '' : ' no dia ' + dn) + '</span>';
  const u = r.model.uses[pi] || 0;
  if (!u) return '<span class="lu-l2">sem usos</span>';
  return '<span class="lu-l2"><b>' + (u >= UNL ? 'usos ilimitados' : plural(u, 'uso', 'usos')) + '</b> · ' + (ds.length ? 'joga ' + (ds.length > 1 ? 'nos dias ' : 'no dia ') + ds.join(', ') : 'fora do plano') + '</span>';
}
function luRender() {
  const L = S.lu, r = S.result, v = view(); if (!L || !r || !v) return;
  const date = L.date, { md, d } = dayInfo(date), day = S.days.find(x => x.date === date) || {}, dn = S.days.indexOf(day) + 1;
  const p0 = $('sheetPanel'), keep = L.toTop ? 0 : $('luBody') ? p0.scrollTop : L.y || 0; L.toTop = false; L.y = 0;
  const tip = firstTipOf(day);
  if (!md || !d || (tip != null && Date.now() >= tip)) { openSheet('<h3>Lineup do dia ' + dn + '</h3><div class="note info" id="luBody">Os jogos deste dia já começaram: as mudanças fazem-se em Sugestões para hoje.</div>'); return; }
  const locks = new Set(((curPlan().locks || {})[date]) || []), bans = ((curPlan().bans || {})[date]) || [], size = md.size;
  const B = L.base, pp = x => Math.round(x * 100), ew = r.wins + v.expected, mine = locks.size + bans.length > 0;
  const sgn = (n, s) => (n > 0 ? '+' : '−') + s;
  // em cima: hoje e a run, face à sugestão
  let head;
  if (!B) head = '<div class="small muted" id="luProg">' + (L.err ? '<span class="down">Não consegui calcular a sugestão do plano.</span>' : 'A calcular a sugestão do plano…') + '</div>';
  else {
    // hoje e o resto da run em separado: o que a escolha de hoje faz aos outros dias (vitórias esperadas neles)
    const rest = days => days.filter(x => x.date !== date).reduce((t, x) => t + (x.P || 0), 0);
    const dP = pp(d.P) - pp(B.P), rNow = rest(v.days), rB = rest(B.days), dR = rNow - rB;
    const f2 = x => (Math.round(x * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    head = '<div class="kv lu-kv"><div><div class="label">Vitória hoje</div><div class="v num c-' + tone(d.P) + '">' + pct(d.P) + '</div><div class="small muted">' + (!mine ? 'a sugestão do plano' : 'sugestão ' + pct(B.P) + (dP ? ' · <b class="' + (dP > 0 ? 'up' : 'down') + '">' + sgn(dP, Math.abs(dP) + '%') + '</b>' : '')) + '</div></div>' +
      '<div><div class="label">Resto da run</div><div class="v num">' + f1(rNow) + '</div><div class="small muted">' + (!mine ? 'vitórias esperadas nos outros dias' : Math.abs(dR) < 0.05 ? 'igual à sugestão' : 'sugestão ' + f1(rB) + ' · <b class="' + (dR > 0 ? 'up' : 'down') + '">' + sgn(dR, f2(Math.abs(dR))) + '</b>') + '</div></div></div>';
    if (mine) {
      const pz = r.prizes.map((p, i) => ({ p, a: B.probs[i] || 0, b: v.prizeProbs[i] || 0 })).filter(x => pp(x.a) !== pp(x.b));
      const todayTxt = dP ? ' (hoje ' + sgn(dP, Math.abs(dP) + '%') + ')' : '';
      head += (dR <= -0.3 ? '<div class="note"><b>Afeta o resto da run:</b> ' + sgn(dR, f2(Math.abs(dR))) + ' vitórias esperadas nos outros dias' + todayTxt + '. Mantém se sabes algo que o plano não sabe (minutos, lesão).</div>'
        : dR <= -0.05 ? '<div class="note info"><b>Mexe pouco no resto da run:</b> ' + sgn(dR, f2(Math.abs(dR))) + ' vitórias nos outros dias' + todayTxt + '.</div>'
        : dR >= 0.05 ? '<div class="note info"><b>Melhora o resto da run:</b> ' + sgn(dR, f2(dR)) + ' vitórias nos outros dias' + todayTxt + '.</div>'
        : '<div class="note info"><b>O resto da run não muda.</b> ' + (dP ? 'A diferença é só hoje' + todayTxt + '.' : 'Igual à sugestão do plano.') + '</div>') +
        (pz.length ? '<div class="small muted">Prémios: ' + pz.map(x => x.p.wins + 'V ' + pct(x.a) + ' → ' + pct(x.b)).join(' · ') + '</div>' : '');
    }
  }
  // no lineup: cadeado (fixar / soltar) e × (tirar deste dia; o plano põe outro)
  const nameBtn = (id, p, pi, sub) => { const st = (md.info[pi][0] || {}).status; return '<button class="lu-main" type="button" data-action="lu-player" data-id="' + esc(id) + '" data-date="' + date + '">' + face(id, 'sm') + '<span class="lu-t"><span class="pn">' + (locks.has(id) ? icoLock : '') + '<span class="nm">' + esc(p.name) + '</span>' + (st && st !== 'ok' ? '<span class="pill ' + st + '">' + esc(STATUS[st].label) + '</span>' : '') + '</span><span class="ps">' + sub + '</span></span></button>'; };
  const later = id => v.days.filter(x => x.date !== date && x.lineup.includes(id)).map(x => x.idx + 1);
  const gaps = (L.out || []).filter(id => d.lineup.includes(id));
  const inRows = d.lineup.map(id => {
    const pi = r.model.pIndex.get(id), p = r.model.players[pi]; if (pi == null) return '';
    if (gaps.includes(id)) return '<li class="lu-row lu-gap"><div class="gapb"><button class="gapb-go" type="button" data-action="lu-pick" data-id="' + esc(id) + '" data-date="' + date + '"><span class="gapb-ic">' + icoPlus + '</span><span class="gapb-t"><b>Adicionar jogador</b><span>sai ' + esc(p.name) + '</span></span></button>' +
      '<button class="btn link small gapb-keep" type="button" data-action="lu-undo" data-id="' + esc(id) + '" data-date="' + date + '">manter</button></div></li>';
    const lk = locks.has(id);
    return '<li class="lu-row">' + nameBtn(id, p, pi, esc(p.team) + ' ' + esc(opp(p.team, day)) + (lk ? ' · fixado' : '')) + pvHtml(objVals(md, pi, false)) +
      '<button class="lu-ic' + (lk ? ' on' : '') + '" type="button" data-action="lu-lock" data-id="' + esc(id) + '" data-date="' + date + '" aria-pressed="' + lk + '" aria-label="Fixar ' + esc(p.name) + '" title="' + (lk ? 'Fixado (toca para soltar)' : 'Fixar') + '">' + icoLockBtn + '</button>' +
      '<button class="lu-ic" type="button" data-action="lu-ban" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Tirar ' + esc(p.name) + ' deste dia" title="Tirar deste dia">' + icoX + '</button></li>';
  }).join('');
  // os outros dias que mudam (quem entra e quem sai), face à sugestão
  let chHtml = '';
  if (B && mine) {
    const ch = v.days.filter(x => x.date !== date).map(x => { const b = B.days.find(y => y.date === x.date); if (!b) return null; const ins = x.lineup.filter(id => !b.lineup.includes(id)), outs = b.lineup.filter(id => !x.lineup.includes(id)); return ins.length || outs.length || Math.abs(pp(x.P) - pp(b.P)) >= 3 ? { x, b, ins, outs } : null; }).filter(Boolean);
    if (ch.length) chHtml = '<div class="card"><div class="list-head"><h2>Muda noutros dias</h2><span class="small muted">face à sugestão</span></div><ul class="list">' +
      ch.slice(0, 6).map(c => '<li class="row lu-ch"><span><b>Dia ' + (c.x.idx + 1) + '</b> ' + pct(c.b.P) + ' → <b class="' + (pp(c.x.P) > pp(c.b.P) ? 'up' : pp(c.x.P) < pp(c.b.P) ? 'down' : '') + '">' + pct(c.x.P) + '</b>' + (c.outs.length ? ' · sai ' + c.outs.map(id => esc(lastName(id))).join(', ') : '') + (c.ins.length ? ' · entra ' + c.ins.map(id => esc(lastName(id))).join(', ') : '') + '</span></li>').join('') +
      (ch.length > 6 ? '<li class="row small muted" style="display:block">e mais ' + plural(ch.length - 6, 'dia', 'dias') + '</li>' : '') + '</ul></div>';
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
    if (gaps.includes(id)) return '<li class="lu-row" data-n="' + esc(norm(p.name) + ' ' + String(p.team || '').toLowerCase()) + '">' + nameBtn(id, p, pi, esc(p.team) + ' ' + esc(opp(p.team, day)) + '<span class="lu-l2">acabou de sair · + volta a pô-lo · × tira-o deste dia</span>') + pvHtml(objVals(md, pi, false)) +
      '<button class="lu-ic add" type="button" data-action="lu-undo" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Voltar a pôr ' + esc(p.name) + ' no lineup" title="Voltar a pôr">' + icoPlus + '</button>' +
      '<button class="lu-ic" type="button" data-action="lu-auto" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Tirar ' + esc(p.name) + ' deste dia (o plano põe o melhor a seguir)" title="Tirar deste dia">' + icoX + '</button></li>';
    return '<li class="lu-row' + (k >= 8 && !L.all ? ' lu-more' : '') + '" data-n="' + esc(norm(p.name) + ' ' + String(p.team || '').toLowerCase()) + '">' + nameBtn(id, p, pi, esc(p.team) + ' ' + esc(opp(p.team, day)) + candLine(r, pi, tb, ds, tir, date)) + pvHtml(objVals(md, pi, false)) +
      (gaps.length ? '<button class="lu-ic add" type="button" data-action="lu-fill" data-out="' + esc(gaps[0]) + '" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Pôr ' + esc(p.name) + ' no lugar de ' + esc(nameOf(gaps[0])) + '" title="Pôr no lugar livre"' + (uses ? '' : ' disabled') + '>' + icoPlus + '</button>' :
      '<button class="lu-ic add" type="button" data-action="lu-add" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Pôr ' + esc(p.name) + ' no lineup" title="' + (full ? 'Já tens ' + size + ' fixados: solta um primeiro' : 'Pôr no lineup e fixar') + '"' + (uses && !full ? '' : ' disabled') + '>' + icoPlus + '</button>') + '' +
      '<button class="lu-ic" type="button" data-action="lu-excl" data-id="' + esc(id) + '" data-date="' + date + '" aria-label="Tirar ' + esc(p.name) + ' deste dia" title="Tirar deste dia">' + icoX + '</button></li>';
  }).join('');
  const bad = (d.badLocks || []).map(id => esc(nameOf(id)) + ' <button class="btn link small" type="button" data-action="lu-lock" data-id="' + esc(id) + '" data-date="' + date + '">soltar</button>').join(' · ');
  const html = '<h3>Lineup do dia ' + dn + ' ' + helpBtn('mudar') + '</h3><div class="small muted">' + dWeek(date) + ', ' + dShort(date) + ' · ' + esc(objsText(day)) + '</div><div id="luBody" class="stack">' + head +
    (gaps.length ? '<div class="note info">Toca no + para escolher quem entra' + (gaps.length > 1 ? ' em cada lugar livre' : '') + ', ou no × de quem saiu (em Pôr no lineup) para o tirar deste dia: o plano põe logo o melhor a seguir. Até lá, os números são os do lineup antes da troca.</div>' : '') +
    '<div class="card"><div class="list-head"><h2>No lineup</h2><span class="small muted">' + d.lineup.length + ' de ' + size + (locks.size ? ' · ' + plural(locks.size, 'fixado', 'fixados') : '') + '</span></div>' +
      (d.lineup.length ? (d.lineup.every(id => locks.has(id)) ? '<div class="lu-all"><button class="btn small" type="button" data-action="lu-lockall" data-on="0" data-date="' + date + '">' + icoLockBtn + ' Soltar todos</button></div>' : '<div class="lu-all"><button class="btn small" type="button" data-action="lu-lockall" data-on="1" data-date="' + date + '">' + icoLockBtn + ' Fixar todos</button></div>') : '') + (inRows ? '<ul class="list">' + inRows + '</ul>' : '<div class="row small muted">Ninguém no lineup: o plano guarda os usos para outros dias.</div>') + '</div>' +
    (bad ? '<div class="note">Fixados que não podem jogar neste dia: ' + bad + '</div>' : '') + chHtml +
    (cand.length ? '<div class="card"><div class="list-head"><h2>Pôr no lineup</h2><span class="small muted" id="luCount">' + plural(cand.length, 'jogador', 'jogadores') + '</span></div>' +
      '<div class="lu-search"><input class="field" id="luSearch" type="search" placeholder="Procurar jogador ou equipa…" autocomplete="off" aria-label="Procurar jogador" value="' + esc(L.q || '') + '"></div>' + luSortChips(md, 'data-date="' + date + '"') +
      '<ul class="list" id="luCand">' + candRows + '<li class="row small muted lu-none" hidden>Ninguém com esse nome a jogar neste dia.</li></ul>' + (cand.length > 8 && !L.all ? '<button class="btn quiet" type="button" id="luAllBtn" data-action="lu-all" data-date="' + date + '" style="margin:4px 16px 14px">Ver todos (' + cand.length + ')</button>' : '') + '</div>' : '') +
    (bans.length ? '<div class="card"><div class="list-head"><h2>Fora deste dia</h2><span class="small muted">o plano não os usa no dia ' + dn + '</span></div><ul class="list">' + bans.map(id => '<li class="lu-row"><div class="lu-main">' + face(id, 'sm') + '<span class="lu-t"><span class="pn"><span class="nm">' + esc(nameOf(id)) + '</span></span><span class="ps">' + esc(pTeam(id)) + ' ' + esc(opp(pTeam(id), day)) + '</span></span></div>' +
      '<button class="btn small" type="button" data-action="lu-unban" data-id="' + esc(id) + '" data-date="' + date + '">Repor</button></li>').join('') + '</ul></div>' : '') +
    (mine ? '<button class="btn" type="button" data-action="lu-reset" data-date="' + date + '">Voltar à sugestão do plano</button>' : '') + '</div>';
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
  return '<div class="chips lu-sort" role="group" aria-label="Ordenar por">' + [-1].concat(md.objs.map((_, k) => k)).map(k => '<button type="button" data-action="lu-sort" data-k="' + k + '" ' + attrs + ' aria-pressed="' + (k === cur) + '">' + (k < 0 ? 'Juntos' : esc(statShort(md.objs[k].stat))) + '</button>').join('') + '</div>';
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
  const back = outPi == null ? '' : (p => '<li data-n="' + esc(norm(p.name) + ' ' + String(p.team || '').toLowerCase()) + '"><button class="row" type="button" data-action="lu-undo" data-back="1" data-id="' + esc(out) + '" data-date="' + date + '"><span class="who">' + face(out, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span></div><div class="ps">' + esc(p.team) + ' ' + esc(opp(p.team, day)) + '<span class="lu-l2">acabou de sair · toca para o manter</span></div></div></span>' + pvHtml(objVals(md, outPi, false)) + '</button></li>')(r.model.players[outPi]);
  const rows = back + cand.map(pi => {
    const p = r.model.players[pi], id = p.id, tb = tierBlocked(id, S.acc, date), uses = tb ? 0 : r.model.uses[pi] || 0, ds = later(id), st = (md.info[pi][0] || {}).status;
    return '<li data-n="' + esc(norm(p.name) + ' ' + String(p.team || '').toLowerCase()) + '"><button class="row" type="button" data-action="lu-fill" data-out="' + esc(out) + '" data-id="' + esc(id) + '" data-date="' + date + '"' + (uses ? '' : ' disabled') + '><span class="who">' + face(id, 'sm') + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span>' + (st && st !== 'ok' ? '<span class="pill ' + st + '">' + esc(STATUS[st].label) + '</span>' : '') + '</div>' +
      '<div class="ps">' + esc(p.team) + ' ' + esc(opp(p.team, day)) + candLine(r, pi, tb, ds, bans.has(id), date) + '</div></div></span>' + pvHtml(objVals(md, pi, false)) + '</button></li>';
  }).join('');
  if (S.lu) S.lu.q = '';
  openSheet('<h3>Quem entra?</h3><div class="small muted">No lugar de ' + esc(nameOf(out)) + ' · dia ' + (day.idx + 1) + ', ' + dShort(date) + '</div>' +
    (rows ? '<div class="lu-search"><input class="field" id="luSearch" type="search" placeholder="Procurar jogador ou equipa…" autocomplete="off" aria-label="Procurar jogador"></div>' : '') + luSortChips(md, 'data-date="' + date + '" data-out="' + esc(out) + '"') + (rows ? '<ul class="list card" id="luCand">' + rows + '<li class="row small muted lu-none" hidden>Ninguém com esse nome a jogar neste dia.</li></ul>' : '<div class="note info">Não há mais ninguém teu com jogo neste dia.</div>') +
    '<button class="btn" type="button" data-action="lu-auto" data-id="' + esc(out) + '" data-date="' + date + '">Deixar o plano escolher</button>', () => lineupSheet(date));
}
// troca: sai quem estava no lugar livre (tirado do dia), entra o escolhido (fixado); a run é refeita e o Mudar mostra o efeito
function luFill(date, out, pick) {
  const P = curPlan(), size = ((dayInfo(date).md) || {}).size || 5;
  const locks = new Set(((P.locks || {})[date]) || []); locks.delete(out); locks.add(pick);
  if (locks.size > size) { toast('Já tens ' + size + ' jogadores fixados neste dia: solta um primeiro.'); return; }
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
  const sub = id => { const b = live ? boxFor(date, id) : undefined; return esc(pTeam(id)) + ' ' + (b ? (b.fin ? '· <span class="pill fim">Fim</span>' : '· <span class="pill jogo">Em jogo</span>') : esc(opp(pTeam(id), day))); };
  const pv = id => { const a = valsOf(id); return a === 'dnp' ? '<div class="pv"><div class="u">não jogou</div></div>' : pvHtml(a); };
  const row = (id, inLu, k) => '<li class="lu-row' + (!inLu && k >= 10 && !E.all ? ' lu-more' : '') + '"' + (inLu ? '' : ' data-n="' + esc(norm(nameOf(id)) + ' ' + String(pTeam(id) || '').toLowerCase()) + '"') + '><div class="lu-main">' + face(id, 'sm') + '<span class="lu-t"><span class="pn"><span class="nm">' + esc(nameOf(id)) + '</span></span><span class="ps">' + sub(id) + '</span></span></div>' + pv(id) +
    (inLu ? '<button class="lu-ic" type="button" data-action="past-lu-pick" data-id="' + esc(id) + '" aria-label="Tirar ' + esc(nameOf(id)) + '" title="Tirar">' + icoX + '</button>'
      : '<button class="lu-ic add" type="button" data-action="past-lu-pick" data-id="' + esc(id) + '" aria-label="Pôr ' + esc(nameOf(id)) + '" title="' + (E.ids.length >= lim ? 'Já tens ' + lim + ': tira um primeiro' : 'Pôr no lineup') + '"' + (E.ids.length >= lim ? ' disabled' : '') + '>' + icoPlus + '</button>') + '</li>';
  // em cima: o que este lineup fez nesse dia e o resultado
  const c = !live && E.ids.length ? dayCalc(S.acc, day, E.ids) : null;
  const lt = live ? objs.map((o, k) => E.ids.reduce((t, id) => { const a = liveVals(id); return t + (a === 'dnp' || !a[k] ? 0 : a[k].v); }, 0)) : null;
  const head = live ? '<div class="kv lu-kv"><div><div class="label">Até agora</div><div class="v num">' + objs.map((o, k) => f0(lt[k]) + '<small>/' + o.target + ' ' + esc(statShort(o.stat)) + '</small>').join('<br>') + '</div></div></div>' +
      '<div class="small muted">Põe aqui o lineup que levaste no Top Shot, mesmo quem já começou a jogar. Ao guardar, a app passa a seguir as estatísticas destes e refaz a vitória de hoje.</div>'
    : c ? '<div class="kv lu-kv"><div><div class="label">Feito</div><div class="v num">' + c.objs.map((o, k) => f0(c.tot[k]) + '<small>/' + o.target + ' ' + esc(statShort(o.stat)) + '</small>').join('<br>') + '</div></div><div><div class="label">Resultado</div><div class="v num ' + (c.res === 'win' ? 'c-good' : 'c-bad') + '">' + (c.res === 'win' ? '✓ vitória' : '✕ derrota') + '</div></div></div>'
    : '<div class="small muted">' + (E.ids.length ? 'À espera das estatísticas dos jogos…' : 'Escolhe quem jogou.') + '</div>';
  const inRows = E.ids.map(id => row(id, true)).join('') + Array.from({ length: Math.max(0, lim - E.ids.length) }, () => '<li class="lu-row lu-gap"><div class="gapb"><span class="gapb-go" style="cursor:default"><span class="gapb-ic">' + icoPlus + '</span><span class="gapb-t"><b>Lugar livre</b><span>põe alguém da lista de baixo</span></span></span></div></li>').join('');
  const cand = Object.keys(S.mine.roster || {}).filter(id => !E.ids.includes(id) && teams.has(pTeam(id))).sort((a, b) => weight(b) - weight(a) || nameOf(a).localeCompare(nameOf(b)));
  openSheet('<h3>' + (live ? 'Lineup de hoje' : 'Lineup do dia ' + dn) + '</h3><div class="small muted">' + dWeek(date) + ', ' + dShort(date) + ' · ' + esc(objsText(day)) + '</div><div id="pastLu" class="stack">' + head +
    '<div class="card"><div class="list-head"><h2>No lineup</h2><span class="small muted">' + E.ids.length + ' de ' + lim + '</span></div><ul class="list">' + inRows + '</ul></div>' +
    '<button class="btn primary" type="button" data-action="' + (live ? 'live-lu-save' : 'past-lu-save') + '"' + (E.ids.length ? '' : ' disabled') + '>Guardar</button>' +
    (cand.length ? '<div class="card"><div class="list-head"><h2>Pôr no lineup</h2><span class="small muted">' + (live ? 'o que levam até agora' : 'o que fizeram nesse dia') + '</span></div>' +
      '<div class="lu-search"><input class="field" id="luSearch" type="search" placeholder="Procurar jogador ou equipa…" autocomplete="off" aria-label="Procurar jogador" value="' + esc(E.q || '') + '"></div>' +
      '<ul class="list" id="luCand">' + cand.map((id, k) => row(id, false, k)).join('') + '<li class="row small muted lu-none" hidden>Ninguém com esse nome a jogar neste dia.</li></ul>' + (cand.length > 10 && !E.all ? '<button class="btn quiet" type="button" id="luAllBtn" data-action="past-lu-all" style="margin:4px 16px 14px">Ver todos (' + cand.length + ')</button>' : '') + '</div>' : '') +
    (live ? '' : '<button class="btn link small" type="button" data-action="undo-result" data-date="' + date + '">Não joguei este dia</button>') + '</div>');
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
  toast(outs.length || ins.length ? 'Lineup de hoje acertado' + (outs.length ? ': sai ' + outs.map(lastName).join(', ') : '') + (ins.length ? (outs.length ? ', entra ' : ': entra ') + ins.map(lastName).join(', ') : '') + '. A app segue estes.' : 'Lineup de hoje guardado.');
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
  toast((c ? 'Lineup mudado: ' + (c.res === 'win' ? 'vitória' : 'derrota') + ' (' + madeTxt(c.objs, c.tot) + ').' : 'Lineup mudado. O resultado é refeito quando houver as estatísticas dos jogos.') + capMsg(dr));
}
function recordResult(date, res) {
  const cur = ((curPlan().played || {})[date]) || null;
  // dia já fechado: muda só o resultado (os usos já foram descontados)
  if (cur && cur.done) { planPatch({ played: { [date]: { result: res, chain: false, box: false, tot: null, points: null } } }); toast((res === 'win' ? 'Vitória' : 'Derrota') + ' registada.'); return; }
  const lineup = sheetLineup(date);
  if (!lineup.length) toast('Sem lineup guardado para esse dia: acerta os usos à mão.');
  lineup.forEach(id => { const e = S.mine.roster[id]; if (e) setUsesOf(e, S.acc, Math.max(0, usesEff(e, id, S.acc) - 1)); });
  planPatch({ played: { [date]: { done: true, result: res, lineup, noAuto: false } } });
  toast((res === 'win' ? 'Vitória' : 'Derrota') + ' registada. Usos descontados e plano refeito.');
}
// "Não joguei": o dia fica sem resultado (não conta) e não volta a fechar sozinho; repõe os usos se estava fechado
function undoResult(date) {
  const pl = ((curPlan().played || {})[date]) || {};
  if (pl.done) (pl.lineup || []).forEach(id => { const e = S.mine.roster[id]; if (e) setUsesOf(e, S.acc, usesEff(e, id, S.acc) + 1); });
  planPatch({ played: { [date]: { done: false, result: null, lineup: [], noAuto: true, box: false, chain: false, points: null, tot: null } } });
  toast(pl.done ? 'Dia sem resultado. Usos repostos.' : 'Dia sem resultado.');
}
function liveSet(id, patch) { const nd = nextDay(); if (nd) planPatch({ live: { [nd.date]: { players: { [id]: patch } } } }); }
function swapDone() { const nd = nextDay(), d = view().days[0]; planPatch({ live: { [nd.date]: { lineup: d.lineup.slice() } } }); toast('Lineup atualizado.'); }
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
        out[norm((a.athlete || {}).displayName)] = { t, v, e: (a.athlete || {}).id || null };
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
  // os lineups ao vivo de todas as contas (uma leitura serve a todas)
  const liveAccs = (S.multi ? accounts().map(a => a.id) : ['main']).filter(k => { const l = (planOf(k).live || {})[nd.date]; return l && l.active && (l.lineup || []).length; });
  const sub = [...new Set(liveAccs.flatMap(k => planOf(k).live[nd.date].lineup))];
  const players = {}; let ok = 0;
  const byName = new Map(sub.map(id => [norm(nameOf(id)), id]));
  // placar da ESPN do dia: estado de cada jogo e o id do jogo de cada equipa (pela equipa vai-se sempre à ficha certa)
  const status = {}, evOfTeam = {};
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + nd.date.replace(/-/g, ''), { cache: 'no-store' });
    if (res.ok) ((await res.json()).events || []).forEach(ev => { const c = (ev.competitions || [])[0] || {}, st = ev.status || c.status || {}; status['espn:' + ev.id] = { state: (st.type || {}).state, period: +st.period || 1 };
      (c.competitors || []).forEach(x => { const t = espnAbbr((x.team || {}).abbreviation); if (t) evOfTeam[t] = 'espn:' + ev.id; }); });
  } catch (e) { /* sem placar: usa os ids do calendário */ }
  const gameIds = new Set(), gidOf = {};
  sub.forEach(id => { const team = pTeam(id), g = FB.gameOf(nd, team); const gid = (team && evOfTeam[team]) || (g && g[3]) || null; if (gid) { gameIds.add(gid); gidOf[id] = gid; } });
  if (!gameIds.size) { if (!quiet) toast('Sem identificador de jogo no calendário. Mete os valores à mão.'); return; }
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
  // o que a última leitura trouxe (aparece por baixo das barras ao vivo; ajuda a ver se a ESPN está a responder)
  S.liveDiag = { at: Date.now(), games: gameIds.size, ok, found: Object.keys(players).length, sub: sub.length, miss: sub.filter(id => !players[id] && gidOf[id] && (status[gidOf[id]] || {}).state !== 'pre').map(id => lastName(id)) };
  if (!ok) { if (!quiet) toast('Ainda sem estatísticas ao vivo. Tenta daqui a pouco ou põe os valores à mão.'); return; }
  if (Object.keys(players).length) {
    liveAccs.forEach(k => { const l = planOf(k).live[nd.date], mine = {}; l.lineup.forEach(id => { if (players[id]) mine[id] = players[id]; });
      if (Object.keys(mine).length) l.players = Object.assign({}, l.players || {}, mine); });
    saveMine(); schedule();
  }
  S.liveAt = Date.now();
  if (!quiet) toast('Estatísticas ao vivo atualizadas.');
}

// ---------- fichas finais dos jogos (ESPN, do browser): o resultado de cada dia sem o registar à mão ----------
// S.box[data] = {at, busy, err, board: placar (espnBoard), lines: {nome: {t, v, st}}, gs: {equipa: {id, st}}, n: {equipa: linhas
// na ficha}, fin: {jogo: true}, done: {equipa: true}}. Só lê os jogos das equipas que faltam; um jogo acabado não se relê.
// estatísticas de um jogo (ficha da ESPN): as duas equipas, cada jogador com MIN, PTS, REB, AST, 3PT, STL, BLK, TO;
// os teus jogadores em destaque. Lê de novo a cada abertura (e com «Atualizar»)
async function gameBoxSheet(gid, pid, date) {
  const id = String(gid).replace(/^espn:/, '');
  openSheet('<h3>Estatísticas do jogo</h3><div id="gbProg" class="small muted">A ler a ficha do jogo…</div>');
  let js = null; try { const res = await fetch(ESPN_SUMMARY(id), { cache: 'no-store' }); if (res.ok) js = await res.json(); } catch (e) {}
  if (!$('gbProg')) return;
  // vindo de um jogador do lineup: mantém-no no «Atualizar»
  const boxMore = pid ? ' data-id="' + esc(pid) + '" data-date="' + esc(date || '') + '"' : '';
  const boxHand = '';
  if (!js) { $('gbProg').outerHTML = '<div class="note">Sem resposta da ESPN. Tenta outra vez.</div><button class="btn" type="button" data-action="game-box" data-gid="' + esc(gid) + '"' + boxMore + '>Tentar outra vez</button>' + boxHand; return; }
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
        (dnp ? '<td colspan="' + COLS.length + '" class="muted">' + esc(a.reason || 'não jogou') + '</td>' : ix.map(i => '<td>' + (i >= 0 ? esc(a.stats[i]) : '–') + '</td>').join('')) + '</tr>';
    }).join('');
    return '<div class="card"><div class="list-head"><h2>' + teamLogo(t) + ' ' + esc(t) + '</h2></div><div class="cmp-wrap"><table class="cmp games gbox"><thead><tr><th class="sticky">Jogador</th>' + COLS.map(([, l]) => '<th>' + l + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  };
  const teams = ((js.boxscore || {}).players) || [];
  const order = [away.t, home.t].map(t => teams.find(x => espnAbbr(((x.team || {}).abbreviation)) === t)).filter(Boolean);
  $('gbProg').outerHTML = '<div class="gb-head"><span class="g-tm">' + teamLogo(away.t) + '<b>' + esc(away.t) + '</b><span class="g-sc num">' + esc(away.sc || '') + '</span></span><span class="muted">–</span><span class="g-tm">' + teamLogo(home.t) + '<b>' + esc(home.t) + '</b><span class="g-sc num">' + esc(home.sc || '') + '</span></span><span class="small muted">' + esc(stt.shortDetail || stt.detail || '') + '</span></div>' +
    (order.length ? order.map(teamTbl).join('') : '<div class="note info">A ESPN ainda não tem a ficha deste jogo.</div>') +
    '<div class="small muted">A negrito: os teus jogadores (com fundo: no lineup de hoje).</div><button class="btn" type="button" data-action="game-box" data-gid="' + esc(gid) + '"' + boxMore + '>Atualizar</button>' + boxHand;
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
        Object.entries(box).forEach(([nm, x]) => { B.lines[nm] = { t: x.t, v: x.v, st: s, e: x.e || null }; });
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
  if (closed.length === 1) { const { a, i, c } = closed[0]; toast((a !== 'main' ? accLabel(a) + ' · ' : '') + 'Dia ' + (i + 1) + ': ' + (c.res === 'win' ? 'vitória' : 'derrota') + ' (' + c.objs.map((o, k) => f0(c.tot[k]) + '/' + o.target + ' ' + statShort(o.stat)).join(', ') + ').'); }
  else if (closed.length) toast(closed.length + ' dias fechados pelas estatísticas.');
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
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !n) { toast('Preenche o nome, o primeiro dia e o número de dias.'); return; }
  const slug = (name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'run') + '-' + start.slice(2, 4) + start.slice(5, 7) + start.slice(8, 10);
  const dates = []; for (let i = 0; i < n; i++) { const d = new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10) + i)); dates.push(d.toISOString().slice(0, 10)); }
  const prev = curRun();
  const ok = await adminWrite(sb.from('runs').insert({ id: slug, name, start_date: dates[0], end_date: dates[n - 1], prizes: prev ? prev.prizes || [] : [], active: !S.runs.length }));
  if (!ok) return;
  await adminWrite(sb.from('run_days').insert(dates.map(date => ({ run_id: slug, date }))), 'Run criada. Define os objetivos; os jogos chegam do calendário NBA.');
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
  if (f.id === 'pfForm') { try { await submitProfile($('pfName2'), $('pfTs2'), $('pfFlow2'), smurfsToSave()); S.smDraft = null; toast('Perfil guardado.'); if (document.activeElement) document.activeElement.blur(); schedule(); renderAjustes(); } catch (err) { toast(errText(err)); } }
  if (f.id === 'inviteForm') { const c = $('invCode').value.trim(); if (await adminWrite(sb.rpc('set_invite_code', { code: c }), 'Código mudado.')) { S.invite = c; renderAjustes(); } }
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
    case 'h-disc': { const v = +b.dataset.v || 0; if (v) S.hdisc[id] = v; else delete S.hdisc[id]; hSave(); closeSheet(); renderHoje(); toast(v ? 'Carta guardada: custa menos ' + v + '%.' : 'Sem carta.'); break; }
    case 'prio': S.mine.plan.prio = b.dataset.v; saveMine(); schedule(); renderAjustes(); toast('Prioridade guardada: o plano foi refeito.'); break;
    case 'hold-undo': holdUndoSheet(b.dataset.acc, b.dataset.date, b.dataset.i); break;
    case 'hold-undo-ok': holdUndoOk(b.dataset.acc, b.dataset.date, b.dataset.i); break;
    case 'op-pick': opPick(id); break;
    case 'op-use': opUse(b.dataset.i); break;
    case 'hd': S.hd = date; S.hdCenter = true; renderHoje(); break;
    case 'pl-sheet': rosterSheet(id); break;
    case 'friend': friendSheet(id, b.dataset.acc); break;
    case 'copy-site': { const u = siteBase(); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('Endereço copiado: cola-o no Safari.'), () => toast(u)); break; }
    case 'job-odds': await jobOdds(); break;
    case 'ranks-go': { const what = String(b.dataset.do || 'ranks,picks').split(',');
      if (!b.dataset.ready && what.includes('ed')) { const lbl = b.innerHTML; b.disabled = true; b.textContent = 'A preparar…'; loadGroupCards().finally(() => { b.disabled = false; b.innerHTML = lbl; b.dataset.ready = '1'; b.click(); }); break; }
      delete b.dataset.ready; const J = rankJob(what); if (!J.accs.length) { toast('Ninguém do grupo tem endereço Flow no perfil.'); break; }
      // na app do ecrã principal o Top Shot abre numa janela à parte, sem a tua sessão e sem favoritos: tem de ser no Safari
      if (navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)) { openSheet('<h3>Abre no Safari</h3><div class="small">Na app do ecrã principal o Top Shot abre numa janela à parte, sem a tua sessão e sem os favoritos. Abre <b>' + esc(siteBase().replace(/^https?:\/\//, '')) + '</b> no <b>Safari</b> (entra com a tua conta da primeira vez) e carrega lá em <b>Atualizar lugares</b>.</div><div class="btns" style="margin-top:12px"><button class="btn primary" type="button" data-action="copy-site">Copiar o endereço</button></div>'); break; } const e = b64u.enc(J); try { window.name = 'fbsync:' + e; } catch (er) {}
      // no telemóvel, um toque num endereço do Top Shot abre a app deles (sem o leitor). Mudar de página já fora do
      // toque (passado mais de 1 s) faz o Safari/Chrome abrir o site no próprio browser.
      b.disabled = true; toast('A abrir o Top Shot no browser…'); setTimeout(() => { location.href = 'https://nbatopshot.com/fastbreak#fbsync=' + e; }, 1300); setTimeout(() => { b.disabled = false; }, 4000); break; }
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
    case 'lu-unban': luBusy(); banToggle(id, date, false); toast(lastName(id) + ' de volta: o plano pode usá-lo neste dia.'); break;
    case 'lu-excl': luBusy(); banToggle(id, date, true); break;
    case 'lu-reset': luBusy(true); { const h = planOf(S.acc).hold; if (h && h.d === date) planOf(S.acc).hold = null; } /* volta a sugestão inteira, sem o lineup mantido */ planPatch({ locks: { [date]: [] }, bans: { [date]: [] } }); toast('De volta à sugestão do plano.'); break;
    case 'ptab': { S.pTab = b.dataset.v; document.querySelectorAll('#sheetPanel .ptab').forEach(x => { x.hidden = x.dataset.ptab !== S.pTab; }); document.querySelectorAll('#sheetPanel .ptabs button').forEach(x => { const on = x.dataset.v === S.pTab; x.setAttribute('aria-selected', on); x.setAttribute('aria-pressed', on); }); break; }
    case 'buy-more': buyMore(); break;
    case 'keep-clear': planPatch({ keep: { [b.dataset.date]: null } }, true); toast('O plano volta a escolher este dia.'); break;
    case 'locks-fix': { const r = S.result, L = {}; ((r && r.model.droppedLocks) || []).forEach(x => { L[x.date] = (L[x.date] || (curPlan().locks || {})[x.date] || []).filter(id => id !== x.player); }); if (Object.keys(L).length) { planPatch({ locks: L }); toast('Cadeados a mais tirados. Plano refeito.'); } break; }
    case 'todo-tick': { const ks = String(b.dataset.k || '').split(' ').filter(Boolean), k = ks[0] || ''; // uma linha pode ter vários (Moments da mesma hora)
      if (ks.every(x => TODO_DONE[x])) ks.forEach(x => { delete TODO_DONE[x]; }); else { ks.forEach(x => { TODO_DONE[x] = TODO_DONE[x] || Date.now(); }); toast('Feito ✓'); } todoSave(); if (/\|tr\|/.test(k)) schedule(); else render(); break; } // Moment mandado: o plano conta já com ele na outra conta
    case 'todo-show': S.todoShow = !S.todoShow; render(); break;
    case 'fold': { const k = b.dataset.k; S.fold[k] = !S.fold[k]; try { localStorage.setItem('fb-fold', JSON.stringify(S.fold)); } catch (e) {} render(); break; }
    case 'lu-all': if (S.lu) { S.lu.all = true; luRender(); } break;
    case 'lu-view': S.luView = b.dataset.v === 'pessoa' ? 'pessoa' : null; try { localStorage.setItem('fb-luview', S.luView || ''); } catch (e) {} render(); break;
    case 'lu-sort': S.luSort = +b.dataset.k < 0 ? null : +b.dataset.k; if (b.dataset.out) luPickSheet(date, b.dataset.out); else if (S.lu) luRender(); break;
    case 'lu-player': playerSheet(id, date, () => lineupSheet(date)); break;
    case 'set-status': setStatus(id, b.dataset.status); rosterSheet(id); break;
    case 'uses': changeUses(id, +b.dataset.d, b.dataset.acc); break;
    case 'acc': S.acc = b.dataset.acc; S.accPicked = true; if (S.multi && S.multi.byKey[S.acc]) S.result = S.multi.byKey[S.acc]; render(); break;
    case 'remove-player': delete S.mine.roster[id]; closeSheet(); schedule(); saveMine(); toast('Tirado do plantel.'); break;
    case 'result-sheet': {
      const day = S.days.find(x => x.date === date), pl = ((curPlan().played || {})[date]) || {}, done = !!pl.done;
      const lineup = done && (pl.lineup || []).length ? pl.lineup : sheetLineup(date);
      openSheet('<h3>' + (done ? 'Mudar o resultado do dia ' : 'Fechar o dia ') + (S.days.indexOf(day) + 1) + '</h3><div class="small muted">' +
        (done ? 'Os usos ficam como estão.' : lineup.length ? 'Os usos destes jogadores são descontados.' : 'Sem lineup guardado: depois acerta os usos de quem jogou.') + ' Normalmente não é preciso: quando os jogos do lineup acabam, o dia fecha sozinho com as estatísticas.</div>' +
        (lineup.length ? '<ul class="list card">' + lineup.map(x => '<li class="row"><span>' + esc(nameOf(x)) + '</span></li>').join('') + '</ul>' : '') + '<div class="btns"><button class="btn" type="button" data-action="result" data-date="' + date + '" data-res="loss">Perdi</button><button class="btn primary" type="button" data-action="result" data-date="' + date + '" data-res="win">Ganhei</button></div>' +
        '<button class="btn" type="button" data-action="past-lu" data-date="' + date + '">Mudar os jogadores</button>' +
        '<button class="btn link small" type="button" data-action="undo-result" data-date="' + date + '">Não joguei este dia</button>');
      break;
    }
    case 'result': recordResult(date, b.dataset.res); closeSheet(); break;
    case 'past-lu': S.luEdit = { date, ids: sheetLineup(date) }; luEditSheet(); break;
    case 'past-lu-pick': { const E = S.luEdit; if (!E) break; const lim = (S.days.find(d => d.date === E.date) || {}).numPlayers || 5; if (E.ids.includes(id)) E.ids = E.ids.filter(x => x !== id); else if (E.ids.length < lim) E.ids.push(id); else { toast('Já tens ' + lim + ' jogadores: tira um primeiro.'); break; } luEditSheet(); break; }
    case 'past-lu-save': luEditSave(); break;
    case 'live-lu': S.luEdit = { date, ids: (((curPlan().live || {})[date] || {}).lineup || sheetLineup(date)).slice(), live: true }; luEditSheet(); break;
    case 'live-lu-save': await liveLuSave(); break;
    case 'top-view': S.topView = b.dataset.v; renderHoje(); break;
    case 'live-refresh': S.liveAt = Date.now(); await liveFetch(false); schedule(); break;
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
    case 'add-id': addToRoster(id, 1); toast(nameOf(id) + ' adicionado com 1 uso.'); renderSearch(($('apSearch') || {}).value || ''); break;
    case 'custom-player': customPlayerSheet(); break;
    case 'save-custom': {
      const name = ($('cpName').value || '').trim(); if (!name) { toast('Escreve o nome.'); return; }
      const cid = 'x-' + (name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now());
      addToRoster(cid, Math.max(0, parseInt($('cpUses').value, 10) || 0), { name, team: $('cpTeam').value }); closeSheet(); toast(name + ' adicionado.'); break;
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
    case 'gc-mode': S.gcMode = b.dataset.v; renderGrupo(); break;
    case 'run-apply': b.disabled = true; await runApply(+b.dataset.i); break;
    case 'ed-apply': closeSheet(); edApply(); toast('Raridade e ASP aplicados: os usos do grupo foram acertados.'); break;
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
      toast(e.injIgnore ? 'O plano ignora o relatório de lesões para ' + lastName(id) + '.' : 'O plano volta a usar o relatório para ' + lastName(id) + '.');
      break;
    }
    case 'alerts-email': if (await saveAlerts({ email: !(S.alerts || {}).email })) { renderAjustes(); toast((S.alerts || {}).email ? 'Avisos por email ligados.' : 'Avisos por email desligados.'); } break;
    case 'alerts-ntfy-on': if (await saveAlerts({ ntfy: newTopic() })) { renderAjustes(); toast('Agora subscreve o tópico na app ntfy.'); } break;
    case 'alerts-ntfy-off': if (await saveAlerts({ ntfy: null })) { renderAjustes(); toast('Notificações no telemóvel desligadas.'); } break;
    case 'alerts-test': b.disabled = true; await testNtfy(); b.disabled = false; break;
    case 'copy-topic': try { await navigator.clipboard.writeText((S.alerts || {}).ntfy || ''); toast('Tópico copiado.'); } catch (err) { toast('Não deu para copiar: seleciona o texto.'); } break;
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
      try { await q(sb.from('profiles').update({ share_plan: v }).eq('user_id', S.session.user.id)); S.profile.share_plan = v; S.lastSummary = ''; publishSummary(); renderAjustes(); toast(v ? 'O grupo vê o teu plano.' : 'Deixaste de partilhar o plano.'); }
      catch (err) { toast(/share_plan/.test(String(err && err.message)) ? 'Falta correr o supabase/schema.sql novo no Supabase.' : errText(err)); }
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
    case 'b2b': b2bOn = b.dataset.v === '1'; try { localStorage.setItem('fb-b2b', b2bOn ? '1' : '0'); } catch (e) {} schedule(); renderAjustes(); toast(b2bOn ? 'Jogos seguidos: o plano ajusta.' : 'Jogos seguidos: sem ajuste.'); break;
    case 'form-level': formLevel = b.dataset.level; try { localStorage.setItem('fb-form', formLevel); } catch (e) {} FB.setForm(+formLevel); schedule(); renderAjustes(); toast('Peso da forma: ' + FORM_LEVELS.find(x => x[0] === formLevel)[1] + '.'); break;
    case 'sm-add': smurfReadInputs(); S.smDraft.push({}); renderAjustes(); break;
    case 'sm-del': smurfReadInputs(); S.smDraft.splice(+b.dataset.i, 1); renderAjustes(); break;
    case 'del-tests': b.disabled = true; await deleteTestRuns(); break;
    case 'chain-import': b.disabled = true; await chainImport(id); break;
    case 'del-run': await deleteRun(curRun()); break;
    case 'paste-preview': {
      const items = parseList($('pasteText').value); S.pasteItems = items;
      const okN = items.filter(x => x.match).length;
      $('pasteOut').innerHTML = items.length ? '<ul class="ops">' + items.map(x => '<li>' + (x.match ? esc(x.match.name) + ' <span class="muted">(' + esc(x.match.team || '—') + ')</span> · ' + x.uses + ' uso' + (x.uses > 1 ? 's' : '') : '<span class="down">Não encontrei “' + esc(x.name) + '”</span>') + '</li>').join('') + '</ul>' +
        (okN ? '<button class="btn primary" type="button" data-action="paste-apply" style="width:100%;margin-top:8px">Adicionar ' + okN + ' jogador' + (okN > 1 ? 'es' : '') + '</button>' : '') : '<div class="small muted">Escreve pelo menos um jogador.</div>';
      break;
    }
    case 'paste-apply': { const items = (S.pasteItems || []).filter(x => x.match); items.forEach(x => { S.mine.roster[x.match.id] = Object.assign({ status: 'ok' }, S.mine.roster[x.match.id] || {}, { uses: x.uses }); }); closeSheet(); applyChainResults(); schedule(); saveMine(); toast(items.length + ' jogadores no plantel.'); break; }
    case 'copy-roster': {
      const others = S.runs.filter(x => x.id !== S.runId);
      openSheet('<h3>Copiar plantel</h3><div class="small muted">Copia os jogadores de outra run. Os usos voltam a 1; acerta-os depois.</div><div class="stack">' + others.map(x => '<button class="btn" type="button" data-action="copy-from" data-id="' + esc(x.id) + '">' + esc(x.name) + '</button>').join('') + '</div>');
      break;
    }
    case 'copy-from': {
      try {
        const row = await q(sb.from('user_runs').select('roster').eq('run_id', id).eq('user_id', S.session.user.id).maybeSingle());
        const ro = (row && row.roster) || {}; const n = Object.keys(ro).length;
        if (!n) { toast('Essa run não tem plantel teu.'); return; }
        Object.entries(ro).forEach(([pid, e]) => { S.mine.roster[pid] = Object.assign({}, e, { uses: 1, status: 'ok' }); });
        closeSheet(); schedule(); saveMine(); toast(n + ' jogadores copiados. Acerta os usos.');
      } catch (err) { toast(errText(err)); }
      break;
    }
    case 'group-refresh': b.disabled = true; try { await loadGroup(); applyChainResults(); schedule(); toast('Grupo atualizado.'); } catch (err) { toast(errText(err)); } b.disabled = false; break;
    case 'kick': {
      const p = S.group.profiles.find(x => x.user_id === id) || {};
      openSheet('<h3>Remover ' + esc(p.display_name || 'membro') + '?</h3><div class="small muted">Deixa de ver o grupo. Os dados dele ficam guardados e volta a entrar se usar o código de convite.</div><div class="btns"><button class="btn quiet" type="button" data-action="close-sheet">Cancelar</button><button class="btn primary" type="button" data-action="kick-yes" data-id="' + esc(id) + '">Remover</button></div>');
      break;
    }
    case 'kick-yes': closeSheet(); if (await adminWrite(sb.from('members').delete().eq('user_id', id), 'Membro removido.')) { await loadGroup(); renderAjustes(); } break;
    case 'set-active': {
      if (!(await adminWrite(sb.from('runs').update({ active: false }).neq('id', S.runId)))) return;
      if (await adminWrite(sb.from('runs').update({ active: true }).eq('id', S.runId), 'Run ativa para todos.')) { S.runs.forEach(r => { r.active = r.id === S.runId; }); renderAjustes(); }
      break;
    }
    case 'obj-add': { const day = S.days[+b.dataset.i]; if (!day) break; day.objectives = (day.objectives || []).concat([{ stat: 'reb', target: '' }]); renderAjustes(); toast('Escolhe a estatística e o alvo: guarda quando puseres o alvo.'); break; }
    case 'obj-del': {
      const i = +b.dataset.i, day = S.days[i]; if (!day) break;
      day.objectives = (day.objectives || []).filter(x => x && x.stat).filter((x, k) => k !== +b.dataset.k); schedule();
      await adminWrite(sb.from('run_days').update({ objectives: day.objectives.filter(x => +x.target > 0) }).eq('run_id', S.runId).eq('date', day.date), 'Estatística tirada do dia ' + (i + 1) + '.'); renderAjustes(); break;
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
  if (t.id === 'chainPick') { const run = curRun(); if (await adminWrite(sb.from('runs').update({ chain_run_id: t.value || null }).eq('id', run.id), t.value ? 'Run ligada à blockchain.' : 'Ligação removida.')) { run.chain_run_id = t.value || null; await loadGroup(); schedule(); } return; }
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
  try { boxTick(); } catch (e) { console.warn('boxTick', e); } // fichas finais: fecham os dias que acabaram
  const nd = nextDay(); if (!nd) return;
  try { ensureLive(); } catch (e) { console.warn('ensureLive', e); }
  if (liveOn(nd.date) || (S.multi && accounts().some(a => ((planOf(a.id).live || {})[nd.date] || {}).active))) { schedule(); if (Date.now() - (S.liveAt || 0) > 115e3) { S.liveAt = Date.now(); liveFetch(true).catch(e => { S.liveDiag = Object.assign({}, S.liveDiag, { at: Date.now(), err: String(e.message || e).slice(0, 60) }); }); } }
  if (S.tab === 'hoje' && gamesWindow(nd)) refreshBoard(nd.date);
  if (Date.now() - (S.oddsAt || 0) > 10 * 60e3) refreshOdds();
}, 60000);

// ---------- arranque ----------
(async function init() {
  staticTexts();
  try { if (history.state && history.state.fbSheet) history.replaceState(null, ''); } catch (e) {} // recarregou com uma folha aberta
  if (!sb) { showGate(brand() + '<div class="err">O site ainda não está ligado ao Supabase.</div><p class="small muted" style="margin:0">Põe o Project URL e a chave anon/publishable em <span class="kbd">docs/config.js</span>.</p>'); return; }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { S.session = null; } });
  try { await afterLogin(); } catch (e) { renderAuth('login', errText(e)); }
})();
