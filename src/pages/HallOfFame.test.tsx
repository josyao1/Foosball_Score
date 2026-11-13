// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HallOfFame } from './HallOfFame';
import { App } from '../App';
import type { Game, Rivalry } from '../lib/types';

const fixture = vi.hoisted(() => ({ games: [] as Game[], extraRivalries: [] as Rivalry[] }));
vi.mock('../lib/store', () => ({ useStore: () => ({ games: fixture.games, rivalries: [{ id: 'r', player_a: 'Josh', player_b: 'Brooks', created_at: '2026-01-01' }, { id: 'other', player_a: 'Andrew', player_b: 'Alex', created_at: '2026-01-01' }, ...fixture.extraRivalries], cloud: true, loading: false, error: null }) }));
function game(id: string, sequence: string): Game {
  return { id, rivalry_id: 'r', revision: 1, started_at: '2026-11-02T18:00:00Z', ended_at: '2026-11-02T18:05:00Z', goals: [...sequence].map((s, i) => ({ id: `${id}-${i}`, actor_side: s === 'a' ? 'a' : 'b', rung: 'attacker', flags: [], elapsed_ms: (i + 1) * 10000, occurred_at: '2026-11-02T18:00:00Z' })) };
}
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { if (this.open) { this.open = false; this.dispatchEvent(new Event('close')); } } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); fixture.games = []; fixture.extraRivalries = []; });
it('ranks posters, uses real momentum, and keeps replay, details and formula actions separate', () => {
  fixture.games = [game('shutout', 'aaaaaaaaaa'), game('comeback', 'ababababbbbbb' + 'aaaaaaa')];
  const { container } = render(<MemoryRouter><HallOfFame/></MemoryRouter>);
  const posters = screen.getAllByRole('article');
  expect(posters[0].getAttribute('aria-label')).toBe('Rank 1: Josh versus Brooks');
  expect(within(posters[0]).getByRole('link', { name: /View game/ }).getAttribute('href')).toBe('/game/comeback');
  expect(within(posters[0]).getByText('Josh recovered from 4–9')).toBeTruthy();
  expect(within(posters[0]).getByRole('button', { name: /Play replay/ })).toBeTruthy();
  expect(within(posters[0]).getByText('10:00 AM PST')).toBeTruthy();
  expect(within(posters[0]).getByRole('slider').getAttribute('aria-label')).toContain('3:20');
  const paths = container.querySelectorAll('.hall-trace');
  expect(paths[0].getAttribute('d')).not.toBe(paths[1].getAttribute('d'));
  expect(container.querySelector('a a, a button, button a')).toBeNull();
  fireEvent.click(within(posters[0]).getByRole('button', { name: /Classic score/ }));
  const dialog = screen.getByRole('dialog', { name: 'Classic score' });
  expect(within(dialog).getByText('Winning comeback')).toBeTruthy();
  const comeback=within(dialog).getByRole('button',{name:/Winning comeback/});
  expect(comeback.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(comeback);
  expect(comeback.getAttribute('aria-expanded')).toBe('true');
  expect(within(dialog).getByText(/5-goal deficit recovered/).hidden).toBe(false);
  fireEvent.click(within(dialog).getByRole('button',{name:/Close finish/}));
  expect(comeback.getAttribute('aria-expanded')).toBe('false');
  expect(within(dialog).getByText(/5-goal deficit recovered/).hidden).toBe(true);
  expect(dialog.querySelectorAll('.hall-factor')).toHaveLength(8);
  expect(within(dialog).getByText('Close finish')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('replays inside the poster with timed scores, markers, pause, resume and restart',()=>{
  let now=0,id=0;
  const frames=new Map<number,FrameRequestCallback>();
  vi.spyOn(performance,'now').mockImplementation(()=>now);
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.set(++id,cb);return id;});
  vi.stubGlobal('cancelAnimationFrame',(key:number)=>frames.delete(key));
  const advance=(ms:number)=>{now+=ms;act(()=>{const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(now));});};
  fixture.games=[game('comeback','ababababbbbbb'+'aaaaaaa')];
  const view=render(<MemoryRouter><HallOfFame/></MemoryRouter>);
  const poster=screen.getByRole('article');
  const values=()=>Array.from(poster.querySelectorAll('.hc-team > strong')).map(el=>el.textContent);
  expect(values()).toEqual(['11','9']);
  expect(poster.querySelector('.hall-low-marker title')?.textContent).toContain('4–9');
  expect(poster.querySelector('.hall-win-marker')).toBeTruthy();
  fireEvent.click(within(poster).getByRole('button',{name:/Play replay/}));
  expect(values()).toEqual(['0','0']);
  expect(poster.querySelector('.hall-win-marker')).toBeNull();
  advance(625); // 10 seconds at 16×: first goal.
  expect(values()).toEqual(['1','0']);
  expect(poster.querySelector('.hall-axis time')?.textContent).toBe('0:10');
  expect(poster.querySelector('.hall-replay-cursor')).toBeTruthy();
  fireEvent.click(within(poster).getByRole('button',{name:/Pause replay/}));
  advance(2000);
  expect(values()).toEqual(['1','0']);
  fireEvent.click(within(poster).getByRole('button',{name:/Play replay/}));
  advance(7500); // 2:10: winning side's low point.
  expect(values()).toEqual(['4','9']);
  expect(poster.querySelector('.hall-low-marker')).toBeTruthy();
  expect(poster.querySelector('.hall-win-marker')).toBeNull();
  advance(5000);
  expect(values()).toEqual(['11','9']);
  expect(poster.querySelector('.hall-win-marker')).toBeTruthy();
  expect(frames.size).toBe(0);
  fireEvent.click(within(poster).getByRole('button',{name:/Play replay/}));
  expect(values()).toEqual(['0','0']);
  view.unmount();
  expect(frames.size).toBe(0);
});
it('shows a useful empty state without inventing ranked data', () => {
  fixture.games = [game('early', 'aba')];
  render(<MemoryRouter><HallOfFame/></MemoryRouter>);
  expect(screen.getByText('No ranked games yet')).toBeTruthy();
  expect(screen.queryByRole('article')).toBeNull();
});
it.each(['/hall-of-fame', '/Hall-of-Fame/'])('selects only the third tab at %s', path => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>);
  const nav = screen.getByRole('navigation', { name: 'Main navigation' });
  expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  expect(within(nav).getByRole('link', { name: 'Hall of Fame' }).getAttribute('aria-current')).toBe('page');
  fireEvent.click(within(nav).getByRole('link', { name: 'Scorigami' }));
  expect(within(nav).getByRole('link', { name: 'Scorigami' }).getAttribute('aria-current')).toBe('page');
});

