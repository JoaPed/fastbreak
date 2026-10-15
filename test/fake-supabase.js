// Supabase falso, em memória, só para testar o site no navegador (test/ui_test.py).
const KEYS = { members: ['user_id'], profiles: ['user_id'], runs: ['id'], run_days: ['run_id', 'date'], nba_players: ['id'], nba_teams: ['id'], odds_days: ['date'], chain_runs: ['id'], chain_games: ['id'], chain_results: ['user_id', 'game_id'], user_runs: ['user_id', 'run_id'], summaries: ['user_id', 'run_id'], settings: ['key'] };
const db = window.__FAKE_DB = window.__FAKE_DB || { tables: {}, users: [], session: null, calls: [] };
Object.keys(KEYS).forEach(t => { db.tables[t] = db.tables[t] || []; });
const clone = o => JSON.parse(JSON.stringify(o));
const keyOf = (t, r) => KEYS[t].map(k => String(r[k])).join('|');
const uid = () => db.session && db.session.user.id;

class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.ord = null; this.lim = null; this.single = false; }
  select() { if (this.op === 'select') this.op = 'select'; return this; }
  eq(c, v) { this.f.push(r => String(r[c]) === String(v)); return this; }
  neq(c, v) { this.f.push(r => String(r[c]) !== String(v)); return this; }
  in(c, a) { this.f.push(r => a.map(String).includes(String(r[c]))); return this; }
  gte(c, v) { this.f.push(r => r[c] >= v); return this; }
  lte(c, v) { this.f.push(r => r[c] <= v); return this; }
  not(c, op, v) { this.f.push(r => r[c] != null); return this; }
  order(c, o) { this.ord = [c, !(o && o.ascending === false)]; return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  maybeSingle() { this.single = true; return this; }
  insert(rows) { this.op = 'insert'; this.rows = [].concat(rows); return this; }
  upsert(rows) { this.op = 'upsert'; this.rows = [].concat(rows); return this; }
  update(p) { this.op = 'update'; this.patch = p; return this; }
  delete() { this.op = 'delete'; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  run() {
    const T = db.tables[this.t];
    db.calls.push([this.op, this.t]);
    const withUser = r => Object.assign({}, r, (this.t === 'user_runs' || this.t === 'summaries' || this.t === 'profiles') && r.user_id == null ? { user_id: uid() } : {}, ['user_runs', 'summaries', 'profiles'].includes(this.t) ? { updated_at: new Date().toISOString() } : {});
    if (this.op === 'insert') {
      for (const r0 of this.rows) { const r = withUser(r0); if (T.some(x => keyOf(this.t, x) === keyOf(this.t, r))) return { data: null, error: { message: 'duplicate key' } }; T.push(clone(r)); }
      return { data: null, error: null };
    }
    if (this.op === 'upsert') {
      for (const r0 of this.rows) { const r = withUser(r0); const i = T.findIndex(x => keyOf(this.t, x) === keyOf(this.t, r)); if (i >= 0) T[i] = Object.assign(T[i], clone(r)); else T.push(clone(r)); }
      return { data: null, error: null };
    }
    let rows = T.filter(r => this.f.every(fn => fn(r)));
    if (this.op === 'update') { rows.forEach(r => Object.assign(r, clone(this.patch))); return { data: null, error: null }; }
    if (this.op === 'delete') { db.tables[this.t] = T.filter(r => !rows.includes(r)); return { data: null, error: null }; }
    if (this.ord) { const [c, asc] = this.ord; rows = rows.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim) rows = rows.slice(0, this.lim);
    if (this.single) return { data: rows[0] ? clone(rows[0]) : null, error: null };
    return { data: clone(rows), error: null };
  }
}
export function createClient() {
  return {
    from: t => new Q(t),
    rpc: async (name, args) => {
      const me = uid(); const M = db.tables.members;
      if (name === 'group_status') { const m = M.find(x => x.user_id === me); return { data: { has_members: M.length > 0, role: m ? m.role : null }, error: null }; }
      if (name === 'join_group') {
        const m = M.find(x => x.user_id === me); if (m) return { data: m.role, error: null };
        if (!M.length) { M.push({ user_id: me, role: 'admin' }); return { data: 'admin', error: null }; }
        const inv = (db.tables.settings.find(s => s.key === 'invite') || { value: {} }).value.code;
        if (!inv || String(args.code || '').trim().toLowerCase() !== inv.toLowerCase()) return { data: null, error: { message: 'Código de convite errado' } };
        M.push({ user_id: me, role: 'member' }); return { data: 'member', error: null };
      }
      if (name === 'get_invite_code') return { data: (db.tables.settings.find(s => s.key === 'invite') || { value: {} }).value.code || null, error: null };
      if (name === 'set_invite_code') { db.tables.settings = db.tables.settings.filter(s => s.key !== 'invite'); db.tables.settings.push({ key: 'invite', value: { code: args.code } }); return { data: null, error: null }; }
      return { data: null, error: { message: 'rpc desconhecida ' + name } };
    },
    auth: {
      getSession: async () => ({ data: { session: db.session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signUp: async ({ email, password, options }) => {
        if (db.users.some(u => u.email === email)) return { data: {}, error: { message: 'User already registered' } };
        if (password.length < 6) return { data: {}, error: { message: 'Password should be at least 6 characters' } };
        const user = { id: 'u-' + (db.users.length + 1), email, user_metadata: (options || {}).data || {} };
        db.users.push(Object.assign({ password }, user)); db.session = { user }; return { data: { session: db.session, user }, error: null };
      },
      signInWithPassword: async ({ email, password }) => {
        const u = db.users.find(x => x.email === email && x.password === password);
        if (!u) return { data: {}, error: { message: 'Invalid login credentials' } };
        db.session = { user: { id: u.id, email: u.email, user_metadata: u.user_metadata || {} } }; return { data: { session: db.session }, error: null };
      },
      signOut: async () => { db.session = null; return { error: null }; },
    },
  };
}
