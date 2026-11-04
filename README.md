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
- Tap the rung of the player who hit the ball. The original tap timestamp is preserved. A regular goal saves automatically after 3 seconds; choosing any special flag stops that countdown so you can select flags and confirm manually. Closing the popup cancels the goal. Editing existing goals is always manual; failed saves stay open for review and manual retry.
- **Own goal** credits the opponent; the recorded rung belongs to the player who made the mistake. Own goals are excluded from offensive rung totals and counted separately. Dunk and bank can combine; own goal is exclusive.
- A saved goal reaching 10+ with a two-goal lead opens a phone-friendly winning-score popup: **Undo goal**, **Keep playing**, **Finish game**, or **Finish & rematch**. Keep playing dismisses it until the next score update; manual early finishing remains available. Rematches save the result first, then open a new game in the same rivalry. Failed starts can be retried without finishing twice or duplicating an existing live game.
- Undo the latest live goal. Completed games allow goal corrections/removal; scores and rivalry stats update automatically. An empty game cannot be finished.
- Game dates and start times use **America/Los_Angeles**, including automatic PST/PDT changes. Goal timestamps are elapsed MM:SS.
- Game and rivalry deletion require confirmation and reject stale snapshots. Deleting a rivalry removes only its own games and goals.
- The clock includes time away from the page. Refresh resumes the same game; one live game per rivalry.
- Live games request a native screen wake lock while the tab is visible. **Screen awake** confirms a granted lock; use **Turn off** for normal screen timeout. Switching tabs/apps, finishing, or leaving releases it; returning to the live game requests it again. A browser or Low Power Mode can refuse/release the request, which is shown honestly with a retry option. Requires HTTPS (the Vercel site) or trusted localhost; a phone opening a computer’s plain HTTP LAN address may not support it.
- **Biggest blowout:** largest final margin. **Biggest choke:** largest lead the eventual loser held. Only completed games count toward rivalry records.
- Cloud writes are atomic and revision checked; simultaneous scorers get a visible conflict rather than an overwritten game. State refreshes every 8 seconds and on focus. Cloud mode needs a connection; failed saves stay open for retry. There is no offline cloud queue.

## Checks

```sh
npm test
npm run build
```

Run the checks above for the current test count. See [`docs/audit.md`](docs/audit.md) for pathway coverage, fixes, and the limits of the code-only phone review. The scoring tests cover own-goal attribution, win-by-two, draws, streaks, blowouts, lost leads, and shot flags. Local persistence tests cover reload, duplicate rivalries, active-game uniqueness, and stale writes. SQL was exercised against local PostgreSQL including permissions and transaction rollback.

## Design

**Clay is the selected permanent design.** The style picker is removed from the shared app. Each rivalry ticket includes recent games. Clicking the card opens rivalry stats; recent-game links open individual games. On narrow screens, cards swipe horizontally with scroll snap, arrows, and a position indicator. Player stats share a foosball-rung diagram and a separate goal-type breakdown for both players, including counts and percentage shares. The 1d / 7d / 1m / All time buttons filter completed games by completion time over rolling 24-hour / 7-day / 30-day windows. Rung shares exclude own goals; goal-type shares include them for the player who made them, with dunk + bank counted as one distinct type. Game history always shows all games, newest first. Older design query parameters are removed without changing the current page. The other nine explorations remain in source and `.superdesign/` for reference.

Black and white kit markers match the physical table. Score numbers have no filled tiles. A muted IXL League mark sits in the header. Goal timeline soccer balls distinguish regular, dunk, bank, dunk + bank, and own goals with labels as well as color. The momentum chart shows actual goal difference, named lead directions, and selectable timestamped goals.

Finished-game momentum charts have a play button to replay the score difference with a moving ball, running game clock, and brief goal celebrations. The header has a play/pause button and a compact speed button cycling 2×/4×/8×/16× (default 16×). Play starts over after completion. Touch the chart or use the goal arrows to inspect a point. Gaps follow recorded goal timestamps, ending at the final goal; the static view retains the full game duration. Leaving the tab pauses replay. Rapid goals always refresh the name/time alert; only particles are throttled. Reduced-motion settings disable particles, and replay never changes saved data.

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

### Scorigami

The second navigation tab shows score frequency as two bar charts: regular finishes (10–0 through 10–8) and overtime (11–9, 12–10, and so on). Both use the same game-count scale and combine reversed table sides. Early finishes, draws, one-point wins, and nonstandard continued scores are excluded from this view; game history stays unchanged. Tap any bar for its count, percentage, first and latest games with Pacific timestamps and elapsed playing time. Filter by rivalry or view all games. Regular charts shorten labels to the opponent's score on phones; overtime extends only to the highest qualifying score and pages five outcomes at a time. Native buttons support keyboard selection. This view derives from existing game data and does not require a migration.

