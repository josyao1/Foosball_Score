# Scouting Notes Implementation Plan

> **For agentic workers:** Execute in the current session with superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Show a supported, interesting scouting note for every scoring player.
**Architecture:** Pure candidate calculation and stable selection; a storage-backed React hook remembers IDs only. One reusable note/dialog component lives in each passport Overview.
**Tech Stack:** Existing React, TypeScript, CSS, Vitest and Dialog.
**Spec:** docs/superpowers/specs/2026-11-11-scouting-notes.md

## Constraints and review focus
- No schema writes, seeds, browser testing, dependency changes or deployment.
- Archived parents/children and live games must not supply evidence.
- Own goals and swapped team positions must retain correct personal attribution.
- Sparse, unknown-attribution and zero-game histories must not imply reliable trends.
- Selection must update claims on edits, survive unavailable storage and avoid unnecessary churn.
- Phone text, dialog and supporting-game rows must wrap without overflowing.

## Tasks
- [x] Add failing pure-function tests for attribution, team thresholds, rematch timing, selection hysteresis and archive updates.
- [x] Implement src/lib/scouting.ts with candidates and deterministic selection, then run tests.
- [x] Add src/components/ScoutingNote.tsx and responsive CSS; integrate via memoized computation in Players.tsx. Add dialog/overview regression test.
- [x] Run relevant tests and build, inspect diff, confirm localhost serves the updated app. Leave work local for user inspection.

## Verification
- 39 targeted tests passed across scouting calculation, dialog/storage, Players and player aggregation.
- Production build passed; existing bundle-size warning remains.
- Local Players route returned HTTP 200 on port 5174.
- Responsive sizing reviewed in code only; browser inspection left to the user as requested.
