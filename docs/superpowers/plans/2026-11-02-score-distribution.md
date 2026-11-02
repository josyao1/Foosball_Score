# Score Distribution Implementation Plan

Approved direction: replace the two-dimensional Scorigami grid with regular-finish and overtime frequency charts. Keep Clay styling, clickable popups, rivalry scope, counts and history. No browser automation, data changes, seeds, or deployment.

## Design
Nine regular finishes (10–0 through 10–8) and overtime finishes (11–9 onward). Bars share a frequency scale. Full score labels on desktop, losing score only on narrow regular charts with an explicit winner-scored-10 label. Overtime stops at the highest valid result and is paged in groups of five for extreme scores. Empty results remain clickable outlined baselines. History stays inside the score popup. Nonstandard finishes remain untouched in game history and are excluded from this distribution.

## Tasks
- [x] Update helper tests for exact valid final-score forms, reversed sides, scope, edited results and extreme overtime; implement grouping rule.
- [x] Replace grid tests with bar selection, same-scale counts, overtime pages and most-common navigation; replace grid with two responsive sections, retain popup/history and native buttons.
- [x] Run focused tests, full suite, build and whitespace check. Review code for long names, narrow layouts, empty states and popup focus. Leave available on existing localhost.

Verification: 142 tests across 22 files passed; production build passed (existing bundle-size advisory); git diff --check clean. Code-only independent review found narrow overtime labels, a detached popup after live refresh, and an undefined hover surface token. Fixed all three; overtime now pages five outcomes, detached popups close and restore focus to an available bar, and hover uses the existing theme surface token. No browser automation or production deployment. Existing localhost remains on port 5174.
