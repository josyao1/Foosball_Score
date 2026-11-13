# Ticket story Implementation Plan

> **For agentic workers:** Execute natively in this session; user authorized implementation.

**Goal:** Make exported tickets tell the game story and add Wrong way.
**Architecture:** Pure fact selection in matchStory.ts, rendered by the existing standalone SVG exporter. Achievement detection extends the existing derived-data pipeline with personal attribution.
**Tech Stack:** TypeScript, React, SVG, Vitest.
**Spec:** ../specs/2026-11-12-ticket-story-design.md

## Constraints / review focus
- No browser, database changes, deployment or dependencies.
- Own goals credit the opponent but Wrong way belongs to their actor.
- Saved goal lineups survive swaps; unknown historical scorers stay unknown.
- History facts exclude future, live, archived and other-rivalry games.
- Facts remain deterministic, distinct and truthful for draws/empty/early finishes.
- SVG escapes text and fits long team names at phone image sizes.

## Tasks
- [x] Add failing pure fact-selector tests for comeback, close game, streak break, contributions and empty games; implement matchStory(game,rivalry,games,players).
- [x] Replace string highlight with structured story in matchTicketSvg and MatchTicketActions; update export tests for geometry, safe text and current jerseys. Preserve copy/download.
- [x] Test and implement Wrong way at 9–8 and overtime, negative tied/already-finished-score cases, and individual attribution through swaps. Integrate passports/game awards/icon and fixed-order tile count.
- [x] Run focused tests, build and full test suite. Review diff and render standalone SVG locally if a non-browser renderer is available. Leave for localhost review.

## Additional implemented scope
- Device/game color preference with tests for attribution, reload, rematch isolation, blocked storage and fullscreen.
- All-time rank markers, preserving the Hall of Fame top-ten display.
- Shared ticket simplified to two bottom facts and labeled difference graph.
- Five game-result comparison layouts using existing real game data and shared components.

Validation: full suite passed 374 tests before the final export-label regression was added; production build passed. Browser interaction deliberately left to the user. Local preview responds on port 5174. No deployment performed.
