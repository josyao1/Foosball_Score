import { describe, expect, it, vi } from 'vitest';
import { createHandler, retryDelay, validWebhook, type Queue, type Job } from './worker';
const token = 'a'.repeat(64);
const webhook = 'https://hooks.slack.com/triggers/test/secret';
const job: Job = { id: 'job', claim_token: 'lease', attempt_count: 1, payload: { message: '⚽ Final: a 2–1 b', game_url: 'https://foosball-score.vercel.app/game/test' } };
function fixture() {
 const queue: Queue = { authorize: vi.fn(async () => true), claim: vi.fn(async () => job), prepare: vi.fn(async (claimed:Job) => claimed), begin: vi.fn(async () => true), settle: vi.fn(async () => {}) };
 const transport = vi.fn<typeof fetch>(async () => new Response('ok'));
 return { queue, transport, run: (url = webhook, method = 'POST', auth = token) => createHandler(queue, url, transport)(new Request('https://worker.test', { method, headers: { 'x-foos-scheduler-token': auth } })) };
}
describe('Slack sender', () => {
 it('sends the exact workflow fields once after committing sending state', async () => {
  const f = fixture(); expect((await f.run()).status).toBe(200);
  expect(f.transport).toHaveBeenCalledTimes(1);
  expect(f.transport.mock.calls[0][1]).toMatchObject({ body: JSON.stringify({...job.payload,score_line:job.payload.message,highlights:''}), redirect: 'error' });
  expect(vi.mocked(f.queue.begin).mock.invocationCallOrder[0]).toBeLessThan(f.transport.mock.invocationCallOrder[0]);
  expect(f.queue.settle).toHaveBeenCalledWith('job', 'lease', 'sent', null, 60);
 });
 it('rejects missing or invalid authentication before touching the queue', async () => {
  const f = fixture(); expect((await f.run(webhook, 'POST', '')).status).toBe(401);
  vi.mocked(f.queue.authorize).mockResolvedValue(false);
  expect((await f.run()).status).toBe(401); expect(f.queue.claim).not.toHaveBeenCalled(); expect(f.transport).not.toHaveBeenCalled();
  expect((await f.run(webhook, 'GET')).status).toBe(405);
 });
 it('does not claim anything with a missing/malformed webhook', async () => {
  const f = fixture(); expect((await f.run('')).status).toBe(503); expect(f.queue.claim).not.toHaveBeenCalled();
  for (const value of ['http://hooks.slack.com/triggers/x','https://evil.test/triggers/x','https://hooks.slack.com.evil.test/triggers/x','https://user:pass@hooks.slack.com/triggers/x','https://hooks.slack.com/services/x']) expect(validWebhook(value)).toBe(false);
  expect(validWebhook(webhook)).toBe(true);
 });
 it('does not send disabled, deleted, already processed, or lease-lost work', async () => {
  const f = fixture(); vi.mocked(f.queue.claim).mockResolvedValueOnce(null); await f.run();
  vi.mocked(f.queue.begin).mockResolvedValue(false); await f.run();
  expect(f.transport).not.toHaveBeenCalled(); expect(f.queue.settle).not.toHaveBeenCalled();
 });
 it.each([429,500,503])('retries explicit HTTP %i failures later and honors Retry-After', async status => {
  const f = fixture(); f.transport.mockResolvedValue(new Response('private response', { status, headers: { 'Retry-After': '180' } }));
  await f.run(); expect(f.queue.settle).toHaveBeenCalledWith('job', 'lease', 'retry', `slack_http_${status}`, 180);
 });
 it('stops automatic retries after eight attempts and on permanent failures', async () => {
  const f = fixture(); vi.mocked(f.queue.claim).mockResolvedValue({ ...job, attempt_count: 8 });
  f.transport.mockResolvedValue(new Response(null, { status: 503 })); await f.run();
  expect(f.queue.settle).toHaveBeenLastCalledWith('job', 'lease', 'failed', 'slack_http_503', 3600);
  f.transport.mockResolvedValue(new Response(null, { status: 400 })); await f.run();
  expect(f.queue.settle).toHaveBeenLastCalledWith('job', 'lease', 'failed', 'slack_http_400', 60);
 });
 it('quarantines an ambiguous timeout without leaking the webhook or retrying', async () => {
  const f = fixture(); f.transport.mockRejectedValue(new Error(webhook));
  const response = await f.run(); expect(await response.text()).not.toContain(webhook);
  expect(f.queue.settle).toHaveBeenCalledWith('job', 'lease', 'uncertain', 'delivery_outcome_unknown', 60);
  expect(f.transport).toHaveBeenCalledTimes(1);
 });
 it('does not repost if recording success fails after Slack accepted', async () => {
  const f = fixture(); vi.mocked(f.queue.settle).mockRejectedValue(new Error('secret'));
  const response = await f.run(); expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('secret'); expect(f.transport).toHaveBeenCalledTimes(1);
 });
 it('fails closed before sending if the database is unavailable', async () => {
  const f = fixture(); vi.mocked(f.queue.begin).mockRejectedValue(new Error('database'));
  expect((await f.run()).status).toBe(503); expect(f.transport).not.toHaveBeenCalled();
 });
 it('handles invalid, long, and date-form Retry-After without immediate retries', () => {
  expect(retryDelay(1, 'garbage')).toBe(60);
  expect(retryDelay(2, null)).toBe(120);
  expect(retryDelay(1, '999999')).toBe(86400);
  expect(retryDelay(1, 'Thu, 19 Nov 2026 20:02:00 GMT', Date.parse('2026-11-19T20:00:00Z'))).toBe(120);
 });
});

it('sends only the prepared message and URL, without private snapshot data',async()=>{
 const f=fixture();
 const prepared={...job,payload:{...job.payload,message:job.payload.message+'\nFirst-ever 10–7 finish at the table.'},story_snapshot:{private:'snapshot'}};
 vi.mocked(f.queue.prepare).mockResolvedValue(prepared);
 await f.run();
 expect(f.transport.mock.calls[0][1]?.body).toBe(JSON.stringify({...prepared.payload,score_line:job.payload.message,highlights:'First-ever 10–7 finish at the table.'}));
 expect(vi.mocked(f.queue.prepare).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(f.queue.begin).mock.invocationCallOrder[0]);
});
it('never sends on failed preparation or a lost lease',async()=>{
 const f=fixture();vi.mocked(f.queue.prepare).mockRejectedValueOnce(new Error('private'));
 expect((await f.run()).status).toBe(503);expect(f.queue.begin).not.toHaveBeenCalled();expect(f.transport).not.toHaveBeenCalled();
 vi.mocked(f.queue.prepare).mockResolvedValueOnce(null);
 await f.run();expect(f.transport).not.toHaveBeenCalled();
});

it('exposes separately formattable score and indented highlights while retaining the original message',async()=>{
 const f=fixture();
 vi.mocked(f.queue.prepare).mockResolvedValue({...job,payload:{...job.payload,message:'⚽ Final: josh 11–9 kevin · 6:27\n     josh came back from 6–9 to win.\n🏆 Enters the Hall of Fame at #1.'}});
 await f.run();
 expect(JSON.parse(f.transport.mock.calls[0][1]!.body as string)).toEqual({
  message:'⚽ Final: josh 11–9 kevin · 6:27\n     josh came back from 6–9 to win.\n🏆 Enters the Hall of Fame at #1.',
  game_url:job.payload.game_url,
  score_line:'⚽ Final: josh 11–9 kevin · 6:27',
  highlights:'     josh came back from 6–9 to win.\n🏆 Enters the Hall of Fame at #1.',
 });
});
