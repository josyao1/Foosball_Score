# Daily briefing Home

Approved direction: the user selected Daily briefing from the interactive Home comparison. Matchday emphasized scheduling; Feed first emphasized activity. Daily briefing balances the personal summary, a single weekly feature, and recent results without extending the phone page with repeated sections.

- Compact personal header with weekly W/L/D and game count. Animated disclosure opens by default and retains singles/team breakdown, goals and time. Latest result remains visible. Keep jersey accents and the existing no-profile chooser.
- One feature card with accessible Game of the week / Play next tabs, smooth horizontal transitions and native touch swiping. Respect reduced-motion preferences; inactive cards stay out of keyboard and assistive-technology navigation. Use real scores, captions and dates. Keep existing configurable weekly popup and shared Backlog picks intact.
- Steering: Play next selects the highest-ranked eligible candidate involving the selected player. No selection or no matching candidate falls back to the highest-ranked overall candidate. Use the complete candidate pool, not the ten-item Backlog shortlist. Global Friday picks remain shared.
- Around the table displays the latest five completed games and attaches first-unlock achievements to their game rather than repeating a separate achievement feed. Keep top-20 rank stamps, jerseys, duration and the full-history link. Add at most one existing significant game caption; do not invent statistics.
- Desktop uses feature/activity columns; phones stack them. Live games stay prominent before the personal summary. Deleted, orphaned and future games are excluded.
- All controls remain usable at 320px, with wrapping names, readable numbers and 44px targets. Code-only validation: no browser, Playwright, images, Slack alerts, remote changes or production deployment in this task.

Implementation decisions: preserve full Game history layout through a Home-only compact variant. Keep one source for ranking and first-unlock semantics. Bound visible achievement notes and link to the existing report for the full details.
