# Slack final scores

The published **Score Update** workflow receives two text fields, `message` and `game_url`, and posts to the private foosball channel. The browser never knows its webhook URL. A game becomes eligible only after its first successful final save, not when it reaches a winning score.

## Installation

Apply the existing setup files through `weekly-feature.sql`, then the timestamped Slack migrations in filename order. The latter requires hosted Supabase Vault, pg_cron, and pg_net. The scheduler's project URL is explicitly scoped to `iqiffravpddrvpwqbrkm`; change it for another installation.

Deploy `supabase/functions/foosball-slack-notify/index.ts` and `worker.ts`. Keep `verify_jwt = false`: the handler requires a random 256-bit scheduler token, authenticated through a service-only database RPC before accessing the queue. The token is generated inside PostgreSQL, stored in Vault, and its SHA-256 digest stored in backend-only settings. No token appears in cron's command text. The service-role key is Supabase's built-in server environment variable, never a Vite variable.

Set `SLACK_FOOSBALL_WEBHOOK_URL` in Edge Function secrets. Do not commit, print, screenshot, or log its value. Deployment starts with notifications disabled. The workflow's webhook must use HTTPS on hooks.slack.com with a `/triggers/` or `/workflows/` path.

The migration preserves the existing save RPC definitions and appends a single internal call after goal replacement. It rejects unexpected function shapes. Reapplying old setup files afterward replaces that hook; deploy a new migration to reattach it if save RPCs change. `slack_first_finalized_at` remembers finished games, even during disabled periods. Existing historical games are marked seen without queueing. Imports whose end time precedes activation stay silent.

## Controlled activation

Before general activation, set `test_game_id` to a freshly generated fake game's ID, set `activation_timestamp=clock_timestamp()`, and enable notifications in one transaction. Only that game can queue or dispatch. Create a clearly labeled test rivalry; finalize via the same save RPC used by Finish game. A successful Edge response means the webhook accepted the request; check Slack's channel/workflow history to confirm the message step succeeded. Then remove the fake rivalry through the normal archive/purge RPCs and remove its test-only players if no longer referenced. Queue audit rows remain. Deleting data cannot delete a Slack post.

After the isolated test succeeds:

```sql
update public.foos_slack_settings
set notifications_enabled=true, activation_timestamp=clock_timestamp(), test_game_id=null
where id;
```

This is a PostgreSQL-admin operation, not a public Backlog control. The app's Backlog is shared/public and does not provide admin authentication.

## Disable, resume, and discard

Disable immediately:

```sql
update public.foos_slack_settings set notifications_enabled=false where id;
```

This stops enqueueing and dispatch authorization. An HTTP request already in flight cannot be recalled. Normal games continue saving. The minute cron does not invoke the Edge Function while disabled or while no jobs are ready.

Before enabling again, explicitly choose whether to resume existing pending jobs or discard them. To discard, while disabled:

```sql
update public.foos_slack_outbox
set status='skipped', last_error='discarded_by_operator', claimed_until=null, claim_token=null
where status in ('pending','claimed');
```

Then enable with a new activation timestamp as above. To resume instead, omit the discard. Games first finished while disabled never backfill either way.

## Delivery behavior and logs

- Each new finalization queues one immediate sender wake-up via pg_net. HTTP runs only after the save commits. Row locks and random lease tokens serialize concurrent workers; a one-second global cooldown protects against bursts. The minute cron retries missed wake-ups and due failures, without invoking the function when idle, disabled, backing off, or already sending.
- If queueing the immediate wake-up fails, the game and durable notification still save; cron provides the fallback.
- Finalization and queue insert commit together. Slack availability is entirely outside the save transaction.
- Both current/legacy saves, both finish buttons, early finishes and draws work. Own goals credit the opposite side. Team names come from ordered roster membership, with safe Slack escaping. Slack supplies the sent timestamp; the message contains only the result and game link.
- A unique game/destination pair plus first-finalization marker prevents corrections, reopen/refinish, restore, refresh, and rematch creation from posting again.
- Deletion cancels pending/claimed jobs immediately, even if restored before polling. The worker also rechecks availability and the enable switch immediately before sending.
- Explicit HTTP 429/5xx responses retry with exponential delay (one minute to one hour; respect Retry-After up to one day), at most eight attempts. Other HTTP failures stop as `failed`.
- Network/timeout ambiguity and expired `sending` leases become `uncertain` and never automatically retry. Check Slack before manually resolving. A crash before the sending transition can safely reclaim the job.
- `sent` means HTTP acceptance, not independently confirmed channel delivery. Successful HTTP acknowledgement followed by a database failure leaves an uncertain job after its lease expires.
- Payloads retain the result at first finalization. Later corrections appear at the linked game; they do not post again.

Inspect without printing credentials:

```sql
select notifications_enabled,activation_timestamp,test_game_id,last_dispatch_at
from public.foos_slack_settings;
select id,game_id,status,attempt_count,next_attempt_at,sent_at,last_error,created_at
from public.foos_slack_outbox order by created_at desc limit 50;
select jobid,schedule,active from cron.job where jobname='foosball-slack-notify';
```

For a failed/uncertain item, first check the channel. If it already posted, mark sent. Otherwise, consciously retry that one item by setting `status='pending'`, `next_attempt_at=clock_timestamp()`, `attempt_count=0`, `claim_token=null`, `claimed_until=null`, and clearing `last_error`. Do not batch-retry uncertain deliveries. Raw exception strings and Slack response bodies are deliberately excluded from persisted errors.

## Verification

`npm test -- --maxWorkers=2` includes mocked worker tests and existing Finish game / Finish & rematch UI flows. `npm run build` checks the app. `deno check supabase/functions/foosball-slack-notify/index.ts` checks the deployed code without npm dependencies.

On an isolated local PostgreSQL database, apply existing schemas and the outbox migration (plus subsequent payload-format migrations), then run `supabase/slack-check.sql` (rollback-only). Run `python3 tests/slack-concurrency.py postgresql://127.0.0.1:PORT/foos_slack` for true overlapping saves/claims. It refuses non-local/non-test database targets. The scheduler migration needs hosted extensions; verify its cron registration and authenticated invocation separately while delivery is disabled.

Reference: Supabase's [scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) and [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) documentation.

`supabase/slack-immediate-check.sql` tests immediate dispatch with transaction-scoped pg_net/Vault stand-ins: no calls while scoring, one per finalization, no call on corrections, rollback, disabled/idle/backoff behavior, and failed-wake recovery. It rolls back both fixtures and the immediate-dispatch migration.
