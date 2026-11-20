# Slack final scores implementation plan

**Goal:** Announce each newly finalized game once through the existing Slack workflow.
**Architecture:** Transactional outbox appended to both save RPCs, backend-only claim/settle RPCs, authenticated Edge sender, and minute cron. Slack failures never participate in game saving.
**Tech stack:** PostgreSQL, Supabase Edge Functions (Deno), pg_cron/pg_net/Vault, Vitest.
**Spec:** ../specs/2026-11-19-slack-final-scores.txt

## Constraints and decisions
- Payload keys confirmed by user screenshots: `message`, `game_url`. Workflow is published as Score Update; secret saved by user.
- No browser navigation. No credentials in source, logs, or chat.
- Default disabled. First live test scoped to one clearly marked fake game before general activation.
- Historical/disabled-period finalizations are marked seen, never backfilled. Corrections, reopen/refinish, restore, and refresh cannot produce another notification.
- Worker claims one item per minute. Lease/token prevents ordinary concurrent duplicate processing. Ambiguous network outcomes or expired sending leases require manual review; explicit 429/5xx responses retry with backoff.
- Backend-only settings and logs; the public Backlog route is not an admin authorization boundary.

## Tasks
- [x] Add settings/outbox and post-save hook migration. Preserve existing save functions and revisions; test locally against actual PostgreSQL and both RPC versions.
- [x] Implement dependency-injected sender and mock transport tests: auth, success, invalid secret, transient/permanent errors, timeout, persistence failure, disabled/deleted jobs.
- [x] Add scheduler migration with a generated Vault token and service-only verification. Document disable/resume/discard and uncertain-delivery recovery.
- [ ] Run complete app tests, build, SQL regressions, and Deno type check. Commit/push source before deploying disabled backend.
- [ ] Deploy, verify permissions/config and isolated fake-game delivery, remove test data, then enable new real finalizations. User confirms channel delivery because no Slack read connector is available.

## Review focus
- Saving the final goal must produce the updated score, including own goals.
- Stale revisions, failed goal validation, and concurrent workers must not leak duplicate jobs/posts.
- Disable/delete races are rechecked immediately before dispatch; an already in-flight HTTP request cannot be recalled.
- Never retry a possibly accepted timeout automatically. Slack HTTP acceptance is not proof the workflow's message step completed.
- Player names are escaped for Slack and cannot inject mentions; fixed canonical game links.
