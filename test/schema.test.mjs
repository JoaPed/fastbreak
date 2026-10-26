// Testa o esquema e as regras de acesso num Postgres local (PGlite), com o essencial do Supabase simulado.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
const sql = fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  revoke all on schema public from public;
`);
await db.exec(sql);
await db.exec(sql); // idempotente

const U = { a: '00000000-0000-0000-0000-00000000000a', b: '00000000-0000-0000-0000-00000000000b', c: '00000000-0000-0000-0000-00000000000c' };
await db.exec(`insert into auth.users values ('${U.a}'), ('${U.b}'), ('${U.c}')`);

let fails = 0;
async function as(user, q, params) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ? U[user] : '']);
  await db.exec(user === 'service' ? 'set role service_role' : user ? 'set role authenticated' : 'set role anon');
  try { return { rows: (await db.query(q, params)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role'); }
}
function expect(label, cond, info) { if (!cond) fails++; console.log((cond ? 'ok   ' : 'FALHA') + ' ' + label + (cond ? '' : ' → ' + JSON.stringify(info))); }

let r;
r = await as('a', 'select public.group_status() s'); expect('estado inicial sem membros', r.rows?.[0].s.has_members === false, r);
r = await as('a', `select public.join_group(null) r`); expect('primeiro a entrar fica admin', r.rows?.[0].r === 'admin', r);
r = await as('b', `select public.join_group('x') r`); expect('sem código definido, B não entra', !!r.error, r);
r = await as('b', `select public.set_invite_code('amigos26')`); expect('B não pode definir código', !!r.error, r);
r = await as('a', `select public.set_invite_code('amigos26')`); expect('admin define código', !r.error, r);
r = await as('b', `select public.get_invite_code() c`); expect('B não vê código', !!r.error, r);
r = await as('b', `select public.join_group('errado') r`); expect('código errado recusado', !!r.error, r);
r = await as('b', `select public.join_group(' AMIGOS26 ') r`); expect('código certo (maiúsculas/espaços) entra', r.rows?.[0].r === 'member', r);
r = await as('b', `select * from public.settings`); expect('B não lê settings', r.rows?.length === 0 || !!r.error, r);

// partilhado
r = await as('a', `insert into public.runs (id, name, start_date, end_date) values ('run-1', 'Run 1', '2026-10-20', '2026-10-30')`); expect('admin cria run', !r.error, r);
r = await as('b', `insert into public.runs (id, name, start_date, end_date) values ('run-x', 'X', '2026-10-20', '2026-10-30')`); expect('membro não cria run', !!r.error, r);
r = await as('b', `select id from public.runs`); expect('membro lê runs', r.rows?.length === 1, r);
r = await as('c', `select id from public.runs`); expect('não-membro não lê runs', r.rows?.length === 0, r);
r = await as(null, `select id from public.runs`); expect('anónimo não lê runs', !!r.error || r.rows?.length === 0, r);
r = await as('service', `insert into public.odds_days (date, players) values ('2026-10-20', '{"1":{"pts":{"line":20.5}}}')`); expect('tarefa automática escreve odds', !r.error, r);
r = await as('service', `insert into public.job_state (key, value) values ('stats', '{}') on conflict (key) do update set value = excluded.value`); expect('tarefa automática escreve o seu estado (job_state)', !r.error, r);
r = await as('service', `select value from public.job_state`); expect('tarefa automática lê o seu estado', r.rows?.length === 1, r);
r = await as('service', `insert into public.nba_players (id, name) values ('1', 'Teste') on conflict (id) do update set name = excluded.name`); expect('tarefa automática escreve jogadores', !r.error, r);
r = await as('b', `select * from public.job_state`); expect('membro não lê job_state', !!r.error || r.rows?.length === 0, r);
r = await as('b', `select date from public.odds_days`); expect('membro lê odds', r.rows?.length === 1, r);
r = await as('b', `update public.odds_days set source = 'x'`); expect('membro não altera odds (0 linhas)', !r.error, r);
r = await as('service', `select source from public.odds_days`); expect('… e as odds ficaram iguais', r.rows?.[0].source === null, r);

// privado
r = await as('b', `insert into public.user_runs (run_id, roster) values ('run-1', '{"203999":{"uses":2}}')`); expect('B guarda o seu plantel', !r.error, r);
r = await as('a', `select * from public.user_runs`); expect('A não vê o plantel de B', r.rows?.length === 0, r);
r = await as('a', `insert into public.user_runs (user_id, run_id) values ('${U.b}', 'run-1') on conflict do nothing`); expect('A não escreve por B', !!r.error, r);
r = await as('c', `insert into public.user_runs (run_id) values ('run-1')`); expect('não-membro não guarda plantel', !!r.error, r);

// resumos e perfis
r = await as('b', `insert into public.summaries (run_id, wins, losses) values ('run-1', 3, 1)`); expect('B publica resumo', !r.error, r);
r = await as('a', `select wins from public.summaries`); expect('A vê resumo de B', r.rows?.[0]?.wins === 3, r);
r = await as('a', `update public.summaries set wins = 0 where user_id = '${U.b}'`); r = await as('a', `select wins from public.summaries`); expect('A não altera resumo de B', r.rows?.[0]?.wins === 3, r);
r = await as('b', `update public.summaries set share = '{"roster":{"jokic":[2,3,1]},"use":{"jokic":["2026-10-21"]}}' where user_id = '${U.b}'`); expect('B partilha o plano no resumo', !r.error, r);
r = await as('a', `select share from public.summaries`); expect('A vê o plano partilhado de B', r.rows?.[0]?.share?.roster?.jokic?.[1] === 3, r);
r = await as('c', `select share from public.summaries`); expect('não-membro não vê planos partilhados', !r.rows?.length, r);
r = await as('a', `update public.summaries set share = null where user_id = '${U.b}'`); r = await as('b', `select share from public.summaries`); expect('A não apaga a partilha de B', !!r.rows?.[0]?.share, r);
r = await as('b', `insert into public.profiles (display_name, topshot_username) values ('Bruno', 'bruno_ts')`); expect('B cria perfil', !r.error, r);
r = await as('b', `select share_plan from public.profiles`); expect('partilha ligada por defeito', r.rows?.[0]?.share_plan === true, r);
r = await as('b', `update public.profiles set share_plan = false`); r = await as('a', `select share_plan from public.profiles`); expect('B desliga a partilha e o grupo vê isso', !r.error && r.rows?.[0]?.share_plan === false, r);
r = await as('a', `select display_name from public.profiles`); expect('A vê perfil de B', r.rows?.[0]?.display_name === 'Bruno', r);
r = await as('b', `insert into public.profiles (user_id, display_name) values ('${U.a}', 'falso')`); expect('B não cria perfil de A', !!r.error, r);
r = await as('b', `update public.profiles set flow_address = 'xyz'`); expect('endereço Flow inválido recusado', !!r.error, r);
r = await as('b', `update public.profiles set smurfs = '[{"id":"s1","flow_address":"0x0000000000000001"},{"id":"s2"}]'`); expect('B guarda 2 contas smurf', !r.error, r);
r = await as('b', `update public.profiles set smurfs = '[{"id":"s1"},{"id":"s2"},{"id":"s3"}]'`); expect('mais de 2 smurfs recusado', !!r.error, r);
r = await as('b', `update public.profiles set collection = '{"players":{"x":{"moments":2}}}'`); expect('B guarda a coleção', !r.error, r);
r = await db.query(`insert into public.nba_teams (id, stats) values ('BOS', '{"n":10}')`); r = await as('b', `select id from public.nba_teams`); expect('membro lê os dados das equipas', r.rows?.length === 1, r);
r = await as('b', `update public.nba_teams set stats = '{}'`); r = await as('b', `select stats from public.nba_teams`); expect('membro não altera os dados das equipas', r.rows?.[0]?.stats?.n === 10, r);
r = await as('c', `select id from public.nba_teams`); expect('não-membro não lê os dados das equipas', !r.rows?.length, r);
r = await db.query(`insert into public.chain_results (user_id, game_id, account, win) values ('${U.b}', 'g1', 'main', true), ('${U.b}', 'g1', 's1', false)`); expect('resultados da principal e da smurf no mesmo dia', true, r);
r = await as('a', `select account from public.chain_results where user_id = '${U.b}' order by account`); expect('o grupo vê os resultados por conta', r.rows?.length === 2 && r.rows[1].account === 's1', r);

r = await as('service', `insert into public.injuries (id, name, team, status, return_date) values ('stephen-curry', 'Stephen Curry', 'GSW', 'dtd', '2026-10-21')`); expect('tarefa automática escreve o relatório de lesões', !r.error, r);
r = await as('b', `select status from public.injuries`); expect('membro lê as lesões', r.rows?.[0]?.status === 'dtd', r);
r = await as('b', `delete from public.injuries`); r = await as('service', `select count(*)::int n from public.injuries`); expect('membro não apaga as lesões', r.rows?.[0].n === 1, r);
r = await as('c', `select id from public.injuries`); expect('não-membro não lê as lesões', !r.rows?.length, r);
r = await as('service', `insert into public.market_asks (listing_id, nft_id, price, player, player_id, tier) values ('L1', 1, 2.5, 'Nikola Jokić', 'nikola-jokic', 'Common')`); expect('tarefa do mercado escreve os preços', !r.error, r);
r = await as('b', `select price from public.market_asks where player_id = 'nikola-jokic'`); expect('membro lê os preços', +r.rows?.[0]?.price === 2.5, r);
r = await as('b', `insert into public.market_sales (listing_id, nft_id, price, sold_at, player, player_id) values ('x', 1, 1, now(), 'a', 'a')`); expect('membro não escreve vendas', !!r.error, r);
r = await as('c', `select listing_id from public.market_asks`); expect('não-membro não lê os preços', !r.rows?.length, r);
r = await as('b', `insert into public.alerts (email, ntfy) values (true, 'fastbreak-abc123xyz')`); expect('B liga os seus avisos', !r.error, r);
r = await as('b', `update public.alerts set ntfy = 'mau tópico!'`); expect('tópico do ntfy inválido recusado', !!r.error, r);
r = await as('a', `select * from public.alerts`); expect('A não vê os avisos de B (tópico privado)', r.rows?.length === 0, r);
r = await as('a', `insert into public.alerts (user_id, email) values ('${U.b}', false) on conflict (user_id) do update set email = false`); r = await as('service', `select email from public.alerts where user_id = '${U.b}'`); expect('A não muda os avisos de B', r.rows?.[0]?.email === true, r);
r = await as('service', `select ntfy from public.alerts`); expect('tarefa automática lê os avisos', r.rows?.[0]?.ntfy === 'fastbreak-abc123xyz', r);
r = await as('c', `insert into public.alerts (email) values (true)`); expect('não-membro não liga avisos', !!r.error, r);

// membros
r = await as('b', `delete from public.members where user_id = '${U.a}'`); r = await as('a', `select count(*)::int n from public.members`); expect('membro não expulsa admin', r.rows?.[0].n === 2, r);
r = await as('b', `update public.members set role = 'admin' where user_id = '${U.b}'`); r = await as('a', `select role from public.members where user_id = '${U.b}'`); expect('membro não se promove', r.rows?.[0].role === 'member', r);
r = await as('b', `select public.request_job('odds') r`); expect('membro não pede tarefas', !!r.error, r);
r = await as('a', `select public.request_job('rm -rf') r`); expect('tarefa desconhecida recusada', !!r.error, r);
r = await as('a', `select public.request_job('odds') r`); expect('admin pede as odds', r.rows?.[0].r.ok === true, r);
r = await as('a', `select public.request_job('odds') r`); expect('segundo pedido logo a seguir fica à espera do primeiro', r.rows?.[0].r.ok === false, r);
r = await as('b', `select public.job_requests() r`); expect('membro não vê os pedidos', r.rows?.[0].r === null, r);
r = await as('a', `select public.job_requests() r`); expect('admin vê o pedido', !!r.rows?.[0].r?.odds?.at, r);
r = await as('a', `select value from public.job_state`); expect('job_state continua fechado ao site', !r.rows?.length, r);
r = await as(null, `select public.request_job('odds') r`); expect('anónimo não pede tarefas', !!r.error, r);
r = await as('a', `delete from public.members where user_id = '${U.b}'`); r = await as('a', `select count(*)::int n from public.members`); expect('admin remove membro', r.rows?.[0].n === 1, r);
r = await as('b', `select id from public.runs`); expect('removido deixa de ver runs', r.rows?.length === 0, r);

console.log(fails ? `\n${fails} falha(s)` : '\ntodas as regras passaram');
process.exit(fails ? 1 : 0);
