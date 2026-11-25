// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomePersonal, personalResults } from './HomePersonal';
import { OPEN_PROFILE_EVENT, selectProfile } from '../lib/profile';
import type { Game, Player, Rivalry } from '../lib/types';
const josh:Player={id:'j',name:'Josh',created_at:''}, brooks:Player={id:'b',name:'Brooks',created_at:''}, max:Player={id:'m',name:'Max',created_at:''};
const solo:Rivalry={id:'s',player_a:'Brooks',player_b:'Josh',created_at:'',members:{a:[brooks],b:[josh]}};
const team:Rivalry={id:'t',player_a:'Josh and Max',player_b:'Brooks',created_at:'',members:{a:[josh,max],b:[brooks]}};
const now=Date.parse('2026-11-17T20:00:00Z'), weekStart=Date.parse('2026-11-16T08:00:00Z');
function game(id:string,rivalry_id:string,a:number,b:number,ended_at='2026-11-17T19:00:00Z'):Game {
 return {id,rivalry_id,ended_at,started_at:ended_at,revision:1,goals:[...Array(a).fill('a'),...Array(b).fill('b')].map((actor_side,i)=>({id:String(i),actor_side,rung:'attacker',flags:[],elapsed_ms:i*1000,occurred_at:ended_at}))};
}
const state={rivalries:[solo,team],players:[josh,brooks,max],games:[] as Game[]};
vi.mock('../lib/store',()=>({useStore:()=>state}));
beforeEach(()=>{localStorage.clear();selectProfile(null);state.games=[];});
afterEach(()=>{cleanup();selectProfile(null);vi.restoreAllMocks();});
it('offers the shared profile chooser when no valid player is selected',()=>{
 selectProfile('unknown-player');
 const open=vi.fn();window.addEventListener(OPEN_PROFILE_EVENT,open);
 render(<MemoryRouter><HomePersonal weekStart={weekStart} now={now}/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Choose your player'}));
 expect(open).toHaveBeenCalledOnce();window.removeEventListener(OPEN_PROFILE_EVENT,open);
});
it('separates weekly singles and team records and shows the latest score from the selected player’s side',()=>{
 selectProfile('JOSH');
 state.games=[game('solo','s',8,10),game('team','t',3,10,'2026-11-16T19:00:00Z'),game('older','t',10,8,'2026-11-10T19:00:00Z')];
 render(<MemoryRouter><HomePersonal weekStart={weekStart} now={now}/></MemoryRouter>);
 expect(within(screen.getByText('Singles').parentElement!).getByText('1W–0L')).toBeTruthy();
 expect(within(screen.getByText('Team games').parentElement!).getByText('0W–1L')).toBeTruthy();
 expect(screen.getByRole('link',{name:/Won 10–8 vs Brooks/}).getAttribute('href')).toBe('/game/solo');
 act(()=>selectProfile('b'));
 expect(screen.getByRole('heading',{name:'Brooks'})).toBeTruthy();
 expect(screen.getByRole('link',{name:/Lost 8–10 vs Josh/})).toBeTruthy();
});
it('excludes live, deleted, orphaned, future and other players’ games without treating draws as losses',()=>{
 const valid=game('draw','s',3,3);
 const games=[valid,{...game('live','s',3,2),ended_at:null},{...game('deleted','s',10,0),deleted_at:'2026-11-17'},game('future','s',10,0,'2026-11-18T19:00:00Z'),game('orphan','missing',10,0)];
 expect(personalResults(games,[solo,team],'j',now).map(r=>[r.game.id,r.result])).toEqual([['draw','D']]);
 expect(personalResults(games,[solo,team],'m',now)).toEqual([]);
 expect(personalResults(games,[{...solo,deleted_at:'2026-11-17'},team],'j',now)).toEqual([]);
 state.games=[valid];selectProfile('j');
 render(<MemoryRouter><HomePersonal weekStart={weekStart} now={now}/></MemoryRouter>);
 expect(screen.getByText('0W–0L')).toBeTruthy();
 expect(screen.getByText('1 game · 1 draw')).toBeTruthy();
});
it('totals personal goals and playing time for this week, excluding own goals and older games',()=>{
 selectProfile('j');
 const singles=game('singles','s',2,3);
 singles.goals=singles.goals.map((g,i)=>({...g,elapsed_ms:(i+1)*60000}));
 const doubles=game('doubles','t',4,1);
 doubles.goals=doubles.goals.map((g,i)=>({...g,elapsed_ms:(i+1)*120000,
   rung:i===0?'goalie':'attacker',flags:i===2?['own_goal']:[],
   lineup:{a:{defense:'m',attack:'j'},b:{defense:'b',attack:'b'}}}));
 state.games=[singles,doubles,game('older','s',0,10,'2026-11-10T19:00:00Z')];
 render(<MemoryRouter><HomePersonal weekStart={weekStart} now={now}/></MemoryRouter>);
 expect(within(screen.getByText('Goals scored').parentElement!).getByText('5')).toBeTruthy();
 expect(within(screen.getByText('Time played').parentElement!).getByText('15 min')).toBeTruthy();
});

it('opens the weekly breakdown by default while showing the combined record and latest result',()=>{
 selectProfile('j');state.games=[game('win','s',8,10),game('loss','t',3,10),game('draw','s',3,3)];
 render(<MemoryRouter><HomePersonal weekStart={weekStart} now={now}/></MemoryRouter>);
 expect(screen.getByLabelText('Weekly record').textContent).toContain('1W–1L–1D');
 expect(screen.getByLabelText('Weekly record').textContent).toContain('3 games');
 const toggle=screen.getByRole('button',{name:'Weekly breakdown'});
 expect(toggle.getAttribute('aria-expanded')).toBe('true');
 const panel=document.getElementById(toggle.getAttribute('aria-controls')!)!;
 expect(panel.getAttribute('aria-hidden')).toBe('false');
 fireEvent.click(toggle);
 expect(toggle.getAttribute('aria-expanded')).toBe('false');
 expect(panel.getAttribute('aria-hidden')).toBe('true');
 expect(panel.hasAttribute('inert')).toBe(true);
 fireEvent.click(toggle);
 expect(toggle.getAttribute('aria-expanded')).toBe('true');
 expect(panel.hasAttribute('inert')).toBe(false);
 expect(screen.getByRole('link',{name:/Your latest result/})).toBeTruthy();
});
