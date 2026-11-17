-- Shared scouting picks; independent revisions avoid conflicts with jersey edits.
begin;
create or replace function public.foos_valid_scouting_override(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item record;
begin
 if value is null then return true; end if;
 if jsonb_typeof(value) is distinct from 'object'
   or jsonb_typeof(value->'noteId') is distinct from 'string'
   or char_length(btrim(value->>'noteId')) not between 1 and 128
   or jsonb_typeof(value->'scores') is distinct from 'object' then return false; end if;
 if not ((value->'scores') ? (value->>'noteId'))
   or (select count(*) from jsonb_object_keys(value->'scores')) > 100 then return false; end if;
 for item in select * from jsonb_each(value->'scores') loop
   if char_length(btrim(item.key)) not between 1 and 128 or jsonb_typeof(item.value) <> 'number' then return false; end if;
   if (item.value::text)::numeric < 0 or (item.value::text)::numeric > 200 then return false; end if;
 end loop;
 return true;
end;$$;
revoke all on function public.foos_valid_scouting_override(jsonb) from public,anon,authenticated;
grant execute on function public.foos_valid_scouting_override(jsonb) to anon,authenticated;

alter table public.foos_players
 add column if not exists scouting_override jsonb,
 add column if not exists scouting_revision integer not null default 0;
alter table public.foos_players add constraint foos_player_scouting_valid
 check(public.foos_valid_scouting_override(scouting_override) and scouting_revision >= 0);

create or replace function public.foos_set_scouting_override(p_id uuid,p_expected_revision integer,p_override jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
 select scouting_revision into current_revision from public.foos_players where id=p_id for update;
 if not found then raise exception 'Player no longer exists. Refresh and try again.'; end if;
 if p_expected_revision is null or current_revision<>p_expected_revision then
   raise exception 'This scouting choice changed on another device. Refresh and try again.';
 end if;
 if not public.foos_valid_scouting_override(p_override) then
   raise exception 'Invalid scouting choice. Refresh and try again.';
 end if;
 update public.foos_players set scouting_override=p_override,scouting_revision=scouting_revision+1 where id=p_id;
end;$$;
revoke all on function public.foos_set_scouting_override(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.foos_set_scouting_override(uuid,integer,jsonb) to anon,authenticated;
commit;
