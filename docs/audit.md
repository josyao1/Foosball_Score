# Foosball audit — 2026-10-26

## Verified

46 Vitest tests across 12 files pass. TypeScript and the Vite production build pass. The build emits a non-blocking bundle-size warning (about 164 kB gzipped JavaScript). Git whitespace checks pass.

App-level tests use an isolated local repository and a jsdom native-dialog shim. No browser automation or real Supabase records were used for these tests.

| Pathway | Coverage |
| --- | --- |
| Rivalries | Create, name validation/recovery, reversed duplicate pairs, names containing delimiters, deletion snapshot conflicts |
| Live scoring | Start, resume without duplicate game, regular/own/dunk+bank goals, timestamp captured at rung tap, undo, empty-game discard |
| Results | Manual early finish, tied finish, first to 10/win by 2 notice, correction, removal, game deletion and empty-rivalry deletion |
| Navigation | Game deep link, missing game, back/resume, permanent Clay despite old saved theme or query |
| Persistence | Reload, stale revisions, external-tab edits, response-loss reconciliation, offline failures retaining data, unreadable local-data reset |
| Async UI | Pending goal/create/delete dialogs remain open and freeze editable fields; superseded reads cannot clear loading or overwrite newer saves |
| Momentum | Own-goal credit, elapsed timestamp, previous/next and keyboard selection, selected goal removed, empty history |
| Mobile carousel | Native scroll targets, position updates, edge buttons, keyboard navigation, reduced motion, resize and single-card behavior |
| Statistics | Attribution, rung/type distribution, streaks/draws, blowouts/chokes, Pacific dates and DST |

## Fixed during the audit

- A superseded initial read could clear the loading screen before the newest read completed.
- Two different name pairs containing a pipe character could produce the same local duplicate-pair key.
- Closing a dialog during a pending save could allow its old completion to interfere with a replacement dialog. Pending saves now block dismissal and freeze fields.
- Phone CSS had fixed header-height conflicts, long-name/form overflow, squeezed history rows and timeline controls, and undersized chart controls. Responsive rules now use wrapping, flexible tracks, and larger touch targets.

## Responsive review scope

Code reviewed for the Clay homepage, rivalry overview/player tables/history, live scorer, game result/momentum/timeline, and create/goal/confirmation dialogs at phone widths including 320–390px. Rivalry cards scroll horizontally at widths up to 700px, with the hint and controls above the cards. Full-card stats links preserve separate recent-game links.

The user explicitly owns browser testing. Actual mobile rendering, native touch gestures, and browser-specific dialog behavior have not been visually verified by the agent. Code checks cannot guarantee an absence of visual defects.

## Hosted data boundary

The foosball schema and RPCs use only foos_* objects. Existing unrelated Supabase tables were preserved. Hosted checks during the audit were read-only; deletion tests used isolated fixtures.
