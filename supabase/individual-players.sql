-- Additive upgrade. Only foos_* objects. Existing games/goals/labels are preserved.
begin;
create table if not exists public.foos_players (
 id uuid primary key default gen_random_uuid(),
 name text not null check(name=btrim(name) and char_length(name) between 1 and 40),
 created_at timestamptz not null default now()
);
create unique index if not exists foos_players_name_unique on public.foos_players(lower(name));
create table if not exists public.foos_rivalry_members (
 rivalry_id uuid not null references public.foos_rivalries(id) on delete cascade,
 player_id uuid not null references public.foos_players(id),
 side text not null check(side in ('a','b')),
 position integer not null check(position in (1,2)),
 primary key(rivalry_id,player_id), unique(rivalry_id,side,position)
);
create index if not exists foos_members_player on public.foos_rivalry_members(player_id);
alter table public.foos_players enable row level security;
alter table public.foos_rivalry_members enable row level security;
revoke all on public.foos_players,public.foos_rivalry_members from public,anon,authenticated;
grant select,insert on public.foos_players to anon,authenticated;
grant select on public.foos_rivalry_members to anon,authenticated;
create policy foos_players_read on public.foos_players for select to anon,authenticated using(true);
create policy foos_players_create on public.foos_players for insert to anon,authenticated with check(true);
create policy foos_members_read on public.foos_rivalry_members for select to anon,authenticated using(true);
alter table public.foos_games add column if not exists lineup jsonb;
alter table public.foos_goals add column if not exists lineup jsonb;
alter table public.foos_rivalries add column if not exists roster_key text;
-- Two names of up to 40 characters joined by " and ".
alter table public.foos_rivalries drop constraint foos_rivalries_names;
alter table public.foos_rivalries add constraint foos_rivalries_names check (
 player_a=btrim(player_a) and char_length(player_a) between 1 and 85 and
 player_b=btrim(player_b) and char_length(player_b) between 1 and 85);
-- Identity is the roster, not its generated display label.
drop index if exists public.foos_rivalries_pair_unique;

-- Confirmed legacy mapping only: do not split arbitrary user names containing "and".
insert into public.foos_players(name,created_at)
select min(name),min(created_at) from (
 select btrim(v.name) name,r.created_at from public.foos_rivalries r
 cross join lateral (values(r.player_a),(r.player_b)) v(name)
 where lower(btrim(v.name))<>'josh and brooks'
 union all
 select name,r.created_at from public.foos_rivalries r
 cross join (values('josh'),('brooks')) v(name)
 where lower(r.player_a)='josh and brooks' or lower(r.player_b)='josh and brooks'
) n group by lower(name) on conflict do nothing;
insert into public.foos_rivalry_members(rivalry_id,player_id,side,position)
select r.id,p.id,s.side,n.position from public.foos_rivalries r
cross join lateral (values('a',r.player_a),('b',r.player_b)) s(side,name)
cross join lateral unnest(case when lower(s.name)='josh and brooks' then array['josh','brooks'] else array[s.name] end) with ordinality n(name,position)
join public.foos_players p on lower(p.name)=lower(btrim(n.name))
on conflict do nothing;

create or replace function public.foos_roster_key(p_a uuid[],p_b uuid[]) returns text
language sql immutable set search_path='' as $$
 select string_agg(side, '|' order by side) from (
 select string_agg(id::text,',' order by id::text) side from unnest(p_a) id
 union all select string_agg(id::text,',' order by id::text) side from unnest(p_b) id
 ) s;
$$;
update public.foos_rivalries r set roster_key=public.foos_roster_key(
 (select array_agg(player_id) from public.foos_rivalry_members m where m.rivalry_id=r.id and side='a'),
 (select array_agg(player_id) from public.foos_rivalry_members m where m.rivalry_id=r.id and side='b'));
create unique index if not exists foos_rivalries_roster_unique on public.foos_rivalries(roster_key);

-- Old production clients may still create a singles rivalry during rollout.
create or replace function public.foos_legacy_roster() returns trigger
language plpgsql security definer set search_path='' as $$
declare s record; n text; names text[]; pid uuid; pos integer;
begin
 if new.roster_key is not null then return new; end if;
 for s in select * from (values('a',new.player_a),('b',new.player_b)) x(side,name) loop
  names:=case when lower(s.name)='josh and brooks' then array['josh','brooks'] else array[s.name] end;
  pos:=0;
  foreach n in array names loop
   pos:=pos+1;
   insert into public.foos_players(name) values(n) on conflict do nothing;
   select id into strict pid from public.foos_players where lower(name)=lower(n);
   insert into public.foos_rivalry_members values(new.id,pid,s.side,pos);
  end loop;
 end loop;
 update public.foos_rivalries set roster_key=public.foos_roster_key(
  (select array_agg(player_id) from public.foos_rivalry_members where rivalry_id=new.id and side='a'),
  (select array_agg(player_id) from public.foos_rivalry_members where rivalry_id=new.id and side='b')) where id=new.id;
 return new;
