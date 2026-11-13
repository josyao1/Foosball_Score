# Supabase setup

Open your existing Supabase project's SQL editor and run all of `schema.sql` as the default `postgres` role. The script is transactional and can be run repeatedly without deleting records. It creates only prefixed `foos_*` tables, indexes, policies and functions; it does not change other apps' tables or global default privileges. Re-running is for this schema version, not an automatic migration of differently shaped pre-existing tables.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the app's environment (and Vercel project settings). Use the project's public anon key, never the service-role key. Restart the dev server or rebuild after changing Vite environment variables. With no credentials the app uses a separate browser-local demo.

## Shared public access

There is intentionally no login or per-person ownership. Anyone with the public project credentials can read all foosball records, create rivalries, save or edit any game, and delete games or whole rivalries. Sharing the app URL shares these capabilities. RLS permits public reads and rivalry inserts; direct game/goal writes and direct rivalry deletion are denied. The explicitly granted `SECURITY DEFINER` write functions perform changes atomically with an empty fixed search path and fully qualified table references. These checks preserve data integrity; they do not establish user identity or prevent a visitor from intentionally changing another person's match.

Names must be trimmed, 1–40 characters, and different ignoring case. The unordered, case-insensitive pair is unique. A partial unique index allows at most one unfinished game per rivalry. Scores and statistics are derived from goal rows.

## RPC contract

`foos_save_game(p_id uuid, p_rivalry_id uuid, p_started_at timestamptz, p_ended_at timestamptz, p_expected_revision integer, p_goals jsonb)` returns the new integer revision.

- Generate the game UUID in the client. A new game uses expected revision `0` and returns `1`.
- For subsequent saves, send the last fetched revision; success increments it. Save the returned revision in client state.
- Send the original rivalry and start time on every save. Changing them is rejected.
- Send the entire replacement goal array. Every goal has exactly `id`, `actor_side`, `rung`, `flags`, `elapsed_ms`, and `occurred_at`; do not send `game_id`. IDs are UUIDs and must be unique across games.
- `actor_side` is `a` or `b`; `rung` is `goalie`, `defender`, `middle`, or `attacker`. Flags are unique entries from `dunk`, `bank`, `own_goal`; `own_goal` must occur alone. An own goal's actor remains the player who made the shot; the app credits the other player.
- Elapsed time is a nonnegative integer number of milliseconds. Timestamps must be finite; every goal occurs at or after the start. A completed game's end is at or after its start, each goal is at or before its end, and elapsed milliseconds cannot exceed its duration.
- An unfinished game uses `p_ended_at: null` and may have no goals. Finishing an empty game is rejected. Completed histories may be corrected or shortened but must retain at least one goal.
- Metadata, revision, deletion of previous goals, and insertion of replacement goals happen in one database transaction. Invalid inputs, duplicate IDs, foreign-key failures, or another active game roll back the whole save.

Example Supabase JS call:

```ts
const { data: revision, error } = await supabase.rpc('foos_save_game', {
  p_id: game.id,
  p_rivalry_id: game.rivalry_id,
  p_started_at: game.started_at,
  p_ended_at: game.ended_at,
  p_expected_revision: game.revision, // 0 for a newly created client draft
  p_goals: game.goals,
});
```

`foos_discard_game(p_id uuid, p_expected_revision integer)` returns void. It locks and revision-checks the game, rejects completed games, and removes an unfinished game with its goals in one transaction.

`foos_delete_game(p_id uuid, p_expected_revision integer)` returns void. It accepts either an unfinished or completed game, locks and checks its revision, then deletes that game and its goals. The rivalry and its other games remain. Send the revision shown when the player confirmed deletion. Missing games or changed revisions produce the same game-conflict error as saving.

`foos_delete_rivalry(p_id uuid, p_expected_games jsonb)` returns void. Send an object mapping **every** game UUID belonging to the rivalry to its revision at confirmation time, for example `{ "00000000-0000-0000-0000-000000000011": 2 }`; use `{}` for a rivalry with no games. Keys must be canonical lowercase UUIDs, and revisions positive integers. The function locks the rivalry, locks its games in UUID order, and compares the full current ID/revision map to the supplied object. Any added, removed, or edited game rejects deletion with `This rivalry changed on another device. Refresh and try again.` A missing rivalry is also rejected. On success it deletes only that rivalry's games and cascading goals, then the rivalry, in one transaction. Refetch and obtain a new confirmation after a conflict; never silently substitute a refreshed revision map.

For an existing installation, `migrations/20261026_foos_delete_actions.sql` contains only the two new deletion functions and their grants. Apply it through the migration runner's transaction. The complete `schema.sql` also includes them. No existing records are removed when installing either script; deletion occurs only when a client explicitly calls a deletion RPC.

A stale save/discard raises `This game changed on another device. Refresh and try again.` Refetch before retrying and let the player reconcile their intended change. Do not automatically retry an old goal list with the new revision. Concurrent initial creation can instead fail with a unique-constraint error; refetch the rivalry's active game and resume it.

Read the full app state with `supabase.rpc('foos_load_state')`. This parameterless read-only function returns one JSON object `{ rivalries: [...], games: [...] }`, with each game's complete `goals` array and empty arrays when no records exist. Goals contain exactly the six client fields (no `game_id`). Rivalries are ordered by `created_at, id`, games by `started_at, id`, and goals by `elapsed_ms, occurred_at, id`, all ascending. Its single SQL statement reads one coherent snapshot, and the scalar JSON result avoids PostgREST's per-table row cap. It is `STABLE`, runs as the caller (`SECURITY INVOKER`), and respects the existing read grants and RLS. Only `anon` and `authenticated` receive explicit execute grants; `PUBLIC` execution is revoked. Polling and refresh-on-focus can update other devices without enabling Realtime.

