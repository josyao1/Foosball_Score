# Slack Highlights Implementation Plan

> Implement natively in this session; the user has authorized the agreed changes and rollout.

**Goal:** Ranked, concise final-score alerts without Slack test posts.
**Architecture:** Pure shared TypeScript selection; immutable per-job game snapshot; service-only preparation RPCs; persist composed payload before the existing sending transition.
**Tech Stack:** TypeScript, Vitest, PostgreSQL, Supabase Edge Functions.
**Spec:** ../specs/2026-11-24-slack-highlights.md

## Constraints and review focus
- No live Slack tests or replay of historical alerts.
- Preserve first-finalization results through corrections and retries.
- Require valid wins for competitive highlights; no early-finish Scorigami.
- First win outranks streak breaks; exact deterministic priority.
- Own goals credit opponent but never count as actor rung/special scoring.
- Strict records only (not ties), HoF <=10, no duplicated story.
- Failed enrichment must never block saving a game; delivery retries safely before sending.

## Tasks
1. Write failing tests for candidate selection, exclusions, history, record and rank boundaries. Implement `slackHighlights(game,rivalry,games,rivalries)` in src/lib/slackHighlights.ts using existing analysis helpers; run tests.
2. Add a pre-insert snapshot trigger plus service-only context and prepare RPCs. Add rollback-only checks with wake trigger disabled inside the transaction. Existing jobs remain unenriched.
3. Add worker prepare step before begin; test exact fields, exceptions, lease failures, stable prepared retries with mocked transport. Bundle Edge entry with esbuild so shared extensionless application imports remain Deno-compatible.
4. Run full tests/build and database checks without Slack delivery. Apply additive migration, deploy Edge function, commit/push both pending features, verify production commit and function version.
