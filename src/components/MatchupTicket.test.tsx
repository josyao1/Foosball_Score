// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MatchupTicket } from './MatchupTicket';
import { displayTeams } from '../lib/participants';
import type { Game, Rivalry } from '../lib/types';

afterEach(cleanup);
it('keeps profile-relative wins and game links without comparison tabs',()=>{
  const rivalry:Rivalry={id:'r',player_a:'josh',player_b:'brooks',created_at:'2026-11-11T12:00:00Z'};
  const game:Game={id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-11T12:00:00Z',ended_at:'2026-11-11T12:05:00Z',goals:[{id:'goal',actor_side:'b',rung:'goalie',flags:[],elapsed_ms:1000,occurred_at:'2026-11-11T12:00:01Z'}]};
  render(<MemoryRouter><MatchupTicket rivalry={rivalry} teams={displayTeams(rivalry,'brooks')} games={[game]}/></MemoryRouter>);
  expect(screen.getByRole('article',{name:'brooks vs josh'})).toBeTruthy();
  expect(screen.getByText('brooks leads by 1')).toBeTruthy();
  expect(screen.queryByRole('tablist')).toBeNull();
  expect(screen.getByRole('article').querySelector('.rtp-numbers')?.textContent).toBe('1–0');
  expect(screen.getByRole('link',{name:/brooks 1, josh 0/}).getAttribute('href')).toBe('/game/g');
  expect(screen.getByRole('link',{name:'View stats for brooks vs josh'}).getAttribute('href')).toBe('/rivalry/r');
});
