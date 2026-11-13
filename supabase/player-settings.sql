-- Additive player customization. Stable IDs, goal snapshots and game data stay intact.
begin;
alter table public.foos_players
 add column if not exists appearance jsonb,
 add column if not exists settings_revision integer not null default 0;
alter table public.foos_players add constraint foos_player_appearance_valid check (
 appearance is null or (
 jsonb_typeof(appearance)='object' and
 appearance ?& array['letters','subtitle','color','trim','lettering'] and
 jsonb_typeof(appearance->'letters')='string' and
 jsonb_typeof(appearance->'subtitle')='string' and
 char_length(btrim(appearance->>'letters')) between 1 and 6 and
 char_length(appearance->>'subtitle')<=100 and
 (appearance->>'color') ~ '^#[0-9A-Fa-f]{6}$' and
 (appearance->>'trim') ~ '^#[0-9A-Fa-f]{6}$' and
 (appearance->>'lettering') ~ '^#[0-9A-Fa-f]{6}$'
 ) is true
);
-- Controlled public editing matches this friends-only app's existing shared model.
-- No direct UPDATE permission is granted, so callers cannot bypass revision checks.
create or replace function public.foos_update_player(p_id uuid,p_expected_revision integer,p_name text,p_appearance jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
 select settings_revision into current_revision from public.foos_players where id=p_id for update;
 if not found then raise exception 'Player no longer exists. Refresh and try again.';end if;
 if p_expected_revision is null or current_revision<>p_expected_revision then
  raise exception 'This player was edited on another device. Close and reopen the editor to load the latest changes.';
 end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then raise exception 'Enter a player name up to 40 characters.';end if;
 if p_appearance is null then raise exception 'Choose a jersey and subtitle before saving.';end if;
 update public.foos_players set name=btrim(p_name),appearance=p_appearance,settings_revision=settings_revision+1 where id=p_id;
 update public.foos_rivalries r set
 player_a=(select string_agg(p.name,' and ' order by m.position) from public.foos_rivalry_members m join public.foos_players p on p.id=m.player_id where m.rivalry_id=r.id and m.side='a'),
 player_b=(select string_agg(p.name,' and ' order by m.position) from public.foos_rivalry_members m join public.foos_players p on p.id=m.player_id where m.rivalry_id=r.id and m.side='b')
 where exists(select 1 from public.foos_rivalry_members m where m.rivalry_id=r.id and m.player_id=p_id);
end;$$;
revoke all on function public.foos_update_player(uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.foos_update_player(uuid,integer,text,jsonb) to anon,authenticated;
-- Resolve labels from membership on reads too: a concurrent rivalry creation can
-- have captured the old name before the player edit committed.
create or replace function public.foos_rivalry_json(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(r)-'roster_key'||jsonb_build_object(
 'player_a',coalesce((select string_agg(p.name,' and ' order by m.position) from public.foos_rivalry_members m join public.foos_players p on p.id=m.player_id where m.rivalry_id=r.id and m.side='a'),r.player_a),
 'player_b',coalesce((select string_agg(p.name,' and ' order by m.position) from public.foos_rivalry_members m join public.foos_players p on p.id=m.player_id where m.rivalry_id=r.id and m.side='b'),r.player_b),
 'members',jsonb_build_object(
 'a',(select coalesce(jsonb_agg(to_jsonb(p) order by m.position),'[]') from public.foos_rivalry_members m join public.foos_players p on p.id=m.player_id where m.rivalry_id=r.id and m.side='a'),
 'b',(select coalesce(jsonb_agg(to_jsonb(p) order by m.position),'[]') from public.foos_rivalry_members m join public.foos_players p on p.id=m.player_id where m.rivalry_id=r.id and m.side='b')))
 from public.foos_rivalries r where r.id=p_id;
$$;
commit;
