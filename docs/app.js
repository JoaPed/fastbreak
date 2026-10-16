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
};
const INJ_LABEL = FB.INJ_LABEL;
// sub-separadores de cada secção (o escolhido fica guardado neste aparelho)
const SUBS = {
  hoje: () => [['lineup', 'Lineup'], ['porque', 'Porquê'], ['comparar', 'Comparar']],
  run: () => [['premios', 'Prémios'], ['dias', 'Dias']].concat(S.multi ? [['contas', 'Contas']] : []).concat([['analise', 'Análise'], ['historico', 'Histórico']]),
  plantel: () => [['plantel', 'Plantel'], ['forma', 'Forma'], ['lesoes', 'Lesões'], ['comprar', 'Comprar'], ['colecao', 'Coleção']],
  grupo: () => [['classif', 'Classificação'], ['lineups', 'Lineups'], ['emprestimos', 'Empréstimos']],
  ajustes: () => [['perfil', 'Perfil'], ['prefs', 'Preferências']].concat(S.role === 'admin' ? [['admin', 'Admin']] : []).concat([['dados', 'Dados']]),
};
S.sub = { hoje: 'lineup', run: 'premios', plantel: 'plantel', grupo: 'classif', ajustes: 'perfil' };
try { Object.assign(S.sub, JSON.parse(localStorage.getItem('fb-sub') || '{}')); } catch (e) {}
function subOf(tab) { const list = SUBS[tab](), cur = S.sub[tab]; return list.some(x => x[0] === cur) ? cur : list[0][0]; }
function setSub(tab, sub) { S.sub[tab] = sub; try { localStorage.setItem('fb-sub', JSON.stringify(S.sub)); } catch (e) {} }
function subBar(tab) {
  const cur = subOf(tab), counts = { lesoes: injuredInRoster().length };
  return '<nav class="subtabs" aria-label="Partes de ' + esc(tab) + '"><div class="subtabs-in" role="tablist">' + SUBS[tab]().map(([k, l]) => '<button type="button" role="tab" data-action="sub" data-stab="' + tab + '" data-sub="' + k + '" aria-selected="' + (cur === k) + '">' + l + (counts[k] ? '<span class="cnt" aria-label="' + counts[k] + ' no relatório">' + counts[k] + '</span>' : '') + '</button>').join('') + '</div></nav>';
}
const injuredInRoster = () => Object.keys((S.mine || {}).roster || {}).filter(id => (S.injuries || {})[id] && !S.mine.roster[id].injIgnore);
// opções do motor: o que cada equipa concede e o relatório de lesões
// jogos seguidos (back-to-back): ajustar ou não (fica neste aparelho)
let b2bOn = true;
try { b2bOn = localStorage.getItem('fb-b2b') !== '0'; } catch (e) {}
// aspeto: automático (segue o telemóvel), claro ou escuro (fica neste aparelho)
let theme = 'auto';
try { const t = localStorage.getItem('fb-theme'); if (t === 'light' || t === 'dark') theme = t; } catch (e) {}
function applyTheme(t) {
  theme = t;
  try { if (t === 'auto') localStorage.removeItem('fb-theme'); else localStorage.setItem('fb-theme', t); } catch (e) {}
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches, dark = t === 'dark' || (t === 'auto' && sys);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.setAttribute('content', t === 'auto' ? (/dark/.test(m.getAttribute('media') || '') ? '#0B1018' : '#EEF1F5') : dark ? '#0B1018' : '#EEF1F5'); });
}
const engOpts = () => ({ teams: S.teams, injuries: S.injuries, prevGames: S.prevGames || {}, b2b: b2bOn });
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
  const x = new Date(d0 + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); const prev = x.toISOString().slice(0, 10);
  if (S.prevGames && S.prevGames[prev]) return;
  try { const games = await espnBoard(prev); S.prevGames = { [prev]: games.flatMap(g => [g.away, g.home]).filter(Boolean) }; schedule(); } catch (e) { /* sem rede: o dia 1 fica sem jogos seguidos */ }
}

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
const statShort = st => FB.statTerms(st).map((t, i) => (i ? (t.sign < 0 ? '−' : '+') : t.sign < 0 ? '−' : '') + ((STATS[t.s] || {}).short || t.s.toUpperCase())).join('');
const statLabel = st => FB.statTerms(st).map((t, i) => (i ? (t.sign < 0 ? ' − ' : ' + ') : t.sign < 0 ? '− ' : '') + ((STATS[t.s] || {}).label || t.s)).join('');
const objOne = o => o.target + '+ ' + statShort(o.stat) + (o.each ? ' cada' : '');
const objText = o => o ? objOne(o) : 'Objetivo por definir';
const objsText = day => { const list = ((day || {}).objectives || []).filter(o => o && o.stat); return list.length ? list.map(objOne).join(' e ') : 'Objetivo por definir'; };
// de onde vem o valor esperado de um jogador (texto curto para as listas)
// seta de forma: últimos 5 jogos acima/abaixo da média da época na estatística do dia
function formTag(p, o) {
  if (!o) return '';
  const f = FB.formInfo(p, o.stat); if (!f || !f.n5 || f.n5 < 3) return '';
  return f.trend >= 0.12 ? ' · <span class="up">em forma ↑</span>' : f.trend <= -0.12 ? ' · <span class="down">fora de forma ↓</span>' : '';
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
const fmtOdd = x => (x == null || x === '' ? '–' : (+x > 0 ? '+' : '') + x);
const INJ_PILL = { out: 'fora', ofs: 'fora', doubtful: 'dout', questionable: 'duv', dtd: 'duv', probable: 'prov' };
const INJ_SHORT = { out: 'Fora', ofs: 'Fora', doubtful: 'Dúv.', questionable: 'Dúv.', dtd: 'Dúv.', probable: 'Prov.' };
function injLine(rec) {
  if (!rec) return '';
  return esc(INJ_LABEL[rec.status] || rec.label || rec.status) + (rec.detail ? ' · ' + esc(rec.detail) : '') + (rec.return_date ? ' · regresso previsto ' + dShort(rec.return_date) : '');
}
// jogou ontem (2.º de dois jogos seguidos)
const b2bTag = info => (info && info.b2b ? ' · <span class="warn-t">2.º seguido</span>' : '');
// nas listas: "lesão: dia a dia" quando o relatório mexe no plano deste dia
function injTag(info) {
  const j = info && info.injury; if (!j || j.ignored || !j.status) return '';
  return ' · <span class="' + (j.status === 'fora' || j.status === 'dout' ? 'down' : 'warn-t') + '">lesão: ' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + '</span>';
}
// relatório de lesões nas fichas, com o botão para o ignorar
function injuryBlock(id, j, date) {
  const rec = injRec(id); if (!rec) return '';
  const ign = !!((S.mine.roster[id] || {}).injIgnore);
  let how = '';
  if (j && !ign && j.k != null) how = (j.k === 0 ? 'Este é o próximo jogo dele' : 'Este é o ' + (j.k + 1) + '.º jogo dele a contar de agora') + ': ' + (j.status ? 'o plano conta com ' + Math.round(STATUS[j.status].play * 100) + '% de ele jogar.' : 'o plano já conta com ele normal.');
  return '<div class="note' + (rec.status === 'probable' ? ' info' : '') + ' stack" style="gap:6px"><div><b>Relatório de lesões:</b> ' + injLine(rec) + '. <span class="small">(ESPN, ' + esc(ago(rec.updated_at)) + ')</span></div>' +
    (rec.comment ? '<div class="small">' + esc(rec.comment) + '</div>' : '') + (how ? '<div class="small">' + how + '</div>' : '') +
    (ign ? '<div class="small"><b>Estás a ignorar o relatório</b> para este jogador: o plano conta com ele como disponível.</div>' : '') +
    ((S.mine.roster || {})[id] ? '<button class="btn small" type="button" data-action="inj-ignore" data-id="' + esc(id) + '"' + (date ? ' data-date="' + date + '"' : '') + ' data-on="' + (ign ? '0' : '1') + '">' + (ign ? 'Voltar a usar o relatório' : 'Ignorar o relatório (sei que ele joga)') + '</button>' : '') + '</div>';
}
// ---------- em que se baseia cada valor ----------
const formName = () => (FORM_LEVELS.find(x => x[0] === formLevel) || ['1', 'Normal'])[1];
function partBasis(p, part, md, id, opp) {
  const u = esc((STATS[part.stat] || {}).short || part.stat);
  const raw = (md.oddsDay || {})[id] || {};
  if (part.src === 'odds') {
    const o = raw[part.stat] || {};
    return '<b>Odds</b> de ' + u + ': linha ' + f1(+o.line) + ' · mais ' + esc(fmtOdd(o.over)) + ' / menos ' + esc(fmtOdd(o.under)) + (o.books ? ' (consenso de ' + o.books + ' casa' + (o.books > 1 ? 's' : '') + ')' : '') + ' → ' + pct(FB.devig(o.over, o.under)) + ' de passar a linha, já sem a margem da casa → média <b class="num">' + f1(part.mu) + '</b>. As odds já contam com a forma, o adversário e os minutos.';
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
  const j = info.injury, pp = info.pPlay;
  if (j && !j.ignored && j.status) return '<b>Disponibilidade</b>: ' + pct(pp) + ' de jogar — relatório de lesões: ' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + (j.rec.detail ? ' (' + esc(j.rec.detail) + ')' : '') + (j.k === 0 ? ', para o próximo jogo dele.' : ', ' + (j.k + 1) + '.º jogo dele a contar de agora.') + (info.status !== j.status ? ' Puseste-o como ' + esc(STATUS[info.status].label.toLowerCase()) + ' no plantel: conta o pior.' : '');
  if (info.status !== 'ok') return '<b>Disponibilidade</b>: ' + pct(pp) + ' de jogar (estado "' + esc(STATUS[info.status].label) + '" posto por ti no plantel).';
  if (j && j.ignored) return '<b>Disponibilidade</b>: 100% — estás a ignorar o relatório de lesões para ele.';
  if (j) return '<b>Disponibilidade</b>: 100% — está no relatório (' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + '), mas ' + (j.k == null ? 'este jogo já começou ou já passou.' : 'neste jogo já conta normal.');
  return '<b>Disponibilidade</b>: 100% — não está no relatório de lesões' + (S.injOk && S.injAt ? ' (ESPN, ' + esc(ago(S.injAt)) + ')' : S.injOk === false ? ' (o relatório ainda não está ligado)' : '') + '.';
}
function basisHtml(p, info, o, md, id) {
  const g = FB.gameOf(md.day, p.team), opp = g ? (g[0] === p.team ? g[1] : g[0]) : null;
  const u = esc(statShort(o.stat)), parts = info.parts || [], steps = [];
  parts.forEach(part => steps.push((parts.length > 1 && part.sign < 0 ? 'A subtrair. ' : '') + partBasis(p, part, md, id, opp)));
  if (parts.length > 1) steps.push('<b>Soma</b>: ' + parts.map((x, i) => (x.sign < 0 ? '− ' : i ? '+ ' : '') + f1(x.mu) + ' ' + esc((STATS[x.stat] || {}).short || x.stat)).join(' ') + ' = ' + f1(info.muIf != null ? info.muIf : info.mu) + ' ' + u + '.');
  if (info.b2b) { const h = (p.avg || {}).hist, b = h && h.b2b, pc = Math.round((1 - info.b2b.f) * 100);
    steps.push('<b>Jogos seguidos</b>: jogou ontem. ' + (info.src === 'odds' ? 'As odds já contam com isso.' : 'Sem odds, conta ' + (pc > 0 ? pc + '% menos' : pc < 0 ? Math.abs(pc) + '% mais' : 'o mesmo') + (b && b.n >= 6 ? ' (na época passada fez ' + plural(b.n, 'jogo seguido', 'jogos seguidos') + ' e rendeu ' + Math.round(((b.r || {})[FB.statTerms(o.stat)[0].s] || 1) * 100) + '% do normal)' : ' (o normal nestes jogos)') + '.')); }
  steps.push(playBasis(info));
  { const t0 = FB.statTerms(o.stat)[0].s, k = FB.kOf(p, t0), k0 = (STATS[t0] || {}).k, h = (p.avg || {}).hist;
    if (h && h.n >= 15 && k0) steps.push('<b>Regularidade</b> (' + h.n + ' jogos da época passada): ' + (k / k0 >= 1.2 ? 'muda muito de jogo para jogo, por isso tanto pode fazer um jogo grande como um vazio' : k / k0 <= 0.85 ? 'é regular, costuma andar perto da média' : 'normal para esta estatística') + '.'); }
  const muIf = info.muIf != null ? info.muIf : info.mu;
  steps.push('<b>No plano</b>: ' + (info.pPlay < 1 ? pct(info.pPlay) + ' × ' + f1(muIf) + ' = ' : '') + '<b class="num">' + f1(info.mu) + '</b> ' + u + ' esperados (± ' + f1(Math.sqrt(info.v || 0)) + ').');
  return '<div class="card panel basis"><h2>Em que se baseia</h2><ol class="steps">' + steps.map(x => '<li>' + x + '</li>').join('') + '</ol></div>';
}
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
}
// relatório de lesões (ESPN), guardado pela tarefa "Lesões"
async function loadInjuries() {
  let rows = null;
  try { rows = await q(sb.from('injuries').select('*')); } catch (e) { rows = null; }
  S.injuries = {}; S.injAt = null; S.injOk = rows != null;
  (rows || []).forEach(r => { S.injuries[r.id] = r; if (!S.injAt || r.updated_at > S.injAt) S.injAt = r.updated_at; });
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
  let saved = null; try { saved = localStorage.getItem('fb-run'); } catch (e) {}
  if (saved && S.runs.some(r => r.id === saved)) return saved;
  const act = S.runs.find(r => r.active);
  return act ? act.id : (S.runs[0] ? S.runs[0].id : null);
}
async function loadRun(runId) {
  S.runId = runId; S.days = []; S.odds = {}; S.prevGames = {}; S.board = null; S.mine = { roster: {}, plan: {} }; S.mineLoaded = false; S.pendingUses = {}; S.lastSummary = '';
  S.group = { profiles: [], summaries: [], members: [], chain: [] }; S.chainGames = [];
  try { localStorage.setItem('fb-run', runId || ''); } catch (e) {}
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
  loadPrevGames();
}
async function loadGroup() {
  if (!S.runId) return;
  const run = S.runs.find(r => r.id === S.runId) || {};
  const [profiles, summaries, members, chain] = await Promise.all([
    q(sb.from('profiles').select('user_id,display_name,topshot_username,flow_address,smurfs,share_plan,updated_at')).catch(() => q(sb.from('profiles').select('*'))), // sem as coleções dos outros (pesadas)
    q(sb.from('summaries').select('*').eq('run_id', S.runId)),
    q(sb.from('members').select('*')),
    run.chain_run_id ? q(sb.from('chain_results').select('*').eq('chain_run_id', run.chain_run_id)) : Promise.resolve([]),
  ]);
  S.group = { profiles: profiles || [], summaries: summaries || [], members: members || [], chain: chain || [] };
}

// Resultados lidos da blockchain entram sozinhos no plano de cada conta (e descontam os usos dessa conta)
function applyChainResults() {
  const uid = S.session.user.id;
  const dates = new Set(S.days.map(d => d.date));
  const roster = S.mine.roster;
  const byName = new Map();
  Object.keys(roster).forEach(id => { const nm = norm(nameOf(id)); if (nm) byName.set(nm, id); });
  let changed = 0;
  accounts().forEach(acc => {
    const mine = S.group.chain.filter(c => c.user_id === uid && c.date && (c.account || 'main') === acc.id);
    if (!mine.length) return;
    const plan = planOf(acc.id), played = clone(plan.played || {});
    let ch = 0;
    mine.forEach(c => {
      if (!dates.has(c.date) || c.win == null) return;
      const res = c.win ? 'win' : 'loss';
      const cur = played[c.date];
      if (cur && cur.done) {
        if (cur.result !== res) { cur.result = res; cur.chain = true; ch++; }
        // lido antes de haver plantel: liga agora os nomes aos jogadores (os usos que puseste já são os restantes)
        if (cur.chain && !(cur.lineup || []).length) {
          const ids = (c.lineup || []).map(n => byName.get(norm(n))).filter(Boolean);
          if (ids.length) { cur.lineup = ids; ch++; }
        }
        return;
      }
      const finished = Date.now() - Date.parse(c.date + 'T12:00:00Z') > 30 * 3600e3;
      if (!finished && !c.win) return; // ainda a decorrer: espera pelo fim
      const ids = (c.lineup || []).map(n => byName.get(norm(n))).filter(Boolean);
      ids.forEach(id => { const e = roster[id]; if (e) setUsesOf(e, acc.id, Math.max(0, usesEff(e, id, acc.id) - 1)); });
      played[c.date] = { done: true, result: res, lineup: ids, chain: true, points: c.points };
      ch++;
    });
    if (ch) { plan.played = played; changed += ch; }
  });
  if (changed) {
    saveMine();
    toast(changed === 1 ? 'Um resultado lido da blockchain.' : changed + ' resultados lidos da blockchain.');
  }
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
  if (acc === 'main') return +e.uses || 0;
  if (e.su && e.su[acc] != null) return +e.su[acc];
  return Math.max(0, (+e.uses || 0) + usedCount('main', id) - usedCount(acc, id));
}
function setUsesOf(e, acc, n) { if (acc === 'main') e.uses = n; else { e.su = e.su || {}; e.su[acc] = n; } }
// onde estão os Moments de cada jogador (lido das carteiras)
function collectionInfo(id) {
  const c = ((((S.profile || {}).collection) || {}).players || {})[id];
  if (!c || !c.owners) return { copies: 1, owner: null };
  const keys = Object.keys(c.owners).filter(k => c.owners[k] > 0), n = keys.reduce((a, k) => a + c.owners[k], 0);
  return { copies: Math.max(1, n), owner: n === 1 ? keys[0] : null };
}

// ---------- gravar ----------
let mineTimer = null, mineSaving = Promise.resolve();
function saveMine() {
  clearTimeout(mineTimer);
  mineTimer = setTimeout(saveNow, 600);
}
function saveNow() {
  mineTimer = null;
  if (!S.session || !S.runId) return;
  const row = { user_id: S.session.user.id, run_id: S.runId, roster: S.mine.roster, plan: S.mine.plan };
  mineSaving = mineSaving.then(() => q(sb.from('user_runs').upsert(row, { onConflict: 'user_id,run_id' }))).then(() => { S.mineSeen = Date.now() + 5000; }).catch(e => toast('Não guardou: ' + errText(e)));
  return mineSaving;
}
let sumTimer = null;
function publishSummary() {
  if (!S.session) return;
  const r = mainResult(); if (!r || !S.runId) return;
  const nd0 = r.model.days.length ? r.model.days[0].day : null;
  const v = nd0 && (((planOf('main').mode || {})[nd0.date]) === 'allin') && r.allIn ? r.allIn : r.normal; // o grupo vê a conta principal
  const days = {};
  Object.entries(planOf('main').played || {}).forEach(([d, p]) => { if (p && p.done) days[d] = p.result; });
  const row = {
    user_id: S.session.user.id, run_id: S.runId, wins: r.wins, losses: r.losses,
    expected: Math.round((r.wins + v.expected) * 100) / 100,
    prize_probs: r.prizes.map((p, i) => ({ wins: p.wins, p: Math.round(v.prizeProbs[i] * 1000) / 1000 })),
    days, next_p: v.days[0] ? Math.round(v.days[0].P * 1000) / 1000 : null,
  };
  const share = shareDoc();
  if (share) row.share = share; else if (!S.noShareCol) row.share = null;
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
function schedule() { if (scheduled) return; scheduled = true; setTimeout(() => { scheduled = false; if (!S.session) return; compute(); render(); publishSummary(); publishNext(); snapshotProj(); scheduleAutoBuy(); }, 16); }
function recalcNow() { if (!S.session) return; compute(); render(); publishSummary(); publishNext(); }
// Lineups dos próximos 3 dias de cada conta, guardados no plano: a tarefa dos avisos usa-os quando ainda não há
// lineup submetido no Top Shot (só runs a sério)
function publishNext() {
  const run = curRun();
  if (!S.session || !run || run.fictitious || !S.mineLoaded || !Object.keys(S.mine.roster || {}).length || !S.result) return;
  if (!S.alerts || !(S.alerts.email || S.alerts.ntfy)) return; // só serve os avisos (desligados por agora)
  const out = {};
  accounts().forEach(a => {
    const r = S.multi ? S.multi.byKey[a.id] : (a.id === 'main' ? S.result : null); if (!r) return;
    const nd = r.model.days.length ? r.model.days[0].day : null, pa = planOf(a.id);
    const v = nd && ((pa.mode || {})[nd.date]) === 'allin' && r.allIn ? r.allIn : r.normal;
    const m = {}; v.days.slice(0, 3).forEach(d => { if (d.lineup.length) m[d.date] = d.lineup.slice(); });
    out[a.id] = m;
  });
  if (JSON.stringify(S.mine.plan.next || {}) === JSON.stringify(out)) return;
  S.mine.plan.next = out; saveMine();
}
const nameOf = id => { const r = (S.mine.roster || {})[id]; const p = S.players.get(String(id)); return (r && r.name) || (p && p.name) || String(id); };
const lastName = id => { const parts = nameOf(id).split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : parts[0]; };
function engineInputs(acc) {
  acc = acc || 'main';
  const run = S.runs.find(r => r.id === S.runId) || {};
  const players = {};
  Object.entries(S.mine.roster || {}).forEach(([id, e]) => {
    const c = S.players.get(String(id)) || {}, pk = acc + '|' + id;
    const uses = S.pendingUses[pk] != null ? S.pendingUses[pk] : usesEff(e, id, acc);
    const ci = collectionInfo(id);
    players[id] = { name: e.name || c.name || id, team: e.team || c.team || '', uses, status: e.status || 'ok', injIgnore: !!e.injIgnore, avg: e.avg || c.avg || null, copies: ci.copies, owner: ci.owner };
  });
  const odds = { days: {} };
  Object.entries(S.odds).forEach(([d, o]) => { odds.days[d] = { players: o.players || {}, source: o.source, updatedAt: o.updated_at }; });
  return { run: { name: run.name, prizes: run.prizes || [], days: S.days }, roster: { players }, odds, plan: planOf(acc) };
}
function compute() {
  S.result = null; S.multi = null; S.calcError = null;
  if (!S.runId || !S.mineLoaded) return;
  try {
    if (groupMode()) {
      // plano conjunto: as coleções das contas como se fossem uma só (um Moment joga por uma conta em cada noite)
      const accs = accounts();
      if (!accs.some(a => a.id === S.acc)) S.acc = 'main';
      const base = engineInputs('main');
      S.multi = FB.planGroup(base.run, accs.map(a => { const x = a.id === 'main' ? base : engineInputs(a.id); return { key: a.id, roster: x.roster, plan: x.plan }; }), base.odds, engOpts());
      S.result = S.multi.byKey[S.acc];
    } else {
      S.acc = 'main';
      const x = engineInputs('main'); S.result = FB.planRun(x.run, x.roster, x.odds, x.plan, engOpts());
    }
  } catch (e) { console.error(e); S.calcError = 'Erro no cálculo: ' + (e && e.message); }
}
const mainResult = () => S.multi ? S.multi.byKey.main : S.result;
const curRun = () => S.runs.find(r => r.id === S.runId) || null;
const nextDay = () => { const r = S.result; return r && r.model.days.length ? r.model.days[0].day : null; };
const modeFor = date => ((curPlan().mode || {})[date]) || 'run';
const liveDoc = date => ((curPlan().live || {})[date]) || null;
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
  if (!run) { $('runName').textContent = 'Fastbreak'; $('runMeta').textContent = S.loading ? 'A carregar…' : 'Sem run'; return; }
  $('runName').textContent = run.name;
  const bits = [];
  if (run.fictitious) bits.push('<span class="chip">Teste</span>');
  if (S.days.length) bits.push('<span>' + dShort(S.days[0].date) + ' – ' + dShort(S.days[S.days.length - 1].date) + '</span>');
  if (r) { const nd = nextDay(), m = mainResult(); bits.push('<span>' + (nd ? 'Dia ' + (nd.idx + 1) + ' de ' + S.days.length : 'Terminada') + '</span><span class="rec">' + recordTxt(m.wins, m.losses) + '</span>'); }
  $('runMeta').innerHTML = bits.join('<span aria-hidden="true">·</span>');
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
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
  if (S.loading) { el.innerHTML = empty('A carregar', 'A ler a run e o teu plantel.'); return false; }
  if (!S.runId) {
    el.innerHTML = S.role === 'admin' ? empty('Ainda não há runs', 'Cria a primeira run em Ajustes → Admin, com as datas e os objetivos de cada dia.', '<button class="btn primary" type="button" data-action="goto" data-tab="ajustes" data-sub="admin">Criar run</button>')
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
  const sub = subOf('hoje'), html = [subBar('hoje')];
  if (groupMode()) html.push(accSwitch());
  if (sub === 'porque') {
    html.push(basisDayCard(r, v, d, md, nd) || '<div class="note info">' + (d.noObjective ? 'Este dia ainda não tem objetivo.' : 'Nenhum jogador do teu plantel joga hoje.') + '</div>');
    el.innerHTML = html.join(''); return;
  }
  if (sub === 'comparar') {
    html.push(compareCard(md, d, nd.date, true) || '<div class="note info">' + (d.noObjective ? 'Este dia ainda não tem objetivo.' : 'Nenhum jogador do teu plantel joga hoje.') + '</div>');
    el.innerHTML = html.join(''); return;
  }
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
    '<div class="score"><div class="goal">' + (o ? (nd.objectives || []).filter(x => x && x.stat).map(x => x.target + '<small>' + esc(statShort(x.stat)) + (x.each ? ' cada' : '') + '</small>').join('<small> e </small>') : '<small>Objetivo por definir</small>') + '</div>' +
    (d.noObjective ? '' : '<div class="pbig num c-' + tone(d.P) + '">' + pct(d.P) + '<span>vitória</span></div>') + '</div>' + barHtml +
    (S.multi ? groupLine(nd) : '<div class="seg" role="group" aria-label="Estratégia para hoje"><button type="button" data-action="mode" data-mode="run" aria-pressed="' + (modeFor(nd.date) !== 'allin') + '">Plano da run</button><button type="button" data-action="mode" data-mode="allin" aria-pressed="' + (modeFor(nd.date) === 'allin') + '">Tudo pelo dia</button></div>' +
    impactHtml(r)) + '</div>');
  html.push(todoCard(r, v, d, md, nd, live, tips));
  html.push(liveGamesCard(r, md, nd, live && d.live ? d.live.submitted : d.lineup, live));
  if (S.multi) {
    const cl = S.multi.clashes.filter(c => c.date === nd.date);
    if (cl.length) html.push('<div class="note">O mesmo Moment está fixado em duas contas hoje: ' + cl.map(c => esc(nameOf(c.id)) + ' (' + c.accounts.map(accLabel).map(esc).join(', ') + ')').join(' · ') + '. Só pode jogar por uma.</div>');
  }
  if (d.noObjective) html.push('<div class="note info">' + (S.role === 'admin' ? 'Este dia ainda não tem objetivo. Define-o em Ajustes → Admin.' : 'Este dia ainda não tem objetivo. O admin do grupo ainda não o definiu.') + '</div>');
  if (d.perPlayer) html.push('<div class="note">Hoje o objetivo é por jogador: cada um tem de chegar ao valor sozinho. O plano ainda o calcula como total da equipa, por isso confirma o lineup à mão (e podes submeter menos jogadores).</div>');
  if ((nd.objectives || []).some(x => x && /pip/.test(x.stat))) html.push('<div class="note info">Pontos na área: a ESPN não os dá por jogador, por isso as médias e os valores ao vivo são estimados a partir dos lançamentos de 2. O resultado final vem da blockchain.</div>');
  else if (!(nd.games || []).length) html.push('<div class="note info">Os jogos deste dia ainda não foram carregados do calendário NBA.</div>');
  if (r.normal.conflicts.length) html.push('<div class="note">Fixaste jogadores mais vezes do que os usos que têm: ' + r.normal.conflicts.map(c => esc(nameOf(c.player)) + ' (' + c.used + ' de ' + c.uses + ')').join(', ') + '.</div>');
  if (d.badLocks && d.badLocks.length) {
    const plays = FB.teamsOn(nd), teamOf = id => (r.model.players[r.model.pIndex.get(id)] || {}).team;
    const noGame = d.badLocks.filter(id => !plays.has(teamOf(id))), outNow = d.badLocks.filter(id => plays.has(teamOf(id)));
    if (noGame.length) html.push('<div class="note">Sem jogo hoje, por isso não entram: ' + noGame.map(id => esc(nameOf(id))).join(', ') + '.</div>');
    if (outNow.length) html.push('<div class="note">Fixaste quem está fora hoje (lesão ou estado), por isso não entra: ' + outNow.map(id => esc(nameOf(id)) + (injRec(id) ? ' (' + esc((INJ_LABEL[injRec(id).status] || '').toLowerCase()) + ')' : '')).join(', ') + '. Solta-o ou, se sabes que joga, ignora o relatório na ficha dele.</div>');
  }
  if (live && d.live && (d.live.out.length || d.live.in.length)) {
    const pSub = lineupP(md, d.live.submitted), pNew = d.P, pairs = [];
    for (let i = 0; i < Math.max(d.live.out.length, d.live.in.length); i++) pairs.push('<li>' + (d.live.out[i] ? 'Sai <b>' + esc(nameOf(d.live.out[i])) + '</b>' : '') + (d.live.out[i] && d.live.in[i] ? ' → ' : '') + (d.live.in[i] ? 'entra <b>' + esc(nameOf(d.live.in[i])) + '</b>' : '') + '</li>');
    html.push('<div class="card swap"><h3>Troca recomendada</h3><ul>' + pairs.join('') + '</ul><div class="small muted">Vitória hoje ' + pct(pSub) + ' → <b>' + pct(pNew) + '</b>' + (pNew + 0.005 < pSub ? ' · perde um pouco hoje para guardar usos para a run' : '') + '</div><button class="btn primary" type="button" data-action="swap-done">Fiz a troca</button></div>');
  }
  const locks = new Set(((curPlan().locks || {})[nd.date]) || []);
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
      sub = esc(p.team) + ' ' + esc(opp(p.team, nd)) + injTag(info) + b2bTag(info) + ' · ' + srcShort(info) + formTag(p, o);
    }
    // Moment que ainda está noutra conta: tem de ser mandado antes de este jogo fechar
    const tr = S.multi && (S.profile || {}).collection ? S.multi.transfers.find(t => t.id === id && t.to === S.acc && t.before <= nd.date) : null;
    if (tr) sub = '<span class="pill prov">Mandar de ' + esc(accLabel(tr.from)) + '</span> ' + sub;
    const stp = info.status !== 'ok' ? '<span class="pill ' + info.status + '">' + esc(STATUS[info.status].label) + '</span>' : '';
    return '<li><button class="row" type="button" data-action="player" data-id="' + esc(id) + '" data-date="' + nd.date + '"><div style="min-width:0"><div class="pn">' + (locks.has(id) ? icoLock : '') + '<span class="nm">' + esc(p.name) + '</span>' + stp + '</div><div class="ps">' + sub + '</div></div><div class="pv"><div class="v num">' + val + '</div><div class="u">' + esc(o ? statShort(o.stat) : '') + '</div></div></button></li>';
  }).join('');
  const allFinal = live && d.live.submitted.length && d.live.submitted.every(id => ((lp[id] || {}).state) === 'fim');
  html.push('<div class="card"><div class="list-head"><h2>Lineup</h2><button class="switch" type="button" data-action="live-toggle" aria-pressed="' + live + '"><i></i>Jogo a jogo</button></div>' +
    (d.lineup.length ? '<ul class="list">' + rows + '</ul>' : '<div class="row muted small">' + (S.multi && md.elig.length ? 'Hoje esta conta não joga: os Moments rendem mais nas outras contas.' : 'Nenhum jogador do teu plantel joga hoje.') + '</div>') +
    (allFinal && t ? '<div class="row small">Total final <b class="num" style="margin-left:4px">' + f0(t.known) + '</b> de ' + t.target + ' → ' + (t.known >= t.target ? '<b class="up">ganhaste</b>' : '<b class="down">perdeste</b>') + '</div>' : '') +
    (live ? '<div class="foot" style="grid-template-columns:1fr"><button class="btn" type="button" data-action="live-fetch">Atualizar estatísticas ao vivo</button></div>'
      : (d.lineup.length && !d.noObjective ? '<div class="foot" style="grid-template-columns:1fr"><button class="btn" type="button" data-action="alts">Ver 2 a 3 alternativas para hoje</button></div>' : '')) +
    '<div class="foot"><button class="btn" type="button" data-action="day" data-date="' + nd.date + '">Ajustar</button><button class="btn quiet" type="button" data-action="result-sheet" data-date="' + nd.date + '">Fechar o dia</button></div></div>');
  html.push(todayPlayersCard(r, md, nd), buyTipsCard(2));
  if (d.lineup.length && !d.noObjective) html.push('<div class="card"><button class="cta-row row" type="button" data-action="sub" data-stab="hoje" data-sub="porque"><span><span class="t">Porquê este lineup?</span><span class="s" style="display:block">Odds, lesões, forma e o que cada jogador acrescenta hoje</span></span><span class="muted" aria-hidden="true">›</span></button></div>');
  if (!live && tips.length) html.push('<p class="small muted" style="margin:0 4px">O lineup fecha jogo a jogo. Liga <b>Jogo a jogo</b> quando o primeiro jogo começar: a app prende quem já jogou e sugere trocas para os jogos que faltam.</p>');
  el.innerHTML = html.join('');
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
function liveGamesCard(r, md, nd, ids, live) {
  if (!gamesWindow(nd)) return '';
  if (!S.board || S.board.date !== nd.date) { setTimeout(() => refreshBoard(nd.date), 0); return '<div class="card"><div class="list-head"><h2>Jogos de hoje</h2></div><div class="row small muted" style="display:block">A ler o placar…</div></div>'; }
  const B = S.board.games || [], o = (nd.objectives || [])[0], lp = live ? ((liveDoc(nd.date) || {}).players || {}) : {};
  const rows = (nd.games || []).map(g => {
    const bg = B.find(x => (x.away === g[0] && x.home === g[1]) || (x.home === g[0] && x.away === g[1])) || null;
    const mine = ids.filter(id => { const t = (r.model.players[r.model.pIndex.get(id)] || {}).team; return t === g[0] || t === g[1]; });
    const stat = !bg ? (g[2] ? hm(g[2]) : '') : bg.state === 'pre' ? hm(bg.start || g[2]) : bg.state === 'post' ? 'Final' : bg.detail;
    const sc = bg && bg.state !== 'pre' ? '<b class="num">' + esc(bg.as) + '</b> – <b class="num">' + esc(bg.hs) + '</b>' : '–';
    return '<li class="game-row' + (bg && bg.state === 'in' ? ' on' : '') + (mine.length ? ' mine' : '') + '"><span class="gt">' + teamTag(g[0]) + '</span><span class="gs">' + sc + '</span><span class="gt r">' + teamTag(g[1]) + '</span><span class="gst">' + esc(stat) + '</span>' +
      (mine.length ? '<span class="gm">' + mine.map(id => { const e = lp[id]; return esc(lastName(id)) + (e && e.vals && o && e.vals[o.stat] != null ? ' <b class="num">' + f0(e.vals[o.stat]) + '</b>' : ''); }).join(' · ') + '</span>' : '') + '</li>';
  }).join('');
  return '<div class="card"><div class="list-head"><h2>Jogos de hoje</h2><span class="small muted">' + (S.board.err ? 'sem ligação à ESPN' : 'atualiza a cada minuto') + '</span></div><ul class="list">' + rows + '</ul>' +
    (live ? '' : '<div class="row small muted" style="display:block">Liga o <b>Jogo a jogo</b> para veres as estatísticas dos teus jogadores aqui e as trocas sugeridas.</div>') + '</div>';
}
// O que há para fazer hoje: Moments a mandar entre contas, lesões no lineup, dia por fechar, jogo a jogo
function todoCard(r, v, d, md, nd, live, tips) {
  const items = [], btn = (attrs, html, sub) => '<li><button class="row" type="button" ' + attrs + '><div style="min-width:0"><div class="todo-t">' + html + '</div>' + (sub ? '<div class="ps">' + sub + '</div>' : '') + '</div><span class="muted" aria-hidden="true">›</span></button></li>';
  const today = todayET();
  if (nd.date < today) items.push(btn('data-action="result-sheet" data-date="' + nd.date + '"', 'Regista o resultado do dia ' + (nd.idx + 1), dWeek(nd.date) + ', ' + dShort(nd.date) + ' já acabou. Com o utilizador do Top Shot no perfil e a run ligada, entra sozinho da blockchain.'));
  if (S.multi) {
    if (!(S.profile || {}).collection) items.push(btn('data-action="goto" data-tab="plantel" data-sub="colecao"', 'Lê as carteiras das tuas contas', 'Para o plano saber em que conta está cada Moment e dizer-te o que mandar para onde.'));
    else {
      const due = S.multi.transfers.filter(t => t.before <= nd.date), later = S.multi.transfers.filter(t => t.before > nd.date);
      due.forEach(t => { const day = S.days.find(x => x.date === t.before) || nd, team = (r.model.players[r.model.pIndex.get(t.id)] || {}).team, tt = team ? FB.tipTime(day, team) : null;
        items.push(btn('data-action="player" data-id="' + esc(t.id) + '" data-date="' + nd.date + '"', 'Mandar <b>' + esc(nameOf(t.id)) + '</b> da ' + esc(accLabel(t.from)) + ' para a <b>' + esc(accLabel(t.to)) + '</b>', 'Antes ' + (tt ? 'das ' + hm(new Date(tt).toISOString()) : 'do jogo dele') + '. No Top Shot, oferece o Moment à outra conta; depois lê as carteiras outra vez.')); });
      if (later.length) items.push('<li class="row small muted" style="display:block">Depois: ' + later.slice(0, 3).map(t => esc(lastName(t.id)) + ' para a ' + esc(accLabel(t.to)) + ' até ' + dShort(t.before)).join(' · ') + (later.length > 3 ? ' e mais ' + (later.length - 3) : '') + '.</li>');
    }
  }
  d.lineup.forEach(id => { const pi = r.model.pIndex.get(id), info = md.info[pi][0], j = info.injury;
    if (j && !j.ignored && j.status && !info.liveState) { const tt = FB.tipTime(nd, r.model.players[pi].team);
      items.push(btn('data-action="player" data-id="' + esc(id) + '" data-date="' + nd.date + '"', '<b>' + esc(nameOf(id)) + '</b> está ' + esc((INJ_LABEL[j.rec.status] || '').toLowerCase()) + ': ' + pct(info.pPlay) + ' de jogar', 'Confirma antes do jogo' + (tt ? ' das ' + hm(new Date(tt).toISOString()) : '') + '. Se não for jogar, tira-o do lineup no Top Shot.')); } });
  if (!live && tips.length && Date.now() >= Date.parse(tips[0]) && nd.date >= today) items.push(btn('data-action="live-toggle"', 'Liga o Jogo a jogo', 'O primeiro jogo já começou: a app prende quem já jogou e sugere trocas para os jogos que faltam.'));
  if (!items.length) return '';
  return '<div class="card todo"><div class="list-head"><h2>A fazer</h2><span class="small muted">' + items.filter(x => x.indexOf('<button') >= 0).length + '</span></div><ul class="list">' + items.join('') + '</ul></div>';
}
// Lesões e forma de quem joga hoje (o resumo; o resto em Jogadores)
function todayPlayersCard(r, md, nd) {
  const o = (nd.objectives || [])[0]; if (!o || !md.teams.size) return '';
  const mine = r.model.players.map((p, pi) => ({ p, pi, info: md.info[pi] && md.info[pi][0] })).filter(x => x.info && md.teams.has(x.p.team));
  if (!mine.length) return '';
  const link = x => '<button class="lnk" type="button" data-action="player" data-id="' + esc(x.p.id) + '" data-date="' + nd.date + '">' + esc(lastName(x.p.id)) + '</button>';
  const inj = mine.filter(x => x.info.injury && !x.info.injury.ignored && x.info.injury.status);
  const fm = mine.map(x => ({ x, fi: FB.formInfo(x.p, o.stat) })).filter(z => z.fi && (z.fi.n5 || 0) >= 3 && z.fi.season && z.fi.l5 != null).map(z => Object.assign(z, { d: (z.fi.l5 - z.fi.season) / Math.max(1, Math.abs(z.fi.season)) }));
  const hot = fm.filter(z => z.d >= 0.08).sort((a, b) => b.d - a.d).slice(0, 3), cold = fm.filter(z => z.d <= -0.08).sort((a, b) => a.d - b.d).slice(0, 3);
  const pcs = z => ' <span class="' + (z.d > 0 ? 'up' : 'down') + '">' + (z.d > 0 ? '+' : '−') + Math.abs(Math.round(z.d * 100)) + '%</span>';
  const lines = [['Lesões', inj.length ? inj.map(x => link(x) + ' ' + esc((INJ_LABEL[x.info.injury.rec.status] || '').toLowerCase()) + (x.info.injury.status === 'fora' ? '' : ' (' + pct(x.info.pPlay) + ')')).join(' · ') : (S.injOk ? 'ninguém do teu plantel que joga hoje' : 'relatório ainda não ligado')]];
  if (fm.length) { lines.push(['Em forma', hot.length ? hot.map(z => link(z.x) + pcs(z)).join(' · ') : 'ninguém acima da época']); lines.push(['Fora de forma', cold.length ? cold.map(z => link(z.x) + pcs(z)).join(' · ') : 'ninguém abaixo da época']); }
  return '<div class="card"><div class="list-head"><h2>Quem joga hoje</h2><span class="small muted">' + plural(mine.length, 'jogador teu', 'jogadores teus') + '</span></div>' +
    lines.map(([a, b]) => '<div class="status-line basis-line"><span class="bl">' + a + '</span><span>' + b + '</span></div>').join('') +
    (fm.length ? '<div class="row small muted" style="display:block">Forma: últimos 5 jogos face à época, em ' + esc(statShort(o.stat)) + '. Tudo em <button class="lnk" type="button" data-action="goto" data-tab="plantel" data-sub="forma">Jogadores → Forma</button>.</div>' : '') + '</div>';
}
// Run: lesões do plantel e os dias que afetam
function runInjuriesCard(r) {
  const rows = r.model.players.filter(p => injRec(p.id)).map(p => {
    const pi = r.model.pIndex.get(p.id), rec = injRec(p.id);
    const hits = r.model.days.map(md => { const inf = md.info[pi] && md.info[pi][0]; return inf && inf.injury && !inf.injury.ignored && inf.injury.status && md.teams.has(p.team) ? (md.day.idx + 1) + (inf.injury.status === 'fora' ? ' (fora)' : ' (' + pct(inf.pPlay) + ')') : null; }).filter(Boolean);
    return { p, rec, hits };
  });
  if (!rows.length) return '';
  return '<div class="card inj-list"><div class="list-head"><h2>Lesões no teu plantel</h2><span class="small muted">ESPN, ' + esc(ago(S.injAt)) + '</span></div><ul class="list">' + rows.map(x =>
    '<li><button class="row" type="button" data-action="pl-sheet" data-id="' + esc(x.p.id) + '"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(x.p.name) + '</span><span class="pill ' + INJ_PILL[x.rec.status] + '">' + esc(INJ_LABEL[x.rec.status]) + '</span>' + (x.p.injIgnore ? '<span class="badge">ignorado</span>' : '') + '</div><div class="ps">' + (x.rec.detail ? esc(x.rec.detail) + ' · ' : '') + (x.rec.return_date ? 'regresso previsto ' + dShort(x.rec.return_date) + ' · ' : '') + (x.hits.length ? 'no plano conta nos dias ' + x.hits.join(', ') : 'já não afeta os dias que faltam') + '</div></div></button></li>').join('') + '</ul></div>';
}
// De onde vem o lineup de hoje: odds, lesões, médias, run; e quanto pesa cada jogador (e porque ficam outros de fora)
function basisDayCard(r, v, d, md, nd) {
  if (!d.lineup.length || d.noObjective) return '';
  const date = nd.date, od = S.odds[date];
  const rows = d.lineup.map(id => { const pi = r.model.pIndex.get(id); return { id, pi, info: md.info[pi][0] }; });
  const withOdds = rows.filter(x => ['odds', 'proxy', 'misto'].includes(x.info.src)).length;
  const hasOdds = od && Object.keys(od.players || {}).length;
  const injured = rows.filter(x => x.info.injury && !x.info.injury.ignored && x.info.injury.status);
  const lines = [
    ['Odds', hasOdds ? 'linhas para <b>' + withOdds + ' de ' + rows.length + '</b> do lineup · ' + esc(od.source || 'casas de apostas') + ', ' + esc(ago(od.updated_at)) + (withOdds < rows.length ? '. Quem não tem linha usa as médias.' : '.') : 'ainda não há odds para este dia: conta com as médias. Quando chegarem (à tarde, hora de Lisboa), o plano refaz-se com elas.'],
    ['Lesões', S.injOk ? (injured.length ? injured.map(x => '<b>' + esc(lastName(x.id)) + '</b> ' + esc((INJ_LABEL[x.info.injury.rec.status] || '').toLowerCase()) + ' → ' + pct(x.info.pPlay) + ' de jogar').join(' · ') : 'ninguém do lineup no relatório') + (S.injAt ? ' · ESPN, ' + esc(ago(S.injAt)) : '') : 'o relatório ainda não está ligado (falta o SQL novo ou a tarefa "Lesões").'],
    ['Médias', 'época misturada com os últimos 10 e 5 jogos (forma ' + esc(formName().toLowerCase()) + ') e ajustada ao adversário (no máximo ±10%); só para quem não tem odds.'],
    ['Seguidos', (() => {
      const bb = rows.filter(x => x.info.b2b); if (!bb.length) return 'ninguém do lineup jogou ontem.';
      const noOdds = bb.filter(x => !['odds', 'proxy', 'misto'].includes(x.info.src));
      return bb.map(x => '<b>' + esc(lastName(x.id)) + '</b>').join(', ') + (bb.length > 1 ? ' jogaram' : ' jogou') + ' ontem' +
        (!b2bOn ? ' (ajuste desligado nas Preferências).' : !noOdds.length ? ': as odds já contam com o cansaço.' : ': ' + (noOdds.length < bb.length ? noOdds.map(x => esc(lastName(x.id))).join(', ') + ' não ' + (noOdds.length > 1 ? 'têm' : 'tem') + ' odds e ' : 'sem odds, ') + 'conta' + (noOdds.length > 1 ? 'm' : '') + ' um pouco menos (−3%, ou o que ' + (noOdds.length > 1 ? 'fizeram' : 'fez') + ' na época passada nesses jogos).');
    })()],
    ['Run', r.prizes.length ? 'o lineup é escolhido a pensar nos prémios (' + r.prizes.map((p, i) => p.wins + 'V ' + pct(v.prizeProbs[i])).join(' · ') + '), por isso pode guardar jogadores para dias em que valem mais.' : 'o lineup é escolhido para ter mais vitórias na run toda, não só hoje.'],
  ];
  // sem cada jogador do lineup, quanto cai a vitória de hoje (entra o melhor que sobra com usos)
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
    const reason = !(r.model.uses[pi] > 0) ? 'já não tem usos' : later.length ? 'guardado para ' + (later.length > 1 ? 'os dias ' : 'o dia ') + later.map(x => x.idx + 1).join(', ') : info.pPlay < 1 ? 'só ' + pct(info.pPlay) + ' de jogar' : 'rende menos hoje do que os do lineup';
    return { id, info, reason, swapP, swapOut };
  });
  const pp = x => Math.round(x * 100), signed = n => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');
  const row = (id, name, sub, val) => '<li><button class="row" type="button" data-action="player" data-id="' + esc(id) + '" data-date="' + date + '"><div style="min-width:0"><div class="pn"><span class="nm">' + name + '</span></div><div class="ps">' + sub + '</div></div><div class="pv"><div class="v num">' + val + '</div><div class="u">pp hoje</div></div></button></li>';
  return '<div class="card basis-day"><div class="list-head"><h2>Em que se baseia</h2><span class="small muted">' + dWeek(date) + ', ' + dShort(date) + '</span></div>' +
    lines.map(([a, b]) => '<div class="status-line basis-line"><span class="bl">' + a + '</span><span>' + b + '</span></div>').join('') +
    '<div class="list-head sub-head"><h3>Porquê estes jogadores</h3></div><ul class="list">' +
    why.map(w => row(w.id, esc(nameOf(w.id)), esc(srcShort(w.info)) + (w.info.pPlay < 1 ? ' · ' + pct(w.info.pPlay) + ' de jogar' : '') + ' · sem ele: ' + pct(P) + ' → ' + pct(w.without) + (w.sub ? ' (entrava ' + esc(lastName(w.sub)) + ')' : '') + (pp(w.without) > pp(P) ? ' · está hoje para poupar outros para dias em que rendem mais' : ''), signed(pp(P) - pp(w.without)))).join('') +
    outs.map(x => row(x.id, '<span class="muted">De fora:</span> ' + esc(nameOf(x.id)), esc(x.reason) + (x.swapOut ? ' · no lugar de ' + esc(lastName(x.swapOut)) + ': ' + pct(P) + ' → ' + pct(x.swapP) : ''), signed(x.swapOut ? pp(x.swapP) - pp(P) : 0))).join('') +
    '</ul><div class="row small muted" style="display:block">O número é quanto cada jogador acrescenta à vitória de hoje, em pontos percentuais (pp). Quem fica de fora mesmo a subir o dia de hoje está guardado porque vale mais noutro dia da run. Toca num jogador para ver as contas dele.</div></div>';
}
// várias contas: probabilidade de vitória de cada conta hoje
function groupLine(nd) {
  const g = S.multi;
  return '<div class="impact"><div><b>Plano conjunto das ' + g.keys.length + ' contas.</b></div><div>Hoje: ' + g.keys.map(k => { const dd = g.byKey[k].normal.days.find(x => x.date === nd.date); return esc(accLabel(k)) + ' ' + (dd ? (dd.lineup.length ? '<b class="num">' + pct(dd.P) + '</b>' : 'não joga') : 'dia fechado'); }).join(' · ') + '</div></div>';
}
// Moments a mandar de uma conta para outra (onlyNow: só os que têm de mudar antes do próximo dia)
function transfersCard(onlyNow) {
  const g = S.multi; if (!g) return '';
  if (!(S.profile || {}).collection) return '<div class="note info">Lê as carteiras (Jogadores → Coleção) para o plano saber em que conta está cada Moment e dizer-te o que mandar para onde.</div>';
  const nd = nextDay(), today = nd ? nd.date : null, list = g.transfers;
  const now = list.filter(t => !today || t.before <= today), later = list.filter(t => today && t.before > today);
  const row = t => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(t.id)) + '</span></div><div class="ps">' + esc(accLabel(t.from)) + ' → <b>' + esc(accLabel(t.to)) + '</b> · antes de ' + dWeek(t.before) + ', ' + dShort(t.before) + '</div></div></li>';
  const how = '<div class="row small muted">No Top Shot, oferece o Moment à outra conta. Depois lê as carteiras outra vez (Jogadores → Coleção) para o plano saber.</div>';
  if (onlyNow) {
    if (!now.length) return later.length ? '<p class="small muted" style="margin:0 4px">Hoje não há Moments para mudar de conta. Próxima: ' + esc(nameOf(later[0].id)) + ' para ' + esc(accLabel(later[0].to)) + ' antes de ' + dShort(later[0].before) + '.</p>' : '';
    return '<div class="card"><div class="list-head"><h2>Mandar antes de hoje</h2><span class="small muted">' + now.length + '</span></div><ul class="list">' + now.map(row).join('') + '</ul>' + how + '</div>';
  }
  return '<div class="card"><div class="list-head"><h2>Transferências</h2><span class="small muted">' + (list.length ? list.length + ' na run' : 'nenhuma') + '</span></div>' + (list.length ? '<ul class="list">' + list.map(row).join('') + '</ul>' + how : '<div class="row small muted">Cada conta joga com os Moments que já tem.</div>') + '</div>';
}
// ---- alternativas ao lineup de hoje (cada uma com o resto da run refeito) ----
function evalAlt(mod) {
  if (!S.multi) {
    const x = engineInputs('main'), plan = clone(x.plan); mod(plan);
    const model = FB.buildModel(x.run, x.roster, x.odds, plan, engOpts()), res = FB.optimize(model);
    return { res, total: res.objective };
  }
  const base = engineInputs('main');
  const list = accounts().map(a => { const x = a.id === 'main' ? base : engineInputs(a.id); let plan = x.plan; if (a.id === S.acc) { plan = clone(plan); mod(plan); } return { key: a.id, roster: x.roster, plan }; });
  const g = FB.planGroup(base.run, list, base.odds, engOpts());
  return { res: g.byKey[S.acc].normal, total: g.objective, group: g };
}
const altMods = {
  fix: (date, ids) => plan => { plan.locks = plan.locks || {}; plan.bans = plan.bans || {}; plan.locks[date] = ids.slice(); plan.bans[date] = (plan.bans[date] || []).filter(x => !ids.includes(x)); },
  ban: (date, id) => plan => { plan.bans = plan.bans || {}; plan.bans[date] = (plan.bans[date] || []).concat([id]); if (plan.locks && plan.locks[date]) plan.locks[date] = plan.locks[date].filter(x => x !== id); },
};
async function altSheet() {
  const r = S.result, nd = nextDay(); if (!r || !nd) return;
  const cur = view(), d0 = cur.days[0], baseTotal = S.multi ? S.multi.objective : cur.objective;
  const lockedToday = ((curPlan().locks || {})[nd.date]) || [];
  openSheet('<h3>Alternativas para hoje</h3><div class="small muted" id="altProg">A refazer o plano da run para cada alternativa…</div>' + closeRow());
  await new Promise(res => setTimeout(res, 30));
  const seeds = FB.alternativeSeeds(r.model, cur), out = [], seen = new Set([[...d0.lineup].sort().join('|')]);
  for (let k = 0; k < seeds.length; k++) {
    if (!$('altProg')) return; // fechou a folha
    $('altProg').textContent = 'A refazer o plano da run para cada alternativa… ' + (k + 1) + ' de ' + seeds.length;
    await new Promise(res => setTimeout(res, 20));
    const sd = seeds[k];
    const ids = sd.kind === 'allin' ? sd.lineupIdx.map(i => r.model.players[i].id) : null, banId = sd.kind === 'save' ? r.model.players[sd.player].id : null;
    const mod = ids ? altMods.fix(nd.date, ids) : altMods.ban(nd.date, banId);
    let ev; try { ev = evalAlt(mod); } catch (e) { console.warn(e); continue; }
    const a0 = ev.res.days[0]; if (!a0 || a0.date !== nd.date) continue;
    const key = [...a0.lineup].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
    out.push({ sd, ids: a0.lineup.slice(), banId, ev });
  }
  if (!$('altProg')) return;
  out.sort((x, y) => y.ev.total - x.ev.total);
  const top = out.slice(0, 3);
  const arrow = (x, y, f) => { const a = f(x), c = f(y); return a + ' → <span class="' + (a === c ? '' : y > x ? 'up' : 'down') + '">' + c + '</span>'; };
  const runLine = res => r.prizes.length ? r.prizes.map((p, i) => p.wins + 'V ' + arrow(cur.prizeProbs[i], res.prizeProbs[i], pct)).join(' · ') : arrow(r.wins + cur.expected, r.wins + res.expected, f1) + ' vitórias esperadas';
  S.alts = top;
  const cards = top.map((o, k) => {
    const res = o.ev.res, a0 = res.days[0];
    const title = o.sd.kind === 'allin' ? 'Tudo pelo dia' : 'Guardar ' + esc(nameOf(o.banId)) + ' para depois';
    const later = o.banId ? res.days.filter(x => x.lineup.includes(o.banId)).map(x => x.idx + 1) : [];
    const ins = a0.lineup.filter(id => !d0.lineup.includes(id)), outs = d0.lineup.filter(id => !a0.lineup.includes(id));
    const why = o.sd.kind === 'allin' ? 'O lineup mais forte para hoje, sem pensar no resto da run.' : (later.length ? 'Fica para ' + (later.length > 1 ? 'os dias ' : 'o dia ') + later.join(', ') + '.' : 'Não volta a jogar por esta conta nesta run: o lugar dele hoje rende mais a outros.');
    return '<div class="card panel"><div class="list-head" style="padding:0"><h2>' + (k + 1) + '. ' + title + '</h2>' + (o.ev.total >= baseTotal - 1e-9 ? '<span class="small up">vale o mesmo ou mais</span>' : '') + '</div>' +
      '<div class="small muted">' + why + '</div>' +
      '<div class="small"><b>Entram:</b> ' + (ins.map(id => esc(nameOf(id))).join(', ') || '—') + ' · <b>Saem:</b> ' + (outs.map(id => esc(nameOf(id))).join(', ') || '—') + '</div>' +
      '<div class="small">Hoje: ' + arrow(d0.P, a0.P, pct) + '</div><div class="small">Run: ' + runLine(res) + '</div>' +
      (o.ev.group ? '<div class="small muted">Contas: ' + o.ev.group.keys.map(kk => esc(accLabel(kk)) + ' ' + (r.prizes.length ? r.prizes[0].wins + 'V ' + pct(o.ev.group.byKey[kk].normal.prizeProbs[0]) : '≈ ' + f1(o.ev.group.byKey[kk].wins + o.ev.group.byKey[kk].normal.expected))).join(' · ') + '</div>' : '') +
      '<button class="btn primary" type="button" data-action="alt-use" data-i="' + k + '">Usar esta e refazer o resto da run</button></div>';
  }).join('');
  openSheet('<h3>Alternativas para hoje</h3><div class="small muted">Plano sugerido: vitória hoje <b>' + pct(d0.P) + '</b>' + (r.prizes.length ? ' · ' + r.prizes.map((p, i) => p.wins + 'V ' + pct(cur.prizeProbs[i])).join(' · ') : '') + '. Cada alternativa refaz os outros dias da run com os usos que sobram.</div>' +
    (lockedToday.length ? '<button class="btn" type="button" data-action="alt-reset">Voltar ao lineup sugerido (soltar os fixados de hoje)</button>' : '') +
    (cards || '<div class="note info">Não há alternativas diferentes que façam sentido hoje: o plano sugerido já é o melhor lineup e o mais forte.</div>') + closeRow());
}
function altUse(i) {
  const o = (S.alts || [])[+i], nd = nextDay(); if (!o || !nd) return;
  const plan = curPlan(); (o.ids ? altMods.fix(nd.date, o.ids) : altMods.ban(nd.date, o.banId))(plan);
  closeSheet(); schedule(); saveMine();
  toast('Lineup de hoje fixado. O resto da run foi refeito.');
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
  const r = S.result, v = view(), days = S.days, sub = subOf('run'), html = [subBar('run')];
  if (sub === 'contas' && S.multi) {
    const g = S.multi, P = mainResult().prizes;
    html.push('<div class="card"><div class="list-head"><h2>As tuas contas</h2><span class="small muted">plano conjunto</span></div><ul class="list">' + g.keys.map(k => { const rk = g.byKey[k], vk = rk.normal;
      return '<li><button class="row" type="button" data-action="acc-run" data-acc="' + esc(k) + '"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(accLabel(k)) + '</span></div><div class="ps">' + recordTxt(rk.wins, rk.losses) + ' · esperadas ' + f1(rk.wins + vk.expected) + '</div></div>' + (P.length ? miniAros(P, vk.prizeProbs) : '') + '</button></li>'; }).join('') + '</ul>' +
      '<div class="row small muted" style="display:block">Cada aro é a probabilidade de chegar a esse número de vitórias (cheio = certo). Toca numa conta para ver os prémios dela.</div></div>');
    html.push(transfersCard(false));
    el.innerHTML = html.join(''); return;
  }
  if (sub === 'historico') { html.push(historicoHtml()); el.innerHTML = html.join(''); return; }
  if (S.multi) html.push(accSwitch());
  if (sub === 'analise') { html.push(analiseHtml()); el.innerHTML = html.join(''); return; }
  if (sub === 'dias') {
    const byDate = new Map(v.days.map(d => [d.date, d])), nd = nextDay();
    const rows = days.map((day, i) => {
      const pl = ((curPlan().played || {})[day.date]) || null;
      if (pl && pl.done) return '<li><button class="drow" type="button" data-action="day" data-date="' + day.date + '"><span class="dn">' + (i + 1) + '<small>' + dWeek(day.date) + '</small></span><span style="min-width:0"><span class="d1"><b>' + esc(objsText(day)) + '</b><span class="small muted">' + dShort(day.date) + (pl.chain ? ' · blockchain' : '') + '</span></span><span class="d2" style="display:block">' + ((pl.lineup || []).map(id => esc(lastName(id))).join(' · ') || '—') + '</span></span><span class="pchip ' + (pl.result === 'win' ? 'p-good' : 'p-bad') + '">' + (pl.result === 'win' ? 'V' : 'D') + '</span></button></li>';
      const d = byDate.get(day.date); if (!d) return '';
      const mdd = r.model.days.find(m => m.day.date === day.date), hurt = mdd ? d.lineup.filter(id => { const inf = (mdd.info[r.model.pIndex.get(id)] || [])[0]; return inf && inf.injury && !inf.injury.ignored && inf.injury.status; }) : [];
      return '<li class="' + (nd && nd.date === day.date ? 'is-next' : '') + '"><button class="drow" type="button" data-action="day" data-date="' + day.date + '"><span class="dn">' + (i + 1) + '<small>' + dWeek(day.date) + '</small></span><span style="min-width:0"><span class="d1"><b>' + esc(objsText(day)) + '</b><span class="small muted">' + dShort(day.date) + ' · ' + (day.games || []).length + ' jogos' + (d.hasOdds ? ' · odds' : '') + '</span>' + (hurt.length ? '<span class="pill duv" title="Lesão no lineup: ' + esc(hurt.map(lastName).join(', ')) + '">lesão</span>' : '') + '</span><span class="d2" style="display:block">' + (d.lineup.length ? d.lineup.map(id => esc(lastName(id))).join(' · ') : 'sem jogadores') + '</span></span>' +
        (d.noObjective ? '<span class="pchip p-done">—</span>' : '<span class="pchip p-' + tone(d.P) + ' num">' + pct(d.P) + '</span>') + '</button></li>';
    }).join('');
    html.push('<div class="card"><div class="list-head"><h2>Dias</h2><span class="small muted">vitória prevista em cada dia</span></div><ul class="list">' + rows + '</ul></div>');
    const hard = v.days.filter(d => !d.noObjective && d.P < 0.15 && d.lineup.length);
    if (hard.length) html.push('<p class="small muted" style="margin:0 4px">Dia' + (hard.length > 1 ? 's ' : ' ') + hard.map(d => d.idx + 1).join(', ') + ': muito difícil com o teu plantel. O plano põe lá jogadores com usos a sobrar e guarda as estrelas para onde fazem diferença.</p>');
    el.innerHTML = html.join(''); return;
  }
  html.push(runBoard(r, v), distCard(r, v));
  if (r.model.days.length) html.push(buyTipsCard(3), runInjuriesCard(r), '<div class="card"><button class="cta-row row" type="button" data-action="sub" data-stab="run" data-sub="dias"><span><span class="t">Dia a dia</span><span class="s" style="display:block">Objetivo, lineup e vitória prevista de cada dia</span></span><span class="muted" aria-hidden="true">›</span></button></div>');
  el.innerHTML = html.join('');
}
// Placar da run: vitórias e derrotas, e um aro por patamar de prémio com a probabilidade em palavras
function runBoard(r, v) {
  const left = r.model.days.length, P = r.prizes;
  const head = '<div class="hero-top"><span class="eyebrow">' + (S.multi ? esc(accLabel(S.acc)) : 'A tua run') + '</span><span class="small">' + (left ? plural(left, 'dia por jogar', 'dias por jogar') : 'run terminada') + '</span></div>';
  const rec = '<div class="rec-big num">' + r.wins + '<small>' + (r.wins === 1 ? 'vitória' : 'vitórias') + '</small>' + r.losses + '<small>' + (r.losses === 1 ? 'derrota' : 'derrotas') + '</small></div>';
  if (!P.length) return '<div class="card hero run-board">' + head + rec + '<div class="small">Vitórias esperadas no fim: <b>' + f1(r.wins + v.expected) + '</b> de ' + S.days.length + '. ' + (S.role === 'admin' ? 'Define em Ajustes → Admin quantas vitórias dão prémio' : 'Quando o admin definir os prémios') + ' e o plano passa a lutar por eles.</div></div>';
  const cols = P.map((p, i) => { const x = v.prizeProbs[i], need = p.wins - r.wins;
    return '<div class="aro-col">' + aro(x, p.wins, 64, likely(x)) + '<div><div class="pc num">' + pct(x) + '</div><div class="lk">' + likely(x) + '</div><div class="nd small">' + (need <= 0 ? 'já está' : need > left ? 'já não dá' : 'faltam ' + need + ' em ' + left) + '</div></div></div>'; }).join('');
  const withP = P.map((p, i) => [p, v.prizeProbs[i]]), sure = withP.filter(([, x]) => x >= 0.5).pop(), up = withP.find(([, x]) => x < 0.5);
  const line = sure ? 'A caminho do prémio das <b>' + sure[0].wins + ' vitórias</b>' + (up ? '; o das ' + up[0].wins + ' está em ' + pct(up[1]) + '.' : '.') : up ? 'O prémio mais perto é o das <b>' + up[0].wins + ' vitórias</b>: ' + likely(up[1]).toLowerCase() + '.' : '';
  return '<div class="card hero run-board">' + head + rec + '<div class="aros">' + cols + '</div>' + (line ? '<div class="small">' + line + '</div>' : '') + '</div>';
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
  return '<div class="card"><div class="list-head"><h2>Quantas vitórias no fim</h2><span class="small muted">esperadas ' + f1(base + v.expected) + '</span></div>' +
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
      const v = di === 0 && ((pa.mode || {})[day.date]) === 'allin' && r.allIn ? r.allIn : r.normal, d = v.days[di];
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
      if (date >= today || !sn || !sn.pl) return;
      const lp = ((((pa.live || {})[date]) || {}).players) || {}, act = sn.act || {};
      let ch = false;
      Object.keys(sn.pl).forEach(id => {
        if (act[id] !== undefined) return;
        let x;
        const e = lp[id];
        if (e && e.state === 'fim' && e.vals && sn.o.every(o => e.vals[o.stat] != null)) x = sn.o.map(o => rnd(e.vals[o.stat]));
        if (x === undefined) x = actualFor(id, date, sn.o);
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
  const waitTxt = wn.length ? ' Previsões guardadas à espera dos jogos: ' + (wn.length === 1 ? 'dia ' : 'dias ') + spans(wn) + '.' : '';
  if (!rows.length && !A.obs.length) return '<div class="card panel"><h2>Análise das previsões</h2><div class="small muted">A previsão de cada dia fica guardada sozinha até ao primeiro jogo (basta abrires o site antes). Depois dos jogos vês aqui o previsto ao lado do que aconteceu: vitórias, totais e cada jogador, com e sem odds e em jogos seguidos.' + esc(waitTxt) + '</div></div>';
  if (rows.length) {
    const exp = rows.reduce((s, x) => s + x.P, 0), wins = rows.filter(x => x.win).length, fav = rows.filter(x => (x.P >= 0.5) === x.win).length;
    const tot = rows.filter(x => x.pred != null && x.actual != null), inside = tot.filter(x => x.sd > 0 && Math.abs(x.actual - x.pred) <= x.sd).length;
    const bias = tot.length ? tot.reduce((s, x) => s + (x.actual - x.pred) / Math.max(1, x.pred), 0) / tot.length : null;
    const buckets = [[0, 0.35, 'Menos de 35%'], [0.35, 0.65, '35% a 65%'], [0.65, 1.01, 'Mais de 65%']].map(([lo, hi, l]) => { const b = rows.filter(x => x.P >= lo && x.P < hi); return b.length ? { l, n: b.length, p: b.reduce((s, x) => s + x.P, 0) / b.length, w: b.filter(x => x.win).length } : null; }).filter(Boolean);
    html.push('<div class="card hero an-board"><div class="hero-top"><span class="eyebrow">' + (S.multi ? esc(accLabel(S.acc)) + ' · ' : '') + 'Previsto vs real</span><span class="small">' + plural(rows.length, 'dia fechado', 'dias fechados') + '</span></div>' +
      '<div class="an-kpis"><div><div class="label">Vitórias</div><div class="v num">' + wins + '<small> de ' + rows.length + '</small></div><div class="small">previstas ' + f1(exp) + '</div></div>' +
      '<div><div class="label">Favorito</div><div class="v num">' + fav + '<small> de ' + rows.length + '</small></div><div class="small">acertou quem ganhava</div></div>' +
      (tot.length ? '<div><div class="label">Total</div><div class="v num">' + inside + '<small> de ' + tot.length + '</small></div><div class="small">perto do previsto (normal: 7 em 10)</div></div>' : '') + '</div>' +
      '<div class="small">' + (bias != null ? 'Os totais saíram em média <b>' + signPct(bias) + '</b> do previsto. ' : '') + (rows.length >= 4 ? (Math.abs(wins - exp) <= Math.max(1, Math.sqrt(rows.reduce((s, x) => s + x.P * (1 - x.P), 0))) ? 'As vitórias estão dentro do que a previsão esperava.' : wins > exp ? 'Ganhaste mais do que a previsão dava: pode estar a ser prudente demais.' : 'Ganhaste menos do que a previsão dava: pode estar otimista demais (ou azar).') : 'Com poucos dias ainda não dá para tirar conclusões.') + '</div></div>');
    if (buckets.length > 1) html.push('<div class="card"><div class="list-head"><h2>A previsão acerta?</h2><span class="small muted">dias agrupados pela vitória prevista</span></div><ul class="list">' + buckets.map(b => '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + b.l + '</span></div><div class="ps">' + plural(b.n, 'dia', 'dias') + ' · previsto em média ' + pct(b.p) + '</div></div><div class="pv"><div class="v num">' + Math.round(b.w / b.n * 100) + '%</div><div class="u">' + b.w + ' de ' + b.n + ' ganhos</div></div></li>').join('') + '</ul><div class="row small muted" style="display:block">Com uma previsão certa, os dias de “mais de 65%” ganham-se quase sempre e os de “menos de 35%” raramente. Com poucos dias, a sorte pesa muito.</div></div>');
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
    const prow = x => '<li><button class="row" type="button" data-action="pform" data-id="' + esc(x.id) + '"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(x.id)) + '</span></div><div class="ps">' + plural(x.R.n, 'jogo', 'jogos') + (x.dnp ? ' · faltou a ' + x.dnp : '') + '</div></div><span class="delta ' + (x.R.r >= 1 ? 'up' : 'down') + ' num">' + signPct(x.R.r - 1) + '<small>vs previsto</small></span></button></li>';
    if (up.length || down.length) html.push('<div class="card"><div class="list-head"><h2>Jogadores</h2><span class="small muted">o que fizeram face ao previsto</span></div><ul class="list">' + up.map(prow).join('') + down.map(prow).join('') + '</ul><div class="row small muted" style="display:block">Todos os do teu plantel que jogavam em cada dia (não só os do lineup), na estatística desse dia. Só quem tem 2 ou mais jogos e ficou 12% ou mais acima ou abaixo.</div></div>');
    const odds = ratioOf(obs.filter(x => x.src === 'o')), avgs = ratioOf(obs.filter(x => x.src === 'a')), b2b = ratioOf(obs.filter(x => x.b2b)), rest = ratioOf(obs.filter(x => !x.b2b));
    const miss = obs.filter(x => x.act == null), missQ = miss.length ? miss.reduce((s, x) => s + x.q, 0) / miss.length : null;
    const line = (l, R, note) => R ? '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + l + '</span></div><div class="ps">' + plural(R.n, 'jogo', 'jogos') + ' · erro médio ' + Math.round(R.err * 100) + '%' + (note ? ' · ' + note : '') + '</div></div><div class="pv"><div class="v num">' + Math.round(R.r * 100) + '%</div><div class="u">do previsto</div></div></li>' : '';
    html.push('<div class="card"><div class="list-head"><h2>De onde veio a previsão</h2><span class="small muted">' + plural(obs.length, 'jogo', 'jogos') + '</span></div><ul class="list">' +
      line('Com odds', odds, 'linhas das casas de apostas') + line('Só com médias', avgs, 'sem linha para esse jogador') + line('Jogos seguidos (2.º dia)', b2b, b2bOn ? 'o plano tira ~3% sem odds' : 'ajuste desligado') + line('Com descanso', rest) +
      (miss.length ? '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">Não jogaram</span></div><div class="ps">' + plural(miss.length, 'vez', 'vezes') + ' · o plano dava-lhes em média ' + pct(missQ) + ' de jogar</div></div></li>' : '') +
      '</ul><div class="row small muted" style="display:block">100% = fizeram exatamente o previsto. O erro médio é a diferença típica de cada jogo (o basquetebol varia muito: 25 a 40% é normal num jogador só). Se os jogos seguidos ficarem bem abaixo dos outros, o ajuste das Preferências compensa.</div></div>');
  }
  if (waitTxt) html.push('<p class="small muted" style="margin:0 4px">' + esc(waitTxt.trim()) + '</p>');
  return html.join('');
}
// folha de um dia fechado: previsto ao lado do real, jogador a jogador
function predVsActualHtml(date) {
  const sn = (curPlan().proj || {})[date]; if (!sn || !(sn.o || []).length) return '';
  const pl = ((curPlan().played || {})[date]) || {}, act = sn.act || {}, o = sn.o[0], u = esc(statShort(o.stat));
  const lineup = (pl.lineup || []).length ? pl.lineup : sn.lineup;
  const val = a => (a === undefined ? '<div class="v num muted">…</div>' : a === null ? '<div class="small muted" style="font-weight:600">não jogou</div>' : '<div class="v num">' + f1(a[0]) + '</div>');
  const rows = lineup.map(id => { const x = sn.pl[id], a = act[id], d = x && a ? a[0] - x[0][0] : null;
    return '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(id)) + '</span>' + (x && x[3] ? '<span class="badge">2.º seguido</span>' : '') + '</div><div class="ps">previsto ' + (x ? f1(x[0][0]) + (x[4] < 1 ? ' (' + pct(x[4]) + ' de jogar)' : '') + ' · ' + (x[2] === 'o' ? 'odds' : 'médias') : '—') + '</div></div><div class="pv">' + val(a) + '<div class="u">' + (d != null ? '<span class="' + (d >= 0 ? 'good-t' : 'warn-t') + '">' + (d >= 0 ? '+' : '−') + f1(Math.abs(d)) + '</span>' : u) + '</div></div></li>'; }).join('');
  const others = Object.entries(sn.pl).filter(([id]) => !lineup.includes(id) && act[id]).map(([id, x]) => ({ id, d: act[id][0] - x[0][0], a: act[id][0] })).filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
  const A = analysisData(S.acc).rows.find(x => x.date === date);
  return '<div class="card"><div class="list-head"><h2>Previsto vs real</h2><span class="small muted">previsão das ' + esc(hm(sn.at)) + '</span></div>' +
    '<div class="kv" style="padding:0 14px 10px"><div><div class="label">Vitória prevista</div><div class="v num">' + pct(sn.P) + '</div></div><div><div class="label">Total previsto</div><div class="v num">' + (A && A.pred != null ? f0(A.pred) : f0(o.mu)) + '</div><div class="small muted">± ' + f0(A && A.sd != null ? A.sd : o.sd) + ' · alvo ' + o.T + '</div></div><div><div class="label">Feito</div><div class="v num">' + (A && A.actual != null ? f0(A.actual) : '…') + '</div></div></div>' +
    '<ul class="list">' + rows + '</ul>' + (others.length ? '<div class="row small muted" style="display:block">Fora do lineup, quem fez mais do que o previsto: ' + others.map(x => esc(lastName(x.id)) + ' ' + f1(x.a) + ' (+' + f1(x.d) + ')').join(' · ') + '.</div>' : '') +
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
  if (!res.length && !(F && F.days)) return '<div class="card panel"><h2>Histórico</h2><div class="small muted">Ainda não há dias lidos da blockchain. A tarefa “Fast Break na blockchain” vai buscar aos poucos todos os dias que jogaste (todas as runs, também as passadas) com o utilizador do Top Shot de cada conta. Volta daqui a umas horas.</div></div>';
  const W = res.filter(x => x.win).length, runsSeen = new Set(res.map(x => x.chain_run_id));
  const accN = new Set(res.map(x => x.account || 'main')).size;
  html.push('<div class="card hero an-board"><div class="hero-top"><span class="eyebrow">O teu Fast Break</span><span class="small">' + plural(runsSeen.size, 'run', 'runs') + (accN > 1 ? ' · ' + accN + ' contas' : '') + '</span></div>' +
    '<div class="an-kpis"><div><div class="label">Dias jogados</div><div class="v num">' + res.length + '</div></div><div><div class="label">Vitórias</div><div class="v num">' + W + '</div><div class="small">' + (res.length ? Math.round(W / res.length * 100) + '% dos dias' : '') + '</div></div></div></div>');
  // estatísticas: quantas vezes saem, alvo típico e como te corre cada uma
  if (F && F.stats.length) {
    const mine = {}; res.forEach(x => { const g = H.games.get(x.game_id); gameObjs(g).forEach(o => { const e = (mine[o.stat] = mine[o.stat] || { n: 0, w: 0 }); e.n++; if (x.win) e.w++; }); });
    const max = F.stats[0].n;
    html.push('<div class="card"><div class="list-head"><h2>Estatísticas que mais saem</h2><span class="small muted">' + F.days + ' dias' + (F.classic ? ' Classic' : '') + ' · ' + plural(F.runs, 'run', 'runs') + '</span></div><ul class="list">' + F.stats.slice(0, 12).map(e => { const m = mine[e.stat];
      return '<li class="row hist-stat"><div style="min-width:0;flex:1"><div class="pn"><span class="nm">' + esc(statLabel(e.stat)) + '</span><span class="small muted">' + Math.round(e.n / F.days * 100) + '% dos dias</span></div><div class="hbar" aria-hidden="true"><i style="width:' + Math.max(3, e.n / max * 100).toFixed(1) + '%"></i></div>' +
        '<div class="ps">' + (e.med != null ? 'alvo típico <b class="num">' + f0(e.med) + '</b>' + (e.lo !== e.hi ? ' (' + f0(e.lo) + '–' + f0(e.hi) + ')' : '') : '') + (e.each ? (e.med != null ? ' · ' : '') + e.each + '× por jogador' : '') + (m ? ' · tu: ' + m.w + ' de ' + m.n + ' ganhos' : '') + '</div></div><div class="pv"><div class="v num">' + e.n + '</div><div class="u">dias</div></div></li>'; }).join('') + '</ul>' +
      '<div class="row small muted" style="display:block">Para escolher Moments: os jogadores fortes nas estatísticas que mais saem jogam mais vezes. Vê quem são em Jogadores → Comprar → Especialistas.</div></div>');
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
  html.push('<p class="small muted" style="margin:0 4px">Da blockchain, lido pela tarefa “Fast Break na blockchain”. Os dias antigos entram aos poucos (algumas centenas de cada vez).</p>');
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
  if (!col) return '<div class="card panel"><h2>A tua coleção</h2><div class="small muted">' + (withFlow.length ? 'Lê os teus Moments da blockchain: ficam guardados e servem para todas as runs.' : 'Põe o endereço Flow da tua carteira Dapper em Ajustes → Perfil (e o das contas smurf) para ler os teus Moments.') + '</div>' +
    (withFlow.length ? '<button class="btn primary" type="button" data-action="wallet-sheet">Ler carteira' + (withFlow.length > 1 ? 's' : '') + '</button>' : '<button class="btn" type="button" data-action="goto" data-tab="ajustes" data-sub="perfil">Ir a Ajustes</button>') + '</div>';
  const n = Object.keys(col.players || {}).length;
  const tot = Object.entries(col.accounts || {}).map(([k, t]) => (groupMode() ? esc(accLabel(k)) + ' ' : '') + t.moments + ' Moments').join(' · ');
  const head = '<div class="list-head"><h2>A tua coleção</h2><span class="small muted">lida ' + esc(ago(col.read_at)) + '</span></div><div class="small muted">' + tot + ' · ' + n + ' jogadores na NBA</div>';
  if (compact) return '<div class="card panel">' + head + '<div class="btns"><button class="btn" type="button" data-action="wallet-sheet">Ler de novo</button><button class="btn" type="button" data-action="col-sheet">Ver coleção</button></div></div>';
  return '<div class="card panel">' + head + '<button class="btn" type="button" data-action="wallet-sheet">Ler de novo</button></div>' + collectionList();
}
function collectionList() {
  const col = (S.profile || {}).collection; if (!col) return '';
  const list = Object.entries(col.players || {}).map(([id, c]) => ({ id, c, p: S.players.get(String(id)) || { name: c.name } }))
    .sort((a, b) => ((b.p.avg && +b.p.avg.pts) || 0) - ((a.p.avg && +a.p.avg.pts) || 0));
  return '<div class="card"><div class="list-head"><h2>Jogadores</h2><span class="small muted">' + list.length + '</span></div><ul class="list">' + list.map(({ c, p }) =>
    '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name || c.name) + '</span></div><div class="ps">' + esc(p.team || '—') + ' · ' + c.moments + ' Moment' + (c.moments > 1 ? 's' : '') +
    (groupMode() ? ' · ' + Object.entries(c.owners || {}).map(([k, x]) => esc(accLabel(k)) + (x > 1 ? ' ×' + x : '')).join(', ') : '') + ((c.sets || []).length ? ' · ' + c.sets.slice(0, 3).map(esc).join(', ') : '') + '</div></div>' +
    (p.avg ? '<div class="pv"><div class="v num">' + f1(+p.avg.pts || 0) + '</div><div class="u">PTS</div></div>' : '') + '</li>').join('') + '</ul></div>';
}
// campo de texto com o cursor lá dentro (não redesenhar por cima do que se está a escrever)
function typingField(id) { const ae = document.activeElement, box = $(id); return !!(ae && box && box.contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)); }
function renderPlantel() {
  const el = $('tab-plantel');
  if (S.loading) { el.innerHTML = empty('A carregar', 'A ler a run e o teu plantel.'); return; }
  const sub = subOf('plantel');
  if (!$('plSubBar')) el.innerHTML = '<div id="plSubBar"></div><div id="plSub" class="stack"></div>';
  $('plSubBar').innerHTML = subBar('plantel');
  const box = $('plSub');
  if (box.dataset.sub !== sub) { box.innerHTML = ''; box.dataset.sub = sub; }
  else if (sub !== 'plantel' && typingField('plSub')) return;
  if (sub === 'forma') { box.innerHTML = formaHtml(); return; }
  if (sub === 'lesoes') { box.innerHTML = lesoesHtml(); return; }
  if (sub === 'comprar') { box.innerHTML = buyHtml(); return; }
  if (sub === 'colecao') { box.innerHTML = collectionCard(false); return; }
  if (!S.runId || S.calcError) {
    box.innerHTML = collectionCard(false) + (S.calcError ? empty('Erro', S.calcError) : '<p class="small muted" style="margin:0 4px">Quando houver uma run, os jogadores da coleção passam para o plantel dessa run, onde acertas os usos e vês o plano.</p>');
    return;
  }
  const ids = Object.keys(S.mine.roster || {});
  if (!$('rosterFilter')) {
    box.innerHTML = '<div class="toolbar"><input class="field" id="rosterFilter" type="search" placeholder="Procurar no plantel" value="' + esc(S.filter) + '" aria-label="Procurar no plantel"><button class="btn" type="button" data-action="add-player">Adicionar</button></div><div id="plBody" class="stack"></div>';
  }
  const body = $('plBody'), run = curRun() || {};
  if (!ids.length) {
    const prev = S.runs.filter(x => x.id !== S.runId), col = (S.profile || {}).collection, nCol = col ? Object.keys(col.players || {}).length : 0;
    body.innerHTML = collectionCard(true) + empty('Plantel da ' + (run.name || 'run') + ' vazio', nCol ? 'Junta os jogadores da tua coleção e depois acerta os usos de cada um nesta run.' : 'Lê os jogadores dos teus Moments da blockchain, ou junta-os à mão. Depois acerta os usos de cada um nesta run.',
      (nCol ? '<button class="btn primary" type="button" data-action="col-to-roster" style="width:100%;max-width:340px">Juntar os ' + nCol + ' jogadores da coleção</button>' : '<button class="btn primary" type="button" data-action="wallet-sheet" style="width:100%;max-width:340px">Ler da minha carteira</button>') +
      '<div class="btns" style="width:100%;max-width:340px"><button class="btn" type="button" data-action="add-player">Adicionar</button><button class="btn" type="button" data-action="paste-sheet">Colar lista</button></div>' +
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
  const cols = 'minmax(72px,1fr) repeat(' + days.length + ', 20px) 34px';
  const head = '<div class="mx-row head" style="grid-template-columns:' + cols + '"><span style="text-align:left">Jogador</span>' + days.map((d, i) => '<span class="' + (nd && nd.date === d.date ? 'nx' : '') + '">' + (i + 1) + '</span>').join('') + '<span style="text-align:right">Usos</span></div>';
  const rows = list.map(p => {
    const set = planned[p.id] || new Set();
    const cells = days.map(day => {
      const nx = nd && nd.date === day.date ? ' nx' : '', pl = played[day.date];
      if (pl && pl.done) return '<span class="cell' + nx + '">' + ((pl.lineup || []).includes(p.id) ? '<i class="dot used"></i>' : '') + '</span>';
      if (set.has(day.date)) return '<span class="cell' + nx + '"><i class="dot on"></i></span>';
      const oth = (elsewhere[p.id] || {})[day.date];
      if (oth) return '<span class="cell' + nx + '" title="Joga pela ' + esc(oth.join(' e ')) + ' nesta noite"><i class="dot other"></i></span>';
      return '<span class="cell' + nx + '">' + (FB.teamsOn(day).has(p.team) ? '<i class="dot off"></i>' : '') + '</span>';
    }).join('');
    const n = set.size, u = p.uses || 0;
    const ir = injRec(p.id);
    const st = (p.status && p.status !== 'ok' ? '<span class="pill ' + p.status + '">' + esc(STATUS[p.status].label.slice(0, 3)) + '</span>' : '') +
      (ir && !p.injIgnore ? '<span class="pill ' + INJ_PILL[ir.status] + '" title="Lesão: ' + esc(INJ_LABEL[ir.status]) + '">' + INJ_SHORT[ir.status] + '</span>' : '');
    return '<button class="mx-row" type="button" data-action="pl-sheet" data-id="' + esc(p.id) + '" style="grid-template-columns:' + cols + '"><span class="mx-name"><span style="overflow:hidden;text-overflow:ellipsis">' + esc(lastName(p.id)) + '</span>' + st + '</span>' + cells + '<span class="mx-uses num' + (n >= u && u > 0 ? ' full' : '') + '">' + n + '/' + u + '</span></button>';
  }).join('');
  const totalU = r.model.uses.reduce((a, b) => a + b, 0), totalP = Object.values(v.usage).reduce((a, b) => a + b, 0);
  let usedTot = 0; Object.values(played).forEach(pl => { if (pl && pl.done) usedTot += (pl.lineup || []).length; });
  const closed = Object.values(played).filter(pl => pl && pl.done).length;
  body.innerHTML = accSwitch() +
    '<div class="card"><div class="list-head"><h2>' + esc(run.name || 'Run') + (groupMode() ? ' · ' + esc(accLabel(S.acc)) : '') + '</h2><button class="btn small" type="button" data-action="uses-sheet">Acertar usos</button></div>' +
    '<div class="kv" style="padding:0 14px 10px"><div><div class="label">Usados</div><div class="v num">' + usedTot + '</div><div class="small muted">' + closed + ' dia' + (closed === 1 ? '' : 's') + ' fechado' + (closed === 1 ? '' : 's') + '</div></div><div><div class="label">Restantes</div><div class="v num">' + totalU + '</div><div class="small muted">' + ids.length + ' jogadores</div></div><div><div class="label">No plano</div><div class="v num">' + totalP + '</div><div class="small muted">até ao fim</div></div></div>' +
    '<div class="mx-wrap"><div class="mx">' + head + (rows || '<div class="mx-row muted small">Nenhum jogador encontrado.</div>') + '</div></div>' +
    '<div class="legend"><span><i class="dot used"></i>já usado</span><span><i class="dot on"></i>no plano</span>' + (S.multi ? '<span><i class="dot other"></i>na outra conta</span>' : '') + '<span><i class="dot off"></i>tem jogo</span><span>usos = no plano / restantes' + (S.multi ? ' nesta conta' : '') + '</span></div>' +
    (S.multi ? '<div class="small muted" style="padding:0 14px 12px">Os usos são de cada conta, mas um Moment só joga por uma conta em cada noite: com um só Moment de um jogador, o plano nunca o põe nas duas no mesmo dia (manda-o de uma para a outra entre noites).</div>' : '') + '</div>' +
    '<div class="btns"><button class="btn" type="button" data-action="paste-sheet">Colar lista</button><button class="btn" type="button" data-action="add-player">Adicionar jogador</button></div>' +
    '<p class="small muted" style="margin:0 4px">Toca num jogador para ver quantas vezes já o usaste e mudar os usos' + (groupMode() ? ' de cada conta' : '') + ' ou o estado.</p>';
}
// jogadores do plantel que estão no relatório de lesões
// ---- cores das equipas (pontinho ao lado da sigla) ----
const TEAM_COLOR = { ATL: '#E03A3E', BOS: '#007A33', BKN: '#3A3A3A', CHA: '#1D1160', CHI: '#CE1141', CLE: '#860038', DAL: '#00538C', DEN: '#0E2240', DET: '#C8102E', GSW: '#1D428A', HOU: '#CE1141', IND: '#002D62', LAC: '#C8102E', LAL: '#552583', MEM: '#5D76A9', MIA: '#98002E', MIL: '#00471B', MIN: '#236192', NOP: '#0C2340', NYK: '#F58426', OKC: '#007AC1', ORL: '#0077C0', PHI: '#006BB6', PHX: '#E56020', POR: '#E03A3E', SAC: '#5A2D81', SAS: '#8A8D8F', TOR: '#CE1141', UTA: '#753BBD', WAS: '#002B5C' };
const teamTag = t => (t ? '<span class="tdot" style="background:' + (TEAM_COLOR[t] || 'var(--faint)') + '" aria-hidden="true"></span> ' + esc(t) : '—');
const playerObj = id => { const c = S.players.get(String(id)) || {}, e = (S.mine.roster || {})[id] || {}; return { id: String(id), name: e.name || c.name || String(id), team: e.team || c.team || '', avg: e.avg || c.avg || null }; };
// ---- Forma: últimos 5 jogos face à época ----
S.forma = { scope: 'mine', stat: null };
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
function formaHtml() {
  const F = S.forma, nd = nextDay && S.result ? nextDay() : null, o = nd && (nd.objectives || [])[0];
  const stats = (o && o.stat && !FORM_STATS.includes(o.stat) ? [o.stat] : []).concat(FORM_STATS);
  const stat = F.stat && stats.includes(F.stat) ? F.stat : (o && o.stat) || 'pts';
  const mineIds = S.runId && Object.keys(S.mine.roster || {}).length ? Object.keys(S.mine.roster) : Object.keys((((S.profile || {}).collection) || {}).players || {});
  const pool = F.scope === 'mine' ? mineIds.map(playerObj) : [...S.players.values()].filter(p => p.avg && p.avg.form && (+p.avg.min || 0) >= 18).map(p => playerObj(p.id));
  const rows = pool.map(p => { const fi = FB.formInfo(p, stat); if (!fi || fi.l5 == null || fi.season == null || (fi.n5 || 0) < 3) return null; return { p, fi, d: (fi.l5 - fi.season) / Math.max(1, Math.abs(fi.season)) }; }).filter(Boolean).sort((a, b) => b.d - a.d);
  const head = '<div class="card panel filters"><h2>Forma</h2><div class="small muted">Média dos últimos 5 jogos comparada com a da época. As barras são os últimos 5 jogos (o mais recente à direita); a linha é a média da época.</div>' +
    '<div class="seg acc-seg" role="group" aria-label="Que jogadores"><button type="button" data-action="forma-scope" data-v="mine" aria-pressed="' + (F.scope === 'mine') + '">Os meus</button><button type="button" data-action="forma-scope" data-v="all" aria-pressed="' + (F.scope === 'all') + '">Toda a NBA</button></div>' +
    '<div class="chips scroll" role="group" aria-label="Estatística">' + stats.map(k => '<button type="button" data-action="forma-stat" data-v="' + esc(k) + '" aria-pressed="' + (k === stat) + '">' + esc(statName(k)) + (o && k === o.stat ? ' · hoje' : '') + '</button>').join('') + '</div></div>';
  if (!rows.length) return head + '<div class="note info">' + (pool.length ? 'A forma aparece depois de cada jogador ter 3 jogos desta época (vem da tarefa Calendário e médias NBA).' : F.scope === 'mine' ? 'Ainda não tens jogadores no plantel nem a coleção lida.' : 'Ainda não há jogos desta época.') + '</div>';
  const u = esc(statName(stat));
  const row = x => { const pc = Math.round(x.d * 100), cls = pc >= 8 ? 'up' : pc <= -8 ? 'down' : '', ir = injRec(x.p.id);
    return '<li><button class="frow" type="button" data-action="pform" data-id="' + esc(x.p.id) + '"><span style="min-width:0"><span class="pn"><span class="nm">' + esc(x.p.name) + '</span>' + (ir ? '<span class="pill ' + INJ_PILL[ir.status] + '">' + INJ_SHORT[ir.status] + '</span>' : '') + (F.scope === 'all' && S.mine.roster[x.p.id] ? '<span class="badge">teu</span>' : '') + '</span>' +
      '<span class="ps">' + teamTag(x.p.team) + ' · últimos 5: <b class="num">' + f1(x.fi.l5) + '</b> · época ' + f1(x.fi.season) + ' ' + u + '</span></span>' + sparkSvg(((x.p.avg || {}).form || {}).games, stat, x.p.avg, x.fi.season) +
      '<span class="delta ' + cls + ' num">' + (pc > 0 ? '+' : pc < 0 ? '−' : '') + Math.abs(pc) + '%<small>vs época</small></span></button></li>'; };
  const hot = rows.filter(x => x.d >= 0.08), cold = rows.filter(x => x.d <= -0.08).reverse(), steady = rows.filter(x => x.d > -0.08 && x.d < 0.08);
  const lim = F.scope === 'all' ? 12 : 99;
  const card = (title, list, note) => list.length ? '<div class="card"><div class="list-head"><h2>' + title + '</h2><span class="small muted">' + (note || list.length) + '</span></div><ul class="list">' + list.slice(0, lim).map(row).join('') + '</ul></div>' : '';
  return head + card('Em forma', hot, F.scope === 'all' ? 'os ' + Math.min(lim, hot.length) + ' que mais subiram' : '') + card('Fora de forma', cold, F.scope === 'all' ? 'os ' + Math.min(lim, cold.length) + ' que mais desceram' : '') + (F.scope === 'mine' ? card('Como na época', steady) : '');
}
// ---- Lesões: o teu plantel primeiro, depois os jogadores importantes do resto da NBA ----
const INJ_ORDER = { ofs: 0, out: 1, doubtful: 2, questionable: 3, dtd: 4, probable: 5 };
function injRow(rec, action) {
  const c = S.players.get(rec.id) || {};
  return '<li><button class="row" type="button" data-action="' + action + '" data-id="' + esc(rec.id) + '"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(c.name || rec.name) + '</span><span class="pill ' + INJ_PILL[rec.status] + '">' + esc(INJ_LABEL[rec.status]) + '</span>' + (((S.mine.roster || {})[rec.id] || {}).injIgnore ? '<span class="badge">ignorado</span>' : '') + '</div>' +
    '<div class="ps">' + teamTag(c.team || rec.team) + (rec.detail ? ' · ' + esc(rec.detail) : '') + (rec.return_date ? ' · regresso previsto ' + dShort(rec.return_date) : '') + (rec.comment ? ' · ' + esc(rec.comment) : '') + '</div></div></button></li>';
}
function lesoesHtml() {
  if (!S.injOk) return '<div class="note info">O relatório de lesões ainda não está ligado: o admin tem de correr o supabase/schema.sql novo no Supabase e a tarefa "Lesões" no GitHub.</div>';
  const all = Object.values(S.injuries || {}).sort((a, b) => (INJ_ORDER[a.status] - INJ_ORDER[b.status]) || String(a.name).localeCompare(String(b.name)));
  const mine = all.filter(x => (S.mine.roster || {})[x.id]);
  const imp = x => { const c = S.players.get(x.id); return c && c.avg && ((+c.avg.min || 0) >= 20 || (+c.avg.pts || 0) >= 12); };
  const others = all.filter(x => !(S.mine.roster || {})[x.id] && imp(x));
  return '<div class="card inj-list"><div class="list-head"><h2>No teu plantel</h2><span class="small muted">ESPN, ' + esc(ago(S.injAt)) + '</span></div>' + (mine.length ? '<ul class="list">' + mine.map(x => injRow(x, 'pl-sheet')).join('') + '</ul>' : '<div class="row small muted" style="display:block">Ninguém do teu plantel está no relatório de lesões.</div>') + '</div>' +
    '<div class="card inj-list"><div class="list-head"><h2>Resto da NBA</h2><span class="small muted">' + others.length + ' importantes de ' + all.length + '</span></div>' + (others.length ? '<ul class="list">' + others.map(x => injRow(x, 'pform')).join('') + '</ul>' : '<div class="row small muted" style="display:block">Nenhum jogador importante no relatório.</div>') +
    '<div class="row small muted" style="display:block">Só jogadores com 20 ou mais minutos ou 12 ou mais pontos por jogo. No plano: fora → não joga; pouco provável → 25%; dúvida ou dia a dia → 50%; provável → 90% (no próximo jogo dele).</div></div>';
}
// ficha de um jogador que não está no plantel (forma, lesões, compras)
function catalogSheet(id) {
  const c = S.players.get(String(id)); if (!c) return;
  if ((S.mine.roster || {})[id]) { rosterSheet(id); return; }
  const avg = c.avg, fi = avg ? FB.formInfo({ avg }, 'pts') : null;
  openSheet('<h3>' + esc(c.name) + '</h3><div class="small muted">' + teamTag(c.team) + (c.gp ? ' · ' + c.gp + ' jogos esta época' : '') + '</div>' + injuryBlock(String(id), null, null) +
    (avg ? '<div><div class="label" style="margin-bottom:6px">Médias por jogo</div><div class="kv sm">' + AVG_SHOW.map(k => { const a = FB.avgOf({ avg }, k); return a ? '<div><div class="label">' + STATS[k].short + (a.est ? '*' : '') + '</div><div class="v num">' + f1(a.v) + '</div></div>' : ''; }).join('') + '</div></div>' : '<div class="note info">Ainda sem médias para este jogador.</div>') +
    (fi && fi.n5 ? '<div class="small muted">Últimos 5 jogos: ' + ['pts', 'reb', 'ast', 'fg3'].filter(k => avg.form.l5 && avg.form.l5[k] != null).map(k => STATS[k].short + ' ' + f1(avg.form.l5[k])).join(' · ') + '</div>' : '') + gamesTable(avg) +
    '<div class="btns">' + (S.runId ? '<button class="btn primary" type="button" data-action="buy-eval" data-id="' + esc(id) + '">Ver se compensa comprar</button>' : '<span></span>') + '<button class="btn" type="button" data-action="add-id" data-id="' + esc(id) + '">Juntar ao plantel</button></div>' + closeRow());
}
function rosterInjuries(players) {
  const list = players.filter(p => injRec(p.id));
  if (!list.length) return S.injOk && S.injAt ? '<p class="small muted" style="margin:0 4px">Ninguém do teu plantel no relatório de lesões (ESPN, ' + esc(ago(S.injAt)) + ').</p>' : '';
  return '<div class="card inj-list"><div class="list-head"><h2>No relatório de lesões</h2><span class="small muted">ESPN, ' + esc(ago(S.injAt)) + '</span></div><ul class="list">' + list.map(p => { const rec = injRec(p.id);
    return '<li><button class="row" type="button" data-action="pl-sheet" data-id="' + esc(p.id) + '"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span><span class="pill ' + INJ_PILL[rec.status] + '">' + esc(INJ_LABEL[rec.status]) + '</span>' + (p.injIgnore ? '<span class="badge">ignorado</span>' : '') + '</div><div class="ps">' + esc(p.team) + (rec.detail ? ' · ' + esc(rec.detail) : '') + (rec.return_date ? ' · regresso previsto ' + dShort(rec.return_date) : '') + (rec.comment ? ' · ' + esc(rec.comment) : '') + '</div></div></button></li>'; }).join('') + '</ul></div>';
}
// ---- dicas de compra: refaz a run com cada candidato ----
function buyHtml() {
  const r = mainResult(), B = S.buy;
  if (!S.runId || !r || !r.model.days.length) return '<div class="note info">' + (S.runId ? 'A run já terminou.' : 'Quando houver uma run, vês aqui o que compensa comprar para ela.') + '</div>' + specHtml();
  return '<div class="card panel"><h2>O que compensa comprar</h2><div class="small muted">Refaz o plano da run com cada candidato e mostra quanto sobem os prémios e em que dias ele jogaria. Os preços não entram nas contas: esses vês tu no marketplace.</div>' +
    '<div class="seg acc-seg" role="group" aria-label="O que comprar"><button type="button" data-action="buy-mode" data-mode="new" aria-pressed="' + (B.mode === 'new') + '">Jogador novo</button><button type="button" data-action="buy-mode" data-mode="more" aria-pressed="' + (B.mode === 'more') + '">Reforçar os teus</button></div>' +
    '<div><div class="label" style="margin-bottom:6px">Usos do Moment a comprar</div><div class="chips" role="group" aria-label="Usos do Moment">' + [1, 2, 3, 4].map(n => '<button type="button" data-action="buy-uses" data-n="' + n + '" aria-pressed="' + (B.uses === n) + '">' + n + '</button>').join('') + '</div>' +
    '<div class="small muted" style="margin-top:6px">Dependem do escalão, da edição e do preço médio do Moment (em geral: Common 1, Rare 1 a 3, Legendary 3 ou mais). Confirma no Top Shot antes de comprar.</div></div>' +
    '<button class="btn primary" type="button" data-action="buy-run">' + (B.mode === 'new' ? 'Procurar as melhores compras' : 'Ver quem vale a pena reforçar') + '</button>' +
    '<label class="small muted">Ou avalia um jogador em especial<input class="field" id="buySearch" type="search" placeholder="Nome (ex.: Curry)" autocomplete="off"></label><div id="buyFound" class="search-list" hidden></div></div>' +
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
  const rows = top.map(x => {
    const p = x.p, i = rank.get(p.id) - 1, mine = !!(S.mine.roster || {})[p.id], pr = ptsRank.get(p.id) || 999, d = ((p.avg.hist || {}).d || {})[stat], ir = injRec(p.id);
    const reg = d > 0 && dMed ? (d <= dMed * 0.85 ? '<span class="badge" title="Varia pouco de jogo para jogo (época passada)">regular</span>' : d >= dMed * 1.2 ? '<span class="pill duv" title="Varia muito de jogo para jogo (época passada)">irregular</span>' : '') : '';
    const spec = stat !== 'pts' && i < 30 && pr > 75 ? '<span class="pill ok" title="No topo desta estatística mas fora dos 75 melhores marcadores">especialista</span>' : '';
    return '<li><button class="row spec-row" type="button" data-action="pform" data-id="' + esc(p.id) + '"><div style="min-width:0"><div class="pn"><span class="nm">' + (i + 1) + '. ' + esc(p.name) + '</span>' + (mine ? '<span class="badge">teu</span>' : '') + spec + reg + (ir ? '<span class="pill ' + INJ_PILL[ir.status] + '">' + INJ_SHORT[ir.status] + '</span>' : '') + '</div>' +
      '<div class="ps">' + teamTag(p.team) + (stat !== 'pts' ? ' · ' + pr + '.º em PTS' : '') + (p.gp ? ' · ' + p.gp + ' jogos esta época' : ' · época passada') + '</div></div><div class="pv"><div class="v num">' + f1(x.v) + '</div><div class="u">' + u + '</div></div></button></li>';
  }).join('');
  const rd = runDays[stat];
  return '<div class="card"><div class="list-head"><h2>Especialistas</h2><span class="small muted">por jogo</span></div>' +
    '<div class="chips scroll" role="group" aria-label="Estatística" style="padding:0 14px 8px">' + order.map(k => '<button type="button" data-action="spec-stat" data-v="' + k + '" aria-pressed="' + (k === stat) + '">' + esc(statShort(k)) + (total && freq[k] ? ' · ' + Math.round(freq[k] / total * 100) + '%' : '') + (runDays[k] ? ' ●' : '') + '</button>').join('') + '</div>' +
    '<div class="seg acc-seg" role="group" aria-label="Que jogadores" style="margin:0 14px 8px"><button type="button" data-action="spec-scope" data-v="all" aria-pressed="' + (S.spec.scope !== 'new') + '">Todos</button><button type="button" data-action="spec-scope" data-v="new" aria-pressed="' + (S.spec.scope === 'new') + '">Os que não tens</button></div>' +
    '<div class="row small muted" style="display:block">' + (rd ? '<b>Nesta run:</b> ' + u + (rd.length === 1 ? ' no dia ' : ' nos dias ') + spans(rd) + '. ' : '') + (total ? 'A % é quantas vezes a estatística saiu nos dias de Fast Break lidos; ● = sai no resto desta run.' : '● = sai no resto desta run.') + '</div>' +
    (rows ? '<ul class="list">' + rows + '</ul>' : '<div class="row small muted" style="display:block">Ainda sem médias.</div>') +
    '<div class="row small muted" style="display:block">Médias desta época misturadas com as da passada (no início da época conta quase só a passada). <b>Especialista</b>: no topo desta estatística mas fora dos 75 melhores marcadores, costuma ser mais barato e pouco escolhido. <b>Regular</b> ou <b>irregular</b>: quanto variou de jogo para jogo na época passada. Toca num jogador para ver a ficha e se compensa comprar.</div></div>';
}
function renderBuySearch(qs) {
  const box = $('buyFound'); if (!box) return;
  box.hidden = !String(qs || '').trim();
  if (box.hidden) { box.innerHTML = ''; return; }
  box.innerHTML = searchPlayers(qs, 6).map(p => '<div class="row"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(p.name) + '</span></div><div class="ps">' + esc(p.team || '—') + (S.mine.roster[p.id] ? ' · já tens: mais usos' : '') + '</div></div><button class="btn small" type="button" data-action="buy-pick" data-id="' + esc(p.id) + '">Avaliar</button></div>').join('') || '<div class="row muted small">Nenhum jogador com esse nome.</div>';
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
async function computeBuy({ onlyId, mode, U, topN, alive, prog, kicks }) {
  const r = mainResult(); if (!r || !r.model.days.length) return null;
  const owned = id => !!S.mine.roster[id];
  let pool;
  if (onlyId) pool = [String(onlyId)];
  else if (mode === 'new' || mode === 'mix') {
    const teams = new Set(); r.model.days.forEach(md => { if (md.objs.length) md.teams.forEach(t => teams.add(t)); });
    pool = [...S.players.values()].filter(p => p.team && p.avg && !owned(p.id) && teams.has(p.team)).map(p => String(p.id));
    // com smurfs: também um 2.º Moment de quem só tens um (para as duas contas o usarem na mesma noite)
    if (mode === 'mix') pool = pool.concat(Object.keys(S.mine.roster).filter(id => r.model.pIndex.get(id) != null && collectionInfo(id).copies === 1));
  } else pool = Object.keys(S.mine.roster).filter(id => r.model.pIndex.get(id) != null);
  if (!pool.length) return { list: [], U, mode, base: null, single: !!onlyId, noPool: true };
  // compra: jogador novo com U usos (fica na conta principal), ou mais U usos (e mais um Moment) para quem já tens
  const add = id => pl => {
    if (pl[id]) { pl[id].uses = (+pl[id].uses || 0) + U; pl[id].copies = (pl[id].copies || 1) + 1; pl[id].owner = null; }
    else { const c = S.players.get(String(id)) || {}; pl[id] = { name: c.name || id, team: c.team || '', uses: U, status: 'ok', avg: c.avg || null, copies: 1, owner: 'main' }; }
  };
  let shortlist = pool;
  if (pool.length > 1) {
    // cada conta vê o que ganharia com o candidato nos seus dias (com as smurf, um 2.º Moment de quem já tens
    // vale sobretudo nas noites em que a outra conta o está a usar)
    const score = {};
    (S.multi ? accounts().map(a => a.id) : ['main']).forEach(k => {
      const x = engineInputs(k), wide = clone(x.roster), rk = S.multi ? S.multi.byKey[k] : r; if (!rk) return;
      pool.forEach(id => add(id)(wide.players));
      const mw = FB.buildModel(x.run, wide, x.odds, x.plan, engOpts());
      FB.buyScreen(mw, rk.normal, pool.map(id => mw.pIndex.get(id)).filter(i => i != null), U).forEach(z => { score[z.id] = (score[z.id] || 0) + z.score; });
    });
    shortlist = Object.entries(score).filter(([, v]) => v > 1e-5).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([id]) => id);
  }
  const list = [];
  let base = null;
  if (shortlist.length) {
    base = kicks != null && S.multi ? planWith(() => {}, kicks) : planNow();
    for (let k = 0; k < shortlist.length; k++) {
      if (alive && !alive()) return null;
      const id = shortlist[k];
      if (prog) prog('A refazer a run com ' + nameOf(id) + '… ' + (k + 1) + ' de ' + shortlist.length);
      await tick();
      if (alive && !alive()) return null;
      try { list.push({ id, ev: planWith(add(id), kicks) }); } catch (e) { console.warn(e); }
    }
  }
  list.sort((a, b) => b.ev.total - a.ev.total);
  return { list, U, mode, base, single: !!onlyId };
}
async function buyRun(onlyId) {
  const B = S.buy, out = $('buyOut'); if (!out) return;
  const mode = onlyId ? (S.mine.roster[onlyId] ? 'more' : 'new') : B.mode;
  out.innerHTML = '<div class="small muted" id="buyProg">A escolher candidatos…</div>';
  await tick(30);
  const res = await computeBuy({ onlyId, mode, U: B.uses, topN: S.multi ? 5 : 8, alive: () => !!$('buyOut'), prog: t => { const el = $('buyProg'); if (el) el.textContent = t; } });
  if (!res || !$('buyOut')) return;
  if (res.noPool) { $('buyOut').innerHTML = '<div class="note info">Não há candidatos com jogos nos dias que faltam.</div>'; return; }
  B.results = res;
  $('buyOut').innerHTML = buyResultsHtml(res);
}
// Sugestões de compra calculadas sozinhas (jogadores novos, Moment com 2 usos), para Hoje e Run
S.autoBuy = null;
let autoBuyTimer = null, autoBuyBusy = null;
function autoBuyKey() {
  const r = mainResult(), run = curRun();
  if (!S.runId || !run || !r || !r.model.days.length || !Object.keys(S.mine.roster || {}).length || !S.players.size) return null;
  return [S.runId, r.normal.objective.toFixed(5), S.multi ? S.multi.objective.toFixed(5) : '', Object.keys(S.mine.roster).length, S.injAt || ''].join('|');
}
function scheduleAutoBuy() {
  const key = autoBuyKey();
  if (!key || (S.autoBuy && S.autoBuy.key === key) || autoBuyBusy === key) return;
  clearTimeout(autoBuyTimer);
  autoBuyTimer = setTimeout(async () => {
    if (autoBuyKey() !== key || document.visibilityState !== 'visible') return;
    autoBuyBusy = key;
    try {
      const res = await computeBuy({ mode: S.multi ? 'mix' : 'new', U: 2, topN: S.multi ? 3 : 4, alive: () => autoBuyKey() === key, kicks: S.multi ? 10 : null });
      if (res && autoBuyKey() === key) { S.autoBuy = Object.assign({ key }, res); if (S.tab === 'hoje' || S.tab === 'run') render(); }
    } catch (e) { console.warn('sugestões de compra', e); }
    finally { if (autoBuyBusy === key) autoBuyBusy = null; }
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
// lista curta de sugestões (Hoje e Run)
function buyTipsCard(limit) {
  const A = S.autoBuy;
  const head = '<div class="list-head"><h2>Sugestões de compra</h2><span class="small muted">Moment com 2 usos</span></div>';
  if (!A || A.key !== autoBuyKey()) return autoBuyKey() ? '<div class="card">' + head + '<div class="row small muted" style="display:block">A ver que compras ajudavam mais nesta run…</div></div>' : '';
  const tips = A.list.map(x => buySummary(A, x)).filter(t => t.worth).slice(0, limit);
  if (!tips.length) return '<div class="card">' + head + '<div class="row small muted" style="display:block">Nenhuma compra com 2 usos muda muito esta run. Em Jogadores → Comprar dá para ver outros usos ou um jogador em especial.</div></div>';
  return '<div class="card">' + head + '<ul class="list">' + tips.map(t => { const c = S.players.get(t.id) || {}, gain = t.byPrize ? t.best.p.wins + ' vitórias' + (t.multi ? ' (' + esc(accLabel(t.best.k)) + ')' : '') + ': ' + pct(t.best.from) + ' → <b class="up">' + pct(t.best.to) + '</b>' : 'vitórias esperadas ' + f1(t.e0) + ' → <b class="up">' + f1(t.e1) + '</b>';
    return '<li><button class="row" type="button" data-action="buy-open"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(c.name || t.id) + '</span>' + (S.mine.roster[t.id] ? '<span class="badge">2.º Moment</span>' : '') + '</div><div class="ps">' + teamTag(c.team) + ' · ' + gain + (t.days.length ? ' · joga ' + (t.days.length > 1 ? 'os dias ' : 'o dia ') + t.days.join(', ') : '') + '</div></div><div class="pv"><div class="v num up">+' + (t.byPrize ? Math.round(t.best.to * 100) - Math.round(t.best.from * 100) : f1(t.e1 - t.e0)) + '</div><div class="u">' + (t.byPrize ? 'pp' : 'vitórias') + '</div></div></button></li>'; }).join('') +
    '</ul><div class="row small muted" style="display:block">Calculado sozinho com Moments de 2 usos de jogadores que ainda não tens' + (S.multi ? ' e um 2.º Moment de quem só tens um (assim as duas contas podem usá-lo no mesmo dia)' : '') + '. Toca para ver os detalhes, outros usos ou reforços.</div></div>';
}
function buyResultsHtml(R) {
  const usesTxt = n => n + ' uso' + (n > 1 ? 's' : '');
  if (!R.list.length) return '<div class="note info">' + (R.single ? 'Este jogador não joga nos dias que faltam (ou não tem médias).' : 'Nenhuma compra com ' + usesTxt(R.U) + ' muda o plano desta run: o teu plantel já cobre bem os dias que faltam.') + '</div>';
  const prizes = mainResult().prizes, keys = R.base.group ? R.base.group.keys : ['main'], multi = keys.length > 1;
  const resOf = (ev, k) => (ev.group ? ev.group.byKey[k].normal : ev.res);
  const andList = a => (a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0] || '');
  const pp = x => Math.round(x * 100);
  const anyMore = R.list.some(x => R.mode === 'more' || !!S.mine.roster[String(x.id)]);
  const intro = '<div class="note info">' + (anyMore
    ? '<b>+' + R.U + '</b> quer dizer comprar <b>outro Moment</b> de um jogador que já tens, com ' + usesTxt(R.U) + ': ficas com mais ' + usesTxt(R.U) + ' dele nesta run' + (multi ? ' em cada conta, e com dois Moments duas contas podem jogá-lo no mesmo dia' : '') + '.'
    : 'Cada dica é comprar um Moment com ' + usesTxt(R.U) + ' de um jogador que ainda não tens' + (multi ? ' (fica na conta principal; o plano diz quando o mandar para outra)' : '') + '.') +
    ' As percentagens são a probabilidade de chegares a cada número de vitórias no fim da run.</div>';
  return intro + R.list.map((x, n) => {
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
    const why = !days.length ? 'Não entra em dias novos: o ganho vem de deixar outros jogadores livres para outros dias.'
      : (twoSame ? 'Com dois Moments dele, duas contas podem jogá-lo no mesmo dia. ' : more ? 'Com mais ' + usesTxt(R.U) + ' dele' + (multi ? ' em cada conta' : '') + ', ' : '') + (more && !twoSame ? 'passa' : 'Passa') + ' a jogar ' + (days.length > 1 ? 'nos dias ' : 'no dia ') + andList(days.map(z => String(z.d.idx + 1))) + (keys.some(k => resOf(R.base, k).days.some(d => d.lineup.includes(id))) ? ' (além dos dias em que já jogava)' : '') + ':';
    const dayLines = days.map(z => { const day = S.days.find(q => q.date === z.d.date) || {};
      return '<li><b>Dia ' + (z.d.idx + 1) + '</b> · ' + dWeek(z.d.date) + ' ' + dShort(z.d.date) + ' · ' + esc(objsText(day)) + ' — ' + z.acc.map(a => (multi ? esc(accLabel(a.k)) + ' ' : 'vitória ') + (a.P0 != null ? pct(a.P0) + ' → ' : '') + '<b>' + pct(a.P1) + '</b>').join(' · ') + '</li>'; }).join('');
    const tiers = [...new Set(moved.map(m => m.p.wins))];
    const prizeLine = tiers.length ? 'Prémios que mudam: ' + tiers.map(w => w + 'V ' + moved.filter(m => m.p.wins === w).map(m => (multi ? esc(accLabel(m.k)) + ' ' : '') + pct(m.b) + ' → ' + pct(m.a)).join(', ')).join(' · ') + '. ' : '';
    return '<div class="card panel buy-card"><div class="list-head" style="padding:0"><h2>' + (R.single ? '' : (n + 1) + '. ') + esc(nameOf(id)) + '</h2><span class="small muted">' + esc(c.team || '') + ' · ' + (more ? 'outro Moment, +' + usesTxt(R.U) : 'Moment com ' + usesTxt(R.U)) + '</span></div>' +
      head + '<div class="small">' + why + '</div>' + (dayLines ? '<ul class="small buy-days">' + dayLines + '</ul>' : '') +
      '<div class="small muted">' + prizeLine + 'Vitórias esperadas' + (multi ? ' (todas as contas)' : '') + ': ' + f1(e0) + ' → ' + f1(e1) + '.</div></div>';
  }).join('') + '<div class="small muted">Comparado com o plano que tens agora. Diferenças de 1 ponto percentual são ruído do cálculo.</div>';
}
function colSheet() { openSheet('<h3>A tua coleção</h3>' + collectionList() + closeRow()); }

// ---- Grupo ----
// ---------- partilha com o grupo: plano, lineups e empréstimos ----------
// O que cada um partilha no resumo (se não desligou no perfil): usos de cada jogador, em que dias o plano o usa
// (em qualquer das contas) e o lineup planeado da conta principal para cada dia que falta.
function shareDoc() {
  if ((S.profile || {}).share_plan === false || S.noShareCol) return null;
  const roster = {}, use = {}, lineups = {};
  accounts().forEach(a => {
    const r = S.multi ? S.multi.byKey[a.id] : (a.id === 'main' ? S.result : null); if (!r) return;
    const nd0 = r.model.days.length ? r.model.days[0].day : null, pa = planOf(a.id);
    const v = nd0 && ((pa.mode || {})[nd0.date]) === 'allin' && r.allIn ? r.allIn : r.normal;
    v.days.forEach(d => {
      d.lineup.forEach(id => { const u = (use[id] = use[id] || []); if (!u.includes(d.date)) u.push(d.date); });
      if (a.id === 'main' && d.lineup.length) lineups[d.date] = d.lineup.slice();
    });
  });
  Object.entries(S.mine.roster || {}).forEach(([id, e]) => { const left = usesEff(e, id, 'main'), tot = left + usedCount('main', id); if (tot > 0) roster[id] = [left, tot, collectionInfo(id).copies]; });
  Object.values(use).forEach(l => l.sort());
  return { roster, use, lineups };
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
    const row = (uid, ids, at) => '<li class="row lu-row"><div style="display:flex;gap:10px;align-items:center;min-width:0">' + avatar(uid, groupName(uid)) + '<div style="min-width:0"><div class="pn"><span class="nm">' + esc(uid === me ? 'Tu' : groupName(uid)) + '</span>' + (at ? '<span class="small muted">' + esc(ago(at)) + '</span>' : '') + '</div><div class="ps">' +
      (ids.length ? ids.map(id => '<span class="' + (uid !== me && mineIds.has(id) ? 'lu-same' : '') + '">' + esc(lastName(id) || id) + '</span>').join(' · ') : 'sem jogadores') + '</div></div></div></li>';
    const rows = [row(me, mine)].concat(shared.map(s => row(s.user_id, ((s.share.lineups || {})[day.date]) || [], s.updated_at)));
    return '<div class="card"><div class="list-head"><h2>Dia ' + (day.idx + 1) + ' · ' + esc(objsText(day)) + '</h2><span class="small muted">' + dWeek(day.date) + ', ' + dShort(day.date) + '</span></div><ul class="list">' + rows.join('') + '</ul></div>';
  });
  return (shared.length ? '' : '<div class="note info">Ainda ninguém do grupo partilhou o plano. Aparece aqui quando os amigos abrirem o site com esta versão (a partilha vem ligada; desliga-se em Ajustes → Perfil).</div>') + cards.join('') +
    '<p class="small muted" style="margin:0 4px">O lineup que o plano de cada um sugere hoje para cada dia (pode mudar até ao jogo). <span class="lu-same">Sublinhado</span>: jogador que também tens.' + (hidden.length ? ' Sem plano partilhado: ' + hidden.map(m => esc(groupName(m.user_id))).join(', ') + '.' : '') + '</p>';
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
      try { list.push({ o, ev: planWith(pl => { pl[o.id] = borrowEntry(o); }) }); } catch (e) { console.warn(e); }
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
    '<div class="small muted">Vitórias esperadas na run: ' + f1(mainResult().wins + base.res.expected) + ' → ' + f1(mainResult().wins + ev.res.expected) + '. ' + safe + ' Conta com ' + plural(o.U, 'uso', 'usos') + ' (os do Moment dele numa run)' + (o.others.length ? '; também o tem: ' + o.others.map(esc).join(', ') : '') + '. No Top Shot ele oferece-te o Moment e tu devolves.</div></div>';
}
function emprestimosHtml() {
  const r = mainResult(), B = S.borrow.results;
  if (!S.runId || !r || !r.model.days.length) return '<div class="note info">' + (S.runId ? 'A run já terminou.' : 'Ainda não há runs.') + '</div>';
  const n = borrowOffers().length;
  let out = '';
  if (S.borrow.busy) out = '<div class="small muted" id="borrowProg">A calcular…</div>';
  else if (B && B.err) out = '<div class="note">Erro: ' + esc(B.err) + '</div>';
  else if (B && B.none) out = '<div class="note info">Nenhum Moment dos amigos serve: ou ainda não partilharam o plano, ou o que têm já é teu, ou eles próprios o usam em todos os dias em que joga.</div>';
  else if (B) out = B.list.length ? B.list.map((z, i) => borrowCard(z, B.base, i)).join('') : '<div class="note info">Nenhum dos ' + B.n + ' Moments disponíveis melhora a tua run.</div>';
  return '<div class="card panel"><h2>Pedir emprestado</h2><div class="small muted">Refaz a tua run com Moments dos amigos, só nos dias em que o plano deles não os usa, para não estragar a run de ninguém. Conta com os usos de um Moment dele numa run.</div>' +
    '<div class="small"><b>' + plural(n, 'Moment', 'Moments') + '</b> de ' + plural(new Set(borrowOffers().map(o => o.uid)).size, 'amigo', 'amigos') + ' que não tens e que jogam em dias livres.</div>' +
    '<button class="btn primary" type="button" data-action="borrow-run"' + (n && !S.borrow.busy ? '' : ' disabled') + '>Ver o que compensa pedir</button></div>' +
    '<div id="borrowOut" class="stack">' + out + '</div>' +
    '<p class="small muted" style="margin:0 4px">Os dias livres vêm do plano que cada amigo partilhou (muda quando ele abre o site). Antes de devolver, confirma que já jogaste esse dia.</p>';
}
function renderGrupo() {
  const el = $('tab-grupo');
  if (S.loading) { el.innerHTML = empty('A carregar', 'A ler o grupo.'); return; }
  if (!S.runId) { el.innerHTML = empty('Ainda não há runs', 'A classificação aparece quando houver uma run.'); return; }
  const gsub = subOf('grupo');
  if (gsub === 'lineups') { el.innerHTML = subBar('grupo') + '<div class="stack">' + lineupsHtml() + '</div>'; return; }
  if (gsub === 'emprestimos') { el.innerHTML = subBar('grupo') + '<div class="stack">' + emprestimosHtml() + '</div>'; return; }
  const memberIds = new Set(S.group.members.map(m => m.user_id));
  const profs = new Map(S.group.profiles.map(p => [p.user_id, p]));
  const sums = new Map(S.group.summaries.map(s => [s.user_id, s]));
  const chainBy = {};
  S.group.chain.forEach(c => { if ((c.account || 'main') === 'main') (chainBy[c.user_id] = chainBy[c.user_id] || {})[c.date] = c; });
  const nd = nextDay();
  const people = [...memberIds].map(uid => {
    const p = profs.get(uid) || {}, s = sums.get(uid) || null, ch = chainBy[uid] || {};
    const daysRes = Object.assign({}, (s && s.days) || {});
    Object.values(ch).forEach(c => { if (c.win != null && c.date) daysRes[c.date] = c.win ? 'win' : 'loss'; });
    const wins = Object.values(daysRes).filter(x => x === 'win').length, losses = Object.values(daysRes).filter(x => x === 'loss').length;
    return { uid, name: p.display_name || 'Sem nome', ts: p.topshot_username, s, daysRes, wins, losses, chain: Object.keys(ch).length > 0, exp: s ? +s.expected : null };
  }).sort((a, b) => (b.wins - a.wins) || ((b.exp || 0) - (a.exp || 0)) || a.name.localeCompare(b.name));
  const run = curRun() || {}, P = (run.prizes || []).map(p => ({ wins: +p.wins })).filter(p => p.wins > 0).sort((a, b) => a.wins - b.wins);
  const rows = people.map((x, i) => {
    const strip = S.days.map(d => { const r = x.daysRes[d.date]; return '<i class="' + (r === 'win' ? 'w' : r === 'loss' ? 'l' : (nd && nd.date === d.date ? 'n' : '')) + '" title="' + dShort(d.date) + (r ? (r === 'win' ? ': vitória' : ': derrota') : '') + '"></i>'; }).join('');
    const pr = x.s && Array.isArray(x.s.prize_probs) ? x.s.prize_probs : [];
    const probs = P.map(p => { const z = pr.find(q => +q.wins === p.wins); return z ? +z.p : null; });
    const side = x.s ? (P.length && probs.every(v => v != null) ? miniAros(P, probs) : '<span class="grp-wl num">≈ ' + f1(x.exp || 0) + '</span>') + (x.s.next_p != null && nd ? '<span class="today">hoje ' + pct(+x.s.next_p) + '</span>' : '') : '<span class="today">não abriu a run</span>';
    return '<li><button class="grp-row" type="button" data-action="friend" data-id="' + esc(x.uid) + '"><span class="grp-rank">' + (i + 1) + '</span>' + avatar(x.uid, x.name) +
      '<span style="min-width:0"><span class="pn"><span class="nm">' + esc(x.name) + '</span>' + (x.uid === S.session.user.id ? '<span class="badge">tu</span>' : '') + '</span>' +
      '<span class="ps" style="display:block">' + recordTxt(x.wins, x.losses) + (x.exp != null ? ' · esperadas ' + f1(x.exp) : '') + '</span><span class="strip">' + strip + '</span></span>' +
      '<span class="grp-side">' + side + '</span></button></li>';
  }).join('');
  const tiersTxt = P.map(p => p.wins);
  el.innerHTML = subBar('grupo') + '<div class="card"><div class="list-head"><h2>Classificação</h2><span class="small muted">' + esc(run.name || '') + '</span></div><ul class="list">' + (rows || '<li class="row muted small">Ainda não há ninguém no grupo.</li>') + '</ul>' +
    (P.length ? '<div class="row small muted" style="display:block">Os aros são a probabilidade de cada um chegar a ' + (tiersTxt.length > 1 ? tiersTxt.slice(0, -1).join(', ') + ' e ' + tiersTxt[tiersTxt.length - 1] : tiersTxt[0]) + ' vitórias no fim da run: quanto mais cheio, mais perto. Verde é provável, amarelo meio-meio, vermelho difícil.</div>' : '') + '</div>' +
    '<p class="small muted" style="margin:0 4px">Vitórias e derrotas vêm da blockchain quando o utilizador do Top Shot está no perfil e a run está ligada; senão, do que cada um marca.' + (S.role === 'admin' ? ' Convida amigos em Ajustes → Admin.' : '') + '</p>' +
    '<button class="btn" type="button" data-action="group-refresh">Atualizar</button>';
}
function friendSheet(uid) {
  const p = S.group.profiles.find(x => x.user_id === uid) || {};
  const s = S.group.summaries.find(x => x.user_id === uid) || {};
  const ch = {}; S.group.chain.filter(c => c.user_id === uid && (c.account || 'main') === 'main').forEach(c => { ch[c.date] = c; });
  const rows = S.days.map((d, i) => {
    const c = ch[d.date], r = c && c.win != null ? (c.win ? 'win' : 'loss') : ((s.days || {})[d.date] || null);
    const lineup = c && Array.isArray(c.lineup) && c.lineup.length ? c.lineup.join(' · ') : '';
    return '<li class="row"><div style="min-width:0"><div class="pn"><span class="nm">Dia ' + (i + 1) + ' · ' + esc(objsText(d)) + '</span></div><div class="ps">' + dShort(d.date) + (c && c.points != null ? ' · ' + f0(+c.points) + ' feitos' : '') + (lineup ? ' · ' + esc(lineup) : '') + '</div></div>' +
      (r ? '<span class="pchip ' + (r === 'win' ? 'p-good' : 'p-bad') + '">' + (r === 'win' ? 'V' : 'D') + '</span>' : '<span class="pchip p-done">—</span>') + '</li>';
  }).join('');
  openSheet('<h3>' + esc(p.display_name || 'Sem nome') + '</h3><div class="small muted">' + (p.topshot_username ? 'Top Shot: ' + esc(p.topshot_username) : 'Sem utilizador do Top Shot no perfil') + '</div>' +
    '<ul class="list card">' + rows + '</ul>' + closeRow());
}

// ---- Ajustes ----
function renderAjustes() {
  const el = $('tab-ajustes'), me = S.profile || {}, run = curRun(), sub = subOf('ajustes'), html = [subBar('ajustes')];
  if (sub === 'perfil') html.push('<div class="card panel"><h2>Perfil</h2><form id="pfForm" class="stack">' +
    '<label class="small muted">Nome que o grupo vê<input class="field" id="pfName2" maxlength="40" value="' + esc(me.display_name || '') + '"></label>' +
    '<label class="small muted">Utilizador do Top Shot<input class="field" id="pfTs2" maxlength="40" autocapitalize="none" value="' + esc(me.topshot_username || '') + '"></label>' +
    '<label class="small muted">Endereço Flow da tua carteira Dapper (0x seguido de 16 letras/números; é o que liga os teus resultados da blockchain)<input class="field" id="pfFlow2" maxlength="18" autocapitalize="none" placeholder="0x…" value="' + esc(me.flow_address || '') + '"></label>' +
    smurfFormHtml() +
    '<div class="btns"><button class="btn quiet" type="button" data-action="logout">Terminar sessão</button><button class="btn primary" type="submit">Guardar perfil</button></div></form></div>' +
    '<div class="card panel"><h2>Partilhar com o grupo</h2><div class="small muted">O grupo vê o lineup que o teu plano sugere para cada dia e os usos dos teus jogadores, e o site sugere-lhes pedir-te Moments só nos dias em que o teu plano não os usa. O plantel e o plano continuam só teus.</div>' +
    '<div class="seg acc-seg" role="group" aria-label="Partilhar o plano"><button type="button" data-action="share-plan" data-v="1" aria-pressed="' + (me.share_plan !== false) + '">Partilhar</button><button type="button" data-action="share-plan" data-v="0" aria-pressed="' + (me.share_plan === false) + '">Não partilhar</button></div></div>');
  if (sub === 'prefs' && S.runs.length) {
    html.push('<div class="card panel"><h2>Run a ver</h2><select class="field" id="runPick" aria-label="Escolher run">' + S.runs.map(x => '<option value="' + esc(x.id) + '"' + (x.id === S.runId ? ' selected' : '') + '>' + esc(x.name) + ' · ' + dShort(x.start_date) + (x.active ? ' (ativa)' : '') + '</option>').join('') + '</select></div>');
  }
  if (sub === 'prefs') html.push('<div class="card panel"><h2>Aspeto</h2><div class="small muted">Automático segue o modo claro ou escuro do telemóvel. Fica guardado neste aparelho.</div>' +
    '<div class="seg acc-seg" role="group" aria-label="Aspeto">' + [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([k, l]) => '<button type="button" data-action="theme" data-v="' + k + '" aria-pressed="' + (theme === k) + '">' + l + '</button>').join('') + '</div></div>');
  if (sub === 'prefs') html.push('<div class="card panel"><h2>Jogos seguidos</h2><div class="small muted">No 2.º de dois jogos em dias seguidos (back-to-back) os jogadores costumam render um pouco menos. Sem odds, o plano tira 3%, ou o que esse jogador fez nesses jogos na época passada (há quem não note diferença). As odds já contam com isto. Fica guardado neste aparelho.</div>' +
    '<div class="seg acc-seg" role="group" aria-label="Jogos seguidos"><button type="button" data-action="b2b" data-v="1" aria-pressed="' + b2bOn + '">Ajustar</button><button type="button" data-action="b2b" data-v="0" aria-pressed="' + !b2bOn + '">Não ajustar</button></div></div>');
  if (sub === 'prefs') html.push('<div class="card panel"><h2>Forma recente</h2><div class="small muted">Sem odds para um dia, o plano usa as médias. Com a forma, as médias da época misturam-se com as dos últimos 10 e 5 jogos (normal: época 50%, últimos 10 30%, últimos 5 20%). As odds das casas já incluem a forma. Fica guardado neste aparelho.</div>' +
    '<div class="seg acc-seg" role="group" aria-label="Peso da forma">' + FORM_LEVELS.map(([k, l]) => '<button type="button" data-action="form-level" data-level="' + k + '" aria-pressed="' + (formLevel === k) + '">' + l + '</button>').join('') + '</div></div>');
  // (avisos por email/telemóvel: prontos em alertsHtml(), desligados por agora)
  if (sub === 'admin') html.push(adminHtml(run));
  if (sub === 'dados') html.push(dataHtml());
  el.innerHTML = html.join('');
  if (sub === 'admin' && S.role === 'admin' && S.invite == null) { sb.rpc('get_invite_code').then(({ data }) => { S.invite = data || ''; if (S.tab === 'ajustes' && !typingIn('tab-ajustes')) renderAjustes(); }); }
}
// avisos antes dos jogos: email e/ou notificações no telemóvel (app ntfy, grátis, sem conta)
function alertsHtml() {
  const a = S.alerts || {}, email = ((S.session || {}).user || {}).email || '';
  const head = '<div class="card panel"><h2>Avisos de lesões</h2>';
  if (S.alertsOk === false) return head + '<div class="small muted">Para ligar avisos, o admin tem de correr o supabase/schema.sql novo no Supabase (SQL Editor).</div></div>';
  return head + '<div class="small muted">Antes de cada jogo, uma tarefa automática vê o relatório de lesões da NBA e avisa-te se alguém do teu lineup de hoje estiver fora ou em dúvida: o lineup que submeteste no Top Shot (lido da blockchain) ou, se ainda não submeteste, o do plano. Volta a avisar se o estado mudar, se ele sair do relatório, e uma última vez cerca de uma hora antes do jogo se continuar em dúvida.</div>' +
    '<button class="switch" type="button" data-action="alerts-email" aria-pressed="' + !!a.email + '"><i></i>Por email' + (email ? ' (' + esc(email) + ')' : '') + '</button>' +
    (a.ntfy ? '<div class="label">No telemóvel</div><ol class="steps small"><li>Instala a app <b>ntfy</b> (grátis, Android e iPhone).</li><li>Carrega em <b>+</b> e subscreve este tópico: <span class="kbd" id="ntfyTopic">' + esc(a.ntfy) + '</span> <button class="btn link small" type="button" data-action="copy-topic">copiar</button></li><li>Carrega em <b>Testar</b>: deve chegar uma notificação.</li></ol>' +
      '<div class="small muted">Quem souber o tópico também recebe as tuas mensagens: não o partilhes.</div><div class="btns"><button class="btn" type="button" data-action="alerts-test">Testar</button><button class="btn quiet" type="button" data-action="alerts-ntfy-off">Desligar</button></div>'
      : '<button class="btn" type="button" data-action="alerts-ntfy-on">Ligar notificações no telemóvel</button>') +
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
  return '<div class="label">Contas smurf</div><div class="small muted">Até 2 contas extra tuas. O plano junta as coleções como se fossem uma só e diz que Moments mandar para que conta antes de cada noite (um Moment só joga por uma conta em cada noite).</div>' +
    sms.map((x, i) => '<div class="smurf-row stack"><div class="label">Smurf ' + (i + 1) + '</div>' +
      '<label class="small muted">Utilizador do Top Shot<input class="field" id="smTs' + i + '" maxlength="40" autocapitalize="none" value="' + esc(x.topshot_username || '') + '"></label>' +
      '<label class="small muted">Endereço Flow<input class="field" id="smFlow' + i + '" maxlength="18" autocapitalize="none" placeholder="0x…" value="' + esc(x.flow_address || '') + '"></label>' +
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
// run de teste: 11 dias a começar hoje, jogos inventados e objetivos com as estatísticas reais do Fast Break
async function createTestRun() {
  const start = todayET(), n = 11;
  const id = 'teste-' + start.slice(2, 4) + start.slice(5, 7) + start.slice(8, 10);
  if (S.runs.some(r => r.id === id)) { toast('Já existe uma run de teste com início hoje.'); return; }
  const dates = []; for (let i = 0; i < n; i++) { const d = new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10) + i)); dates.push(d.toISOString().slice(0, 10)); }
  const OBJ = [['pts', 120], ['reb', 45], ['ast', 28], ['fg3', 13], ['pip', 45], ['oreb', 9], ['ast-tov', 16], ['fgm', 44], ['stl', 7], ['fg3a', 34], ['pts', 130]];
  let seed = 0; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const days = dates.map((date, i) => {
    const teams = TEAMS.slice(); for (let k = teams.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [teams[k], teams[j]] = [teams[j], teams[k]]; }
    const ng = 5 + Math.floor(rand() * 5), games = [];
    for (let g = 0; g < ng; g++) games.push([teams[2 * g], teams[2 * g + 1], new Date(Date.parse(date + 'T23:00:00Z') + Math.floor(g / 2) * 1800e3).toISOString().replace('.000Z', 'Z'), 'teste:' + date + ':' + g]);
    games.sort((a, b) => a[2].localeCompare(b[2]));
    return { run_id: id, date, objectives: [{ stat: OBJ[i % OBJ.length][0], target: OBJ[i % OBJ.length][1] }], games };
  });
  const prizes = [{ wins: 5, value: 10, label: 'Exemplo' }, { wins: 7, value: 30, label: 'Exemplo' }, { wins: 9, value: 100, label: 'Exemplo' }];
  const ok = await adminWrite(sb.from('runs').insert({ id, name: 'Run de teste', start_date: dates[0], end_date: dates[n - 1], prizes, active: !S.runs.some(r => r.active), fictitious: true }));
  if (!ok) return;
  if (!(await adminWrite(sb.from('run_days').insert(days), 'Run de teste criada: 11 dias com jogos inventados e as estatísticas reais do Fast Break.'))) return;
  await loadShared(); await loadRun(id);
  renderAjustes();
}
async function deleteRun(run) {
  if (!run || !run.fictitious) return;
  if (!confirm('Apagar "' + run.name + '"? Os planteis e planos de todos nesta run também desaparecem.')) return;
  if (!(await adminWrite(sb.from('runs').delete().eq('id', run.id), 'Run apagada.'))) return;
  await loadShared(); await loadRun(pickRun());
  renderAjustes();
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
    '<button class="btn" type="submit">Criar run</button></form><div class="small muted">Os jogos de cada dia chegam do calendário NBA sozinhos. Datas na hora dos EUA, como no Top Shot.</div>' +
    '<div class="label">Run de teste</div><div class="small muted">Para o grupo experimentar: 11 dias a começar hoje, jogos inventados, objetivos com as estatísticas reais do Fast Break e prémios de exemplo. Não gasta créditos de odds.</div>' +
    '<button class="btn" type="button" data-action="test-run">Criar run de teste</button></div>');
  if (run) {
    const prizes = run.prizes || [];
    out.push('<div class="card panel"><h2>' + esc(run.name) + '</h2>' +
      (run.active ? '<div class="small">Esta é a run ativa: é a que abre por defeito para todos.</div>' : '<button class="btn" type="button" data-action="set-active">Tornar a run ativa</button>') +
      (run.fictitious ? '<button class="btn quiet" type="button" data-action="del-run">Apagar esta run de teste</button>' : '') +
      '<div class="label">Prémios por vitórias</div><div class="small muted">Quantas vitórias dão prémio e quanto vale cada um (só conta a proporção).</div>' +
      prizes.map((p, i) => '<div class="prow-edit"><label>Vitórias<input class="field num" id="pz-w-' + i + '" type="number" min="1" max="31" inputmode="numeric" value="' + esc(p.wins) + '" data-action="pz-w" data-i="' + i + '"></label><label>Valor<input class="field num" id="pz-v-' + i + '" type="number" min="0" inputmode="decimal" value="' + esc(p.value) + '" data-action="pz-v" data-i="' + i + '"></label><button class="btn small quiet" type="button" data-action="pz-del" data-i="' + i + '" aria-label="Apagar patamar" style="height:42px">×</button></div>').join('') +
      '<button class="btn" type="button" data-action="pz-add">Adicionar patamar</button>' +
      '<div class="label">Objetivos</div>' +
      S.days.map((day, i) => {
        const o = (day.objectives || [])[0] || { stat: 'pts', target: '' };
        return '<div class="objrow"><div><div class="label">Dia ' + (i + 1) + '</div><div class="small">' + dWeek(day.date) + ', ' + dShort(day.date) + '</div></div><select class="field" id="obj-stat-' + i + '" data-action="obj-stat" data-i="' + i + '" aria-label="Estatística do dia ' + (i + 1) + '">' +
          OBJ_STATS.map(k => '<option value="' + k + '"' + (o.stat === k ? ' selected' : '') + '>' + esc(statLabel(k)) + '</option>').join('') + (OBJ_STATS.includes(o.stat) ? '' : '<option value="' + esc(o.stat) + '" selected>' + esc(statLabel(o.stat)) + '</option>') +
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
  lines.push(['Lesões', S.injOk ? Object.keys(S.injuries).length + ' no relatório · ' + ago(S.injAt) : 'falta correr o supabase/schema.sql novo']);
  lines.push(['Blockchain', S.chainRuns.length ? S.chainRuns.length + ' runs lidas' : 'à espera da primeira leitura']);
  return '<div class="card panel"><h2>Dados</h2>' + lines.map(([a, b]) => '<div class="status-line"><span>' + esc(a) + '</span><span class="muted">' + esc(b) + '</span></div>').join('') +
    '<div class="small muted">Atualizados sozinhos: calendário e médias de manhã, odds à tarde e ao início da noite (hora de Lisboa), blockchain e lesões de 30 em 30 minutos. Sem odds, o plano usa as médias com a forma.</div></div>';
}

// ---------- folhas ----------
function openSheet(html, back) { S.sheetBack = back || null; $('sheetPanel').innerHTML = '<div class="grab" aria-hidden="true"></div>' + html; $('sheet').hidden = false; $('sheetPanel').scrollTop = 0; }
function closeSheet() { $('sheet').hidden = true; $('sheetPanel').innerHTML = ''; S.sheetBack = null; }
const closeRow = back => '<div class="btns">' + (back ? '<button class="btn quiet" type="button" data-action="sheet-back">Voltar</button>' : '<span></span>') + '<button class="btn quiet" type="button" data-action="close-sheet">Fechar</button></div>';
function dayInfo(date) { const r = S.result; const md = r && r.model.days.find(x => x.day.date === date); const d = md && view().days.find(x => x.date === date); return { md, d }; }

// ---- comparar os jogadores de um dia (forma, minutos, lançamentos, adversário) ----
const GK = ['min', 'pts', 'reb', 'ast', 'fg3', 'fgm', 'fga', 'fg3a', 'ftm', 'fta', 'tov', 'stl', 'blk', 'oreb']; // ordem dos jogos guardados
const nn = x => (x != null && x !== '' && isFinite(+x) ? +x : null);
const ratio = (a, b) => (nn(a) != null && nn(b) > 0 ? 100 * a / b : null);
// "Shai Gilgeous-Alexander" → "S. Gilgeous-Alexander" (para colunas estreitas)
const shortName = n => { const t = String(n || '').trim().split(/\s+/); return t.length > 1 ? t[0][0] + '. ' + t.slice(1).join(' ') : t[0] || ''; };
function compareCard(md, d, date, inTab) {
  const r = S.result, o = (md.day.objectives || [])[0], v = view();
  if (!o || !md.elig.length) return '';
  const terms = FB.statTerms(o.stat).map(t => t.s), has = list => terms.some(t => list.includes(t));
  const locks = new Set(((curPlan().locks || {})[date]) || []);
  const rows = md.elig.map(pi => {
    const p = r.model.players[pi], info = md.info[pi][0], a = p.avg || {}, f = a.form || null, l5 = (f && f.l5) || {}, fi = FB.formInfo(p, o.stat) || {};
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
  const body = rows.map(x => '<tr class="' + (x.inL ? 'inl' : '') + '" data-action="player" data-id="' + esc(x.p.id) + '" data-date="' + date + '"' + (inTab ? '' : ' data-back="day"') + ' tabindex="0"><th class="sticky"><span class="cn" title="' + esc(x.p.name) + '">' + (x.locked ? icoLock : x.inL ? '<i class="dot on" title="no lineup do plano"></i>' : '') + esc(shortName(x.p.name)) + '</span><small>' + esc(x.p.team) + (x.opp ? (x.home ? ' vs ' : ' @ ') + esc(x.opp) : '') + (x.info.status !== 'ok' ? ' · ' + esc(STATUS[x.info.status].label) : '') + (x.info.b2b ? ' · 2.º seguido' : '') + '</small></th>' + cols.map(c => '<td>' + c[3](x) + '</td>').join('') + '</tr>').join('');
  const noForm = !rows.some(x => x.f);
  return '<div class="card"><div class="list-head"><h2>Comparar jogadores</h2><span class="small muted">' + rows.length + ' jogam · toca para ver</span></div>' +
    '<div class="cmp-wrap" id="cmpWrap"><table class="cmp"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
    '<div class="row small muted" style="display:block">Números grandes: últimos 5 jogos; pequenos: época. <i class="dot on" style="display:inline-block;vertical-align:-1px"></i> no lineup do plano. Toca num título para ordenar.' + (noForm ? ' A forma aparece depois dos primeiros jogos da época; até lá vês as médias da época.' : '') + '</div></div>';
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
function daySheet(date) {
  const i = S.days.findIndex(x => x.date === date); if (i < 0) return;
  const day = S.days[i], o = (day.objectives || [])[0];
  const pl = ((curPlan().played || {})[date]) || null;
  if (pl && pl.done) {
    openSheet('<h3>Dia ' + (i + 1) + ' · ' + esc(objsText(day)) + '</h3><div class="small muted">' + dWeek(date) + ', ' + dShort(date) + ' · ' + (pl.result === 'win' ? 'Vitória' : 'Derrota') + (pl.points != null ? ' · ' + f0(pl.points) + ' feitos' : '') + (pl.chain ? ' · lido da blockchain' : '') + '</div>' +
      (predVsActualHtml(date) || '<ul class="list card">' + ((pl.lineup || []).map(id => '<li class="row"><span>' + esc(nameOf(id)) + '</span></li>').join('') || '<li class="row muted small">Sem jogadores registados.</li>') + '</ul>') + '<div class="small muted">Os usos destes jogadores já foram descontados.</div>' + (pl.chain ? '' : '<button class="btn" type="button" data-action="undo-result" data-date="' + date + '">Desfazer resultado</button>') + closeRow());
    return;
  }
  const { md, d } = dayInfo(date); if (!md || !d) return;
  const r = S.result, v = view();
  const locks = new Set(((curPlan().locks || {})[date]) || []), bans = ((curPlan().bans || {})[date]) || [];
  const inLine = d.lineup.map(id => { const pi = r.model.pIndex.get(id), info = md.info[pi][0], p = r.model.players[pi]; return '<li><button class="row" type="button" data-action="player" data-id="' + esc(id) + '" data-date="' + date + '" data-back="day"><div style="min-width:0"><div class="pn">' + (locks.has(id) ? icoLock : '') + '<span class="nm">' + esc(p.name) + '</span></div><div class="ps">' + esc(p.team) + ' ' + esc(opp(p.team, day)) + injTag(info) + b2bTag(info) + ' · ' + srcShort(info) + formTag(p, o) + '</div></div><div class="pv"><div class="v num">' + f1(info.mu) + '</div><div class="u">' + esc(o ? statShort(o.stat) : '') + '</div></div></button></li>'; }).join('');
  openSheet('<h3>Dia ' + (i + 1) + ' · ' + esc(objsText(day)) + '</h3>' + (d.perPlayer ? '<div class="note">Objetivo por jogador: o plano calcula-o como total. Confirma o lineup à mão.</div>' : '') +
    '<div class="kv"><div><div class="label">Vitória</div><div class="v num c-' + tone(d.P) + '">' + (d.noObjective ? '—' : pct(d.P)) + '</div></div><div><div class="label">Projeção</div><div class="v num">' + (d.totals[0] ? f0(d.totals[0].mu) : '–') + '</div></div><div><div class="label">Jogos</div><div class="v num">' + (day.games || []).length + '</div></div></div>' +
    '<div class="card"><div class="list-head"><h2>Lineup do plano</h2><span class="small muted">' + dWeek(date) + ', ' + dShort(date) + '</span></div><ul class="list">' + (inLine || '<li class="row muted small">Nenhum jogador do plantel joga neste dia.</li>') + '</ul></div>' +
    (locks.size ? '<div class="small">Fixados: ' + [...locks].map(id => esc(nameOf(id)) + ' <button class="btn link small" type="button" data-action="unlock" data-id="' + esc(id) + '" data-date="' + date + '">soltar</button>').join(' · ') + '</div>' : '') +
    (bans.length ? '<div class="small">Tirados: ' + bans.map(id => esc(nameOf(id)) + ' <button class="btn link small" type="button" data-action="unban" data-id="' + esc(id) + '" data-date="' + date + '">repor</button>').join(' · ') + '</div>' : '') +
    compareCard(md, d, date) + closeRow());
}
function playerSheet(id, date, back) {
  const r = S.result, pi = r.model.pIndex.get(id), p = r.model.players[pi];
  const { md, d } = dayInfo(date); if (!md) return;
  const day = md.day, o = (day.objectives || [])[0] || { stat: 'pts' }, info = md.info[pi][0] || { mu: 0, src: 'sem', status: 'ok', pPlay: 1 };
  const locked = (((curPlan().locks || {})[date]) || []).includes(id);
  const inPlan = view().days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1);
  const live = date === (nextDay() || {}).date && liveOn(date), sub = live && d.live && d.live.submitted.includes(id);
  let liveHtml = '';
  if (live && sub) {
    const e = (((liveDoc(date) || {}).players || {})[id]) || {}, state = e.state || 'por', val = Math.round(FB.statValue(e.vals || {}, o.stat, p.avg) * 10) / 10;
    liveHtml = '<div class="card panel" style="gap:10px"><div class="label">Jogo a jogo</div><div class="chips" role="group" aria-label="Estado do jogo">' + [['por', 'Por jogar'], ['jogo', 'Em jogo'], ['fim', 'Terminado']].map(([k, l]) => '<button type="button" data-action="live-state" data-id="' + esc(id) + '" data-state="' + k + '" aria-pressed="' + (state === k) + '">' + l + '</button>').join('') + '</div>' +
      (state !== 'por' ? '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div class="stepper"><button type="button" data-action="live-val" data-id="' + esc(id) + '" data-d="-1" aria-label="Menos um">−</button><input class="num" id="liveVal" type="number" inputmode="decimal"' + (/-/.test(o.stat) ? '' : ' min="0"') + ' value="' + val + '" data-action="live-input" data-id="' + esc(id) + '" aria-label="Valor até agora"><button type="button" data-action="live-val" data-id="' + esc(id) + '" data-d="1" aria-label="Mais um">+</button></div><span class="small muted">' + esc(statShort(o.stat)) + (state === 'fim' ? ' no final' : ' até agora') + '</span></div>' : '') +
      (state === 'jogo' ? '<div class="chips" role="group" aria-label="Período">' + [1, 2, 3, 4].map(qn => '<button type="button" data-action="live-q" data-id="' + esc(id) + '" data-q="' + qn + '" aria-pressed="' + (+e.q === qn) + '">' + qn + '.º</button>').join('') + '</div>' : '') + '</div>';
  } else if (live) liveHtml = '<div class="note info">Ainda não está no lineup que submeteste. Se fizeres a troca no Top Shot, carrega em <b>Fiz a troca</b> no ecrã Hoje.</div>';
  openSheet('<h3>' + esc(p.name) + '</h3><div class="small muted">' + esc(p.team) + ' ' + esc(opp(p.team, day)) + ' · Dia ' + (day.idx + 1) + ', ' + dShort(date) + '</div>' +
    '<div class="kv"><div><div class="label">Esperado</div><div class="v num">' + f1(info.mu) + '</div><div class="small muted">' + esc(statShort(o.stat)) + '</div></div><div><div class="label">Usos</div><div class="v num">' + (p.uses || 0) + '</div><div class="small muted">restantes</div></div><div><div class="label">No plano</div><div class="v num">' + inPlan.length + '</div><div class="small muted">' + (inPlan.length ? 'dias ' + inPlan.join(', ') : '—') + '</div></div></div>' +
    liveHtml + injuryBlock(id, info.injury, date) + basisHtml(p, info, o, md, id) + gamesTable(p.avg) +
    '<div class="stack">' + (locked ? '<button class="btn" type="button" data-action="unlock" data-id="' + esc(id) + '" data-date="' + date + '">Deixar de fixar neste dia</button>' : '<button class="btn primary" type="button" data-action="lock" data-id="' + esc(id) + '" data-date="' + date + '">Fixar neste dia</button>') +
    '<button class="btn" type="button" data-action="ban" data-id="' + esc(id) + '" data-date="' + date + '">Tirar deste dia</button></div>' + closeRow(back), back);
}
function rosterSheet(id) {
  const e = S.mine.roster[id]; if (!e) return;
  const c = S.players.get(String(id)) || {}, v = view();
  const inPlan = v ? v.days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1) : [];
  const team = e.team || c.team || '';
  // usos de cada conta: usados nesta run, restantes (editáveis) e quantos o plano usa
  const planOfAcc = k => { const r = S.multi ? S.multi.byKey[k] : S.result; return r ? r.normal.days.filter(x => x.lineup.includes(id)).length : 0; };
  const usesRows = accounts().map(a => {
    const pk = a.id + '|' + id, left = S.pendingUses[pk] != null ? S.pendingUses[pk] : usesEff(e, id, a.id), usedN = usedCount(a.id, id);
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><div class="label">' + (groupMode() ? esc(a.label) : 'Usos restantes') + '</div><div class="small muted">' + (usedN ? 'usado ' + usedN + '× · ' : '') + 'o plano usa ' + planOfAcc(a.id) + '</div></div>' +
      '<div class="stepper"><button type="button" data-action="uses" data-acc="' + esc(a.id) + '" data-id="' + esc(id) + '" data-d="-1" aria-label="Menos um uso">−</button><output class="num" id="usesOut-' + esc(a.id) + '" data-uses-out="' + esc(pk) + '">' + left + '</output><button type="button" data-action="uses" data-acc="' + esc(a.id) + '" data-id="' + esc(id) + '" data-d="1" aria-label="Mais um uso">+</button></div></div>';
  }).join('');
  const games = S.days.filter(d => FB.teamsOn(d).has(team)).length;
  const st = e.status || 'ok', avg = e.avg || c.avg;
  openSheet('<h3>' + esc(nameOf(id)) + '</h3><div class="small muted">' + esc(team || 'sem equipa') + ' · ' + games + ' jogos na run · no plano: ' + (inPlan.length ? 'dias ' + inPlan.join(', ') : 'nenhum dia') + '</div>' +
    (() => { const ci = ((((S.profile || {}).collection) || {}).players || {})[id] || (e.moments ? { moments: e.moments, sets: e.sets } : null); if (!ci) return '';
      return '<div class="small muted">Na carteira: ' + (groupMode() && ci.owners ? Object.entries(ci.owners).map(([k, n]) => esc(accLabel(k)) + ' ' + n).join(' · ') : ci.moments + ' Moment' + (ci.moments > 1 ? 's' : '')) + ((ci.sets || []).length ? ' (' + ci.sets.map(esc).join(', ') + ')' : '') + '</div>'; })() +
    injuryBlock(id, null, null) +
    (groupMode() ? '<div class="small muted">Usos restantes em cada conta</div>' : '') + usesRows + momentsBlock(id) +
    '<div><div class="label" style="margin-bottom:6px">Estado</div><div class="chips" role="group" aria-label="Estado">' + Object.keys(STATUS).map(k => '<button type="button" data-action="set-status" data-id="' + esc(id) + '" data-status="' + k + '" aria-pressed="' + (st === k) + '">' + STATUS[k].label + '</button>').join('') + '</div></div>' +
    (avg ? '<div><div class="label" style="margin-bottom:6px">Médias por jogo' + (c.gp ? ' (' + c.gp + ' jogos)' : '') + '</div><div class="kv sm">' + AVG_SHOW.map(k => { const a = FB.avgOf({ avg }, k); return a ? '<div><div class="label">' + STATS[k].short + (a.est ? '*' : '') + '</div><div class="v num">' + f1(a.v) + '</div></div>' : ''; }).join('') + '</div>' + (AVG_SHOW.some(k => (FB.avgOf({ avg }, k) || {}).est) ? '<div class="small muted" style="margin-top:6px">* estimativa a partir das outras médias</div>' : '') + '</div>' : '<div class="note info">Ainda sem médias para este jogador. Entram quando ele jogar.</div>') +
    (avg && avg.form ? '<div class="small muted">Últimos 5 jogos: ' + ['pts', 'reb', 'ast', 'fg3'].filter(k => avg.form.l5 && avg.form.l5[k] != null).map(k => STATS[k].short + ' ' + f1(avg.form.l5[k])).join(' · ') + ' (último jogo ' + dShort(avg.form.last) + ')</div>' : '') + gamesTable(avg) +
    '<button class="btn" type="button" data-action="remove-player" data-id="' + esc(id) + '">Tirar do plantel</button>' + closeRow());
}
// com smurfs: em que noites cada conta o usa e, com um só Moment, se compensa um 2.º
function momentsBlock(id) {
  if (!S.multi) return '';
  const copies = collectionInfo(id).copies;
  const daysOf = k => { const r = S.multi.byKey[k]; const ds = new Set(r ? r.normal.days.filter(x => x.lineup.includes(id)).map(x => x.idx + 1) : []);
    Object.entries(planOf(k).played || {}).forEach(([dt, pl]) => { if (pl && pl.done && (pl.lineup || []).includes(id)) { const i = S.days.findIndex(x => x.date === dt); if (i >= 0) ds.add(i + 1); } }); return [...ds]; };
  const per = accounts().map(a => ({ a, ds: daysOf(a.id) })).filter(x => x.ds.length);
  const nights = per.length ? per.map(x => esc(x.a.label) + ': ' + (x.ds.length === 1 ? 'dia ' : 'dias ') + spans(x.ds)).join(' · ') : 'nenhuma conta o usa no plano';
  const inWallet = !!((((S.profile || {}).collection) || {}).players || {})[id], nAcc = accounts().length;
  return '<div class="note' + (copies === 1 ? ' info' : '') + '" style="display:grid;gap:8px"><div>' + (copies === 1
    ? '<b>' + (inWallet ? 'Tens 1 Moment dele' : 'Conta com 1 Moment dele') + ':</b> em cada noite só joga por uma conta' + (inWallet ? '' : ' (não aparece nas carteiras lidas)') + '. ' + nights + '. As contas nunca o usam no mesmo dia; se o plano o quiser em mais do que uma, muda-o de conta entre noites (aparece no A fazer).'
    : '<b>Tens ' + copies + ' Moments dele:</b> ' + (copies >= nAcc ? 'todas as contas podem usá-lo na mesma noite' : 'até ' + copies + ' contas podem usá-lo na mesma noite') + '. ' + nights + '.') + '</div>' +
    (copies === 1 && S.runId ? '<button class="btn small" type="button" data-action="buy-eval" data-id="' + esc(id) + '" style="justify-self:start">Ver se compensa um 2.º Moment</button>' : '') + '</div>';
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

// ---------- carteira: Moments lidos da blockchain Flow, diretamente no browser ----------
// A API pública da Flow aceita pedidos de qualquer site. Os usos não estão na blockchain (dependem do escalão de cada Moment).
const FLOW_REST = 'https://rest-mainnet.onflow.org/v1';
const CAD_ROW = `let series: UInt32 = TopShot.getSetSeries(setID: m.data.setID) ?? 0
        out.append([TopShot.getPlayMetaDataByField(playID: m.data.playID, field: "FullName") ?? "", TopShot.getSetName(setID: m.data.setID) ?? "", series.toString(), id.toString()])`;
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
    return c.length === 1 ? c[0].p : null;
  };
}
// Lê as carteiras de todas as contas (principal e smurf) e junta os Moments por jogador do catálogo
async function walletSheet() {
  const seenAddr = new Set(), dupAddr = [];
  const accs = accounts().filter(a => /^0x[0-9a-fA-F]{16}$/.test((a.flow || '').trim())).filter(a => { const k = a.flow.trim().toLowerCase(); if (seenAddr.has(k)) { dupAddr.push(a.label); return false; } seenAddr.add(k); return true; });
  if (!accs.length) {
    openSheet('<h3>Ler carteira</h3><div class="small muted">Para ler os teus Moments preciso do endereço Flow da tua carteira Dapper (0x seguido de 16 letras e números). Põe-no no teu perfil, em Ajustes (e o das contas smurf, se tiveres).</div><div class="btns"><button class="btn quiet" type="button" data-action="close-sheet">Cancelar</button><button class="btn primary" type="button" data-action="goto" data-tab="ajustes" data-sub="perfil">Ir a Ajustes</button></div>');
    return;
  }
  openSheet('<h3>Ler carteira' + (accs.length > 1 ? 's' : '') + '</h3><div class="small muted" id="wProg">A ler os teus Moments na blockchain…</div>' + closeRow());
  const reads = [], failed = [];
  for (const a of accs) {
    try { reads.push({ a, w: await readWallet(a.flow.trim(), (d, t) => { const el = $('wProg'); if (el) el.textContent = 'A ler ' + a.label + '… ' + d + ' de ' + t + ' Moments'; }) }); }
    catch (e) { console.warn(e); failed.push(a.label + ': ' + String(e.message || e).slice(0, 120)); }
  }
  if (!$('wProg')) return; // fechou a folha entretanto
  if (!reads.length) { $('wProg').innerHTML = '<span class="down">Não consegui ler a carteira.</span> ' + esc(failed.join(' · ')) + '<br>Confirma o endereço Flow no perfil e tenta outra vez.'; return; }
  const find = catalogIndex();
  const by = new Map(), outside = new Map(), accTot = {};
  reads.forEach(({ a, w }) => {
    accTot[a.id] = { moments: w.total + w.extra.length, listed: w.listedAll };
    const add = (r, sale) => {
      const name = r[0]; if (!name) return;
      const p = find(name);
      if (!p) { outside.set(norm(name), name); return; }
      const e = by.get(p.id) || { p, n: 0, sale: 0, owners: {}, sets: {} };
      e.n++; if (sale) e.sale++; e.owners[a.id] = (e.owners[a.id] || 0) + 1; e.sets[r[1] || '?'] = (e.sets[r[1] || '?'] || 0) + 1;
      by.set(p.id, e);
    };
    w.rows.forEach(r => add(r, w.sale.has(String(r[3])))); w.extra.forEach(r => add(r, true));
  });
  const found = [...by.values()].sort((x, y) => ((y.p.avg && +y.p.avg.pts) || 0) - ((x.p.avg && +x.p.avg.pts) || 0));
  // coleção guardada no perfil (serve para todas as runs e para saber onde está cada Moment)
  const players = {};
  found.forEach(e => { players[e.p.id] = { name: e.p.name, moments: e.n, owners: e.owners, sets: Object.keys(e.sets).slice(0, 8) }; });
  S.walletCol = { read_at: new Date().toISOString(), accounts: accTot, players, outside: [...outside.values()].slice(0, 60) };
  const hasRun = !!S.runId && S.mineLoaded;
  const inWallet = new Set(found.map(e => String(e.p.id)));
  const gone = hasRun ? Object.keys(S.mine.roster || {}).filter(id => !inWallet.has(String(id)) && S.players.has(String(id))) : [];
  const fresh = hasRun ? found.filter(e => !S.mine.roster[e.p.id]) : [];
  S.walletGone = gone;
  const where = e => groupMode() ? ' · ' + Object.entries(e.owners).map(([k, n]) => esc(accLabel(k)) + (n > 1 ? ' ×' + n : '')).join(', ') : '';
  const setsTxt = e => Object.entries(e.sets).sort((a, b) => b[1] - a[1]).map(([n, c]) => esc(n) + (c > 1 ? ' ×' + c : '')).join(', ');
  const li = e => { const inR = hasRun && S.mine.roster[e.p.id];
    return '<li><b>' + esc(e.p.name) + '</b> <span class="muted">(' + esc(e.p.team || '—') + ')</span> · ' + e.n + ' Moment' + (e.n > 1 ? 's' : '') + (e.sale ? ' (' + e.sale + ' à venda)' : '') + where(e) +
      (hasRun ? ' · ' + (inR ? '<span class="muted">no plantel</span>' : '<span class="up">novo</span>') : '') + '<div class="small muted">' + setsTxt(e) + '</div></li>'; };
  const tot = Object.entries(accTot).map(([k, t]) => (groupMode() ? esc(accLabel(k)) + ' ' : '') + t.moments + ' Moments' + (t.listed ? ' (' + t.listed + ' à venda)' : '')).join(' · ');
  openSheet('<h3>A tua coleção</h3><div class="small muted">' + tot + ' · ' + found.length + ' jogadores na NBA esta época</div>' +
    (failed.length ? '<div class="note">Não consegui ler: ' + esc(failed.join(' · ')) + '</div>' : '') +
    (dupAddr.length ? '<div class="note">' + esc(dupAddr.join(', ')) + ' tem o mesmo endereço Flow de outra conta: só li essa carteira uma vez. Confirma os endereços em Ajustes → Perfil.</div>' : '') +
    (hasRun ? '<div class="note info">Os usos não estão na blockchain: dependem do escalão de cada Moment. Os novos entram com 1 uso (menos os que já gastaste nesta run). Depois muda no plantel os que têm mais.</div>' : '') +
    (found.length ? '<ul class="ops">' + found.map(li).join('') + '</ul>' : '<div class="small muted">Nenhum Moment de um jogador com equipa NBA esta época.</div>') +
    (outside.size ? '<div class="small muted">Fora do catálogo (WNBA, retirados ou sem equipa), não entram: ' + [...outside.values()].slice(0, 25).map(esc).join(', ') + (outside.size > 25 ? ' e mais ' + (outside.size - 25) : '') + '.</div>' : '') +
    (gone.length ? '<label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="wGone"> <span>Tirar do plantel quem já não está na carteira: ' + gone.map(id => esc(nameOf(id))).join(', ') + '</span></label>' : '') +
    '<button class="btn primary" type="button" data-action="wallet-apply" style="width:100%">' + (hasRun ? (fresh.length ? 'Guardar e juntar ' + fresh.length + ' jogador' + (fresh.length > 1 ? 'es' : '') + ' ao plantel' : 'Guardar e atualizar o plantel') : 'Guardar a coleção') + '</button>' + closeRow());
}
async function walletApply() {
  const col = S.walletCol; if (!col) return;
  // guarda no perfil
  try { await q(sb.from('profiles').update({ collection: col }).eq('user_id', S.session.user.id)); S.profile = Object.assign({}, S.profile, { collection: col }); }
  catch (e) { toast(/collection/.test(errText(e)) ? 'Para guardar a coleção, corre o supabase/schema.sql novo no Supabase.' : 'A coleção não ficou guardada: ' + errText(e)); S.profile = Object.assign({}, S.profile, { collection: col }); }
  let added = 0, removed = 0;
  if (S.runId && S.mineLoaded) {
    Object.entries(col.players).forEach(([id, c]) => {
      const info = { moments: c.moments, sets: c.sets };
      if (S.mine.roster[id]) Object.assign(S.mine.roster[id], info);
      else { S.mine.roster[id] = Object.assign({ uses: Math.max(0, 1 - usedCount('main', id)), status: 'ok' }, info); added++; }
    });
    const box = $('wGone');
    if (box && box.checked) (S.walletGone || []).forEach(id => { delete S.mine.roster[id]; removed++; });
    applyChainResults(); saveMine();
  }
  S.walletCol = null; S.walletGone = null;
  closeSheet(); schedule();
  toast(S.runId ? (added ? added + ' jogador' + (added > 1 ? 'es' : '') + ' novo' + (added > 1 ? 's' : '') + ' no plantel' : 'Plantel atualizado') + (removed ? ', ' + removed + ' tirado' + (removed > 1 ? 's' : '') : '') + '. Acerta os usos.' : 'Coleção guardada.');
}
// junta ao plantel da run os jogadores da coleção guardada (1 uso cada; acertam-se depois)
function collectionToRoster() {
  const col = (S.profile || {}).collection; if (!col || !S.runId) return;
  let added = 0;
  Object.entries(col.players || {}).forEach(([id, c]) => { if (!S.mine.roster[id] && S.players.has(String(id))) { S.mine.roster[id] = { uses: Math.max(0, 1 - usedCount('main', id)), status: 'ok', moments: c.moments, sets: c.sets }; added++; } });
  applyChainResults(); schedule(); saveMine();
  toast(added + ' jogador' + (added === 1 ? '' : 'es') + ' da coleção no plantel. Acerta os usos.');
}

// ---------- ações ----------
function deepMerge(a, b) {
  Object.keys(b).forEach(k => {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], b[k]);
    else a[k] = clone(b[k]);
  });
  return a;
}
function planPatch(patch) { deepMerge(curPlan(), patch); schedule(); saveMine(); }
function lockToggle(id, date, on) {
  const cur = new Set(((curPlan().locks || {})[date]) || []);
  if (on) {
    const lim = (S.days.find(d => d.date === date) || {}).numPlayers || 5;
    if (cur.size >= lim) { toast('Já tens ' + lim + ' jogadores fixados neste dia.'); return; }
    cur.add(id);
    planPatch({ locks: { [date]: [...cur] }, bans: { [date]: (((curPlan().bans || {})[date]) || []).filter(x => x !== id) } });
    toast(lastName(id) + ' fixado. Plano refeito.');
  } else { cur.delete(id); planPatch({ locks: { [date]: [...cur] } }); }
}
function banToggle(id, date, on) {
  const cur = new Set(((curPlan().bans || {})[date]) || []);
  on ? cur.add(id) : cur.delete(id);
  planPatch({ bans: { [date]: [...cur] }, locks: { [date]: (((curPlan().locks || {})[date]) || []).filter(x => !on || x !== id) } });
  if (on) toast(lastName(id) + ' fora deste dia. Plano refeito.');
}
function setStatus(id, status) { if (!S.mine.roster[id]) return; S.mine.roster[id].status = status; schedule(); saveMine(); }
const useTimers = {};
function changeUses(id, delta, acc) {
  acc = acc || S.acc;
  const e = S.mine.roster[id]; if (!e) return;
  const pk = acc + '|' + id;
  const cur = S.pendingUses[pk] != null ? S.pendingUses[pk] : usesEff(e, id, acc);
  const nv = Math.max(0, Math.min(20, cur + delta));
  S.pendingUses[pk] = nv; schedule();
  const out = $('usesOut-' + acc); if (out) out.textContent = nv;
  document.querySelectorAll('[data-uses-out="' + CSS.escape(pk) + '"]').forEach(o => { o.textContent = nv; });
  clearTimeout(useTimers[pk]);
  useTimers[pk] = setTimeout(() => { if (S.mine.roster[id] && S.pendingUses[pk] != null) setUsesOf(S.mine.roster[id], acc, S.pendingUses[pk]); delete S.pendingUses[pk]; saveMine(); schedule(); }, 400);
}
// Acertar os usos de todos de uma vez: procura por nome e − / + em cada um (em cada conta, com smurfs)
function usesSheet() {
  openSheet('<h3>Acertar usos</h3><div class="small muted">Escreve parte do nome e acerta os usos que restam a cada um nesta run' + (groupMode() ? ', em cada conta' : '') + '. Guarda sozinho.</div>' +
    '<input class="field" id="usesSearch" type="search" placeholder="Procurar (ex.: james)" autocomplete="off" aria-label="Procurar no plantel"><div id="usesList" class="card"></div>' + closeRow());
  renderUsesList('');
  setTimeout(() => { const f = $('usesSearch'); if (f) f.focus(); }, 60);
}
function renderUsesList(qs) {
  const box = $('usesList'); if (!box) return;
  const qn = norm(qs), accs = accounts();
  const ids = Object.keys(S.mine.roster || {}).filter(id => !qn || norm(nameOf(id)).includes(qn)).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  box.innerHTML = ids.length ? '<ul class="list">' + ids.map(id => {
    const e = S.mine.roster[id], team = e.team || (S.players.get(String(id)) || {}).team || '', games = S.days.filter(d => FB.teamsOn(d).has(team)).length;
    return '<li class="uses-row' + (accs.length > 1 ? ' multi' : '') + '"><div style="min-width:0"><div class="pn"><span class="nm">' + esc(nameOf(id)) + '</span></div><div class="ps">' + teamTag(team) + ' · ' + plural(games, 'jogo', 'jogos') + ' na run</div></div><div class="uses-steps">' +
      accs.map(a => { const pk = a.id + '|' + id, left = S.pendingUses[pk] != null ? S.pendingUses[pk] : usesEff(e, id, a.id);
        return '<div class="us">' + (accs.length > 1 ? '<span class="small muted">' + esc(a.label) + '</span>' : '') + '<div class="stepper sm"><button type="button" data-action="uses" data-acc="' + esc(a.id) + '" data-id="' + esc(id) + '" data-d="-1" aria-label="Menos um uso de ' + esc(nameOf(id)) + '">−</button><output class="num" data-uses-out="' + esc(pk) + '">' + left + '</output><button type="button" data-action="uses" data-acc="' + esc(a.id) + '" data-id="' + esc(id) + '" data-d="1" aria-label="Mais um uso de ' + esc(nameOf(id)) + '">+</button></div></div>'; }).join('') +
      '</div></li>'; }).join('') + '</ul>' : '<div class="row muted small">Nenhum jogador do plantel com esse nome.</div>';
}
function addToRoster(id, uses, extra) {
  S.mine.roster[id] = Object.assign({ uses: uses == null ? 1 : uses, status: 'ok' }, extra || {});
  applyChainResults(); schedule(); saveMine();
}
function recordResult(date, res) {
  const d = view().days.find(x => x.date === date); if (!d) return;
  const lineup = (liveOn(date) && d.live ? d.live.submitted : d.lineup).slice();
  lineup.forEach(id => { const e = S.mine.roster[id]; if (e) setUsesOf(e, S.acc, Math.max(0, usesEff(e, id, S.acc) - 1)); });
  planPatch({ played: { [date]: { done: true, result: res, lineup } } });
  toast((res === 'win' ? 'Vitória' : 'Derrota') + ' registada. Usos descontados e plano refeito.');
}
function undoResult(date) {
  const pl = ((curPlan().played || {})[date]) || {};
  (pl.lineup || []).forEach(id => { const e = S.mine.roster[id]; if (e) setUsesOf(e, S.acc, usesEff(e, id, S.acc) + 1); });
  planPatch({ played: { [date]: { done: false, result: null, lineup: pl.lineup || [] } } });
  toast('Resultado desfeito. Usos repostos.');
}
function liveToggle() {
  const nd = nextDay(); if (!nd) return;
  if (liveOn(nd.date)) { planPatch({ live: { [nd.date]: { active: false } } }); return; }
  const cur = liveDoc(nd.date), lineup = view().days[0].lineup.slice();
  planPatch({ live: { [nd.date]: { active: true, lineup: cur && cur.lineup && cur.lineup.length ? cur.lineup : lineup, players: (cur && cur.players) || {} } } });
  toast('Jogo a jogo ligado com o lineup atual.');
  if (gamesWindow(nd)) { S.liveAt = Date.now(); setTimeout(() => liveFetch(true), 300); } // já há jogos: lê as estatísticas logo
}
function liveSet(id, patch) { const nd = nextDay(); if (nd) planPatch({ live: { [nd.date]: { players: { [id]: patch } } } }); }
function swapDone() { const nd = nextDay(), d = view().days[0]; planPatch({ live: { [nd.date]: { lineup: d.lineup.slice() } } }); toast('Lineup atualizado.'); }
// Vai buscar o box score oficial da NBA para os jogadores do lineup submetido
// ESPN: estatísticas de um jogo (summary) → {nomeNormalizado: {pts, reb, ast, fg3, stl, blk, tov, oreb, dreb, fgm, fga, fg3a, ftm, fta}}
function espnBox(json) {
  const out = {};
  for (const team of (((json || {}).boxscore || {}).players) || []) {
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
        out[norm((a.athlete || {}).displayName)] = v;
      }
    }
  }
  return out;
}
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
  const gameIds = new Set();
  sub.forEach(id => { const team = (S.result.model.players[S.result.model.pIndex.get(id)] || {}).team; const g = FB.gameOf(nd, team); if (g && g[3]) gameIds.add(g[3]); });
  if (!gameIds.size) { if (!quiet) toast('Sem identificador de jogo no calendário. Mete os valores à mão.'); return; }
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
          const vals = liveVals(nd, v, id);
          players[id] = stt.state === 'post' ? { state: 'fim', vals } : { state: 'jogo', q: Math.min(4, Math.max(1, stt.period)), vals };
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
        const raw = {}; Object.entries(LIVE_STAT).forEach(([k, f]) => { const x = (pl.statistics || {})[f]; if (x != null && isFinite(+x)) raw[k] = +x; });
        const vals = liveVals(nd, raw, id);
        players[id] = g.gameStatus === 3 ? { state: 'fim', vals } : { state: 'jogo', q: Math.min(4, Math.max(1, +g.period || 1)), vals };
      }));
    } catch (e) { /* bloqueado ou sem rede */ }
  }));
  if (!ok) { if (!quiet) toast('Ainda não há estatísticas ao vivo (jogo por começar?) ou não consegui lê-las. Mete os valores à mão ou tenta daqui a pouco.'); return; }
  if (Object.keys(players).length) planPatch({ live: { [nd.date]: { players } } });
  S.liveAt = Date.now();
  if (!quiet) toast('Estatísticas ao vivo atualizadas.');
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
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-action]')) e.target.click(); });
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action], [data-tab]');
  if (!b || b.disabled) return;
  if (b.matches('.tab')) { setTab(b.dataset.tab); return; }
  const a = b.dataset.action, id = b.dataset.id, date = b.dataset.date, nd = nextDay();
  switch (a) {
    case 'auth-mode': renderAuth(b.dataset.mode); break;
    case 'logout': if (mineTimer) { clearTimeout(mineTimer); await saveNow(); } else await mineSaving; clearTimeout(sumTimer); await sb.auth.signOut(); S.session = null; S.role = null; S.profile = null; S.invite = null; closeSheet(); renderAuth(); break;
    case 'goto': closeSheet(); if (b.dataset.sub) setSub(b.dataset.tab, b.dataset.sub); setTab(b.dataset.tab); break;
    case 'sub': setSub(b.dataset.stab, b.dataset.sub); if (document.activeElement) document.activeElement.blur(); render(); window.scrollTo(0, 0); break;
    case 'acc-run': S.acc = b.dataset.acc; if (S.multi && S.multi.byKey[S.acc]) S.result = S.multi.byKey[S.acc]; setSub('run', 'premios'); render(); window.scrollTo(0, 0); break;
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
    case 'uses': changeUses(id, +b.dataset.d, b.dataset.acc); break;
    case 'acc': S.acc = b.dataset.acc; if (S.multi && S.multi.byKey[S.acc]) S.result = S.multi.byKey[S.acc]; render(); break;
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
      let nv = Math.round(((parseFloat(inp.value) || 0) + (+b.dataset.d)) * 10) / 10; if (!/-/.test(stat)) nv = Math.max(0, nv); inp.value = nv;
      clearTimeout(liveInputTimer); liveInputTimer = setTimeout(() => liveSet(id, { vals: { [stat]: nv } }), 400); break;
    }
    case 'add-player': addPlayerSheet(); break;
    case 'uses-sheet': usesSheet(); break;
    case 'add-id': addToRoster(id, 1); toast(nameOf(id) + ' adicionado com 1 uso. Toca nele no plantel para mudar.'); renderSearch(($('apSearch') || {}).value || ''); break;
    case 'custom-player': customPlayerSheet(); break;
    case 'save-custom': {
      const name = ($('cpName').value || '').trim(); if (!name) { toast('Escreve o nome.'); return; }
      const cid = 'x-' + (name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now());
      addToRoster(cid, Math.max(0, parseInt($('cpUses').value, 10) || 0), { name, team: $('cpTeam').value }); closeSheet(); toast(name + ' adicionado.'); break;
    }
    case 'paste-sheet': pasteSheet(); break;
    case 'wallet-sheet': await walletSheet(); break;
    case 'wallet-apply': b.disabled = true; await walletApply(); break;
    case 'col-to-roster': collectionToRoster(); break;
    case 'col-sheet': closeSheet(); setSub('plantel', 'colecao'); setTab('plantel'); break;
    case 'alts': await altSheet(); break;
    case 'cmp-sort': {
      const c = b.dataset.col, cur = S.cmpSort || {};
      S.cmpSort = { col: c, dir: cur.col === c ? -cur.dir : -1 };
      const left = ($('cmpWrap') || {}).scrollLeft || 0;
      if (b.dataset.in === 'tab') { const y = window.scrollY; renderHoje(); window.scrollTo(0, y); }
      else { const top = $('sheetPanel').scrollTop; daySheet(date); $('sheetPanel').scrollTop = top; }
      if ($('cmpWrap')) $('cmpWrap').scrollLeft = left;
      break;
    }
    case 'alt-use': altUse(b.dataset.i); break;
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
    case 'buy-open': if (S.autoBuy && S.autoBuy.key === autoBuyKey()) { S.buy.uses = S.autoBuy.U; S.buy.mode = 'new'; S.buy.results = S.autoBuy; } closeSheet(); setSub('plantel', 'comprar'); setTab('plantel'); break;
    case 'buy-eval': closeSheet(); setSub('plantel', 'comprar'); setTab('plantel'); await buyRun(id); break;
    case 'buy-mode': S.buy.mode = b.dataset.mode; S.buy.results = null; renderPlantel(); break;
    case 'buy-uses': S.buy.uses = +b.dataset.n; S.buy.results = null; renderPlantel(); break;
    case 'pform': S.mine.roster[id] ? rosterSheet(id) : catalogSheet(id); break;
    case 'forma-scope': S.forma.scope = b.dataset.v; renderPlantel(); break;
    case 'forma-stat': S.forma.stat = b.dataset.v; renderPlantel(); break;
    case 'borrow-run': b.disabled = true; await borrowRun(); break;
    case 'share-plan': {
      const v = b.dataset.v === '1';
      try { await q(sb.from('profiles').update({ share_plan: v }).eq('user_id', S.session.user.id)); S.profile.share_plan = v; S.lastSummary = ''; publishSummary(); renderAjustes(); toast(v ? 'O grupo vê o teu plano.' : 'Deixaste de partilhar o plano.'); }
      catch (err) { toast(/share_plan/.test(String(err && err.message)) ? 'Falta correr o supabase/schema.sql novo no Supabase.' : errText(err)); }
      break;
    }
    case 'spec-stat': S.spec.stat = b.dataset.v; renderPlantel(); break;
    case 'theme': applyTheme(b.dataset.v); renderAjustes(); break;
    case 'spec-scope': S.spec.scope = b.dataset.v; renderPlantel(); break;
    case 'buy-run': b.disabled = true; await buyRun(null); if (b.isConnected) b.disabled = false; break;
    case 'buy-pick': await buyRun(id); break;
    case 'alt-reset': { const nd = nextDay(); if (nd) { planPatch({ locks: { [nd.date]: [] } }); closeSheet(); toast('Voltaste ao lineup sugerido.'); } break; }
    case 'b2b': b2bOn = b.dataset.v === '1'; try { localStorage.setItem('fb-b2b', b2bOn ? '1' : '0'); } catch (e) {} schedule(); renderAjustes(); toast(b2bOn ? 'Jogos seguidos: o plano ajusta.' : 'Jogos seguidos: sem ajuste.'); break;
    case 'form-level': formLevel = b.dataset.level; try { localStorage.setItem('fb-form', formLevel); } catch (e) {} FB.setForm(+formLevel); schedule(); renderAjustes(); toast('Peso da forma: ' + FORM_LEVELS.find(x => x[0] === formLevel)[1] + '.'); break;
    case 'sm-add': smurfReadInputs(); S.smDraft.push({}); renderAjustes(); break;
    case 'sm-del': smurfReadInputs(); S.smDraft.splice(+b.dataset.i, 1); renderAjustes(); break;
    case 'test-run': b.disabled = true; await createTestRun(); break;
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
  if (t.id === 'runPick') { S.loading = true; render(); await loadRun(t.value); S.loading = false; t.blur(); compute(); render(); renderAjustes(); return; }
  if (t.id === 'chainPick') { const run = curRun(); if (await adminWrite(sb.from('runs').update({ chain_run_id: t.value || null }).eq('id', run.id), t.value ? 'Run ligada à blockchain.' : 'Ligação removida.')) { run.chain_run_id = t.value || null; await loadGroup(); schedule(); } return; }
  if (a === 'obj-stat') setObjective(+t.dataset.i, t.value, null);
  if (a === 'obj-target') { const n = parseInt(t.value, 10); if (n > 0) setObjective(+t.dataset.i, null, n); }
  if (a === 'pz-w' || a === 'pz-v') {
    const run = curRun(), pz = clone(run.prizes || []), i = +t.dataset.i; if (!pz[i]) return;
    const n = parseFloat(t.value); if (!(n >= 0)) return;
    if (a === 'pz-w') pz[i].wins = Math.max(1, Math.round(n)); else pz[i].value = n;
    setPrizes(pz);
  }
  if (a === 'live-input') { const nd = nextDay(), stat = ((nd.objectives || [])[0] || {}).stat || 'pts'; const x = parseFloat(t.value) || 0; liveSet(t.dataset.id, { vals: { [stat]: /-/.test(stat) ? x : Math.max(0, x) } }); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'rosterFilter') { S.filter = e.target.value; renderPlantel(); }
  if (e.target.id === 'apSearch') renderSearch(e.target.value);
  if (e.target.id === 'buySearch') renderBuySearch(e.target.value);
  if (e.target.id === 'usesSearch') renderUsesList(e.target.value);
});
// (sem redesenhar Ajustes ao sair de um campo: isso apagava o formulário a meio de um clique em Guardar)
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });
// Ao voltar à app, relê o plano (pode ter sido mudado noutro dispositivo) e o grupo
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !S.runId || !S.session) return;
  try {
    const mine = await q(sb.from('user_runs').select('*').eq('run_id', S.runId).eq('user_id', S.session.user.id).maybeSingle());
    if (mine && Date.parse(mine.updated_at) > (S.mineSeen || 0)) { S.mine = { roster: mine.roster || {}, plan: mine.plan || {} }; S.mineSeen = Date.parse(mine.updated_at); }
    await Promise.all([loadGroup(), loadInjuries()]); applyChainResults(); schedule();
  } catch (err) { /* sem rede: fica como está */ }
});
function setTabUI() { TABS.forEach(t => { $('tab-' + t).hidden = t !== S.tab; $('t-' + t).setAttribute('aria-selected', String(t === S.tab)); }); }
function setTab(tab) {
  S.tab = tab; setTabUI();
  try { localStorage.setItem('fb-tab3', tab); } catch (e) {}
  render(); window.scrollTo(0, 0);
}
// a cada minuto: com jogo a jogo ligado, o relógio decide que jogos já começaram e as estatísticas ao vivo
// atualizam sozinhas de 2 em 2 minutos; o placar dos jogos de hoje atualiza enquanto há jogos
setInterval(() => {
  if (!S.session || document.visibilityState !== 'visible') return;
  const nd = nextDay(); if (!nd) return;
  if (liveOn(nd.date)) { schedule(); if (Date.now() - (S.liveAt || 0) > 115e3) { S.liveAt = Date.now(); liveFetch(true); } }
  if (S.tab === 'hoje' && gamesWindow(nd)) refreshBoard(nd.date);
}, 60000);

// ---------- arranque ----------
(async function init() {
  if (!sb) { showGate(brand() + '<div class="err">O site ainda não está ligado ao Supabase.</div><p class="small muted" style="margin:0">Põe o Project URL e a chave anon/publishable em <span class="kbd">docs/config.js</span>.</p>'); return; }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { S.session = null; } });
  try { await afterLogin(); } catch (e) { renderAuth('login', errText(e)); }
})();