Rivalry history displays ten games per numbered page. Clay's head-to-head ticket contains the conditional win rates (after scoring first, reaching 9–9, or trailing by three); the record book no longer repeats them. Score popups include each participant's wins and losses at that score. Names are matched case-insensitively across rivalries; team labels remain one participant.

New goals auto-save after three seconds, including special flags. Each flag interaction restarts the countdown; the initial rung-tap timestamp remains fixed. Goal edits and failed-save retries require manual confirmation.

### Hall of Fame

The third tab ranks completed games across all rivalries as match posters, with a
featured #1, actual time-proportional momentum traces, Pacific dates and earned
captions. Tap the Classic score to see all eight factors: close finish (20), closeness throughout (20), lead
changes (15), winning comeback (20), total goals (10), dunk/bank goals (5),
duration through the final goal (5), and both sides holding match point (5).
The complete calculation is in `src/lib/hallOfFame.ts`; scores are fixed rather
than relative to the current sample of games. Rankings use the unrounded total,
then earlier start time and ID for ties. Only games that finish at their first
valid first-to-10, win-by-two result qualify. No seed data or migration is needed.
Replay links start the existing game momentum player at kickoff at 16×; ordinary
game links remain paused. The posters and third navigation tab adapt for phones.

Classic score uses 100 as a benchmark, not a cap. Full credit arrives at three
lead changes, 22 goals, six minutes, and five special goals. Those categories
continue at half the rate beyond the benchmark. Comebacks earn three points per
goal recovered, plus five for a late recovery, without a cap. Finish closeness,
the share of close scores, and both holding match point retain natural bounds.

### Players

The fourth tab shows Clay player passports across all rivalries. Trimmed,
case-insensitive names share a passport; doubles labels remain separate. Only
finished games contribute. Favorite rungs exclude own goals. Signature finishes compare dunk, bank,
dunk + bank, and own goals made by that player, displaying ties. Percentages
use all their recorded goals (including regular and own goals) as the denominator.
Recent form links the last five completed games, oldest to newest. Personal bests
link the source games for each player's longest run, biggest winning comeback,
and quickest valid win. Runs include opponent own goals. Also shown: win rate,
record, goals scored, playing time, best win streak, and most-played rivalry.

Players also have IXL mastery badges with bronze, silver, gold, platinum, and amethyst tiers. All ten badges stay in the main grid, including unearned badges. Only one detail panel opens per passport, below its tile row. Expand
any badge for its exact requirements and the game that earned each tier. Goals,
wins, dunks, banks, each rung, all-four-rung games, and match-point recovery wins
have separate progress. Own goals never earn scoring badges; dunk + bank advances
both skills. Recovery requires a valid first-to-10, win-by-two finish after facing
opponent match point. Badge progress is derived from finished games, so edits and
removed games are reflected automatically. On phone widths, swipe between
passports or use the arrows; desktop retains the grid.

An Achievements button below mastery opens twenty-two illustrated one-off badges.
Unearned badges stay grey and reveal requirements when selected; earned badges
link to the first earning game. Win achievements require a valid finish, while
own goals only award the appropriate actor/gift achievements. Match-point saves
count separate scoring events; Speedrun is strictly under four minutes through
the last goal, and Instant reply allows up to three seconds. No additional
stored data or schema is required.

The header's Select profile control remembers a participant on this browser with
localStorage (no expiration, no login). Matching rivalries and that passport are
shown first; other entries retain their order and remain visible. Names use the
same trimmed, case-insensitive identity as passports; team labels remain separate.
Users can switch or clear the preference. Other tabs on the same origin update;
private browsing, browser data clearing, and storage restrictions can prevent
long-term persistence. Localhost and production have separate browser storage.

Game-history rows show a compact award marker in their existing arrow slot when
an achievement occurred, without adding a metadata row. Finished-game highlight
pills also show attributed achievement names and icons; selecting one explains
its requirement. These reflect every qualifying game, not only first unlocks.

The home page shows the latest three achievement unlock entries, grouped by player
and earning game. Entries stay in the feed regardless of age; those earned within
the last 12 hours are bold. Repeat performances do not refresh a first unlock.
Circus rewards three consecutive special goals credited to the same player in one
finished game. Own goals count for their beneficiary. Opponent points do not
interrupt it; a regular goal credited to the player resets the sequence.

Achievement collections show a compact repeat count for badges earned in multiple
games, with every earning game linked in the detail view and gold borders on
unlocked badges. Counts are per qualifying finished game; On a roll is earned on
the fifth win of each new streak. First unlocks remain separate for the home feed.
