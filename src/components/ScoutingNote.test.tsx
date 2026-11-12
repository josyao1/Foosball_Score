// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScoutingNote } from './ScoutingNote';
import { scoutingCandidates } from '../lib/scouting';
import { readScoutingChoices, useScoutingNotes } from '../lib/useScoutingNotes';
import type { Game, Rivalry } from '../lib/types';
const r:Rivalry={id:'r',player_a:'Josh',player_b:'Brooks',created_at:'2026-01-01'};
const game:Game={id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-01T18:00:00Z',ended_at:'2026-11-01T18:10:00Z',goals:Array.from({length:10},(_,i)=>({id:`g${i}`,actor_side:'a',rung:'goalie',flags:[],elapsed_ms:i*1000,occurred_at:'2026-11-01T18:00:00Z'}))};
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:vi.fn(function(this:HTMLDialogElement){this.setAttribute('open','');})});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:vi.fn(function(this:HTMLDialogElement){this.removeAttribute('open');this.dispatchEvent(new Event('close'));})});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.removeItem('tabletalk.scouting-notes.v1');});
it('opens the evidence in a dialog, updates current claims while open and closes',()=>{
 const note=scoutingCandidates([game],[r]).josh[0];
 const view=render(<MemoryRouter><ScoutingNote note={note} name="Josh"/></MemoryRouter>);
 expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/Scouting note for Josh/}));
 expect(screen.getByRole('dialog')).toBeTruthy();
 expect(within(screen.getByRole('list')).getByRole('link').getAttribute('href')).toBe('/game/g');
 view.rerender(<MemoryRouter><ScoutingNote note={{...note,text:'Updated with new results.'}} name="Josh"/></MemoryRouter>);
 expect(within(screen.getByRole('dialog')).getByText('Updated with new results.')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));
 expect(screen.queryByRole('dialog')).toBeNull();
});
it('stores only chosen IDs, refreshes on deletion and recomputes on restore',()=>{
 const {result,rerender}=renderHook(({games})=>useScoutingNotes(games,[r]),{initialProps:{games:[game]}});
 expect(result.current.josh.id).toBe('outing');
 expect(JSON.parse(localStorage.getItem('tabletalk.scouting-notes.v1')!)).toEqual({josh:'outing'});
 rerender({games:[{...game,deleted_at:'2026-11-02'}]});expect(result.current).toEqual({});
 rerender({games:[game]});expect(result.current.josh.text).toContain('10 goals');
});
it('tolerates corrupt or unavailable preference storage',()=>{
 localStorage.setItem('tabletalk.scouting-notes.v1','{"josh":null,"brooks":"outing"}');
 expect(readScoutingChoices()).toEqual({brooks:'outing'});
 localStorage.setItem('tabletalk.scouting-notes.v1','broken');expect(readScoutingChoices()).toEqual({});
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
 const {result}=renderHook(()=>useScoutingNotes([game],[r]));
 expect(result.current.josh.text).toContain('10 goals');
});
it('does not erase saved choices while the shared table is still loading',()=>{
 localStorage.setItem('tabletalk.scouting-notes.v1',JSON.stringify({josh:'outing'}));
 renderHook(()=>useScoutingNotes([],[],false));
 expect(readScoutingChoices()).toEqual({josh:'outing'});
});
