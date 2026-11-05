# Individual players Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Individual player identities accumulate stats across singles and teams.
**Architecture:** Additive registry/membership and per-goal attribution; shared helpers for all aggregate views. Original rivalry and game data preserved.
**Tech Stack:** React, TypeScript, Supabase Postgres, Vitest.
**Spec:** docs/superpowers/specs/2026-11-04-individual-players-design.md

## Global constraints
- No browser/Playwright; no unrelated database changes or seed data.
- Preserve game IDs, scores, timestamps and rivalry labels.
- Historical half credits floor after accumulation; achievements and results shared.
- Goalie/defender defense; middle/attacker attack. Swaps not retroactive.

## Review focus
- Concurrent swaps/saves reject stale revision.
- Goal corrections preserve historical positions, own goals attributed to actor.
- Two players cannot appear on both sides; reversed/reordered roster is same rivalry.
- Legacy odd counts, identities across mixed teams, blank profiles survive no games.
- Mobile rosters/position labels and fixed badge order remain compact.

### Task 1: Identity and attribution model
- [x] Tests for legacy split, memberships, sorting, positional snapshots and roster validation.
- [x] Add Player/Lineup types and src/lib/participants.ts; normalize local legacy data.
- [x] Add registry/membership SQL, v2 save RPC, compatibility API, transactional validation.

### Task 2: Individual aggregation
- [x] Tests for odd historical totals, own goals, individual all-rung mastery, shared wins/achievements, individual streaks and Scorigami.
- [x] Update players.ts, achievements.ts, scorigami.ts, profile.ts, mastery.ts.

### Task 3: Profile-first creation and in-game positions
- [x] Test profile creation, team selection, swap attribution and editor correction.
- [x] Update repositories/store, Players, Home, ProfilePicker, Game and GoalDialog.
- [x] Fixed achievement order, remove search; shared IDs and recency ordering.

### Task 4: Verify and local preview
- [x] Full tests and build; independent review of data and responsive code.
- [x] Apply additive migration to intended project, verify counts and rollback-only RPC probes.
- [x] Start localhost 5174 for user review; document migration/behavior.

## Verification and handoff

- Migration `individual_players_and_team_positions` applied to `iqiffravpddrvpwqbrkm` after rollback-only SQL checks as anon. 4 rivalries, 31 games and 526 goals preserved; 3 individual player identities. Test fixtures rolled back.
- Independent code review found and verified fixes for new-game lineup initialization, personal streak labels, and roster-vs-display-name identity.
- Public editing RPC advisor warnings intentionally match the friends-only access model; new tables have RLS/policies.
- Full Vitest suite and TypeScript/Vite build pass; no browser automation. Existing bundle-size advisory remains.
- Local preview on port 5174; production frontend not pushed in this iteration.
