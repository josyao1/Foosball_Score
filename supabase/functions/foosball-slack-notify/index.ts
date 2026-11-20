import { createHandler, type Job } from './worker.ts';

const project = Deno.env.get('SUPABASE_URL') ?? '';
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${project}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Queue operation failed');
  return await response.json() as T;
}

Deno.serve(createHandler({
  authorize: (token) => rpc<boolean>('foos_slack_authorize', { p_token: token }),
  claim: () => rpc<Job | null>('foos_slack_claim'),
  begin: (id, token) => rpc<boolean>('foos_slack_begin', { p_id: id, p_token: token }),
  settle: async (id, token, outcome, error, delay) => {
    await rpc('foos_slack_settle', { p_id: id, p_token: token, p_outcome: outcome, p_error: error, p_delay: delay });
  },
}, Deno.env.get('SLACK_FOOSBALL_WEBHOOK_URL') ?? ''));
