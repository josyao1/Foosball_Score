export type Job = { id: string; claim_token: string; attempt_count: number; payload: { message: string; game_url: string } };
export type Outcome = 'sent' | 'retry' | 'failed' | 'uncertain';
export interface Queue {
  authorize(token: string): Promise<boolean>;
  claim(): Promise<Job | null>;
  begin(id: string, token: string): Promise<boolean>;
  settle(id: string, token: string, outcome: Outcome, error: string | null, delay: number): Promise<void>;
}

// Do not log exceptions, Slack response bodies, headers, or the webhook URL.
export function validWebhook(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'hooks.slack.com' &&
      !u.username && !u.password && !u.port && /^\/(?:triggers|workflows)\//.test(u.pathname);
  } catch { return false; }
}

export function retryDelay(attempt: number, retryAfter: string | null, now = Date.now()): number {
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  const requested = Number.isFinite(seconds) ? seconds : (Date.parse(retryAfter ?? '') - now) / 1000;
  return Math.ceil(Math.max(60, Math.min(3600, 60 * 2 ** Math.min(attempt - 1, 6)), Number.isFinite(requested) ? Math.min(requested, 86400) : 0));
}

export function createHandler(queue: Queue, webhook: string, transport: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const reply = (status: number, state: string) => Response.json({ state }, { status });
    if (request.method !== 'POST') return reply(405, 'method_not_allowed');
    const token = request.headers.get('x-foos-scheduler-token') ?? '';
    if (!/^[a-f0-9]{64}$/.test(token)) return reply(401, 'unauthorized');
    try {
      if (!await queue.authorize(token)) return reply(401, 'unauthorized');
      if (!validWebhook(webhook)) return reply(503, 'webhook_not_configured');
      const job = await queue.claim();
      if (!job) return reply(200, 'idle');
      // Persist sending BEFORE the external side effect. A crashed/expired sender
      // goes to uncertain, never back to pending automatically.
      if (!await queue.begin(job.id, job.claim_token)) return reply(200, 'skipped');
      let outcome: Outcome;
      let error: string | null = null;
      let delay = 60;
      try {
        const response = await transport(webhook, {
          method: 'POST', redirect: 'error',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(job.payload), signal: AbortSignal.timeout(10000),
        });
        if (response.ok) outcome = 'sent';
        else if (response.status === 429 || response.status >= 500) {
          outcome = job.attempt_count >= 8 ? 'failed' : 'retry';
          delay = retryDelay(job.attempt_count, response.headers.get('retry-after'));
          error = `slack_http_${response.status}`;
        } else {
          outcome = 'failed'; error = `slack_http_${response.status}`;
        }
        await response.body?.cancel();
      } catch {
        outcome = 'uncertain'; error = 'delivery_outcome_unknown';
      }
      await queue.settle(job.id, job.claim_token, outcome, error, delay);
      return reply(200, outcome);
    } catch {
      // If the settlement failed after Slack accepted, the sending lease expires
      // to uncertain. Never retry HTTP here.
      return reply(503, 'backend_unavailable');
    }
  };
}
