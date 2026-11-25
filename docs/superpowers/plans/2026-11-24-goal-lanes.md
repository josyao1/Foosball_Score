# Goal lanes implementation plan

**Goal:** Implement the selected result timeline with stable team lanes on phones and laptops.
**Architecture:** A dedicated GoalLaneTimeline handles the result presentation; Timeline delegates its non-compact mode. Keep existing live feed and correction actions. Derive cumulative scores, event attribution and run landmarks from ordered saved goals.
**Tech stack:** React, TypeScript, CSS grid, Vitest.
**Spec:** docs/superpowers/specs/2026-11-24-goal-lanes-design.md

## Constraints and review focus
- No browser navigation or Slack test posts. Production release authorized after code-only phone review.
- Preserve chronological score order, compact reverse order and saved-position attribution.
- Exercise 2v2 swaps, own-goal credit, missing attribution, empty games and correction callbacks.
- Review narrow widths, long names, three-digit scores, and all supported theme selectors.

## Implementation
- [x] Update GameReport tests for result lane behavior while retaining live feed coverage; watch the new behavior fail.
- [x] Create components/GoalLaneTimeline.tsx and goal-lane-timeline.css; delegate non-compact Timeline to it.
- [x] Add meaningful run, lead-change, roster and correction interaction tests.
- [x] Run focused tests, full suite, production build and diff checks. Review responsive rules without browser navigation.
- [x] Ensure the existing localhost:5174 preview is available and report the result for user inspection.

## Verification

473 tests passed; production build passed with the existing bundle-size advisory. Independent read-only review found no important defects. Responsive grid, wrapping, three-digit scores, touch targets, theme selectors and sticky ownership header reviewed in code; no browser rendering or device test was performed. localhost:5174 serves the new component. User approved the local preview and authorized production release. Final code-only review covered narrow lane widths, wrapping, touch menus, jersey tints and responsive totals; no release-blocking defects found.

Follow-up scope completed: scorecard styling, Hall of Fame replay sparkles, historical scorer fallback, removal of tie labels, and shared all-time league totals on Home. Replay tests cover credited own-goal side, final-goal celebration, restart clearing and no sparkle on seeking.