it('shows only ten posters and reranks within the selected rivalry', () => {
  fixture.games = Array.from({ length: 12 }, (_, i) => game(`g-${i}`, 'aaaaaaaaaa'));
  fixture.games.push({ ...game('other-best', 'ababababbbbbb' + 'aaaaaaa'), rivalry_id: 'other' });
  render(<MemoryRouter><HallOfFame/></MemoryRouter>);
  expect(screen.getAllByRole('article')).toHaveLength(10);
  expect(screen.getByText(/Top 10 of 13 ranked games/)).toBeTruthy();
  expect(screen.getAllByRole('article')[0].getAttribute('aria-label')).toContain('Andrew versus Alex');
  fireEvent.change(screen.getByLabelText('Rivalry'), { target: { value: 'r' } });
  expect(screen.getAllByRole('article')).toHaveLength(10);
  expect(screen.getAllByRole('article')[0].getAttribute('aria-label')).toBe('Rank 1: Josh versus Brooks');
  expect(screen.getByText(/Top 10 of 12 ranked games/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Rivalry'), { target: { value: 'other' } });
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText(/Top 1 of 1 ranked game/)).toBeTruthy();
});
it('dismisses the rating on an outside tap, but keeps inside clicks and drags open', () => {
  fixture.games = [game('g', 'aaaaaaaaaa')];
  render(<MemoryRouter><HallOfFame/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Classic score/ }));
  const dialog = screen.getByRole('dialog');
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, right: 500, bottom: 700 } as DOMRect);
  const down = (x: number, y: number) => fireEvent(dialog, new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
  down(200, 200);
  fireEvent.click(dialog, { clientX: 200, clientY: 200 });
  expect(dialog.hasAttribute('open')).toBe(true);
  down(200, 200);
  fireEvent.click(dialog, { clientX: 50, clientY: 50 });
  expect(dialog.hasAttribute('open')).toBe(true);
  down(50, 50);
  fireEvent.click(dialog, { clientX: 50, clientY: 50 });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('uses Featured classic permanently and filters solo and team games by exact player membership', () => {
  const member = (id: string) => ({id, name: id, created_at:'2026-01-01'});
  fixture.extraRivalries = [
    {id:'team', player_a:'Josh and Max', player_b:'Brooks and Andrew', created_at:'2026-01-01', members:{a:[member('josh'), member('max')], b:[member('brooks'),member('andrew')]}},
    {id:'similar', player_a:'Josh Jr', player_b:'Max', created_at:'2026-01-01', members:{a:[member('josh-jr')], b:[member('max')]}}
  ];
  fixture.games = [game('solo', 'aaaaaaaaaa'), {...game('team-best', 'ababababbbbbb' + 'aaaaaaa'), rivalry_id:'team'}, {...game('unrelated', 'aaaaaaaaaa'), rivalry_id:'other'}, {...game('similar-name', 'aaaaaaaaaa'), rivalry_id:'similar'}];
  const {container} = render(<MemoryRouter><HallOfFame/></MemoryRouter>);
  expect(screen.queryByRole('tablist', {name:/Compare/})).toBeNull();
  expect(container.querySelectorAll('.hc-feature')).toHaveLength(1);
  expect(container.querySelectorAll('.hc-row')).toHaveLength(3);
  const player = screen.getByLabelText('Player') as HTMLSelectElement;
  const rivalry = screen.getByLabelText('Rivalry') as HTMLSelectElement;
  fireEvent.change(rivalry, {target:{value:'other'}});
  expect(screen.getAllByRole('article')).toHaveLength(1);
  fireEvent.change(player, {target:{value:'josh'}});
  expect(rivalry.value).toBe('');
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(within(screen.getAllByRole('article')[0]).getByRole('link',{name:/View game/}).getAttribute('href')).toBe('/game/team-best');
  expect(screen.queryByRole('link', {name:/Josh Jr.*View game/})).toBeNull();
  fireEvent.change(player, {target:{value:'andrew'}});
  expect(screen.getAllByRole('article')).toHaveLength(2); // Opposing team member also included.
  fireEvent.change(rivalry, {target:{value:'r'}});
  expect(player.value).toBe('');
  expect(screen.getAllByRole('article')).toHaveLength(1);
  fireEvent.change(rivalry, {target:{value:''}});
  expect(screen.getAllByRole('article')).toHaveLength(4);
});
it('caps player rankings at ten and resets rating details when changing filters', () => {
  fixture.games = Array.from({length:12}, (_,i) => game(`g-${i}`, 'aaaaaaaaaa'));
  render(<MemoryRouter><HallOfFame/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Player'), {target:{value:'josh'}});
  expect(screen.getAllByRole('article')).toHaveLength(10);
  expect(screen.getByText(/Top 10 of 12/)).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button',{name:/Classic score/})[0]);
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Player'), {target:{value:'alex'}});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('No ranked games yet')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Show all games'}));
  expect((screen.getByLabelText('Player') as HTMLSelectElement).value).toBe('');
  expect(screen.getAllByRole('article')).toHaveLength(10);
});
it('expands inline replay from a ranked row and collapses back to the final score', () => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  fixture.games = [game('comeback', 'ababababbbbbb' + 'aaaaaaa'), game('shutout','aaaaaaaaaa')];
  render(<MemoryRouter><HallOfFame/></MemoryRouter>);
  const match = screen.getAllByRole('article')[1];
  fireEvent.click(within(match).getByRole('button', {name:/Play replay/}));
  expect(match.querySelector('.hc-chart-open')).toBeTruthy();
  expect(within(match).getByRole('link', {name:/View game/}).getAttribute('aria-label')).toContain('Josh 0, Brooks 0');
  fireEvent.click(within(match).getByRole('button', {name:/Collapse replay/}));
  expect(match.querySelector('.hc-chart-open')).toBeNull();
  expect(within(match).getByRole('link', {name:/View game/}).getAttribute('aria-label')).toContain('Josh 10, Brooks 0');
});

