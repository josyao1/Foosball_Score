# Daily briefing Implementation Plan

**Goal:** Implement the approved Home preview with personalized Play next.
**Architecture:** Keep Dashboard as composition. HomePersonal owns the disclosure; WeeklyBriefing owns the single tabbed feature; HomeActivity combines existing history and first-unlock data. Existing weekly popup and history page remain intact.
**Tech Stack:** React, TypeScript, CSS grid/container queries, Vitest.
**Spec:** docs/superpowers/specs/2026-11-24-daily-briefing-design.md

## Constraints / review focus
- Local preview only; no browser tools or Slack alerts.
- Reuse all-time rankings, first unlocks, saved jerseys and configured weekly day.
- Test profile changes, no candidate, zero games, draws, weekly data loading, long 2v2 names, deleted/future/orphan data, and keyboard tab selection.
- Avoid viewport-only responsive rules inside desktop columns; keep a safe narrow base layout.

## Tasks
- [x] Add failing tests for `personalMatchup(candidates, profile)` matching IDs/names, team membership, full-pool priority and fallback. Implement alongside weeklyFeature without changing shared pick selection.
- [x] Test and implement HomePersonal's collapsed weekly breakdown and visible aggregate summary, preserving latest-result links and the chooser.
- [x] Test and implement WeeklyBriefing with accessible keyboard tabs, accurate game/date/rank, personalized matchup and empty states. Integrate as an opt-in WeeklyFeature view; preserve popup tests.
- [x] Test and implement HomeActivity: one row per game, first unlocks under their own result, filtering and rank retention. Extend GameHistoryList only with optional compact/annotation support.
- [x] Compose Dashboard, add content-width styles, run focused then full tests/build/diff checks, and request one independent code-only review of the complete change.

## Execution notes
User approved implementation by selecting the preview; continuing directly in the existing local workspace used by port 5174. No publication is part of this task.

## Verification and review
- Personal selection and collapsed summary: 18 focused tests passed.
- Feature tabs and existing shared popup: 8 focused tests passed.
- Unified activity and history: 13 focused tests passed.
- Dashboard integration: 31 combined focused tests passed before final review.
- Independent code-only review completed. Fixed future-dated unfinished games appearing live/suppressing suggestions; added reproducing tests. Reworded recommendation evidence to describe the sampled games and elapsed time accurately; added a reproducing test.
- Tint softened from 7% to 3% and fades out at 55% following user feedback.
- Final verification: `npm test -- --maxWorkers=1` passed all 486 tests in 72 files; `npm run build` passed; `git diff --check` passed. Parallel runs encountered timing failures; a serial full run passed with unchanged assertions/timeouts. Existing Home flow assertions now target the new activity heading and verify the configured-day shared popup. The standard bundle-size advisory remains.
- Independent review findings all addressed: future games cannot appear live or suppress a pick; sampled closeness uses “within two goals”; recent play uses “within 24 hours,” avoiding an incorrect calendar-day claim. No deferred findings. Exact visual rendering remains unverified by request; responsive source reviewed for 320px and long team names.
- No browser, screenshot, Slack message or deployment used. Development server remains on port 5174.

## Follow-up: swipe and expanded breakdown
- User requested an animated swipe between weekly cards and an automatically expanded weekly breakdown.
- Added native horizontal scroll snapping, animated tab navigation, scroll-settled tab synchronization, reduced-motion support, and resize alignment. Offscreen panels are inert and hidden from assistive technology.
- Updated disclosure default to open while retaining native collapse control.
- Targeted interaction tests passed (14 tests); production build passed. Full follow-up suite passed: 488 tests across 72 files (`npm test -- --maxWorkers=1`).

## Follow-up: animated breakdown arrow
- Weekly breakdown now uses a native button with expanded/controls semantics and a rotating chevron. The contents expand/collapse with a CSS grid transition, remain inert/hidden from assistive technology when collapsed, and honor reduced motion. It still starts expanded.
- Toggle and profile-change tests passed; production build passed. Full suite passed: 488 tests across 72 files.
