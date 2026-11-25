begin;
alter table public.foos_slack_outbox
 add column story_snapshot jsonb,
 add column story_prepared boolean not null default false;

-- Only new jobs get snapshots. Older queued jobs keep their original text.
-- Runs within the first-finalization transaction, before the existing wake trigger.
create function foos_private.slack_snapshot_on_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 select jsonb_build_object('game',to_jsonb(g)||jsonb_build_object('goals',(
   select coalesce(jsonb_agg(to_jsonb(goal)-'game_id' order by goal.elapsed_ms,goal.occurred_at,goal.id),'[]'::jsonb)
   from public.foos_goals goal where goal.game_id=g.id
  )), 'rivalry',public.foos_rivalry_json(g.rivalry_id)) into new.story_snapshot
 from public.foos_games g where g.id=new.game_id;
 return new;
end;$$;
revoke all on function foos_private.slack_snapshot_on_insert() from public,anon,authenticated,service_role;
create trigger foos_slack_snapshot_on_insert before insert on public.foos_slack_outbox
 for each row execute function foos_private.slack_snapshot_on_insert();

-- Read rankings immediately before message preparation, only for a valid lease.
create function public.foos_slack_story_context(p_id uuid,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.foos_slack_outbox where id=p_id and status='claimed'
  and claim_token=p_token and claimed_until>clock_timestamp() and story_snapshot is not null and not story_prepared) then return null;end if;
 return public.foos_load_state();
end;$$;

-- Freeze the composed message once, so explicit HTTP retries do not change stories.
-- The original sending transition still checks settings, deletion and lease ownership.
create function public.foos_slack_prepare(p_id uuid,p_token uuid,p_message text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.foos_slack_outbox%rowtype; base text;
begin
 select * into job from public.foos_slack_outbox where id=p_id for update;
 if job.id is null or job.status<>'claimed' or job.claim_token is distinct from p_token or job.claimed_until<=clock_timestamp() then return null;end if;
 if job.story_prepared or job.story_snapshot is null then return to_jsonb(job)||jsonb_build_object('attempt_count',job.attempt_count+1);end if;
 base:=job.payload->>'message';
 if p_message is null or char_length(p_message)>1800 or
  (p_message<>base and left(p_message,char_length(base)+1)<>base||E'\n') then raise exception 'Invalid prepared message';end if;
 update public.foos_slack_outbox set payload=jsonb_set(payload,'{message}',to_jsonb(p_message)),story_prepared=true
 where id=p_id returning * into job;
 return to_jsonb(job)||jsonb_build_object('attempt_count',job.attempt_count+1);
end;$$;
revoke all on function public.foos_slack_story_context(uuid,uuid),public.foos_slack_prepare(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.foos_slack_story_context(uuid,uuid),public.foos_slack_prepare(uuid,uuid,text) to service_role;
commit;
