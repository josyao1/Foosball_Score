import {expect,it} from 'vitest';
import {earnedAchievements} from './achievements';
import {defaultLineup} from './participants';
import {playerPassports} from './players';
import type {Game,Rivalry} from './types';
const r:Rivalry={id:'r',player_a:'Josh and Brooks',player_b:'Andrew',created_at:''};
const lineup=defaultLineup(r);
function game():Game{return {id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-04T18:00:00Z',ended_at:'2026-11-04T18:06:00Z',lineup,goals:Array.from({length:10},(_,i)=>({id:String(i),actor_side:'a',rung:i<5?'goalie':'attacker',lineup,flags:[],elapsed_ms:(i+1)*30000,occurred_at:''}))};}
const earned=(g:Game)=>earnedAchievements(g,'a',undefined,r);
it('requires a valid team win with four real goals from each teammate, ignoring legacy splits and own goals',()=>{
 const g=game();expect(earned(g)).toContain('groupProject');
 expect(playerPassports([g],[r]).filter(p=>p.achievements.groupProject).map(p=>p.name)).toEqual(['Brooks','Josh']);
 g.goals.forEach(goal=>{goal.lineup=null;});expect(earned(g)).not.toContain('groupProject');
 const unbalanced=game();unbalanced.goals.forEach((goal,i)=>{goal.rung=i<3?'goalie':'attacker';});expect(earned(unbalanced)).not.toContain('groupProject');
 expect(earned({...game(),ended_at:null})).toEqual([]);
 const own=game();own.goals[0].flags=['own_goal'];own.goals[1].flags=['own_goal'];expect(earned(own)).not.toContain('groupProject');
});
it.each([[66999,false],[67000,true],[67999,true],[68000,false],[259999,false],[260000,true],[260999,true],[261000,false]])('checks the full displayed second at %s', (ms,yes)=>{
 const g=game();g.goals[0].elapsed_ms=ms;
 const badge=ms<100000?'sixtySeven':'fourTwenty';
 expect(earned(g).includes(badge)).toBe(yes);
 g.goals[0].flags=['own_goal'];expect(earned(g)).not.toContain(badge);
});
it('uses the goal swap snapshot, rejects missing/future times, and includes exactly ten seconds',()=>{
 const g=game();expect(earned(g)).not.toContain('seatWarmer');
 g.goals[0].lineup={...lineup,a:{...lineup.a,swapped_at_ms:20000}};
 expect(earned(g)).toContain('seatWarmer');
 g.goals[0].elapsed_ms=30001;expect(earned(g)).not.toContain('seatWarmer');
 g.goals[0].elapsed_ms=19999;expect(earned(g)).not.toContain('seatWarmer');
 g.goals[0].elapsed_ms=30000;g.goals[0].flags=['own_goal'];expect(earned(g)).not.toContain('seatWarmer');
});

it('awards Ethical game to the winners only if both sides used only regular goals', () => {
  const g = game();
  g.goals.unshift({...g.goals[0], id:'opener', actor_side:'b', elapsed_ms:10});
  expect(earned(g)).toContain('ethical');
  expect(earnedAchievements(g,'b')).not.toContain('ethical');
  expect(earned({...g,ended_at:null})).not.toContain('ethical');
  for (const flag of ['bank','dunk','own_goal'] as const) {
    g.goals[0].flags = [flag];
    expect(earned(g)).not.toContain('ethical');
  }
});

it('credits Hard carry only to the teammate personally responsible for every winning-side point', () => {
  const g = game();
  const earners = () => playerPassports([g],[r]).filter(p=>p.achievements.hardCarry).map(p=>p.name);
  const swapped = {...lineup,a:{defense:lineup.a.attack,attack:lineup.a.defense}};
  g.goals.slice(5).forEach(goal=>{goal.lineup=swapped;});
  expect(earners()).toEqual(['Josh']);
  g.goals[9].lineup=lineup;
  expect(earners()).toEqual([]);
  g.goals[9].lineup=null;
  expect(earners()).toEqual([]);
  g.goals[9].actor_side='b';g.goals[9].flags=['own_goal'];
  expect(earners()).toEqual([]);
});

it('uses a two-minute team scoring drought through the last goal of a regulation win', () => {
  const g = game();
  expect(earned(g)).not.toContain('droughtQuencher'); // Teammates alternate duties with no team drought.
  g.goals.slice(5).forEach(goal => {goal.elapsed_ms += 89_999;});
  expect(earned(g)).not.toContain('droughtQuencher');
  g.goals.slice(5).forEach(goal => {goal.elapsed_ms += 1;});
  expect(playerPassports([g],[r]).filter(p=>p.achievements.droughtQuencher).map(p=>p.name).sort()).toEqual(['Brooks','Josh']);
  expect(earned({...g,ended_at:null})).not.toContain('droughtQuencher');
  g.goals[5].actor_side = 'b';
  g.goals[5].flags = ['own_goal'];
  g.goals[5].elapsed_ms -= 1;
  expect(earned(g)).not.toContain('droughtQuencher');
});
