# Table Talk · Foosball Score

A shared foosball journal built with React, TypeScript, Vite, and Supabase. Track rivalries, live games, and every goal from your phone.

## Run locally

Requires Node 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the printed local URL. With no Supabase key, the app starts with an empty local table in browser storage. Local changes persist across reloads. **Start fresh** clears only that browser’s local table. Local records are never uploaded automatically.

## Supabase setup

1. Open your existing Supabase project’s SQL editor.
2. Run [`supabase/schema.sql`](supabase/schema.sql). It only manages its own `foos_*` tables, indexes, policies, and functions.
3. Paste the public publishable/anon key into the ignored `.env` file:

```dotenv
VITE_SUPABASE_URL=https://iqiffravpddrvpwqbrkm.supabase.co
VITE_SUPABASE_ANON_KEY=
```

The URL is already filled in. `.env.example` is tracked; `.env` is ignored. Restart Vite after changing environment variables. Do not use a secret or service-role key: Vite’s `VITE_*` variables are included in the browser bundle.

**Access model:** intentionally shared with no login. Anyone with the URL and public API key can read/create/delete rivalries and save/correct/discard/delete games through the app’s RPCs. This is the requested friends-only-by-convention model. Other tables’ access rules are not changed.

See [`supabase/README.md`](supabase/README.md) for data constraints and RPC details.

## Vercel

Live at [foosball-score.vercel.app](https://foosball-score.vercel.app). The separate **foosball-score** Vercel project is connected to `josyao1/Foosball_Score`. It uses Vite, `npm run build`, output `dist`, and Node 24. Both Supabase environment variables are configured for production, preview, and development. `vercel.json` makes direct rivalry/game links work. Environment changes require a new deployment.

## Match rules

- First to **10**, win by **2**. The app announces a winning score; **Finish game** confirms the result. Early finishes are allowed; ties count as draws and break winning streaks.
- Tap the rung of the player who hit the ball. Timestamp locks at that tap, while the dialog lets you choose a regular goal, dunk, bank, or own goal.
- **Own goal** credits the opponent; the recorded rung belongs to the player who made the mistake. Own goals are excluded from offensive rung totals and counted separately. Dunk and bank can combine; own goal is exclusive.
- Undo the latest live goal. Completed games allow goal corrections/removal; scores and rivalry stats update automatically. An empty game cannot be finished.
- Game dates and start times use **America/Los_Angeles**, including automatic PST/PDT changes. Goal timestamps are elapsed MM:SS.
- Game and rivalry deletion require confirmation and reject stale snapshots. Deleting a rivalry removes only its own games and goals.
- The clock includes time away from the page. Refresh resumes the same game; one live game per rivalry.
- **Biggest blowout:** largest final margin. **Biggest choke:** largest lead the eventual loser held. Only completed games count toward rivalry records.
- Cloud writes are atomic and revision checked; simultaneous scorers get a visible conflict rather than an overwritten game. State refreshes every 8 seconds and on focus. Cloud mode needs a connection; failed saves stay open for retry. There is no offline cloud queue.

## Checks

```sh
npm test
npm run build
```

All 46 tests pass. See [`docs/audit.md`](docs/audit.md) for pathway coverage, fixes, and the limits of the code-only phone review. The scoring tests cover own-goal attribution, win-by-two, draws, streaks, blowouts, lost leads, and shot flags. Local persistence tests cover reload, duplicate rivalries, active-game uniqueness, and stale writes. SQL was exercised against local PostgreSQL including permissions and transaction rollback.

## Design

**Clay is the selected permanent design.** The style picker is removed from the shared app. Each rivalry ticket includes recent games. Clicking the card opens rivalry stats; recent-game links open individual games. On narrow screens, cards swipe horizontally with scroll snap, arrows, and a position indicator. Player statistics use Mono's compact tables with Clay's colors and typography. Older design query parameters are removed without changing the current page. The other nine explorations remain in source and `.superdesign/` for reference.

Black and white kit markers match the physical table. Score numbers have no filled tiles. A muted IXL League mark sits in the header. Goal timeline soccer balls distinguish regular, dunk, bank, dunk + bank, and own goals with labels as well as color. The momentum chart shows actual goal difference, named lead directions, and selectable timestamped goals.

Superdesign exploration artifacts are recorded in `.superdesign/`; the implementation includes subsequent feedback beyond those early drafts. Browser verification is performed by the user; automated checks use Vitest and the production compiler, without Playwright.

## Reference documentation

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vite environment variables](https://vite.dev/guide/env-and-mode)
- [Vercel deployments](https://vercel.com/docs/deployments)

### Record book

The temporary sample preview has been retired. Its isolated browser storage is
cleared on app startup; existing shared and ordinary local records are preserved.
No sample games are created in the application.

The rivalry record book is derived from finished games. Click a record to open
its game and select the goal sequence in the momentum chart. Quickest
wins use the last goal timestamp and exclude early finishes and games that
continued after a winning score. Runs and bursts include opponent own goals;
all-rung achievements exclude them. Corrections and deletions update records.
