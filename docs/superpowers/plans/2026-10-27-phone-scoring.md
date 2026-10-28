# Phone scoring implementation plan

**Goal:** Implement the user-approved three-second regular-goal save and visible-live-game screen wake lock.
**Architecture:** Keep the existing GoalDialog and save/revision pipeline. Add cancellable, single-flight timer state to the dialog. Isolate browser wake-lock lifecycle in a hook and render a small live-only status/toggle.
**Tech stack:** React 19, TypeScript, native dialog and Screen Wake Lock APIs, Vitest/jsdom. No extra dependencies or browser automation.
**Spec:** Conversation approval: regular goal saves after 3 seconds without flag interaction; flag interaction permanently cancels timer for that dialog; manual submit and cancel remain; edits never auto-save; tap timestamp stays unchanged. Automatically request wake lock only on visible live game, release on hide/leave/end/off, reacquire on return, accurately display unavailable/released/requesting states.

## Review focus
- Countdown racing a manual save or native-dialog dismissal must never duplicate/save a cancelled point.
- Parent rerenders must not restart countdown or capture stale save callbacks.
- Failed saves must remain reviewable and must not auto-retry.
- Pending wake-lock requests resolving after hide/unmount/disable must immediately release their sentinel.
- Browser release/refusal/unsupported APIs must not show a false active indicator or affect scoring.

## Task 1: Goal countdown
- [x] Add timer tests: 2999/3000ms boundary, immutable timestamp, StrictMode/rerender, flag toggle, cancellation/Escape/unmount, manual vs automatic race, rejection/manual retry, edit mode.
- [x] Run tests and observe failures before implementation.
- [x] Add countdown with ref guards and latest committed callbacks. Add immediate dismiss notification to native Dialog to cancel before queued close events.
- [x] Verify countdown tests plus existing app flows.

## Task 2: Screen wake lock
- [x] Add hook tests: granted/refused/unsupported, visibility release/reacquire, toggle/finish/unmount, pending and out-of-order resolution, platform release, retry.
- [x] Run tests and observe missing-hook failure.
- [x] Implement hook using visibilitychange/pagehide/pageshow; feature detection and graceful fallback; no fake media tricks. Add live-only indicator with off/on and retry controls.
- [x] Verify tests, mobile CSS constraints and production build.

## Task 3: Review and delivery
- [x] Fresh code review of both features, resolve material findings.
- [x] Full test suite, build and diff check; update README with behavior and HTTPS requirement.
- [x] Leave available on localhost for the user to test their actual phone/browser.

Validation ledger: countdown tests first failed on missing automatic-save behavior; all nine passed after implementation. Wake-lock tests first failed on missing module, then all twelve passed. Fresh code review reported no actionable findings. Actual phone/browser verification is left to the user, per their no-browser-testing instruction.
