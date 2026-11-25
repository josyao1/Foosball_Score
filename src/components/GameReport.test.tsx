// @vitest-environment jsdom
import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {Timeline} from './GameReport';
import {defaultLineup} from '../lib/participants';
import {PlayerAppearanceContext} from '../lib/PlayerAppearanceContext';
import type {Game, Goal, Rivalry} from '../lib/types';
afterEach(cleanup);
const rivalry:Rivalry={id:'r',player_a:'Josh and Brooks',player_b:'Andrew',created_at:''};
const before=defaultLineup(rivalry);
const after={...before,a:{defense:'brooks',attack:'josh'}};
const goal=(id:string,lineup:Goal['lineup'],flags:Goal['flags']=[]):Goal=>({id,actor_side:'a',rung:'attacker',flags,lineup,elapsed_ms:Number(id)*1000,occurred_at:''});
const game:Game={id:'g',rivalry_id:'r',revision:1,started_at:'',ended_at:null,lineup:after,goals:[goal('1',before),goal('2',after)]};
it.each([false,true])('shows the saved individual scorer before and after a swap (live feed: %s)',compact=>{
 render(<Timeline game={game} rivalry={rivalry} compact={compact}/>);
 const rows=screen.getAllByRole('listitem');
 const names=rows.map(row=>row.querySelector('.timeline-individual-scorer')?.textContent);
 expect(names).toEqual(compact?['Josh','Brooks']:['Brooks','Josh']);
 if(compact) for (const row of rows) expect(row.querySelector('.timeline-player strong')?.textContent?.trim()).toBe('Josh and Brooks');
 else for(const row of rows) expect(row.querySelector('.goal-lane-event')?.getAttribute('data-side')).toBe('a');
 expect(within(rows[compact?0:1]).getByText('2').className).toContain('timeline-score-changed');
});
it('names the own-goal actor while crediting the opponent',()=>{
 render(<Timeline game={{...game,goals:[goal('1',before,['own_goal'])]}} rivalry={rivalry}/>);
 const row=screen.getByRole('listitem');
 expect(row.querySelector('.goal-lane-event')?.getAttribute('data-side')).toBe('b');
 expect(within(row).getByText('By Brooks')).toBeTruthy();
 expect(row.querySelector('.goal-lane-score')?.getAttribute('aria-label')).toBe('Josh and Brooks 0, Andrew 1');
});
it('keeps historical team goals unassigned even when a current lineup exists',()=>{
 render(<Timeline game={{...game,goals:[goal('1',null)]}} rivalry={rivalry}/>);
 const row=screen.getByRole('listitem');
 expect(within(row).getByText('Attacker')).toBeTruthy();
 expect(within(row).getByText('Scorer not recorded')).toBeTruthy();
 expect(within(row).queryByText('Josh')).toBeNull();
 expect(within(row).queryByText('Brooks')).toBeNull();
});

it('shows both 2v2 rosters and the saved scorer on the right team after swaps',()=>{
 const team:Rivalry={...rivalry,player_b:'Frank and Max',members:{a:[{id:'josh',name:'Josh',created_at:''},{id:'brooks',name:'Brooks',created_at:''}],b:[{id:'frank',name:'Frank',created_at:''},{id:'max',name:'Max',created_at:''}]}};
 const lineup=defaultLineup(team);
 const later={...lineup,b:{defense:'max',attack:'frank'}};
 render(<Timeline rivalry={team} game={{...game,goals:[{...goal('1',lineup),actor_side:'b'},{...goal('2',later),actor_side:'b'}]}}/>);
 expect(screen.getByRole('group',{name:'Left side: Josh and Brooks'})).toBeTruthy();
 expect(screen.getByRole('group',{name:'Right side: Frank and Max'})).toBeTruthy();
 const rows=screen.getAllByRole('listitem');
 expect(within(rows[0]).getByText('Max')).toBeTruthy();
 expect(within(rows[1]).getByText('Frank')).toBeTruthy();
 for(const row of rows)expect(row.querySelector('.goal-lane-event')?.getAttribute('data-side')).toBe('b');
});

it('marks a completed run once and detects a lead change through a tie',()=>{
 const goals=['a','b','b','b','b','a','a','a','a'].map((side,i)=>({...goal(String(i+1),before),actor_side:side as 'a'|'b'}));
 render(<Timeline rivalry={rivalry} game={{...game,goals:[...goals].reverse()}}/>);
 expect(screen.getAllByText('4 unanswered')).toHaveLength(2);
 expect(screen.getAllByText('Takes the lead')).toHaveLength(2);
 const rows=screen.getAllByRole('listitem');
 expect(rows).toHaveLength(9);
 expect(rows[0].querySelector('.goal-lane-score')?.getAttribute('aria-label')).toBe('Josh and Brooks 1, Andrew 0');
 expect(rows[8].querySelector('.goal-lane-score')?.getAttribute('aria-label')).toBe('Josh and Brooks 5, Andrew 4');
});

it('keeps corrections attached to the original goal in either lane',()=>{
 const edit=vi.fn(),remove=vi.fn();
 const own=goal('1',before,['own_goal']);
 render(<Timeline rivalry={rivalry} game={{...game,goals:[own]}} onEdit={edit} onRemove={remove}/>);
 fireEvent.click(screen.getByRole('button',{name:'Goal actions at 0:01'}));
 fireEvent.click(screen.getByRole('button',{name:'Edit goal at 0:01'}));
 expect(edit).toHaveBeenCalledWith(own);
 fireEvent.click(screen.getByRole('button',{name:'Goal actions at 0:01'}));
 fireEvent.click(screen.getByRole('button',{name:'Remove goal at 0:01'}));
 expect(remove).toHaveBeenCalledWith(own);
});

it('shows an empty result timeline without invented events',()=>{
 render(<Timeline rivalry={rivalry} game={{...game,goals:[]}}/>);
 expect(screen.getByText('No goals yet.')).toBeTruthy();
 expect(screen.queryAllByRole('listitem')).toHaveLength(0);
});

it('uses the recorded scorer’s saved jersey colors after a swap, leaving unknown and own goals neutral',()=>{
 const players=[{id:'josh',name:'Josh',created_at:'',appearance:{letters:'J',color:'#552288',trim:'#ddbb44',lettering:'#ffffff',subtitle:''}},
 {id:'brooks',name:'Brooks',created_at:'',appearance:{letters:'B',color:'#227799',trim:'#aaccff',lettering:'#ffffff',subtitle:''}}];
 const {container}=render(<PlayerAppearanceContext.Provider value={players}><Timeline rivalry={rivalry} game={{...game,goals:[goal('1',before),goal('2',after),goal('3',null),goal('4',before,['own_goal'])]}}/></PlayerAppearanceContext.Provider>);
 const entries=Array.from(container.querySelectorAll<HTMLElement>('.goal-lane-event'));
 expect(entries.map(e=>e.style.getPropertyValue('--scorer-color'))).toEqual(['#227799','#552288','','']);
 expect(entries.map(e=>e.style.getPropertyValue('--scorer-trim'))).toEqual(['#aaccff','#ddbb44','','']);
});
