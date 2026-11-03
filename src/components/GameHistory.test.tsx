// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GameHistory } from './GameHistory';
import type { Game, Rivalry } from '../lib/types';
const rivalry: Rivalry={id:'r',player_a:'Josh',player_b:'Brooks',created_at:''};
const games:Game[]=Array.from({length:23},(_,i)=>({id:`g-${23-i}`,rivalry_id:'r',started_at:new Date(Date.UTC(2026,10,23-i)).toISOString(),ended_at:'2026-11-24T00:00:00Z',goals:[],revision:1}));
afterEach(cleanup);
const ui=(items:Game[]) => <MemoryRouter><GameHistory games={items} rivalry={rivalry} onStart={()=>{}} busy={false}/></MemoryRouter>;
it('paginates ten games at a time and keeps global game numbers',()=>{
 render(ui(games));
 const section=screen.getByRole('region',{name:'Game history'});
 expect(within(section).getAllByRole('link')).toHaveLength(10);
 expect(screen.getByText('Game 23')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Page 2'}));
 expect(within(section).getAllByRole('link')).toHaveLength(10);
 expect(screen.getByText('Game 13')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Page 2'}).getAttribute('aria-current')).toBe('page');
 fireEvent.click(screen.getByRole('button',{name:'Page 3'}));
 expect(within(section).getAllByRole('link')).toHaveLength(3);
 expect(screen.getByText('Game 01')).toBeTruthy();
});
it('clamps after deletions and hides controls when only one page remains',()=>{
 const view=render(ui(games));
 fireEvent.click(screen.getByRole('button',{name:'Page 3'}));
 view.rerender(ui(games.slice(0,11)));
 expect(screen.getByRole('button',{name:'Page 2'}).getAttribute('aria-current')).toBe('page');
 expect(screen.getAllByRole('link')).toHaveLength(1);
 view.rerender(ui(games.slice(0,10)));
 expect(screen.queryByRole('navigation',{name:'Game history pages'})).toBeNull();
 expect(screen.getAllByRole('link')).toHaveLength(10);
 view.rerender(ui(games));
 expect(screen.getByRole('button',{name:'Page 1'}).getAttribute('aria-current')).toBe('page');
});
it('bounds page controls for a large history and keeps the empty action available',()=>{
 const many=Array.from({length:1000},(_,i)=>({...games[0],id:String(i)}));
 const view=render(ui(many));
 expect(within(screen.getByRole('navigation')).getAllByRole('button').length).toBeLessThanOrEqual(7);
 view.rerender(ui([]));
 expect(screen.getByRole('button',{name:'Start the first game'})).toBeTruthy();
});

it('shows elapsed playing time on its own line below the Pacific timestamp',()=>{
 const timed={...games[0],started_at:'2026-11-02T20:00:00Z',goals:[{id:'goal',actor_side:'a' as const,rung:'attacker' as const,flags:[],elapsed_ms:75500,occurred_at:'2026-11-02T20:01:15.500Z'}]};
 render(ui([timed]));
 const label=screen.getByText('Game time 1:15');
 expect(label.classList.contains('game-card-duration')).toBe(true);
 expect(label.parentElement?.textContent).toContain('Nov 2, 2026 · 12:00 PM PST');
});
