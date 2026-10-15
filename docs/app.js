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
const LIVE_STAT = { pts: 'points', reb: 'reboundsTotal', ast: 'assists', fg3: 'threePointersMade', stl: 'steals', blk: 'blocks' };

const configured = CFG.supabaseUrl && !/SEU-PROJETO/.test(CFG.supabaseUrl) && CFG.supabaseKey && !/COLOCA/.test(CFG.supabaseKey);
const sb = configured ? createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

const S = {
  session: null, role: null, profile: null,
  runs: [], runId: null, days: [], players: new Map(), odds: {}, chainRuns: [], chainGames: [],
  mine: { roster: {}, plan: {} }, mineLoaded: false,
  group: { profiles: [], summaries: [], members: [], chain: [] },
  tab: 'hoje', result: null, calcError: null, pendingUses: {}, filter: '', sheetBack: null,
  invite: null, lastSummary: '', loading: true,
};

// ---------- utilidades ----------
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o == null ? {} : o));
const f1 = n => (Math.round(n * 10) / 10).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f0 = n => Math.round(n).toLocaleString('pt-PT');
const pct = p => p < 0.005 ? '<1%' : p > 0.995 ? '>99%' : Math.round(p * 100) + '%';
const tone = p => p >= 0.65 ? 'good' : p >= 0.4 ? 'warn' : 'bad';
const dt = s => new Date(s + 'T12:00:00Z');
const dShort = s => { const d = dt(s); return d.getUTCDate() + ' ' + MO[d.getUTCMonth()]; };
const dWeek = s => WD[dt(s).getUTCDay()];
const hm = iso => { try { return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const ago = iso => { if (!iso) return 'nunca'; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); if (m < 2) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 36) return 'há ' + h + ' h'; return 'há ' + Math.round(h / 24) + ' dias'; };
const statShort = st => String(st).split('+').map(s => (STATS[s] || {}).short || s.toUpperCase()).join('+');
const statLabel = st => String(st).split('+').map(s => (STATS[s] || {}).label || s).join(' + ');
const objText = o => o ? o.target + '+ ' + statShort(o.stat) : 'Objetivo por definir';
const icoLock = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-label="Fixado"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const todayET = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
function norm(name) {
  return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[.'’`]/g, '').replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
}
function colorFor(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return 'hsl(' + h + ' 55% 45%)'; }
function initials(name) { const p = String(name || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function avatar(id, name) { return '<span class="avatar" style="background:' + colorFor(id) + '" aria-hidden="true">' + esc(initials(name)) + '</span>'; }

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2800);
}
function errText(e) {
  const m = String((e && (e.message || e.error_description)) || e || '');
  if (/Invalid login credentials/i.test(m)) return 'Email ou palavra-passe errados.';
  if (/already registered|already been registered/i.test(m)) return 'Já existe uma conta com este email. Usa "Entrar".';
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
    ? '<p style="margin:0">Para entrares no grupo precisas do código de convite.</p><form id="joinForm" class="stack"><label>Código de convite<input class="field" id="joinCode" autocomplete="off" autocapitalize="none" required></label>' + (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') + '<button class="btn primary" type="submit">Entrar no grupo</button></form>'
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
    '<label>Utilizador do Top Shot (opcional)<input class="field" id="pfTs" maxlength="40" autocapitalize="none" value="' + esc((S.profile || {}).topshot_username || '') + '"></label>' +
    (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') + '<button class="btn primary" type="submit">Continuar</button></form>');
}
async function submitProfile(nameEl, tsEl, flowEl) {
  const row = { user_id: S.session.user.id, display_name: nameEl.value.trim().slice(0, 40), topshot_username: (tsEl.value.trim() || null) };
  if (flowEl) { const fa = flowEl.value.trim(); if (fa && !/^0x[0-9a-fA-F]{16}$/.test(fa)) throw new Error('O endereço Flow tem o formato 0x seguido de 16 caracteres.'); row.flow_address = fa || null; }
  if (!row.display_name) throw new Error('Escreve o teu nome.');
  await q(sb.from('profiles').upsert(row, { onConflict: 'user_id' }));
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
  } catch (e) { console.error(e); toast(errText(e)); }
  S.loading = false; schedule();
}
async function loadShared() {
  const [runs, players, chainRuns] = await Promise.all([
    q(sb.from('runs').select('*').order('start_date', { ascending: false })),
    fetchAll('nba_players', 'id,name,team,avg,gp,updated_at'),
    q(sb.from('chain_runs').select('*').order('run_start', { ascending: false }).limit(40)),
  ]);
  S.runs = runs || [];
  S.players = new Map((players || []).map(p => [String(p.id), p]));
  S.chainRuns = chainRuns || [];
}
async function fetchAll(table, cols) {
  const out = []; const size = 1000;
  for (let from = 0; from < 20000; from += size) {
    const rows = await q(sb.from(table).select(cols).range(from, from + size - 1));
    out.push(...(rows || []));
    if (!rows || rows.length < size) break;
  }
  return out;
}
function pickRun() {
  let saved = null; try { saved = localStorage.getItem('fb-run'); } catch (e) {}
  if (saved && S.runs.some(r => r.id === saved)) return saved;
  const act = S.runs.find(r => r.active);
  return act ? act.id : (S.runs[0] ? S.runs[0].id : null);
}
async function loadRun(runId) {
  S.runId = runId; S.days = []; S.odds = {}; S.mine = { roster: {}, plan: {} }; S.mineLoaded = false; S.pendingUses = {}; S.lastSummary = '';
  S.group = { profiles: [], summaries: [], members: [], chain: [] }; S.chainGames = [];
  try { localStorage.setItem('fb-run', runId || ''); } catch (e) {}
  if (!runId) { schedule(); return; }
  const uid = S.session.user.id;
  const run = S.runs.find(r => r.id === runId);
  const [days, mine] = await Promise.all([
    q(sb.from('run_days').select('*').eq('run_id', runId).order('date')),
    q(sb.from('user_runs').select('*').eq('run_id', runId).eq('user_id', uid).maybeSingle()),
  ]);
  S.days = (days || []).map(d => ({ date: d.date, objectives: d.objectives || [], games: d.games || [], chain_game_id: d.chain_game_id }));
  S.mine = mine ? { roster: mine.roster || {}, plan: mine.plan || {} } : { roster: {}, plan: {} };
  S.mineSeen = mine ? Date.parse(mine.updated_at) : 0;
  S.mineLoaded = true;
  const dates = S.days.map(d => d.date);
  if (dates.length) {
    const odds = await q(sb.from('odds_days').select('*').gte('date', dates[0]).lte('date', dates[dates.length - 1]));
    (odds || []).forEach(o => { S.odds[o.date] = o; });
  }
  await loadGroup();
  applyChainResults();
  schedule();
}
async function loadGroup() {
  if (!S.runId) return;
  const run = S.runs.find(r => r.id === S.runId) || {};
  const [profiles, summaries, members, chain] = await Promise.all([
    q(sb.from('profiles').select('*')),
    q(sb.from('summaries').select('*').eq('run_id', S.runId)),
    q(sb.from('members').select('*')),
    run.chain_run_id ? q(sb.from('chain_results').select('*').eq('chain_run_id', run.chain_run_id)) : Promise.resolve([]),
  ]);
  S.group = { profiles: profiles || [], summaries: summaries || [], members: members || [], chain: chain || [] };
}

// Resultados lidos da blockchain entram sozinhos no teu plano (e descontam os usos)
function applyChainResults() {
  const uid = S.session.user.id;
  const mine = S.group.chain.filter(c => c.user_id === uid && c.date);
  if (!mine.length) return;
  const dates = new Set(S.days.map(d => d.date));
  const played = clone(S.mine.plan.played || {});
  const roster = S.mine.roster;
  const byName = new Map();
  Object.keys(roster).forEach(id => { const nm = norm(nameOf(id)); if (nm) byName.set(nm, id); });
  let changed = 0;
  mine.forEach(c => {
    if (!dates.has(c.date) || c.win == null) return;
    const res = c.win ? 'win' : 'loss';
    const cur = played[c.date];
    if (cur && cur.done) {
      if (cur.result !== res) { cur.result = res; cur.chain = true; changed++; }
      // lido antes de haver plantel: liga agora os nomes aos jogadores (os usos que puseste já são os restantes)
      if (cur.chain && !(cur.lineup || []).length) {
        const ids = (c.lineup || []).map(n => byName.get(norm(n))).filter(Boolean);
        if (ids.length) { cur.lineup = ids; changed++; }
      }
      return;
    }
    const finished = Date.now() - Date.parse(c.date + 'T12:00:00Z') > 30 * 3600e3;
    if (!finished && !c.win) return; // ainda a decorrer: espera pelo fim
    const ids = (c.lineup || []).map(n => byName.get(norm(n))).filter(Boolean);
    ids.forEach(id => { if (roster[id]) roster[id].uses = Math.max(0, (+roster[id].uses || 0) - 1); });
    played[c.date] = { done: true, result: res, lineup: ids, chain: true, points: c.points };
    changed++;
  });
  if (changed) {
    S.mine.plan.played = played;
    saveMine();
    toast(changed === 1 ? 'Um resultado lido da blockchain.' : changed + ' resultados lidos da blockchain.');
  }
}

// ---------- gravar ----------
let mineTimer = null, mineSaving = Promise.resolve();
function saveMine() {
  clearTimeout(mineTimer);
  mineTimer = setTimeout(() => {
    const row = { user_id: S.session.user.id, run_id: S.runId, roster: S.mine.roster, plan: S.mine.plan };
    mineSaving = mineSaving.then(() => q(sb.from('user_runs').upsert(row, { onConflict: 'user_id,run_id' }))).then(() => { S.mineSeen = Date.now() + 5000; }).catch(e => toast('Não guardou: ' + errText(e)));
  }, 600);
}
let sumTimer = null;
function publishSummary() {
  const r = S.result; if (!r || !S.runId) return;
  const v = view();
  const days = {};
  Object.entries((S.mine.plan || {}).played || {}).forEach(([d, p]) => { if (p && p.done) days[d] = p.result; });
  const row = {
    user_id: S.session.user.id, run_id: S.runId, wins: r.wins, losses: r.losses,
    expected: Math.round((r.wins + v.expected) * 100) / 100,
    prize_probs: r.prizes.map((p, i) => ({ wins: p.wins, p: Math.round(v.prizeProbs[i] * 1000) / 1000 })),
    days, next_p: v.days[0] ? Math.round(v.days[0].P * 1000) / 1000 : null,
  };
  const key = JSON.stringify(row);
  if (key === S.lastSummary) return;
  clearTimeout(sumTimer);
  sumTimer = setTimeout(async () => {
    try { await q(sb.from('summaries').upsert(row, { onConflict: 'user_id,run_id' })); S.lastSummary = key; }
    catch (e) { console.warn('resumo', e); }
  }, 2500);
}

// ---------- cálculo ----------
let scheduled = false;
function schedule() { if (scheduled) return; scheduled = true; setTimeout(() => { scheduled = false; compute(); render(); publishSummary(); }, 16); }
const nameOf = id => { const r = (S.mine.roster || {})[id]; const p = S.players.get(String(id)); return (r && r.name) || (p && p.name) || String(id); };
const lastName = id => { const parts = nameOf(id).split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : parts[0]; };
function engineInputs() {
  const run = S.runs.find(r => r.id === S.runId) || {};
  const players = {};
  Object.entries(S.mine.roster || {}).forEach(([id, e]) => {
    const c = S.players.get(String(id)) || {};
    const uses = S.pendingUses[id] != null ? S.pendingUses[id] : (+e.uses || 0);
    players[id] = { name: e.name || c.name || id, team: e.team || c.team || '', uses, status: e.status || 'ok', avg: e.avg || c.avg || null };
  });
  const odds = { days: {} };
  Object.entries(S.odds).forEach(([d, o]) => { odds.days[d] = { players: o.players || {}, source: o.source, updatedAt: o.updated_at }; });
  return { run: { name: run.name, prizes: run.prizes || [], days: S.days }, roster: { players }, odds, plan: S.mine.plan || {} };
}
function compute() {
  S.result = null; S.calcError = null;
  if (!S.runId || !S.mineLoaded) return;
  try { const x = engineInputs(); S.result = FB.planRun(x.run, x.roster, x.odds, x.plan); }
  catch (e) { console.error(e); S.calcError = 'Erro no cálculo: ' + (e && e.message); }
}
const curRun = () => S.runs.find(r => r.id === S.runId) || null;
const nextDay = () => { const r = S.result; return r && r.model.days.length ? r.model.days[0].day : null; };
const modeFor = date => (((S.mine.plan || {}).mode || {})[date]) || 'run';
const liveDoc = date => (((S.mine.plan || {}).live || {})[date]) || null;
const liveOn = date => { const l = liveDoc(date); return !!(l && l.active); };
function view() { const r = S.result; if (!r) return null; const nd = nextDay(); return nd && modeFor(nd.date) === 'allin' && r.allIn ? r.allIn : r.normal; }
function opp(team, day) {
  const g = FB.gameOf(day, team);
  if (!g) return 'sem jogo';
  return (g[0] === team ? '@ ' + g[1] : 'vs ' + g[0]) + (g[2] ? ' · ' + hm(g[2]) : '');
}
function lineupP(md, ids) {
  const idx = ids.map(id => S.result.model.pIndex.get(id)).filter(i => i != null);
  let P = 1;
  md.objs.forEach((o, k) => { let s = md.offset[k], v = 0; idx.forEach(i => { s += md.mu[i][k]; v += md.v[i][k]; }); P *= FB.probAtLeast(s, v, md.T[k]); });
  return md.objs.length ? P : 0;
}

// ---------- render ----------
// não redesenhar uma secção enquanto alguém está a escrever num campo dela
function typingIn(id) { const ae = document.activeElement; return !!(ae && $(id).contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)); }
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
  if (!run) { $('runName').textContent = 'Fastbreak'; $('runMeta').textContent = S.loading ? 'A carregar…' : 'Sem run'; return; }
  $('runName').textContent = run.name;
  const bits = [];
  if (run.fictitious) bits.push('<span class="chip">Teste</span>');
  if (S.days.length) bits.push('<span>' + dShort(S.days[0].date) + ' – ' + dShort(S.days[S.days.length - 1].date) + '</span>');
  if (r) { const nd = nextDay(); bits.push('<span>' + (nd ? 'Dia ' + (nd.idx + 1) + ' de ' + S.days.length : 'Terminada') + '</span><span>' + r.wins + 'V ' + r.losses + 'D</span>'); }
  $('runMeta').innerHTML = bits.join('<span aria-hidden="true">·</span>');
}
function empty(title, text, btn) { return '<div class="card empty"><h2>' + esc(title) + '</h2><p class="muted small" style="margin:0;max-width:44ch">' + esc(text) + '</p>' + (btn || '') + '</div>'; }
function guard(el, needRoster) {
  if (S.loading) { el.innerHTML = empty('A carregar', 'A ler a run e o teu plantel.'); return false; }
  if (!S.runId) {
    el.innerHTML = S.role === 'admin' ? empty('Ainda não há runs', 'Cria a primeira run em Ajustes, com as datas e os objetivos de cada dia.', '<button class="btn primary" type="button" data-action="goto" data-tab="ajustes">Criar run</button>')
      : empty('Ainda não há runs', 'O admin do grupo ainda não criou a run. Volta mais tarde.');
    return false;
  }
  if (S.calcError) { el.innerHTML = empty('Erro', S.calcError); return false; }
  if (needRoster && !Object.keys(S.mine.roster || {}).length) {
    el.innerHTML = empty('Falta o teu plantel', 'Junta os jogadores que tens e quantos usos tem cada um nesta run. O plano aparece logo a seguir.', '<button class="btn primary" type="button" data-action="goto" data-tab="plantel">Montar plantel</button>');
    return false;
  }
  return !!S.result;
}

