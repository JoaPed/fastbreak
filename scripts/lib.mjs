// Funções partilhadas pelas tarefas automáticas. As puras (sem rede) têm testes em test/jobs.test.mjs.

export const STAT_MARKET = { pts: 'player_points', reb: 'player_rebounds', ast: 'player_assists', fg3: 'player_threes', stl: 'player_steals', blk: 'player_blocks', tov: 'player_turnovers', fgm: 'player_field_goals', ftm: 'player_frees_made', fta: 'player_frees_attempts' };
export const MARKET_STAT = Object.fromEntries(Object.entries(STAT_MARKET).map(([k, v]) => [v, k]));
// Estatísticas sem mercado de odds: usa-se a linha de uma parecida (o motor ajusta pela proporção nas médias do jogador)
export const MARKET_PROXY = { oreb: 'reb', dreb: 'reb', fga: 'fgm', fg3a: 'fg3', pip: 'pts' };
// Mercados a pedir para uma estatística do objetivo ("ast-tov" → assistências e perdas de bola)
export function marketsForStat(key) {
  const out = new Set();
  for (const s of String(key || '').split(/[+-]/)) { const m = STAT_MARKET[s] || STAT_MARKET[MARKET_PROXY[s]]; if (m) out.add(m); }
  return [...out];
}
// Médias guardadas por jogador (a ordem é a das colunas)
export const AVG_KEYS = ['pts', 'reb', 'ast', 'fg3', 'stl', 'blk', 'tov', 'oreb', 'dreb', 'fgm', 'fga', 'fg3a', 'ftm', 'fta', 'min'];
const isNum = x => x != null && x !== '' && isFinite(+x);
export const FLOW_REST = 'https://rest-mainnet.onflow.org/v1';
export const FASTBREAK = 'A.0b2a3299cc857e29.FastBreakV1';

