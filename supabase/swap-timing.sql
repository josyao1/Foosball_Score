-- Optional per-side swap time, retained in every goal attribution snapshot.
create or replace function public.foos_valid_lineup(p_rivalry uuid,p_lineup jsonb) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare s text; members text[]; pos jsonb;
begin
 if p_lineup is null or jsonb_typeof(p_lineup)<>'object' then return false;end if;
 if not (p_lineup ?& array['a','b']) or (select count(*) from jsonb_object_keys(p_lineup))<>2 then return false;end if;
 foreach s in array array['a','b'] loop
  pos:=p_lineup->s;
  if jsonb_typeof(pos)<>'object' then return false;end if;
  if not(pos ?& array['defense','attack']) or exists(select 1 from jsonb_object_keys(pos) k where k not in ('defense','attack','swapped_at_ms')) then return false;end if;
  if pos ? 'swapped_at_ms' then
   if jsonb_typeof(pos->'swapped_at_ms')<>'number' then return false;end if;
   if (pos->>'swapped_at_ms')::numeric<0 or (pos->>'swapped_at_ms')::numeric>9007199254740991 or trunc((pos->>'swapped_at_ms')::numeric)<>(pos->>'swapped_at_ms')::numeric then return false;end if;
  end if;
  select array_agg(player_id::text) into members from public.foos_rivalry_members where rivalry_id=p_rivalry and side=s;
  if coalesce(cardinality(members),0) not between 1 and 2 or
   not coalesce((pos->>'defense')=any(members),false) or not coalesce((pos->>'attack')=any(members),false) or
   (cardinality(members)=2 and pos->>'defense'=pos->>'attack') then return false;end if;
 end loop;
 return true;
end;$$;