// ---- Hoje ----
function renderHoje() {
  const el = $('tab-hoje');
  if (!guard(el, true)) return;
  const r = S.result, v = view(), nd = nextDay();
  if (!nd) { el.innerHTML = empty('Run terminada', 'Acabaste com ' + r.wins + ' vitórias em ' + r.playedCount + ' dias.'); return; }
  const d = v.days[0], md = r.model.days[0], o = (nd.objectives || [])[0];
  const live = liveOn(nd.date), t = d.totals[0];
  const html = [];
  const tips = (nd.games || []).map(g => g[2]).filter(Boolean).sort();
  const right = live ? '<span class="pill jogo">Jogo a jogo</span>' : tips.length ? '<span class="small muted">1.º jogo ' + hm(tips[0]) + '</span>' : '';
  let barHtml = '';
  if (t) {
    const max = Math.max(t.target * 1.2, t.mu + t.sd);
    const kw = Math.min(100, t.known / max * 100), fw = Math.min(100 - kw, (t.mu - t.known) / max * 100);
    barHtml = '<div class="bar" aria-hidden="true"><i class="k" style="width:' + kw.toFixed(1) + '%"></i><i class="f" style="left:' + kw.toFixed(1) + '%;width:' + Math.max(0, fw).toFixed(1) + '%"></i><i class="t" style="left:' + Math.min(99, t.target / max * 100).toFixed(1) + '%"></i></div>' +
      '<div class="bar-cap">' + (live && t.known ? '<span>Feito <b class="num">' + f0(t.known) + '</b> · faltam <b class="num">' + f0(Math.max(0, t.target - t.known)) + '</b></span><span>final ≈ <b class="num">' + f1(t.mu) + '</b></span>'
        : '<span>Projeção <b class="num">' + f1(t.mu) + '</b> <span class="num">± ' + f1(t.sd) + '</span></span><span>alvo <b class="num">' + t.target + '</b></span>') + '</div>';
  }
  html.push('<div class="card hero"><div class="hero-top"><span class="eyebrow">Dia ' + (nd.idx + 1) + ' · ' + dWeek(nd.date) + ', ' + dShort(nd.date) + '</span>' + right + '</div>' +
    '<div class="score"><div class="goal">' + (o ? o.target + '<small>' + esc(statShort(o.stat)) + '</small>' : '<small>Objetivo por definir</small>') + '</div>' +
    (d.noObjective ? '' : '<div class="pbig num c-' + tone(d.P) + '">' + pct(d.P) + '<span>vitória</span></div>') + '</div>' + barHtml +
    '<div class="seg" role="group" aria-label="Estratégia para hoje"><button type="button" data-action="mode" data-mode="run" aria-pressed="' + (modeFor(nd.date) !== 'allin') + '">Plano da run</button><button type="button" data-action="mode" data-mode="allin" aria-pressed="' + (modeFor(nd.date) === 'allin') + '">Tudo pelo dia</button></div>' +
    impactHtml(r) + '</div>');
  if (d.noObjective) html.push('<div class="note info">' + (S.role === 'admin' ? 'Este dia ainda não tem objetivo. Define-o em Ajustes.' : 'Este dia ainda não tem objetivo. O admin do grupo ainda não o definiu.') + '</div>');
  else if (!(nd.games || []).length) html.push('<div class="note info">Os jogos deste dia ainda não foram carregados do calendário NBA.</div>');
  if (r.normal.conflicts.length) html.push('<div class="note">Fixaste jogadores mais vezes do que os usos que têm: ' + r.normal.conflicts.map(c => esc(nameOf(c.player)) + ' (' + c.used + ' de ' + c.uses + ')').join(', ') + '.</div>');
  if (d.badLocks && d.badLocks.length) html.push('<div class="note">Sem jogo hoje, por isso não entram: ' + d.badLocks.map(id => esc(nameOf(id))).join(', ') + '.</div>');
  if (live && d.live && (d.live.out.length || d.live.in.length)) {
    const pSub = lineupP(md, d.live.submitted), pNew = d.P, pairs = [];
    for (let i = 0; i < Math.max(d.live.out.length, d.live.in.length); i++) pairs.push('<li>' + (d.live.out[i] ? 'Sai <b>' + esc(nameOf(d.live.out[i])) + '</b>' : '') + (d.live.out[i] && d.live.in[i] ? ' → ' : '') + (d.live.in[i] ? 'entra <b>' + esc(nameOf(d.live.in[i])) + '</b>' : '') + '</li>');
    html.push('<div class="card swap"><h3>Troca recomendada</h3><ul>' + pairs.join('') + '</ul><div class="small muted">Vitória hoje ' + pct(pSub) + ' → <b>' + pct(pNew) + '</b>' + (pNew + 0.005 < pSub ? ' · perde um pouco hoje para guardar usos para a run' : '') + '</div><button class="btn primary" type="button" data-action="swap-done">Fiz a troca</button></div>');
  }
  const locks = new Set((((S.mine.plan || {}).locks || {})[nd.date]) || []);
  const lp = live ? ((liveDoc(nd.date) || {}).players || {}) : {};
  const rows = d.lineup.map(id => {
    const pi = r.model.pIndex.get(id), p = r.model.players[pi], info = md.info[pi][0];
    let sub, val = f1(info.mu);
    if (live) {
      const st = info.liveState, sb2 = d.live.submitted.includes(id);
      if (st === 'fim') { sub = '<span class="pill fim">Fim</span> ' + esc(p.team) + ' ' + esc(opp(p.team, nd)); val = f0(info.known); }
      else if (st === 'jogo') { sub = '<span class="pill jogo">' + (info.q ? QLABEL[info.q] : 'Em jogo') + '</span> ' + f0(info.known) + ' até agora'; val = f1(info.known + info.muLeft); }
      else if (st === 'jogo?') sub = '<span class="pill jogo">Em jogo</span> toca para pôr o valor';
      else sub = (sb2 ? '' : '<span class="pill prov">Novo</span> ') + esc(p.team) + ' ' + esc(opp(p.team, nd));
    } else {
      const src = info.src === 'odds' ? 'linha ' + f1(info.line) : info.src === 'media' ? 'média' : info.src === 'misto' ? 'odds + média' : 'sem dados';
      sub = esc(p.team) + ' ' + esc(opp(p.team, nd)) + ' · ' + src;
    }
    const stp = info.status !== 'ok' ? '<span class="pill ' + info.status + '">' + esc(STATUS[info.status].label) + '</span>' : '';
    return '<li><button class="row" type="button" data-action="player" data-id="' + esc(id) + '" data-date="' + nd.date + '"><div style="min-width:0"><div class="pn">' + (locks.has(id) ? icoLock : '') + '<span class="nm">' + esc(p.name) + '</span>' + stp + '</div><div class="ps">' + sub + '</div></div><div class="pv"><div class="v num">' + val + '</div><div class="u">' + esc(o ? statShort(o.stat) : '') + '</div></div></button></li>';
  }).join('');
  const allFinal = live && d.live.submitted.length && d.live.submitted.every(id => ((lp[id] || {}).state) === 'fim');
  html.push('<div class="card"><div class="list-head"><h2>Lineup</h2><button class="switch" type="button" data-action="live-toggle" aria-pressed="' + live + '"><i></i>Jogo a jogo</button></div>' +
    (d.lineup.length ? '<ul class="list">' + rows + '</ul>' : '<div class="row muted small">Nenhum jogador do teu plantel joga hoje.</div>') +
    (allFinal && t ? '<div class="row small">Total final <b class="num" style="margin-left:4px">' + f0(t.known) + '</b> de ' + t.target + ' → ' + (t.known >= t.target ? '<b class="up">ganhaste</b>' : '<b class="down">perdeste</b>') + '</div>' : '') +
    (live ? '<div class="foot" style="grid-template-columns:1fr"><button class="btn" type="button" data-action="live-fetch">Atualizar estatísticas ao vivo</button></div>' : '') +
    '<div class="foot"><button class="btn" type="button" data-action="day" data-date="' + nd.date + '">Ajustar</button><button class="btn quiet" type="button" data-action="result-sheet" data-date="' + nd.date + '">Fechar o dia</button></div></div>');
  if (!live && tips.length) html.push('<p class="small muted" style="margin:0 4px">O lineup fecha jogo a jogo. Liga <b>Jogo a jogo</b> quando o primeiro jogo começar: a app prende quem já jogou e sugere trocas para os jogos que faltam.</p>');
  el.innerHTML = html.join('');
}
function impactHtml(r) {
  const n0 = r.normal.days[0], a0 = r.allIn ? r.allIn.days[0] : n0;
  const same = JSON.stringify([...n0.lineup].sort()) === JSON.stringify([...a0.lineup].sort());
  if (same) return '<div class="impact">O plano da run já usa o lineup mais forte hoje. Ir com tudo não custa nada.</div>';
  const arrow = (x, y, f) => { const up = y > x + 1e-9; return f(x) + ' → <span class="' + (up ? 'up' : y < x - 1e-9 ? 'down' : '') + '">' + f(y) + '</span>'; };
  const lines = ['<div><b>Tudo pelo dia:</b> vitória hoje ' + arrow(n0.P, a0.P, pct) + '</div>'];
  if (r.prizes.length) lines.push('<div>Run: ' + r.prizes.map((p, i) => p.wins + ' vitórias ' + arrow(r.normal.prizeProbs[i], r.allIn.prizeProbs[i], pct)).join(' · ') + '</div>');
  else lines.push('<div>Run: ' + arrow(r.normal.expected - n0.P, r.allIn.expected - a0.P, f1) + ' vitórias esperadas nos outros dias</div>');
  return '<div class="impact">' + lines.join('') + '</div>';
}

