import { expect,it } from 'vitest';
import { playerDistribution } from './distribution';
import type { Game, Goal } from './types';
const g=(id:string,flags:Goal['flags']=[],rung:Goal['rung']='attacker',side:Goal['actor_side']='a'):Goal=>({id,flags,rung,actor_side:side,elapsed_ms:1000,occurred_at:'2026-10-26T00:00:01Z'});
const game=(goals:Goal[],ended=true):Game=>({id:'game',rivalry_id:'r',revision:1,started_at:'2026-10-26T00:00:00Z',ended_at:ended?'2026-10-26T00:01:00Z':null,goals});
it('aggregates each player across finished games and keeps types mutually exclusive',()=>{const d=playerDistribution([game([g('1'),g('2',['bank']),g('3',['dunk','bank']),g('4',['own_goal'],'goalie'),g('5',['dunk'],'middle','b')]),game([g('6',['dunk'])],false)]);expect(d.a.rungs.attacker).toBe(3);expect(d.a.rungs.goalie).toBe(0);expect(d.a.scored).toBe(3);expect(d.a.total).toBe(4);expect(d.a.types).toEqual({regular:1,dunk:0,bank:1,combo:1,own_goal:1});expect(d.b.types.dunk).toBe(1);expect(d.b.rungs.middle).toBe(1)});
it('has zero counts for an empty rivalry',()=>{const d=playerDistribution([]);expect(d.a.total).toBe(0);expect(d.b.scored).toBe(0)});

import { completedGamesInPeriod, goalShare } from './distribution';
it('filters completed games by a rolling inclusive cutoff, excluding live and future games',()=>{
 const now=Date.parse('2026-11-02T08:30:00Z'); // Pacific DST just ended.
 const finished=(id:string,age:number):Game=>({...game([]),id,ended_at:new Date(now-age).toISOString()});
 const day=86_400_000;
 const games=[finished('now',0),finished('boundary',day),finished('older',day+1),finished('week',7*day),finished('month',30*day),finished('old',31*day),finished('future',-1),game([],false)];
 expect(completedGamesInPeriod(games,'1d',now).map(g=>g.id)).toEqual(['now','boundary']);
 expect(completedGamesInPeriod(games,'7d',now).map(g=>g.id)).toEqual(['now','boundary','older','week']);
 expect(completedGamesInPeriod(games,'1m',now).map(g=>g.id)).toEqual(['now','boundary','older','week','month']);
 expect(completedGamesInPeriod(games,'all',now)).toHaveLength(6);
});
it('uses completion time for games crossing the cutoff and returns safe empty shares',()=>{
 const now=Date.parse('2026-10-28T12:00:00Z');
 const crossing={...game([]),started_at:'2026-10-27T11:59:00Z',ended_at:'2026-10-27T12:01:00Z'};
 expect(completedGamesInPeriod([crossing],'1d',now)).toEqual([crossing]);
 expect(goalShare(0,0)).toBe(0);
 expect(goalShare(1,3)).toBe(33);
 expect(goalShare(2,2)).toBe(100);
});