// ---------- texto e datas ----------
export function norm(name) {
  return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[.'’`]/g, '').replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
}
// Data do calendário NBA (hora de Nova Iorque) para um instante
export function etDate(when) {
  const d = typeof when === 'number' ? new Date(when) : new Date(when);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function addDays(date, n) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function minutes(iso) { // "PT34M12.00S" → 34.2
  const m = String(iso || '').match(/PT(?:(\d+)M)?(?:([\d.]+)S)?/);
  return m ? (+m[1] || 0) + (+m[2] || 0) / 60 : 0;
}

// ---------- calendário NBA (cdn.nba.com scheduleLeagueV2.json) ----------
// Devolve {data: [[fora, casa, inícioISO, gameId], ...]} só com jogos que contam (sem pré-época nem All-Star)
export function parseSchedule(json) {
  const out = {};
  const dates = (((json || {}).leagueSchedule || {}).gameDates) || [];
  for (const gd of dates) {
    for (const g of gd.games || []) {
      const id = String(g.gameId || '');
      if (!/^00[2456]/.test(id)) continue;
      const date = String(g.gameDateEst || '').slice(0, 10) || (g.gameDateTimeUTC ? etDate(g.gameDateTimeUTC) : null);
      const away = g.awayTeam && g.awayTeam.teamTricode, home = g.homeTeam && g.homeTeam.teamTricode;
      if (!date || !away || !home) continue;
      const tip = g.gameDateTimeUTC || g.gameDateUTC || null;
      (out[date] = out[date] || []).push([away, home, tip, id]);
    }
  }
  Object.values(out).forEach(list => list.sort((a, b) => String(a[2]).localeCompare(String(b[2]))));
  return out;
}
export function finalGameIds(json, prefixes) {
  const ids = [];
  for (const gd of (((json || {}).leagueSchedule || {}).gameDates) || []) {
    for (const g of gd.games || []) {
      const id = String(g.gameId || '');
      if (+g.gameStatus === 3 && prefixes.some(p => id.startsWith(p))) ids.push({ id, date: String(g.gameDateEst || '').slice(0, 10) });
    }
  }
  return ids;
}

// ---------- médias dos jogadores (box scores oficiais) ----------
const BOX_KEYS = { pts: 'points', reb: 'reboundsTotal', ast: 'assists', fg3: 'threePointersMade', stl: 'steals', blk: 'blocks' };
// Identificador de cada jogador no catálogo: o nome normalizado ("nikola-jokic"). Junta as fontes (NBA, ESPN, casas de apostas) pelo nome.
export const playerKey = name => norm(name).replace(/ /g, '-');
const ESPN_TEAM = { GS: 'GSW', NY: 'NYK', SA: 'SAS', NO: 'NOP', UTAH: 'UTA', WSH: 'WAS', PHO: 'PHX', BRK: 'BKN', CHO: 'CHA' };
export const espnTeam = abbr => { const a = String(abbr || '').toUpperCase(); return ESPN_TEAM[a] || a || null; };
function entry(state, name) {
  const key = playerKey(name); if (!key) return null;
  const p = (state.players[key] = state.players[key] || { name });
  if (name && (!p.name || /[^\x00-\x7F]/.test(name))) p.name = name; // prefere a grafia com acentos
  return p;
}
// Junta um box score oficial: bucket = 'cur' (época atual, conta para a média) ou 'team' (pré-época: só a equipa)
export function addBoxscore(state, json, bucket, date) {
  const g = (json || {}).game; if (!g) return 0;
  let n = 0;
  for (const side of [g.homeTeam, g.awayTeam]) {
    if (!side) continue;
    for (const pl of side.players || []) {
      const name = pl.name || [pl.firstName, pl.familyName].filter(Boolean).join(' ');
      const p = entry(state, name); if (!p) continue;
      if (pl.personId) p.nbaId = String(pl.personId);
      const st = pl.statistics || {};
      const min = minutes(st.minutes || st.minutesCalculated);
      if (bucket === 'team') { if (!p.preDate || (date && date >= p.preDate)) { p.preTeam = side.teamTricode || p.preTeam; p.preDate = date || p.preDate; } continue; }
      if (!p.boxDate || (date && date >= p.boxDate)) { p.boxTeam = side.teamTricode || p.boxTeam; p.boxDate = date || p.boxDate; }
      if (min <= 0 || pl.played === '0') continue;
      const t = (p.cur = p.cur || { gp: 0, min: 0, pts: 0, reb: 0, ast: 0, fg3: 0, stl: 0, blk: 0 });
      t.gp++; t.min += min;
      for (const [k, key] of Object.entries(BOX_KEYS)) t[k] += +st[key] || 0;
      n++;
    }
  }
  return n;
}
// Nomes da ESPN para as médias que não vêm sempre (ressaltos ofensivos e defensivos só vêm na ficha de cada jogador)
const ESPN_AVG_EXTRA = { tov: 'avgTurnovers', fgm: 'avgFieldGoalsMade', fga: 'avgFieldGoalsAttempted', fg3a: 'avgThreePointFieldGoalsAttempted', ftm: 'avgFreeThrowsMade', fta: 'avgFreeThrowsAttempted', oreb: 'avgOffensiveRebounds', dreb: 'avgDefensiveRebounds' };
// mantém os ressaltos ofensivos/defensivos lidos da ficha se o número de jogos não mudou
function keepCore(old, gp) { return old && old.coreGp != null && old.coreGp === gp ? { oreb: old.oreb, dreb: old.dreb, coreGp: old.coreGp } : {}; }
// ESPN — ficha de um jogador numa época (sports.core.api …/athletes/<id>/statistics) → médias que faltam na lista
export function parseEspnCoreStats(json) {
  const v = {};
  for (const c of (((json || {}).splits || {}).categories) || []) for (const st of c.stats || []) if (v[st.name] == null && isNum(st.value)) v[st.name] = +st.value;
  if (!v.gamesPlayed) return null;
  const out = { gp: v.gamesPlayed };
  for (const [k, name] of Object.entries(ESPN_AVG_EXTRA)) if (isNum(v[name])) out[k] = Math.round(v[name] * 100) / 100;
  return out;
}
// Junta a ficha às médias de uma época (bucket 'prevAvg' ou 'curAvg')
export function addEspnCore(p, bucket, core) {
  if (!p || !core || !p[bucket]) return false;
  const a = p[bucket];
  if (isNum(core.oreb)) a.oreb = core.oreb;
  if (isNum(core.dreb)) a.dreb = core.dreb;
  a.coreGp = a.gp;
  return true;
}
// ESPN — médias da época passada (statistics/byathlete). Devolve quantos jogadores leu nesta página.
export function addEspnSeason(state, json) {
  const names = {};
  for (const c of (json && json.categories) || []) names[c.name] = c.names || [];
  let n = 0;
  for (const a of (json && json.athletes) || []) {
    const ath = a.athlete || {}, vals = {};
    for (const c of a.categories || []) {
      const keys = names[c.name] || [], arr = c.totals || c.values || [];
      keys.forEach((k, i) => { if (arr[i] != null && vals[k] == null) vals[k] = parseFloat(String(arr[i]).replace(',', '.')); });
    }
    const p = entry(state, ath.displayName || [ath.firstName, ath.lastName].filter(Boolean).join(' ')); if (!p) continue;
    if (ath.id) p.espnId = String(ath.id);
    p.prevTeam = espnTeam(ath.teamShortName || ((ath.teams || [])[0] || {}).abbreviation) || p.prevTeam;
    const avg = { gp: vals.gamesPlayed || 0, min: vals.avgMinutes || 0, pts: vals.avgPoints || 0, reb: vals.avgRebounds || 0, ast: vals.avgAssists || 0, fg3: vals.avgThreePointFieldGoalsMade || 0, stl: vals.avgSteals || 0, blk: vals.avgBlocks || 0 };
    for (const [k, name] of Object.entries(ESPN_AVG_EXTRA)) if (isNum(vals[name])) avg[k] = +vals[name];
    p.prevAvg = Object.assign(keepCore(p.prevAvg, avg.gp), avg);
    n++;
  }
  return n;
}
// ESPN — plantel atual de uma equipa (apanha trocas antes do primeiro jogo e os rookies)
export function addEspnRoster(state, team, json, date) {
  let list = (json && json.athletes) || [];
  if (list.length && list[0] && Array.isArray(list[0].items)) list = list.flatMap(g => g.items || []);
  let n = 0;
  for (const a of list) {
    const p = entry(state, a.displayName || a.fullName || [a.firstName, a.lastName].filter(Boolean).join(' ')); if (!p) continue;
    p.rosterTeam = team; p.rosterDate = date; if (a.id) p.espnId = String(a.id); n++;
  }
  return n;
}
// ESPN — médias desta época (mesma lista que a época passada, outro ano)
export function addEspnCurrent(state, json) {
  const tmp = { players: {} };
  const n = addEspnSeason(tmp, json);
  for (const [key, t] of Object.entries(tmp.players)) {
    const p = entry(state, t.name); if (!p) continue;
    p.curAvg = Object.assign(keepCore(p.curAvg, t.prevAvg.gp), t.prevAvg); p.curTeam = t.prevTeam || p.curTeam;
    if (t.espnId) p.espnId = t.espnId;
  }
  return n;
}
// Equipa atual: plantel ESPN > equipa nos jogos desta época > último jogo da NBA > pré-época > época passada
export function teamOf(p) { return p.rosterTeam || p.curTeam || p.boxTeam || p.preTeam || p.prevTeam || null; }
// Média desta época puxada para a da época passada enquanto há poucos jogos
export function blendedAverages(p, prior = 10) {
  let cur = p.curAvg && p.curAvg.gp > 0 ? p.curAvg : null;
  if (!cur && p.cur && p.cur.gp > 0) { const t = p.cur; cur = { gp: t.gp }; for (const s of AVG_KEYS) if (isNum(t[s])) cur[s] = t[s] / t.gp; }
  const prev = p.prevAvg && p.prevAvg.gp >= 5 ? p.prevAvg : null;
  if (!cur && !prev) return null;
  const gp = cur ? cur.gp : 0, k = prev ? Math.max(0, prior - gp) : 0;
  const avg = {};
  const r = x => Math.round(x * 100) / 100;
  for (const s of AVG_KEYS) {
    const c = cur && isNum(cur[s]) ? +cur[s] : null, pa = prev && isNum(prev[s]) ? +prev[s] : null;
    const wc = c != null ? gp : 0, wp = pa != null ? k : 0;
    // uma estatística que só uma das épocas tem (p. ex. ressaltos ofensivos ainda por ler) vem só dessa
    if (wc + wp > 0) avg[s] = r((wc * c + wp * pa) / (wc + wp));
    else if (c != null) avg[s] = r(c);
    else if (pa != null) avg[s] = r(pa);
  }
  return { avg, gp };
}

// ---------- ESPN: calendário e estatísticas de um jogo ----------
// scoreboard?dates=AAAAMMDD → [[fora, casa, inícioISO, 'espn:<id>']] (sem pré-época)
export function parseEspnScoreboard(json) {
  const out = [];
  for (const ev of (json && json.events) || []) {
    if (ev.season && +ev.season.type === 1) continue;
    const comp = (ev.competitions || [])[0] || {};
    const side = h => ((comp.competitors || []).find(c => c.homeAway === h) || {}).team || {};
    const away = espnTeam(side('away').abbreviation), home = espnTeam(side('home').abbreviation);
    if (!away || !home) continue;
    out.push([away, home, ev.date || comp.date || null, 'espn:' + ev.id]);
  }
  return out.sort((a, b) => String(a[2]).localeCompare(String(b[2])));
}
// summary?event=<id> → {nomeNormalizado: {pts, reb, ast, fg3, stl, blk, min}}
export function parseEspnBox(json) {
  const out = {};
  for (const team of (((json || {}).boxscore || {}).players) || []) {
    const abbr = espnTeam((team.team || {}).abbreviation);
    for (const st of team.statistics || []) {
      const keys = st.keys || [], labels = (st.labels || []).map(l => String(l).toUpperCase());
      const idx = (k, l) => { let i = keys.findIndex(x => x === k || String(x).startsWith(k)); if (i < 0) i = labels.indexOf(l); return i; };
      const fg = idx('fieldGoalsMade', 'FG'), tp = idx('threePointFieldGoalsMade', '3PT'), ft = idx('freeThrowsMade', 'FT');
      // [coluna, parte]: "8-15" → parte 0 = marcados, parte 1 = tentados
      const I = { pts: [idx('points', 'PTS'), 0], reb: [idx('rebounds', 'REB'), 0], ast: [idx('assists', 'AST'), 0], fg3: [tp, 0], stl: [idx('steals', 'STL'), 0], blk: [idx('blocks', 'BLK'), 0], min: [idx('minutes', 'MIN'), 0],
        tov: [idx('turnovers', 'TO'), 0], oreb: [idx('offensiveRebounds', 'OREB'), 0], dreb: [idx('defensiveRebounds', 'DREB'), 0], fgm: [fg, 0], fga: [fg, 1], fg3a: [tp, 1], ftm: [ft, 0], fta: [ft, 1] };
      for (const a of st.athletes || []) {
        if (a.didNotPlay || !(a.stats || []).length) continue;
        const v = {};
        for (const [k, [i, part]] of Object.entries(I)) if (i >= 0) v[k] = parseFloat(String(a.stats[i] || '0').split('-')[part]) || 0;
        if (abbr) v.team = abbr;
        out[norm((a.athlete || {}).displayName)] = v;
      }
    }
  }
  return out;
}

// ---------- forma: últimos 10 jogos de cada jogador ----------
// Junta as estatísticas de um jogo (parseEspnBox) ao registo de cada jogador; guarda só os últimos 10 jogos
export function addBoxForm(state, box, date) {
  let n = 0;
  const teams = [...new Set(Object.values(box || {}).map(v => v.team).filter(Boolean))];
  const oppOf = t => (teams.length === 2 ? teams.find(x => x !== t) : null);
  addTeamGame(state, box, date, teams);
  for (const [nm, v] of Object.entries(box || {})) {
    if (!(v.min > 0)) continue;
    const key = nm.replace(/ /g, '-'), p = state.players[key];
    if (!p) continue;
    const g = { date };
    if (v.team) { g.team = v.team; g.opp = oppOf(v.team); }
    for (const k of AVG_KEYS) if (isNum(v[k])) g[k] = +v[k];
    p.log = (p.log || []).filter(x => x.date !== date).concat([g]).sort((x, y) => x.date.localeCompare(y.date)).slice(-10);
    n++;
  }
  return n;
}
// Médias dos últimos 5 e 10 jogos (o motor mistura-as com as da época) e os últimos 5 jogos, para mostrar
export const GAME_KEYS = ['min', 'pts', 'reb', 'ast', 'fg3', 'fgm', 'fga', 'fg3a', 'ftm', 'fta', 'tov', 'stl', 'blk', 'oreb'];
const meanOf = list => { const o = {}; for (const k of AVG_KEYS) { const xs = list.map(g => g[k]).filter(isNum); if (xs.length) o[k] = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 100) / 100; } return o; };
export function formOf(p) {
  const log = (p && p.log) || [];
  if (!log.length) return null;
  const l10 = log.slice(-10), l5 = log.slice(-5);
  // jogos: [data, adversário, ...GAME_KEYS] (compacto, do mais recente para o mais antigo; os últimos 10)
  const games = l10.slice().reverse().map(g => [g.date, g.opp || null].concat(GAME_KEYS.map(k => (isNum(g[k]) ? Math.round(g[k]) : null))));
  return { n10: l10.length, n5: l5.length, l10: meanOf(l10), l5: meanOf(l5), last: log[log.length - 1].date, games };
}
// Equipas: totais de cada jogo (soma dos jogadores) a favor e contra, últimos 15 jogos
function addTeamGame(state, box, date, teams) {
  if (teams.length !== 2) return;
  const tot = {};
  for (const v of Object.values(box || {})) {
    if (!v.team || !(v.min > 0)) continue;
    const t = (tot[v.team] = tot[v.team] || {});
    for (const k of AVG_KEYS) if (k !== 'min' && isNum(v[k])) t[k] = (t[k] || 0) + +v[k];
  }
  state.teams = state.teams || {};
  for (const t of teams) {
    const o = teams.find(x => x !== t);
    if (!tot[t] || !tot[o]) continue;
    const e = (state.teams[t] = state.teams[t] || { log: [] });
    e.log = e.log.filter(x => x.date !== date).concat([{ date, opp: o, for: tot[t], against: tot[o] }]).sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
  }
}
// O que cada equipa concede por jogo (últimos 10) e a média da liga, para comparar adversários
export function teamRows(state) {
  const rows = [], all = [];
  for (const [id, e] of Object.entries((state && state.teams) || {})) {
    const l10 = (e.log || []).slice(-10);
    if (!l10.length) continue;
    const allowed = meanOf(l10.map(g => g.against)), scored = meanOf(l10.map(g => g.for));
    rows.push({ id, stats: { n: l10.length, allowed, scored, last: l10[l10.length - 1].date } });
    all.push(allowed);
  }
  if (all.length) {
    const league = {};
    for (const k of AVG_KEYS) { const xs = all.map(a => a[k]).filter(isNum); if (xs.length) league[k] = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 100) / 100; }
    rows.push({ id: 'NBA', stats: { n: all.length, allowed: league } });
  }
  return rows;
}