// ---- Run ----
function renderRun() {
  const el = $('tab-run');
  if (!guard(el, true)) return;
  const r = S.result, v = view(), days = S.days, html = [];
  if (r.prizes.length) {
    html.push('<div class="card"><div class="list-head"><h2>Prémios por vitórias</h2><span class="small muted">' + r.wins + ' de ' + days.length + ' · esperadas ' + f1(r.wins + v.expected) + '</span></div>' +
      r.prizes.map((p, i) => { const x = v.prizeProbs[i]; return '<div class="prize"><div class="pl"><b>' + p.wins + ' vitórias</b><span>' + esc(p.label || ('valor ' + p.value)) + '</span></div><div class="pb"><i class="bg-' + tone(x) + '" style="width:' + Math.max(2, x * 100).toFixed(1) + '%"></i></div><div class="pp num c-' + tone(x) + '">' + pct(x) + '</div></div>'; }).join('') + '<div style="height:6px"></div></div>');
  } else {
    html.push('<div class="card hero"><div class="label">Vitórias esperadas no fim</div><div class="goal">' + f1(r.wins + v.expected) + '<small>de ' + days.length + '</small></div><div class="small muted">' + (S.role === 'admin' ? 'Define em Ajustes quantas vitórias dão prémio' : 'Quando o admin definir os patamares de prémio') + ' e o plano passa a lutar por esses patamares.</div></div>');
  }
  const byDate = new Map(v.days.map(d => [d.date, d])), nd = nextDay();
  const rows = days.map((day, i) => {
    const pl = (((S.mine.plan || {}).played || {})[day.date]) || null, o = (day.objectives || [])[0];
    if (pl && pl.done) return '<li><button class="drow" type="button" data-action="day" data-date="' + day.date + '"><span class="dn">' + (i + 1) + '<small>' + dWeek(day.date) + '</small></span><span style="min-width:0"><span class="d1"><b>' + esc(objText(o)) + '</b><span class="small muted">' + dShort(day.date) + (pl.chain ? ' · blockchain' : '') + '</span></span><span class="d2" style="display:block">' + ((pl.lineup || []).map(id => esc(lastName(id))).join(' · ') || '—') + '</span></span><span class="pchip ' + (pl.result === 'win' ? 'p-good' : 'p-bad') + '">' + (pl.result === 'win' ? 'V' : 'D') + '</span></button></li>';
    const d = byDate.get(day.date); if (!d) return '';
    return '<li class="' + (nd && nd.date === day.date ? 'is-next' : '') + '"><button class="drow" type="button" data-action="day" data-date="' + day.date + '"><span class="dn">' + (i + 1) + '<small>' + dWeek(day.date) + '</small></span><span style="min-width:0"><span class="d1"><b>' + esc(objText(o)) + '</b><span class="small muted">' + dShort(day.date) + ' · ' + (day.games || []).length + ' jogos' + (d.hasOdds ? ' · odds' : '') + '</span></span><span class="d2" style="display:block">' + (d.lineup.length ? d.lineup.map(id => esc(lastName(id))).join(' · ') : 'sem jogadores') + '</span></span>' +
      (d.noObjective ? '<span class="pchip p-done">—</span>' : '<span class="pchip p-' + tone(d.P) + ' num">' + pct(d.P) + '</span>') + '</button></li>';
  }).join('');
  html.push('<div class="card"><div class="list-head"><h2>Dias</h2><span class="small muted">toca para ver e ajustar</span></div><ul class="list">' + rows + '</ul></div>');
  const hard = v.days.filter(d => !d.noObjective && d.P < 0.15 && d.lineup.length);
  if (hard.length) html.push('<p class="small muted" style="margin:0 4px">Dia' + (hard.length > 1 ? 's ' : ' ') + hard.map(d => d.idx + 1).join(', ') + ': muito difícil com o teu plantel. O plano põe lá jogadores com usos a sobrar e guarda as estrelas para onde fazem diferença.</p>');
  el.innerHTML = html.join('');
}