## Validation

The schema was applied twice successfully to an isolated local PostgreSQL database. Transactional SQL checks exercised anon/authenticated access, direct-write denial, duplicate pairing and active-game rejection, stale revisions, immutable start times, empty completion, valid special shots, invalid goal fields/timestamps/flags, duplicate goal IDs, rollback of both goals and metadata, completed-history correction, and discard cascading. The temporary server was stopped after testing. The schema and deletion migration are also applied to `josyao1’s Project` (`iqiffravpddrvpwqbrkm`) in BallKnowledge. The public API read path was verified after configuration. Existing unrelated table identities, columns, and RLS settings were checked before/after and remained unchanged.

Deletion RPC checks also passed locally for completed-game deletion, empty-rivalry deletion, malformed arguments, missing records, stale revisions, added/removed games in the confirmation map, denied direct table deletes, both public client roles, and targeted cascading that preserves other rivalries. A trigger injected a failure into the final rivalry deletion to verify that earlier game and goal deletions roll back atomically. The complete save/read regression checks passed after adding the deletion functions.

## Recoverable deletion (/backlog)

Apply **`backlog.sql`**, after `schema.sql`, `individual-players.sql`, and `swap-timing.sql`, followed by **`pause-games.sql`**. Reapplying an older setup file afterward would replace the current RPCs; reapply these migrations afterward if necessary. Installation adds nullable `deleted_at` fields and replaces only foosball functions/indexes. No existing games, goals, positions, players, or roster rows are rewritten or removed. The legacy deletion contracts above describe the base schema; the following contracts supersede them.

- `foos_delete_game` moves a **finished** game to the backlog. `foos_discard_game` still permanently discards an unfinished game, as requested.
- `foos_delete_rivalry` marks the rivalry removed; every attached game/goal/roster stays in place. Games previously deleted separately keep their own deletion markers. The expected revision map includes only currently active games.
- `foos_load_state` returns only active rivalries and active games belonging to active rivalries. Every normal app calculation uses that state. Old clients also receive this filtered state.
- `foos_load_backlog` returns removed rivalries, their games, plus individually removed games with their parent labels and rosters. The route is publicly editable like the rest of the app, not an admin authorization boundary.
- `foos_restore_game` / `foos_purge_game` require the game's current revision and an active parent. `foos_restore_rivalry` / `foos_purge_rivalry` require its exact deletion timestamp and the revision map of **all** children, including separately removed ones.
- Restores preserve original IDs, start/end times, goals, flags, lineups, and swap timestamps. They change only deletion markers/revisions. Stats, achievements and rankings are derived afresh; there is no aggregate counter to repair. An unfinished game bundled in a restored rivalry keeps its original start time.
- A restored rivalry leaves individually removed games in the backlog. Restore the parent first to manage those games. Permanent rivalry purge explicitly includes every child, including previously removed games, and keeps shared player profiles.
- Both save-RPC versions reject archived targets. All game/rivalry mutations lock the parent before children and use optimistic revisions/snapshots. Archive and restore increment child revisions so stale scoring screens cannot overwrite restored history. A live-slot conflict rejects restoration without changing either game.
- Roster uniqueness remains global (including archived rivalries) to avoid duplicate histories. Creating a reversed/reordered archived matchup directs the new UI to restore it from `/backlog`.
- Direct table writes/deletes remain restricted. New functions follow the existing explicitly public editing contract with fixed empty search paths and fully qualified objects. Internal lock helpers are not callable by `anon` or `authenticated`.

`backlog-check.sql` exercises archive/restore, full original-content equality, swap snapshots, previous deletions, invalid/stale mutations, live discard, orphan prevention, duplicate rosters, unrelated data, cascade purge, and rollback after an injected purge failure. Run on a disposable database after applying setup files; it creates only rollback-scoped fixtures. App tests cover local persistence, derived stat round-trips, duplicate navigation and confirmation flows.

There are no navigation links to the backlog. Open it by typing `/backlog` after the site URL.

## Pause and resume

`pause-games.sql` adds `paused_at` and accumulated `paused_ms` to games, plus `foos_set_game_paused(p_id, p_expected_revision, p_paused)`. The function locks the active parent before its game, checks the revision, and returns the complete updated game. Only unfinished, active games can pause or resume. Both save-RPC versions reject edits while paused; archive/restore retain the paused state and accumulated time. Public access remains the same as the rest of the app.

Displayed duration, new goals' elapsed times and position-swap times exclude pauses. Real start/end/event timestamps remain unchanged. `pause-games-check.sql` tests both save versions, revisions, accumulated time, public privileges, parent archive/restore, and finished-game protection with rollback-only fixtures.

## Player settings

Apply `player-settings.sql` after the existing upgrades above. `/backlog?tab=players` edits a player's name, jersey lettering, shirt/trim/letter colors, and subtitle. The route remains absent from main navigation. Customization lives in `foos_players.appearance`; null uses the existing name-based preset. Saving stores the complete resolved appearance so subsequent renames retain the same jersey and subtitle.

`foos_update_player` checks `settings_revision`, validates the name and appearance, and updates display labels in active and archived rivalries without changing any player IDs, membership IDs, games, goals, or attribution snapshots. Rivalry JSON also derives labels directly from memberships to cover concurrent rivalry creation. Duplicate names are rejected case-insensitively; stale edits must be reopened before retrying. There is no player deletion or identity merge in this editor.

The function intentionally permits anonymous execution, matching the site's shared editing model. Direct UPDATE remains unavailable to public clients; the function uses an empty search path and qualified objects. Supabase's public SECURITY DEFINER advisory is expected for this explicitly shared mutation, as for the other scoring RPCs. Other application tables are untouched.
