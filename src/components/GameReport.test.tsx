// @vitest-environment jsdom
import {afterEach, expect, it} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import {Timeline} from './GameReport';
import {defaultLineup} from '../lib/participants';
import type {Game, Goal, Rivalry} from '../lib/types';
afterEach(cleanup);
const rivalry:Rivalry={id:'r',player_a:'Josh and Brooks',player_b:'Andrew',created_at:''};
const before=defaultLineup(rivalry);
const after={...before,a:{defense:'brooks',attack:'josh'}};
const goal=(id:string,lineup:Goal['lineup'],flags:Goal['flags']=[]):Goal=>({id,actor_side:'a',rung:'attacker',flags,lineup,elapsed_ms:Number(id)*1000,occurred_at:''});
const game:Game={id:'g',rivalry_id:'r',revision:1,started_at:'',ended_at:null,lineup:after,goals:[goal('1',before),goal('2',after)]};
it.each([false,true])('shows the saved individual scorer before and after a swap (live feed: %s)',compact=>{
 render(<Timeline game={game} rivalry={rivalry} compact={compact}/>);
 const rows=screen.getAllByRole('listitem');
 const names=rows.map(row=>row.querySelector('.timeline-individual-scorer')?.textContent);
 expect(names).toEqual(compact?['Josh','Brooks']:['Brooks','Josh']);
 for (const row of rows) expect(row.querySelector('.timeline-player strong')?.textContent?.trim()).toBe('Josh and Brooks');
 expect(within(rows[compact?0:1]).getByText('2').className).toContain('timeline-score-changed');
});
it('names the own-goal actor while crediting the opponent',()=>{
 render(<Timeline game={{...game,goals:[goal('1',before,['own_goal'])]}} rivalry={rivalry}/>);
 expect(screen.getByText('Andrew').tagName).toBe('STRONG');
 expect(screen.getByText('Brooks own goal · attacker rung')).toBeTruthy();
 expect(screen.getByText('1').className).toContain('timeline-score-changed');
});
it('keeps historical team goals unassigned even when a current lineup exists',()=>{
 render(<Timeline game={{...game,goals:[goal('1',null)]}} rivalry={rivalry}/>);
 expect(screen.getByText('Josh and Brooks')).toBeTruthy();
 expect(screen.queryByText('Josh')).toBeNull();
 expect(screen.queryByText('Brooks')).toBeNull();
});
