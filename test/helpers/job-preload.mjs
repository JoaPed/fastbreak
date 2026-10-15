// Pré-carregado nos testes das tarefas: Supabase falso (ficheiro JSON), fetch falso e relógio fixo.
// node --import ./test/helpers/job-preload.mjs scripts/<tarefa>.mjs   (FB_TEST_DB = ficheiro, FB_TEST_NOW = ms)
import fs from 'node:fs';
const file = process.env.FB_TEST_DB;
const db = JSON.parse(fs.readFileSync(file, 'utf8'));
db.sent = db.sent || []; db.calls = [];
if (process.env.FB_TEST_NOW) { const T = +process.env.FB_TEST_NOW; Date.now = () => T; }
const KEYS = { injuries: ['id'], alerts: ['user_id'], members: ['user_id'], job_state: ['key'], runs: ['id'], run_days: ['run_id', 'date'], nba_players: ['id'], profiles: ['user_id'], user_runs: ['user_id', 'run_id'], chain_results: ['user_id', 'game_id', 'account'] };
const clone = o => JSON.parse(JSON.stringify(o));
class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.one = false; }
  select() { return this; }
  eq(c, v) { this.f.push(r => String(r[c]) === String(v)); return this; }
  in(c, a) { this.f.push(r => a.map(String).includes(String(r[c]))); return this; }
  lt(c, v) { this.f.push(r => r[c] < v); return this; }
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
  if (/^https:\/\/ntfy\.sh\//.test(url)) { db.sent.push(Object.assign({ via: 'ntfy' }, JSON.parse(opts.body))); return new Response('{}', { status: 200 }); }
  return new Response('nada', { status: 404 });
};
process.on('exit', () => fs.writeFileSync(file, JSON.stringify(db)));
