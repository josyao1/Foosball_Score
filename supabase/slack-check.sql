-- Run only against a disposable DB with the outbox migration installed.
-- All fixtures/config changes roll back. Nothing contacts Slack.
begin;
set local timezone='UTC';
create function pg_temp.assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end;$$;
create function pg_temp.goals(sides text,own_index integer default 0) returns jsonb language sql as $$
 select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'actor_side',substr(sides,i,1),'rung','middle',
  'flags',case when i=own_index then '["own_goal"]'::jsonb else '[]'::jsonb end,
  'elapsed_ms',i,'occurred_at',clock_timestamp()-interval '5 seconds')) from generate_series(1,length(sides)) i;
$$;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();d uuid:=gen_random_uuid();
 rid uuid; singles uuid; gid uuid:=gen_random_uuid();hist uuid:=gen_random_uuid();offgame uuid:=gen_random_uuid(); other uuid:=gen_random_uuid();
 start_at timestamptz:=clock_timestamp()-interval '10 seconds'; goals jsonb; rev integer; item jsonb; jid uuid; lease uuid; n integer;
begin
 insert into public.foos_players(id,name) values(a,'Slack A'),(b,'Slack B'),(c,'Slack C'),(d,'Slack <@here>');
 rid:=(public.foos_create_team_rivalry(array[a,b],array[c,d])->>'id')::uuid;
 singles:=(public.foos_create_team_rivalry(array[a],array[c])->>'id')::uuid;
 goals:=pg_temp.goals('aab',2); -- a regular + a own goal + b regular = 1-2
 -- Disabled-period games stay excluded even if reopened/refinished later.
 perform public.foos_save_game_v2(offgame,rid,start_at,clock_timestamp(),0,goals,null);
 perform pg_temp.assert((select count(*)=0 from public.foos_slack_outbox),'default disabled');
 perform pg_temp.assert((select slack_first_finalized_at is not null from public.foos_games where id=offgame),'disabled finalization marked');
 update public.foos_slack_settings set notifications_enabled=true,activation_timestamp=clock_timestamp()-interval '1 minute',scheduler_token_hash=encode(sha256(convert_to(repeat('a',64),'UTF8')),'hex') where id;
 perform pg_temp.assert(public.foos_slack_authorize(repeat('a',64)),'scheduler token matches');
 perform pg_temp.assert(not public.foos_slack_authorize(repeat('b',64)),'wrong token rejected');
 perform public.foos_save_game_v2(offgame,rid,start_at,null,1,goals,null);
 perform public.foos_save_game_v2(offgame,rid,start_at,clock_timestamp(),2,goals,null);
 perform pg_temp.assert((select count(*)=0 from public.foos_slack_outbox),'disabled game not backfilled');
 -- A newly imported historical result must also stay silent.
 perform public.foos_save_game(hist,singles,'2026-01-01','2026-01-01T00:01:00Z',0,
  jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'actor_side','a','rung','goalie','flags','[]'::jsonb,'elapsed_ms',1,'occurred_at','2026-01-01T00:00:01Z')));
 perform pg_temp.assert((select count(*)=0 from public.foos_slack_outbox),'historical import excluded');
 perform pg_temp.assert(foos_private.slack_timestamp('2026-11-20T04:12:00Z')='Nov 19, 2026 · 8:12 PM PST','Pacific date rollover and winter time');
 perform pg_temp.assert(foos_private.slack_timestamp('2026-07-10T19:05:00Z')='Jul 10, 2026 · 12:05 PM PDT','Pacific daylight saving time');
 -- Winning score while still live does not enqueue.
 goals:=pg_temp.goals('aaaaaaaaaa');
 perform public.foos_save_game_v2(gid,rid,start_at,null,0,goals,null);
 perform pg_temp.assert((select count(*)=0 from public.foos_slack_outbox),'keep playing does not notify');
 -- Final save replaces the goals before capturing the score, including own goals.
 goals:=pg_temp.goals('aab',2);
 rev:=public.foos_save_game_v2(gid,rid,start_at,clock_timestamp(),1,goals,null);
 select id,payload into jid,item from public.foos_slack_outbox where game_id=gid;
 perform pg_temp.assert(split_part(item->>'message',E'\n',1)='⚽ Final: Slack A &amp; Slack B 1–2 Slack C &amp; Slack &lt;@here&gt;','doubles latest goals, own goals and escaped names');
 perform pg_temp.assert(item->>'game_url'='https://foosball-score.vercel.app/game/'||gid,'canonical link');
 perform pg_temp.assert((select game_revision=2 from public.foos_slack_outbox where id=jid),'final revision captured');
 begin
  perform public.foos_save_game_v2(gid,rid,start_at,clock_timestamp(),1,goals,null);
  raise exception 'stale accepted';
 exception when others then if sqlerrm='stale accepted' then raise;end if;end;
 perform pg_temp.assert((select count(*)=1 from public.foos_slack_outbox),'stale finish no duplicate');
 rev:=public.foos_save_game_v2(gid,rid,start_at,clock_timestamp(),2,goals,null);
 perform pg_temp.assert((select count(*)=1 from public.foos_slack_outbox),'correction no duplicate');
 perform pg_temp.assert(split_part(item->>'message',E'\n',2)=(select foos_private.slack_timestamp(ended_at) from public.foos_games where id=gid),'timestamp uses finished game time');
 -- Claims serialize; wrong lease cannot dispatch; successful sends stay sent.
 item:=public.foos_slack_claim(); lease:=(item->>'claim_token')::uuid;
 perform pg_temp.assert((item->>'attempt_count')::int=1,'first attempt is one');
 perform pg_temp.assert(public.foos_slack_claim() is null,'concurrent worker has no item');
 perform pg_temp.assert(not public.foos_slack_begin(jid,gen_random_uuid()),'wrong lease rejected');
 perform pg_temp.assert(public.foos_slack_begin(jid,lease),'claimed dispatch starts');
 perform public.foos_slack_settle(jid,lease,'sent',null,60);
 perform pg_temp.assert(public.foos_slack_claim() is null,'processed item not reprocessed');
 perform public.foos_delete_game(gid,rev);
 perform public.foos_restore_game(gid,rev+1);
 perform pg_temp.assert((select status='sent' from public.foos_slack_outbox where id=jid),'restore leaves sent result alone');
 -- Legacy path: early draw; rematch creation cannot reannounce previous result.
 goals:=pg_temp.goals('ab');
 rev:=public.foos_save_game(other,singles,start_at,clock_timestamp(),0,goals);
 perform pg_temp.assert((select split_part(payload->>'message',E'\n',1)='⚽ Final: Slack A 1–1 Slack C (draw)' from public.foos_slack_outbox where game_id=other),'legacy early draw');
 perform public.foos_save_game(gen_random_uuid(),singles,start_at,null,0,'[]');
 perform pg_temp.assert((select count(*)=2 from public.foos_slack_outbox),'empty rematch no extra notification');
 -- Delete then restore before polling still skips forever.
 perform public.foos_delete_game(other,rev); perform public.foos_restore_game(other,rev+1);
 perform pg_temp.assert((select status='skipped' from public.foos_slack_outbox where game_id=other),'delete before delivery stays skipped after restore');
 -- Fresh queue for retry/lease/disable tests. No real network is involved.
 gid:=gen_random_uuid(); goals:=pg_temp.goals('aaa');
 perform public.foos_save_game_v2(gid,rid,start_at,clock_timestamp(),0,goals,null);
 update public.foos_slack_settings set last_dispatch_at=null;
 item:=public.foos_slack_claim(); jid:=(item->>'id')::uuid;lease:=(item->>'claim_token')::uuid;
 update public.foos_slack_settings set notifications_enabled=false;
 perform pg_temp.assert(not public.foos_slack_begin(jid,lease),'disable between claim/send honored');
 perform pg_temp.assert(public.foos_slack_claim() is null,'disabled worker idle');
 update public.foos_slack_settings set notifications_enabled=true;
 item:=public.foos_slack_claim();lease:=(item->>'claim_token')::uuid;
 perform public.foos_slack_begin(jid,lease); perform public.foos_slack_settle(jid,lease,'retry','slack_http_503',180);
 perform pg_temp.assert((select status='pending' and attempt_count=1 and next_attempt_at>clock_timestamp()+interval '170 seconds' from public.foos_slack_outbox where id=jid),'outage preserves result and schedules retry');
 perform pg_temp.assert((select ended_at is not null and revision=1 from public.foos_games where id=gid),'outage cannot undo game');
 update public.foos_slack_settings set last_dispatch_at=null;
 update public.foos_slack_outbox set next_attempt_at=clock_timestamp()-interval '1 second' where id=jid;
 item:=public.foos_slack_claim();lease:=(item->>'claim_token')::uuid;
 update public.foos_slack_outbox set claimed_until=clock_timestamp()-interval '1 second' where id=jid;
 item:=public.foos_slack_claim();
 perform pg_temp.assert((item->>'claim_token')::uuid<>lease,'expired unstarted claim safely recovered');
 lease:=(item->>'claim_token')::uuid;
 perform public.foos_slack_begin(jid,lease);
 update public.foos_slack_outbox set claimed_until=clock_timestamp()-interval '1 second' where id=jid;
 perform public.foos_slack_claim();
 perform pg_temp.assert((select status='uncertain' from public.foos_slack_outbox where id=jid),'expired sending lease quarantined');
 -- Validation failure rolls back the finalization and its job.
 other:=gen_random_uuid(); goals:=pg_temp.goals('a');
 perform public.foos_save_game_v2(other,rid,start_at,null,0,goals,null);
 select count(*) into n from public.foos_slack_outbox;
 begin
  perform public.foos_save_game_v2(other,rid,start_at,clock_timestamp(),1,jsonb_set(goals,'{0,rung}','"invalid"'),null);
  raise exception 'invalid accepted';
 exception when others then if sqlerrm='invalid accepted' then raise;end if;end;
 perform pg_temp.assert((select count(*)=n from public.foos_slack_outbox),'failed save no outbox');
 perform pg_temp.assert((select ended_at is null and slack_first_finalized_at is null and revision=1 from public.foos_games where id=other),'failed save rolls back game');
 -- Public clients can neither inspect configuration nor forge delivery status.
 perform pg_temp.assert(not has_table_privilege('anon','public.foos_slack_outbox','SELECT'),'anon queue unreadable');
 perform pg_temp.assert(not has_table_privilege('authenticated','public.foos_slack_settings','UPDATE'),'settings not publicly editable');
 perform pg_temp.assert(not has_function_privilege('anon','public.foos_slack_claim()','EXECUTE'),'claim backend only');
 perform pg_temp.assert(not has_function_privilege('authenticated','public.foos_slack_authorize(text)','EXECUTE'),'auth check backend only');
 perform pg_temp.assert(not has_schema_privilege('anon','foos_private','USAGE'),'internal helpers private');
end;$$;
rollback;
