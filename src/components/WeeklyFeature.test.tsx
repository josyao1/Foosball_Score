// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WeeklyFeature, WeeklyFeatureCards } from './WeeklyFeature';
import { DEFAULT_WEEKLY_SETTINGS, weeklyFeature } from '../lib/weeklyFeature';
import type { Game, Rivalry } from '../lib/types';
const rivalry:Rivalry={id:'weekly-r',player_a:'Josh',player_b:'Brooks',created_at:'2026-01-01'};
const game:Game={id:'weekly-g',rivalry_id:rivalry.id,started_at:'2026-11-10T20:00:00Z',ended_at:'2026-11-10T20:10:00Z',revision:1,
  goals:[...('ab'.repeat(8)+'aa')].map((side,i)=>({id:String(i),actor_side:side==='a'?'a':'b',rung:'attacker',flags:[],elapsed_ms:(i+1)*20000,occurred_at:'2026-11-10T20:10:00Z'}))};
function feature(date:string,enabled=true) {const now=Date.parse(date),settings={...DEFAULT_WEEKLY_SETTINGS,enabled};return {...weeklyFeature([game],[rivalry],settings,now),now,settings,loading:false};}
beforeEach(()=>{
 localStorage.clear();
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'));}});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('shows the home banner during the week without opening a popup early',()=>{
 render(<MemoryRouter><WeeklyFeature feature={feature('2026-11-17T20:00:00Z')}/></MemoryRouter>);
 expect(screen.getByRole('heading',{name:'This week at the table'})).toBeTruthy();
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.getByRole('link',{name:'Open matchup'}).getAttribute('href')).toBe('/rivalry/weekly-r');
});
it('opens once on Friday and stays dismissed after navigating back to Home',()=>{
 const f=feature('2026-11-20T20:00:00Z');
 const view=render(<MemoryRouter><WeeklyFeature feature={f}/></MemoryRouter>);
 const popup=screen.getByRole('dialog',{name:'This week at the table'});
 fireEvent.click(within(popup).getByRole('button',{name:'Back to Home'}));
 expect(screen.queryByRole('dialog')).toBeNull();view.unmount();
 render(<MemoryRouter><WeeklyFeature feature={f}/></MemoryRouter>);
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(localStorage.getItem('tabletalk.weekly-feature.2026-11-16')).toBe('seen');
});
it('waits for another home dialog to close before presenting the weekly feature',()=>{
 const f=feature('2026-11-27T20:00:00Z');
 const view=render(<MemoryRouter><WeeklyFeature feature={f} pausePopup/></MemoryRouter>);
 expect(screen.queryByRole('dialog')).toBeNull();
 act(()=>view.rerender(<MemoryRouter><WeeklyFeature feature={f}/></MemoryRouter>));
 expect(screen.getByRole('dialog')).toBeTruthy();
});
it('removes both banner and popup when the shared setting is disabled',()=>{
 render(<MemoryRouter><WeeklyFeature feature={feature('2026-12-04T20:00:00Z',false)}/></MemoryRouter>);
 expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByRole('heading')).toBeNull();
});

it('lets the mobile controls navigate cards and follows a manual swipe',()=>{
 render(<MemoryRouter><WeeklyFeatureCards feature={feature('2026-11-17T20:00:00Z')}/></MemoryRouter>);
 const first=screen.getByRole('article',{name:'Recommended matchup'});
 const second=screen.getByRole('article',{name:'Game of the week'});
 const row=first.parentElement!;
 Object.defineProperties(row,{clientWidth:{value:320},scrollWidth:{value:654}});
 Object.defineProperty(second,'offsetLeft',{value:334});
 const scrollTo=vi.fn();Object.defineProperty(row,'scrollTo',{value:scrollTo});
 const controls=within(screen.getByRole('group',{name:'Weekly cards'}));
 const next=controls.getByRole('button',{name:'Game of the week'});
 fireEvent.click(next);
 expect(scrollTo).toHaveBeenCalledWith({left:334,behavior:'smooth'});
 expect(next.getAttribute('aria-pressed')).toBe('true');
 row.scrollLeft=0;fireEvent.scroll(row);
 expect(controls.getByRole('button',{name:'Matchup'}).getAttribute('aria-pressed')).toBe('true');
 row.scrollLeft=334;fireEvent.scroll(row);
 expect(next.getAttribute('aria-pressed')).toBe('true');
 const previous=window.matchMedia;
 window.matchMedia=vi.fn().mockReturnValue({matches:true});
 fireEvent.click(controls.getByRole('button',{name:'Matchup'}));
 expect(scrollTo).toHaveBeenLastCalledWith({left:0,behavior:'auto'});
 window.matchMedia=previous;
});