// ---- Plantel ----
function renderPlantel() {
  const el = $('tab-plantel');
  if (!guard(el, false)) return;
  const ids = Object.keys(S.mine.roster || {});
  if (!$('rosterFilter')) {
    el.innerHTML = '<div class="toolbar"><input class="field" id="rosterFilter" type="search" placeholder="Procurar no plantel" value="' + esc(S.filter) + '" aria-label="Procurar no plantel"><button class="btn" type="button" data-action="add-player">Adicionar</button></div><div id="plBody" class="stack"></div>';
  }
  const body = $('plBody');
  if (!ids.length) {
    const prev = S.runs.filter(x => x.id !== S.runId);
    body.innerHTML = empty('Plantel vazio', 'Adiciona os jogadores dos teus Moments e os usos de cada um nesta run. Podes colar uma lista inteira.',
      '<div class="btns" style="width:100%;max-width:340px"><button class="btn primary" type="button" data-action="add-player">Adicionar</button><button class="btn" type="button" data-action="paste-sheet">Colar lista</button></div>' +
      (prev.length ? '<button class="btn link" type="button" data-action="copy-roster">Copiar o plantel de outra run</button>' : ''));
    return;
  }
  const r = S.result, v = view(), days = S.days, nd = nextDay();
  const planned = {};
  v.days.forEach(d => d.lineup.forEach(id => { (planned[id] = planned[id] || new Set()).add(d.date); }));
  const played = (S.mine.plan || {}).played || {};
  const qq = norm(S.filter);
  const list = r.model.players.filter(p => !qq || norm(p.name).includes(qq) || p.team.toLowerCase().includes(qq));
  const cols = 'minmax(72px,1fr) repeat(' + days.length + ', 20px) 34px';
  const head = '<div class="mx-row head" style="grid-template-columns:' + cols + '"><span style="text-align:left">Jogador</span>' + days.map((d, i) => '<span class="' + (nd && nd.date === d.date ? 'nx' : '') + '">' + (i + 1) + '</span>').join('') + '<span style="text-align:right">Usos</span></div>';
  const rows = list.map(p => {
    const set = planned[p.id] || new Set();
    const cells = days.map(day => {
      const nx = nd && nd.date === day.date ? ' nx' : '', pl = played[day.date];
      if (pl && pl.done) return '<span class="cell' + nx + '">' + ((pl.lineup || []).includes(p.id) ? '<i class="dot used"></i>' : '') + '</span>';
      if (set.has(day.date)) return '<span class="cell' + nx + '"><i class="dot on"></i></span>';
      return '<span class="cell' + nx + '">' + (FB.teamsOn(day).has(p.team) ? '<i class="dot off"></i>' : '') + '</span>';
    }).join('');
    const n = set.size, u = p.uses || 0;
    const st = p.status && p.status !== 'ok' ? '<span class="pill ' + p.status + '">' + esc(STATUS[p.status].label.slice(0, 3)) + '</span>' : '';
    return '<button class="mx-row" type="button" data-action="pl-sheet" data-id="' + esc(p.id) + '" style="grid-template-columns:' + cols + '"><span class="mx-name"><span style="overflow:hidden;text-overflow:ellipsis">' + esc(lastName(p.id)) + '</span>' + st + '</span>' + cells + '<span class="mx-uses num' + (n >= u && u > 0 ? ' full' : '') + '">' + n + '/' + u + '</span></button>';
  }).join('');
  const totalU = r.model.uses.reduce((a, b) => a + b, 0), totalP = Object.values(v.usage).reduce((a, b) => a + b, 0);
  body.innerHTML = '<div class="card"><div class="list-head"><h2>Quem joga quando</h2><span class="small muted">plano usa ' + totalP + ' de ' + totalU + ' usos</span></div>' +
    '<div class="mx-wrap"><div class="mx">' + head + (rows || '<div class="mx-row muted small">Nenhum jogador encontrado.</div>') + '</div></div>' +
    '<div class="legend"><span><i class="dot on"></i>no plano</span><span><i class="dot off"></i>tem jogo</span><span><i class="dot used"></i>já usado</span><span>usos = no plano / restantes</span></div></div>' +
    '<div class="btns"><button class="btn" type="button" data-action="paste-sheet">Colar lista</button><button class="btn" type="button" data-action="add-player">Adicionar jogador</button></div>' +
    '<p class="small muted" style="margin:0 4px">Toca num jogador para mudar os usos ou o estado.</p>';
}

// ---- Grupo ----
function renderGrupo() {
  const el = $('tab-grupo');
  if (S.loading) { el.innerHTML = empty('A carregar', 'A ler o grupo.'); return; }
  if (!S.runId) { el.innerHTML = empty('Ainda não há runs', 'A classificação aparece quando houver uma run.'); return; }
  const memberIds = new Set(S.group.members.map(m => m.user_id));
  const profs = new Map(S.group.profiles.map(p => [p.user_id, p]));
  const sums = new Map(S.group.summaries.map(s => [s.user_id, s]));
  const chainBy = {};
  S.group.chain.forEach(c => { (chainBy[c.user_id] = chainBy[c.user_id] || {})[c.date] = c; });
  const nd = nextDay();
  const people = [...memberIds].map(uid => {
    const p = profs.get(uid) || {}, s = sums.get(uid) || null, ch = chainBy[uid] || {};
    const daysRes = Object.assign({}, (s && s.days) || {});
    Object.values(ch).forEach(c => { if (c.win != null && c.date) daysRes[c.date] = c.win ? 'win' : 'loss'; });
    const wins = Object.values(daysRes).filter(x => x === 'win').length, losses = Object.values(daysRes).filter(x => x === 'loss').length;
    return { uid, name: p.display_name || 'Sem nome', ts: p.topshot_username, s, daysRes, wins, losses, chain: Object.keys(ch).length > 0, exp: s ? +s.expected : null };
  }).sort((a, b) => (b.wins - a.wins) || ((b.exp || 0) - (a.exp || 0)) || a.name.localeCompare(b.name));
  const run = curRun() || {};
  const rows = people.map((x, i) => {
    const strip = S.days.map(d => { const r = x.daysRes[d.date]; return '<i class="' + (r === 'win' ? 'w' : r === 'loss' ? 'l' : (nd && nd.date === d.date ? 'n' : '')) + '" title="' + dShort(d.date) + '"></i>'; }).join('');
    const pp = x.s && Array.isArray(x.s.prize_probs) && x.s.prize_probs.length ? x.s.prize_probs.map(z => z.wins + 'V ' + pct(+z.p)).join(' · ') : '';
    return '<li><button class="grp-row" type="button" data-action="friend" data-id="' + esc(x.uid) + '"><span class="grp-rank">' + (i + 1) + '</span>' + avatar(x.uid, x.name) +
      '<span style="min-width:0"><span class="pn"><span class="nm">' + esc(x.name) + '</span>' + (x.uid === S.session.user.id ? '<span class="badge">tu</span>' : '') + (x.chain ? '<span class="badge">blockchain</span>' : '') + '</span>' +
      '<span class="ps" style="display:block">' + (x.s ? (pp || ('esperadas ' + f1(x.exp || 0))) + (x.s.next_p != null && nd ? ' · hoje ' + pct(+x.s.next_p) : '') : 'ainda não abriu esta run') + '</span><span class="strip">' + strip + '</span></span>' +
      '<span class="grp-wl num">' + x.wins + '–' + x.losses + '<small>' + (x.exp != null ? '≈ ' + f1(x.exp) : '') + '</small></span></button></li>';
  }).join('');
  el.innerHTML = '<div class="card"><div class="list-head"><h2>Classificação</h2><span class="small muted">' + esc(run.name || '') + '</span></div><ul class="list">' + (rows || '<li class="row muted small">Ainda não há ninguém no grupo.</li>') + '</ul></div>' +
    '<p class="small muted" style="margin:0 4px">Vitórias e derrotas vêm da blockchain quando o utilizador do Top Shot está no perfil e a run está ligada; senão, do que cada um marca. ≈ é o número de vitórias esperado no fim da run.' + (S.role === 'admin' ? ' Convida amigos em Ajustes.' : '') + '</p>' +
    '<button class="btn" type="button" data-action="group-refresh">Atualizar</button>';
}
function friendSheet(uid) {
  const p = S.group.profiles.find(x => x.user_id === uid) || {};
  const s = S.group.summaries.find(x => x.user_id === uid) || {};
  const ch = {}; S.group.chain.filter(c => c.user_id === uid).forEach(c => { ch[c.date] = c; });
  const rows = S.days.map((d, i) => {
    const c = ch[d.date], r = c && c.win != null ? (c.win ? 'win' : 'loss') : ((s.days || {})[d.date] || null);
    const lineup = c && Array.isArray(c.lineup) && c.lineup.length ? c.lineup.join(' · ') : '';
    return '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">Dia ' + (i + 1) + ' · ' + esc(objText((d.objectives || [])[0])) + '</span></div><div class="ps">' + dShort(d.date) + (c && c.points != null ? ' · ' + f0(+c.points) + ' feitos' : '') + (lineup ? ' · ' + esc(lineup) : '') + '</div></div>' +
      (r ? '<span class="pchip ' + (r === 'win' ? 'p-good' : 'p-bad') + '">' + (r === 'win' ? 'V' : 'D') + '</span>' : '<span class="pchip p-done">—</span>') + '</li>';
  }).join('');
  openSheet('<h3>' + esc(p.display_name || 'Sem nome') + '</h3><div class="small muted">' + (p.topshot_username ? 'Top Shot: ' + esc(p.topshot_username) : 'Sem utilizador do Top Shot no perfil') + '</div>' +
    '<ul class="list card">' + rows + '</ul>' + closeRow());
}

