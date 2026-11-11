// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {TableScorer} from './TableScorer';
import {defaultLineup} from '../lib/participants';
import type {Game,Rivalry} from '../lib/types';

afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it.each([false,true])('moves teammate names between their actual pads (reduced motion: %s)', reduced=>{
  const originalAnimate=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'animate');
  const originalModal=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal');
  const cancel=vi.fn(),animate=vi.fn(()=>({cancel}));
  Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,value:animate});
  vi.stubGlobal('matchMedia',()=>({matches:reduced}));
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
    const button=this.closest('.rung-button');
    const index=button ? [...button.parentElement!.children].indexOf(button) : 0;
    return {left:index*100,top:0,width:80,height:30,right:index*100+80,bottom:30,x:index*100,y:0,toJSON:()=>({})};
  });
  try {
    const rivalry:Rivalry={id:'r',player_a:'Josh and Brooks',player_b:'Andrew',created_at:''};
    const lineup=defaultLineup(rivalry);
    const game:Game={id:'g',rivalry_id:'r',started_at:new Date().toISOString(),ended_at:null,revision:1,lineup,goals:[]};
    const onGoal=vi.fn();
    const props={rivalry,scores:{a:0,b:0},disabled:false,onGoal,promptPaused:true,busy:false,onSave:vi.fn(),pauseControl:null};
    const {rerender}=render(<TableScorer {...props} game={game}>0:00</TableScorer>);
    fireEvent.click(screen.getByRole('button',{name:'Full screen'}));
    expect(animate).not.toHaveBeenCalled();
    rerender(<TableScorer {...props} game={{...game,lineup:{...lineup,a:{defense:lineup.a.attack,attack:lineup.a.defense}}}}>0:00</TableScorer>);
    if(reduced) expect(animate).not.toHaveBeenCalled();
    else {
      expect(animate).toHaveBeenCalledTimes(4);
      const origins=animate.mock.calls.map(call=>(call as unknown as [Keyframe[]])[0][0].transform);
      expect(origins.filter(x=>x==='translate(200px, 0px)')).toHaveLength(2);
      expect(origins.filter(x=>x==='translate(-200px, 0px)')).toHaveLength(2);
    }
    const pad=within(screen.getByRole('dialog',{name:'Full screen scoring'})).getByRole('button',{name:'Josh and Brooks goalie goal'});
    expect(pad.querySelector('.rung-assignee[aria-hidden="false"]')?.textContent).toBe('Brooks');
    fireEvent.click(pad);
    expect(onGoal).toHaveBeenCalledWith('a','goalie');
    cleanup();
    if(!reduced) expect(cancel).toHaveBeenCalledTimes(4);
  } finally {
    if(originalAnimate) Object.defineProperty(HTMLElement.prototype,'animate',originalAnimate);
    else Reflect.deleteProperty(HTMLElement.prototype,'animate');
    if(originalModal) Object.defineProperty(HTMLDialogElement.prototype,'showModal',originalModal);
    else Reflect.deleteProperty(HTMLDialogElement.prototype,'showModal');
  }
});
