-- Shared availability uses the same public, revision-checked editing model as
-- player appearance and scouting choices. No direct player UPDATE is granted.
begin;
create or replace function public.foos_valid_availability(value jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare return_day text;
begin
 if value is null then return true; end if;
 if jsonb_typeof(value) is distinct from 'object'
  or value->>'status' is distinct from 'out'
  or jsonb_typeof(value->'reason') is distinct from 'string'
  or char_length(value->>'reason')>48
  or jsonb_typeof(value->'returnDate') is distinct from 'string' then return false; end if;
 return_day:=value->>'returnDate';
 if return_day='' then return true; end if;
 if return_day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
 return to_char(return_day::date,'YYYY-MM-DD')=return_day;
 exception when datetime_field_overflow or invalid_datetime_format then return false;
end;$$;
revoke all on function public.foos_valid_availability(jsonb) from public,anon,authenticated;
grant execute on function public.foos_valid_availability(jsonb) to anon,authenticated;
alter table public.foos_players
 add column availability jsonb,
 add column availability_revision integer not null default 0,
 add constraint foos_player_availability_valid check(public.foos_valid_availability(availability) and availability_revision>=0);

create or replace function public.foos_set_availability(p_id uuid,p_expected_revision integer,p_availability jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
 select availability_revision into current_revision from public.foos_players where id=p_id for update;
 if not found then raise exception 'Player no longer exists. Refresh and try again.'; end if;
 if p_expected_revision is null or current_revision<>p_expected_revision then
  raise exception 'Availability changed on another device. Reload this player and try again.';
 end if;
 if not public.foos_valid_availability(p_availability) then raise exception 'Enter a valid status and return date.'; end if;
 update public.foos_players set availability=p_availability,availability_revision=availability_revision+1 where id=p_id;
end;$$;
revoke all on function public.foos_set_availability(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.foos_set_availability(uuid,integer,jsonb) to anon,authenticated;
comment on column public.foos_players.availability is 'OUT details; active only before returnDate in America/Los_Angeles. Empty returnDate means manual clearance. Expired records are inert, not automatically deleted.';
commit;
