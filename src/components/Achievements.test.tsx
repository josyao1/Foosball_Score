// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Achievements } from './Achievements';
import type { Game } from '../lib/types';
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'));}});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const game:Game={id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-03T18:00:00Z',ended_at:'2026-11-03T18:02:00Z',goals:[]};
it('opens all twenty-two badges, distinguishes grey unearned badges, and shows requirements and source game',()=>{
 render(<MemoryRouter><Achievements name="Josh" earned={{perfect:game}}/></MemoryRouter>);
 const trigger=screen.getByRole('button',{name:/Achievements/});
 expect(screen.queryByRole('dialog')).toBeNull();fireEvent.click(trigger);
 let dialog=screen.getByRole('dialog',{name:'Achievements'});
 expect(dialog.querySelectorAll('.achievement-tile')).toHaveLength(30);
 expect(dialog.querySelector('.achievement-tile')?.getAttribute('aria-label')).toBe('Escape artist, not earned');
 const perfect=within(dialog).getByRole('button',{name:'Perfect paper, earned'});
 expect(perfect.className).toContain('is-earned');
 fireEvent.click(perfect);
 dialog=screen.getByRole('dialog',{name:'Perfect paper'});
 expect(within(dialog).getByText('Win 10–0.')).toBeTruthy();
 expect(within(dialog).getByRole('link').getAttribute('href')).toBe('/game/g');
 expect(within(dialog).getByText(/10:00 AM PST/)).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('button',{name:'All achievements'}));
 expect(screen.getByRole('button',{name:'Perfect paper, earned'})).toBe(document.activeElement);
 const locked=screen.getByRole('button',{name:'Escape artist, not earned'});
 expect(locked.className).toContain('is-locked');fireEvent.click(locked);
 dialog=screen.getByRole('dialog',{name:'Escape artist'});
 expect(within(dialog).getByText(/Save at least 3/)).toBeTruthy();expect(within(dialog).queryByRole('link')).toBeNull();
 fireEvent.click(within(dialog).getByRole('button',{name:'Close dialog'}));
 expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(trigger);
});

it.each([true,false])('shows other earners and their first games when this player earned it: %s',hasEarned=>{
 const players=[
  {key:'josh',name:'Josh',achievements:{perfect:game}},
  {key:'brooks',name:'Brooks',achievements:{perfect:{...game,id:'brooks-first'}}},
  {key:'andrew',name:'Andrew',achievements:{}},
  {key:'josh and brooks',name:'Josh and Brooks',achievements:{perfect:{...game,id:'team-first'}}},
 ];
 render(<MemoryRouter><Achievements name=" JOSH " earned={hasEarned ? {perfect:game} : {}} players={players}/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:/Achievements/}));
 fireEvent.click(screen.getByRole('button',{name:`Perfect paper, ${hasEarned ? 'earned' : 'not earned'}`}));
 const section=screen.getByRole('region',{name:hasEarned ? 'Also earned by' : 'Earned by'});
 expect(within(section).getAllByRole('link')).toHaveLength(2);
 expect(within(section).getByRole('link',{name:/^Brooks: first earned/}).getAttribute('href')).toBe('/game/brooks-first');
 expect(within(section).getByRole('link',{name:/Josh and Brooks: first earned/}).getAttribute('href')).toBe('/game/team-first');
 expect(within(section).queryByText('Andrew')).toBeNull();
 expect(within(section).queryByText('Josh')).toBeNull();
});
it('shows a repeat count and links every earning game in chronological order',()=>{
 const second={...game,id:'second',started_at:'2026-11-04T18:00:00Z'};
 render(<MemoryRouter><Achievements name="Josh" earned={{perfect:game}} history={{perfect:[game,second]}}/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:/Achievements/}));
 const tile=screen.getByRole('button',{name:'Perfect paper, earned 2 times'});
 expect(within(tile).getByText('×2')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Escape artist, not earned'}).querySelector('.achievement-repeat')).toBeNull();
 fireEvent.click(tile);
 const history=screen.getByRole('region',{name:'Earning games'});
 expect(within(history).getAllByRole('link').map(link=>link.getAttribute('href'))).toEqual(['/game/g','/game/second']);
 expect(within(history).getByText('First earned by Josh')).toBeTruthy();
 expect(within(history).getByText('Earned again · 2 of 2')).toBeTruthy();
});
