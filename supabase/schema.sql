-- Paste into the existing project's Supabase SQL editor and run as postgres.
-- Re-running this script preserves data. It manages only the foos_* objects.
begin;

create table if not exists public.foos_rivalries (
  id uuid primary key default gen_random_uuid(),
  player_a text not null,
  player_b text not null,
  created_at timestamptz not null default now(),
  constraint foos_rivalries_names check (
    player_a = btrim(player_a) and char_length(player_a) between 1 and 40
    and player_b = btrim(player_b) and char_length(player_b) between 1 and 40
    and lower(player_a) <> lower(player_b)
  )
);
create unique index if not exists foos_rivalries_pair_unique
  on public.foos_rivalries (least(lower(player_a), lower(player_b)), greatest(lower(player_a), lower(player_b)));

create table if not exists public.foos_games (
  id uuid primary key,
  rivalry_id uuid not null references public.foos_rivalries(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  revision integer not null default 1,
  constraint foos_games_revision check (revision > 0),
  constraint foos_games_times check (
    isfinite(started_at) and (ended_at is null or (isfinite(ended_at) and ended_at >= started_at))
  )
);
create unique index if not exists foos_games_one_active
  on public.foos_games (rivalry_id) where ended_at is null;
create index if not exists foos_games_rivalry on public.foos_games (rivalry_id, started_at desc);

create table if not exists public.foos_goals (
  id uuid primary key,
  game_id uuid not null references public.foos_games(id) on delete cascade,
  actor_side text not null check (actor_side in ('a', 'b')),
  rung text not null check (rung in ('goalie', 'defender', 'middle', 'attacker')),
  flags text[] not null default '{}',
  elapsed_ms bigint not null check (elapsed_ms >= 0),
  occurred_at timestamptz not null check (isfinite(occurred_at)),
  constraint foos_goals_flags check (
    flags <@ array['dunk', 'bank', 'own_goal']::text[]
    and array_position(flags, null) is null
    and (not ('own_goal' = any(flags)) or cardinality(flags) = 1)
  )
);
create index if not exists foos_goals_game on public.foos_goals (game_id, occurred_at, id);

alter table public.foos_rivalries enable row level security;
alter table public.foos_games enable row level security;
alter table public.foos_goals enable row level security;

revoke all on public.foos_rivalries, public.foos_games, public.foos_goals from public, anon, authenticated;
grant select on public.foos_rivalries, public.foos_games, public.foos_goals to anon, authenticated;
grant insert on public.foos_rivalries to anon, authenticated;

drop policy if exists foos_rivalries_read on public.foos_rivalries;
create policy foos_rivalries_read on public.foos_rivalries for select to anon, authenticated using (true);
drop policy if exists foos_rivalries_create on public.foos_rivalries;
create policy foos_rivalries_create on public.foos_rivalries for insert to anon, authenticated with check (true);
drop policy if exists foos_games_read on public.foos_games;
create policy foos_games_read on public.foos_games for select to anon, authenticated using (true);
drop policy if exists foos_goals_read on public.foos_goals;
create policy foos_goals_read on public.foos_goals for select to anon, authenticated using (true);

create or replace function public.foos_save_game(
  p_id uuid,
  p_rivalry_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_expected_revision integer,
  p_goals jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing public.foos_games%rowtype;
  v_revision integer;
  v_goal jsonb;
  v_flags text[];
  v_occurred_at timestamptz;
  v_elapsed_ms bigint;
begin
  if p_id is null or p_rivalry_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Game ID, rivalry ID and a nonnegative expected revision are required.';
  end if;
  if p_started_at is null or not isfinite(p_started_at)
    or (p_ended_at is not null and (not isfinite(p_ended_at) or p_ended_at < p_started_at)) then
    raise exception 'Game timestamps are invalid.';
  end if;
  if p_goals is null or jsonb_typeof(p_goals) <> 'array' then
    raise exception 'Goals must be a JSON array.';
  end if;
  if p_ended_at is not null and jsonb_array_length(p_goals) = 0 then
    raise exception 'An empty game cannot be finished. Discard it instead.';
  end if;

  select * into v_existing from public.foos_games where id = p_id for update;
  if found then
    if v_existing.revision <> p_expected_revision then
      raise exception 'This game changed on another device. Refresh and try again.';
    end if;
    if v_existing.rivalry_id <> p_rivalry_id or v_existing.started_at <> p_started_at then
      raise exception 'A game cannot change its rivalry or start time.';
    end if;
    v_revision := v_existing.revision + 1;
    update public.foos_games set ended_at = p_ended_at, revision = v_revision where id = p_id;
  else
    if p_expected_revision <> 0 then
      raise exception 'This game changed on another device. Refresh and try again.';
    end if;
    v_revision := 1;
    -- A concurrent create with this ID or an active game for this rivalry
    -- loses to a unique constraint; the entire request is rolled back.
    insert into public.foos_games (id, rivalry_id, started_at, ended_at, revision)
      values (p_id, p_rivalry_id, p_started_at, p_ended_at, v_revision);
  end if;

  delete from public.foos_goals where game_id = p_id;
  for v_goal in select value from jsonb_array_elements(p_goals) loop
    if jsonb_typeof(v_goal) <> 'object' then
      raise exception 'Each goal must be an object.';
    end if;
    if not (v_goal ?& array['id', 'actor_side', 'rung', 'flags', 'elapsed_ms', 'occurred_at'])
      or (select count(*) from jsonb_object_keys(v_goal)) <> 6 then
      raise exception 'Goal fields must be id, actor_side, rung, flags, elapsed_ms and occurred_at.';
    end if;
    if jsonb_typeof(v_goal->'id') <> 'string'
      or jsonb_typeof(v_goal->'actor_side') <> 'string'
      or jsonb_typeof(v_goal->'rung') <> 'string'
      or jsonb_typeof(v_goal->'occurred_at') <> 'string'
      or jsonb_typeof(v_goal->'flags') <> 'array'
      or jsonb_typeof(v_goal->'elapsed_ms') <> 'number'
      or (v_goal->>'elapsed_ms') !~ '^[0-9]+$' then
      raise exception 'Goal fields have invalid types.';
    end if;
    if exists (select 1 from jsonb_array_elements(v_goal->'flags') flag where jsonb_typeof(flag) <> 'string') then
      raise exception 'Goal flags must be strings.';
    end if;
    select coalesce(array_agg(value), '{}'::text[]) into v_flags from jsonb_array_elements_text(v_goal->'flags');
    if cardinality(v_flags) <> (select count(distinct flag) from unnest(v_flags) flag) then
      raise exception 'Goal flags must not contain duplicates.';
    end if;
    v_occurred_at := (v_goal->>'occurred_at')::timestamptz;
    v_elapsed_ms := (v_goal->>'elapsed_ms')::bigint;
    if not isfinite(v_occurred_at) or v_occurred_at < p_started_at
      or (p_ended_at is not null and (v_occurred_at > p_ended_at
        or v_elapsed_ms > extract(epoch from (p_ended_at - p_started_at)) * 1000)) then
      raise exception 'Goal timestamps must fall within the game.';
    end if;
    insert into public.foos_goals (id, game_id, actor_side, rung, flags, elapsed_ms, occurred_at)
      values ((v_goal->>'id')::uuid, p_id, v_goal->>'actor_side', v_goal->>'rung', v_flags, v_elapsed_ms, v_occurred_at);
  end loop;
  return v_revision;
end;
$function$;

create or replace function public.foos_discard_game(p_id uuid, p_expected_revision integer)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_game public.foos_games%rowtype;
begin
  select * into v_game from public.foos_games where id = p_id for update;
  if not found or p_expected_revision is null or v_game.revision <> p_expected_revision then
    raise exception 'This game changed on another device. Refresh and try again.';
  end if;
  if v_game.ended_at is not null then
    raise exception 'Only unfinished games can be discarded.';
  end if;
  delete from public.foos_games where id = p_id;
end;
$function$;

revoke all on function public.foos_save_game(uuid, uuid, timestamptz, timestamptz, integer, jsonb) from public, anon, authenticated;
revoke all on function public.foos_discard_game(uuid, integer) from public, anon, authenticated;
grant execute on function public.foos_save_game(uuid, uuid, timestamptz, timestamptz, integer, jsonb) to anon, authenticated;
grant execute on function public.foos_discard_game(uuid, integer) to anon, authenticated;

-- One scalar JSON response avoids row pagination and observes one read snapshot.
create or replace function public.foos_load_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'rivalries', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at, r.id), '[]'::jsonb)
      from public.foos_rivalries r
    ),
    'games', (
      select coalesce(jsonb_agg(
        to_jsonb(g) || jsonb_build_object('goals', (
          select coalesce(jsonb_agg(to_jsonb(goal) - 'game_id'
            order by goal.elapsed_ms, goal.occurred_at, goal.id), '[]'::jsonb)
          from public.foos_goals goal where goal.game_id = g.id
        )) order by g.started_at, g.id
      ), '[]'::jsonb)
      from public.foos_games g
    )
  );
