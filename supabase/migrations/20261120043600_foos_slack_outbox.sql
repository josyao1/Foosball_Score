-- Apply after all existing foosball upgrades. No Slack calls occur in a save.
create schema if not exists foos_private;
revoke all on schema foos_private from public,anon,authenticated;

create table public.foos_slack_settings (
 id boolean primary key default true check(id),
 notifications_enabled boolean not null default false,
 activation_timestamp timestamptz,
 test_game_id uuid,
 scheduler_token_hash text,
 last_dispatch_at timestamptz,
 check(not notifications_enabled or activation_timestamp is not null)
);
insert into public.foos_slack_settings(id) values(true);
create table public.foos_slack_outbox (
 id uuid primary key default gen_random_uuid(),
 -- Intentionally no cascading FK: keep delivery/deduplication history after purge.
 game_id uuid not null,
 game_revision integer not null,
 destination text not null default 'slack_foosball' check(destination='slack_foosball'),
 payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','claimed','sending','sent','skipped','failed','uncertain')),
 attempt_count integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 claimed_until timestamptz,
 claim_token uuid,
 sent_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 unique(game_id,destination)
);
create index foos_slack_ready on public.foos_slack_outbox(next_attempt_at,created_at) where status='pending';
alter table public.foos_slack_settings enable row level security;
alter table public.foos_slack_outbox enable row level security;
revoke all on public.foos_slack_settings,public.foos_slack_outbox from public,anon,authenticated;
grant select,update on public.foos_slack_settings,public.foos_slack_outbox to service_role;

alter table public.foos_games add column slack_first_finalized_at timestamptz;
-- Mark historical results seen without creating jobs, including archived games.
update public.foos_games set slack_first_finalized_at=ended_at where ended_at is not null;

create function foos_private.slack_text(p_text text) returns text
language sql immutable set search_path='' as $$
 select replace(replace(replace(regexp_replace(p_text,E'[\n\r\t]+',' ','g'),'&','&amp;'),'<','&lt;'),'>','&gt;');
