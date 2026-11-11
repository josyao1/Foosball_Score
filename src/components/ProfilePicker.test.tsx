// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { PROFILE_KEY,profileFirst,isProfileRivalry,selectProfile } from '../lib/profile';
const rivalries=[{id:'ab',player_a:'Andrew',player_b:'Brooks',created_at:''},{id:'jb',player_a:' Josh ',player_b:'Brooks',created_at:''},{id:'team',player_a:'Josh and Brooks',player_b:'Andrew',created_at:''}];
vi.mock('../lib/store',()=>({useStore:()=>({rivalries,games:[],cloud:true,loading:false,error:null})}));
beforeEach(()=>{
 localStorage.clear();sessionStorage.clear();selectProfile(null);
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false;this.dispatchEvent(new Event('close'));}});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();selectProfile(null);sessionStorage.clear();});
it('invites an unselected visitor to choose a profile and disappears after selection',()=>{
 render(<MemoryRouter><App/></MemoryRouter>);
 const prompt=screen.getByRole('complementary',{name:'Choose your profile'});
 expect(prompt.textContent).toContain('prioritize your rivalries');
 fireEvent.click(within(prompt).getByRole('button',{name:'Choose profile'}));
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Josh'}));
 expect(screen.queryByRole('complementary',{name:'Choose your profile'})).toBeNull();
 expect(screen.getByRole('button',{name:/Your profile: Josh/})).toBeTruthy();
});
it('lets visitors dismiss the reminder for the session while keeping the profile picker available',()=>{
 const view=render(<MemoryRouter><App/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Dismiss profile reminder'}));
 view.unmount();
 render(<MemoryRouter><App/></MemoryRouter>);
 expect(screen.queryByRole('complementary',{name:'Choose your profile'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Select profile'}));
 expect(screen.getByRole('dialog')).toBeTruthy();
});
it('persists a selection, prioritizes its passport, and allows clearing the device preference',()=>{
 const view=render(<MemoryRouter initialEntries={['/players']}><App/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Select profile'}));
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Josh'}));
 expect(localStorage.getItem(PROFILE_KEY)).toBe('josh');
 expect(screen.getByRole('button',{name:/Your profile: Josh/})).toBeTruthy();
 expect(screen.getAllByRole('article')[0].getAttribute('aria-label')).toBe('Josh passport');
 view.unmount();
 render(<MemoryRouter initialEntries={['/players']}><App/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:/Your profile: Josh/}));
 fireEvent.click(screen.getByRole('button',{name:'Use without a profile'}));
 expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
 expect(screen.getByRole('button',{name:'Select profile'})).toBeTruthy();
});
it('prioritizes matching rivalries including team memberships',()=>{
 selectProfile('JOSH');
 render(<MemoryRouter><App/></MemoryRouter>);
 expect(screen.queryByRole('complementary',{name:'Choose your profile'})).toBeNull();
 const cards = within(screen.getByRole('region',{name:'Rivalry cards'})).getAllByRole('link');
 expect(cards.map(card=>card.getAttribute('href'))).toEqual(['/rivalry/jb','/rivalry/team']);
 fireEvent.click(screen.getByText('Other rivalries'));
 expect(screen.getByRole('link',{name:/Andrew vs Brooks/}).getAttribute('href')).toBe('/rivalry/ab');
 expect(profileFirst(rivalries,r=>isProfileRivalry(r,'josh')).map(r=>r.id)).toEqual(['jb','team','ab']);
 expect(rivalries.map(r=>r.id)).toEqual(['ab','jb','team']);
});
it('updates other tabs and handles unavailable storage without crashing',()=>{
 render(<MemoryRouter initialEntries={['/players']}><App/></MemoryRouter>);
 localStorage.setItem(PROFILE_KEY,'brooks');fireEvent(window,new StorageEvent('storage',{key:PROFILE_KEY}));
 expect(screen.getByRole('button',{name:/Your profile: Brooks/})).toBeTruthy();
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
 fireEvent.click(screen.getByRole('button',{name:/Your profile: Brooks/}));
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Josh'}));
 expect(screen.getByRole('button',{name:/Your profile: Josh/})).toBeTruthy();
 expect(screen.getByRole('status').textContent).toContain('couldn’t save');
});
