-- No HTTP or Slack delivery: suppress wake-ups transactionally, roll back fixtures
-- and restore the trigger automatically even if an assertion aborts the transaction.
begin;
alter table public.foos_slack_outbox disable trigger foos_slack_wake_on_insert;
do $$
declare rid uuid:=gen_random_uuid(); gid uuid:=gen_random_uuid(); oid uuid; token uuid:=gen_random_uuid();
 job jsonb; original jsonb; prepared jsonb; state jsonb; base text:='Final: test 10–8 test · 1:00';
begin
 if has_function_privilege('anon','public.foos_slack_story_context(uuid,uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.foos_slack_prepare(uuid,uuid,text)','EXECUTE') then raise exception 'Story RPC exposed publicly';end if;
 insert into public.foos_rivalries(id,player_a,player_b) values(rid,'story-a-'||substr(rid::text,1,8),'story-b-'||substr(rid::text,1,8));
 insert into public.foos_games(id,rivalry_id,started_at,ended_at) values(gid,rid,now()-interval '1 minute',now());
 insert into public.foos_goals(id,game_id,actor_side,rung,elapsed_ms,occurred_at) values(gen_random_uuid(),gid,'a','middle',10000,now());
 insert into public.foos_slack_outbox(game_id,game_revision,payload,status,claim_token,claimed_until)
 values(gid,1,jsonb_build_object('message',base,'game_url','https://example.test/game/'||gid),'claimed',token,clock_timestamp()+interval '2 minutes') returning id,to_jsonb(foos_slack_outbox) into oid,job;
 original:=job->'story_snapshot';
 if original->'game'->'goals'->0->>'rung'<>'middle' or original->'rivalry'->>'id'<>rid::text then raise exception 'Missing snapshot';end if;
 update public.foos_goals set rung='goalie' where game_id=gid;
 if (select story_snapshot from public.foos_slack_outbox where id=oid)<>original then raise exception 'Snapshot changed on correction';end if;
 if public.foos_slack_prepare(oid,gen_random_uuid(),base) is not null then raise exception 'Wrong lease accepted';end if;
 if public.foos_slack_story_context(oid,gen_random_uuid()) is not null then raise exception 'Context leaked without lease';end if;
 set local role service_role;
 state:=public.foos_slack_story_context(oid,token);
 if state is null or not exists(select 1 from jsonb_array_elements(state->'games') where value->>'id'=gid::text) then raise exception 'Missing context';end if;
 begin
  perform public.foos_slack_prepare(oid,token,'Changed score');
  raise exception 'Original score could be overwritten';
 exception when raise_exception then if SQLERRM<>'Invalid prepared message' then raise;end if;end;
 prepared:=public.foos_slack_prepare(oid,token,base||E'\nFirst-ever 10–8 finish at the table.');
 if prepared->'payload'->>'message'<>base||E'\nFirst-ever 10–8 finish at the table.' or not (prepared->>'story_prepared')::boolean then raise exception 'Message not frozen';end if;
 if prepared->'payload'->>'game_url'<>job->'payload'->>'game_url' then raise exception 'Button URL changed';end if;
 if (public.foos_slack_prepare(oid,token,base||E'\nDifferent fact')->'payload')<>prepared->'payload' then raise exception 'Retry changed message';end if;
 if public.foos_slack_story_context(oid,token) is not null then raise exception 'Prepared retry reread context';end if;
 reset role;
 update public.foos_slack_outbox set claimed_until=clock_timestamp()-interval '1 second' where id=oid;
 if public.foos_slack_prepare(oid,token,base) is not null then raise exception 'Expired lease accepted';end if;
 -- Simulate a pre-rollout queued row: it must remain the original message.
 update public.foos_slack_outbox set story_snapshot=null,story_prepared=false,payload=job->'payload',claimed_until=clock_timestamp()+interval '1 minute' where id=oid;
 if public.foos_slack_prepare(oid,token,base||E'\nNew fact')->'payload'<>job->'payload' then raise exception 'Legacy job was enriched';end if;
end;$$;
rollback;
