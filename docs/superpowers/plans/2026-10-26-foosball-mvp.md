# Foosball MVP Implementation Plan

> Implement in this session; review scoring and storage boundaries before final handoff.

**Goal:** Build a working shared foosball tracker with local demo and Supabase setup.
**Architecture:** React screens consume a shared store backed by local storage or a Supabase repository. Pure scoring helpers derive all stats from event histories. Atomic SQL RPCs protect cloud writes with revisions.
**Tech stack:** React, TypeScript, Vite, Supabase JS, Vitest, Lucide icons.
**Spec:** ../specs/2026-10-26-foosball-design.md

## Global constraints
- Shared public edits, no login. First to 10, win by two, manual finish including draws.
- Capture timestamp on rung tap. Own goal credits opponent and records actor rung.
- Demo data stays local. Env URL prefilled; public key configured locally and on Vercel, local env ignored.

## Review focus
- Reload/resume never resets game start time.
- Lost-lead calculation includes every goal and excludes unfinished games.
- Concurrent edits fail visibly rather than overwriting newer data.
- Save errors leave forms and existing data available for retry.
- Mobile dialogs retain keyboard focus and fit small screens.

## Tasks
- [x] Add project configuration and scoring tests; run failing tests; implement types and pure stats; run suite.
- [x] Add demo seed, versioned local repository, cloud repository, transactional SQL, and env files. Test local persistence and conflict behavior.
- [x] Build home, rivalry, live scorer, and game detail; reusable dialog and stats components. User verifies localhost; no browser automation.
- [x] Run tests and production build; document Supabase SQL and Vercel setup and limits. Desktop/mobile visual testing remains with the user as requested.

## Verification notes
- 46 tests cover complete app flows, concurrency, pending dialogs, carousel controls, scoring, storage, mutations, distributions, Pacific time, design selection, startup, and interactive momentum. Startup reproduced destroy-is-not-a-function from Promise-returning scrollTo, then fixed effect return.
- Reviewer findings fixed: captured mutation revisions/undo target, modal stale close event guard, coherent SQL read RPC avoiding 1,000-row limits.
- User requests no Playwright; user performs localhost/browser QA.
- User authorized GitHub push, separate Vercel project, and new foos_* schema in BallKnowledge / josyao1 project only.

## UI refinements
- Ten selectable structural variants, shared data, black/white kits, bare score numbers.
- Clay combines rivalry and recent-game tickets with View stats links; uses Mono player-stat tables.
- Compact momentum chart with named directions and selectable goals; soccer-ball goal type icons.
- Pacific timestamps, per-player rung/type distributions, and confirmed revision-safe deletion.
- Muted IXL League mark in header.

## Selected design
User selected Clay for the shared app. The header picker is removed, old design query parameters are normalized away, and the other explorations remain in source for reference.

## Release
Audited release targets the user-requested `master` branch and the separate `foosball-score` Vercel project.
