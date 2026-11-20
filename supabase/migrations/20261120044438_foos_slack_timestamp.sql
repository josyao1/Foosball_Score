-- Show the game finish time, not the later retry/delivery time.
create function foos_private.slack_timestamp(p_time timestamptz) returns text
language sql stable set search_path='' set timezone='America/Los_Angeles' as $$
 select to_char(p_time,'Mon FMDD, YYYY · FMHH12:MI AM TZ');
$$;
revoke all on function foos_private.slack_timestamp(timestamptz) from public,anon,authenticated;

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
  'message',format('⚽ Final: %s %s–%s %s%s',foos_private.slack_text(coalesce(label_a,r.player_a)),sa,sb,foos_private.slack_text(coalesce(label_b,r.player_b)),case when sa=sb then ' (draw)' else '' end)||E'\n'||foos_private.slack_timestamp(g.ended_at),
  'game_url','https://foosball-score.vercel.app/game/'||p_id::text
 )) on conflict(game_id,destination) do nothing;
end;$$;
