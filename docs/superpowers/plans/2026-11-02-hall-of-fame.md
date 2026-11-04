# Hall of Fame

Approved direction: ranked match posters across rivalries, a featured #1, actual
momentum graphics, earned captions, rating breakdown and replay. Local review only.

Keep Clay's existing cream, paper, brown and tan tokens, with black/white side
markers. Serif scores and ranks, existing sans-serif labels. The actual stepped
score-lead trace is the visual signature; no decorative stock graphics.
Featured poster spans the gallery; smaller posters sit in two columns, one on
phones. Poster contents adapt to their own width. Separate native actions for
game details, rating explanation and replay; no nested interactive controls.

Classic score v2 /100 (approved close-finish rebalance):
- Close finish: 20 for a two-goal margin, subtract 4 per extra goal, floor 0.
- Closeness: 20 × share of after-goal states within two goals.
- Lead changes: 3 each, maximum 15; ties are not changes.
- Winning comeback: 3 per goal recovered, maximum 15, plus 5 if the opponent
  was at 9 or higher at the maximum deficit.
- Total goals: 0 at 10, rising linearly to 10 at 28, clamped.
- Specials: 1 per dunk or bank goal, maximum 5. Combo counts once, own goals excluded.
- Length: 0.5 per minute through last goal, maximum 5.
- Match-point drama: 5 when both sides held match point.

Only completed games ending on their first valid first-to-10, win-by-two score
qualify. Sort raw score descending, then earliest start and ID. Missing rivalries
are excluded. No seed data or database changes.

Implementation/checklist:
1. Pure scoring/ranking helpers and meaningful edge-case tests.
2. Poster page and explanation dialog; responsive third navigation tab.
3. Full-game replay deep link, preserving record replay behavior.
4. Component tests, full suite, build, diff check and code-only review.
5. Leave available on localhost for user inspection; no browser automation.

## November 3: benchmark scoring

User approved treating 100 as a benchmark, not a ceiling. Full category credit
now arrives at 3 lead changes (15), 22 total goals (10, starting at zero for
10 goals), 6 minutes (5), and 5 special goals (5). Beyond each benchmark,
extra credit accrues at half the initial rate. Winning comeback remains
3 points per deficit goal plus 5 for a late recovery, without a cap.
Close finish, closeness, and match-point drama stay unchanged.
The 12–10, 5–9 comeback example now scores 91.8 rather than 80.5.
