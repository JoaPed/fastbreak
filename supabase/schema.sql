-- Fastbreak Planner — esquema da base de dados (Supabase / Postgres)
-- Corre isto uma vez no SQL Editor do Supabase. Pode correr-se de novo sem estragar dados.

-- =========================================================
-- Tabelas
-- =========================================================

-- Quem faz parte do grupo (só se entra pelo código de convite; o primeiro a entrar fica admin)
create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now()
);

-- Perfil visível ao grupo
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text not null default '' check (char_length(display_name) <= 40),
  topshot_username text check (char_length(topshot_username) <= 40),
  flow_address text check (flow_address is null or flow_address ~ '^0x[0-9a-fA-F]{16}$'),
  updated_at timestamptz not null default now()
);

-- Configuração privada (código de convite) e estado das tarefas automáticas
create table if not exists public.settings (key text primary key, value jsonb not null);
create table if not exists public.job_state (key text primary key, value jsonb not null, updated_at timestamptz not null default now());

-- Runs do Fastbreak e os seus dias (partilhado)
create table if not exists public.runs (
  id text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  name text not null,
  mode text not null default 'classic',
  start_date date not null,
  end_date date not null,
  prizes jsonb not null default '[]'::jsonb,       -- [{wins, value, label}]
  active boolean not null default false,
  chain_run_id text,                               -- id da run na blockchain (FastBreakV1)
  fictitious boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.run_days (
  run_id text not null references public.runs(id) on delete cascade,
  date date not null,
  objectives jsonb not null default '[]'::jsonb,   -- [{stat, target}]
  games jsonb not null default '[]'::jsonb,        -- [[fora, casa, inicioISO]]
  chain_game_id text,
  primary key (run_id, date)
);

-- Catálogo de jogadores NBA com médias (partilhado; preenchido pelas tarefas automáticas)
create table if not exists public.nba_players (
  id text primary key,                             -- personId da NBA
  name text not null,
  team text,
  avg jsonb,                                       -- {pts, reb, ast, fg3, stl, blk, min}
  gp int not null default 0,
  updated_at timestamptz not null default now()
);

-- O que cada equipa concede e marca por jogo (últimos 10 jogos; id 'NBA' = média da liga)
create table if not exists public.nba_teams (
  id text primary key,
  stats jsonb not null default '{}'::jsonb,       -- {n, allowed: {pts, reb, ...}, scored: {...}, last}
  updated_at timestamptz not null default now()
);

-- Odds por dia de jogos (data da NBA, hora de Nova Iorque)
create table if not exists public.odds_days (
  date date primary key,
  players jsonb not null default '{}'::jsonb,      -- {personId: {pts: {line, over, under}, ...}}
  source text,
  updated_at timestamptz not null default now()
);

-- Espelho do contrato FastBreakV1 (Flow)
create table if not exists public.chain_runs (
  id text primary key, name text, run_start bigint, run_end bigint, status int,
  updated_at timestamptz not null default now()
);
create table if not exists public.chain_games (
  id text primary key, run_id text, name text, deadline bigint, num_players int,
  stats jsonb not null default '[]'::jsonb, status int,
  updated_at timestamptz not null default now()
);
create table if not exists public.chain_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  chain_run_id text,
  date date,
  points bigint,
  win boolean,
  lineup jsonb,                                    -- nomes dos jogadores submetidos
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Dados privados de cada pessoa por run: plantel, usos e plano
create table if not exists public.user_runs (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  run_id text not null references public.runs(id) on delete cascade,
  roster jsonb not null default '{}'::jsonb,       -- {playerId: {uses, status, name?, team?}}
  plan jsonb not null default '{}'::jsonb,         -- {locks, bans, played, mode, live}
  updated_at timestamptz not null default now(),
  primary key (user_id, run_id)
);

-- Resumo que o grupo vê na classificação
create table if not exists public.summaries (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  run_id text not null references public.runs(id) on delete cascade,
  wins int not null default 0,
  losses int not null default 0,
  expected numeric,
  prize_probs jsonb,
  days jsonb,                                      -- {data: 'win' | 'loss'}
  next_p numeric,
  updated_at timestamptz not null default now(),
  primary key (user_id, run_id)
);

-- Contas smurf, coleção e resultados por conta (acrescentado depois; seguro correr de novo)
alter table public.profiles add column if not exists smurfs jsonb not null default '[]'::jsonb;  -- [{id: 's1', topshot_username, flow_address}]
alter table public.profiles add column if not exists collection jsonb;                             -- Moments lidos das carteiras
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_smurfs_max') then
    alter table public.profiles add constraint profiles_smurfs_max check (jsonb_typeof(smurfs) = 'array' and jsonb_array_length(smurfs) <= 2);
  end if;
end $$;
alter table public.chain_results add column if not exists account text not null default 'main';   -- 'main', 's1' ou 's2'
do $$ declare pk text; begin
  select c.conname into pk from pg_constraint c where c.conrelid = 'public.chain_results'::regclass and c.contype = 'p' and array_length(c.conkey, 1) = 2;
  if pk is not null then
    execute format('alter table public.chain_results drop constraint %I', pk);
    alter table public.chain_results add primary key (user_id, game_id, account);
  end if;
end $$;

-- Relatório de lesões da NBA (ESPN), substituído pela tarefa "Lesões" a cada meia hora (partilhado)
create table if not exists public.injuries (
  id text primary key,                             -- jogador (nome normalizado, como no catálogo)
  name text not null,
  team text,
  status text not null,                            -- out | ofs | doubtful | questionable | dtd | probable
  label text,                                      -- estado como vem da ESPN ("Out", "Day-To-Day")
  detail text,                                     -- lesão ("Knee · Tendinitis (left)")
  comment text,                                    -- notícia curta
  return_date date,                                -- regresso previsto
  reported_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Avisos de cada pessoa (privado): email e/ou notificações no telemóvel pela app ntfy (desligados no site por agora)
create table if not exists public.alerts (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  email boolean not null default false,
  ntfy text check (ntfy is null or ntfy ~ '^[A-Za-z0-9_-]{8,64}$'),   -- tópico do ntfy.sh
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Funções
-- =========================================================

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role = 'admin');
$$;

-- Estado do grupo para o ecrã de entrada
create or replace function public.group_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'has_members', exists (select 1 from public.members),
    'role', (select role from public.members where user_id = auth.uid())
  );
$$;

-- Entrar no grupo. Sem membros ainda: quem entra fica admin. Depois: precisa do código de convite.
create or replace function public.join_group(code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  existing text;
  invite text;
begin
  if auth.uid() is null then
    raise exception 'Sessão não iniciada';
  end if;
  lock table public.members in share row exclusive mode;
  select role into existing from public.members where user_id = auth.uid();
  if existing is not null then
    return existing;
  end if;
  if not exists (select 1 from public.members) then
    insert into public.members (user_id, role) values (auth.uid(), 'admin');
    return 'admin';
  end if;
  select value ->> 'code' into invite from public.settings where key = 'invite';
  if invite is null or code is null or lower(trim(code)) <> lower(trim(invite)) then
    raise exception 'Código de convite errado' using errcode = 'P0001';
  end if;
  insert into public.members (user_id, role) values (auth.uid(), 'member');
  return 'member';
end;
$$;

create or replace function public.get_invite_code() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Só o admin vê o código';
  end if;
  return (select value ->> 'code' from public.settings where key = 'invite');
end;
$$;

create or replace function public.set_invite_code(code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Só o admin muda o código';
  end if;
  if code is null or char_length(trim(code)) < 4 then
    raise exception 'O código precisa de pelo menos 4 caracteres';
  end if;
  insert into public.settings (key, value) values ('invite', jsonb_build_object('code', trim(code)))
  on conflict (key) do update set value = excluded.value;
end;
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before insert or update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists touch_user_runs on public.user_runs;
create trigger touch_user_runs before insert or update on public.user_runs for each row execute function public.touch_updated_at();
drop trigger if exists touch_summaries on public.summaries;
create trigger touch_summaries before insert or update on public.summaries for each row execute function public.touch_updated_at();
drop trigger if exists touch_alerts on public.alerts;
create trigger touch_alerts before insert or update on public.alerts for each row execute function public.touch_updated_at();

-- =========================================================
-- Regras de acesso (Row Level Security)
-- =========================================================

alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.job_state enable row level security;
alter table public.runs enable row level security;
alter table public.run_days enable row level security;
alter table public.nba_players enable row level security;
alter table public.nba_teams enable row level security;
alter table public.odds_days enable row level security;
alter table public.chain_runs enable row level security;
alter table public.chain_games enable row level security;
alter table public.chain_results enable row level security;
alter table public.user_runs enable row level security;
alter table public.summaries enable row level security;
alter table public.injuries enable row level security;
alter table public.alerts enable row level security;

-- membros: o grupo vê-se a si próprio; o admin pode remover outros
drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.is_member());
drop policy if exists members_kick on public.members;
create policy members_kick on public.members for delete to authenticated using (public.is_admin() and user_id <> auth.uid());

-- perfis: o grupo lê; cada um escreve o seu
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (public.is_member() or user_id = auth.uid());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- dados partilhados: o grupo lê; o admin escreve (as tarefas automáticas usam a chave secreta e não passam por aqui)
do $$
declare t text;
begin
  foreach t in array array['runs', 'run_days', 'nba_players', 'nba_teams', 'odds_days', 'injuries'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member())', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
  foreach t in array array['chain_runs', 'chain_games', 'chain_results'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member())', t || '_read', t);
  end loop;
end $$;

-- plantel e plano: só o próprio
drop policy if exists user_runs_own on public.user_runs;
create policy user_runs_own on public.user_runs for all to authenticated
  using (user_id = auth.uid() and public.is_member())
  with check (user_id = auth.uid() and public.is_member());

-- avisos: só o próprio (o tópico do ntfy é como uma palavra-passe: quem o souber recebe as notificações)
drop policy if exists alerts_own on public.alerts;
create policy alerts_own on public.alerts for all to authenticated
  using (user_id = auth.uid() and public.is_member())
  with check (user_id = auth.uid() and public.is_member());

-- resumos: o grupo lê; cada um escreve o seu
drop policy if exists summaries_read on public.summaries;
create policy summaries_read on public.summaries for select to authenticated using (public.is_member());
drop policy if exists summaries_write on public.summaries;
create policy summaries_write on public.summaries for insert to authenticated with check (user_id = auth.uid() and public.is_member());
drop policy if exists summaries_update on public.summaries;
create policy summaries_update on public.summaries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member());

-- Permissões base: só utilizadores com sessão; visitantes anónimos não leem nada.
-- As tarefas automáticas (chave secreta = papel service_role) precisam de acesso total às tabelas.
grant usage on schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
revoke all on function public.join_group(text), public.get_invite_code(), public.set_invite_code(text), public.group_status() from anon, public;
grant execute on function public.join_group(text), public.get_invite_code(), public.set_invite_code(text), public.group_status(), public.is_member(), public.is_admin() to authenticated;
