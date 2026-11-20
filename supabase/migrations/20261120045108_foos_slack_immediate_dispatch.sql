-- pg_net queues requests in this transaction and only sends AFTER commit.
-- Only a new outbox insert wakes the sender; scoring/refreshes never do.
create function foos_private.wake_slack() returns bigint
language plpgsql security definer set search_path='' as $$
declare token text; request_id bigint;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='foos_slack_scheduler_token';
 if token is null then raise exception 'Slack scheduler authentication is not configured';end if;
 select net.http_post(
  url:='https://iqiffravpddrvpwqbrkm.supabase.co/functions/v1/foosball-slack-notify',
  headers:=jsonb_build_object('Content-Type','application/json','x-foos-scheduler-token',token),
  body:='{}'::jsonb,timeout_milliseconds:=30000
 ) into request_id;
 return request_id;
end;$$;
revoke all on function foos_private.wake_slack() from public,anon,authenticated,service_role;

create function foos_private.slack_wake_on_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending' and exists(select 1 from public.foos_slack_settings
   where notifications_enabled and (test_game_id is null or test_game_id=new.game_id)) then
  begin
   perform foos_private.wake_slack();
  exception when others then
   -- A failed wake-up must never undo a saved game or its durable queued job.
   -- Cron will pick it up later. No raw error text or credentials are logged.
   raise warning 'Slack wake-up unavailable; result remains queued for retry';
  end;
 end if;
 return null;
end;$$;
revoke all on function foos_private.slack_wake_on_insert() from public,anon,authenticated,service_role;
create trigger foos_slack_wake_on_insert after insert on public.foos_slack_outbox
 for each row execute function foos_private.slack_wake_on_insert();

create or replace function foos_private.slack_tick() returns bigint
language plpgsql security definer set search_path='' as $$
begin
 update public.foos_slack_outbox set status='uncertain',last_error='sender_lease_expired',claimed_until=null
  where status='sending' and claimed_until<=clock_timestamp();
 -- The minute fallback invokes nothing when disabled, idle, backing off, or
 -- already being handled by the immediate sender.
 if not exists(select 1 from public.foos_slack_settings where notifications_enabled
   and (last_dispatch_at is null or last_dispatch_at<=clock_timestamp()-interval '1 second')) then return null;end if;
 if exists(select 1 from public.foos_slack_outbox where status in ('claimed','sending') and claimed_until>clock_timestamp()) then return null;end if;
 if not exists(select 1 from public.foos_slack_outbox o cross join public.foos_slack_settings c
  where c.id and (c.test_game_id is null or o.game_id=c.test_game_id) and
   ((o.status='pending' and o.next_attempt_at<=clock_timestamp()) or
    (o.status='claimed' and o.claimed_until<=clock_timestamp()))) then return null;end if;
 return foos_private.wake_slack();
end;$$;

-- Retain the serialized claim/lease logic while allowing normal games to send
-- immediately. Bursts are limited to one dispatch per second, with cron backup.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.foos_slack_claim()'::regprocedure);
 if position('interval ''1 minute''' in definition)=0 then raise exception 'Unexpected Slack claim function';end if;
 execute replace(definition,'interval ''1 minute''','interval ''1 second''');
end;$$;
