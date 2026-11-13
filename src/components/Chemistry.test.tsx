// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Chemistry } from './Chemistry';
import { playerChemistry } from '../lib/chemistry';
import type { Game, Rivalry } from '../lib/types';
afterEach(cleanup);
const p=(id:string)=>({id,name:id,created_at:''});
const r:Rivalry={id:'r',player_a:'josh and brooks',player_b:'andrew',created_at:'',members:{a:[p('josh'),p('brooks')],b:[p('andrew')]}};
const g:Game={id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-01T18:00:00Z',ended_at:'2026-11-01T18:05:00Z',goals:[{id:'goal',actor_side:'a',rung:'attacker',flags:[],elapsed_ms:1000,occurred_at:'2026-11-01T18:00:01Z',lineup:{a:{attack:'josh',defense:'brooks'},b:{attack:'andrew',defense:'andrew'}}}]};
it('shows paired jerseys, sample, true goal shares and switches to team opponents without a repeated recent-results strip',()=>{
 render(<MemoryRouter><Chemistry name="josh" data={playerChemistry([g],[r]).josh}/></MemoryRouter>);
 expect(screen.getByText('With brooks')).toBeTruthy();expect(screen.getByText('1 game')).toBeTruthy();
 expect(screen.getByRole('img',{name:'josh 100 percent, brooks 0 percent of attributed goals'})).toBeTruthy();
 expect(screen.queryByText(/Last 1/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Against'}));
 expect(screen.getByText('Team games')).toBeTruthy();expect(screen.queryByText('Singles')).toBeNull();expect(screen.getByText('Against andrew')).toBeTruthy();
 expect(screen.queryByText('With brooks')).toBeNull();
});
it('makes empty partnerships and opposition explicit',()=>{
 render(<MemoryRouter><Chemistry name="josh"/></MemoryRouter>);
 expect(screen.getByText(/Finish a game with a teammate/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Against'}));expect(screen.getByText(/Your opponents will appear/)).toBeTruthy();
});
