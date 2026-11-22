// @vitest-environment jsdom
import { it,expect,afterEach,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecentGames,recentGames,gameHistory,GameHistoryList,filterGameHistory } from './RecentGames';
import type { Game,Rivalry } from '../lib/types';
import { GameHistory as GameHistoryPage } from '../pages/GameHistory';
vi.mock('../lib/store',()=>({useStore:()=>({games,rivalries:[r,{...r,id:'s',player_a:'Cy'}]})}));
afterEach(cleanup);
const r:Rivalry={id:'r',player_a:'Ada',player_b:'Bea',created_at:''};
const games:Game[]=Array.from({length:7},(_,i)=>({id:`g${i}`,rivalry_id:i%2?'r':'s',revision:1,started_at:`2026-11-10T18:0${i}:00Z`,ended_at:`2026-11-10T18:0${i}:40Z`,goals:[{id:`goal${i}`,actor_side:'b',rung:'goalie',flags:[],elapsed_ms:40000,occurred_at:''}]}));
it('matches singles and team members by name without case or surrounding-space sensitivity',()=>{
 const team:Rivalry={...r,id:'team',player_a:'Ada and Dee',members:{a:[{id:'ada',name:'Ada',created_at:''},{id:'dee',name:'Dee',created_at:''}],b:[{id:'bea',name:'Bea',created_at:''}]}};
 const history=gameHistory([...games,{...games[0],id:'team-game',rivalry_id:'team'}],[r,{...r,id:'s',player_a:'Cy'},team]);
 expect(filterGameHistory(history,' ADA ').map(entry=>entry.game.id)).toEqual(['g5','g3','g1','team-game']);
 expect(filterGameHistory(history,'dee').map(entry=>entry.game.id)).toEqual(['team-game']);
});
it('shows the latest five completed games across all rivalries with date, duration, score and links',()=>{
 render(<MemoryRouter><RecentGames games={[...games,{...games[6],id:'live',ended_at:null}]} rivalries={[r,{...r,id:'s',player_a:'Cy'}]}/></MemoryRouter>);
 const feed=within(screen.getByRole('region',{name:'Recent games'}));
 expect(feed.queryByRole('searchbox')).toBeNull();
 expect(feed.getByRole('link',{name:'See all'}).getAttribute('href')).toBe('/games');
 expect(within(feed.getByRole('list')).getAllByRole('link').map(a=>a.getAttribute('href'))).toEqual(['g6','g5','g4','g3','g2'].map(id=>`/game/${id}`));
 expect(feed.getAllByText('0:40')).toHaveLength(5);
 expect(feed.getAllByText(/PST/)).toHaveLength(5);
 expect(feed.getAllByText('Cy').length).toBeGreaterThan(0);
 expect(feed.getAllByText('Ada').length).toBeGreaterThan(0);
});
it('opens full history with the player search applied and restores every game when cleared',()=>{
 render(<MemoryRouter initialEntries={['/games?player=Ada']}><GameHistoryPage/></MemoryRouter>);
 expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('Ada');
 expect(within(screen.getByRole('list')).getAllByRole('link').map(a=>a.getAttribute('href'))).toEqual(['/game/g5','/game/g3','/game/g1']);
 expect(screen.getByText('3 games')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Clear player search'}));
 expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(7);
 expect(screen.getByText('7 games')).toBeTruthy();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Nobody'}});
 expect(screen.getByRole('status').textContent).toContain('No games');
 expect(screen.queryByRole('list')).toBeNull();
});
it('opens and focuses the compact search, then closes it and restores the full history',()=>{
 render(<MemoryRouter><GameHistoryPage/></MemoryRouter>);
 const toggle=screen.getByRole('button',{name:'Search players'});
 expect(toggle.getAttribute('aria-expanded')).toBe('false');
 fireEvent.click(toggle);
 const search=screen.getByRole('searchbox');
 expect(document.activeElement).toBe(search);
 fireEvent.change(search,{target:{value:'Ada'}});
 expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(3);
 fireEvent.click(screen.getByRole('button',{name:'Close player search'}));
 expect(screen.getByRole('button',{name:'Search players'}).getAttribute('aria-expanded')).toBe('false');
 expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(7);
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
