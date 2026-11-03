// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecordMomentGraphic } from './RecordMomentGraphic';
import { GameHighlightTags, RecordBook } from './Records';
import { App } from '../App';
import { StoreProvider } from '../lib/store';
import { createRecordDemoData } from '../test/fixtures/recordGames';
import { STORAGE_KEY } from '../lib/storage';
import { recordBook, selectedMoment, recordValue } from '../lib/records';
vi.mock('../lib/supabase', () => ({ cloudConfigured: false, createCloudRepository: () => { throw new Error('Local only'); } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
it('links each record to its existing game, with the selected record and chart anchor', () => {
  const data = createRecordDemoData(), r = data.rivalries[0], games = data.games.filter(g => g.rivalry_id === r.id);
  render(<MemoryRouter><RecordBook games={games} rivalry={r}/></MemoryRouter>);
  expect(screen.queryByRole('heading', {name:'30-second burst'})).toBeNull();
  expect(document.querySelectorAll('.record-entry')).toHaveLength(8);
  expect([...document.querySelectorAll('.record-entry h3')].map(el=>el.textContent)).toEqual(['Biggest run','Biggest comeback','Most lead changes','Longest drought','Quickest win','Longest win','Fastest three goals','Fastest response']);
  for (const { game, moment } of Object.values(recordBook(games).book).filter(entry => entry.moment.kind !== 'burst')) {
    expect(document.querySelector(`a[href="/game/${game.id}?record=${moment.kind}#momentum"]`)).toBeTruthy();
    expect(document.querySelector(`a[href="/game/${game.id}?record=${moment.kind}&play=1#momentum"]`)).toBeTruthy();
  }
});
it('opens the exact record from a rivalry, selects its chart moment without shading timeline rows, and allows choosing another highlight', async () => {
  const data = createRecordDemoData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const scroll = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
  const { container } = render(<MemoryRouter initialEntries={['/rivalry/records-josh-brooks']}><StoreProvider><App/></StoreProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole('link', { name: /Fastest three goals:.*View game/ }));
  expect(await screen.findByRole('heading', { name: 'Game result' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Game highlights' })).toBeNull();
  expect(container.querySelector('.record-focus-note')?.textContent).toContain('Fastest three goals');
  expect(container.querySelectorAll('.timeline .record-goal')).toHaveLength(0);
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('Goal 7 of 14');
  expect(scroll).toHaveBeenCalled();
  const highlights = screen.getByRole('group', { name: 'Notable moments' });
  fireEvent.click(within(highlights).getByRole('link', { name: /5-goal run/ }));
  expect(container.querySelector('.record-focus-note')?.textContent).toContain('Biggest run');
});
it('handles empty rivalry records and unknown record query parameters', () => {
  const data = createRecordDemoData();
  render(<MemoryRouter><RecordBook games={[]} rivalry={data.rivalries[0]}/></MemoryRouter>);
  expect(screen.getByText('Finish a game to start the record book.')).toBeTruthy();
  expect(selectedMoment(data.games[0], 'constructor')).toBeUndefined();
  expect(selectedMoment(data.games[0], 'invalid')).toBeUndefined();
  expect(recordValue({ kind: 'response', value: 119999, side: 'a', start: 0, end: 1 })).toBe('2:00.0');
});

it('only renders tags at the run/burst thresholds or below the response limit', () => {
  const data = createRecordDemoData(), base = data.games[0], rivalry = data.rivalries[0];
  const make = (seq: string, times: number[]) => ({ ...base, goals: [...seq].map((side, i) => ({ ...base.goals[0], id: `goal-${i}`, actor_side: side as 'a' | 'b', flags: [], elapsed_ms: times[i] })) });
  const view = render(<MemoryRouter><GameHighlightTags game={make('aaaa', [40000, 80000, 120000, 160000])} rivalry={rivalry}/></MemoryRouter>);
  expect(screen.queryByRole('group', { name: 'Notable moments' })).toBeNull();
  view.rerender(<MemoryRouter><GameHighlightTags game={make('aaaaa', [40000, 80000, 120000, 160000, 200000])} rivalry={rivalry}/></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Josh 5-goal run' })).toBeTruthy();
  expect(screen.getAllByRole('link')).toHaveLength(1);
  view.rerender(<MemoryRouter><GameHighlightTags game={make('aaba', [1000, 10000, 20000, 31000])} rivalry={rivalry}/></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Josh 3 goals in 30s' })).toBeTruthy();
  expect(screen.getAllByRole('link')).toHaveLength(1);
  view.rerender(<MemoryRouter><GameHighlightTags game={make('ab', [1000, 4000])} rivalry={rivalry}/></MemoryRouter>);
  expect(screen.queryByRole('group')).toBeNull();
  view.rerender(<MemoryRouter><GameHighlightTags game={make('ab', [1000, 2250])} rivalry={rivalry}/></MemoryRouter>);
  expect(screen.getByRole('link', { name: /Brooks 1.3s response/ })).toBeTruthy();
  expect(view.container.querySelector('.record-dots')).toBeNull();
  expect(view.container.textContent).not.toContain('Quickest');
});

it('keeps unset records compact and previews finite for simultaneous goals', () => {
  const data = createRecordDemoData();
  const game = { ...data.games[0], goals: data.games[0].goals.slice(0, 1).map(g => ({ ...g, elapsed_ms: 0 })) };
  const { container } = render(<MemoryRouter><RecordBook games={[game]} rivalry={data.rivalries[0]}/></MemoryRouter>);
  expect(screen.getByText('Still to be set')).toBeTruthy();
  expect(container.querySelectorAll('.record-unwritten')).toHaveLength(1);
  expect(container.querySelectorAll('.record-entry').length).toBe(Object.keys(recordBook([game]).book).filter(kind => kind !== 'burst').length);
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  expect(container.querySelector('a a')).toBeNull();
});

it('watch links navigate into active playback, while viewing a record remains an inspection', async () => {
  const data = createRecordDemoData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  try {
    render(<MemoryRouter initialEntries={['/rivalry/records-josh-brooks']}><StoreProvider><App/></StoreProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('link', {name:'Watch biggest comeback moment'}));
    expect(await screen.findByRole('button', {name:'Pause replay'})).toBeTruthy();
    expect(screen.getByRole('button', {name:/Replay speed 16×/})).toBeTruthy();
  } finally { cleanup(); vi.unstubAllGlobals(); }
});

it('keeps preview spacing proportional to logged time and uses a stopwatch for quickest wins', () => {
  const base = createRecordDemoData().games[0];
  const game = { ...base, goals: [1000, 2000, 12000].map((elapsed_ms, i) => ({ ...base.goals[0], id:`g${i}`, flags:[], actor_side:'a' as const, elapsed_ms })) };
  const { container, rerender } = render(<RecordMomentGraphic game={game} moment={{kind:'run',value:3,side:'a',start:0,end:2}}/>);
  const xs = [...container.querySelector('.record-mini-curve')!.getAttribute('d')!.matchAll(/H([\d.]+)/g)].map(m => Number(m[1]));
  expect(xs[2] - xs[1]).toBeCloseTo(10 * (xs[1] - xs[0]));
  rerender(<RecordMomentGraphic game={game} moment={{kind:'quickest',value:12000,side:'a',start:0,end:2}}/>);
  expect(container.querySelector('.record-mini')).toBeNull();
  expect(container.querySelector('.record-stopwatch')?.textContent).toContain('3 – 0');
  rerender(<RecordMomentGraphic game={game} moment={{kind:'longest',value:12000,side:'a',start:0,end:2}}/>);
  expect(container.querySelector('.record-mini')).toBeNull();
  expect(container.querySelector('.record-stopwatch')?.textContent).toContain('3 – 0');
  rerender(<RecordMomentGraphic game={game} moment={{kind:'drought',value:10000,side:null,start:1,end:2}}/>);
  expect(container.querySelector('.record-mini')).toBeNull();
  expect(container.querySelector('.record-stopwatch')?.textContent).toContain('0:02 – 0:12');
});
