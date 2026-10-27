# Foosball tracker MVP

A shared, mobile-friendly scoreboard for a group of friends, hosted on Vercel using an existing Supabase project. No login, as explicitly requested. Everyone with the URL can read and edit the shared data.

## Approach
React + TypeScript + Vite suits the requested VITE environment variables and a mostly interactive app. Supabase stores rivalries, games, and goal events. A server-rendered app adds no needed functionality here; a local-only prototype would not deliver shared persistence. Browser-local demo mode works without credentials and never uploads sample data to Supabase.

## Screens and rules
- Rivalries home: persistent pairings, aggregate results, latest activity, create rivalry.
- Rivalry detail: H2H wins, draws, streak, goal totals, largest margin, largest lost lead, game cards; start/resume a game.
- Live scoring: both player scores, elapsed clock, four rung buttons per player, a goal dialog with dunk/bank/own-goal flags, undo, finish confirmation, discard confirmation. Timestamp is captured on rung tap, not on confirmation. Own goal credits the opposite side; rung belongs to the actor. Dunk and bank can combine; own goal excludes dunk and bank.
- Game detail: score, duration, lead/momentum chart, ordered timestamped timeline, rung totals, special-shot totals. Completed goal entries can be corrected or removed with confirmation.
- First to 10, win by two. Announce winning threshold but finish manually; can finish early. Tied early finishes are draws and break win streaks. Empty games cannot be finished; discard instead. Largest choke means largest lead by the eventual loser.
- One live game per rivalry. Reload resumes an active clock. Clock includes time away from app; pause is out of scope.

## Data and integrity
Three prefixed tables: foos_rivalries, foos_games, foos_goals. Scores and statistics are derived from goals. A transactional RPC saves game metadata and its goal list together. Revision checking rejects stale writes and partial unique index prevents two live games in one rivalry. RPC checks timestamps, sides, rungs, flags, parent IDs. Public read access and intended anonymous writes only on these app tables/functions. No service-role key in the frontend.

## Visual direction (builder choices)
A compact match journal with an oversized scoreboard and subtle foosball-table linework. Navy #111d24 base, slate #20323c surfaces, off-white #edf2ef type, muted grey #93a4ac, player blue #83c8f0, player orange #f3b07e. System sans body, condensed-looking tightly spaced bold score typography. Desktop dashboard spacing; mobile becomes a two-column scoring control board with a bottom-sheet goal dialog. Native dialogs, keyboard focus, large controls, reduced-motion support.

## Scope and verification
No authentication, tournaments, teams, realtime subscriptions, or auto-deployment. Poll cloud state and reload on focus; revision checks prevent overwrite. Tests cover own-goal attribution, win-by-two, draws, streaks, comebacks, and browser persistence. Production build and desktop/mobile browser checks. Supabase integration is prepared but cannot be claimed live-tested without a key and applied schema.
