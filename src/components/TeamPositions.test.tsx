// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {RungControls} from './RungControls';
import {TeamPositions} from './TeamPositions';
import {defaultLineup,goalPlayer} from '../lib/participants';
import type {Game,Rivalry} from '../lib/types';
afterEach(cleanup);
const r:Rivalry={id:'r',player_a:'Josh and Brooks',player_b:'Andrew',created_at:''};
it('swaps only current positions, preserving previous goal snapshots and revision',async()=>{
 const original=defaultLineup(r),onSave=vi.fn().mockResolvedValue(undefined);
 const game:Game={id:'g',rivalry_id:'r',started_at:new Date().toISOString(),ended_at:null,revision:5,lineup:original,goals:[{id:'goal',actor_side:'a',rung:'goalie',lineup:original,flags:[],elapsed_ms:1,occurred_at:''}]};
 render(<TeamPositions game={game} rivalry={r} busy={false} onSave={onSave}/>);
 fireEvent.click(screen.getByRole('button',{name:'Swap black positions'}));
 await waitFor(()=>expect(onSave).toHaveBeenCalledTimes(1));
 const saved=onSave.mock.calls[0][0] as Game;
 expect(saved.lineup?.a).toEqual({defense:'brooks',attack:'josh',swapped_at_ms:expect.any(Number)});expect(saved.revision).toBe(5);
 expect(goalPlayer(saved.goals[0],r)).toBe('josh');
});
it('offers setup for an existing live team game and keeps failures visible',async()=>{
 const onSave=vi.fn().mockRejectedValue(new Error('This game changed.'));
 render(<TeamPositions game={{id:'g',rivalry_id:'r',started_at:new Date().toISOString(),ended_at:null,revision:1,goals:[]}} rivalry={r} busy={false} onSave={onSave}/>);
 fireEvent.click(screen.getByRole('button',{name:'Use these positions'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('changed'));
});

it('labels team rungs with the current assigned player and updates after a swap',()=>{
 const lineup=defaultLineup(r),onGoal=vi.fn();
 const {rerender}=render(<RungControls rivalry={r} lineup={lineup} layout="paired" disabled={false} onGoal={onGoal}/>);
 const goalie=screen.getByRole('button',{name:'Josh and Brooks goalie goal'});
 const attacker=screen.getByRole('button',{name:'Josh and Brooks attacker goal'});
 expect(within(goalie).getByText('Josh')).toBeTruthy();
 expect(within(attacker).getByText('Brooks')).toBeTruthy();
 expect(within(screen.getByRole('button',{name:'Andrew goalie goal'})).queryByText('Andrew')).toBeNull();
 rerender(<RungControls rivalry={r} lineup={{...lineup,a:{defense:'brooks',attack:'josh'}}} layout="paired" disabled={false} onGoal={onGoal}/>);
 expect(within(goalie).getByText('Brooks')).toBeTruthy();
 expect(within(attacker).getByText('Josh')).toBeTruthy();
 fireEvent.click(attacker);
 expect(onGoal).toHaveBeenCalledWith('a','attacker');
});