// ---------- odds (The Odds API) ----------
function implied(o) { o = +o; if (!isFinite(o)) return null; if (o >= 100) return 100 / (o + 100); if (o <= -100) return -o / (-o + 100); if (o > 1 && o < 100) return 1 / o; return null; }
function toAmerican(p) { const d = 1 / p; return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)); }
// Um evento com várias casas → {nomeNormalizado: {stat: {line, over, under, books}}}
export function consensusFromEvent(ev) {
  const acc = {};
  for (const bk of (ev && ev.bookmakers) || []) {
    for (const mk of bk.markets || []) {
      const stat = MARKET_STAT[mk.key]; if (!stat) continue;
      const pairs = {};
      for (const o of mk.outcomes || []) {
        const who = norm(o.description); if (!who || o.point == null) continue;
        const side = /over/i.test(o.name) ? 'over' : /under/i.test(o.name) ? 'under' : null; if (!side) continue;
        const key = who + '|' + o.point;
        (pairs[key] = pairs[key] || { who, line: +o.point })[side] = +o.price;
      }
      for (const p of Object.values(pairs)) {
        if (p.over == null || p.under == null) continue;
        const a = implied(p.over), b = implied(p.under); if (a == null || b == null) continue;
        const slot = ((acc[p.who] = acc[p.who] || {})[stat] = (acc[p.who] || {})[stat] || []);
        slot.push({ line: p.line, pOver: a / (a + b), book: bk.key });
      }
    }
  }
  const out = {};
  for (const [who, stats] of Object.entries(acc)) {
    for (const [stat, quotes] of Object.entries(stats)) {
      const count = {};
      quotes.forEach(q => { count[q.line] = (count[q.line] || 0) + 1; });
      const line = +Object.entries(count).sort((x, y) => y[1] - x[1] || Math.abs(+x[0]) - Math.abs(+y[0]))[0][0];
      const at = quotes.filter(q => q.line === line);
      const p = at.reduce((s, q) => s + q.pOver, 0) / at.length;
      const pc = Math.min(0.97, Math.max(0.03, p));
      (out[who] = out[who] || {})[stat] = { line, over: toAmerican(pc), under: toAmerican(1 - pc), books: at.length };
    }
  }
  return out;
}
// Liga nomes das casas de apostas aos ids da NBA
export function matchPlayers(byName, catalog) {
  const index = new Map(), byLast = new Map();
  for (const p of catalog) {
    const n = norm(p.name); index.set(n, String(p.id));
    const w = n.split(' '), last = w.slice(-1)[0];
    (byLast.get(last) || byLast.set(last, []).get(last)).push({ first: w[0], id: String(p.id) });
  }
  const players = {}, unmatched = [];
  for (const [who, stats] of Object.entries(byName)) {
    let id = index.get(who);
    if (!id) { const parts = who.split(' '); const alt = parts.length > 2 ? parts[0] + ' ' + parts.slice(-1)[0] : null; id = alt && index.get(alt); }
    // diminutivos ("Herb Jones" = Herbert Jones): mesmo apelido e um nome começa pelo outro, se só houver um
    if (!id) { const parts = who.split(' '), first = parts[0], c = (byLast.get(parts.slice(-1)[0]) || []).filter(x => first.length >= 3 && (x.first.startsWith(first) || first.startsWith(x.first)));
      if (c.length === 1) id = c[0].id; }
    if (!id) { unmatched.push(who); continue; }
    players[id] = Object.assign(players[id] || {}, stats);
  }
  return { players, unmatched };
}