// ---- Ajustes ----
function renderAjustes() {
  const el = $('tab-ajustes'), me = S.profile || {}, run = curRun(), html = [];
  html.push('<div class="card panel"><h2>Perfil</h2><form id="pfForm" class="stack">' +
    '<label class="small muted">Nome que o grupo vê<input class="field" id="pfName2" maxlength="40" value="' + esc(me.display_name || '') + '"></label>' +
    '<label class="small muted">Utilizador do Top Shot<input class="field" id="pfTs2" maxlength="40" autocapitalize="none" value="' + esc(me.topshot_username || '') + '"></label>' +
    '<label class="small muted">Endereço Flow (opcional; preenchido sozinho a partir do utilizador)<input class="field" id="pfFlow2" maxlength="18" autocapitalize="none" placeholder="0x…" value="' + esc(me.flow_address || '') + '"></label>' +
    '<div class="btns"><button class="btn quiet" type="button" data-action="logout">Terminar sessão</button><button class="btn primary" type="submit">Guardar perfil</button></div></form></div>');
  if (S.runs.length) {
    html.push('<div class="card panel"><h2>Run</h2><select class="field" id="runPick" aria-label="Escolher run">' + S.runs.map(x => '<option value="' + esc(x.id) + '"' + (x.id === S.runId ? ' selected' : '') + '>' + esc(x.name) + ' · ' + dShort(x.start_date) + (x.active ? ' (ativa)' : '') + '</option>').join('') + '</select></div>');
  }
  if (S.role === 'admin') html.push(adminHtml(run));
  html.push(dataHtml());
  el.innerHTML = html.join('');
  if (S.role === 'admin' && S.invite == null) { sb.rpc('get_invite_code').then(({ data }) => { S.invite = data || ''; if (S.tab === 'ajustes' && !typingIn('tab-ajustes')) renderAjustes(); }); }
}
function adminHtml(run) {
  const out = [];
  const site = location.origin + location.pathname;
  out.push('<div class="card panel"><h2>Convidar amigos</h2><div class="small muted">Manda-lhes o link do site e o código. Criam conta com email e palavra-passe e entram com o código.</div>' +
    '<div class="status-line"><span>Site</span><span class="kbd">' + esc(site) + '</span></div>' +
    '<div class="status-line"><span>Código atual</span><span class="kbd">' + (S.invite == null ? '…' : S.invite ? esc(S.invite) : 'nenhum') + '</span></div>' +
    '<form id="inviteForm" class="toolbar"><input class="field" id="invCode" placeholder="Novo código (mín. 4)" autocomplete="off"><button class="btn" type="submit">Mudar</button></form></div>');
  const members = S.group.members.map(m => { const p = S.group.profiles.find(x => x.user_id === m.user_id) || {}; return { m, p }; });
  if (members.length) out.push('<div class="card"><div class="list-head"><h2>Membros</h2><span class="small muted">' + members.length + '</span></div><ul class="list">' + members.map(({ m, p }) => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.display_name || 'Sem nome') + '</span>' + (m.role === 'admin' ? '<span class="badge">admin</span>' : '') + '</div><div class="ps">' + esc(p.topshot_username || 'sem utilizador Top Shot') + '</div></div>' + (m.user_id !== S.session.user.id ? '<button class="btn small quiet" type="button" data-action="kick" data-id="' + esc(m.user_id) + '">Remover</button>' : '<span></span>') + '</li>').join('') + '</ul></div>');
  out.push('<div class="card panel"><h2>Nova run</h2><form id="newRunForm" class="stack"><input class="field" id="nrName" placeholder="Nome (ex.: Run 1 · Classic)" maxlength="60" required>' +
    '<div class="grid2"><label class="small muted">Primeiro dia<input class="field" id="nrStart" type="date" required></label><label class="small muted">Número de dias<input class="field num" id="nrDays" type="number" min="1" max="31" value="11" required></label></div>' +
    '<button class="btn" type="submit">Criar run</button></form><div class="small muted">Os jogos de cada dia chegam do calendário NBA sozinhos. Datas na hora dos EUA, como no Top Shot.</div></div>');
  if (run) {
    const prizes = run.prizes || [];
    out.push('<div class="card panel"><h2>' + esc(run.name) + '</h2>' +
      (run.active ? '<div class="small">Esta é a run ativa: é a que abre por defeito para todos.</div>' : '<button class="btn" type="button" data-action="set-active">Tornar a run ativa</button>') +
      '<div class="label">Prémios por vitórias</div><div class="small muted">Quantas vitórias dão prémio e quanto vale cada um (só conta a proporção).</div>' +
      prizes.map((p, i) => '<div class="prow-edit"><label>Vitórias<input class="field num" id="pz-w-' + i + '" type="number" min="1" max="31" inputmode="numeric" value="' + esc(p.wins) + '" data-action="pz-w" data-i="' + i + '"></label><label>Valor<input class="field num" id="pz-v-' + i + '" type="number" min="0" inputmode="decimal" value="' + esc(p.value) + '" data-action="pz-v" data-i="' + i + '"></label><button class="btn small quiet" type="button" data-action="pz-del" data-i="' + i + '" aria-label="Apagar patamar" style="height:42px">×</button></div>').join('') +
      '<button class="btn" type="button" data-action="pz-add">Adicionar patamar</button>' +
      '<div class="label">Objetivos</div>' +
      S.days.map((day, i) => {
        const o = (day.objectives || [])[0] || { stat: 'pts', target: '' };
        return '<div class="objrow"><div><div class="label">Dia ' + (i + 1) + '</div><div class="small">' + dWeek(day.date) + ', ' + dShort(day.date) + '</div></div><select class="field" id="obj-stat-' + i + '" data-action="obj-stat" data-i="' + i + '" aria-label="Estatística do dia ' + (i + 1) + '">' +
          Object.keys(STATS).map(k => '<option value="' + k + '"' + (o.stat === k ? ' selected' : '') + '>' + STATS[k].label + '</option>').join('') + (STATS[o.stat] ? '' : '<option value="' + esc(o.stat) + '" selected>' + esc(statLabel(o.stat)) + '</option>') +
          '</select><input class="field num" id="obj-target-' + i + '" data-action="obj-target" data-i="' + i + '" type="number" inputmode="numeric" min="1" value="' + esc(o.target) + '" aria-label="Alvo do dia ' + (i + 1) + '"></div>';
      }).join('') +
      '<div class="label">Blockchain</div><div class="small muted">Liga esta run à run do Top Shot para os objetivos e os resultados de todos entrarem sozinhos.</div>' +
      '<select class="field" id="chainPick" aria-label="Run na blockchain"><option value="">Não ligada</option>' + S.chainRuns.map(c => '<option value="' + esc(c.id) + '"' + (c.id === run.chain_run_id ? ' selected' : '') + '>' + esc(c.name || c.id) + (c.run_start ? ' · ' + new Date(c.run_start * 1000).toISOString().slice(0, 10) : '') + '</option>').join('') + '</select>' +
      (S.chainRuns.length ? '' : '<div class="small muted">Ainda não há runs lidas da blockchain. Aparecem depois da tarefa automática correr.</div>') + '</div>');
  }
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
  lines.push(['Blockchain', S.chainRuns.length ? S.chainRuns.length + ' runs lidas' : 'à espera da primeira leitura']);
  return '<div class="card panel"><h2>Dados</h2>' + lines.map(([a, b]) => '<div class="status-line"><span>' + esc(a) + '</span><span class="muted">' + esc(b) + '</span></div>').join('') +
    '<div class="small muted">Atualizados sozinhos: calendário e médias de manhã, odds à tarde e ao início da noite (hora de Lisboa), blockchain de 30 em 30 minutos. Sem odds, o plano usa as médias da época.</div></div>';
}

// ---------- folhas ----------
function openSheet(html, back) { S.sheetBack = back || null; $('sheetPanel').innerHTML = '<div class="grab" aria-hidden="true"></div>' + html; $('sheet').hidden = false; $('sheetPanel').scrollTop = 0; }
function closeSheet() { $('sheet').hidden = true; $('sheetPanel').innerHTML = ''; S.sheetBack = null; }
const closeRow = back => '<div class="btns">' + (back ? '<button class="btn quiet" type="button" data-action="sheet-back">Voltar</button>' : '<span></span>') + '<button class="btn quiet" type="button" data-action="close-sheet">Fechar</button></div>';
function dayInfo(date) { const r = S.result; const md = r && r.model.days.find(x => x.day.date === date); const d = md && view().days.find(x => x.date === date); return { md, d }; }

