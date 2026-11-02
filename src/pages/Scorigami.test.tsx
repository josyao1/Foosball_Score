// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Scorigami } from './Scorigami';
import { App } from '../App';
import type { Game } from '../lib/types';

const fixture=vi.hoisted(()=>({games:[] as Game[]}));
vi.mock('../lib/store',()=>({useStore:()=>({games:fixture.games,rivalries:[{id:'r',player_a:'Josh',player_b:'Brooks',created_at:'2026-01-01Z'},{id:'other',player_a:'Andrew',player_b:'Alex',created_at:'2026-01-01Z'}],cloud:true,loading:false,error:null})}));
const game=(id:string,a:number,b:number,rivalry='r',ended='2026-11-01T19:00:00Z'):Game=>({id,rivalry_id:rivalry,revision:1,started_at:'2026-11-01T18:00:00Z',ended_at:ended,goals:Array.from({length:a+b},(_,i)=>({id:`${id}-${i}`,actor_side:i<a?'a':'b',rung:'attacker',flags:[],elapsed_ms:(i+1)*1000,occurred_at:'2026-11-01T18:00:01Z'}))});
afterEach(()=>{cleanup();vi.restoreAllMocks();fixture.games=[];});
it('opens score counts, latest game and empty squares; filters across rivalries',()=>{
 fixture.games=[game('old',10,8),game('new',8,10,'other','2026-11-02T19:00:00Z')];
 const {container}=render(<MemoryRouter><Scorigami/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'10–8: 2 games'}));
 expect(screen.getByRole('heading',{name:'10–8'})).toBeTruthy();
 expect(within(screen.getByRole('dialog')).getByRole('link',{name:/Andrew 8, Alex 10/}).getAttribute('href')).toBe('/game/new');
 expect(within(screen.getByRole('dialog')).getByText('100% of finished games')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Rivalry'),{target:{value:'r'}});
 expect(screen.getByRole('button',{name:'10–8: 1 game'})).toBeTruthy();
 expect(screen.queryByRole('link',{name:/Andrew/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'10–0: 0 games'}));
 expect(within(screen.getByRole('dialog')).getByText('Not played yet')).toBeTruthy();
 expect(screen.queryByRole('heading',{name:'Latest game'})).toBeNull();
 expect(container.querySelector('a a')).toBeNull();
});
it('pages overtime finishes and opens a distant most-common score',()=>{
 fixture.games=[game('long',48,46)];
 const {container}=render(<MemoryRouter><Scorigami/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:/Most common/}));
 expect(screen.getByRole('dialog',{name:'48–46 score details'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'48–46: 1 game'})).toBeTruthy();
 expect(container.querySelectorAll('.sc-bar-button').length).toBeLessThanOrEqual(14);
 fireEvent.click(screen.getByRole('button',{name:'Close score details'}));
 fireEvent.click(screen.getByRole('button',{name:'Previous overtime scores'}));
 expect(screen.queryByRole('button',{name:'48–46: 1 game'})).toBeNull();
 expect(screen.queryByRole('dialog')).toBeNull();
});
it('shows regular and overtime distributions with one shared frequency scale',()=>{
 fixture.games=[game('regular1',10,8),game('regular2',8,10),game('deuce',12,10)];
 render(<MemoryRouter><Scorigami/></MemoryRouter>);
 const regular=screen.getByRole('region',{name:'Regular finishes'});
 const overtime=screen.getByRole('region',{name:'Overtime'});
 expect(within(regular).getAllByRole('button')).toHaveLength(9);
 expect(within(overtime).getAllByRole('button')).toHaveLength(2);
 expect(screen.getByRole('button',{name:'10–8: 2 games'}).style.getPropertyValue('--bar-share')).toBe('100%');
 expect(screen.getByRole('button',{name:'12–10: 1 game'}).style.getPropertyValue('--bar-share')).toBe('50%');
 expect(screen.getByRole('button',{name:'10–0: 0 games'}).style.getPropertyValue('--bar-share')).toBe('0%');
 expect(screen.queryByRole('grid')).toBeNull();
});
it('adds a working second navigation tab with only the active tab marked',()=>{
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 render(<MemoryRouter><App/></MemoryRouter>);
 const nav=screen.getByRole('navigation',{name:'Main navigation'});
 const rivalry=within(nav).getByRole('link',{name:'Rivalries'}), sc=within(nav).getByRole('link',{name:'Scorigami'});
 expect(rivalry.getAttribute('aria-current')).toBe('page');expect(sc.hasAttribute('aria-current')).toBe(false);
 fireEvent.click(sc);
 expect(screen.getByRole('heading',{name:'Scorigami'})).toBeTruthy();
 expect(sc.getAttribute('aria-current')).toBe('page');expect(rivalry.hasAttribute('aria-current')).toBe(false);
 expect(screen.getByText('Finish a game and its final score will appear here.')).toBeTruthy();
});

