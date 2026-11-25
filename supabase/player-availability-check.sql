-- Transaction-only integration checks: no test players survive and no games are created.
begin;
set local role anon;
do $$
declare pid uuid; snapshot jsonb; saved jsonb; rows_updated integer:=0;
begin
 insert into public.foos_players(name) values('availability-'||substr(gen_random_uuid()::text,1,8)) returning id into pid;
 perform public.foos_set_availability(pid,0,'{"status":"out","reason":"OOO","returnDate":"2099-12-01"}');
 snapshot:=public.foos_load_state();
 select value into saved from jsonb_array_elements(snapshot->'players') where value->>'id'=pid::text;
 if saved->'availability'->>'reason'<>'OOO' or (saved->>'availability_revision')::integer<>1 then raise exception 'Saved status missing from shared state'; end if;
 begin
  perform public.foos_set_availability(pid,0,null);
  raise exception 'Stale write accepted';
 exception when raise_exception then
  if SQLERRM not like '%another device%' then raise; end if;
 end;
 begin
  perform public.foos_set_availability(pid,1,'{"status":"out","reason":"OOO","returnDate":"2026-02-30"}');
  raise exception 'Invalid date accepted';
 exception when raise_exception then
  if SQLERRM not like '%valid status%' then raise; end if;
 end;
 if public.foos_valid_availability('{"status":"out","reason":12,"returnDate":""}') then raise exception 'Invalid reason accepted'; end if;
 if public.foos_valid_availability('{"status":"out","reason":"OOO"}') then raise exception 'Missing date accepted'; end if;
 if public.foos_valid_availability(jsonb_build_object('status','out','reason',repeat('x',49),'returnDate','')) then raise exception 'Oversize reason accepted'; end if;
 if not public.foos_valid_availability('{"status":"out","reason":"OOO","returnDate":""}') then raise exception 'Unknown return rejected'; end if;
 begin
  update public.foos_players set availability=null where id=pid;
  get diagnostics rows_updated = row_count;
  if rows_updated>0 then raise exception 'Direct update was allowed'; end if;
 exception when insufficient_privilege then null;
 end;
 perform public.foos_set_availability(pid,1,null);
 if exists(select 1 from public.foos_players where id=pid and (availability is not null or availability_revision<>2)) then raise exception 'Clear failed'; end if;
end;$$;
rollback;
