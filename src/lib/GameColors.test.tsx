// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GameColors, useLocalGameColors } from './GameColors';
import { LiveScoringLayout } from '../components/LiveScoringLayout';
import { TableScorer } from '../components/TableScorer';
import type { Game, Rivalry } from './types';
const r:Rivalry={id:'r',player_a:'Josh',player_b:'Brooks',created_at:''};
const onGoal=vi.fn();
function Scoring({id='g'}:{id?:string}) {
 const [flipped,toggle]=useLocalGameColors(id);
 return <GameColors.Provider value={flipped}>
   <button onClick={toggle}>Flip colors</button>
   <LiveScoringLayout rivalry={r} scores={{a:3,b:1}} disabled={false} onGoal={onGoal} near="a"/>
 </GameColors.Provider>;
}
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();onGoal.mockClear();});
it('keeps side attribution and score unchanged, persists on reload and isolates other games',()=>{
 const view=render(<Scoring/>);
 const pad=screen.getByRole('button',{name:'Josh goalie goal'});
 expect(pad.className).toContain('side-a');
 fireEvent.click(screen.getByRole('button',{name:'Flip colors'}));
 expect(pad.className).toContain('side-b');fireEvent.click(pad);
 expect(onGoal).toHaveBeenCalledWith('a','goalie');
 expect(screen.getByLabelText('Current score: Josh 3; Brooks 1')).toBeTruthy();
 view.unmount();const next=render(<Scoring/>);
 expect(screen.getByRole('button',{name:'Josh goalie goal'}).className).toContain('side-b');
 next.rerender(<Scoring id="rematch"/>);
 expect(screen.getByRole('button',{name:'Josh goalie goal'}).className).toContain('side-a');
 next.rerender(<Scoring/>);
 expect(screen.getByRole('button',{name:'Josh goalie goal'}).className).toContain('side-b');
});
it('still flips when device storage is blocked',()=>{
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
 render(<Scoring/>);fireEvent.click(screen.getByRole('button',{name:'Flip colors'}));
 expect(screen.getByRole('button',{name:'Josh goalie goal'}).className).toContain('side-b');
});
it('uses the same color mapping in fullscreen without changing the scoring side',()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
 const game:Game={id:'g',rivalry_id:'r',started_at:new Date().toISOString(),ended_at:null,revision:1,goals:[]};
 render(<GameColors.Provider value={true}><TableScorer game={game} rivalry={r} scores={{a:3,b:1}} disabled={false} onGoal={onGoal} promptPaused busy={false} onSave={vi.fn()} pauseControl={null}>0:30</TableScorer></GameColors.Provider>);
 fireEvent.click(screen.getByRole('button',{name:'Full screen'}));
 const modal=within(screen.getByRole('dialog',{name:'Full screen scoring'}));
 const pad=modal.getByRole('button',{name:'Josh attacker goal'});
 expect(pad.className).toContain('side-b');fireEvent.click(pad);
 expect(onGoal).toHaveBeenCalledWith('a','attacker');
 expect(modal.getByText('White · Josh')).toBeTruthy();
});
