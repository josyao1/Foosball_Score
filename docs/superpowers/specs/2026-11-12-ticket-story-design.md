# Match ticket story and Wrong way

Approved in chat: preserve the Clay jerseys, final score, date and momentum; replace the export's achievement footer with one dynamically selected story and up to two distinct supporting facts. Tighten whitespace and name each team at the graph. Keep copy/download behavior. No production rollout requested.

Approach: deterministic facts from ordered goals, saved scorer lineups and earlier active rivalry games. Prefer late comebacks, match-point saves, rivalry streak breaks, close games, runs and bursts; use scoring contributions/rungs for ordinary games. Avoid duplicate categories, fake records, inferred scorers and filler. Alternatives considered: achievement-first (rejected by user), full stats panel (too crowded). Square 1080px artwork with existing cream/brown palette, serif score/story and sans-serif supporting facts.

Wrong way: make an own goal while the actor's side has match point immediately before the goal. Completed games only, no win requirement. Attribute to the actual individual using the goal's saved lineup, not current assignments; do not invent a scorer for historical team goals without attribution. Append to fixed achievement order with a distinct wrong-direction goal icon. Existing achievement history/feed/stamp flows should pick it up.

No database mutation, browser testing or new dependencies.

## Subsequent user refinements
- Shared export: remove the headline section above the graph. Show at most two distinct facts below it, selected from the same ranked candidates. Add positive/negative goal-difference ticks, Tied, a midpoint time, and named above/below lead labels. Export is 1080×960; fit each teammate on one line.
- All finished result tickets and exports show current all-time rank, with prominent stamps limited to the top ten and quiet markers thereafter. Nonqualifying games are Unranked.
- Flip colors is a device-local, per-game preference for live scoring. Map presentation only, preserving canonical sides, scorer snapshots, swaps and stored data. Available in normal and fullscreen scoring.
- User requested an interactive design comparison directly on game results: Matchup, Score strip, Receipt, Table, Original. This is an authorized visual prototype; keep Clay, real scores, jerseys, first-unlock stamps and ranks. No database writes or new persistent design preference. Mobile tabs scroll horizontally and support keyboard navigation.
