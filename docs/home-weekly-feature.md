# Home and weekly feature

Home becomes the league dashboard at `/`, with a Home tab before Rivalries.
Featured rivalries move to `/rivalries`; the searchable compact directory lives at
`/rivalries/all`. Existing rivalry and game URLs stay unchanged.

The dashboard contains a personal weekly summary, a weekly double feature, live
games, recent results, and the achievement feed. Section links live in the main
navigation rather than repeated preview cards.

The personal summary uses the selected profile, separates singles from any team
matchup, and shows weekly win/loss/draw records plus the latest finished result
from that player’s perspective. With no valid profile selected, an inline prompt
opens the existing profile chooser. Weekly match cards use compact jersey/name/
score rows; the suggested matchup clearly labels its numbers as recent series
wins, while the finished game labels its final score. On phones the two weekly cards form a native swipe carousel with snap points
and compact button indicators; desktop retains two columns.

Weeks run Monday–Sunday in America/Los_Angeles. Game of the Week is the highest
Hall of Fame intensity score among qualifying games finished this week, updating
as games finish. A prospective matchup uses recent rivalry history, competitive
finishes, balanced wins, intensity, activity and sample size. It uses history as of
the start of the week so new results don't constantly change the recommendation.
Near-equal contenders rotate deterministically by week; everyone sees the same pick.
Players must be active in the last 30 days. Live matchups are excluded. A meeting
within one day costs 45 points, within three days 30, and within seven days 15.
This penalty uses current results, so playing the recommended matchup can replace
it; a manually selected matchup stays selected until the following week.

Backlog gains a shared Weekly feature tab: enable/disable, feature weekday (Friday
by default), and optional matchup/game overrides for the current week. Overrides
expire next week. Deleted or invalid overrides fall back to automatic selection.
Settings follow the app's existing shared league access model and use optimistic
concurrency to prevent silently overwriting another device's edit.

Home always displays the banner when enabled; a dismissible popup appears on the
configured weekday, once per week per browser. It does not interrupt other pages.
Empty or insufficient history is stated plainly, with no fabricated facts.

Verify time boundaries (including DST), ranking, overrides, save conflicts,
popup dismissal, routing, mobile styles and the existing app flow tests.