function daySheet(date) {
  const i = S.days.findIndex(x => x.date === date); if (i < 0) return;
  const day = S.days[i], o = (day.objectives || [])[0];
  const pl = (((S.mine.plan || {}).played || {})[date]) || null;
  if (pl && pl.done) {
    openSheet('<h3>Dia ' + (i + 1) + ' · ' + esc(objText(o)) + '</h3><div class="small muted">' + dWeek(date) + ', ' + dShort(date) + ' · ' + (pl.result === 'win' ? 'Vitória' : 'Derrota') + (pl.points != null ? ' · ' + f0(pl.points) + ' feitos' : '') + (pl.chain ? ' · lido da blockchain' : '') + '</div>' +
      '<ul class="list card">' + ((pl.lineup || []).map(id => '<li class="row"><span>' + esc(nameOf(id)) + '</span></li>').join('') || '<li class="row muted small">Sem jogadores registados.</li>') + '</ul>' +
      '<div class="small muted">Os usos destes jogadores já foram descontados.</div>' + (pl.chain ? '' : '<button class="btn" type="button" data-action="undo-result" data-date="' + date + '">Desfazer resultado</button>') + closeRow());
    return;
  }
  const { md, d } = dayInfo(date); if (!md || !d) return;
  const r = S.result, v = view();
  const locks = new Set((((S.mine.plan || {}).locks || {})[date]) || []), bans = (((S.mine.plan || {}).bans || {})[date]) || [];
  const inLine = d.lineup.map(id => { const pi = r.model.pIndex.get(id), info = md.info[pi][0], p = r.model.players[pi]; return '<li><button class="row" type="button" data-action="player" data-id="' + esc(id) + '" data-date="' + date + '" data-back="day"><div style="min-width:0"><div class="pn">' + (locks.has(id) ? icoLock : '') + '<span class="nm">' + esc(p.name) + '</span></div><div class="ps">' + esc(p.team) + ' ' + esc(opp(p.team, day)) + '</div></div><div class="pv"><div class="v num">' + f1(info.mu) + '</div><div class="u">' + esc(o ? statShort(o.stat) : '') + '</div></div></button></li>'; }).join('');
  const others = md.elig.filter(pi => !d.lineup.includes(r.model.players[pi].id)).map(pi => ({ p: r.model.players[pi], mu: md.info[pi][0].mu })).sort((a, b) => b.mu - a.mu);
  const otherRows = others.map(({ p, mu }) => { const left = (p.uses || 0) - (v.usage[p.id] || 0); return '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span></div><div class="ps num">' + f1(mu) + ' ' + esc(o ? statShort(o.stat) : '') + ' · ' + (left > 0 ? left + ' uso' + (left > 1 ? 's' : '') + ' livre' + (left > 1 ? 's' : '') : 'usos todos no plano') + '</div></div><button class="btn small" type="button" data-action="lock" data-id="' + esc(p.id) + '" data-date="' + date + '"' + ((p.uses || 0) < 1 ? ' disabled' : '') + '>Fixar</button></li>'; }).join('');
  openSheet('<h3>Dia ' + (i + 1) + ' · ' + esc(objText(o)) + '</h3>' +
    '<div class="kv"><div><div class="label">Vitória</div><div class="v num c-' + tone(d.P) + '">' + (d.noObjective ? '—' : pct(d.P)) + '</div></div><div><div class="label">Projeção</div><div class="v num">' + (d.totals[0] ? f0(d.totals[0].mu) : '–') + '</div></div><div><div class="label">Jogos</div><div class="v num">' + (day.games || []).length + '</div></div></div>' +
    '<div class="card"><div class="list-head"><h2>Lineup do plano</h2><span class="small muted">' + dWeek(date) + ', ' + dShort(date) + '</span></div><ul class="list">' + (inLine || '<li class="row muted small">Nenhum jogador do plantel joga neste dia.</li>') + '</ul></div>' +
    (locks.size ? '<div class="small">Fixados: ' + [...locks].map(id => esc(nameOf(id)) + ' <button class="btn link small" type="button" data-action="unlock" data-id="' + esc(id) + '" data-date="' + date + '">soltar</button>').join(' · ') + '</div>' : '') +
    (bans.length ? '<div class="small">Tirados: ' + bans.map(id => esc(nameOf(id)) + ' <button class="btn link small" type="button" data-action="unban" data-id="' + esc(id) + '" data-date="' + date + '">repor</button>').join(' · ') + '</div>' : '') +
    (otherRows ? '<div class="card"><div class="list-head"><h2>Também jogam</h2><span class="small muted">fixar obriga o plano a usá-lo</span></div><ul class="list">' + otherRows + '</ul></div>' : '') + closeRow());
}
function playerSheet(id, date, back) {
  const r = S.result, pi = r.model.pIndex.get(id), p = r.model.players[pi];
  const { md, d } = dayInfo(date); if (!md) return;
  const day = md.day, o = (day.objectives || [])[0] || { stat: 'pts' }, info = md.info[pi][0] || { mu: 0, src: 'sem', status: 'ok', pPlay: 1 };
  const locked = ((((S.mine.plan || {}).locks || {})[date]) || []).includes(id);
  const inPlan = view().days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1);
  const live = date === (nextDay() || {}).date && liveOn(date), sub = live && d.live && d.live.submitted.includes(id);
  let src;
  if (info.src === 'odds') { const raw = (((md.oddsDay || {})[id] || {})[o.stat]) || {}; src = 'Linha ' + f1(info.line) + ' (mais ' + esc(raw.over) + ' / menos ' + esc(raw.under) + '): ' + pct(info.pOver) + ' de passar a linha, sem a margem da casa.'; }
  else src = info.src === 'media' ? 'Ainda sem odds para este dia: usa a média da época.' : 'Sem dados para esta estatística.';
  let liveHtml = '';
  if (live && sub) {
    const e = (((liveDoc(date) || {}).players || {})[id]) || {}, state = e.state || 'por', val = (e.vals || {})[o.stat] || 0;
    liveHtml = '<div class="card panel" style="gap:10px"><div class="label">Jogo a jogo</div><div class="chips" role="group" aria-label="Estado do jogo">' + [['por', 'Por jogar'], ['jogo', 'Em jogo'], ['fim', 'Terminado']].map(([k, l]) => '<button type="button" data-action="live-state" data-id="' + esc(id) + '" data-state="' + k + '" aria-pressed="' + (state === k) + '">' + l + '</button>').join('') + '</div>' +
      (state !== 'por' ? '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div class="stepper"><button type="button" data-action="live-val" data-id="' + esc(id) + '" data-d="-1" aria-label="Menos um">−</button><input class="num" id="liveVal" type="number" inputmode="numeric" min="0" value="' + val + '" data-action="live-input" data-id="' + esc(id) + '" aria-label="Valor até agora"><button type="button" data-action="live-val" data-id="' + esc(id) + '" data-d="1" aria-label="Mais um">+</button></div><span class="small muted">' + esc(statShort(o.stat)) + (state === 'fim' ? ' no final' : ' até agora') + '</span></div>' : '') +
      (state === 'jogo' ? '<div class="chips" role="group" aria-label="Período">' + [1, 2, 3, 4].map(qn => '<button type="button" data-action="live-q" data-id="' + esc(id) + '" data-q="' + qn + '" aria-pressed="' + (+e.q === qn) + '">' + qn + '.º</button>').join('') + '</div>' : '') + '</div>';
  } else if (live) liveHtml = '<div class="note info">Ainda não está no lineup que submeteste. Se fizeres a troca no Top Shot, carrega em <b>Fiz a troca</b> no ecrã Hoje.</div>';
  openSheet('<h3>' + esc(p.name) + '</h3><div class="small muted">' + esc(p.team) + ' ' + esc(opp(p.team, day)) + ' · Dia ' + (day.idx + 1) + ', ' + dShort(date) + '</div>' +
    '<div class="kv"><div><div class="label">Esperado</div><div class="v num">' + f1(info.mu) + '</div><div class="small muted">' + esc(statShort(o.stat)) + '</div></div><div><div class="label">Usos</div><div class="v num">' + (p.uses || 0) + '</div><div class="small muted">restantes</div></div><div><div class="label">No plano</div><div class="v num">' + inPlan.length + '</div><div class="small muted">' + (inPlan.length ? 'dias ' + inPlan.join(', ') : '—') + '</div></div></div>' +
    liveHtml + '<div class="small muted">' + src + (info.status !== 'ok' ? ' Estado: ' + esc(STATUS[info.status].label) + ' (' + Math.round(info.pPlay * 100) + '% de jogar).' : '') + '</div>' +
    '<div class="stack">' + (locked ? '<button class="btn" type="button" data-action="unlock" data-id="' + esc(id) + '" data-date="' + date + '">Deixar de fixar neste dia</button>' : '<button class="btn primary" type="button" data-action="lock" data-id="' + esc(id) + '" data-date="' + date + '">Fixar neste dia</button>') +
    '<button class="btn" type="button" data-action="ban" data-id="' + esc(id) + '" data-date="' + date + '">Tirar deste dia</button></div>' + closeRow(back));
}
function rosterSheet(id) {
  const e = S.mine.roster[id]; if (!e) return;
  const c = S.players.get(String(id)) || {}, v = view();
  const inPlan = v ? v.days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1) : [];
  const uses = S.pendingUses[id] != null ? S.pendingUses[id] : (+e.uses || 0);
  const team = e.team || c.team || '';
  const games = S.days.filter(d => FB.teamsOn(d).has(team)).length;
  const st = e.status || 'ok', avg = e.avg || c.avg;
  openSheet('<h3>' + esc(nameOf(id)) + '</h3><div class="small muted">' + esc(team || 'sem equipa') + ' · ' + games + ' jogos na run · no plano: ' + (inPlan.length ? 'dias ' + inPlan.join(', ') : 'nenhum dia') + '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><div class="label">Usos restantes</div><div class="small muted">o plano usa ' + inPlan.length + '</div></div><div class="stepper"><button type="button" data-action="uses" data-id="' + esc(id) + '" data-d="-1" aria-label="Menos um uso">−</button><output class="num" id="usesOut">' + uses + '</output><button type="button" data-action="uses" data-id="' + esc(id) + '" data-d="1" aria-label="Mais um uso">+</button></div></div>' +
    '<div><div class="label" style="margin-bottom:6px">Estado</div><div class="chips" role="group" aria-label="Estado">' + Object.keys(STATUS).map(k => '<button type="button" data-action="set-status" data-id="' + esc(id) + '" data-status="' + k + '" aria-pressed="' + (st === k) + '">' + STATUS[k].label + '</button>').join('') + '</div></div>' +
    (avg ? '<div><div class="label" style="margin-bottom:6px">Médias por jogo' + (c.gp ? ' (' + c.gp + ' jogos)' : '') + '</div><div class="kv">' + ['pts', 'reb', 'ast', 'fg3', 'stl', 'blk'].map(k => '<div><div class="label">' + STATS[k].short + '</div><div class="v num">' + f1(+avg[k] || 0) + '</div></div>').join('') + '</div></div>' : '<div class="note info">Ainda sem médias para este jogador. Entram quando ele jogar.</div>') +
    '<button class="btn" type="button" data-action="remove-player" data-id="' + esc(id) + '">Tirar do plantel</button>' + closeRow());
}
function addPlayerSheet() {
  openSheet('<h3>Adicionar jogador</h3><input class="field" id="apSearch" type="search" placeholder="Nome do jogador" autocomplete="off" aria-label="Procurar jogador"><div id="apResults" class="search-list"></div>' +
    '<div class="small muted">Não aparece? <button class="btn link small" type="button" data-action="custom-player">Adicionar à mão</button></div>' + closeRow());
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
  if (!S.players.size) { box.innerHTML = '<div class="row muted small">O catálogo de jogadores ainda está vazio. Usa "Adicionar à mão" ou espera pela primeira atualização automática.</div>'; return; }
  const res = searchPlayers(qs, 30);
  box.innerHTML = res.map(p => { const inR = !!S.mine.roster[p.id]; return '<div class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span></div><div class="ps">' + esc(p.team || '—') + (p.avg ? ' · ' + f1(+p.avg.pts || 0) + ' PTS · ' + f1(+p.avg.reb || 0) + ' REB · ' + f1(+p.avg.ast || 0) + ' AST' : '') + '</div></div>' + (inR ? '<span class="small muted">no plantel</span>' : '<button class="btn small" type="button" data-action="add-id" data-id="' + esc(p.id) + '">Adicionar</button>') + '</div>'; }).join('') || '<div class="row muted small">Nenhum jogador com esse nome.</div>';
}
function customPlayerSheet() {
  openSheet('<h3>Adicionar à mão</h3><input class="field" id="cpName" placeholder="Nome" aria-label="Nome do jogador"><div class="grid2"><select class="field" id="cpTeam" aria-label="Equipa">' + TEAMS.map(t => '<option>' + t + '</option>').join('') + '</select><input class="field num" id="cpUses" type="number" min="0" max="20" value="1" aria-label="Usos"></div>' +
    '<div class="small muted">Sem médias, este jogador só entra no plano nos dias com odds.</div><div class="btns"><button class="btn quiet" type="button" data-action="close-sheet">Cancelar</button><button class="btn primary" type="button" data-action="save-custom">Adicionar</button></div>');
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
  openSheet('<h3>Colar lista</h3><div class="small muted">Um jogador por linha (ou separados por vírgulas) com o número de usos. Ex.: <span class="kbd">Jokic 2</span>, <span class="kbd">Wembanyama 3</span>, <span class="kbd">Curry 1</span>.</div>' +
    '<textarea class="field" id="pasteText" rows="6" aria-label="Lista de jogadores"></textarea><button class="btn" type="button" data-action="paste-preview">Ver correspondências</button><div id="pasteOut"></div>' + closeRow());
}

