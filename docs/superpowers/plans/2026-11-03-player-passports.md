# Player passports

Approved: fourth Players tab, clean Clay passports, favorite rung, signature
goal type, recent form, personal bests and a few useful profile details.

Use existing recorded names (trimmed, case-insensitive) across rivalries. Keep team
labels intact. No new tables, writes, seed data or deployment. Finished games only.
Own goals count in match results and runs but not favorite-rung stats.
Signature finishes exclude regular and include actor-attributed own goals;
percentages use all actor goals, including regular and own goals.
Show tied favorites explicitly. Empty profiles have dashes rather than fabricated
styles. Recent form is the last five completed games, oldest to newest, each linked.
Personal bests: longest unanswered run, biggest winning comeback, quickest valid
win; show the best winning streak too. Include most-played rivalry and playing time.

Two columns on laptop, one on phones. Header: foosball figure, name, win rate.
Body: compact totals, rung miniatures, type icons, result stamps, personal bests.
No card-wide links; individual links have independent destinations. Four main
navigation tabs must fit or scroll inside their own row on very small screens.

Checks: aggregation across side swaps and case variants, intact team identities,
own goals, ties, live exclusion, empty profiles, run attribution per player,
chronology, source links, navigation. Run full tests/build and code-only review.

## Mastery badges and phone swipe

User requested tiered IXL mastery badges inside passports and horizontal phone
navigation like Rivalries. Chosen presentation: compact earned stamps in two
columns, bronze/silver/gold tints, expandable requirements and source-game links;
unearned categories under Next badges. Avoid a separate tab or oversized trophy cards.

Thresholds (bronze/silver/gold): goals 50/100/250; wins 5/15/30;
dunks and banks each 5/15/30; each rung 10/25/50; scoring on all four rungs
in one game 1/3/5 games; match-point recovery 1/3/5 wins. These thresholds are
implementation choices and can be tuned. Own goals do not earn scoring badges;
combos advance both dunk and bank proficiency. Match-point recovery requires
an opponent match point followed by a valid win, with no play beyond an earlier
winning score. Aggregate completed games chronologically and capture the first
game crossing each tier. Existing participant identity rules apply.

At <=760px, passports use native horizontal scrolling and snap, with a next-card
peek, arrows, position, keyboard controls and reduced-motion support. Desktop
keeps its two-column grid. Search resets the carousel to the first visible player.
No database changes or seed data. Validate attribution, threshold crossings,
recovery eligibility, links and carousel interaction with code-only tests/build.

### Badge layout revision

All ten badges now stay in the main grid, unearned included. One controlled
detail panel per passport appears after the selected tile's two-column row;
tiles keep their positions. Stronger medal tints include platinum as tier four.
Platinum requirements: 500 goals; 60 wins/dunks/banks; 100 per rung;
10 all-four-rung games or match-point recoveries.

## Achievements collection

User approved all twelve proposed achievements: Escape artist, Mic drop, Bank
closed, Gift wrapped, One-track mind, Perfect paper, Extra credit, Plot twist,
From downtown, Speedrun, Instant reply, Technical difficulties. A button below
mastery opens a modal collection with names and unique drawn icons. User's latest
instruction supersedes hidden achievements: unearned badges are grey and can be
opened to read requirements. Earned details show the first earning game/date/link.

Win achievements require a valid finish (no early/manual result or continued
play after a prior valid win). Three match-point saves are three distinct credited
goals that prevent defeat, not repeated clock observations. Own-goal gifts do not
also earn shot-type or goalie finish badges. Five same-rung goals must be
uninterrupted personal non-own goals. Reply <=3 seconds; Speedrun strictly <3
minutes through final goal. All achievements use finished games and existing
participant identities, earliest completion retained. Edits recompute them.

## Device profile preference

Replace Shared table with Select profile / selected participant name. Store a
normalized participant key in localStorage without expiry, subscribe to in-tab
and cross-tab changes, and allow switching/clearing. Move exact matching
rivalries and passport first, preserving the order of all other entries. No
authentication, database migration, or split team labels. Header selector stays
visible at phone widths. Most-played rivalry footer removed per request.
Speedrun threshold revised by user to strictly under five minutes.

## Additional flow achievements

Approved additions: Double agent (2 own goals then valid win), Trading blows
(first 10 credited goals alternate; both participants earn it), Closing time
(personally score the final 5 unanswered then valid win), Never in doubt (strictly
lead after every goal then valid win), Streak breaker (personally end a credited
opponent run of 4+, then valid win), Around the table (4 consecutive personal
non-own goals from all 4 rungs). Speedrun is now strictly under 4 minutes.
Collection puts earned badges first, preserving catalogue order within groups.

Amethyst is tier five, after Platinum, with a purple tint. Requirements are twice
Platinum: 1,000 goals; 120 wins/dunks/banks; 200 per rung; 20 all-four-rung games
or match-point recovery wins. Each tier retains its first earning game.

Game achievements are also tagged in game-history rows using the existing arrow
slot, and as clickable pills below the finished scoreboard. A shared provider
marks fifth wins across all rivalries for On a roll so game tags and passports
agree. Additional approved achievements: Full house (all four special categories
on separate personal goals), On a roll (5 consecutive wins), Walking the tightrope
(valid win with no lead above 2), Marathon (valid win >=10 minutes to final goal).
There are now 22 achievements. Trophy markers and pills reflect qualifying games;
passport detail links retain each player's first unlock.

### Recent achievement feed and Circus
- Home feed below rivalries: latest three player/game unlock groups, newest first,
  source-game links, badge icons, Pacific date/time. First unlocks only.
- Retain older entries; bold entries younger than 12 hours and refresh on minute
  ticks or visibility changes. No database changes or stored notifications.
- Circus: three successive special credited goals in one finished game; own goals count
  for the beneficiary. Ignore opponent points; reset on a credited regular goal. Custom tent icon.
- Cover grouping/cap, age boundary, invalid timestamps, retention, repeat unlocks,
  source links, timer refresh and Circus beneficiary attribution/reset with automated tests.

### Repeat achievement earns
- Preserve first-unlock map for the feed and add chronological per-badge game
  history to passports. Record each qualifying finished game once per badge.
- Show ×N in the tile's top-right corner only above one earn; expose count in its
  accessible label. Earned borders use warm gold; locked badges stay grey.
- Detail view lists all earning games with Pacific timestamps, score and duration.
- On a roll retains its fifth-win-of-each-new-streak semantics.

Tightrope clarification: a valid win with an absolute score gap of at most two
after every goal. Either player leading by three disqualifies it.
