// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { RungStats } from './GameRungStats';
import type { Game, Rivalry } from '../lib/types';
const rivalry:Rivalry={id:'r',player_a:'Josh and Brooks',player_b:'Andrew',created_at:'2026-01-01T00:00:00Z'};
const game:Game={id:'g',rivalry_id:'r',started_at:'2026-01-01T00:00:00Z',ended_at:'2026-01-01T00:01:00Z',revision:1,goals:[
 {id:'one',actor_side:'a',rung:'goalie',flags:['dunk','bank'],elapsed_ms:1000,occurred_at:'2026-01-01T00:00:01Z'},
 {id:'two',actor_side:'a',rung:'middle',flags:[],elapsed_ms:2000,occurred_at:'2026-01-01T00:00:02Z'},
 {id:'three',actor_side:'b',rung:'defender',flags:['own_goal'],elapsed_ms:3000,occurred_at:'2026-01-01T00:00:03Z'},
]};
afterEach(cleanup);
it('separates the source rung from goal type and attributes own goals to the player who made them', () => {
 const {container}=render(<RungStats game={game} rivalry={rivalry}/>);
 const goalie=screen.getByRole('group',{name:'Goalie rung'});
 expect(within(goalie).getByLabelText('Josh and Brooks: 1 goal, most-used rung').textContent).toBe('1');
 expect(within(screen.getByRole('group',{name:'Middle rung'})).getByLabelText('Josh and Brooks: 1 goal, most-used rung')).toBeTruthy();
 expect(within(screen.getByRole('group',{name:'Defender rung'})).getByLabelText('Andrew: 0 goals').textContent).toBe('0');
 expect(container.querySelectorAll('.top-rung-a')).toHaveLength(2);
 expect(container.querySelectorAll('.top-rung-b')).toHaveLength(0);
 for(const label of ['Dunks','Bank shots']) {
  const group=screen.getByRole('region',{name:label});
  expect(group.querySelector('dl>div:first-child')?.textContent).toBe('Josh and Brooks1');
  expect(group.querySelector('dl>div:last-child')?.textContent).toBe('Andrew0');
 }
 expect(screen.getByRole('region',{name:'Own goals made'}).querySelector('dl>div:last-child')?.textContent).toBe('Andrew1');
 expect(screen.getByText('Dunk + bank goals count in both types.')).toBeTruthy();
});
it('uses the 3–2–5–3 rod layout and does not mark empty rungs as most used', () => {
 const {container}=render(<RungStats game={{...game,goals:[]}} rivalry={rivalry}/>);
 expect([...container.querySelectorAll('.rung-table-row')].map(row=>row.querySelectorAll('.stats-rod-figure').length)).toEqual([3,2,5,3]);
 expect(container.querySelectorAll('.top-rung-a,.top-rung-b')).toHaveLength(0);
 expect(container.querySelectorAll('.rung-table-count.is-zero')).toHaveLength(8);
 expect(screen.queryByText('Dunk + bank goals count in both types.')).toBeNull();
});
