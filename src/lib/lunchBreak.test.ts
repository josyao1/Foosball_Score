import {expect,it} from 'vitest';
import {lunchBreakPlayers} from './achievements';
import {playerPassports} from './players';
import type {Game,Rivalry,Side} from './types';
const r:Rivalry={id:'r',player_a:'Josh',player_b:'Andrew',created_at:''};
const team:Rivalry={id:'team',player_a:'Josh and Brooks',player_b:'Andrew',created_at:''};
const stamp=(min:number)=>new Date(Date.UTC(2026,10,4,12,min)).toISOString();
function game(id:string,start:number,end:number,side:Side='a',rid='r'):Game{return {id,rivalry_id:rid,started_at:stamp(start),ended_at:stamp(end),revision:1,goals:Array.from({length:10},(_,i)=>({id:`${id}-${i}`,actor_side:side,rung:'attacker',flags:[],elapsed_ms:i*1000,occurred_at:stamp(start)}))};}
it('earns on the fourth win at exactly thirty minutes, not one millisecond later',()=>{
 const games=[game('one',0,5),game('two',6,10),game('three',11,15),game('four',20,30)];
 expect(lunchBreakPlayers(games.slice(0,3),[r]).size).toBe(0);
 expect([...lunchBreakPlayers([...games].reverse(),[r]).keys()]).toEqual(['four']);
 expect(playerPassports(games,[r]).find(p=>p.key==='josh')?.achievements.lunchBreak?.id).toBe('four');
 games[3].ended_at=new Date(Date.parse(stamp(30))+1).toISOString();
 expect(lunchBreakPlayers(games,[r]).size).toBe(0);
});
it('allows intervening losses and only awards teammates who personally have four wins',()=>{
 const games=[game('one',0,5),game('loss',6,9,'b'),game('two',10,15),game('three',16,19),game('four',20,25,'a','team')];
 expect(lunchBreakPlayers(games,[r,team]).get('four')).toEqual([{id:'josh',side:'a',name:'Josh'}]);
 const people=playerPassports(games,[r,team]);
 expect(people.find(p=>p.key==='brooks')?.achievements.lunchBreak).toBeUndefined();
});
it('requires four finished wins and counts game duration in the window',()=>{
 const games=[game('one',-10,5),game('two',6,10),game('three',11,15),game('four',20,25)];
 expect(lunchBreakPlayers(games,[r]).size).toBe(0);
 games[0]=game('one',0,5);games[3].ended_at=null;
 expect(lunchBreakPlayers(games,[r]).size).toBe(0);
});
