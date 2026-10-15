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
    p.rosterTeam = team; p.rosterDate = date; n++;
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
        out[norm((a.athlete || {}).displayName)] = v;
      }
    }
  }
  return out;
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
    const last = n.split(' ').slice(-1)[0]; byLast.set(last, byLast.has(last) ? null : String(p.id));
  }
  const players = {}, unmatched = [];
  for (const [who, stats] of Object.entries(byName)) {
    let id = index.get(who);
    if (!id) { const parts = who.split(' '); const alt = parts.length > 2 ? parts[0] + ' ' + parts.slice(-1)[0] : null; id = alt && index.get(alt); }
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
};
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
