// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { WeeklyBriefing } from './WeeklyBriefing';
import { DEFAULT_WEEKLY_SETTINGS, weeklyFeature } from '../lib/weeklyFeature';
import type { Game, Rivalry } from '../lib/types';
const rivalry:Rivalry={id:'top',player_a:'Ada',player_b:'Bea',created_at:''};
const mine:Rivalry={...rivalry,id:'mine',player_a:'Cy and Dee',members:{a:[{id:'cy-id',name:'Cy',created_at:''},{id:'dee-id',name:'Dee',created_at:''}],b:[{id:'bea-id',name:'Bea',created_at:''}]}};
const game:Game={id:'g',rivalry_id:'top',started_at:'2026-11-24T20:00:00Z',ended_at:'2026-11-24T20:10:00Z',revision:1,
 goals:[...('ab'.repeat(8)+'aa')].map((side,i)=>({id:String(i),actor_side:side==='a'?'a':'b',rung:'attacker',flags:[],elapsed_ms:(i+1)*20000,occurred_at:'2026-11-24T20:10:00Z'}))};
const now=Date.parse('2026-11-24T21:00:00Z');
function fixture(){
 const result=weeklyFeature([game],[rivalry],DEFAULT_WEEKLY_SETTINGS,now);
 return {...result,now,settings:DEFAULT_WEEKLY_SETTINGS,loading:false,candidates:[{...result.candidates[0],rating:100},{...result.candidates[0],rivalry:mine,rating:5}]};
}
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('shows one feature with its actual date, rank and result; supports keyboard tabs',()=>{
 render(<MemoryRouter><WeeklyBriefing feature={fixture()} profile={null} rank={7}/></MemoryRouter>);
 expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
 expect(screen.getByRole('tab',{name:'Game of the week'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByText(/Nov 24, 2026/)).toBeTruthy();
 expect(screen.getByRole('img',{name:'Hall of Fame #7'})).toBeTruthy();
 expect(screen.getByRole('link',{name:'View game'}).getAttribute('href')).toBe('/game/g');
 fireEvent.keyDown(screen.getByRole('tab',{name:'Game of the week'}),{key:'ArrowRight'});
 const next=screen.getByRole('tab',{name:'Play next'});
 expect(next.getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(next);
 expect(screen.queryByRole('link',{name:'View game'})).toBeNull();
 expect(screen.getByRole('link',{name:'Open matchup'}).getAttribute('href')).toBe('/rivalry/top');
 fireEvent.keyDown(next,{key:'Home'});
 expect(screen.getByRole('tab',{name:'Game of the week'}).getAttribute('aria-selected')).toBe('true');
});
it('reacts to profile changes and uses the top fallback, without replacing the shared pick',()=>{
 const feature=fixture();
 const view=render(<MemoryRouter><WeeklyBriefing feature={feature} profile="dee-id"/></MemoryRouter>);
 fireEvent.click(screen.getByRole('tab',{name:'Play next'}));
 expect(screen.getByText('Suggested for you')).toBeTruthy();
 expect(screen.getByRole('link',{name:'Open matchup'}).getAttribute('href')).toBe('/rivalry/mine');
 view.rerender(<MemoryRouter><WeeklyBriefing feature={feature} profile="unknown"/></MemoryRouter>);
 expect(screen.getByText('Top table pick')).toBeTruthy();
 expect(screen.getByRole('link',{name:'Open matchup'}).getAttribute('href')).toBe('/rivalry/top');
 expect(feature.matchup?.id).toBe('top');
});
it('handles no suggestions, no games and loading without broken result links',()=>{
 const feature={...fixture(),best:null,candidates:[],loading:true};
 const view=render(<MemoryRouter><WeeklyBriefing feature={feature} profile={null}/></MemoryRouter>);
 expect(screen.getByRole('status').textContent).toContain('Loading');
 view.rerender(<MemoryRouter><WeeklyBriefing feature={{...feature,loading:false}} profile={null}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'Explore rivalries'})).toBeTruthy();
 fireEvent.click(screen.getByRole('tab',{name:'Game of the week'}));
 expect(screen.getByRole('link',{name:'Past classics'})).toBeTruthy();
 expect(screen.queryByRole('link',{name:'View game'})).toBeNull();
});

it('describes the ranked evidence without claiming an exact margin or latest game',()=>{
 const base=fixture(), feature={...base,candidates:[{...base.candidates[0],count:1,close:1,daysSincePlayed:0.8}]};
 render(<MemoryRouter><WeeklyBriefing feature={feature} profile={null}/></MemoryRouter>);
 fireEvent.click(screen.getByRole('tab',{name:'Play next'}));
 expect(screen.getByText('A recent game finished within two goals')).toBeTruthy();
 expect(screen.getByText('Last played within 24 hours')).toBeTruthy();
});

it('slides on tab selection and keeps tabs in sync with a touch scroll',()=>{
 vi.useFakeTimers();
 const {container}=render(<MemoryRouter><WeeklyBriefing feature={fixture()} profile={null}/></MemoryRouter>);
 const row=container.querySelector('.briefing-track') as HTMLDivElement;
 expect(row).toBeTruthy();
 Object.defineProperty(row,'clientWidth',{value:320});
 const scrollTo=vi.fn();Object.defineProperty(row,'scrollTo',{value:scrollTo});
 fireEvent.click(screen.getByRole('tab',{name:'Play next'}));
 expect(scrollTo).toHaveBeenLastCalledWith({left:320,behavior:'smooth'});
 expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
 expect(container.querySelector('[aria-hidden="true"][role="tabpanel"]')?.hasAttribute('inert')).toBe(true);
 row.scrollLeft=0;fireEvent.scroll(row);
 act(()=>vi.advanceTimersByTime(160));
 expect(screen.getByRole('tab',{name:'Game of the week'}).getAttribute('aria-selected')).toBe('true');
 row.scrollLeft=320;fireEvent.scroll(row);
 act(()=>vi.advanceTimersByTime(160));
 expect(screen.getByRole('tab',{name:'Play next'}).getAttribute('aria-selected')).toBe('true');
});
it('switches without animation when reduced motion is requested',()=>{
 vi.stubGlobal('matchMedia',vi.fn().mockReturnValue({matches:true}));
 try {
  const {container}=render(<MemoryRouter><WeeklyBriefing feature={fixture()} profile={null}/></MemoryRouter>);
  const row=container.querySelector('.briefing-track') as HTMLDivElement;
  expect(row).toBeTruthy();
  Object.defineProperty(row,'clientWidth',{value:320});
  const scrollTo=vi.fn();Object.defineProperty(row,'scrollTo',{value:scrollTo});
  fireEvent.click(screen.getByRole('tab',{name:'Play next'}));
  expect(scrollTo).toHaveBeenLastCalledWith({left:320,behavior:'instant'});
 } finally { vi.unstubAllGlobals(); }
});
