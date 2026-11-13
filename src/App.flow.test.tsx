// @vitest-environment jsdom
import { StrictMode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { StoreProvider } from './lib/store';
import { LocalRepository, STORAGE_KEY } from './lib/storage';
import { score } from './lib/stats';
import { defaultLineup } from './lib/participants';
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

it('uses the permanent table layout and preserves attribution and pause state when flipping sides', async () => {
  seed({rivalries:[rivalry], games:[{...baseGame, goals:[goal]}]});
  openApp('/game/g');
  await screen.findByRole('heading', {name:'Live game'});
  expect(screen.queryByRole('tablist', {name:'Scoring layout'})).toBeNull();
  expect(screen.getAllByRole('button', {name:'Full screen'})).toHaveLength(1);
  expect(screen.getAllByRole('group', {name:/scoring rungs/}).map(pad=>pad.getAttribute('aria-label')))
    .toEqual(['White scoring rungs','Black scoring rungs']);
  const beforeFlip = stored().games[0];
  fireEvent.click(screen.getByRole('button', {name:'Flip sides'}));
  const pads = screen.getAllByRole('group', {name:/scoring rungs/});
  expect(pads.map(pad=>pad.getAttribute('aria-label'))).toEqual(['Black scoring rungs','White scoring rungs']);
  expect(within(pads[0]).getAllByRole('button').map(button=>button.getAttribute('aria-label'))).toEqual(
    ['attacker','middle','defender','goalie'].map(rung=>`Ada ${rung} goal`));
  expect(stored().games[0]).toEqual(beforeFlip);
  fireEvent.click(screen.getByRole('button', {name:'Bea defender goal'}));
  await confirm('Add goal for Bea');
  expect(stored().games).toHaveLength(1);
  expect(stored().games[0].goals.at(-1)).toMatchObject({actor_side:'b', rung:'defender'});
  fireEvent.click(screen.getByRole('button', {name:'Pause game'}));
  await screen.findByRole('button', {name:'Resume game'});
  expect((screen.getByRole('button', {name:'Ada attacker goal'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', {name:'Flip sides'}));
  expect((screen.getByRole('button', {name:'Ada attacker goal'}) as HTMLButtonElement).disabled).toBe(true);
});

it('creates, resumes, scores, finishes early, corrects, removes, and deletes a rivalry through the app', async () => {
  seed({rivalries:[],games:[],players:[{id:'ada',name:'Ada',created_at:''},{id:'bea',name:'Bea',created_at:''}]});
  openApp();
  fireEvent.click(await screen.findByRole('button', { name: 'New rivalry' }));
  let dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('checkbox',{name:'Ada on Black'}));
  fireEvent.click(within(dialog).getByRole('checkbox',{name:'Bea on White'}));
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
  expect(stored().games[0].deleted_at).toBeTruthy();
  expect(stored().games[0].goals).toHaveLength(2);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete rivalry' }));
  await confirm('Delete rivalry');
  expect(stored().rivalries[0].deleted_at).toBeTruthy();
  expect((await new LocalRepository(localStorage).load()).games).toEqual([]);
  expect(stored().players).toHaveLength(2);
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
  vi.spyOn(LocalRepository.prototype, 'createTeamRivalry').mockImplementation(() => new Promise(r => { resolve = r; }));
  seed({rivalries:[],games:[],players:[{id:'ada',name:'Ada',created_at:''},{id:'bea',name:'Bea',created_at:''}]});
  openApp();
  fireEvent.click(await screen.findByRole('button', { name: 'New rivalry' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('checkbox',{name:'Ada on Black'}));
  fireEvent.click(within(dialog).getByRole('checkbox',{name:'Bea on White'}));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create rivalry' }));
  expect((within(dialog).getByRole('button', { name: 'Close dialog' }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(dialog).getAllByRole('checkbox').every(el=>(el as HTMLInputElement).disabled)).toBe(true);
  await act(async () => resolve(rivalry));
  expect(await screen.findByRole('button', { name: 'Start a game' })).toBeTruthy();
});

it('prompts at win by two, skips 10–9, and keeps scoring live when asked', async () => {
  const goals: Goal[] = Array.from({ length: 18 }, (_, index) => ({ ...goal, id: `goal-${index}`, actor_side: index % 2 ? 'b' : 'a', elapsed_ms: (index + 1) * 1000, occurred_at: new Date(Date.parse(baseGame.started_at) + (index + 1) * 1000).toISOString() }));
  seed({ rivalries: [rivalry], games: [{ ...baseGame, goals }] });
  openApp('/game/g');
  fireEvent.click(await screen.findByRole('button', { name: 'Ada attacker goal' }));
  await confirm('Add goal for Ada');
  expect(score(stored().games[0].goals)).toEqual({ a: 10, b: 9 });
  expect(screen.queryByText(/has the winning score/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Ada attacker goal' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add goal for Ada' }));
  const winning = await screen.findByRole('dialog', {name:'Winning score'});
  fireEvent.click(within(winning).getByRole('button', {name:'Keep playing'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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

it('prevents selecting the same player on both sides', async () => {
  seed({rivalries:[],games:[],players:[{id:'ada',name:'Ada',created_at:''},{id:'bea',name:'Bea',created_at:''}]});
  openApp();fireEvent.click(await screen.findByRole('button',{name:'New rivalry'}));
  const dialog=await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('checkbox',{name:'Ada on Black'}));
  expect((within(dialog).getByRole('checkbox',{name:'Ada on White'}) as HTMLInputElement).disabled).toBe(true);
  expect((within(dialog).getByRole('button',{name:'Create rivalry'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(dialog).getByRole('checkbox',{name:'Bea on White'}));
  await confirm('Create rivalry');expect(stored().rivalries).toHaveLength(1);
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

function scoredGame(a:number,b:number):Game {
 const sides:Goal['actor_side'][]=[...Array<Goal['actor_side']>(a).fill('a'),...Array<Goal['actor_side']>(b).fill('b')];
 return {...baseGame,goals:sides.map((side,i)=>({...goal,id:`scored-${i}`,actor_side:side,elapsed_ms:(i+1)*1000,occurred_at:new Date(Date.parse(baseGame.started_at)+(i+1)*1000).toISOString()}))};
}
async function winningPopup(){return screen.findByRole('dialog',{name:'Winning score'})}
it('opens the winning popup after a regular goal auto-saves, and undo restores the previous score', async()=>{
 vi.useFakeTimers();
 try {
  vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
  seed({rivalries:[rivalry],games:[scoredGame(9,8)]});
  openApp('/game/g');
  await act(async()=>{});
  fireEvent.click(screen.getByRole('button',{name:'Ada attacker goal'}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(3000)});
  const dialog=screen.getByRole('dialog',{name:'Winning score'});
  expect(score(stored().games[0].goals)).toEqual({a:10,b:8});
  fireEvent.click(within(dialog).getByRole('button',{name:'Undo goal'}));
  await act(async()=>{});
  expect(score(stored().games[0].goals)).toEqual({a:9,b:8});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(stored().games[0].ended_at).toBeNull();
 } finally {vi.useRealTimers()}
});
it('finishes directly from the winning popup without a second confirmation', async()=>{
 seed({rivalries:[rivalry],games:[scoredGame(10,8)]});
 openApp('/game/g');
 fireEvent.click(within(await winningPopup()).getByRole('button',{name:'Finish game'}));
 await screen.findByRole('heading',{name:'Game result'});
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(stored().games).toHaveLength(1);
 expect(stored().games[0].ended_at).not.toBeNull();
 expect(score(stored().games[0].goals)).toEqual({a:10,b:8});
});
it('keeps a winning game live across polling and reopens after the next goal', async()=>{
 seed({rivalries:[rivalry],games:[scoredGame(10,8)]});
 openApp('/game/g');
 fireEvent.click(within(await winningPopup()).getByRole('button',{name:'Keep playing'}));
 await act(async()=>window.dispatchEvent(new Event('storage')));
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(stored().games[0].ended_at).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Ada goalie goal'}));
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Add goal for Ada'}));
 expect(await winningPopup()).toBeTruthy();
 expect(score(stored().games[0].goals)).toEqual({a:11,b:8});
});
it('credits an own goal to the opponent before opening the winning popup', async()=>{
 seed({rivalries:[rivalry],games:[scoredGame(8,9)]});
 openApp('/game/g');
 const rung = await screen.findByRole('button',{name:'Ada goalie goal'});
 await waitFor(() => expect((rung as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(rung);
 const dialog=screen.getByRole('dialog');
 fireEvent.click(within(dialog).getByRole('button',{name:/Own goal/}));
 fireEvent.click(within(dialog).getByRole('button',{name:'Add goal for Bea'}));
 expect((await winningPopup()).textContent).toContain('Bea has the winning score');
 expect(score(stored().games[0].goals)).toEqual({a:8,b:10});
});
it('saves the result and immediately opens one fresh rematch', async()=>{
 seed({rivalries:[rivalry],games:[scoredGame(10,8)]});
 openApp('/game/g');
 fireEvent.click(within(await winningPopup()).getByRole('button',{name:'Finish & rematch'}));
 await waitFor(()=>expect(stored().games).toHaveLength(2));
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(await screen.findByRole('heading',{name:'Live game'})).toBeTruthy();
 expect(screen.getAllByRole('button',{name:'Full screen'})).toHaveLength(1);
 const old=stored().games.find(g=>g.id==='g')!,next=stored().games.find(g=>g.id!=='g')!;
 expect(old.ended_at).not.toBeNull();
 expect(old.goals).toHaveLength(18);
 expect(next).toMatchObject({rivalry_id:'r',ended_at:null,revision:1,goals:[]});
 expect(Date.parse(next.started_at)).toBeGreaterThanOrEqual(Date.parse(old.ended_at!));
 expect(Array.from(document.querySelectorAll('.gs-rematch-old')).map(node=>node.textContent)).toEqual(['10','8']);
 expect(Array.from(document.querySelectorAll('.gs-rematch-new')).map(node=>node.textContent)).toEqual(['0','0']);
 expect((screen.getByRole('button',{name:'Ada attacker goal'}) as HTMLButtonElement).disabled).toBe(false);
 expect((screen.getByRole('button',{name:'Finish game'}) as HTMLButtonElement).disabled).toBe(true);
});
it('preserves the saved result when rematch creation fails and retries without finishing twice', async()=>{
 seed({rivalries:[rivalry],games:[scoredGame(10,8)]});
 const original=LocalRepository.prototype.saveGame;
 let failed=false;
 vi.spyOn(LocalRepository.prototype,'saveGame').mockImplementation(function(this:LocalRepository,g:Game){
  if(g.id!=='g'&&!failed){failed=true;return Promise.reject(new Error('Connection interrupted'))}
  return original.call(this,g);
 });
 openApp('/game/g');
 fireEvent.click(within(await winningPopup()).getByRole('button',{name:'Finish & rematch'}));
 const dialog=await screen.findByRole('dialog',{name:'Game saved'});
 expect((await within(dialog).findByRole('alert')).textContent).toContain('Connection interrupted');
 expect(stored().games).toHaveLength(1);
 expect(stored().games[0]).toMatchObject({revision:2});
 expect(stored().games[0].ended_at).not.toBeNull();
 fireEvent.click(within(dialog).getByRole('button',{name:'Start rematch'}));
 await waitFor(()=>expect(stored().games).toHaveLength(2));
 expect(stored().games.find(g=>g.id==='g')!.revision).toBe(2);
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
it('blocks stale winning-score choices after another device changes the score', async()=>{
 seed({rivalries:[rivalry],games:[scoredGame(10,8)]});
 openApp('/game/g');
 const dialog=await winningPopup();
 const latest=stored();latest.games[0].revision++;latest.games[0].goals.pop();seed(latest);
 await act(async()=>window.dispatchEvent(new Event('storage')));
 expect((within(dialog).getByRole('button',{name:'Finish game'}) as HTMLButtonElement).disabled).toBe(true);
 expect((within(dialog).getByRole('button',{name:'Undo goal'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(within(dialog).getByRole('button',{name:'Review score'}));
 expect(await winningPopup()).toBeTruthy();
 expect(stored().games[0].ended_at).toBeNull();
});
it('keeps all winning choices locked while saving and ignores a second rematch tap', async()=>{
 seed({rivalries:[rivalry],games:[scoredGame(10,8)]});
 const original=LocalRepository.prototype.saveGame;
 let resolve!:()=>void;
 const waiting=new Promise<void>(r=>{resolve=r});
 vi.spyOn(LocalRepository.prototype,'saveGame').mockImplementation(async function(this:LocalRepository,g:Game){
  if(g.id==='g'&&g.ended_at)await waiting;
  return original.call(this,g);
 });
 openApp('/game/g');
 const dialog=await winningPopup(),button=within(dialog).getByRole('button',{name:'Finish & rematch'});
 fireEvent.click(button);fireEvent.click(button);
 expect(within(dialog).getAllByRole('button').every(b=>(b as HTMLButtonElement).disabled)).toBe(true);
 const cancel=new Event('cancel',{cancelable:true});fireEvent(dialog,cancel);expect(cancel.defaultPrevented).toBe(true);
 expect(stored().games).toHaveLength(1);
 await act(async()=>resolve());
 await waitFor(()=>expect(stored().games).toHaveLength(2));
 expect(stored().games.filter(g=>!g.ended_at)).toHaveLength(1);
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
it('does not start a rematch if saving the result fails', async()=>{
 seed({rivalries:[rivalry],games:[scoredGame(10,8)]});
 const saving=vi.spyOn(LocalRepository.prototype,'saveGame').mockRejectedValue(new Error('Unable to save result'));
 openApp('/game/g');
 const dialog=await winningPopup();
 fireEvent.click(within(dialog).getByRole('button',{name:'Finish & rematch'}));
 expect((await within(dialog).findByRole('alert')).textContent).toContain('Unable to save result');
 expect(saving).toHaveBeenCalledOnce();
 expect(stored().games).toHaveLength(1);
 expect(stored().games[0].ended_at).toBeNull();
 expect((within(dialog).getByRole('button',{name:'Keep playing'}) as HTMLButtonElement).disabled).toBe(false);
});
it('resumes the existing rematch after a create response is lost instead of duplicating it', async()=>{
 seed({rivalries:[rivalry],games:[scoredGame(10,8)]});
 const original=LocalRepository.prototype.saveGame;
 let lost=false;
 vi.spyOn(LocalRepository.prototype,'saveGame').mockImplementation(async function(this:LocalRepository,g:Game){
  const result=await original.call(this,g);
  if(g.id!=='g'&&!lost){lost=true;throw new Error('Response lost')}
  return result;
 });
 openApp('/game/g');
 fireEvent.click(within(await winningPopup()).getByRole('button',{name:'Finish & rematch'}));
 const dialog=await screen.findByRole('dialog',{name:'Game saved'});
 await within(dialog).findByRole('alert');
 expect(stored().games).toHaveLength(2);
 fireEvent.click(within(dialog).getByRole('button',{name:'Start rematch'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(stored().games).toHaveLength(2);
 expect(screen.getByRole('heading',{name:'Live game'})).toBeTruthy();
});

function HistoryBackControl(){const navigate=useNavigate();return <button onClick={()=>navigate(-1)}>Browser back</button>}
it('does not create a rematch or pull the user back after leaving during a pending finish', async()=>{
 seed({rivalries:[rivalry],games:[scoredGame(10,8)]});
 const original=LocalRepository.prototype.saveGame;
 let resolve!:()=>void;
 const waiting=new Promise<void>(r=>{resolve=r});
 vi.spyOn(LocalRepository.prototype,'saveGame').mockImplementation(async function(this:LocalRepository,g:Game){
  if(g.id==='g'&&g.ended_at)await waiting;
  return original.call(this,g);
 });
 render(<StrictMode><MemoryRouter initialEntries={['/','/game/g']}><StoreProvider><App/><HistoryBackControl/></StoreProvider></MemoryRouter></StrictMode>);
 fireEvent.click(within(await winningPopup()).getByRole('button',{name:'Finish & rematch'}));
 // Simulate a browser history action, which is available outside the modal.
 fireEvent.click(screen.getByRole('button',{name:'Browser back'}));
 await screen.findByRole('heading',{name:'Rivalries'});
 await act(async()=>resolve());
 expect(screen.getByRole('heading',{name:'Rivalries'})).toBeTruthy();
 expect(stored().games).toHaveLength(1);
 expect(stored().games[0].ended_at).not.toBeNull();
});

it('creates a permanent player from the Players tab before any rivalry',async()=>{
 openApp('/players');fireEvent.click(await screen.findByRole('button',{name:'New player'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Player name'}),{target:{value:'Josh'}});
 await confirm('Create player');
 expect(await screen.findByRole('article',{name:'Josh passport'})).toBeTruthy();
 expect(stored().rivalries).toHaveLength(0);expect(stored().players?.[0].name).toBe('Josh');
 fireEvent.click(screen.getByRole('button',{name:'Select profile'}));
 expect(within(screen.getByRole('dialog')).getByRole('button',{name:'Josh'})).toBeTruthy();
});

it('records team goals against individual positions and preserves attribution after swapping and corrections',async()=>{
 seed({rivalries:[{...rivalry,player_a:'Josh and Brooks',player_b:'Andrew'}],games:[baseGame]});
 openApp('/game/g');
 await screen.findByRole('heading',{name:'Live game'});
 expect((screen.getByRole('button',{name:'Josh and Brooks goalie goal'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Use these positions'}));
 await waitFor(()=>expect((screen.getByRole('button',{name:'Josh and Brooks goalie goal'}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Josh and Brooks goalie goal'}));
 fireEvent.click(within(screen.getByRole('dialog',{name:'Add goal'})).getByRole('button',{name:'Add goal for Josh and Brooks'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Add goal'})).toBeNull());
 const josh=stored().players!.find(p=>p.name.toLowerCase()==='josh')!.id;
 expect(stored().games[0].goals[0].lineup?.a.defense).toBe(josh);
 fireEvent.click(screen.getByRole('button',{name:'Swap black positions'}));
 await waitFor(()=>expect(stored().games[0].lineup?.a.attack).toBe(josh));
 fireEvent.click(screen.getByRole('button',{name:'Josh and Brooks attacker goal'}));
 fireEvent.click(within(screen.getByRole('dialog',{name:'Add goal'})).getByRole('button',{name:'Add goal for Josh and Brooks'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Add goal'})).toBeNull());
 expect(stored().games[0].goals[1].lineup?.a.attack).toBe(josh);
 expect(stored().games[0].goals[0].lineup?.a.defense).toBe(josh);
});

it('adds a player inside rivalry creation without losing selected sides or leaving the popup',async()=>{
 seed({rivalries:[],games:[],players:[{id:'ada',name:'Ada',created_at:''},{id:'bea',name:'Bea',created_at:''}]});
 openApp();fireEvent.click(await screen.findByRole('button',{name:'New rivalry'}));
 const dialog=await screen.findByRole('dialog');
 fireEvent.click(within(dialog).getByRole('checkbox',{name:'Ada on Black'}));
 fireEvent.click(within(dialog).getByRole('button',{name:'Add player'}));
 fireEvent.change(within(dialog).getByRole('textbox',{name:'Player name'}),{target:{value:'Cy'}});
 fireEvent.click(within(dialog).getByRole('button',{name:'Save player'}));
 await waitFor(()=>expect(within(dialog).queryByRole('textbox')).toBeNull());
 expect((within(dialog).getByRole('checkbox',{name:'Ada on Black'}) as HTMLInputElement).checked).toBe(true);
 expect(stored().rivalries).toHaveLength(0);
 fireEvent.click(within(dialog).getByRole('checkbox',{name:'Cy on White'}));
 await confirm('Create rivalry');
 expect(stored().rivalries[0]).toMatchObject({player_a:'Ada',player_b:'Cy'});
});

it.each([false, true])('offers to open a reversed team rivalry (created concurrently: %s)', async concurrent => {
  const players = ['Ada','Bea','Cy'].map(name => ({id:name, name, created_at:''}));
  const existing: Rivalry = {...rivalry, player_a:'Ada and Bea', player_b:'Cy',
    members:{a:[players[0],players[1]], b:[players[2]]}};
  seed({players, rivalries:concurrent ? [] : [existing], games:[]});
  openApp();
  fireEvent.click(await screen.findByRole('button',{name:'New rivalry'}));
  const picker = within(await screen.findByRole('dialog'));
  fireEvent.click(picker.getByRole('checkbox',{name:'Cy on Black'}));
  fireEvent.click(picker.getByRole('checkbox',{name:'Bea on White'}));
  fireEvent.click(picker.getByRole('checkbox',{name:'Ada on White'}));
  if (concurrent) seed({players, rivalries:[existing], games:[]});
  fireEvent.click(picker.getByRole('button',{name:'Create rivalry'}));
  const alert = within(await screen.findByRole('dialog',{name:'Rivalry already exists'}));
  expect(alert.getByRole('link',{name:'Open rivalry'}).getAttribute('href')).toBe('/rivalry/r');
  fireEvent.click(alert.getByRole('button',{name:'Change players'}));
  const retry = within(await screen.findByRole('dialog',{name:'New rivalry'}));
  expect((retry.getByRole('checkbox',{name:'Cy on Black'}) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(retry.getByRole('button',{name:'Create rivalry'}));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('link',{name:'Open rivalry'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(stored().rivalries).toHaveLength(1);
});

it('keeps repeat achievements and the removed highlight pills out of the result', async () => {
  const blanked = scoredGame(10,0);
  const matches = [1,2,3].map(n=>({...blanked,id:'match'+n,ended_at:`2026-01-01T00:0${n}:00Z`}));
  seed({rivalries:[rivalry],games:matches});
  openApp('/game/match2');
  await screen.findByRole('heading',{name:'Game result'});
  expect(screen.queryByRole('region',{name:'Achievements earned this game'})).toBeNull();
  expect(screen.queryByRole('button',{name:/Ada: Perfect paper. Achievement details/})).toBeNull();
  expect(screen.getByRole('button',{name:'Share ticket'}).closest('.game-heading-actions')).toBeTruthy();
});

it('stamps a first achievement on the live game’s saved result ticket', async () => {
  seed({rivalries:[rivalry],games:[scoredGame(10,0)]});
  openApp('/game/g');
  fireEvent.click(within(await winningPopup()).getByRole('button',{name:'Finish game'}));
  const earns = await screen.findByRole('region',{name:'Achievements earned this game'});
  expect(earns.classList.contains('ticket-earns-new')).toBe(true);
  const first = within(earns).getByText('Perfect paper').closest('li')!;
  expect(first.classList.contains('first-earn')).toBe(true);
  expect(within(first).queryByText(/×/)).toBeNull();
});

it('scores through the mirrored table controls and keeps the game score visible during confirmation', async () => {
  seed({rivalries: [rivalry], games: [{...baseGame, goals: [goal]}]});
  openApp('/game/g');
  fireEvent.click(await screen.findByRole('button', {name: 'Full screen'}));
  const table = within(await screen.findByRole('dialog', {name: 'Full screen scoring'}));
  const near = within(table.getByRole('group', {name:'Near side: Ada'}));
  const far = within(table.getByRole('group', {name:'Far side: Bea'}));
  expect(near.getAllByRole('button').map(b=>b.getAttribute('aria-label'))).toEqual(
    ['goalie','defender','middle','attacker'].map(rung=>`Ada ${rung} goal`)
  );
  expect(far.getAllByRole('button').map(b=>b.getAttribute('aria-label'))).toEqual(
    ['attacker','middle','defender','goalie'].map(rung=>`Bea ${rung} goal`)
  );
  expect(table.queryByRole('button',{name:'Flip sides'})).toBeNull();
  fireEvent.click(far.getByRole('button',{name:'Bea defender goal'}));
  const confirmation = within(screen.getByRole('dialog',{name:'Add goal'}));
  expect(confirmation.getByLabelText('Current score').textContent).toContain('1 – 0');
  fireEvent.click(confirmation.getByRole('button',{name:'Bank shot'}));
  fireEvent.click(confirmation.getByRole('button',{name:'Add goal for Bea'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Add goal'})).toBeNull());
  expect(stored().games[0].goals).toHaveLength(2);
  expect(stored().games[0].goals[1]).toMatchObject({actor_side:'b',rung:'defender',flags:['bank']});
  expect(table.getByRole('status',{name:'Current score'}).textContent).toBe('Ada1Bea1');
  fireEvent.click(table.getByRole('button',{name:'Exit full screen'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Full screen scoring'})).toBeNull());
  expect(screen.getByRole('button',{name:'Ada goalie goal'})).toBeTruthy();
});

it('keeps the active wake lock while opening and closing full-screen scoring', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');
  const locks: (EventTarget & {release: ReturnType<typeof vi.fn>})[] = [];
  const request = vi.fn(async () => {
    const lock = Object.assign(new EventTarget(), {released: false, release: vi.fn(async () => {})});
    locks.push(lock);
    return lock;
  });
  Object.defineProperty(navigator, 'wakeLock', {configurable:true, value:{request}});
  try {
    seed({rivalries:[rivalry], games:[baseGame]});
    const view = openApp('/game/g');
    await screen.findByRole('heading', {name:'Live game'});
    await waitFor(()=>expect(request).toHaveBeenCalled());
    await waitFor(()=>expect(screen.queryByRole('switch',{name:'Keep screen awake'})).toBeNull());
    expect(screen.queryByText('Screen awake')).toBeNull();
    const held = locks.at(-1)!;
    const requests = request.mock.calls.length;
    fireEvent.click(screen.getByRole('button', {name:'Full screen'}));
    const table = await screen.findByRole('dialog', {name:'Full screen scoring'});
    fireEvent.click(within(table).getByRole('button', {name:'Exit full screen'}));
    await waitFor(() => expect(table.hasAttribute('open')).toBe(false));
    expect(held.release).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(requests);
    act(()=>held.dispatchEvent(new Event('release')));
    await screen.findByText('Screen may sleep');
    fireEvent.click(screen.getByRole('button',{name:'Try again'}));
    await waitFor(()=>expect(screen.queryByText('Screen may sleep')).toBeNull());
    const renewed = locks.at(-1)!;
    view.unmount();
    expect(renewed.release).toHaveBeenCalledOnce();
  } finally {
    if (previous) Object.defineProperty(navigator, 'wakeLock', previous);
    else Reflect.deleteProperty(navigator, 'wakeLock');
  }
});

it('lets a scorer dismiss a declined wake lock and activate it on a later full-screen visit', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');
  const request = vi.fn().mockRejectedValue(new Error('Power saving'));
  Object.defineProperty(navigator, 'wakeLock', {configurable:true, value:{request}});
  try {
    seed({rivalries:[rivalry], games:[baseGame]});
    openApp('/game/g');
    await screen.findByText('Screen may sleep');
    fireEvent.click(screen.getByRole('button', {name:'Full screen'}));
    const prompt = await screen.findByRole('dialog', {name:'Keep screen awake?'});
    fireEvent.click(within(prompt).getByRole('button', {name:'Dismiss'}));
    expect(screen.queryByRole('dialog', {name:'Keep screen awake?'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name:'Exit full screen'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name:'Full screen scoring'})).toBeNull());
    fireEvent.click(screen.getByRole('button', {name:'Full screen'}));
    const reopened = await screen.findByRole('dialog', {name:'Keep screen awake?'});
    request.mockResolvedValue(Object.assign(new EventTarget(), {released:false, release:async () => {}}));
    fireEvent.click(within(reopened).getByRole('button', {name:'Turn on'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name:'Keep screen awake?'})).toBeNull());
    const table = within(screen.getByRole('dialog', {name:'Full screen scoring'}));
    expect(table.queryByText('Screen awake')).toBeNull();
    expect(table.getByRole('button',{name:'Ada goalie goal'})).toBeTruthy();
  } finally {
    if (previous) Object.defineProperty(navigator, 'wakeLock', previous);
    else Reflect.deleteProperty(navigator, 'wakeLock');
  }
});

it('moves finished games to backlog, restores stats, and only purges after confirmation',async()=>{
 seed({rivalries:[rivalry],games:[{...baseGame,ended_at:'2026-01-01T00:01:00Z',goals:[goal]}]});
 openApp('/game/g');
 fireEvent.click(await screen.findByRole('button',{name:'Delete game'}));await confirm('Delete game');
 expect((await new LocalRepository(localStorage).load()).games).toEqual([]);
 expect(screen.queryByRole('link',{name:'Backlog'})).toBeNull();
 cleanup();openApp('/backlog');
 await screen.findByRole('heading',{name:'Games 1'});
 expect(screen.getByText(/Game time 1:00/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Undo'}));
 await screen.findByText('Restored. Stats are up to date.');
 expect((await new LocalRepository(localStorage).load()).games[0].goals).toEqual([expect.objectContaining(goal)]);
 expect(screen.getByRole('heading',{name:'Nothing in the backlog'})).toBeTruthy();
 const repo=new LocalRepository(localStorage);await repo.deleteGame((await repo.load()).games[0]);
 act(()=>window.dispatchEvent(new Event('focus')));
 fireEvent.click(await screen.findByRole('button',{name:'Permanently delete game'}));
 expect(stored().games).toHaveLength(1);
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Cancel'}));
 expect(stored().games).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'Permanently delete game'}));
 await confirm('Delete permanently');
 expect(stored().games).toEqual([]);expect(stored().rivalries).toHaveLength(1);
});

it('shows saved games inside a deleted rivalry and returns a duplicate creation to its backlog',async()=>{
 seed({rivalries:[rivalry],games:[{...baseGame,ended_at:'2026-01-01T00:01:00Z',goals:[goal]}]});
 const repo=new LocalRepository(localStorage);await repo.load();await repo.deleteRivalry(rivalry.id,{g:1});
 openApp();
 fireEvent.click(await screen.findByRole('button',{name:'New rivalry'}));
 const dialog=await screen.findByRole('dialog');
 fireEvent.click(within(dialog).getByRole('checkbox',{name:'Bea on Black'}));
 fireEvent.click(within(dialog).getByRole('checkbox',{name:'Ada on White'}));
 fireEvent.click(within(dialog).getByRole('button',{name:'Create rivalry'}));
 await screen.findByRole('heading',{name:'Rivalry is in the backlog'});
 expect(screen.queryByRole('link',{name:'Open backlog'})).toBeNull();
 cleanup();openApp('/backlog');
 await screen.findByRole('heading',{name:'Rivalries 1'});
 expect(screen.getByText('Saved games')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Permanently delete game'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Undo'}));
 await screen.findByText('Restored. Stats are up to date.');
 expect((await repo.load()).games).toHaveLength(1);
 expect((await repo.load()).rivalries[0].id).toBe(rivalry.id);
});

it('pauses across reloads, prevents scoring, and resumes using active game time',async()=>{
 const now=vi.spyOn(Date,'now').mockReturnValue(Date.parse(baseGame.started_at)+60000);
 seed({rivalries:[rivalry],games:[baseGame]});openApp('/game/g');
 fireEvent.click(await screen.findByRole('button',{name:'Pause game'}));
 await screen.findByRole('button',{name:'Resume game'});
 expect((screen.getByRole('button',{name:'Ada attacker goal'}) as HTMLButtonElement).disabled).toBe(true);
 expect(stored().games[0].paused_at).toBeTruthy();
 now.mockReturnValue(Date.parse(baseGame.started_at)+180000);
 cleanup();openApp('/game/g');
 await screen.findByRole('button',{name:'Resume game'});
 expect(screen.getByText('1:00')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Resume game'}));
 await screen.findByRole('button',{name:'Pause game'});
 now.mockReturnValue(Date.parse(baseGame.started_at)+190000);
 fireEvent.click(screen.getByRole('button',{name:'Ada attacker goal'}));
 await confirm('Add goal for Ada');
 expect(stored().games[0].goals[0].elapsed_ms).toBe(70000);
 expect(stored().games[0].paused_ms).toBe(120000);
});

it('swaps only the chosen fullscreen team and snapshots the new scorer',async()=>{
 const person=(name:string)=>({id:name.toLowerCase(),name,created_at:rivalry.created_at});
 const team:Rivalry={...rivalry,player_a:'Josh and Brooks',player_b:'Andrew and Max',members:{a:[person('Josh'),person('Brooks')],b:[person('Andrew'),person('Max')]}};
 seed({rivalries:[team],games:[baseGame]});
 const repo=new LocalRepository(localStorage);const state=await repo.load();
 await repo.saveGame({...state.games[0],lineup:defaultLineup(state.rivalries[0])});
 openApp('/game/g');
 fireEvent.click(await screen.findByRole('button',{name:'Full screen'}));
 const table=within(screen.getByRole('dialog',{name:'Full screen scoring'}));
 const before=stored().games[0].lineup!;
 fireEvent.click(table.getByRole('button',{name:'Swap black rungs: Josh and Brooks'}));
 await waitFor(()=>expect(stored().games[0].lineup!.a.attack).toBe(before.a.defense));
 expect(stored().games[0].lineup!.b).toEqual(before.b);
 expect(table.getByRole('group',{name:'Near side: Josh and Brooks'})).toBeTruthy();
 fireEvent.click(table.getByRole('button',{name:'Josh and Brooks attacker goal'}));
 fireEvent.click(within(screen.getByRole('dialog',{name:'Add goal'})).getByRole('button',{name:'Add goal for Josh and Brooks'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Add goal'})).toBeNull());
 expect(stored().games[0].goals[0].lineup!.a.attack).toBe(before.a.defense);
 fireEvent.click(table.getByRole('button',{name:'Pause game'}));
 await waitFor(()=>expect((table.getByRole('button',{name:'Swap white rungs: Andrew and Max'}) as HTMLButtonElement).disabled).toBe(true));
 fireEvent.click(table.getByRole('button',{name:'Resume game'}));
 await waitFor(()=>expect((table.getByRole('button',{name:'Josh and Brooks goalie goal'}) as HTMLButtonElement).disabled).toBe(false));
});