// ---------- ações ----------
function deepMerge(a, b) {
  Object.keys(b).forEach(k => {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], b[k]);
    else a[k] = clone(b[k]);
  });
  return a;
}
function planPatch(patch) { S.mine.plan = deepMerge(S.mine.plan || {}, patch); schedule(); saveMine(); }
function lockToggle(id, date, on) {
  const cur = new Set((((S.mine.plan || {}).locks || {})[date]) || []);
  if (on) {
    if (cur.size >= 5) { toast('Já tens 5 jogadores fixados neste dia.'); return; }
    cur.add(id);
    planPatch({ locks: { [date]: [...cur] }, bans: { [date]: ((((S.mine.plan || {}).bans || {})[date]) || []).filter(x => x !== id) } });
    toast(lastName(id) + ' fixado. Plano refeito.');
  } else { cur.delete(id); planPatch({ locks: { [date]: [...cur] } }); }
}
function banToggle(id, date, on) {
  const cur = new Set((((S.mine.plan || {}).bans || {})[date]) || []);
  on ? cur.add(id) : cur.delete(id);
  planPatch({ bans: { [date]: [...cur] }, locks: { [date]: ((((S.mine.plan || {}).locks || {})[date]) || []).filter(x => !on || x !== id) } });
  if (on) toast(lastName(id) + ' fora deste dia. Plano refeito.');
}
function setStatus(id, status) { if (!S.mine.roster[id]) return; S.mine.roster[id].status = status; schedule(); saveMine(); }
const useTimers = {};
function changeUses(id, delta) {
  const e = S.mine.roster[id]; if (!e) return;
  const cur = S.pendingUses[id] != null ? S.pendingUses[id] : (+e.uses || 0);
  const nv = Math.max(0, Math.min(20, cur + delta));
  S.pendingUses[id] = nv; schedule();
  const out = $('usesOut'); if (out) out.textContent = nv;
  clearTimeout(useTimers[id]);
  useTimers[id] = setTimeout(() => { if (S.mine.roster[id]) S.mine.roster[id].uses = S.pendingUses[id]; delete S.pendingUses[id]; saveMine(); schedule(); }, 400);
}
function addToRoster(id, uses, extra) {
  S.mine.roster[id] = Object.assign({ uses: uses == null ? 1 : uses, status: 'ok' }, extra || {});
  applyChainResults(); schedule(); saveMine();
}
function recordResult(date, res) {
  const d = view().days.find(x => x.date === date); if (!d) return;
  const lineup = (liveOn(date) && d.live ? d.live.submitted : d.lineup).slice();
  lineup.forEach(id => { const e = S.mine.roster[id]; if (e) e.uses = Math.max(0, (+e.uses || 0) - 1); });
  planPatch({ played: { [date]: { done: true, result: res, lineup } } });
  toast((res === 'win' ? 'Vitória' : 'Derrota') + ' registada. Usos descontados e plano refeito.');
}
function undoResult(date) {
  const pl = (((S.mine.plan || {}).played || {})[date]) || {};
  (pl.lineup || []).forEach(id => { const e = S.mine.roster[id]; if (e) e.uses = (+e.uses || 0) + 1; });
  planPatch({ played: { [date]: { done: false, result: null, lineup: pl.lineup || [] } } });
  toast('Resultado desfeito. Usos repostos.');
}
function liveToggle() {
  const nd = nextDay(); if (!nd) return;
  if (liveOn(nd.date)) { planPatch({ live: { [nd.date]: { active: false } } }); return; }
  const cur = liveDoc(nd.date), lineup = view().days[0].lineup.slice();
  planPatch({ live: { [nd.date]: { active: true, lineup: cur && cur.lineup && cur.lineup.length ? cur.lineup : lineup, players: (cur && cur.players) || {} } } });
  toast('Jogo a jogo ligado com o lineup atual.');
}
function liveSet(id, patch) { const nd = nextDay(); if (nd) planPatch({ live: { [nd.date]: { players: { [id]: patch } } } }); }
function swapDone() { const nd = nextDay(), d = view().days[0]; planPatch({ live: { [nd.date]: { lineup: d.lineup.slice() } } }); toast('Lineup atualizado.'); }
// Vai buscar o box score oficial da NBA para os jogadores do lineup submetido
// ESPN: estatísticas de um jogo (summary) → {nomeNormalizado: {pts, reb, ast, fg3, stl, blk}}
function espnBox(json) {
  const out = {};
  for (const team of (((json || {}).boxscore || {}).players) || []) {
    for (const st of team.statistics || []) {
      const keys = st.keys || [], labels = (st.labels || []).map(l => String(l).toUpperCase());
      const idx = (k, l) => { let i = keys.findIndex(x => x === k || String(x).startsWith(k)); if (i < 0) i = labels.indexOf(l); return i; };
      const I = { pts: idx('points', 'PTS'), reb: idx('rebounds', 'REB'), ast: idx('assists', 'AST'), fg3: idx('threePointFieldGoalsMade', '3PT'), stl: idx('steals', 'STL'), blk: idx('blocks', 'BLK') };
      for (const a of st.athletes || []) {
        if (a.didNotPlay || !(a.stats || []).length) continue;
        const v = {}; for (const [k, i] of Object.entries(I)) v[k] = i >= 0 ? parseFloat(String(a.stats[i] || '0').split('-')[0]) || 0 : 0;
        out[norm((a.athlete || {}).displayName)] = v;
      }
    }
  }
  return out;
}
// Vai buscar as estatísticas ao vivo dos jogadores do lineup submetido (ESPN; NBA para ids antigos)
async function liveFetch() {
  const nd = nextDay(); if (!nd) return;
  const stat = ((nd.objectives || [])[0] || {}).stat || 'pts';
  const parts = String(stat).split('+');
  const sub = ((liveDoc(nd.date) || {}).lineup) || [];
  const gameIds = new Set();
  sub.forEach(id => { const team = (S.result.model.players[S.result.model.pIndex.get(id)] || {}).team; const g = FB.gameOf(nd, team); if (g && g[3]) gameIds.add(g[3]); });
  if (!gameIds.size) { toast('Sem identificador de jogo no calendário. Mete os valores à mão.'); return; }
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
        const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=' + String(gid).slice(5), { cache: 'no-store' });
        if (!res.ok) return;
        const box = espnBox(await res.json()); ok++;
        Object.entries(box).forEach(([nm, v]) => {
          const id = byName.get(nm); if (!id) return;
          const val = parts.reduce((a, k) => a + (+v[k] || 0), 0);
          players[id] = stt.state === 'post' ? { state: 'fim', vals: { [stat]: val } } : { state: 'jogo', q: Math.min(4, Math.max(1, stt.period)), vals: { [stat]: val } };
        });
        return;
      }
      const res = await fetch('https://cdn.nba.com/static/json/liveData/boxscore/boxscore_' + gid + '.json', { cache: 'no-store' });
      if (!res.ok) return;
      const js = await res.json(), g = js.game; if (!g || g.gameStatus < 2) return;
      ok++;
      [g.homeTeam, g.awayTeam].forEach(t => (t.players || []).forEach(pl => {
        const nm = norm(pl.name || [pl.firstName, pl.familyName].filter(Boolean).join(' '));
        const id = byName.get(nm) || (sub.includes(String(pl.personId)) ? String(pl.personId) : null); if (!id) return;
        const val = parts.reduce((a, k) => a + (+((pl.statistics || {})[LIVE_STAT[k]]) || 0), 0);
        players[id] = g.gameStatus === 3 ? { state: 'fim', vals: { [stat]: val } } : { state: 'jogo', q: Math.min(4, Math.max(1, +g.period || 1)), vals: { [stat]: val } };
      }));
    } catch (e) { /* bloqueado ou sem rede */ }
  }));
  if (!ok) { toast('Ainda não há estatísticas ao vivo (jogo por começar?) ou não consegui lê-las. Mete os valores à mão ou tenta daqui a pouco.'); return; }
  if (Object.keys(players).length) planPatch({ live: { [nd.date]: { players } } });
  toast('Estatísticas ao vivo atualizadas.');
}
async function adminWrite(promise, okMsg) { try { await q(promise); if (okMsg) toast(okMsg); return true; } catch (e) { toast(errText(e)); return false; } }
async function setObjective(i, stat, target) {
  const day = S.days[i]; if (!day) return;
  const o = Object.assign({ stat: 'pts', target: 0 }, (day.objectives || [])[0]);
  if (stat != null) o.stat = stat; if (target != null) o.target = target;
  if (!(+o.target > 0)) return;
  day.objectives = [o]; schedule();
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
}

