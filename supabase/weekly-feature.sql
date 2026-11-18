-- Shared league configuration, matching the existing public league editor model.
-- Only the singleton can be read/updated; clients cannot create or delete settings.
begin;
create table public.foos_weekly_settings (
 id boolean primary key default true check (id),
 revision integer not null default 0 check(revision >= 0),
 enabled boolean not null default true,
 weekday integer not null default 5 check(weekday between 0 and 6),
 override_week date check(extract(isodow from override_week) = 1),
 rivalry_id uuid references public.foos_rivalries(id) on delete set null,
 game_id uuid references public.foos_games(id) on delete set null,
 check((rivalry_id is null and game_id is null) or override_week is not null)
);
insert into public.foos_weekly_settings(id) values(true);
alter table public.foos_weekly_settings enable row level security;
revoke all on public.foos_weekly_settings from public,anon,authenticated;
grant select on public.foos_weekly_settings to anon,authenticated;
grant update(revision,enabled,weekday,override_week,rivalry_id,game_id) on public.foos_weekly_settings to anon,authenticated;
create policy foos_weekly_read on public.foos_weekly_settings for select to anon,authenticated using(id);
create policy foos_weekly_edit on public.foos_weekly_settings for update to anon,authenticated using(id) with check(id);
create index foos_weekly_rivalry on public.foos_weekly_settings(rivalry_id);
create index foos_weekly_game on public.foos_weekly_settings(game_id);
commit;
