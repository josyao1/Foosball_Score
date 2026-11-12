// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MatchupSummary } from './MatchupSummary';
import { PROFILE_KEY } from '../lib/profile';
import type { Game, Rivalry } from '../lib/types';

afterEach(()=>{cleanup();localStorage.clear();});
it('shows the chosen matchup layout with profile-relative results and no comparison tabs',()=>{
  const rivalry:Rivalry={id:'r',player_a:'josh',player_b:'brooks',created_at:'2026-11-11T12:00:00Z'};
  const game:Game={id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-11T12:00:00Z',ended_at:'2026-11-11T12:05:00Z',goals:[{id:'goal',actor_side:'b',rung:'goalie',flags:[],elapsed_ms:1000,occurred_at:'2026-11-11T12:00:01Z'}]};
  localStorage.setItem(PROFILE_KEY,'brooks');
  render(<MemoryRouter><MatchupSummary rivalry={rivalry} games={[game]}/></MemoryRouter>);
  expect(screen.queryByRole('tablist')).toBeNull();
  const panel=screen.getByRole('region',{name:'Rivalry comparison'});
  expect(panel.querySelector('.rsp-identity strong')?.textContent).toBe('brooks');
  expect(within(panel).getAllByLabelText('brooks: 1 wins in 1 qualifying games').length).toBeGreaterThan(0);
  expect(within(panel).getByRole('link',{name:/1–0 brooks by 1/}).getAttribute('href')).toBe('/game/g');
});
