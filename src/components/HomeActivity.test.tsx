// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { HomeActivity } from './HomeActivity';
import type { Game, Rivalry } from '../lib/types';
const r:Rivalry={id:'r',player_a:'Ada',player_b:'Bea',created_at:''};
const now=Date.parse('2026-11-24T22:00:00Z');
function game(id:string,offset:number):Game {
 const started_at=new Date(now-offset*60000-600000).toISOString();
 return {id,rivalry_id:'r',revision:1,started_at,ended_at:new Date(now-offset*60000).toISOString(),
 goals:[...('ab'.repeat(8)+'aa')].map((side,i)=>({id:`${id}-${i}`,actor_side:side==='a'?'a':'b',rung:'attacker',flags:i===17?['dunk']:[],elapsed_ms:(i+1)*30000,occurred_at:started_at}))};
}
afterEach(cleanup);
it('keeps first unlocks with their game and never repeats them on later wins',()=>{
 render(<MemoryRouter><HomeActivity games={[game('first',20),game('repeat',10)]} rivalries={[r]} now={now}/></MemoryRouter>);
 const list=screen.getByRole('list');
 expect(within(list).getAllByRole('link').map(a=>a.getAttribute('href'))).toEqual(['/game/repeat','/game/first']);
 const badge=screen.getByText('Ada · Mic drop');
 expect(badge.closest('a')?.getAttribute('href')).toBe('/game/first');
 expect(screen.getAllByText('Ada · Mic drop')).toHaveLength(1);
 expect(screen.getByRole('link',{name:'See all'}).getAttribute('href')).toBe('/games');
 expect(screen.queryByRole('searchbox')).toBeNull();
 expect(screen.getAllByRole('img',{name:/Hall of Fame/})).toHaveLength(2);
});
it('shows five finished games and excludes deleted, future and missing-parent activity',()=>{
 const games=Array.from({length:7},(_,i)=>game(`g${i}`,i+1));
 games.push({...game('deleted',0),deleted_at:'2026-11-24'},game('future',-10),{...game('orphan',0),rivalry_id:'missing'}, {...game('archived',0),rivalry_id:'archived'}, {...game('live',0),ended_at:null});
 render(<MemoryRouter><HomeActivity games={games} rivalries={[r,{...r,id:'archived',deleted_at:'2026-11-24'}]} now={now}/></MemoryRouter>);
 expect(within(screen.getByRole('list')).getAllByRole('link').map(a=>a.getAttribute('href'))).toEqual(['/game/g0','/game/g1','/game/g2','/game/g3','/game/g4']);
 expect(screen.queryByText('Ada · Mic drop')).toBeNull(); // first earned in older g6, outside the five rows
});
it('keeps a useful empty state without an empty list',()=>{
 render(<MemoryRouter><HomeActivity games={[]} rivalries={[r]} now={now}/></MemoryRouter>);
 expect(screen.getByText('The table is quiet. Your next result goes here.')).toBeTruthy();
 expect(screen.queryByRole('list')).toBeNull();
});
