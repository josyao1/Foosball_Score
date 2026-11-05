-- Run after the migration inside the SAME rollback-only transaction.
-- No fixture from this check is committed.
set local role anon;
do $$
declare
 p1 uuid:=gen_random_uuid();p2 uuid:=gen_random_uuid();p3 uuid:=gen_random_uuid();p4 uuid:=gen_random_uuid();
 rid uuid;gid uuid:=gen_random_uuid();goalid uuid:=gen_random_uuid(); r jsonb;l jsonb; swapped jsonb;rev integer;start_time timestamptz:=now();goal jsonb;actual jsonb;
begin
 insert into public.foos_players(id,name) values(p1,'t-'||p1),(p2,'t-'||p2),(p3,'t-'||p3),(p4,'t-'||p4);
 r:=public.foos_create_team_rivalry(array[p1,p2],array[p3,p4]);rid:=(r->>'id')::uuid;
 if jsonb_array_length(r->'members'->'a')<>2 then raise exception 'Roster was not returned.';end if;
 begin perform public.foos_create_team_rivalry(array[p4,p3],array[p2,p1]);raise exception 'Duplicate roster accepted.';exception when unique_violation then null;end;
 begin perform public.foos_create_team_rivalry(array[p1,p2],array[p2]);raise exception 'Overlap accepted.';exception when raise_exception then if sqlerrm='Overlap accepted.' then raise;end if;end;
 rev:=public.foos_save_game_v2(gid,rid,start_time,null,0,'[]',null);
 select lineup into l from public.foos_games where id=gid;
 if l->'a'->>'defense'<>p1::text then raise exception 'Default lineup missing.';end if;
 goal:=jsonb_build_object('id',goalid,'actor_side','a','rung','goalie','flags','[]'::jsonb,'elapsed_ms',1000,'occurred_at',start_time+interval '1 second','lineup',l);
 rev:=public.foos_save_game_v2(gid,rid,start_time,null,rev,jsonb_build_array(goal),l);
 swapped:=jsonb_set(l,'{a}',jsonb_build_object('defense',p2,'attack',p1));
 rev:=public.foos_save_game_v2(gid,rid,start_time,null,rev,jsonb_build_array(goal),swapped);
 select lineup into actual from public.foos_goals where id=goalid;
 if actual<>l then raise exception 'Swap changed previous scorer.';end if;
 begin perform public.foos_save_game_v2(gid,rid,start_time,null,rev-1,jsonb_build_array(goal),l);raise exception 'Stale save accepted.';exception when raise_exception then if sqlerrm='Stale save accepted.' then raise;end if;end;
 -- Older clients do not send event attribution. Editing must preserve it.
 rev:=public.foos_save_game(gid,rid,start_time,null,rev,jsonb_build_array(goal-'lineup'));
 select lineup into actual from public.foos_goals where id=goalid;
 if actual<>l then raise exception 'Legacy client erased attribution.';end if;
 -- Dropping the optional snapshot through the v2 API must preserve it, too.
 rev:=public.foos_save_game_v2(gid,rid,start_time,null,rev,jsonb_build_array(goal-'lineup'),swapped);
 select lineup into actual from public.foos_goals where id=goalid;
 if actual<>l then raise exception 'Missing snapshot erased attribution.';end if;
 begin perform public.foos_save_game_v2(gid,rid,start_time,null,rev,jsonb_build_array(goal),jsonb_set(l,'{a,attack}',to_jsonb(p1::text)));raise exception 'Invalid lineup accepted.';exception when raise_exception then if sqlerrm='Invalid lineup accepted.' then raise;end if;end;
 r:=public.foos_load_state();
 if not(r ? 'players') then raise exception 'Player registry inaccessible to anon.';end if;
end;$$;
reset role;