// ---------- Flow / JSON-Cadence ----------
export function decodeCadence(v) {
  if (v == null) return null;
  const { type, value } = v;
  switch (type) {
    case 'Optional': return value == null ? null : decodeCadence(value);
    case 'Void': return null;
    case 'Bool': return !!value;
    case 'String': case 'Character': case 'Address': case 'Path': return value && value.identifier ? value.identifier : value;
    case 'Int': case 'Int8': case 'Int16': case 'Int32': case 'Int64': case 'Int128': case 'Int256':
    case 'UInt': case 'UInt8': case 'UInt16': case 'UInt32': case 'UInt64': case 'UInt128': case 'UInt256':
    case 'Word8': case 'Word16': case 'Word32': case 'Word64': case 'Fix64': case 'UFix64': return Number(value);
    case 'Array': return (value || []).map(decodeCadence);
    case 'Dictionary': { const o = {}; for (const kv of value || []) o[String(decodeCadence(kv.key))] = decodeCadence(kv.value); return o; }
    case 'Struct': case 'Resource': case 'Event': case 'Contract': case 'Enum': {
      const o = {}; for (const f of (value && value.fields) || []) o[f.name] = decodeCadence(f.value);
      if (type === 'Enum') return o.rawValue != null ? o.rawValue : o;
      return o;
    }
    case 'Type': return value && value.staticType ? (value.staticType.typeID || value.staticType) : value;
    default: return value;
  }
}
export const cadence = {
  address: a => ({ type: 'Address', value: a }),
  strings: arr => ({ type: 'Array', value: arr.map(s => ({ type: 'String', value: String(s) })) }),
  uint64s: arr => ({ type: 'Array', value: arr.map(x => ({ type: 'UInt64', value: String(x) })) }),
};
// Lê uma lista aos lotes (fn recebe um lote). Se um lote passa o limite de cálculo da Flow, parte-o ao meio e
// tenta outra vez; outros erros saltam o lote. Devolve {out: tudo o que veio, done: os itens dos lotes lidos, failed}
export async function readBatched(items, size, fn) {
  const out = [], done = [], failed = [];
  let i = 0, n = Math.max(1, size);
  while (i < items.length) {
    const part = items.slice(i, i + n);
    try { out.push(...((await fn(part)) || [])); done.push(...part); i += part.length; }
    catch (e) {
      if (/computation|limit|exceed/i.test(String(e && e.message)) && n > 1) { n = Math.max(1, Math.floor(n / 2)); continue; }
      failed.push({ part, error: String(e && e.message).slice(0, 200) }); i += part.length;
    }
  }
  return { out, done, failed };
}
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const unb64 = s => Buffer.from(s, 'base64').toString('utf8');
export async function flowScript(code, args, fetchImpl = fetch) {
  const res = await fetchImpl(FLOW_REST + '/scripts?block_height=sealed', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ script: b64(code), arguments: (args || []).map(a => b64(JSON.stringify(a))) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Flow script ' + res.status + ': ' + text.slice(0, 400));
  return decodeCadence(JSON.parse(unb64(JSON.parse(text))));
}
export async function flowLatestHeight(fetchImpl = fetch) {
  const res = await fetchImpl(FLOW_REST + '/blocks?height=sealed');
  if (!res.ok) throw new Error('Flow blocks ' + res.status);
  const js = await res.json();
  return +js[0].header.height;
}
export async function flowEvents(type, start, end, fetchImpl = fetch) {
  const url = FLOW_REST + '/events?type=' + encodeURIComponent(type) + '&start_height=' + start + '&end_height=' + end;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error('Flow events ' + res.status + ': ' + (await res.text()).slice(0, 300));
  const blocks = await res.json();
  const out = [];
  for (const b of blocks || []) for (const ev of b.events || []) {
    out.push({ height: +b.block_height, time: b.block_timestamp, type: ev.type, data: decodeCadence(JSON.parse(unb64(ev.payload))) });
  }
  return out;
}
// Nome da estatística no contrato → chave do planeador ('pts', 'oreb', … combinações 'pts+reb' e diferenças 'ast-tov').
// Nomes que não se reconhecem por inteiro devolvem null (aparecem no log em vez de serem lidos mal).
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
export function mapStat(name) {
  const u = String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!u) return null;
  const pos = [], neg = [];
  const parts = u.split(/(?:^|_)MINUS(?:_|$)/);
  for (let i = 0; i < parts.length; i++) {
    let rest = '_' + parts[i] + '_';
    const found = [];
    for (const [k, re] of STAT_WORDS) { if (re.test(rest)) { found.push(k); rest = rest.replace(re, '_'); } }
    if (!found.length || rest.split('_').some(t => t && !STAT_GLUE.has(t))) return null;
    (i === 0 ? pos : neg).push(...found);
  }
  const sort = arr => [...new Set(arr)].sort((a, b) => STAT_ORDER.indexOf(a) - STAT_ORDER.indexOf(b));
  return sort(pos).join('+') + sort(neg).map(s => '-' + s).join('');
}
export function objectivesFromStats(stats) {
  const objs = [], unknown = [];
  for (const s of stats || []) {
    const stat = mapStat(s.name);
    if (!stat) { unknown.push(s.name); continue; }
    const o = { stat, target: +s.valueNeeded };
    if (+s.type === 0) o.each = true; // INDIVIDUAL: cada jogador tem de chegar ao valor
    objs.push(o);
  }
  return { objs, unknown };
}

