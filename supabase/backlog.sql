-- Apply AFTER schema.sql, individual-players.sql and swap-timing.sql.
-- Only foos_* objects. No game, goal, roster or player is removed by installation.
begin;
alter table public.foos_rivalries add column if not exists deleted_at timestamptz;
alter table public.foos_games add column if not exists deleted_at timestamptz;
-- Archived games must not occupy the live slot. Roster uniqueness deliberately remains global.
drop index if exists public.foos_games_one_active;
create unique index foos_games_one_active on public.foos_games(rivalry_id)
 where ended_at is null and deleted_at is null;

-- All mutations lock parent before children. This serializes saves/deletes/restores,
-- including requests made by old clients. These private helpers are not RPC endpoints.
create or replace function public.foos_lock_active_rivalry(p_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.foos_rivalries%rowtype;
begin
 select * into r from public.foos_rivalries where id=p_id for update;
 if not found then raise exception 'This rivalry no longer exists.'; end if;
 if r.deleted_at is not null then raise exception 'This rivalry is in the backlog. Restore it before editing.'; end if;
end;$$;

create or replace function public.foos_delete_game(p_id uuid,p_expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare g public.foos_games%rowtype;
begin
 perform public.foos_lock_active_rivalry((select rivalry_id from public.foos_games where id=p_id));
 select * into g from public.foos_games where id=p_id for update;
 if not found or p_expected_revision is null or g.revision<>p_expected_revision or g.deleted_at is not null then
  raise exception 'This game changed. Refresh and try again.';
 end if;
 if g.ended_at is null then raise exception 'Only finished games can be moved to the backlog individually.';end if;
 update public.foos_games set deleted_at=clock_timestamp(),revision=revision+1 where id=p_id;
end;$$;

-- Discarding live games is intentionally still permanent; backlog covers finished games.
create or replace function public.foos_discard_game(p_id uuid,p_expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare g public.foos_games%rowtype;
begin
 perform public.foos_lock_active_rivalry((select rivalry_id from public.foos_games where id=p_id));
 select * into g from public.foos_games where id=p_id for update;
 if not found or p_expected_revision is null or g.revision<>p_expected_revision or g.deleted_at is not null then
  raise exception 'This game changed. Refresh and try again.';
 end if;
 if g.ended_at is not null then raise exception 'Only unfinished games can be discarded.';end if;
 delete from public.foos_games where id=p_id;
end;$$;

create or replace function public.foos_delete_rivalry(p_id uuid,p_expected_games jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
 perform public.foos_lock_active_rivalry(p_id);
 perform id from public.foos_games where rivalry_id=p_id order by id for update;
 select coalesce(jsonb_object_agg(id::text,revision),'{}') into snapshot
  from public.foos_games where rivalry_id=p_id and deleted_at is null;
 if p_expected_games is null or snapshot<>p_expected_games then
  raise exception 'This rivalry changed. Close the dialog and review its games.';
 end if;
 update public.foos_rivalries set deleted_at=clock_timestamp() where id=p_id;
 -- Preserve each child's deletion status; invalidate already-open scoring dialogs.
 update public.foos_games set revision=revision+1 where rivalry_id=p_id;
end;$$;

create or replace function public.foos_restore_game(p_id uuid,p_expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare g public.foos_games%rowtype;
begin
 perform public.foos_lock_active_rivalry((select rivalry_id from public.foos_games where id=p_id));
 select * into g from public.foos_games where id=p_id for update;
 if not found or p_expected_revision is null or g.revision<>p_expected_revision then raise exception 'This game changed. Refresh and try again.';end if;
 if g.deleted_at is null then raise exception 'Only games in the backlog can be restored.';end if;
 if g.ended_at is null and exists(select 1 from public.foos_games where rivalry_id=g.rivalry_id and id<>g.id and ended_at is null and deleted_at is null) then
  raise exception 'This rivalry already has a live game. Finish or discard it before restoring this game.';
 end if;
 update public.foos_games set deleted_at=null,revision=revision+1 where id=p_id;
end;$$;

create or replace function public.foos_purge_game(p_id uuid,p_expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare g public.foos_games%rowtype;
begin
 perform public.foos_lock_active_rivalry((select rivalry_id from public.foos_games where id=p_id));
 select * into g from public.foos_games where id=p_id for update;
 if not found or p_expected_revision is null or g.revision<>p_expected_revision then raise exception 'This game changed. Refresh and try again.';end if;
 if g.deleted_at is null then raise exception 'Only games in the backlog can be permanently deleted.';end if;
 delete from public.foos_games where id=p_id;
end;$$;

create or replace function public.foos_lock_backlog_rivalry(p_id uuid,p_deleted_at timestamptz,p_expected_games jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.foos_rivalries%rowtype; snapshot jsonb;
begin
 select * into r from public.foos_rivalries where id=p_id for update;
 if not found then raise exception 'This rivalry no longer exists.';end if;
 if r.deleted_at is null then raise exception 'Only rivalries in the backlog can be managed here.';end if;
 if p_deleted_at is distinct from r.deleted_at then raise exception 'This rivalry changed. Refresh and try again.';end if;
 perform id from public.foos_games where rivalry_id=p_id order by id for update;
 select coalesce(jsonb_object_agg(id::text,revision),'{}') into snapshot from public.foos_games where rivalry_id=p_id;
 if p_expected_games is null or snapshot<>p_expected_games then raise exception 'This rivalry changed. Refresh and try again.';end if;
end;$$;

create or replace function public.foos_restore_rivalry(p_id uuid,p_deleted_at timestamptz,p_expected_games jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.foos_lock_backlog_rivalry(p_id,p_deleted_at,p_expected_games);
 update public.foos_rivalries set deleted_at=null where id=p_id;
 update public.foos_games set revision=revision+1 where rivalry_id=p_id;
end;$$;

create or replace function public.foos_purge_rivalry(p_id uuid,p_deleted_at timestamptz,p_expected_games jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.foos_lock_backlog_rivalry(p_id,p_deleted_at,p_expected_games);
 -- Goals cascade with games; roster memberships cascade with rivalry. Players survive.
 delete from public.foos_games where rivalry_id=p_id;
 delete from public.foos_rivalries where id=p_id;
end;$$;

-- Preserve existing validation and goal-lineup handling.
create or replace function public.foos_save_game_v2(
  p_id uuid,
  p_rivalry_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_expected_revision integer,
  p_goals jsonb,
  p_lineup jsonb default null
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
  v_lineup jsonb;
  v_goal_lineup jsonb;
  v_old_goals jsonb;
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

  perform public.foos_lock_active_rivalry(p_rivalry_id);
  select * into v_existing from public.foos_games where id = p_id for update;
  if found then
    if v_existing.deleted_at is not null then raise exception 'This game is in the backlog. Restore it before editing.';end if;
    if v_existing.revision <> p_expected_revision then
      raise exception 'This game changed on another device. Refresh and try again.';
    end if;
    if v_existing.rivalry_id <> p_rivalry_id or v_existing.started_at <> p_started_at then
      raise exception 'A game cannot change its rivalry or start time.';
    end if;
    v_lineup:=coalesce(nullif(p_lineup,'null'::jsonb),v_existing.lineup);
    v_revision := v_existing.revision + 1;
    update public.foos_games set ended_at = p_ended_at, revision = v_revision, lineup=v_lineup where id = p_id;
  else
    if p_expected_revision <> 0 then
      raise exception 'This game changed on another device. Refresh and try again.';
    end if;
    v_lineup:=coalesce(nullif(p_lineup,'null'::jsonb),public.foos_default_lineup(p_rivalry_id));
    v_revision := 1;
    -- A concurrent create with this ID or an active game for this rivalry
    -- loses to a unique constraint; the entire request is rolled back.
    insert into public.foos_games (id, rivalry_id, started_at, ended_at, revision, lineup)
      values (p_id, p_rivalry_id, p_started_at, p_ended_at, v_revision, v_lineup);
  end if;

  if v_lineup is not null and not public.foos_valid_lineup(p_rivalry_id,v_lineup) then raise exception 'Invalid team positions.';end if;
  select coalesce(jsonb_object_agg(id::text,jsonb_build_object('lineup',lineup)),'{}') into v_old_goals from public.foos_goals where game_id=p_id;
  delete from public.foos_goals where game_id = p_id;
  for v_goal in select value from jsonb_array_elements(p_goals) loop
    if jsonb_typeof(v_goal) <> 'object' then
      raise exception 'Each goal must be an object.';
    end if;
    if not (v_goal ?& array['id', 'actor_side', 'rung', 'flags', 'elapsed_ms', 'occurred_at'])
      or (select count(*) from jsonb_object_keys(v_goal)) not between 6 and 7
      or exists(select 1 from jsonb_object_keys(v_goal) k where k not in ('id','actor_side','rung','flags','elapsed_ms','occurred_at','lineup')) then
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
    v_goal_lineup:=nullif(v_goal->'lineup','null'::jsonb);
    if v_goal_lineup is null then
      if v_old_goals ? (v_goal->>'id') then v_goal_lineup:=nullif(v_old_goals->(v_goal->>'id')->'lineup','null'::jsonb);
      else v_goal_lineup:=v_lineup;end if;
    end if;
    if v_goal_lineup is not null and not public.foos_valid_lineup(p_rivalry_id,v_goal_lineup) then raise exception 'Invalid goal attribution.';end if;
    insert into public.foos_goals (id, game_id, actor_side, rung, flags, elapsed_ms, occurred_at, lineup)
      values ((v_goal->>'id')::uuid, p_id, v_goal->>'actor_side', v_goal->>'rung', v_flags, v_elapsed_ms, v_occurred_at, v_goal_lineup);
  end loop;
  return v_revision;
end;
$function$;

-- Preserve existing validation and goal-lineup handling.
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
  v_old_goals jsonb;
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

  perform public.foos_lock_active_rivalry(p_rivalry_id);
  select * into v_existing from public.foos_games where id = p_id for update;
  if found then
    if v_existing.deleted_at is not null then raise exception 'This game is in the backlog. Restore it before editing.';end if;
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

  select coalesce(jsonb_object_agg(id::text,lineup),'{}') into v_old_goals from public.foos_goals where game_id=p_id;
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
    insert into public.foos_goals (id, game_id, actor_side, rung, flags, elapsed_ms, occurred_at, lineup)
      values ((v_goal->>'id')::uuid, p_id, v_goal->>'actor_side', v_goal->>'rung', v_flags, v_elapsed_ms, v_occurred_at, nullif(v_old_goals->(v_goal->>'id'),'null'::jsonb));
  end loop;
  return v_revision;
end;
$function$;

create or replace function public.foos_load_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'players',(select coalesce(jsonb_agg(to_jsonb(p) order by p.name),'[]') from public.foos_players p),
    'rivalries', (
      select coalesce(jsonb_agg(public.foos_rivalry_json(r.id) order by r.created_at, r.id), '[]'::jsonb)
      from public.foos_rivalries r where r.deleted_at is null
    ),
    'games', (
      select coalesce(jsonb_agg(
        to_jsonb(g) || jsonb_build_object('goals', (
          select coalesce(jsonb_agg(to_jsonb(goal) - 'game_id'
            order by goal.elapsed_ms, goal.occurred_at, goal.id), '[]'::jsonb)
          from public.foos_goals goal where goal.game_id = g.id
        )) order by g.started_at, g.id
      ), '[]'::jsonb)
      from public.foos_games g where g.deleted_at is null and exists(select 1 from public.foos_rivalries r where r.id=g.rivalry_id and r.deleted_at is null)
    )
  );
$function$;

create or replace function public.foos_load_backlog() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'rivalries',(select coalesce(jsonb_agg(public.foos_rivalry_json(r.id) order by r.deleted_at desc nulls last,r.id),'[]')
   from public.foos_rivalries r where r.deleted_at is not null or exists(select 1 from public.foos_games g where g.rivalry_id=r.id and g.deleted_at is not null)),
  'games',(select coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object('goals',(
   select coalesce(jsonb_agg(to_jsonb(goal)-'game_id' order by goal.elapsed_ms,goal.occurred_at,goal.id),'[]') from public.foos_goals goal where goal.game_id=g.id)) order by g.started_at desc,g.id),'[]')
   from public.foos_games g join public.foos_rivalries r on r.id=g.rivalry_id where g.deleted_at is not null or r.deleted_at is not null)
 );
$$;

-- Match the existing public-editing policy: writes ONLY through validated RPCs,
-- never grant direct table update/delete. Helpers cannot be called from the client.
revoke all on function public.foos_lock_active_rivalry(uuid),public.foos_lock_backlog_rivalry(uuid,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.foos_load_backlog(),public.foos_restore_game(uuid,integer),public.foos_purge_game(uuid,integer),public.foos_restore_rivalry(uuid,timestamptz,jsonb),public.foos_purge_rivalry(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.foos_load_backlog(),public.foos_restore_game(uuid,integer),public.foos_purge_game(uuid,integer),public.foos_restore_rivalry(uuid,timestamptz,jsonb),public.foos_purge_rivalry(uuid,timestamptz,jsonb) to anon,authenticated;
commit;