it('scrubs every poster by pointer, clamps to the plot and supports keyboard seeking', () => {
  fixture.games = [game('close', 'ababababbbbbb' + 'aaaaaaa'), game('shutout', 'aaaaaaaaaa')];
  render(<MemoryRouter><HallOfFame/></MemoryRouter>);
  for (const poster of screen.getAllByRole('article')) {
    const svg = poster.querySelector('.hall-momentum > svg')!;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({left:0,top:0,width:640,height:180} as DOMRect);
    const capture=vi.fn(); Object.assign(svg,{setPointerCapture:capture,hasPointerCapture:()=>true,releasePointerCapture:vi.fn()});
    const pointer=(type:string,x:number)=>fireEvent(svg,Object.assign(new MouseEvent(type,{bubbles:true,clientX:x,clientY:90,button:0}),{pointerId:1,isPrimary:true}));
    pointer('pointerdown',12);
    expect(poster.querySelectorAll('.hc-team > strong')[0].textContent).toBe('0');
    expect(capture).toHaveBeenCalledWith(1);
    pointer('pointermove',320);
    expect(Number(poster.querySelectorAll('.hc-team > strong')[0].textContent)).toBeGreaterThan(0);
    pointer('pointermove',800);
    expect(poster.querySelector('.hall-win-marker')).toBeTruthy();
    pointer('pointerup',800);
    pointer('pointermove',12);
    expect(poster.querySelector('.hall-win-marker')).toBeTruthy();
    fireEvent.keyDown(svg,{key:'Home'});
    expect(poster.querySelectorAll('.hc-team > strong')[0].textContent).toBe('0');
    fireEvent.keyDown(svg,{key:'ArrowRight'});
    expect(poster.querySelector('.hall-axis time')?.textContent).toBe('0:10');
    fireEvent.keyDown(svg,{key:'End'});
    expect(poster.querySelector('.hall-win-marker')).toBeTruthy();
  }
});
