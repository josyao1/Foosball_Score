// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { selectProfile } from '../lib/profile';
import { DEFAULT_WEEKLY_SETTINGS } from '../lib/weeklyFeature';
import type { Game, Rivalry } from '../lib/types';
const first:Rivalry={id:'first',player_a:'Ada',player_b:'Bea',created_at:''};
const second:Rivalry={...first,id:'second',player_a:'Cy'};
const games:Game[]=[first,second].map(r=>({id:r.id,rivalry_id:r.id,revision:1,started_at:'2026-11-24T18:00:00Z',ended_at:'2026-11-24T18:10:00Z',
 goals:[...('ab'.repeat(8)+'aa')].map((side,i)=>({id:String(i),actor_side:side==='a'?'a':'b',rung:'attacker',flags:[],elapsed_ms:(i+1)*30000,occurred_at:'2026-11-24T18:00:00Z'}))}));
const state={games,rivalries:[first,second],players:[],weekly_settings:{...DEFAULT_WEEKLY_SETTINGS},loading:false};
vi.mock('../lib/store',()=>({useStore:()=>state}));
vi.mock('./Home',()=>({NewRivalry:({onClose}:{onClose:()=>void})=><button onClick={onClose}>Close rivalry picker</button>}));
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-24T20:00:00Z'));localStorage.clear();selectProfile(null);state.weekly_settings={...DEFAULT_WEEKLY_SETTINGS};});
afterEach(()=>{cleanup();selectProfile(null);vi.useRealTimers();});
it('composes the briefing and updates Play next when the shared player selection changes',()=>{
 render(<MemoryRouter><Dashboard/></MemoryRouter>);
 const weekly=within(screen.getByRole('region',{name:'This week at the table'}));
 expect(weekly.getByRole('tab',{name:'Game of the week'})).toBeTruthy();
 expect(screen.queryByRole('region',{name:'Recent achievements'})).toBeNull();
 expect(screen.getByRole('region',{name:'Around the table'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Choose your player'})).toBeTruthy();
 fireEvent.click(weekly.getByRole('tab',{name:'Play next'}));
 expect(weekly.getByRole('link',{name:'Open matchup'}).getAttribute('href')).toBe('/rivalry/first');
 act(()=>selectProfile('cy'));
 expect(weekly.getByRole('link',{name:'Open matchup'}).getAttribute('href')).toBe('/rivalry/second');
 expect(screen.getByRole('heading',{name:'Cy'})).toBeTruthy();
 act(()=>selectProfile(null));
 expect(weekly.getByRole('link',{name:'Open matchup'}).getAttribute('href')).toBe('/rivalry/first');
 fireEvent.click(screen.getByRole('button',{name:'Find or create'}));
 expect(screen.getByRole('button',{name:'Close rivalry picker'})).toBeTruthy();
});
it('still shows the personal summary and history when the shared weekly feature is off',()=>{
 state.weekly_settings.enabled=false;
 render(<MemoryRouter><Dashboard/></MemoryRouter>);
 expect(screen.queryByRole('tab')).toBeNull();
 expect(screen.getByRole('region',{name:'Your home'})).toBeTruthy();
 expect(screen.getByRole('link',{name:'See all'})).toBeTruthy();
});

it('does not display a future-dated game as live or remove its eligible recommendation',()=>{
 const future:Game={...games[0],id:'future-live',started_at:'2026-11-25T20:00:00Z',ended_at:null,goals:[]};
 state.games=[...games,future];
 try {
  render(<MemoryRouter><Dashboard/></MemoryRouter>);
  expect(screen.queryByRole('region',{name:'Live games'})).toBeNull();
  fireEvent.click(screen.getByRole('tab',{name:'Play next'}));
  expect(screen.getByRole('link',{name:'Open matchup'}).getAttribute('href')).toBe('/rivalry/first');
 } finally { state.games=games; }
});
