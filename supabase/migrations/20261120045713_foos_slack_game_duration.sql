-- Match the app's M:SS result clock, excluding pauses and flooring seconds.
create function foos_private.slack_duration(p_started timestamptz,p_ended timestamptz,p_paused_ms bigint) returns text
language sql immutable set search_path='' as $$
 select (seconds/60)::text||':'||lpad((seconds%60)::text,2,'0') from (
  select floor(greatest(0,extract(epoch from(p_ended-p_started))-coalesce(p_paused_ms,0)/1000.0))::bigint seconds
 ) elapsed;
$$;
revoke all on function foos_private.slack_duration(timestamptz,timestamptz,bigint) from public,anon,authenticated;

create or replace function foos_private.enqueue_slack(p_id uuid) returns void
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
  'message',format('⚽ Final: %s %s–%s %s%s',foos_private.slack_text(coalesce(label_a,r.player_a)),sa,sb,foos_private.slack_text(coalesce(label_b,r.player_b)),case when sa=sb then ' (draw)' else '' end)||' · '||foos_private.slack_duration(g.started_at,g.ended_at,g.paused_ms),
  'game_url','https://foosball-score.vercel.app/game/'||p_id::text
 )) on conflict(game_id,destination) do nothing;
end;$$;
