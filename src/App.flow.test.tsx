// @vitest-environment jsdom
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { StoreProvider } from './lib/store';
import { LocalRepository, STORAGE_KEY } from './lib/storage';
import { score } from './lib/stats';
import { GoalDialog } from './components/GoalDialog';
import { ConfirmDialog } from './components/Dialog';
import type { Data, Game, Goal, Rivalry } from './lib/types';

vi.mock('./lib/supabase', () => ({ cloudConfigured: false, createCloudRepository: () => { throw new Error('This flow uses browser-local persistence'); } }));
const rivalry: Rivalry = { id: 'r', player_a: 'Ada', player_b: 'Bea', created_at: '2026-01-01T00:00:00Z' };
const goal: Goal = { id: 'goal', actor_side: 'a', rung: 'attacker', flags: [], elapsed_ms: 1000, occurred_at: '2026-01-01T00:00:01Z' };
const baseGame: Game = { id: 'g', rivalry_id: 'r', started_at: '2026-01-01T00:00:00Z', ended_at: null, revision: 1, goals: [] };
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Data;
const seed = (data: Data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
function openApp(path = '/') { return render(<StrictMode><MemoryRouter initialEntries={[path]}><StoreProvider><App/></StoreProvider></MemoryRouter></StrictMode>); }
async function confirm(name: string) { const dialog = await screen.findByRole('dialog'); fireEvent.click(within(dialog).getByRole('button', { name })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); }
beforeEach(() => {
  localStorage.clear();
  seed({ rivalries: [], games: [] });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // Model native open/queued close semantics; no browser automation is involved.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { if (this.open) { this.open = false; queueMicrotask(() => this.dispatchEvent(new Event('close'))); } } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

it('creates, resumes, scores, finishes early, corrects, removes, and deletes a rivalry through the app', async () => {
  openApp();
  fireEvent.click(await screen.findByRole('button', { name: 'New rivalry' }));
  let dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Black side'), { target: { value: 'Ada' } });
  fireEvent.change(within(dialog).getByLabelText('White side'), { target: { value: 'Bea' } });
  await confirm('Create rivalry');
  fireEvent.click(await screen.findByRole('button', { name: 'Start a game' }));
  await screen.findByRole('heading', { name: 'Live game' });
  expect((screen.getByRole('button', { name: 'Finish game' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('link', { name: 'Ada vs Bea' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Resume game' }));
  await screen.findByRole('heading', { name: 'Live game' });
  expect(stored().games).toHaveLength(1);

  const start = Date.parse(stored().games[0].started_at);
  const now = vi.spyOn(Date, 'now').mockReturnValue(start + 1234);
  fireEvent.click(screen.getByRole('button', { name: 'Ada attacker goal' }));
  now.mockReturnValue(start + 9000); // Confirmation must not alter the tap timestamp.
  await confirm('Add goal for Ada');
  expect(stored().games[0].goals[0].elapsed_ms).toBe(1234);
  expect(stored().games[0].goals[0].occurred_at).toBe(new Date(start + 1234).toISOString());

  now.mockReturnValue(start + 10000);
  fireEvent.click(screen.getByRole('button', { name: 'Ada goalie goal' }));
  dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: /Dunk/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: /Bank shot/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: /Own goal/ }));
  await confirm('Add goal for Bea');
  expect(stored().games[0].goals[1].flags).toEqual(['own_goal']);

  now.mockReturnValue(start + 15000);
  fireEvent.click(screen.getByRole('button', { name: 'Bea middle goal' }));
  dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: /Dunk/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: /Bank shot/ }));
  await confirm('Add goal for Bea');
  expect(stored().games[0].goals[2].flags).toEqual(['dunk', 'bank']);
  expect(score(stored().games[0].goals)).toEqual({ a: 1, b: 2 });
  fireEvent.click(screen.getByRole('button', { name: 'Finish game' }));
  expect((await screen.findByRole('dialog')).textContent).toContain('early finish');
  await confirm('Save result');
  await screen.findByRole('heading', { name: 'Game result' });
  expect(screen.getByText('Bea wins.')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Goal actions at 0:15' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit goal at 0:15' }));
  dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Player who hit it'), { target: { value: 'a' } });
  fireEvent.change(within(dialog).getByLabelText('Rung'), { target: { value: 'defender' } });
  await confirm('Save correction');
  expect(screen.getByText('Ada wins.')).toBeTruthy();
  expect(stored().games[0].goals.find(g => g.elapsed_ms === 15000)?.rung).toBe('defender');
  fireEvent.click(screen.getByRole('button', { name: 'Goal actions at 0:15' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove goal at 0:15' }));
  await confirm('Remove goal');
  expect(screen.getByText('Draw.')).toBeTruthy();
  expect(stored().games[0].goals).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Delete game' }));
  await confirm('Delete game');
  expect(stored().games).toHaveLength(0);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete rivalry' }));
  await confirm('Delete rivalry');
  expect(stored()).toEqual({ rivalries: [], games: [] });
  expect(await screen.findByRole('heading', { name: 'No rivalries yet' })).toBeTruthy();
});

it('loads a game deep link, undoes only the latest goal, and finishes a tie manually', async () => {
  seed({ rivalries: [rivalry], games: [{ ...baseGame, goals: [goal, { ...goal, id: 'two', actor_side: 'b', elapsed_ms: 2000 }, { ...goal, id: 'three', elapsed_ms: 3000 }] }] });
  openApp('/game/g');
  fireEvent.click(await screen.findByRole('button', { name: 'Undo goal' }));
  await confirm('Undo goal');
  expect(stored().games[0].goals.map(g => g.id)).toEqual(['goal', 'two']);
  fireEvent.click(screen.getByRole('button', { name: 'Finish game' }));
  expect(await screen.findByRole('heading', { name: 'Finish as a draw?' })).toBeTruthy();
  await confirm('Save result');
  expect(await screen.findByText('Draw.')).toBeTruthy();
  expect(stored().games[0].ended_at).not.toBeNull();
});

it('discards an empty live game and recovers from an unknown deep link', async () => {
  seed({ rivalries: [rivalry], games: [baseGame] });
  const view = openApp('/game/g');
  fireEvent.click(await screen.findByRole('button', { name: 'Discard game' }));
  await confirm('Discard game');
  expect(stored().games).toHaveLength(0);
  expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
  view.unmount();
  openApp('/game/missing');
  expect(await screen.findByRole('heading', { name: 'Game not found' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'All rivalries' }));
  expect(await screen.findByRole('heading', { name: 'Rivalries' })).toBeTruthy();
});

it('keeps a pending goal save open and freezes its fields until the response arrives', async () => {
  let resolve!: () => void;
  const onClose = vi.fn(), pending = new Promise<void>(r => { resolve = r; });
  render(<GoalDialog goal={goal} rivalry={rivalry} editing onSave={() => pending} onClose={onClose}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));
  const dialog = screen.getByRole('dialog');
  expect((within(dialog).getByRole('button', { name: 'Close dialog' }) as HTMLButtonElement).disabled).toBe(true);
  expect((within(dialog).getByLabelText('Rung') as HTMLSelectElement).disabled).toBe(true);
  expect((within(dialog).getByRole('button', { name: /Own goal/ }) as HTMLButtonElement).disabled).toBe(true);
  const cancel = new Event('cancel', { cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => resolve());
  expect(onClose).toHaveBeenCalledOnce();
});

it('keeps a pending destructive confirmation open', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>(r => { resolve = r; });
  render(<ConfirmDialog title="Delete?" description="Remove this game" confirm="Delete" onConfirm={() => pending} onClose={() => {}}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect((screen.getByRole('button', { name: 'Close dialog' }) as HTMLButtonElement).disabled).toBe(true);
  const cancel = new Event('cancel', { cancelable: true });
  fireEvent(screen.getByRole('dialog'), cancel);
  expect(cancel.defaultPrevented).toBe(true);
  await act(async () => resolve());
});

it('keeps rivalry creation open and its names fixed while saving', async () => {
  let resolve!: (rivalry: Rivalry) => void;
  vi.spyOn(LocalRepository.prototype, 'createRivalry').mockImplementation(() => new Promise(r => { resolve = r; }));
  openApp();
  fireEvent.click(await screen.findByRole('button', { name: 'New rivalry' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Black side'), { target: { value: 'Ada' } });
  fireEvent.change(within(dialog).getByLabelText('White side'), { target: { value: 'Bea' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create rivalry' }));
  expect((within(dialog).getByRole('button', { name: 'Close dialog' }) as HTMLButtonElement).disabled).toBe(true);
  expect((within(dialog).getByLabelText('Black side') as HTMLInputElement).disabled).toBe(true);
  await act(async () => resolve(rivalry));
  expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
});

it('announces win by two but keeps scoring live until the user finishes', async () => {
  const goals: Goal[] = Array.from({ length: 18 }, (_, index) => ({ ...goal, id: `goal-${index}`, actor_side: index % 2 ? 'b' : 'a', elapsed_ms: (index + 1) * 1000, occurred_at: new Date(Date.parse(baseGame.started_at) + (index + 1) * 1000).toISOString() }));
  seed({ rivalries: [rivalry], games: [{ ...baseGame, goals }] });
  openApp('/game/g');
  fireEvent.click(await screen.findByRole('button', { name: 'Ada attacker goal' }));
  await confirm('Add goal for Ada');
  expect(score(stored().games[0].goals)).toEqual({ a: 10, b: 9 });
  expect(screen.queryByText(/has the winning score/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Ada attacker goal' }));
  await confirm('Add goal for Ada');
  expect(screen.getByText(/Ada has the winning score/)).toBeTruthy();
  expect(stored().games[0].ended_at).toBeNull();
  expect(screen.getByRole('button', { name: 'Ada attacker goal' })).toBeTruthy();
});

it('rejects an old edit after another tab changes that goal', async () => {
  seed({ rivalries: [rivalry], games: [{ ...baseGame, goals: [goal] }] });
  openApp('/game/g');
  fireEvent.click(await screen.findByRole('button', { name: 'Goal actions at 0:01' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit goal at 0:01' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Rung'), { target: { value: 'middle' } });
  const latest = stored();
  latest.games[0].revision++;
  latest.games[0].goals[0].rung = 'defender';
  seed(latest);
  await act(async () => window.dispatchEvent(new Event('storage')));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save correction' }));
  expect((await within(dialog).findByRole('alert')).textContent).toContain('changed while this dialog was open');
  expect(stored().games[0].goals[0].rung).toBe('defender');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('shows invalid-name errors and allows fixing the names without closing the form', async () => {
  openApp();
  fireEvent.click(await screen.findByRole('button', { name: 'New rivalry' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Black side'), { target: { value: 'Ada' } });
  fireEvent.change(within(dialog).getByLabelText('White side'), { target: { value: ' ada ' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create rivalry' }));
  expect((await within(dialog).findByRole('alert')).textContent).toContain('two different players');
  expect(stored().rivalries).toHaveLength(0);
  fireEvent.change(within(dialog).getByLabelText('White side'), { target: { value: 'Bea' } });
  await confirm('Create rivalry');
  expect(stored().rivalries).toHaveLength(1);
});

it('recovers from unreadable local data through the visible reset control', async () => {
  localStorage.setItem(STORAGE_KEY, '{broken');
  openApp('/game/g');
  expect((await screen.findByRole('alert')).textContent).toContain('Browser data could not be read');
  fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
  await confirm('Clear demo data');
  expect(stored()).toEqual({ rivalries: [], games: [] });
  fireEvent.click(screen.getByRole('link', { name: 'All rivalries' }));
  expect(await screen.findByRole('heading', { name: 'No rivalries yet' })).toBeTruthy();
});

it('automatically commits a tapped regular goal through the real store and keeps its tap time', async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-01-01T00:00:01.234Z'));
    seed({ rivalries: [rivalry], games: [baseGame] });
    openApp('/game/g');
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Ada goalie goal' }));
    expect(screen.getByText('Regular goal saves in 3…')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.queryByRole('dialog')).toBeNull();
    const saved = stored().games[0];
    expect(saved.goals).toHaveLength(1);
    expect(saved.goals[0]).toMatchObject({ actor_side: 'a', rung: 'goalie', flags: [], elapsed_ms: 1234, occurred_at: '2026-01-01T00:00:01.234Z' });
    expect(score(saved.goals)).toEqual({ a: 1, b: 0 });
    expect(saved.revision).toBe(2);
  } finally { vi.useRealTimers(); }
});