// ---------- eventos ----------
let liveInputTimer = null;
document.addEventListener('submit', async e => {
  const f = e.target; e.preventDefault();
  if (f.id === 'authForm') submitAuth(f);
  if (f.id === 'joinForm') submitJoin(f);
  if (f.id === 'profForm') { try { await submitProfile($('pfName'), $('pfTs'), null); await enterApp(); } catch (err) { renderProfileSetup(errText(err)); } }
  if (f.id === 'pfForm') { try { await submitProfile($('pfName2'), $('pfTs2'), $('pfFlow2')); toast('Perfil guardado.'); render(); } catch (err) { toast(errText(err)); } }
  if (f.id === 'inviteForm') { const c = $('invCode').value.trim(); if (await adminWrite(sb.rpc('set_invite_code', { code: c }), 'Código mudado.')) { S.invite = c; renderAjustes(); } }
  if (f.id === 'newRunForm') createRun(f);
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action], [data-tab]');
  if (!b || b.disabled) return;
  if (b.matches('.tab')) { setTab(b.dataset.tab); return; }
  const a = b.dataset.action, id = b.dataset.id, date = b.dataset.date, nd = nextDay();
  switch (a) {
    case 'auth-mode': renderAuth(b.dataset.mode); break;
    case 'logout': await sb.auth.signOut(); S.session = null; S.role = null; S.profile = null; S.invite = null; closeSheet(); renderAuth(); break;
    case 'goto': setTab(b.dataset.tab); break;
    case 'close-sheet': closeSheet(); break;
    case 'sheet-back': { const fn = S.sheetBack; fn ? fn() : closeSheet(); break; }
    case 'mode': planPatch({ mode: { [nd.date]: b.dataset.mode } }); break;
    case 'player': playerSheet(id, date, b.dataset.back === 'day' ? () => daySheet(date) : null); break;
    case 'day': daySheet(date); break;
    case 'pl-sheet': rosterSheet(id); break;
    case 'friend': friendSheet(id); break;
    case 'lock': lockToggle(id, date, true); closeSheet(); break;
    case 'unlock': lockToggle(id, date, false); closeSheet(); break;
    case 'ban': banToggle(id, date, true); closeSheet(); break;
    case 'unban': banToggle(id, date, false); closeSheet(); break;
    case 'set-status': setStatus(id, b.dataset.status); rosterSheet(id); break;
    case 'uses': changeUses(id, +b.dataset.d); break;
    case 'remove-player': delete S.mine.roster[id]; closeSheet(); schedule(); saveMine(); toast('Tirado do plantel.'); break;
    case 'result-sheet': {
      const day = S.days.find(x => x.date === date), d = view().days.find(x => x.date === date);
      const lineup = liveOn(date) && d.live ? d.live.submitted : d.lineup;
      openSheet('<h3>Fechar o dia ' + (S.days.indexOf(day) + 1) + '</h3><div class="small muted">Regista o resultado com o lineup ' + (liveOn(date) ? 'que submeteste' : 'do plano') + '. Os usos destes jogadores são descontados e o plano é refeito. Se tiveres o utilizador do Top Shot no perfil, isto acontece sozinho quando a blockchain fechar o dia.</div>' +
        '<ul class="list card">' + lineup.map(x => '<li class="row"><span>' + esc(nameOf(x)) + '</span></li>').join('') + '</ul><div class="btns"><button class="btn" type="button" data-action="result" data-date="' + date + '" data-res="loss">Perdi</button><button class="btn primary" type="button" data-action="result" data-date="' + date + '" data-res="win">Ganhei</button></div>' + closeRow());
      break;
    }
    case 'result': recordResult(date, b.dataset.res); closeSheet(); break;
    case 'undo-result': undoResult(date); closeSheet(); break;
    case 'live-toggle': liveToggle(); break;
    case 'live-fetch': b.disabled = true; await liveFetch(); b.disabled = false; break;
    case 'swap-done': swapDone(); break;
    case 'live-state': liveSet(id, { state: b.dataset.state }); playerSheet(id, nd.date, S.sheetBack); break;
    case 'live-q': liveSet(id, { q: +b.dataset.q }); playerSheet(id, nd.date, S.sheetBack); break;
    case 'live-val': {
      const inp = $('liveVal'), stat = ((nd.objectives || [])[0] || {}).stat || 'pts';
      const nv = Math.max(0, (parseInt(inp.value, 10) || 0) + (+b.dataset.d)); inp.value = nv;
      clearTimeout(liveInputTimer); liveInputTimer = setTimeout(() => liveSet(id, { vals: { [stat]: nv } }), 400); break;
    }
    case 'add-player': addPlayerSheet(); break;
    case 'add-id': addToRoster(id, 1); toast(nameOf(id) + ' adicionado com 1 uso. Toca nele no plantel para mudar.'); renderSearch(($('apSearch') || {}).value || ''); break;
    case 'custom-player': customPlayerSheet(); break;
    case 'save-custom': {
      const name = ($('cpName').value || '').trim(); if (!name) { toast('Escreve o nome.'); return; }
      const cid = 'x-' + (name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now());
      addToRoster(cid, Math.max(0, parseInt($('cpUses').value, 10) || 0), { name, team: $('cpTeam').value }); closeSheet(); toast(name + ' adicionado.'); break;
    }
    case 'paste-sheet': pasteSheet(); break;
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
      openSheet('<h3>Copiar plantel</h3><div class="small muted">Copia os jogadores de outra run. Os usos voltam a 1; acerta-os depois.</div><div class="stack">' + others.map(x => '<button class="btn" type="button" data-action="copy-from" data-id="' + esc(x.id) + '">' + esc(x.name) + '</button>').join('') + '</div>' + closeRow());
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
    case 'pz-add': { const run = curRun(); const pz = clone(run.prizes || []); const last = pz.length ? pz[pz.length - 1].wins : 3; pz.push({ wins: Math.min(31, last + 2), value: 1 }); await setPrizes(pz); renderAjustes(); break; }
    case 'pz-del': { const run = curRun(); const pz = clone(run.prizes || []); pz.splice(+b.dataset.i, 1); await setPrizes(pz); renderAjustes(); break; }
  }
});
document.addEventListener('change', async e => {
  const t = e.target, a = t.dataset.action;
  if (t.id === 'runPick') { S.loading = true; render(); await loadRun(t.value); S.loading = false; schedule(); return; }
  if (t.id === 'chainPick') { const run = curRun(); if (await adminWrite(sb.from('runs').update({ chain_run_id: t.value || null }).eq('id', run.id), t.value ? 'Run ligada à blockchain.' : 'Ligação removida.')) { run.chain_run_id = t.value || null; await loadGroup(); schedule(); } return; }
  if (a === 'obj-stat') setObjective(+t.dataset.i, t.value, null);
  if (a === 'obj-target') { const n = parseInt(t.value, 10); if (n > 0) setObjective(+t.dataset.i, null, n); }
  if (a === 'pz-w' || a === 'pz-v') {
    const run = curRun(), pz = clone(run.prizes || []), i = +t.dataset.i; if (!pz[i]) return;
    const n = parseFloat(t.value); if (!(n >= 0)) return;
    if (a === 'pz-w') pz[i].wins = Math.max(1, Math.round(n)); else pz[i].value = n;
    setPrizes(pz);
  }
  if (a === 'live-input') { const nd = nextDay(), stat = ((nd.objectives || [])[0] || {}).stat || 'pts'; liveSet(t.dataset.id, { vals: { [stat]: Math.max(0, parseInt(t.value, 10) || 0) } }); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'rosterFilter') { S.filter = e.target.value; renderPlantel(); }
  if (e.target.id === 'apSearch') renderSearch(e.target.value);
});
document.addEventListener('focusout', e => { if ($('tab-ajustes').contains(e.target)) setTimeout(() => { if (S.tab === 'ajustes' && !typingIn('tab-ajustes')) renderAjustes(); }, 0); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });
// Ao voltar à app, relê o plano (pode ter sido mudado noutro dispositivo) e o grupo
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !S.runId || !S.session) return;
  try {
    const mine = await q(sb.from('user_runs').select('*').eq('run_id', S.runId).eq('user_id', S.session.user.id).maybeSingle());
    if (mine && Date.parse(mine.updated_at) > (S.mineSeen || 0)) { S.mine = { roster: mine.roster || {}, plan: mine.plan || {} }; S.mineSeen = Date.parse(mine.updated_at); }
    await loadGroup(); applyChainResults(); schedule();
  } catch (err) { /* sem rede: fica como está */ }
});
function setTabUI() { TABS.forEach(t => { $('tab-' + t).hidden = t !== S.tab; $('t-' + t).setAttribute('aria-selected', String(t === S.tab)); }); }
function setTab(tab) {
  S.tab = tab; setTabUI();
  try { localStorage.setItem('fb-tab3', tab); } catch (e) {}
  render(); window.scrollTo(0, 0);
}
// o relógio decide que jogos já começaram: recalcula a cada minuto com jogo a jogo ligado
setInterval(() => { const nd = nextDay(); if (nd && liveOn(nd.date)) schedule(); }, 60000);

// ---------- arranque ----------
(async function init() {
  if (!sb) { showGate(brand() + '<div class="err">O site ainda não está ligado ao Supabase.</div><p class="small muted" style="margin:0">Põe o Project URL e a chave anon/publishable em <span class="kbd">docs/config.js</span>.</p>'); return; }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { S.session = null; } });
  try { await afterLogin(); } catch (e) { renderAuth('login', errText(e)); }
})();
