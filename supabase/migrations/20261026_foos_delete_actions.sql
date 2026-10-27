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
