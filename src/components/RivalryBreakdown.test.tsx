// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RivalryBreakdown } from './RivalryBreakdown';
import type { Game, Goal, Rivalry } from '../lib/types';
const now=Date.parse('2026-10-28T20:00:00Z');
const day=86_400_000;
const rivalry:Rivalry={id:'r',player_a:'Josh and Brooks',player_b:'Andrew',created_at:'2026-01-01T00:00:00Z'};
const goal=(id:string,side:Goal['actor_side'],rung:Goal['rung'],flags:Goal['flags']=[]):Goal=>({id,actor_side:side,rung,flags,elapsed_ms:1000,occurred_at:new Date(now-1000).toISOString()});
const game=(id:string,age:number,goals:Goal[]):Game=>({id,rivalry_id:'r',revision:1,started_at:new Date(now-age-60_000).toISOString(),ended_at:new Date(now-age).toISOString(),goals});
const recent=game('recent',1000,[goal('1','a','goalie',['bank','dunk']),goal('2','a','middle'),goal('3','a','attacker',['own_goal']),goal('4','b','defender',['dunk'])]);
afterEach(()=>{cleanup();vi.useRealTimers()});
it('shows shared counts and shares without crediting own goals to offensive rungs',()=>{
 vi.useFakeTimers();vi.setSystemTime(now);
 const {container}=render(<RivalryBreakdown games={[recent]} rivalry={rivalry}/>);
 expect(screen.getAllByRole('heading',{name:'Goals by rung'})).toHaveLength(1);
 expect(screen.getAllByRole('heading',{name:'Goal types'})).toHaveLength(1);
 expect(within(screen.getByRole('group',{name:'Goalie rung'})).getByLabelText('Josh and Brooks: 1 goal, most-used rung, 50% of goals scored')).toBeTruthy();
 expect(within(screen.getByRole('group',{name:'Attacker rung'})).getByLabelText('Josh and Brooks: 0 goals, 0% of goals scored')).toBeTruthy();
 expect(screen.getByRole('group',{name:'Josh and Brooks, Dunk + bank: 1 goals, 33%'})).toBeTruthy();
 expect(screen.getByRole('group',{name:'Josh and Brooks, Own goal: 1 goals, 33%'})).toBeTruthy();
 expect(screen.getByRole('group',{name:'Andrew, Dunk: 1 goals, 100%'})).toBeTruthy();
 expect(container.querySelectorAll('.stats-rod-figure')).toHaveLength(13);
});
it('updates both player breakdowns with one filter and restores all-time totals',()=>{
 vi.useFakeTimers();vi.setSystemTime(now);
 const games=[recent,game('weekly',3*day,[goal('w','a','attacker')]),game('monthly',20*day,[goal('m','b','middle')]),game('old',50*day,[goal('o','b','goalie')]),{...game('live',0,[goal('l','a','goalie')]),ended_at:null}];
 render(<RivalryBreakdown games={games} rivalry={rivalry}/>);
 const buttons=within(screen.getByRole('group',{name:'Player stats period'}));
 expect(buttons.getByRole('button',{name:'All time: All time'}).getAttribute('aria-pressed')).toBe('true');
 expect(screen.getByRole('status').textContent).toBe('All time · 4 completed games');
 for(const [period,count,totalA,totalB] of [['1d',1,2,1],['7d',2,3,1],['1m',3,3,2]] as const){
  fireEvent.click(buttons.getByRole('button',{name:new RegExp(`^${period}:`)}));
  expect(screen.getByRole('status').textContent).toContain(`${count} completed game`);
  expect(screen.getByText(`${totalA} goals scored`)).toBeTruthy();
  expect(screen.getByText(`${totalB} goals scored`)).toBeTruthy();
  expect(buttons.getAllByRole('button',{pressed:true})).toHaveLength(1);
 }
 fireEvent.click(buttons.getByRole('button',{name:'All time: All time'}));
 expect(screen.getByRole('status').textContent).toBe('All time · 4 completed games');
});
it('handles empty windows and includes a newly finished game immediately',()=>{
 vi.useFakeTimers();vi.setSystemTime(now);
 const {rerender,container}=render(<RivalryBreakdown games={[]} rivalry={rivalry}/>);
 fireEvent.click(screen.getByRole('button',{name:/^1d:/}));
 expect(screen.getByText('No completed games in this period.')).toBeTruthy();
 expect(container.textContent).not.toMatch(/NaN|Infinity/);
 vi.setSystemTime(now+5000);
 rerender(<RivalryBreakdown games={[{...recent,ended_at:new Date(now+4000).toISOString()}]} rivalry={rivalry}/>);
 expect(screen.getByRole('status').textContent).toBe('Last 24 hours · 1 completed game');
 expect(screen.queryByText('No completed games in this period.')).toBeNull();
});
it('expires games out of the selected rolling period while the page stays open',()=>{
 vi.useFakeTimers();vi.setSystemTime(now);
 render(<RivalryBreakdown games={[{...recent,ended_at:new Date(now-day+1000).toISOString()}]} rivalry={rivalry}/>);
 fireEvent.click(screen.getByRole('button',{name:/^1d:/}));
 expect(screen.getByRole('status').textContent).toContain('1 completed game');
 act(()=>vi.advanceTimersByTime(60_000));
 expect(screen.getByRole('status').textContent).toContain('0 completed games');
});
