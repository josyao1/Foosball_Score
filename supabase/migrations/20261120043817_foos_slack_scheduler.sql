-- Hosted Supabase only; requires pg_cron and Vault. Delivery remains disabled.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

do $$
declare token text;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='foos_slack_scheduler_token';
 if token is null then
  token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  perform vault.create_secret(token,'foos_slack_scheduler_token','Private authentication for the foosball Slack sender');
 end if;
 update public.foos_slack_settings set scheduler_token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') where id;
end;$$;

create function foos_private.slack_tick() returns bigint
language plpgsql security definer set search_path='' as $$
declare token text; request_id bigint;
begin
 -- Clean expired leases even when disabled, but do not invoke/send while disabled.
 update public.foos_slack_outbox set status='uncertain',last_error='sender_lease_expired',claimed_until=null
  where status='sending' and claimed_until<=clock_timestamp();
 if not exists(select 1 from public.foos_slack_settings where notifications_enabled) then return null;end if;
 if not exists(select 1 from public.foos_slack_outbox where status in ('pending','claimed') and next_attempt_at<=clock_timestamp()) then return null;end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='foos_slack_scheduler_token';
 if token is null then raise exception 'Slack scheduler authentication is not configured';end if;
 select net.http_post(
  url:='https://iqiffravpddrvpwqbrkm.supabase.co/functions/v1/foosball-slack-notify',
  headers:=jsonb_build_object('Content-Type','application/json','x-foos-scheduler-token',token),
  body:='{}'::jsonb,timeout_milliseconds:=30000
 ) into request_id;
 return request_id;
end;$$;
revoke all on function foos_private.slack_tick() from public,anon,authenticated,service_role;
select cron.schedule('foosball-slack-notify','* * * * *','select foos_private.slack_tick();');
