import { GameAchievementProvider } from './GameAchievements';
// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it } from 'vitest';
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GameCard } from '../pages/Home';
import { GameHighlightTags } from './Records';
import type { Game,Rivalry } from '../lib/types';
const rivalry:Rivalry={id:'r',player_a:'Josh',player_b:'Brooks',created_at:''};
const game:Game={id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-03T18:00:00Z',ended_at:'2026-11-03T18:10:00Z',goals:Array.from({length:10},(_,i)=>({id:`g${i}`,actor_side:'a',rung:'attacker',flags:[],elapsed_ms:(i+1)*40000,occurred_at:'2026-11-03T18:00:00Z'}))};
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'));}});
});
afterEach(cleanup);
it('uses one inline marker in the existing history navigation slot with no extra button or link',()=>{
 const {container,rerender}=render(<MemoryRouter><GameCard game={game} rivalry={rivalry} index={1}/></MemoryRouter>);
 expect(screen.getByRole('img',{name:/Achievements.*Josh: Perfect paper/})).toBeTruthy();
 expect(container.querySelector('.game-card > .game-achievement-marker')).toBeTruthy();
 expect(screen.getAllByRole('link')).toHaveLength(1);
 expect(screen.queryByRole('button')).toBeNull();
 rerender(<MemoryRouter><GameCard game={{...game,ended_at:null}} rivalry={rivalry} index={1}/></MemoryRouter>);
 expect(screen.queryByRole('img')).toBeNull();
 expect(container.querySelector('.game-card > svg')).toBeTruthy();
});
it('adds attributed achievement pills alongside highlights and opens their requirement',()=>{
 render(<MemoryRouter><GameHighlightTags game={game} rivalry={rivalry}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:/10-goal run/})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Josh: Perfect paper. Achievement details'}));
 expect(screen.getByRole('dialog',{name:'Perfect paper'})).toBeTruthy();
 expect(screen.getByText('Win 10–0.')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));
 expect(screen.queryByRole('dialog')).toBeNull();
});
it('shows achievements even with no qualifying run, burst, or fast response highlight',()=>{
 const alternating={...game,goals:game.goals.map((g,i)=>({...g,actor_side:i%2 ? 'b' as const : 'a' as const}))};
 render(<MemoryRouter><GameHighlightTags game={alternating} rivalry={rivalry}/></MemoryRouter>);
 expect(screen.getByRole('button',{name:'Josh: Trading blows. Achievement details'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Brooks: Trading blows. Achievement details'})).toBeTruthy();
 expect(screen.queryByRole('link')).toBeNull();
});
it('includes the fifth-win achievement from the shared game history and updates after corrections',()=>{
 const games=Array.from({length:5},(_,i)=>({...game,id:`g${i}`,ended_at:`2026-11-03T18:${10+i}:00Z`}));
 const renderTags=(items:Game[])=><MemoryRouter><GameAchievementProvider games={items} rivalries={[rivalry]}><GameHighlightTags game={games[4]} rivalry={rivalry}/></GameAchievementProvider></MemoryRouter>;
 const view=render(renderTags(games));
 expect(screen.getByRole('button',{name:'Josh: On a roll. Achievement details'})).toBeTruthy();
 view.rerender(renderTags(games.slice(1)));
 expect(screen.queryByRole('button',{name:'Josh: On a roll. Achievement details'})).toBeNull();
});

it('names only the teammate whose personal streak reaches five',()=>{
 const solo={...rivalry,player_b:'Andrew'};
 const team={...rivalry,id:'team',player_a:'Josh and Brooks',player_b:'Andrew'};
 const singles=Array.from({length:4},(_,i)=>({...game,id:`solo${i}`,ended_at:`2026-11-03T18:${10+i}:00Z`}));
 const fifth={...game,id:'team-win',rivalry_id:'team',ended_at:'2026-11-03T18:20:00Z'};
 render(<MemoryRouter><GameAchievementProvider games={[...singles,fifth]} rivalries={[solo,team]}><GameHighlightTags game={fifth} rivalry={team}/></GameAchievementProvider></MemoryRouter>);
 expect(screen.getByRole('button',{name:'Josh: On a roll. Achievement details'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Josh and Brooks: On a roll. Achievement details'})).toBeNull();
});
