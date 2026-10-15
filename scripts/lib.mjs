// Funções partilhadas pelas tarefas automáticas. As puras (sem rede) têm testes em test/jobs.test.mjs.

export const STAT_MARKET = { pts: 'player_points', reb: 'player_rebounds', ast: 'player_assists', fg3: 'player_threes', stl: 'player_steals', blk: 'player_blocks' };
export const MARKET_STAT = Object.fromEntries(Object.entries(STAT_MARKET).map(([k, v]) => [v, k]));
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
// Junta um box score ao acumulado: bucket = 'cur' (época atual), 'prev' (época passada) ou 'team' (só para saber a equipa)
export function addBoxscore(state, json, bucket, date) {
  const g = (json || {}).game; if (!g) return 0;
  let n = 0;
  for (const side of [g.homeTeam, g.awayTeam]) {
    if (!side) continue;
    for (const pl of side.players || []) {
      const id = String(pl.personId || ''); if (!id) continue;
      const st = pl.statistics || {};
      const min = minutes(st.minutes || st.minutesCalculated);
      const p = (state.players[id] = state.players[id] || { name: '', team: null, teamDate: '', cur: null, prev: null });
      p.name = pl.name || [pl.firstName, pl.familyName].filter(Boolean).join(' ') || p.name;
      // equipa: a do jogo mais recente desta época; a da época passada só serve se ainda não houver nenhuma
      if (bucket === 'prev') { if (!p.team) p.team = side.teamTricode || null; }
      else if (!p.teamDate || (date && date >= p.teamDate)) { p.team = side.teamTricode || p.team; p.teamDate = date || p.teamDate; }
      if (bucket === 'team' || min <= 0 || pl.played === '0') continue;
      const t = (p[bucket] = p[bucket] || { gp: 0, min: 0, pts: 0, reb: 0, ast: 0, fg3: 0, stl: 0, blk: 0 });
      t.gp++; t.min += min;
      for (const [k, key] of Object.entries(BOX_KEYS)) t[k] += +st[key] || 0;
      n++;
    }
  }
  return n;
}
// Média da época atual puxada para a da época passada enquanto há poucos jogos
export function blendedAverages(p, prior = 10) {
  const cur = p.cur, prev = p.prev && p.prev.gp >= 5 ? p.prev : null;
  if (!cur && !prev) return null;
  const gp = cur ? cur.gp : 0, k = prev ? Math.max(0, prior - gp) : 0;
  const avg = {};
  for (const s of ['pts', 'reb', 'ast', 'fg3', 'stl', 'blk', 'min']) {
    const c = cur ? cur[s] : 0, pa = prev ? prev[s] / prev.gp : 0;
    avg[s] = gp + k > 0 ? Math.round(((c + k * pa) / (gp + k)) * 10) / 10 : 0;
  }
  return { avg, gp };
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
// Nome da estatística no contrato → chave do planeador ('pts', 'reb', … ou combinação 'pts+reb')
export function mapStat(name) {
  const u = String(name || '').toUpperCase();
  const found = [];
  const has = re => re.test(u);
  if (has(/THREE|3P|FG3|TRIPLE/)) found.push('fg3');
  if (has(/POINT|PTS/) && !has(/THREE[ _-]?POINT/)) found.push('pts');
  if (has(/REB/)) found.push('reb');
  if (has(/AST|ASSIST/)) found.push('ast');
  if (has(/STEAL|STL/)) found.push('stl');
  if (has(/BLOCK|BLK/)) found.push('blk');
  const order = ['pts', 'reb', 'ast', 'fg3', 'stl', 'blk'];
  return found.length ? order.filter(s => found.includes(s)).join('+') : null;
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
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function must(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data; }
export async function getState(sb, key, def) { const row = await must(sb.from('job_state').select('value').eq('key', key).maybeSingle()); return row ? row.value : def; }
export async function setState(sb, key, value) { await must(sb.from('job_state').upsert({ key, value, updated_at: new Date().toISOString() })); }
export async function fetchJson(url, opts = {}, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, Object.assign({ headers: { 'user-agent': 'Mozilla/5.0 fastbreak-planner', accept: 'application/json' } }, opts));
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