// ---------- Supabase (tarefas automáticas) ----------
export async function supa() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Faltam os segredos SUPABASE_URL e SUPABASE_SERVICE_KEY no GitHub.');
  if (/\/rest\/v1\/?$/.test(url)) throw new Error('O segredo SUPABASE_URL deve ser só https://<projeto>.supabase.co, sem /rest/v1 no fim.');
  if (key.startsWith('sb_publishable_')) throw new Error('O segredo SUPABASE_SERVICE_KEY tem a chave publishable. Tem de ser a chave secreta (começa por sb_secret_).');
  if (key.startsWith('eyJ')) {
    try { const role = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString()).role; if (role !== 'service_role') throw new Error('O segredo SUPABASE_SERVICE_KEY é a chave "' + role + '". Tem de ser a service_role (ou a secret sb_secret_).'); }
    catch (e) { if (/SUPABASE_SERVICE_KEY/.test(e.message)) throw e; }
  }
  console.log('Supabase:', url.replace(/^https:\/\//, ''), '· chave', key.slice(0, 10) + '…');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function must(p) {
  const { data, error } = await p;
  if (error) {
    const hint = /permission denied/i.test(error.message) ? ' → a chave em SUPABASE_SERVICE_KEY não é a secreta, ou faltam as permissões do service_role (ver supabase/schema.sql).' : '';
    throw new Error(error.message + hint);
  }
  return data;
}
export async function getState(sb, key, def) { const row = await must(sb.from('job_state').select('value').eq('key', key).maybeSingle()); return row ? row.value : def; }
export async function setState(sb, key, value) { await must(sb.from('job_state').upsert({ key, value, updated_at: new Date().toISOString() })); }
export async function fetchJson(url, opts = {}, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, Object.assign({ headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*', 'accept-language': 'en-US,en;q=0.9' } }, opts));
      if (res.status === 404 || res.status === 403) return { status: res.status, json: null, res };
      if (!res.ok) throw new Error(res.status + ' ' + url);
      return { status: res.status, json: await res.json(), res };
    } catch (e) { last = e; await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  }
  throw last;
}
export async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
export async function upsertChunks(sb, table, rows, onConflict, size = 500) {
  for (let i = 0; i < rows.length; i += size) await must(sb.from(table).upsert(rows.slice(i, i + size), onConflict ? { onConflict } : undefined));
}

// ---------- lesões (relatório da ESPN) e avisos ----------
// Estados: out (fora), ofs (fora da época), doubtful (pouco provável), questionable (dúvida), dtd (dia a dia), probable (provável)
export const INJ_LABEL = { out: 'Fora', ofs: 'Fora da época', doubtful: 'Pouco provável', questionable: 'Dúvida', dtd: 'Dia a dia', probable: 'Provável' };
const SEASON_OUT = /(?:miss|out for|sidelined for)\s+(?:the\s+)?(?:(?:rest|remainder)\s+of\s+the\s+)?(?:entire\s+)?(?:\d{4}(?:-\d{2,4})?\s+)?(?:regular\s+)?season\b(?!\s*(?:opener|debut|start))|season-ending/i;
export function injuryStatus(e) {
  e = e || {};
  const st = String(e.status || ''), tn = String((e.type || {}).name || ''), fs = String(((((e.details || {}).fantasyStatus) || {}).description) || '');
  const text = [e.shortComment, e.longComment].filter(Boolean).join(' ');
  const all = st + ' ' + tn + ' ' + fs;
  if (/\bOFS\b/.test(fs) || (/out/i.test(all) && SEASON_OUT.test(text))) return 'ofs';
  if (/doubt/i.test(all)) return 'doubtful';
  if (/question/i.test(all)) return 'questionable';
  if (/probable/i.test(all)) return 'probable';
  if (/susp|\bout\b|_OUT\b/i.test(all)) return 'out';
  return 'dtd'; // Day-To-Day, GTD ou desconhecido
}
const TEAM_NAMES = { 'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN', 'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE', 'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET', 'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND', 'LA Clippers': 'LAC', 'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM', 'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN', 'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK', 'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL', 'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX', 'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS', 'Toronto Raptors': 'TOR', 'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS' };
const INJ_RANK = { ofs: 6, out: 5, doubtful: 4, questionable: 3, dtd: 2, probable: 1 };
// https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries → linhas da tabela injuries (uma por jogador)
export function parseEspnInjuries(json) {
  const by = new Map();
  for (const team of (json && json.injuries) || []) {
    for (const e of team.injuries || []) {
      const a = e.athlete || {}, name = a.displayName || [a.firstName, a.lastName].filter(Boolean).join(' ');
      const id = playerKey(name); if (!id) continue;
      const t = a.team || {};
      const tm = espnTeam(t.abbreviation) || TEAM_NAMES[t.displayName] || TEAM_NAMES[team.displayName] || null;
      const d = e.details || {};
      const what = [d.type, d.detail].filter(x => x && !/^(other|not specified)$/i.test(x));
      const detail = (what.length ? what.join(' · ') : '') + (d.side && !/not specified/i.test(d.side) && what.length ? ' (' + String(d.side).toLowerCase() + ')' : '');
      const rd = /^\d{4}-\d{2}-\d{2}/.test(String(d.returnDate || '')) ? String(d.returnDate).slice(0, 10) : null;
      const row = { id, name, team: tm, status: injuryStatus(e), label: e.status || null, detail: detail || null, comment: e.shortComment || null, return_date: rd, reported_at: e.date || null };
      const prev = by.get(id);
      if (!prev || INJ_RANK[row.status] > INJ_RANK[prev.status] || (INJ_RANK[row.status] === INJ_RANK[prev.status] && String(row.reported_at) > String(prev.reported_at))) by.set(id, row);
    }
  }
  return [...by.values()];
}
const ALERT_BAD = new Set(['out', 'ofs', 'doubtful', 'questionable', 'dtd']);
// Decide que avisos mandar. lineups: [{uid, acc, accLabel, date, source, players: [{id, name, team, tip}]}]
// injuries: Map(id → linha), state: {chave: {s, at, last}} do que já foi avisado.
// Avisa quando um jogador do lineup entra no relatório ou muda de estado, quando sai dele (liberado),
// e uma última vez perto do jogo (lastCallMin) se continuar em dúvida/fora. Só jogos que ainda não começaram.
// Avisos de lesões do lineup de hoje. Por jogador do lineup: quando entra no relatório ou muda de estado (new/change),
// quando sai dele (clear: deve jogar), um ponto da situação se continuar em dúvida (status: às 23h de Lisboa ou 2 h
// antes do jogo, o que vier primeiro) e, se lastCallMin > 0, uma última chamada antes do primeiro jogo do dia
// (L.firstTip; sem ele, antes do jogo do jogador).
// statusAt(tip, date) = quando mandar o ponto da situação (ms); por defeito 2 h antes do jogo.
export function buildAlerts({ now, lineups, injuries, state, lastCallMin = 0, horizonH = 20, statusAt }) {
  const next = {}, items = [];
  const sAtOf = statusAt || (tip => tip - 2 * 3600e3);
  for (const [k, v] of Object.entries(state || {})) if (v && now - v.at < 3 * 86400e3) next[k] = v;
  for (const L of lineups || []) for (const p of L.players || []) {
    if (!p.id || !p.tip || p.tip <= now || p.tip - now > horizonH * 3600e3) continue;
    const key = L.date + '|' + L.uid + '|' + L.acc + '|' + p.id;
    const inj = injuries.get(p.id) || null, s = inj ? inj.status : 'ok', prev = next[key] || null;
    // última chamada (se pedida): uma só, antes do primeiro jogo do dia (L.firstTip), para quem ainda está em dúvida
    const t0 = L.firstTip || p.tip, close = lastCallMin > 0 && now < t0 && t0 - now <= lastCallMin * 60e3, sDue = now >= sAtOf(p.tip, L.date);
    let kind = null;
    if (ALERT_BAD.has(s)) {
      if (!prev || prev.s !== s) kind = prev && ALERT_BAD.has(prev.s) ? 'change' : 'new';
      else if (close && !prev.last) kind = 'last';
      else if (sDue && !prev.st && !prev.last && s !== 'out' && s !== 'ofs') kind = 'status'; // fora é fora: só a dúvida tem ponto da situação
    } else if (prev && ALERT_BAD.has(prev.s)) kind = 'clear';
    if (!kind) continue;
    next[key] = { s, at: now, last: !!(close || (prev && prev.last)), st: !!(sDue || (prev && prev.st)) };
    items.push({ uid: L.uid, acc: L.acc, accLabel: L.accLabel, source: L.source, date: L.date, kind, id: p.id, name: p.name || (inj && inj.name) || p.id, team: p.team || (inj && inj.team) || '', tip: p.tip, status: s, prev: prev ? prev.s : null, inj });
  }
  return { items, state: next };
}
// Lembrete "já fizeste o lineup?" uma hora antes do primeiro jogo do dia (uma vez por pessoa e dia), a quem ainda
// não tem lineup submetido em todas as contas. reminders: [{ uid, date, firstTip, run, accs: [{ label, submitted, names }] }]
export function buildReminders({ now, reminders, state, leadMin = 60 }) {
  const items = [], next = Object.assign({}, state);
  for (const R of reminders || []) {
    if (!R.firstTip || now >= R.firstTip || R.firstTip - now > leadMin * 60e3) continue;
    const key = 'lu|' + R.date + '|' + R.uid;
    if (next[key]) continue;
    next[key] = { at: now, s: 'lu' };
    if ((R.accs || []).length && R.accs.every(a => a.submitted)) continue; // já submeteu tudo
    items.push(R);
  }
  return { items, state: next };
}
export function reminderText(R, opts = {}) {
  const tz = opts.tz || 'Europe/Lisbon';
  const hm = t => new Intl.DateTimeFormat('pt-PT', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(t));
  const lines = ['Os jogos de hoje começam às ' + hm(R.firstTip) + (R.run ? ' (' + R.run + ')' : '') + '. Já fizeste o lineup?'];
  const many = (R.accs || []).length > 1;
  (R.accs || []).forEach(a => {
    const who = many ? a.label + ': ' : '';
    if (a.submitted) lines.push(who + '✓ já submetido.');
    else if ((a.names || []).length) lines.push(who + 'sugestão do site: ' + a.names.join(', ') + '.');
  });
  return { title: 'Fast Break · Já fizeste o lineup?', body: lines.join('\n'), urgent: false };
}
// hora local (ex.: 23:00 em Lisboa) desse dia, em ms
export function localTime(date, hhmm, tz) {
  const [h, m] = String(hhmm).split(':').map(Number), guess = Date.parse(date + 'T' + String(h).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0') + ':00Z');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Lisbon', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess)).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  const shown = Date.parse(parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute + ':00Z');
  return guess - (shown - guess);
}
const SRC_TXT = { chain: 'lineup submetido no Top Shot', live: 'lineup marcado no site (jogo a jogo)', plan: 'lineup do plano do site' };
// Texto de um aviso (para o telemóvel e para o email). tz: fuso para as horas (por defeito Lisboa)
// uma linha de aviso (o mesmo texto no telemóvel, no email e no grupo do Telegram)
function alertLine(i, hm, plural) {
  const who = i.name + (i.team ? ' (' + i.team + ')' : '');
  const lab = INJ_LABEL[i.status] || i.status, det = i.inj && i.inj.detail ? ' · ' + i.inj.detail : '', com = i.inj && i.inj.comment ? ' ' + i.inj.comment : '';
  if (i.kind === 'clear') return '✅ ' + who + ' saiu do relatório de lesões: deve jogar. Jogo às ' + hm(i.tip) + '.';
  if (i.kind === 'status') return '📋 Ponto da situação: ' + who + ' continua ' + lab.toLowerCase() + det + '. Jogo às ' + hm(i.tip) + '.' + com;
  if (i.kind === 'last') return '⏰ Última chamada: ' + who + ' continua ' + lab.toLowerCase() + det + '. Jogo às ' + hm(i.tip) + ': troca antes de fechar se não ' + (plural ? 'quiserem' : 'quiseres') + ' arriscar.';
  return (i.status === 'out' || i.status === 'ofs' ? '🚫 ' : '⚠️ ') + who + ': ' + lab + det + (i.kind === 'change' && i.prev ? ' (antes: ' + (INJ_LABEL[i.prev] || i.prev).toLowerCase() + ')' : '') + '. Jogo às ' + hm(i.tip) + '.' + com;
}
// Grupo do Telegram (HTML, em inglês): um bloco por jogador, separados por uma linha em branco
// owners: id → nomes de quem o tem no lineup; spec: id → "3PM specialist (#1)"
const tgEsc = x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const INJ_LABEL_EN = { out: 'Out', ofs: 'Out for the season', doubtful: 'Doubtful', questionable: 'Questionable', dtd: 'Day-to-day', probable: 'Probable' };
const andJoinEn = a => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '');
const hmEn = tz => t => new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
function groupBlock(i, hm, owners, spec) {
  const who = '<b>' + tgEsc(i.name) + '</b>' + (i.team ? ' (' + tgEsc(i.team) + ')' : '');
  const L = st => INJ_LABEL_EN[st] || st || '';
  const det = i.inj && i.inj.detail ? tgEsc(i.inj.detail) + ' · ' : '';
  const out = [];
  if (i.kind === 'clear') { out.push('✅ ' + who + ' · <b>expected to play</b>', 'Off the injury report · tip-off <b>' + hm(i.tip) + '</b>'); }
  else {
    const icon = i.kind === 'last' ? '⏰' : i.kind === 'status' ? '📋' : i.status === 'out' || i.status === 'ofs' ? '🚫' : '⚠️';
    const pre = i.kind === 'last' ? 'Last call · ' : '';
    const st = i.kind === 'status' || i.kind === 'last' ? 'still <b>' + tgEsc(L(i.status).toLowerCase()) + '</b>' : '<b>' + tgEsc(L(i.status)) + '</b>' + (i.kind === 'change' && i.prev ? ' (was: ' + tgEsc(L(i.prev).toLowerCase()) + ')' : '');
    out.push(icon + ' ' + pre + who + ' · ' + st, det + 'tip-off <b>' + hm(i.tip) + '</b>');
    if (i.inj && i.inj.comment) out.push('<i>' + tgEsc(i.inj.comment) + '</i>');
    if (i.kind === 'last') out.push('<b>Swap before lock</b> if you don’t want the risk.');
  }
  if ((owners[i.id] || []).length) out.push('👥 In the lineup of <b>' + tgEsc(andJoinEn(owners[i.id])) + '</b>');
  if (spec[i.id]) out.push('⭐ ' + tgEsc(spec[i.id]));
  return out.join('\n');
}
export function groupAlertText(items, owners, opts = {}) {
  const hm = hmEn(opts.tz), spec = opts.spec || {}, list = items.slice().sort((a, b) => a.tip - b.tip);
  const title = list.every(i => i.kind === 'status') ? 'Status update' : list.every(i => i.kind === 'last') ? 'Last call' : 'Injuries';
  return '🏀 <b>Fast Break · ' + title + '</b>\n\n' + list.map(i => groupBlock(i, hm, owners || {}, spec)).join('\n\n');
}
// "Lineups done?" no grupo: só o aviso, sem nomes (o site não sabe ao certo quem já submeteu)
export function groupReminderText(R, opts = {}) {
  const hm = hmEn(opts.tz);
  return '🏀 Lineups done?\nToday’s games start at ' + hm(R.firstTip) + '.'; // exatamente assim (pedido do utilizador)
}
const andJoin = a => (a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0] || '');
export function alertText(items, opts = {}) {
  const tz = opts.tz || 'Europe/Lisbon';
  const hm = t => new Intl.DateTimeFormat('pt-PT', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(t));
  const lines = [], accs = [...new Set(items.map(i => i.acc))];
  const groups = accs.map(a => items.filter(i => i.acc === a));
  groups.forEach(g => {
    if (accs.length > 1 || g[0].acc !== 'main') lines.push((g[0].accLabel || g[0].acc) + ':');
    g.forEach(i => lines.push(alertLine(i, hm)));
    lines.push('(' + (SRC_TXT[g[0].source] || 'lineup') + ')');
  });
  const bad = items.filter(i => i.kind !== 'clear');
  const title = bad.length === 1 ? (bad[0].kind === 'last' ? 'Última chamada: ' : bad[0].kind === 'status' ? 'Ponto da situação: ' : 'Lesão no teu lineup: ') + bad[0].name + ' ' + (INJ_LABEL[bad[0].status] || '').toLowerCase()
    : bad.length ? bad.length + ' avisos de lesão no teu lineup' : items.length === 1 ? items[0].name + ' deve jogar' : 'Lineup sem lesões';
  return { title: 'Fast Break · ' + title, body: lines.join('\n'), urgent: items.some(i => (i.status === 'out' || i.status === 'ofs') && i.kind !== 'clear') || items.some(i => i.kind === 'last') };
}

