// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MatchTicketActions } from './MatchTicketActions';
import { ticketPng } from '../lib/matchTicket';
import type { Game, Rivalry } from '../lib/types';
const state=vi.hoisted(()=>({games:[] as Game[],rivalries:[] as Rivalry[],players:[]}));
vi.mock('../lib/store',()=>({useStore:()=>state}));
vi.mock('../lib/matchTicket',async importOriginal=>({...await importOriginal<typeof import('../lib/matchTicket')>(),ticketPng:vi.fn()}));
const r:Rivalry={id:'r',player_a:'Josh',player_b:'Brooks',created_at:'2026-01-01'};
const g:Game={id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-01T18:00:00Z',ended_at:'2026-11-01T18:05:00Z',goals:Array.from({length:10},(_,i)=>({id:String(i),actor_side:'a',rung:'attacker',flags:[],elapsed_ms:(i+1)*20000,occurred_at:'2026-11-01T18:00:00Z'}))};
beforeEach(()=>{
 state.games=[g];state.rivalries=[r];
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'));}});
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:ticket'),revokeObjectURL:vi.fn()}));
 vi.mocked(ticketPng).mockResolvedValue(new Blob(['png'],{type:'image/png'}));
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});
 vi.stubGlobal('ClipboardItem',undefined);
});
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();});
const show=()=>render(<MemoryRouter><MatchTicketActions game={g} rivalry={r}/></MemoryRouter>);
it('shows current all-time rank and prepares a downloadable PNG only when requested',async()=>{
 show();expect(screen.getByRole('link',{name:'Hall of Fame #1'})).toBeTruthy();expect(ticketPng).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Share ticket'}));
 const download=await screen.findByRole('link',{name:'Download image'});expect(download.getAttribute('download')).toBe('tabletalk-g.png');expect(screen.getByRole('img')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:ticket');
});
it('shows a quiet marker outside the global top ten',()=>{
 state.games=[...Array.from({length:10},(_,i)=>({...g,id:`older-${i}`,started_at:'2026-10-01T18:00:00Z'})),g];
 show();expect(screen.queryByRole('link',{name:/Hall of Fame/})).toBeNull();expect(screen.getByRole('link',{name:'All-time #11'}).className).toBe('all-time-rank');
});
it('copies the prepared PNG on a user click and confirms success',async()=>{
 const write=vi.fn().mockResolvedValue(undefined);
 vi.stubGlobal('ClipboardItem',class { constructor(public data:Record<string,Blob>){} });
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write}});
 show();fireEvent.click(screen.getByRole('button',{name:'Share ticket'}));fireEvent.click(await screen.findByRole('button',{name:'Copy image'}));
 await screen.findByRole('button',{name:'Copied'});
 expect(write.mock.calls[0][0][0].data['image/png'].type).toBe('image/png');
 expect(screen.queryByRole('button',{name:'Share image'})).toBeNull();
});
it('keeps download available when copying is denied',async()=>{
 vi.stubGlobal('ClipboardItem',class { constructor(public data:Record<string,Blob>){} });
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:vi.fn().mockRejectedValue(new Error('denied'))}});
 show();fireEvent.click(screen.getByRole('button',{name:'Share ticket'}));fireEvent.click(await screen.findByRole('button',{name:'Copy image'}));
 expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.getByRole('link',{name:'Download image'})).toBeTruthy();
});
it('allows retry after image preparation fails',async()=>{
 vi.mocked(ticketPng).mockRejectedValueOnce(new Error('no canvas'));
 show();fireEvent.click(screen.getByRole('button',{name:'Share ticket'}));
 expect(await screen.findByRole('alert')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(await screen.findByRole('link',{name:'Download image'})).toBeTruthy();
});
