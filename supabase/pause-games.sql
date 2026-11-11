-- Apply after backlog.sql. Only foos_* objects are affected.
begin;
alter table public.foos_games add column if not exists paused_at timestamptz;
alter table public.foos_games add column if not exists paused_ms bigint not null default 0 check (paused_ms >= 0);

-- Covers both current and legacy save RPCs without changing their contracts.
-- Archive/restore updates only revision/deleted_at and still works while paused.
create or replace function public.foos_guard_paused_game() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.paused_at is not null then
  raise exception 'Game is paused. Resume before editing or scoring.';
 end if;
 return new;
end;
$$;
revoke all on function public.foos_guard_paused_game() from public,anon,authenticated;
drop trigger if exists foos_guard_paused_game on public.foos_games;
create trigger foos_guard_paused_game before update of ended_at,lineup on public.foos_games
 for each row execute function public.foos_guard_paused_game();

-- Public editing is intentional for this friends-only shared scorekeeper, matching
-- the existing revision-guarded mutation RPCs. No direct table writes are granted.
create or replace function public.foos_set_game_paused(p_id uuid,p_expected_revision integer,p_paused boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_parent uuid;
 v_game public.foos_games%rowtype;
 v_now timestamptz;
begin
 if p_paused is null then raise exception 'Choose pause or resume.'; end if;
 select rivalry_id into v_parent from public.foos_games where id=p_id;
 perform public.foos_lock_active_rivalry(v_parent);
 select * into v_game from public.foos_games where id=p_id for update;
 if not found or v_game.revision is distinct from p_expected_revision then
  raise exception 'This game changed. Refresh and try again.';
 end if;
 if v_game.deleted_at is not null then raise exception 'This game is in the backlog.'; end if;
 if v_game.ended_at is not null then raise exception 'Finished games cannot be paused.'; end if;
 if (v_game.paused_at is not null) is distinct from p_paused then
  v_now:=greatest(clock_timestamp(),v_game.started_at,(select max(occurred_at) from public.foos_goals where game_id=p_id));
  update public.foos_games set
   paused_at=case when p_paused then v_now else null end,
   paused_ms=paused_ms+case when not p_paused then greatest(0,floor(extract(epoch from(v_now-v_game.paused_at))*1000))::bigint else 0 end,
   revision=revision+1
  where id=p_id returning * into v_game;
 end if;
 return to_jsonb(v_game)||jsonb_build_object('goals',(
  select coalesce(jsonb_agg(to_jsonb(g)-'game_id' order by elapsed_ms,occurred_at,id),'[]')
  from public.foos_goals g where g.game_id=p_id));
end;
$$;
revoke all on function public.foos_set_game_paused(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.foos_set_game_paused(uuid,integer,boolean) to anon,authenticated;
commit;
