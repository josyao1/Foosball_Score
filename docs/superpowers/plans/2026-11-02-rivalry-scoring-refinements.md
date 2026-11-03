# Rivalry and scoring refinements

User requested five concrete changes; implement locally for review without browser automation or data mutations.

- Scorigami: each score popup lists only participating names with wins / appearances and win percentage. Combine identical trimmed, case-insensitive names across rivalries; preserve team labels as a single participant. Respect selected rivalry and score.
- History: ten games per numbered page, newest first, stable global game numbers, bounded mobile pagination controls, clamp after deletions and reset for another rivalry.
- Clay H2H: remove draws from presentation; integrate the existing first-goal, 9–9 and comeback win rates into the perforated ticket footer. Remove duplicate rates below record book; retain historical draw calculations/data.
- Home tickets: streak and View stats share one aligned row, with long names ellipsized rather than pushing the action down.
- New goals: three-second automatic save applies to all flags. Each flag interaction restarts three seconds from the latest selection, keeps original goal timestamp, supports combined dunk/bank and exclusive own-goal, cancels on dismissal/unmount, saves once, and preserves manual retry after a failed save. Edits stay manual.

Validation: regression tests for percentage denominators, missing participants, page boundaries and data changes, relocated rates, countdown reset/races/own-goals. Full tests, TypeScript/build, code review for phone and laptop. No production release until requested.

Follow-up refinements: Scorigami popup shows only first and latest games (single occurrence once), both with Pacific timestamp and final-goal elapsed time. Game history shows elapsed time on a separate line below date/time. Clay ticket now uses one aligned player comparison for wins, total goals and conditional win rates, plus a compact footer. History page clamp persists after removal so later additions do not unexpectedly change pages.
