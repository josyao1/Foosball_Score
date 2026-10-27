// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
  for (const { game, moment } of Object.values(recordBook(games).book)) {
    expect(document.querySelector(`a[href="/game/${game.id}?record=${moment.kind}#momentum"]`)).toBeTruthy();
  }
});
it('opens the exact record from a rivalry, selects its chart moment without shading timeline rows, and allows choosing another highlight', async () => {
  const data = createRecordDemoData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const scroll = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
  const { container } = render(<MemoryRouter initialEntries={['/rivalry/records-josh-brooks']}><StoreProvider><App/></StoreProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole('link', { name: /30-second burst:.*View game/ }));
  expect(await screen.findByRole('heading', { name: 'Game result' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Game highlights' })).toBeNull();
  expect(container.querySelector('.record-focus-note')?.textContent).toContain('30-second burst');
  expect(container.querySelectorAll('.timeline .record-goal')).toHaveLength(0);
  expect(container.querySelector('.momentum-selection')?.textContent).toContain('Goal 9 of 14');
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
