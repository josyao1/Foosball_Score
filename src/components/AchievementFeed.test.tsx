// @vitest-environment jsdom
import { act,cleanup,render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,expect,it,vi } from 'vitest';
import { AchievementFeed } from './AchievementFeed';
import { ACHIEVEMENT_FEED_WINDOW } from '../lib/achievementFeed';
import type { Game,Rivalry } from '../lib/types';
const now=Date.parse('2026-11-03T20:00:00Z');
const rivalries:Rivalry[]=[{id:'r',player_a:'Josh',player_b:'Brooks',created_at:''}];
const g:Game={id:'first',rivalry_id:'r',revision:1,started_at:'2026-11-03T00:00:00Z',ended_at:new Date(now-ACHIEVEMENT_FEED_WINDOW+30000).toISOString(),goals:Array.from({length:10},(_,i)=>({id:String(i),actor_side:'a',rung:'attacker',flags:[],elapsed_ms:(i+1)*10000,occurred_at:''}))};
afterEach(()=>{cleanup();vi.useRealTimers();});
it('links first unlocks to their game and removes bold emphasis as they age, retaining the entry',()=>{
 vi.useFakeTimers();vi.setSystemTime(now);
 render(<MemoryRouter><AchievementFeed games={[g,{...g,id:'repeat',ended_at:new Date(now-1000).toISOString()}]} rivalries={rivalries}/></MemoryRouter>);
 const link=screen.getByRole('link',{name:/Josh earned/});
 expect(link.getAttribute('href')).toBe('/game/first');
 expect(link.closest('li')?.classList.contains('is-recent')).toBe(true);
 expect(screen.queryByText('Last 12 hours')).toBeNull();
 act(()=>vi.advanceTimersByTime(60000));
 expect(link.closest('li')?.classList.contains('is-recent')).toBe(false);
 expect(screen.getByRole('link',{name:/Josh earned/})).toBeTruthy();
});
it('has no empty feed section when no achievements have been earned',()=>{
 render(<MemoryRouter><AchievementFeed games={[]} rivalries={rivalries}/></MemoryRouter>);
 expect(screen.queryByRole('region',{name:'Recent achievements'})).toBeNull();
});
