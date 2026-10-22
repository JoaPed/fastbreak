// Pré-carregado nos testes das tarefas: Supabase falso (ficheiro JSON), fetch falso e relógio fixo.
// node --import ./test/helpers/job-preload.mjs scripts/<tarefa>.mjs   (FB_TEST_DB = ficheiro, FB_TEST_NOW = ms)
import fs from 'node:fs';
const file = process.env.FB_TEST_DB;
const db = JSON.parse(fs.readFileSync(file, 'utf8'));
db.sent = db.sent || []; db.calls = [];
if (process.env.FB_TEST_NOW) { const T = +process.env.FB_TEST_NOW; Date.now = () => T; }
const KEYS = { market_asks: ['listing_id'], market_sales: ['listing_id'], injuries: ['id'], alerts: ['user_id'], members: ['user_id'], job_state: ['key'], runs: ['id'], run_days: ['run_id', 'date'], nba_players: ['id'], profiles: ['user_id'], user_runs: ['user_id', 'run_id'], chain_results: ['user_id', 'game_id', 'account'] };
const clone = o => JSON.parse(JSON.stringify(o));
class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.one = false; }
  select() { return this; }
  eq(c, v) { this.f.push(r => String(r[c]) === String(v)); return this; }
  neq(c, v) { this.f.push(r => String(r[c]) !== String(v)); return this; }
  in(c, a) { this.f.push(r => a.map(String).includes(String(r[c]))); return this; }
  lt(c, v) { this.f.push(r => r[c] < v); return this; }
  gte(c, v) { this.f.push(r => r[c] >= v); return this; }
  lte(c, v) { this.f.push(r => r[c] <= v); return this; }
  not(c, op, v) { this.f.push(r => (op === 'is' && v === null ? r[c] != null : String(r[c]) !== String(v))); return this; }
  insert(rows) { this.op = 'upsert'; this.rows = [].concat(rows); return this; }
  order() { return this; } range() { return this; } limit() { return this; }
  maybeSingle() { this.one = true; return this; }
  upsert(rows) { this.op = 'upsert'; this.rows = [].concat(rows); return this; }
  delete() { this.op = 'delete'; return this; }
  update(p) { this.op = 'update'; this.patch = p; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  run() {
    db.calls.push(this.op + ' ' + this.t);
    if (!(this.t in db.tables)) return { data: null, error: { message: 'relation "public.' + this.t + '" does not exist' } };
    const T = db.tables[this.t], key = r => (KEYS[this.t] || ['id']).map(k => String(r[k])).join('|');
    if (this.op === 'upsert') { this.rows.forEach(r => { const i = T.findIndex(x => key(x) === key(r)); if (i >= 0) T[i] = Object.assign(T[i], clone(r)); else T.push(clone(r)); }); return { data: null, error: null }; }
    const rows = T.filter(r => this.f.every(fn => fn(r)));
    if (this.op === 'delete') { db.tables[this.t] = T.filter(r => !rows.includes(r)); return { data: null, error: null }; }
    if (this.op === 'update') { rows.forEach(r => Object.assign(r, clone(this.patch))); return { data: null, error: null }; }
    return { data: this.one ? (rows[0] ? clone(rows[0]) : null) : clone(rows), error: null };
  }
}
globalThis.__FB_TEST_SB = { from: t => new Q(t), auth: { admin: { getUserById: async id => ({ data: { user: { email: id + '@exemplo.pt' } }, error: null }) } } };
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (/site\.api\.espn\.com.*\/injuries/.test(url)) return new Response(JSON.stringify(db.espn || { injuries: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  if (/^https:\/\/api\.telegram\.org\/bot[^/]+\/getUpdates/.test(url)) return new Response(JSON.stringify({ ok: true, result: (db.telegram || {}).updates || [] }), { status: 200 });
  if (/^https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/.test(url)) { const b = JSON.parse(opts.body); db.sent.push({ via: 'tg', chat: String(b.chat_id), message: b.text }); return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 }); }
  if (/^https:\/\/ntfy\.sh\//.test(url)) { db.sent.push(Object.assign({ via: 'ntfy' }, JSON.parse(opts.body))); return new Response('{}', { status: 200 }); }
  if (/onflow\.org/.test(url) && db.flow) return flowFake(url, opts);
  if (/site\.api\.espn\.com.*scoreboard/.test(url)) { const dt = (url.match(/dates=(\d{8})/) || [])[1]; return new Response(JSON.stringify({ events: (db.scoreboard || {})[dt] || [] }), { status: 200 }); }
  return new Response('nada', { status: 404 });
};
// Flow falsa (db.flow): altura, eventos (nenhum) e scripts do Fast Break, reconhecidos pelo código Cadence
const enc = v => (v == null ? { type: 'Optional', value: null } : typeof v === 'boolean' ? { type: 'Bool', value: v } : typeof v === 'number' ? { type: 'UInt64', value: String(v) } : typeof v === 'string' ? { type: 'String', value: v } : Array.isArray(v) ? { type: 'Array', value: v.map(enc) } : { type: 'Dictionary', value: Object.entries(v).map(([k, x]) => ({ key: { type: 'String', value: k }, value: enc(x) })) });
const dec = a => { const v = JSON.parse(Buffer.from(a, 'base64').toString('utf8')); return Array.isArray(v.value) ? v.value.map(x => x.value) : v.value; };
// dicionário Cadence {UInt32: {UInt32: UInt32}} (tiragens)
const okDict = o => new Response(JSON.stringify(Buffer.from(JSON.stringify({ type: 'Dictionary', value: Object.entries(o).map(([k, v]) => ({ key: { type: 'UInt32', value: String(k) }, value: { type: 'Dictionary', value: Object.entries(v).map(([k2, v2]) => ({ key: { type: 'UInt32', value: String(k2) }, value: { type: 'UInt32', value: String(v2) } })) } })) })).toString('base64')), { status: 200 });
function flowFake(url, opts) {
  const F = db.flow, ok = v => new Response(JSON.stringify(Buffer.from(JSON.stringify(enc(v))).toString('base64')), { status: 200 });
  if (/\/blocks\?height=sealed/.test(url)) return new Response(JSON.stringify([{ header: { height: String(F.height || 1000) } }]), { status: 200 });
  if (/\/events\?/.test(url)) {
    // eventos falsos (db.flow.events: [{height, type, data}]) dentro do intervalo de blocos pedido
    const u = new URL(url), type = u.searchParams.get('type'), a = +u.searchParams.get('start_height'), b = +u.searchParams.get('end_height');
    const evs = (F.events || []).filter(e => type.endsWith('.' + e.type) && e.height >= a && e.height <= b);
    const blocks = evs.map(e => ({ block_height: String(e.height), block_timestamp: '2026-10-20T10:00:00Z', events: [{ type, payload: Buffer.from(JSON.stringify({ type: 'Event', value: { id: type, fields: Object.entries(e.data).map(([name, v]) => ({ name, value: enc(v) })) } })).toString('base64') }] }));
    return new Response(JSON.stringify(blocks), { status: 200 });
  }
  const body = JSON.parse(opts.body), code = Buffer.from(body.script, 'base64').toString('utf8'), args = body.arguments.map(dec);
  F.scripts = F.scripts || []; 
  if (/fun main\(addr: Address\): \[UInt64\]/.test(code)) { F.scripts.push('ids'); return ok((F.ids || {})[args[0]] || []); }
  if (/ids: \[UInt64\]\): \[\{String: AnyStruct\}\]/.test(code)) {
    F.scripts.push('history ' + args[1].length);
    if (args[1].length > (F.maxBatch || 1e9)) return new Response('{"code":400,"message":"[Error Code: 1110] computation exceeds limit (100000)"}', { status: 400 });
    return ok(args[1].map(id => Object.assign({ nft: +id }, (F.nfts || {})[id] || {})));
  }
  if (/runIds: \[String\], since: UInt64/.test(code)) { F.scripts.push('player'); return ok([]); }
  if (/getSubeditionByNFTID/.test(code)) { F.scripts.push('meta ' + args[0]); const m = (F.moments || {})[args[0]] || {}; return ok(args[1].map(id => m[id]).filter(Boolean)); }
  if (/getNumberMintedPerPlay/.test(code)) { F.scripts.push('minted'); const o = {}; args[0].forEach(s => { if ((F.minted || {})[s]) o[s] = F.minted[s]; }); return okDict(o); }
  if (/getFastBreakGameStats/.test(code)) { F.scripts.push('games ' + args[0].length); return ok(args[0].map(id => (F.games || {})[id]).filter(Boolean)); }
  if (/getFastBreakRun\(/.test(code)) { F.scripts.push('runs ' + args[0].length); return ok(args[0].map(id => (F.runs || {})[id]).filter(Boolean)); }
  return new Response('script desconhecido', { status: 400 });
}
process.on('exit', () => fs.writeFileSync(file, JSON.stringify(db)));
