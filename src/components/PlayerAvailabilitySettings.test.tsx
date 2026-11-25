// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlayerAvailabilitySettings } from './PlayerAvailabilitySettings';
import { Players } from '../pages/Players';
import { PlayerJersey } from './PlayerJersey';
import type { Player } from '../lib/types';
const fixture=vi.hoisted(()=>({players:[] as Player[],games:[],rivalries:[],loading:false,busy:false,error:'',updateAvailability:vi.fn()}));
vi.mock('../lib/store',()=>({useStore:()=>fixture}));
beforeEach(()=>{
 fixture.players=[{id:'j',name:'josh',created_at:'2026-01-01'}];
 fixture.updateAvailability.mockImplementation(async(player:Player,availability:Player['availability'])=>{fixture.players=[{...player,availability,availability_revision:1}];});
});
afterEach(()=>{cleanup();vi.clearAllMocks();vi.useRealTimers();});
it('starts available, previews custom status, and saves for the chosen player',async()=>{
 render(<MemoryRouter><PlayerAvailabilitySettings/></MemoryRouter>);
 expect((screen.getByLabelText('Availability') as HTMLSelectElement).value).toBe('available');
 fireEvent.change(screen.getByLabelText('Availability'),{target:{value:'out'}});
 fireEvent.change(screen.getByLabelText('Status text'),{target:{value:'Sprained wrist'}});
 fireEvent.change(screen.getByLabelText('Estimated return'),{target:{value:'2099-12-01'}});
 expect(screen.getByLabelText('Out')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Save status'}));
 await waitFor(()=>expect(screen.getByRole('status').textContent).toBe('Saved for everyone.'));
 expect(fixture.updateAvailability).toHaveBeenCalledWith(expect.objectContaining({id:'j'}),{status:'out',reason:'Sprained wrist',returnDate:'2099-12-01'});
});
it('keeps unsaved edits and shows save errors',async()=>{
 fixture.updateAvailability.mockRejectedValueOnce(new Error('Availability changed on another device.'));
 render(<MemoryRouter><PlayerAvailabilitySettings/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText('Availability'),{target:{value:'out'}});
 fireEvent.click(screen.getByRole('button',{name:'Save status'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('another device'));
 expect(screen.getByLabelText('Out')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Reset changes'}));
 expect(screen.queryByLabelText('Out')).toBeNull();
});
it('only fades profile jerseys and restores the normal profile at the return date',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-12-01T07:59:59Z'));
 fixture.players[0].availability={status:'out',reason:'OOO',returnDate:'2026-12-01'};
 const {container}=render(<MemoryRouter><Players/><div data-testid="game-jersey"><PlayerJersey name="josh"/></div></MemoryRouter>);
 expect(container.querySelector('.passport-portrait-out')).toBeTruthy();
 expect(screen.getByTestId('game-jersey').querySelector('.passport-portrait-out')).toBeNull();
 act(()=>vi.advanceTimersByTime(1000));
 expect(container.querySelector('.passport-portrait-out')).toBeNull();
 expect(screen.queryByLabelText('Out')).toBeNull();
 expect(screen.getByText('First game still to come')).toBeTruthy();
});
