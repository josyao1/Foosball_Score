// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Backlog } from '../pages/Backlog';
import { PlayerAppearanceContext, usePlayerAppearance } from '../lib/PlayerAppearanceContext';
import { PlayerJersey } from './PlayerJersey';
import { defaultAppearance } from '../lib/playerAppearance';
const fixture=vi.hoisted(()=>({players:[{id:'j',name:'josh',created_at:'2026-01-01'}],loading:false,busy:false,error:'',updatePlayer:vi.fn(),loadBacklog:vi.fn(async()=>({rivalries:[],games:[]}))}));
vi.mock('../lib/store',()=>({useStore:()=>fixture}));
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'));}});
 fixture.updatePlayer.mockResolvedValue(undefined);
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('opens settings directly, previews edits, and saves the original identity with customized appearance',async()=>{
 render(<MemoryRouter initialEntries={['/backlog?tab=players']}><Backlog/></MemoryRouter>);
 expect(fixture.loadBacklog).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Edit josh'}));
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Joshua'}});
 fireEvent.change(screen.getByLabelText('Subtitle'),{target:{value:'My team'}});
 fireEvent.change(screen.getByLabelText('Jersey lettering'),{target:{value:'JY'}});
 fireEvent.change(screen.getByLabelText('Shirt color'),{target:{value:'#123456'}});
 expect(screen.getByRole('dialog').querySelector('.player-jersey path')?.getAttribute('fill')).toBe('#123456');
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(fixture.updatePlayer).toHaveBeenCalledWith(fixture.players[0],{name:'Joshua',appearance:{...defaultAppearance('josh'),letters:'JY',subtitle:'My team',color:'#123456'}});
});
it('cancel does not save and failed saves keep the editor open',async()=>{
 render(<MemoryRouter initialEntries={['/backlog?tab=players']}><Backlog/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Edit josh'}));
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(fixture.updatePlayer).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Edit josh'}));
 fixture.updatePlayer.mockRejectedValueOnce(new Error('Player was edited on another device.'));
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('another device'));
 expect(screen.getByRole('dialog')).toBeTruthy();
});
it('shares customized jerseys and subtitles with existing name-based consumers',()=>{
 const appearance={...defaultAppearance('josh'),letters:'NEW',color:'#abcdef',subtitle:'Custom role'};
 function Subtitle(){return <p>{usePlayerAppearance('JOSHUA').subtitle}</p>;}
 const {container}=render(<PlayerAppearanceContext.Provider value={[{...fixture.players[0],name:'Joshua',appearance}]}><PlayerJersey name="Joshua"/><Subtitle/></PlayerAppearanceContext.Provider>);
 expect(container.querySelector('svg path')?.getAttribute('fill')).toBe('#abcdef');expect(container.querySelector('svg text')?.textContent).toBe('NEW');expect(screen.getByText('Custom role')).toBeTruthy();
});
