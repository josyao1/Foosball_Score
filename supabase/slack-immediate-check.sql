-- Disposable local DB only: transaction-scoped pg_net/Vault stand-ins.
-- Actual pg_net's commit-only HTTP contract is verified in its upstream docs.
begin;
create schema if not exists vault;
create schema if not exists net;
create table vault.decrypted_secrets(name text,decrypted_secret text);
insert into vault.decrypted_secrets values('foos_slack_scheduler_token',repeat('a',64));
create table net.test_requests(id bigint generated always as identity);
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint
language plpgsql as $$
declare request_id bigint;
begin
 if current_setting('foos.fail_wake',true)='on' then raise exception 'Injected network queue outage';end if;
 insert into net.test_requests default values returning id into request_id;
 return request_id;
end;$$;
\ir migrations/20261120045108_foos_slack_immediate_dispatch.sql
create function pg_temp.assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end;$$;
do $$
declare rid uuid:=gen_random_uuid();gid uuid:=gen_random_uuid();failed_wake uuid:=gen_random_uuid();
 start_at timestamptz:=clock_timestamp()-interval '10 seconds';goals jsonb;item jsonb;n integer;
begin
 insert into public.foos_rivalries(id,player_a,player_b) values(rid,'Immediate test A','Immediate test B');
 update public.foos_slack_settings set notifications_enabled=true,activation_timestamp=clock_timestamp()-interval '1 minute',last_dispatch_at=null,test_game_id=null;
 goals:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'actor_side','a','rung','middle','flags','[]'::jsonb,'elapsed_ms',1,'occurred_at',clock_timestamp()-interval '5 seconds'));
 perform public.foos_save_game_v2(gid,rid,start_at,null,0,goals,null);
 perform pg_temp.assert((select count(*)=0 from net.test_requests),'live scoring does not wake');
 perform public.foos_save_game_v2(gid,rid,start_at,clock_timestamp(),1,goals,null);
 perform pg_temp.assert((select count(*)=1 from net.test_requests),'final save wakes exactly once');
 perform public.foos_save_game_v2(gid,rid,start_at,clock_timestamp(),2,goals,null);
 perform pg_temp.assert((select count(*)=1 from net.test_requests),'correction does not wake');
 item:=public.foos_slack_claim();
 perform pg_temp.assert(foos_private.slack_tick() is null,'backup does not wake active sender');
 perform public.foos_slack_begin((item->>'id')::uuid,(item->>'claim_token')::uuid);
 perform public.foos_slack_settle((item->>'id')::uuid,(item->>'claim_token')::uuid,'sent',null,60);
 update public.foos_slack_settings set last_dispatch_at=clock_timestamp()-interval '2 seconds';
 perform pg_temp.assert(foos_private.slack_tick() is null,'idle scheduler does not wake');
 -- Simulate an unavailable pg_net queue: game + pending notification survive.
 perform set_config('foos.fail_wake','on',true);
 goals:=jsonb_set(goals,'{0,id}',to_jsonb(gen_random_uuid()::text));
 perform public.foos_save_game_v2(failed_wake,rid,start_at,clock_timestamp(),0,goals,null);
 perform pg_temp.assert((select ended_at is not null from public.foos_games where id=failed_wake),'wake failure cannot undo game');
 perform pg_temp.assert((select status='pending' from public.foos_slack_outbox where game_id=failed_wake),'wake failure leaves durable pending job');
 perform set_config('foos.fail_wake','off',true);
 perform pg_temp.assert(foos_private.slack_tick() is not null,'minute fallback wakes missed job');
 item:=public.foos_slack_claim();
 perform pg_temp.assert(item is not null,'second game can dispatch after two seconds, not a minute');
 perform public.foos_slack_begin((item->>'id')::uuid,(item->>'claim_token')::uuid);
 perform public.foos_slack_settle((item->>'id')::uuid,(item->>'claim_token')::uuid,'retry','slack_http_503',180);
 update public.foos_slack_settings set last_dispatch_at=clock_timestamp()-interval '2 seconds';
 perform pg_temp.assert(foos_private.slack_tick() is null,'retry backoff does not cause unnecessary wake');
 select count(*) into n from net.test_requests;
 -- A rolled back finish loses both its job and queued wake request.
 begin
  goals:=jsonb_set(goals,'{0,id}',to_jsonb(gen_random_uuid()::text));
  perform public.foos_save_game_v2(gen_random_uuid(),rid,start_at,clock_timestamp(),0,goals,null);
  raise exception 'rollback fixture';
 exception when raise_exception then if sqlerrm<>'rollback fixture' then raise;end if;end;
 perform pg_temp.assert((select count(*)=n from net.test_requests),'transaction rollback also rolls back wake');
 perform pg_temp.assert(not has_function_privilege('anon','foos_private.wake_slack()','EXECUTE'),'wake backend-only');
end;$$;
rollback;