// ---------- jogos da época passada (gamelog da ESPN): regularidade e jogos seguidos ----------
// https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{id}/gamelog?season=AAAA
// names: ['minutes', 'fieldGoalsMade-fieldGoalsAttempted', ..., 'points']; seasonTypes[].categories[].events[] = {eventId, stats}
const GL_NAME = { minutes: ['min'], 'fieldGoalsMade-fieldGoalsAttempted': ['fgm', 'fga'], 'threePointFieldGoalsMade-threePointFieldGoalsAttempted': ['fg3', 'fg3a'], 'freeThrowsMade-freeThrowsAttempted': ['ftm', 'fta'], totalRebounds: ['reb'], assists: ['ast'], blocks: ['blk'], steals: ['stl'], turnovers: ['tov'], points: ['pts'] };
export const HIST_KEYS = ['min', 'pts', 'reb', 'ast', 'fg3', 'fg3a', 'fgm', 'fga', 'ftm', 'fta', 'stl', 'blk', 'tov'];
export function parseEspnGamelog(json) {
  const names = (json && json.names) || [], evs = (json && json.events) || {}, out = new Map();
  for (const st of (json && json.seasonTypes) || []) {
    const label = String(st.displayName || st.name || '');
    if (/pre|post|play-?in|all-?star|cup final/i.test(label) && !/regular/i.test(label)) continue; // só a época regular
    for (const cat of st.categories || []) for (const e of cat.events || []) {
      if (!e || !e.eventId || !Array.isArray(e.stats) || out.has(e.eventId)) continue;
      const meta = evs[e.eventId] || {};
      if (!meta.gameDate) continue;
      const g = { date: etDate(meta.gameDate) };
      names.forEach((nm, i) => { const keys = GL_NAME[nm]; if (!keys) return; const parts = String(e.stats[i] == null ? '' : e.stats[i]).split('-'); keys.forEach((k, j) => { const x = parseFloat(parts[j]); if (isFinite(x)) g[k] = x; }); });
      if (g.min > 0) out.set(e.eventId, g);
    }
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}
// Regularidade (variância ÷ média por jogo) e quanto rende no 2.º de dois jogos seguidos face aos outros jogos
export function histFromGames(games) {
  const gs = (games || []).filter(g => g && g.min > 0);
  const n = gs.length;
  if (n < 5) return { n };
  const dayN = d => Date.parse(d + 'T12:00:00Z') / 86400e3;
  const b2b = gs.map((g, i) => i > 0 && Math.round(dayN(g.date) - dayN(gs[i - 1].date)) === 1);
  const r2 = x => Math.round(x * 100) / 100;
  const d = {}, r = {};
  for (const k of HIST_KEYS) {
    const xs = gs.map(g => g[k]).filter(x => isNum(x));
    if (xs.length < 5) continue;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    if (!(m > 0.05)) continue;
    const v = xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1);
    d[k] = r2(v / m);
    const on = gs.filter((g, i) => b2b[i] && isNum(g[k])).map(g => g[k]), off = gs.filter((g, i) => !b2b[i] && isNum(g[k])).map(g => g[k]);
    if (on.length && off.length) { const mOff = off.reduce((a, b) => a + b, 0) / off.length; if (mOff > 0.05) r[k] = r2((on.reduce((a, b) => a + b, 0) / on.length) / mOff); }
  }
  const nb = b2b.filter(Boolean).length;
  return Object.assign({ n, d }, nb ? { b2b: { n: nb, r } } : {});
}

