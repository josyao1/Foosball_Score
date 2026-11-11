// @vitest-environment jsdom
import { it,expect,afterEach } from 'vitest';
import { cleanup,render,screen,within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecentGames,recentGames } from './RecentGames';
import type { Game,Rivalry } from '../lib/types';
afterEach(cleanup);
const r:Rivalry={id:'r',player_a:'Ada',player_b:'Bea',created_at:''};
const games:Game[]=Array.from({length:7},(_,i)=>({id:`g${i}`,rivalry_id:i%2?'r':'s',revision:1,started_at:`2026-11-10T18:0${i}:00Z`,ended_at:`2026-11-10T18:0${i}:40Z`,goals:[{id:`goal${i}`,actor_side:'b',rung:'goalie',flags:[],elapsed_ms:40000,occurred_at:''}]}));
it('shows the latest five completed games across all rivalries with date, duration, score and links',()=>{
 render(<MemoryRouter><RecentGames games={[...games,{...games[6],id:'live',ended_at:null}]} rivalries={[r,{...r,id:'s',player_a:'Cy'}]}/></MemoryRouter>);
 const feed=within(screen.getByRole('region',{name:'Recent games'}));
 expect(feed.getAllByRole('link').map(a=>a.getAttribute('href'))).toEqual(['g6','g5','g4','g3','g2'].map(id=>`/game/${id}`));
 expect(feed.getAllByText('0:40')).toHaveLength(5);
 expect(feed.getAllByText(/PST/)).toHaveLength(5);
 expect(feed.getAllByText('Cy').length).toBeGreaterThan(0);
 expect(feed.getAllByText('Ada').length).toBeGreaterThan(0);
});
it('excludes deleted games, archived parents and orphan games; empty state takes no space',()=>{
 const parents=[r,{...r,id:'s',deleted_at:'2026-11-10'}];
 expect(recentGames(games.map(g=>({...g,deleted_at:g.id==='g5'?'2026-11-10':null})),parents).map(x=>x.game.id)).toEqual(['g3','g1']);
 render(<MemoryRouter><RecentGames games={games} rivalries={[]}/></MemoryRouter>);
 expect(screen.queryByRole('region')).toBeNull();
});