end;$$;
create trigger foos_legacy_roster after insert on public.foos_rivalries for each row execute function public.foos_legacy_roster();

create or replace function public.foos_rivalry_json(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(r)-'roster_key'||jsonb_build_object('members',jsonb_build_object(
 'a',(select coalesce(jsonb_agg(to_jsonb(p) order by m.position),'[]') from public.foos_rivalry_members m join public.foos_players p on p.id=m.player_id where m.rivalry_id=r.id and m.side='a'),
 'b',(select coalesce(jsonb_agg(to_jsonb(p) order by m.position),'[]') from public.foos_rivalry_members m join public.foos_players p on p.id=m.player_id where m.rivalry_id=r.id and m.side='b')))
 from public.foos_rivalries r where r.id=p_id;
$$;
create or replace function public.foos_create_team_rivalry(p_a uuid[],p_b uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rid uuid; a text; b text;
begin
 if coalesce(cardinality(p_a),0) not between 1 and 2 or coalesce(cardinality(p_b),0) not between 1 and 2
 or cardinality(p_a||p_b)<>(select count(distinct id) from unnest(p_a||p_b) id)
 then raise exception 'Choose one or two different players on each side.';end if;
 if (select count(*) from public.foos_players where id=any(p_a||p_b))<>cardinality(p_a||p_b) then raise exception 'Player not found.';end if;
 select string_agg(p.name,' and ' order by n.pos) into a from unnest(p_a) with ordinality n(id,pos) join public.foos_players p on p.id=n.id;
 select string_agg(p.name,' and ' order by n.pos) into b from unnest(p_b) with ordinality n(id,pos) join public.foos_players p on p.id=n.id;
 insert into public.foos_rivalries(player_a,player_b,roster_key) values(a,b,public.foos_roster_key(p_a,p_b)) returning id into rid;
 insert into public.foos_rivalry_members select rid,id,'a',pos from unnest(p_a) with ordinality n(id,pos);
 insert into public.foos_rivalry_members select rid,id,'b',pos from unnest(p_b) with ordinality n(id,pos);
 return public.foos_rivalry_json(rid);
end;$$;
create or replace function public.foos_default_lineup(p_rivalry uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_object_agg(side,jsonb_build_object('defense',ids[1],'attack',ids[cardinality(ids)])) from (
 select side,array_agg(player_id order by position) ids from public.foos_rivalry_members where rivalry_id=p_rivalry group by side) s;
$$;
create or replace function public.foos_valid_lineup(p_rivalry uuid,p_lineup jsonb) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare s text; members text[]; pos jsonb;
begin
 if p_lineup is null or jsonb_typeof(p_lineup)<>'object' then return false;end if;
 if not (p_lineup ?& array['a','b']) or (select count(*) from jsonb_object_keys(p_lineup))<>2 then return false;end if;
 foreach s in array array['a','b'] loop
  pos:=p_lineup->s;
  if jsonb_typeof(pos)<>'object' then return false;end if;
  if not(pos ?& array['defense','attack']) or (select count(*) from jsonb_object_keys(pos))<>2 then return false;end if;
  select array_agg(player_id::text) into members from public.foos_rivalry_members where rivalry_id=p_rivalry and side=s;
  if coalesce(cardinality(members),0) not between 1 and 2 or
   not coalesce((pos->>'defense')=any(members),false) or not coalesce((pos->>'attack')=any(members),false) or
   (cardinality(members)=2 and pos->>'defense'=pos->>'attack') then return false;end if;
 end loop;
 return true;
end;$$;

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

  select * into v_existing from public.foos_games where id = p_id for update;
  if found then
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

-- Public friends-only editing is intentional; functions restrict writes to foos_* and validate inputs.
revoke all on function public.foos_create_team_rivalry(uuid[],uuid[]), public.foos_save_game_v2(uuid,uuid,timestamptz,timestamptz,integer,jsonb,jsonb), public.foos_legacy_roster() from public,anon,authenticated;
grant execute on function public.foos_create_team_rivalry(uuid[],uuid[]), public.foos_save_game_v2(uuid,uuid,timestamptz,timestamptz,integer,jsonb,jsonb) to anon,authenticated;
revoke all on function public.foos_roster_key(uuid[],uuid[]),public.foos_default_lineup(uuid),public.foos_valid_lineup(uuid,jsonb),public.foos_rivalry_json(uuid) from public,anon,authenticated;
grant execute on function public.foos_rivalry_json(uuid) to anon,authenticated;
commit;
