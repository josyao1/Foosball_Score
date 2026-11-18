// @vitest-environment jsdom
import { it,expect,afterEach } from 'vitest';
import { cleanup,render,screen,within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecentGames,recentGames,gameHistory,GameHistoryList } from './RecentGames';
import type { Game,Rivalry } from '../lib/types';
afterEach(cleanup);
const r:Rivalry={id:'r',player_a:'Ada',player_b:'Bea',created_at:''};
const games:Game[]=Array.from({length:7},(_,i)=>({id:`g${i}`,rivalry_id:i%2?'r':'s',revision:1,started_at:`2026-11-10T18:0${i}:00Z`,ended_at:`2026-11-10T18:0${i}:40Z`,goals:[{id:`goal${i}`,actor_side:'b',rung:'goalie',flags:[],elapsed_ms:40000,occurred_at:''}]}));
it('shows the latest five completed games across all rivalries with date, duration, score and links',()=>{
 render(<MemoryRouter><RecentGames games={[...games,{...games[6],id:'live',ended_at:null}]} rivalries={[r,{...r,id:'s',player_a:'Cy'}]}/></MemoryRouter>);
 const feed=within(screen.getByRole('region',{name:'Recent games'}));
 expect(feed.getByRole('link',{name:'See all'}).getAttribute('href')).toBe('/games');
 expect(within(feed.getByRole('list')).getAllByRole('link').map(a=>a.getAttribute('href'))).toEqual(['g6','g5','g4','g3','g2'].map(id=>`/game/${id}`));
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
it('keeps all finished games in history and sorts without mutating the input',()=>{
 const before=games.map(g=>g.id);
 expect(gameHistory(games,[r,{...r,id:'s'}]).map(entry=>entry.game.id)).toEqual(['g6','g5','g4','g3','g2','g1','g0']);
 expect(games.map(g=>g.id)).toEqual(before);
});

it('stamps the current all-time top twenty with a quieter second tier',()=>{
 const classics:Game[]=Array.from({length:22},(_,i)=>{
   const started_at=new Date(Date.parse('2026-11-10T18:00:00Z')+i*3600000).toISOString();
   return {...games[0],id:`classic-${i}`,rivalry_id:'r',started_at,ended_at:new Date(Date.parse(started_at)+600000).toISOString(),
     goals:[...Array(10)].map((_,n)=>({...games[0].goals[0],id:`goal-${n}`,actor_side:'a' as const,elapsed_ms:(n+1)*30000,occurred_at:started_at}))};
 });
 const view=render(<MemoryRouter><RecentGames games={classics} rivalries={[r]}/></MemoryRouter>);
 expect(screen.getAllByRole('img',{name:/Hall of Fame/}).map(el=>el.getAttribute('aria-label'))).toEqual(['Hall of Fame #20','Hall of Fame #19','Hall of Fame #18']);
 view.unmount();
 const history=render(<MemoryRouter><section className="recent-results"><GameHistoryList entries={gameHistory(classics,[r])}/></section></MemoryRouter>);
 expect(screen.getAllByRole('img',{name:/Hall of Fame/})).toHaveLength(20);
 expect(screen.getByRole('img',{name:'Hall of Fame #11'}).classList.contains('recent-rank-stamp-subtle')).toBe(true);
 expect(screen.getByRole('img',{name:'Hall of Fame #10'}).classList.contains('recent-rank-stamp-subtle')).toBe(false);
 expect(screen.queryByRole('img',{name:'Hall of Fame #21'})).toBeNull();
 const updated=classics.map(g=>g.id==='classic-0'?{...g,deleted_at:'2026-11-17'}:g);
 history.rerender(<MemoryRouter><section className="recent-results"><GameHistoryList entries={gameHistory(updated,[r])}/></section></MemoryRouter>);
 expect(screen.getByRole('img',{name:'Hall of Fame #1'}).closest('a')?.getAttribute('href')).toBe('/game/classic-1');
 expect(screen.getByRole('img',{name:'Hall of Fame #10'}).closest('a')?.getAttribute('href')).toBe('/game/classic-10');
});
