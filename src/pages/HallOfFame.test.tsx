// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HallOfFame } from './HallOfFame';
import { App } from '../App';
import type { Game } from '../lib/types';

const fixture = vi.hoisted(() => ({ games: [] as Game[] }));
vi.mock('../lib/store', () => ({ useStore: () => ({ games: fixture.games, rivalries: [{ id: 'r', player_a: 'Josh', player_b: 'Brooks', created_at: '2026-01-01' }, { id: 'other', player_a: 'Andrew', player_b: 'Alex', created_at: '2026-01-01' }], cloud: true, loading: false, error: null }) }));
function game(id: string, sequence: string): Game {
  return { id, rivalry_id: 'r', revision: 1, started_at: '2026-11-02T18:00:00Z', ended_at: '2026-11-02T18:05:00Z', goals: [...sequence].map((s, i) => ({ id: `${id}-${i}`, actor_side: s === 'a' ? 'a' : 'b', rung: 'attacker', flags: [], elapsed_ms: (i + 1) * 10000, occurred_at: '2026-11-02T18:00:00Z' })) };
}
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { if (this.open) { this.open = false; this.dispatchEvent(new Event('close')); } } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); fixture.games = []; });
it('ranks posters, uses real momentum, and keeps replay, details and formula actions separate', () => {
  fixture.games = [game('shutout', 'aaaaaaaaaa'), game('comeback', 'ababababbbbbb' + 'aaaaaaa')];
  const { container } = render(<MemoryRouter><HallOfFame/></MemoryRouter>);
  const posters = screen.getAllByRole('article');
  expect(posters[0].getAttribute('aria-label')).toBe('Rank 1: Josh versus Brooks');
  expect(within(posters[0]).getByRole('link', { name: /View game/ }).getAttribute('href')).toBe('/game/comeback');
  expect(within(posters[0]).getByText('Josh recovered from 4–9')).toBeTruthy();
  expect(within(posters[0]).getByRole('link', { name: /Play replay/ }).getAttribute('href')).toBe('/game/comeback?play=1#momentum');
  expect(within(posters[0]).getByText('10:00 AM PST')).toBeTruthy();
  expect(within(posters[0]).getByRole('img').getAttribute('aria-label')).toContain('3:20');
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
