// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { Rivalries } from './Rivalries';

vi.mock('../lib/profile', () => ({useProfile: () => null}));
vi.mock('../lib/store', () => ({useStore: () => ({games: [], rivalries: [
  {id: 'singles', player_a: 'Josh', player_b: 'Frank', created_at: ''},
  {id: 'team', player_a: 'Josh and Brooks', player_b: 'Andrew', created_at: ''},
  {id: 'other', player_a: 'Max', player_b: 'Frank', created_at: ''},
]})}));
afterEach(cleanup);

function cards() {
  return within(screen.getByRole('region', {name: 'All rivalries'})).getAllByRole('link');
}

it('matches names case-insensitively across teammates and combines search with format', () => {
  render(<MemoryRouter><Rivalries/></MemoryRouter>);
  const search = screen.getByRole('searchbox');
  expect(cards()).toHaveLength(3);
  fireEvent.change(search, {target: {value: '  JOSH  broo  '}});
  expect(cards().map(card => card.getAttribute('href'))).toEqual(['/rivalry/team']);
  expect(screen.getByRole('status').textContent).toBe('1 of 3');
  fireEvent.change(screen.getByRole('combobox', {name: 'Rivalry format'}), {target: {value: 'singles'}});
  expect(screen.getByText('No matching rivalries.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: 'Clear filters'}));
  expect(cards()).toHaveLength(3);
  expect((search as HTMLInputElement).value).toBe('');
});

it('includes uneven teams and preserves the format when clearing the name search', () => {
  render(<MemoryRouter><Rivalries/></MemoryRouter>);
  fireEvent.change(screen.getByRole('combobox', {name: 'Rivalry format'}), {target: {value: 'teams'}});
  expect(cards()).toHaveLength(1);
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: 'Max'}});
  expect(screen.queryByRole('region', {name: 'All rivalries'})).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: 'Clear search'}));
  expect(cards().map(card => card.getAttribute('href'))).toEqual(['/rivalry/team']);
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('teams');
});
