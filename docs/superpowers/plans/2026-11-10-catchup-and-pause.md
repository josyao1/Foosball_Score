# Catch-up feed and live scoring polish

Implement the user's requested batch in the existing Clay design. No browser testing or deployment in this batch.

- Remove every entry link to /backlog, keep the manually addressable route and restore protection. Archived duplicate warning may mention the URL without linking.
- Add a compact five-result list between the complete rivalry collection and recent achievements. Finished, active games only; newest finish first, across all players. Each row links to its game and shows both sides, score, Pacific time and actual playing time. Keep the existing cream/brown palette, serif section heading, quiet date rail, winning score emphasis; wrap long names rather than clipping essential results.
- Show only first unlocks inside score tickets; retain all awards in below-ticket pills.
- Replace fullscreen side flip with team-specific swap controls that exchange defense/attack assignments. Preserve goal snapshots, record swap time on active game clock, distinguish Black/White plus team names.
- Add persisted pause/resume with paused_at and accumulated paused_ms. Dedicated revision-checked RPC locks parent then game; paused games cannot be scored/finished/edited until resumed. Shared clock and new goal/swap timestamps exclude pauses; real started_at/occurred_at remain untouched. Restore through backlog preserves pause state.
- Test pause cycles/reload/stale writes/archived records and SQL privileges, first vs repeat unlock, unfiltered five results and fullscreen team attribution. Run full tests/build and code review responsive CSS. Apply tested additive foos-only SQL to authorized Supabase project; no real game mutations.

Completed locally. Recent-games typography matches the achievement feed at desktop and phone breakpoints. All 306 tests across 44 files pass; production build passes (existing bundle-size advisory remains). Pause and backlog SQL regression scripts pass against isolated PostgreSQL. The pause migration is applied to the authorized Supabase project; original-data and unrelated-schema hashes match before/after (60 games, 985 goals, 13 rivalries). No production frontend deployment or browser testing performed.

Release verification (November 10, 2026): full expanded batch passes all 314 tests across 45 files, production build, and whitespace checks. Both foos_recoverable_backlog and foos_pause_live_games confirmed installed before the frontend release. Browser testing remains with the user.
