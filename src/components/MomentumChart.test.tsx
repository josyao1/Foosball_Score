// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MomentumChart } from './MomentumChart';
import type { Game, Rivalry } from '../lib/types';
const rivalry:Rivalry={id:'r',player_a:'Black player with a very long full name',player_b:'White player with a very long full name',created_at:'2026-01-01T00:00:00Z'};
const game:Game={id:'g',rivalry_id:'r',started_at:'2026-01-01T00:00:00Z',ended_at:'2026-01-01T00:01:00Z',revision:1,goals:[{id:'one',actor_side:'a',rung:'defender',flags:[],elapsed_ms:1250,occurred_at:'2026-01-01T00:00:01.250Z'},{id:'two',actor_side:'a',rung:'goalie',flags:['own_goal'],elapsed_ms:40000,occurred_at:'2026-01-01T00:00:40Z'}]};
afterEach(cleanup);
describe('new game presentation behavior',()=>{
 it('shows own-goal credit, exact timing and keyboard selection in goal order',()=>{
  const {container}=render(<MomentumChart game={game} rivalry={rivalry}/>);
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('0:40.000');
  expect(container.querySelector('.momentum-selection')?.textContent).toContain(`${rivalry.player_b} scores · own goal by ${rivalry.player_a}`);
  fireEvent.click(screen.getByRole('button',{name:'Previous goal'}));
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('0:01.250');
  const point=screen.getByRole('button',{name:/Goal 1,/});
  fireEvent.keyDown(point,{key:'ArrowRight'});
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('0:40.000');
  expect(container.querySelector('.momentum-selection-meta strong')?.textContent).toBe('1 – 1');
 });
 it('handles a selected goal being removed and then an empty game',()=>{
  const {container,rerender}=render(<MomentumChart game={game} rivalry={rivalry}/>);
  fireEvent.click(screen.getByRole('button',{name:'Previous goal'}));
  rerender(<MomentumChart game={{...game,goals:[game.goals[1]]}} rivalry={rivalry}/>);
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('Goal 1 of 1');
  rerender(<MomentumChart game={{...game,goals:[]}} rivalry={rivalry}/>);
  expect(screen.getByText('The first goal will start the momentum chart.')).toBeTruthy();
  expect(container.querySelector('svg')).toBeNull();
 });
});

