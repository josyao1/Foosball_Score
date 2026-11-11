-- Regression checks for a disposable database. Fixtures are always rolled back.
begin;
set local timezone='UTC';
create function public.foos_test_purge_failure() returns trigger language plpgsql as $$
begin
 if current_setting('foos.test_fail',true)='on' then raise exception 'Injected purge failure';end if;
 return old;
end;$$;
create trigger foos_test_purge_failure before delete on public.foos_rivalries for each row execute function public.foos_test_purge_failure();
set local role anon;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 rid uuid; other_rid uuid; gid uuid:=gen_random_uuid(); hidden uuid:=gen_random_uuid(); live_id uuid:=gen_random_uuid();
 initial jsonb; before_r jsonb; state jsonb; bag jsonb; goals jsonb; lineup jsonb; rev integer;
 snapshot jsonb; removed_at timestamptz;
begin
 insert into public.foos_players(id,name) values(a,'Backlog test A'),(b,'Backlog test B'),(c,'Backlog test C');
 rid:=(public.foos_create_team_rivalry(array[a,b],array[c])->>'id')::uuid;
 other_rid:=(public.foos_create_team_rivalry(array[a],array[b])->>'id')::uuid;
 lineup:=jsonb_build_object('a',jsonb_build_object('defense',a,'attack',b),'b',jsonb_build_object('defense',c,'attack',c));
 goals:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'actor_side','a','rung','goalie','flags',jsonb_build_array('dunk','bank'),'elapsed_ms',1000,'occurred_at','2026-01-01T00:00:01Z','lineup',lineup));
 lineup:=jsonb_set(lineup,'{a}',jsonb_build_object('defense',b,'attack',a,'swapped_at_ms',1500));
 goals:=goals||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'actor_side','a','rung','attacker','flags',jsonb_build_array('own_goal'),'elapsed_ms',2000,'occurred_at','2026-01-01T00:00:02Z','lineup',lineup));
 rev:=public.foos_save_game_v2(gid,rid,'2026-01-01','2026-01-01T00:01:00Z',0,goals,lineup);
 initial:=(select value-'revision'-'deleted_at' from jsonb_array_elements(public.foos_load_state()->'games') where value->>'id'=gid::text);
 before_r:=public.foos_rivalry_json(rid)-'deleted_at';
 perform public.foos_delete_game(gid,rev);
 if exists(select 1 from jsonb_array_elements(public.foos_load_state()->'games') where value->>'id'=gid::text) then raise exception 'Deleted game leaked into stats';end if;
 if (select count(*) from public.foos_goals where game_id=gid)<>2 then raise exception 'Goals were lost';end if;
 bag:=public.foos_load_backlog();
 if jsonb_array_length(bag->'games')<>1 then raise exception 'Backlog missed game';end if;
 begin
  perform public.foos_save_game_v2(gid,rid,'2026-01-01','2026-01-01T00:01:00Z',2,goals,lineup);
  raise exception 'Expected archived save to fail';
 exception when others then if sqlerrm='Expected archived save to fail' then raise;end if;end;
 perform public.foos_restore_game(gid,2);
 state:=(select value-'revision'-'deleted_at' from jsonb_array_elements(public.foos_load_state()->'games') where value->>'id'=gid::text);
 if initial<>state then raise exception 'Restoration changed game contents: % / %',initial,state;end if;
 begin
  perform public.foos_purge_game(gid,3);raise exception 'Active purge allowed';
 exception when others then if sqlerrm='Active purge allowed' then raise;end if;end;
 perform public.foos_delete_game(gid,3);
 begin
  perform public.foos_purge_game(gid,2);raise exception 'Stale purge allowed';
 exception when others then if sqlerrm='Stale purge allowed' then raise;end if;end;
 perform public.foos_restore_game(gid,4);
 -- Separately deleted game must remain hidden when restoring the parent.
 goals:=jsonb_set(goals,'{0,id}',to_jsonb(gen_random_uuid()::text));
 goals:=jsonb_set(goals,'{1,id}',to_jsonb(gen_random_uuid()::text));
 perform public.foos_save_game_v2(hidden,rid,'2026-01-01','2026-01-01T00:01:00Z',0,goals,lineup);
 perform public.foos_delete_game(hidden,1);
 perform public.foos_save_game_v2(live_id,rid,'2026-01-01',null,0,'[]',lineup);
 begin
  perform public.foos_delete_game(live_id,1);raise exception 'Live standalone archive allowed';
 exception when others then if sqlerrm='Live standalone archive allowed' then raise;end if;end;
 begin
  perform public.foos_delete_rivalry(rid,jsonb_build_object(gid::text,5));raise exception 'Stale rivalry deletion allowed';
 exception when others then if sqlerrm='Stale rivalry deletion allowed' then raise;end if;end;
 perform public.foos_delete_rivalry(rid,jsonb_build_object(gid::text,5,live_id::text,1));
 state:=public.foos_load_state();
 if jsonb_array_length(state->'games')<>0 then raise exception 'Archived parent games leaked';end if;
 if jsonb_array_length(state->'rivalries')<>1 then raise exception 'Other rivalry affected';end if;
 if (select count(*) from public.foos_goals)<>4 then raise exception 'Parent archive lost goals';end if;
 begin
  perform public.foos_restore_game(hidden,3);raise exception 'Orphan restore allowed';
 exception when others then if sqlerrm='Orphan restore allowed' then raise;end if;end;
 begin
  perform public.foos_discard_game(live_id,2);raise exception 'Archived child discard allowed';
 exception when others then if sqlerrm='Archived child discard allowed' then raise;end if;end;
 begin
  perform public.foos_save_game(gen_random_uuid(),rid,'2026-01-01',null,0,'[]');raise exception 'Old client recreated archived game';
 exception when others then if sqlerrm='Old client recreated archived game' then raise;end if;end;
 begin
  perform public.foos_create_team_rivalry(array[c],array[b,a]);raise exception 'Duplicate archived roster allowed';
 exception when unique_violation then null;end;
 select deleted_at into removed_at from public.foos_rivalries where id=rid;
 select jsonb_object_agg(id::text,revision) into snapshot from public.foos_games where rivalry_id=rid;
 perform public.foos_restore_rivalry(rid,removed_at,snapshot);
 state:=public.foos_load_state();
 if jsonb_array_length(state->'games')<>2 then raise exception 'Parent restoration revived previously deleted game';end if;
 if before_r<>(public.foos_rivalry_json(rid)-'deleted_at') then raise exception 'Roster changed';end if;
 perform public.foos_discard_game(live_id,3);
 if exists(select 1 from public.foos_games where id=live_id) then raise exception 'Live discard should remain permanent';end if;
 perform public.foos_delete_rivalry(rid,jsonb_build_object(gid::text,7));
 begin
  perform public.foos_purge_rivalry(rid,removed_at,snapshot);raise exception 'Old confirmation purged new archive';
 exception when others then if sqlerrm='Old confirmation purged new archive' then raise;end if;end;
 select deleted_at into removed_at from public.foos_rivalries where id=rid;
 select jsonb_object_agg(id::text,revision) into snapshot from public.foos_games where rivalry_id=rid;
 perform set_config('foos.test_fail','on',true);
 begin
  perform public.foos_purge_rivalry(rid,removed_at,snapshot);raise exception 'Injected failure did not happen';
 exception when others then if sqlerrm<>'Injected purge failure' then raise;end if;end;
 if (select count(*) from public.foos_games where rivalry_id=rid)<>2 or (select count(*) from public.foos_goals where game_id in(gid,hidden))<>4 then raise exception 'Failed purge lost records';end if;
 perform set_config('foos.test_fail','off',true);
 perform public.foos_purge_rivalry(rid,removed_at,snapshot);
 if exists(select 1 from public.foos_games where rivalry_id=rid) or exists(select 1 from public.foos_goals where game_id in(gid,hidden)) or exists(select 1 from public.foos_rivalry_members where rivalry_id=rid) then raise exception 'Purge left dangling records';end if;
 if (select count(*) from public.foos_players)<>3 or not exists(select 1 from public.foos_rivalries where id=other_rid) then raise exception 'Purge touched shared or unrelated records';end if;
 begin
  delete from public.foos_rivalries where id=other_rid;raise exception 'Direct delete permitted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.foos_lock_active_rivalry(other_rid);raise exception 'Private helper callable';
 exception when insufficient_privilege then null;end;
 raise notice 'Backlog archive, restore, purge, stale-state, lineage and anon permissions passed';
end;$$;
rollback;
