# Ranked Slack score highlights

Approved in conversation: retain score, active duration and View game button. Add the highest qualifying story, in this order: Scorigami; late comeback (3+ behind with opponent at match point); 3+ match points saved by winner; 5+ goal comeback; first rivalry win after 3+ losses; break 5+ losing streak; both held match point; 3–4 goal comeback; 4+ lead changes; 7+ unanswered; 5+ closing run; break 3–4 losing streak; one rung (5+ and 60% of side goals); 3+ banks/dunks.

At most one extra line: a strictly new table record, otherwise Hall of Fame #1–10. Never repeat the primary fact. No filler, shutouts, generic milestones, or the rejected highlight categories. Scorigami ignores side orientation and only counts valid standard finishes. No test messages to Slack.

Use existing game-analysis functions in a pure shared TypeScript module rather than duplicating them in SQL. Snapshot each newly queued game's data and rivalry so later edits cannot contradict its original final-score message. Read context once before sending, calculate ranking, persist the final message for stable retries. Existing queued jobs keep their original payload. Preserve all lease, deletion, disabled-state, retry and ambiguous-send protections.

Roll out the pending personal-best fix too: a solo player's records include matches against teams; paired players do not inherit team personal bests.