it.each(['/scorigami/', '/Scorigami'])('matches the active tab to router matching at %s', path => {
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>);
 const nav=screen.getByRole('navigation',{name:'Main navigation'});
 expect(within(nav).getByRole('link',{name:'Scorigami'}).getAttribute('aria-current')).toBe('page');
 expect(within(nav).getByRole('link',{name:'Rivalries'}).hasAttribute('aria-current')).toBe(false);
});

it('only renders possible finishes and clips overtime to the latest valid maximum', () => {
 fixture.games=[game('ten',10,8),game('twelve',12,10),game('continued',18,0),game('early',4,2),game('tie',15,15)];
 render(<MemoryRouter><Scorigami/></MemoryRouter>);
 expect(screen.getByRole('button',{name:'11–9: 0 games'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'12–10: 1 game'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:/11–0:/})).toBeNull();
 expect(screen.queryByRole('button',{name:/10–9:/})).toBeNull();
 expect(screen.queryByRole('button',{name:/13–11:/})).toBeNull();
});
it('opens and dismisses a small score popup with latest game, count and focus restoration', () => {
 fixture.games=[game('latest',10,8)];
 render(<MemoryRouter><Scorigami/></MemoryRouter>);
 const cell=screen.getByRole('button',{name:'10–8: 1 game'});
 fireEvent.click(cell);
 const popup=screen.getByRole('dialog',{name:'10–8 score details'});
 expect(within(popup).getByText('1 game')).toBeTruthy();
 expect(within(popup).getByRole('link',{name:/Josh 10, Brooks 8/}).getAttribute('href')).toBe('/game/latest');
 fireEvent.keyDown(document,{key:'Escape'});
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(document.activeElement).toBe(cell);
 fireEvent.click(cell);
 fireEvent.pointerDown(document.body);
 expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(cell);
 fireEvent.click(screen.getByRole('button',{name:'Close score details'}));
 expect(screen.queryByRole('dialog')).toBeNull();
});

it('keeps the board on its own and makes full score history available inside the popup', () => {
 fixture.games=Array.from({length:6},(_,i)=>game(`match-${i}`,10,8));
 const {container}=render(<MemoryRouter><Scorigami/></MemoryRouter>);
 expect(container.querySelector('.sc-details')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'10–8: 6 games'}));
 const popup=screen.getByRole('dialog');
 const summary=within(popup).getByText('Previous games (5)');
 fireEvent.click(summary);
 fireEvent.click(within(popup).getByRole('button',{name:'Show all 6 games'}));
 expect(within(popup).getAllByRole('link')).toHaveLength(6);
});

it('shows a compact overtime empty state and resets it when rivalry changes', () => {
 fixture.games=[game('overtime',12,10,'other'),game('regular',10,6)];
 render(<MemoryRouter><Scorigami/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'12–10: 1 game'}));
 fireEvent.change(screen.getByLabelText('Rivalry'),{target:{value:'r'}});
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.queryByRole('button',{name:'12–10: 1 game'})).toBeNull();
 expect(screen.getByText('No overtime finishes yet.')).toBeTruthy();
});

it('dismisses the popup when a live refresh removes its overtime bar', () => {
 fixture.games=[game('long',48,46),game('short',11,9)];
 const view=render(<MemoryRouter><Scorigami/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:/Most common/}));
 // Navigate explicitly to the final overtime page.
 fireEvent.click(screen.getByRole('button',{name:'Close score details'}));
 while(!(screen.getByRole('button',{name:'Next overtime scores'}) as HTMLButtonElement).disabled) fireEvent.click(screen.getByRole('button',{name:'Next overtime scores'}));
 fireEvent.click(screen.getByRole('button',{name:'48–46: 1 game'}));
 fixture.games=[game('short',11,9)];
 view.rerender(<MemoryRouter><Scorigami/></MemoryRouter>);
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.getByRole('button',{name:'11–9: 1 game'})).toBeTruthy();
});
