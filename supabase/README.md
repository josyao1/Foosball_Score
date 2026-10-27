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
