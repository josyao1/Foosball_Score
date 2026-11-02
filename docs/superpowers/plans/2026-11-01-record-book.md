# Rivalry record book

Approved direction: compact Clay book spread, small moment graphics, record holders, and direct playback links. Keep at bottom of rivalry page. Phone entries stack without horizontal scrolling. Existing record rules (including later-score comeback tie break) remain the data source.

Implementation: isolated RecordMomentGraphic with decorative SVG derived from actual ordered goals; RecordBook spread with independent view and watch links; optional initial replay position only for explicit watch links. No new libraries or database changes.

- Build graphics and book layout; compact unset entries, long-name wrapping, accessible links.
- Connect watch links to replay just before the selected moment at existing default 16×.
- Verify links, timing, empty states and existing tests; review CSS sizing for 320px and laptop containers. No browser automation.

Final refinements: six rivalry records (burst omitted as requested); quickest win uses a stopwatch and final score; other mini charts use actual timestamps. General per-game burst highlights remain available.
