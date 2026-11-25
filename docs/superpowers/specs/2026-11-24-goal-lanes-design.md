# Goal timeline: player lanes

Approved direction: the user selected Player lanes from the interactive preview and asked to build it for phones, laptops, and 2v2.

Replace the result timeline with two fixed team lanes and a centered cumulative score. Keep the reading column bounded on laptops. Sticky headers keep ownership visible during scrolling and show each team's jerseys and names; team events name the individual from the saved goal lineup, while solo events avoid repeating the same name. Keep times, rungs, special-goal labels, and correction actions available. Own goals belong to the credited lane and explicitly name the actor. Missing historical attribution must remain unassigned: show the rung and a quiet Scorer not recorded note. Mark lead changes and completed runs of at least three goals without hiding goals or adding pills.

Alternatives considered: grouped runs compress the story but hide individual events; the compact scorebook scans quickly but does not provide fixed spatial team ownership. Player lanes best addresses the user's complaint about jumping between names and scores.

Use the existing theme, jersey and goal-ball components. Phone layout must wrap team names and metadata without clipping. The live compact feed keeps its existing behavior. No browser navigation or Slack posts. Preview locally before any new production rollout.

## Follow-up refinements

The user requested a printed scorecard background, Hall of Fame replay sparkles matching the individual replay, removal of Back level labels, and all-time totals on Home. Added faint row rules, a center score strip and double header rule. Both replays share playback-only celebration timing and throttling; Hall of Fame uses SVG particles to stay aligned on narrow/letterboxed charts and honors reduced motion. Home totals share the Rivalries calculation and use a two-column phone layout above the weekly feature.

Confirmed with a read-only production query: Nov 4 game bb39caf6-597f-4ce1-9f8c-818ebb50c585 has no saved lineup for the game or any of its 24 goals; no individual attribution was invented or written.

The user approved trying a faint diagonal hatch in each unscored half-row. A non-interactive CSS background at 6% theme-ink opacity marks only the empty lane, using credited side for own goals as well.

The user also approved a jersey-color treatment: recorded scorers receive a 5% fading wash and a small jersey-body/trim accent at the outer edge. Use saved player appearance consistently with header jerseys and the goal’s saved lineup after swaps. Unassigned historical events and own goals remain neutral to avoid attributing the credited side to the wrong player.