describe('momentum replay', () => {
 let now = 0, nextFrame = 0;
 const frames = new Map<number, FrameRequestCallback>();
 const advance = (ms: number) => {
  now += ms;
  act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); });
 };
 beforeEach(() => {
  now = 0; nextFrame = 0; frames.clear();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
 });
 afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
 it('has compact header controls, defaults to 16×, and preserves timed gaps and own goals', () => {
  const {container} = render(<MomentumChart game={game} rivalry={rivalry}/>);
  expect(container.querySelector('.momentum-heading .momentum-play')).toBeTruthy();
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByRole('slider')).toBeNull();
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('1:00');
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  expect(container.querySelector('.momentum-result strong')?.textContent).toBe('0 – 0');
  expect(container.querySelectorAll('.momentum-point')).toHaveLength(0);
  advance(125);
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('0:02');
  expect(container.querySelector('.momentum-result strong')?.textContent).toBe('1 – 0');
  expect(container.querySelectorAll('.momentum-point')).toHaveLength(1);
  expect(container.querySelector('.momentum-axis-alert time')?.textContent).toBe('0:01.250');
  advance(1125);
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('0:20');
  expect(container.querySelector('.momentum-result strong')?.textContent).toBe('1 – 0');
  advance(1250);
  expect(container.querySelector('.momentum-result strong')?.textContent).toBe('1 – 1');
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('0:40');
  expect(container.querySelector('.momentum-replay-ball .goal-ball-own')).toBeTruthy();
  expect(container.querySelector('.momentum-goal-celebration.side-b')).toBeTruthy();
  expect(screen.getByRole('button', {name:'Play replay'})).toBeTruthy();
  expect(frames.size).toBe(0);
 });
 it('cycles 16→2→4→8→16 and changes playback speed without resetting the clock', () => {
  const {container} = render(<MomentumChart game={game} rivalry={rivalry}/>);
  const speed = () => screen.getByRole('button', {name:/Replay speed/});
  expect(speed().textContent).toBe('16×');
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  advance(250);
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('0:04');
  for (const next of [2, 4, 8, 16]) {
   fireEvent.click(speed());
   expect(speed().textContent).toBe(`${next}×`);
  }
  fireEvent.click(speed());
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('0:04');
  advance(1000);
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('0:06');
  fireEvent.click(screen.getByRole('button', {name:'Pause replay'}));
  fireEvent.click(speed());
  advance(1000);
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('0:06');
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  advance(1000);
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('0:10');
 });
 it('pauses, resumes and starts over when Play is tapped after completion', () => {
  const {container} = render(<MomentumChart game={game} rivalry={rivalry}/>);
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  advance(250);
  fireEvent.click(screen.getByRole('button', {name:'Pause replay'}));
  advance(5000);
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('0:04');
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  advance(500);
  expect(container.querySelector('.momentum-result time')?.textContent).toBe('0:12');
  advance(2000);
  expect(frames.size).toBe(0);
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  expect(container.querySelector('.momentum-result strong')?.textContent).toBe('0 – 0');
 });
 it('pauses when the tab is hidden and cancels pending animation on unmount', () => {
  const {unmount} = render(<MomentumChart game={game} rivalry={rivalry}/>);
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  advance(125);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByRole('button', {name:'Play replay'})).toBeTruthy();
  expect(frames.size).toBe(0);
  vi.restoreAllMocks();
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  unmount();
  expect(frames.size).toBe(0);
 });
 it('resets safely after edits and handles simultaneous goals at zero seconds', () => {
  const {container,rerender} = render(<MomentumChart game={game} rivalry={rivalry}/>);
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  advance(125);
  rerender(<MomentumChart game={{...game, revision:2, goals:game.goals.map(g=>({...g, elapsed_ms:0}))}} rivalry={rivalry}/>);
  expect(frames.size).toBe(0);
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  advance(1000);
  expect(container.querySelector('.momentum-result strong')?.textContent).toBe('1 – 1');
  expect(frames.size).toBe(0);
 });
 it('steps through simultaneous goals and focuses newly revealed points without celebrating a seek', () => {
  const threeGoals = {...game, goals:[...game.goals, {...game.goals[1], id:'three'}]};
  const {container} = render(<MomentumChart game={threeGoals} rivalry={rivalry}/>);
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  advance(125);
  const firstPoint = screen.getByRole('button', {name:/Goal 1,/});
  act(() => firstPoint.focus());
  fireEvent.keyDown(firstPoint, {key:'ArrowRight'});
  expect(document.activeElement).toBe(screen.getByRole('button', {name:/Goal 2,/}));
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('Goal 2 of 3');
  expect(container.querySelector('.momentum-goal-celebration')).toBeNull();
  fireEvent.keyDown(document.activeElement!, {key:'ArrowRight'});
  expect(document.activeElement).toBe(screen.getByRole('button', {name:/Goal 3,/}));
  fireEvent.click(screen.getByRole('button', {name:'Previous goal'}));
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('Goal 2 of 3');
  fireEvent.click(screen.getByRole('button', {name:'Previous goal'}));
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('Goal 1 of 3');
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  advance(125);
  expect(container.querySelector('.momentum-goal-celebration')).toBeNull();
 });
 it('keeps rapid goal alerts visible and renews their timer while throttling only particles', () => {
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  const rapidGame: Game = {...game, ended_at:'2026-01-01T00:05:00Z', goals:[
   {...game.goals[0], actor_side:'b', elapsed_ms:232117},
   {...game.goals[0], id:'two', actor_side:'b', elapsed_ms:238041},
  ]};
  const {container} = render(<MomentumChart game={rapidGame} rivalry={rivalry}/>);
  fireEvent.click(screen.getByRole('button', {name:'Play replay'}));
  advance(14508); // 3:52.128 game time: first Brooks goal.
  expect(container.querySelector('.momentum-axis-alert time')?.textContent).toBe('3:52.117');
  expect(container.querySelector('.momentum-goal-burst')).toBeTruthy();
  act(() => vi.advanceTimersByTime(371));
  advance(371); // 3:58.064: next goal only 371 ms later on screen.
  expect(container.querySelector('.momentum-axis-alert time')?.textContent).toBe('3:58.041');
  expect(container.querySelector('.momentum-goal-burst')).toBeNull();
  act(() => vi.advanceTimersByTime(1229)); // Old alert deadline must not clear the new goal.
  expect(container.querySelector('.momentum-axis-alert')).toBeTruthy();
  act(() => vi.advanceTimersByTime(370));
  expect(container.querySelector('.momentum-axis-alert')).toBeTruthy();
  act(() => vi.advanceTimersByTime(1));
  expect(container.querySelector('.momentum-axis-alert')).toBeNull();
 });
});
