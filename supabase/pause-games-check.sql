-- Disposable-database checks. Every fixture is rolled back.
begin;
set local timezone='UTC';
set local role anon;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); rid uuid; gid uuid:=gen_random_uuid();
 lineup jsonb; goals jsonb; paused jsonb; resumed jsonb; state jsonb; started timestamptz:=clock_timestamp()-interval '1 minute';
 rev integer; deleted timestamptz;
begin
 insert into public.foos_players(id,name) values(a,'Pause test A'),(b,'Pause test B');
 rid:=(public.foos_create_team_rivalry(array[a],array[b])->>'id')::uuid;
 lineup:=jsonb_build_object('a',jsonb_build_object('defense',a,'attack',a),'b',jsonb_build_object('defense',b,'attack',b));
 goals:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'actor_side','a','rung','attacker','flags',jsonb_build_array('bank'),'elapsed_ms',20000,'occurred_at',started+interval '20 seconds','lineup',lineup));
 rev:=public.foos_save_game_v2(gid,rid,started,null,0,goals,lineup);
 paused:=public.foos_set_game_paused(gid,rev,true);
 if paused->>'paused_at' is null or (paused->>'revision')::int<>2 then raise exception 'Pause not saved';end if;
 if public.foos_set_game_paused(gid,2,true)<>paused then raise exception 'Pause retry changed state';end if;
 begin
  perform public.foos_set_game_paused(gid,1,false);raise exception 'Stale pause accepted';
 exception when others then if sqlerrm='Stale pause accepted' then raise;end if;end;
 begin
  perform public.foos_save_game_v2(gid,rid,started,null,2,goals,lineup);raise exception 'Paused v2 save accepted';
 exception when others then if sqlerrm not like 'Game is paused.%' then raise;end if;end;
 begin
  perform public.foos_save_game(gid,rid,started,null,2,goals);raise exception 'Paused legacy save accepted';
 exception when others then if sqlerrm not like 'Game is paused.%' then raise;end if;end;
 -- Parent deletion preserves ongoing pause and guards against orphan resume.
 perform public.foos_delete_rivalry(rid,jsonb_build_object(gid::text,2));
 begin
  perform public.foos_set_game_paused(gid,3,false);raise exception 'Archived resume accepted';
 exception when others then if sqlerrm='Archived resume accepted' then raise;end if;end;
 select deleted_at into deleted from public.foos_rivalries where id=rid;
 perform public.foos_restore_rivalry(rid,deleted,jsonb_build_object(gid::text,3));
 state:=(select value from jsonb_array_elements(public.foos_load_state()->'games') where value->>'id'=gid::text);
 if state->>'paused_at'<>paused->>'paused_at' or state->'goals'<>paused->'goals' then raise exception 'Restore lost pause or goals';end if;
 perform pg_sleep(0.02);
 resumed:=public.foos_set_game_paused(gid,4,false);
 if resumed->>'paused_at' is not null or (resumed->>'paused_ms')::bigint<20 then raise exception 'Resume did not count paused time';end if;
 if (resumed->>'started_at')::timestamptz<>started or resumed->'goals'<>paused->'goals' then raise exception 'Resume changed history';end if;
 rev:=public.foos_save_game_v2(gid,rid,started,clock_timestamp(),5,goals,lineup);
 begin
  perform public.foos_set_game_paused(gid,rev,true);raise exception 'Finished pause accepted';
 exception when others then if sqlerrm not like 'Finished games%' then raise;end if;end;
 perform public.foos_delete_game(gid,rev);
 perform public.foos_restore_game(gid,rev+1);
 state:=(select value from jsonb_array_elements(public.foos_load_state()->'games') where value->>'id'=gid::text);
 if state->>'paused_ms'<>resumed->>'paused_ms' then raise exception 'Finished restore lost active clock';end if;
 if has_function_privilege('anon','public.foos_guard_paused_game()','EXECUTE') then raise exception 'Private helper exposed';end if;
 raise notice 'Pause/resume, idempotency, stale saves, both save APIs, backlog roundtrip, finished guard and permissions passed.';
end;$$;
rollback;
