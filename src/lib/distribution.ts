import {RUNGS} from './types';
import type {Game,Rung} from './types';
export const GOAL_TYPES=[['regular','Regular'],['dunk','Dunk'],['bank','Bank'],['combo','Dunk + bank'],['own_goal','Own goal']] as const;
export type ShotType=typeof GOAL_TYPES[number][0];
const empty=()=>({rungs:Object.fromEntries(RUNGS.map(r=>[r,0])) as Record<Rung,number>,types:{regular:0,dunk:0,bank:0,combo:0,own_goal:0} as Record<ShotType,number>,scored:0,total:0});
export function playerDistribution(games:Game[]){const out={a:empty(),b:empty()};for(const game of games){if(!game.ended_at)continue;for(const goal of game.goals){const p=out[goal.actor_side];p.total++;const own=goal.flags.includes('own_goal'),dunk=goal.flags.includes('dunk'),bank=goal.flags.includes('bank');const type:ShotType=own?'own_goal':dunk&&bank?'combo':dunk?'dunk':bank?'bank':'regular';p.types[type]++;if(!own){p.scored++;p.rungs[goal.rung]++}}}return out}