// ---------- mercado: escalão de um Moment ----------
// o que vem nos metadados da jogada (ou no nome da subedição); senão, sets conhecidos; senão, pela tiragem
export const MOMENT_TIERS = ['Ultimate', 'Legendary', 'Rare', 'Fandom', 'Common'];
export const TIER_SETS = { 'base set': 'Common', 'metallic gold le': 'Rare' };
export function momentTierOf(meta, sub, setName, minted) {
  const m = (String(meta || '') + ' ' + String(sub || '')).toLowerCase();
  const t = MOMENT_TIERS.find(x => m.includes(x.toLowerCase())); if (t) return t;
  const k = TIER_SETS[String(setName || '').toLowerCase().trim()]; if (k) return k;
  const nm = /\b(ultimate|legendary|rare|fandom|common)\b/i.exec(String(setName || '')); // "2025 NBA Playoffs: Common"
  if (nm) return nm[1][0].toUpperCase() + nm[1].slice(1).toLowerCase();
  const cap = /\/\s*(\d+)/.exec(String(sub || '')), n = cap ? +cap[1] : +minted || 0;
  if (!n) return 'Common';
  return n <= 5 ? 'Ultimate' : n <= 149 ? 'Legendary' : n <= 1000 ? 'Rare' : 'Common'; // Rare até /1000
}