$function$;
revoke all on function public.foos_load_state() from public, anon, authenticated;
grant execute on function public.foos_load_state() to anon, authenticated;

-- Only foosball deletion RPC additions; run within the caller's migration transaction.
create or replace function public.foos_delete_game(p_id uuid, p_expected_revision integer)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_game public.foos_games%rowtype;
begin
  if p_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Game ID and a positive expected revision are required.';
  end if;
  select * into v_game from public.foos_games where id = p_id for update;
  if not found or v_game.revision <> p_expected_revision then
    raise exception 'This game changed on another device. Refresh and try again.';
  end if;
  delete from public.foos_games where id = p_id;
end;
$function$;

create or replace function public.foos_delete_rivalry(p_id uuid, p_expected_games jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expected record;
  v_games jsonb;
begin
  if p_id is null then
    raise exception 'Rivalry ID is required.';
  end if;
  if p_expected_games is null or jsonb_typeof(p_expected_games) <> 'object' then
    raise exception 'Expected games must be a JSON object mapping game IDs to revisions.';
  end if;
  for v_expected in select key, value from jsonb_each(p_expected_games) loop
    if v_expected.key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Expected game IDs must be canonical lowercase UUID strings.';
    end if;
    if jsonb_typeof(v_expected.value) <> 'number' or v_expected.value::text !~ '^[1-9][0-9]*$' then
      raise exception 'Expected game revisions must be positive integers.';
    end if;
    if (v_expected.value::text)::numeric > 2147483647 then
      raise exception 'Expected game revisions must be positive integers within the integer range.';
    end if;
  end loop;

  -- A new game needs a foreign-key key-share lock on this row. Holding it
  -- FOR UPDATE prevents a new game from slipping past the snapshot check.
  perform 1 from public.foos_rivalries where id = p_id for update;
  if not found then
    raise exception 'Rivalry not found. Refresh and try again.';
  end if;
  -- Stable lock order prevents competing bulk deletes from locking games
  -- in conflicting orders. Existing saves must finish before comparison.
  perform id from public.foos_games where rivalry_id = p_id order by id for update;
  select coalesce(jsonb_object_agg(id::text, revision), '{}'::jsonb)
    into v_games from public.foos_games where rivalry_id = p_id;
  if v_games <> p_expected_games then
    raise exception 'This rivalry changed on another device. Refresh and try again.';
  end if;
  delete from public.foos_games where rivalry_id = p_id;
  delete from public.foos_rivalries where id = p_id;
end;
$function$;

revoke all on function public.foos_delete_game(uuid, integer) from public, anon, authenticated;
revoke all on function public.foos_delete_rivalry(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.foos_delete_game(uuid, integer) to anon, authenticated;
grant execute on function public.foos_delete_rivalry(uuid, jsonb) to anon, authenticated;

commit;
