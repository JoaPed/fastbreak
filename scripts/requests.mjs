// Pedidos do site (Ajustes → Admin): vê em job_state 'requests' se o admin pediu uma tarefa e corre-a.
// Corre de 5 em 5 min (pedidos.yml); sem pedidos sai logo, sem instalar nada. Só fetch (Node 20).
import { spawnSync } from 'node:child_process';

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), KEY = process.env.SUPABASE_SERVICE_KEY || '';
if (!URL_ || !KEY) { console.log('Sem SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(0); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
// tarefas que o site pode pedir: o que corre (a mesma coisa que a tarefa agendada)
const JOBS = { odds: ['node', ['scripts/sync-odds.mjs']] };
const TEST = process.env.REQ_TEST === '1'; // ensaio: não instala nem corre a tarefa a sério
if (TEST) JOBS.odds = ['node', ['-e', 'console.log("(ensaio) odds")']];

async function read() {
  const r = await fetch(URL_ + '/rest/v1/job_state?key=eq.requests&select=value', { headers: H });
  if (!r.ok) throw new Error('job_state ' + r.status + ' ' + await r.text());
  const rows = await r.json(); return (rows[0] && rows[0].value) || {};
}
async function write(value) {
  const r = await fetch(URL_ + '/rest/v1/job_state?on_conflict=key', { method: 'POST', headers: Object.assign({ Prefer: 'resolution=merge-duplicates' }, H), body: JSON.stringify([{ key: 'requests', value, updated_at: new Date().toISOString() }]) });
  if (!r.ok) throw new Error('job_state ' + r.status + ' ' + await r.text());
}

const req = await read();
const todo = Object.entries(req).filter(([k, v]) => JOBS[k] && v && v.at && !v.done);
if (!todo.length) { console.log('Sem pedidos.'); process.exit(0); }
let deps = false;
for (const [kind, v] of todo) {
  console.log(`::notice::Pedido "${kind}" de ${v.at}`);
  if (!deps && !TEST) { const i = spawnSync('npm', ['ci', '--omit=dev'], { stdio: 'inherit' }); if (i.status !== 0) process.exit(1); deps = true; }
  const [cmd, args] = JOBS[kind];
  const run = spawnSync(cmd, args, { stdio: 'inherit', env: process.env });
  const now = await read(), cur = now[kind] || {};
  // só fecha o pedido que correu (se entretanto chegou outro, fica para a próxima volta)
  if (cur.at === v.at) { now[kind] = Object.assign({}, cur, { done: true, ran: new Date().toISOString(), ok: run.status === 0 }); await write(now); }
  if (run.status !== 0) console.log(`::warning::"${kind}" acabou com erro (${run.status})`);
}