$$;
create function foos_private.enqueue_slack(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare g public.foos_games%rowtype; r public.foos_rivalries%rowtype; c public.foos_slack_settings%rowtype;
 sa integer; sb integer; label_a text; label_b text; finalized timestamptz:=clock_timestamp();
begin
 select * into g from public.foos_games where id=p_id;
 if g.ended_at is null or g.slack_first_finalized_at is not null then return;end if;
 update public.foos_games set slack_first_finalized_at=finalized where id=p_id;
 select * into c from public.foos_slack_settings where id;
 if not c.notifications_enabled or finalized<c.activation_timestamp or g.ended_at<c.activation_timestamp or
   (c.test_game_id is not null and c.test_game_id<>p_id) then return;end if;
 select * into r from public.foos_rivalries where id=g.rivalry_id;
 if g.deleted_at is not null or r.deleted_at is not null then return;end if;
 select count(*) filter(where credited='a'),count(*) filter(where credited='b') into sa,sb
 from (select case when 'own_goal'=any(flags) then case actor_side when 'a' then 'b' else 'a' end else actor_side end credited
       from public.foos_goals where game_id=p_id) scores;
 select string_agg(p.name,' & ' order by m.position) into label_a from public.foos_rivalry_members m join public.foos_players p on p.id=m.player_id where m.rivalry_id=g.rivalry_id and m.side='a';
 select string_agg(p.name,' & ' order by m.position) into label_b from public.foos_rivalry_members m join public.foos_players p on p.id=m.player_id where m.rivalry_id=g.rivalry_id and m.side='b';
 insert into public.foos_slack_outbox(game_id,game_revision,payload) values(p_id,g.revision,jsonb_build_object(
  'message',format('⚽ Final: %s %s–%s %s%s',foos_private.slack_text(coalesce(label_a,r.player_a)),sa,sb,foos_private.slack_text(coalesce(label_b,r.player_b)),case when sa=sb then ' (draw)' else '' end),
  'game_url','https://foosball-score.vercel.app/game/'||p_id::text
 )) on conflict(game_id,destination) do nothing;
end;$$;
revoke all on all functions in schema foos_private from public,anon,authenticated;

-- Preserve deployed validation/revision logic verbatim and add exactly one hook
-- after replacement goals, at the single successful return. Fail closed if the
-- expected save structure changes instead of silently patching the wrong point.
do $$
declare signature text; definition text;
begin
 foreach signature in array array[
  'public.foos_save_game(uuid,uuid,timestamptz,timestamptz,integer,jsonb)',
  'public.foos_save_game_v2(uuid,uuid,timestamptz,timestamptz,integer,jsonb,jsonb)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if (length(definition)-length(replace(definition,'return v_revision;','')))/length('return v_revision;')<>1
   or position('delete from public.foos_goals' in definition)=0 then
   raise exception 'Unexpected save function shape: %',signature;
  end if;
  execute replace(definition,'return v_revision;','perform foos_private.enqueue_slack(p_id); return v_revision;');
 end loop;
end;$$;

create function public.foos_slack_authorize(p_token text) returns boolean
language sql security definer set search_path='' as $$
 select coalesce(length(p_token)=64 and scheduler_token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex'),false)
 from public.foos_slack_settings where id;
$$;

create function public.foos_slack_claim() returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.foos_slack_settings%rowtype; job public.foos_slack_outbox%rowtype;
begin
 -- Singleton row serializes claims and enforces a global one-minute dispatch rate.
 select * into c from public.foos_slack_settings where id for update;
 update public.foos_slack_outbox set status='uncertain',last_error='sender_lease_expired',claimed_until=null
  where status='sending' and claimed_until<=clock_timestamp();
 update public.foos_slack_outbox set status='pending',claim_token=null,claimed_until=null
  where status='claimed' and claimed_until<=clock_timestamp();
 update public.foos_slack_outbox o set status='skipped',last_error='game_removed_or_unfinished',claim_token=null,claimed_until=null
  where o.status in ('pending','claimed') and not exists(
   select 1 from public.foos_games g join public.foos_rivalries r on r.id=g.rivalry_id
   where g.id=o.game_id and g.deleted_at is null and r.deleted_at is null and g.ended_at is not null);
 if not c.notifications_enabled or c.last_dispatch_at>clock_timestamp()-interval '1 minute'
  or exists(select 1 from public.foos_slack_outbox where status in ('claimed','sending')) then return null;end if;
 select * into job from public.foos_slack_outbox where status='pending' and next_attempt_at<=clock_timestamp()
  and (c.test_game_id is null or game_id=c.test_game_id) order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update public.foos_slack_outbox set status='claimed',claim_token=gen_random_uuid(),claimed_until=clock_timestamp()+interval '2 minutes'
  where id=job.id returning * into job;
 return to_jsonb(job)||jsonb_build_object('attempt_count',job.attempt_count+1);
end;$$;

create function public.foos_slack_begin(p_id uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare c public.foos_slack_settings%rowtype; job public.foos_slack_outbox%rowtype;
begin
 select * into c from public.foos_slack_settings where id for update;
 select * into job from public.foos_slack_outbox where id=p_id for update;
 if job.id is null or job.status<>'claimed' or job.claim_token is distinct from p_token or job.claimed_until<=clock_timestamp() then return false;end if;
 if not c.notifications_enabled or (c.test_game_id is not null and c.test_game_id<>job.game_id) then
  update public.foos_slack_outbox set status='pending',claim_token=null,claimed_until=null where id=p_id;
  return false;
 end if;
 if not exists(select 1 from public.foos_games g join public.foos_rivalries r on r.id=g.rivalry_id
  where g.id=job.game_id and g.deleted_at is null and r.deleted_at is null and g.ended_at is not null) then
  update public.foos_slack_outbox set status='skipped',last_error='game_removed_or_unfinished',claim_token=null,claimed_until=null where id=p_id;
  return false;
 end if;
 update public.foos_slack_outbox set status='sending',attempt_count=attempt_count+1,claimed_until=clock_timestamp()+interval '2 minutes' where id=p_id;
 update public.foos_slack_settings set last_dispatch_at=clock_timestamp() where id;
 return true;
end;$$;

create function public.foos_slack_settle(p_id uuid,p_token uuid,p_outcome text,p_error text,p_delay integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_outcome not in ('sent','retry','failed','uncertain') or p_outcome is null then raise exception 'Invalid outcome';end if;
 update public.foos_slack_outbox set
  status=case when p_outcome='retry' then 'pending' else p_outcome end,
  sent_at=case when p_outcome='sent' then clock_timestamp() else null end,
  next_attempt_at=clock_timestamp()+make_interval(secs=>greatest(60,least(coalesce(p_delay,60),86400))),
  claimed_until=null,claim_token=null,last_error=left(p_error,100)
 where id=p_id and claim_token=p_token and status='sending' and claimed_until>clock_timestamp();
 if not found then raise exception 'Delivery lease no longer owned';end if;
end;$$;
revoke all on function public.foos_slack_authorize(text),public.foos_slack_claim(),public.foos_slack_begin(uuid,uuid),public.foos_slack_settle(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.foos_slack_authorize(text),public.foos_slack_claim(),public.foos_slack_begin(uuid,uuid),public.foos_slack_settle(uuid,uuid,text,text,integer) to service_role;

-- Cancel queued results at deletion time even if the game/rivalry is restored
-- before the next worker run. In-flight requests cannot be recalled.
create function foos_private.cancel_slack() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or new.deleted_at is not null then
  if tg_table_name='foos_games' then
   update public.foos_slack_outbox set status='skipped',last_error='game_removed',claimed_until=null,claim_token=null
    where game_id=old.id and status in ('pending','claimed');
  else
   update public.foos_slack_outbox set status='skipped',last_error='rivalry_removed',claimed_until=null,claim_token=null
    where game_id in(select id from public.foos_games where rivalry_id=old.id) and status in ('pending','claimed');
  end if;
 end if;
 return null;
end;$$;
revoke all on function foos_private.cancel_slack() from public,anon,authenticated;
create trigger foos_slack_game_removed after update of deleted_at or delete on public.foos_games
 for each row execute function foos_private.cancel_slack();
create trigger foos_slack_rivalry_removed after update of deleted_at or delete on public.foos_rivalries
 for each row execute function foos_private.cancel_slack();
