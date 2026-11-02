# Scorigami

Build the requested second primary tab, taking the higher/lower final-score grid concept from nflscorigami.com and retaining Clay styling. Group completed games by normalized final score, requiring first-to-10 and win by two; omit early finishes and draws. Use actual games only; no schema changes or seeds.

- Pure grouping helper: count, completion-date ordering, scope by rivalry, unusual scores.
- Interactive grid with count shading and selected details: latest game, frequency, earlier occurrences, game links. Native rivalry select.
- Phone-safe scrolling surface with sticky axes; page score ranges in groups of 15 to bound DOM size even for very high scores. Native buttons, roving focus and geometric arrow navigation; counts accessible without color.
- Header tab with active indication; ensure phone header still fits.
- Unit/component/integration tests and code review. User does browser checks. Leave local for review.

User refinements: winning columns start10 and stop at recorded maximum; clipped 15-score ranges for outliers, losing score at most winner minus2. Click opens a viewport-clamped popup with latest match and count, light dismissal and Escape, native Popover API with manual fallback. Only the router-selected main tab is underlined.
