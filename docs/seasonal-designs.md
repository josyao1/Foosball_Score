# Saved seasonal designs

Thanksgiving was approved on November 16, 2026 and saved in commit `891daaf`.
Its leaves, pumpkin illustrations, and harvest sprigs remain available unchanged.

Christmas uses snowfall, evergreen branches, holly berries, and gold
ornaments. The main cream-and-brown design, jerseys, scores, and controls stay intact.

## Local previews

- `/` follows the seasonal calendar, including in the development server.
- `/?season=christmas` previews Christmas early.
- `/?season=thanksgiving` shows the saved Thanksgiving design.
- `/?season=auto` follows the production calendar.

Preview parameters never override the calendar in a production build.

## Automatic calendar once deployed

All boundaries use America/Los_Angeles (Pacific standard time for these dates).

- November 16–30, 2026: Thanksgiving.
- December 1–31, 2026: Christmas.
- January 1, 2027 onward: ordinary theme, no seasonal decoration.

An open tab rechecks every minute and upon returning to the page. No database
changes, scheduled server job, or December redeploy are necessary once this code
is published. Preparing a local preview does not publish it to production.

Both themes ignore pointer input, reduce particles on phones, disable falling
animation for reduced-motion preferences, and omit decoration from printing.
