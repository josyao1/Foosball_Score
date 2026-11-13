import { goalPlayer, hasDistinctSides, sidePlayers } from './participants';
import { score } from './stats';
import { otherSide } from './types';
import type { Game, Player, Rivalry } from './types';

export interface ChemistryPair {
  person: Player; played: number; wins: number; losses: number; draws: number;
  ownGoals: number; partnerGoals: number; unattributed: number;
  recent: {game:Game; own:number; against:number; result:'W'|'L'|'D'}[];
}
export interface PlayerChemistry { with:ChemistryPair[]; singles:ChemistryPair[]; teams:ChemistryPair[] }
export function playerChemistry(games:Game[], rivalries:Rivalry[]):Record<string,PlayerChemistry> {
  const rivals=new Map(rivalries.filter(r=>!r.deleted_at&&hasDistinctSides(r)).map(r=>[r.id,r]));
  const people=new Map<string,Record<keyof PlayerChemistry,Map<string,ChemistryPair>>>();
  const completed=games.filter(g=>g.ended_at&&!g.deleted_at).sort((a,b)=>Date.parse(a.ended_at!)-Date.parse(b.ended_at!)||a.id.localeCompare(b.id));
  for(const game of completed){
    const r=rivals.get(game.rivalry_id);if(!r)continue;
    const final=score(game.goals),solo=sidePlayers(r,'a').length===1&&sidePlayers(r,'b').length===1;
    for(const side of ['a','b'] as const)for(const self of sidePlayers(r,side)){
      const buckets=people.get(self.id)??{with:new Map(),singles:new Map(),teams:new Map()};people.set(self.id,buckets);
      const own=final[side],against=final[otherSide(side)],result=own>against?'W':own<against?'L':'D';
      const contacts: {person:Player; group:keyof PlayerChemistry}[]=[
        ...sidePlayers(r,side).filter(p=>p.id!==self.id).map(person=>({person,group:'with' as const})),
        ...sidePlayers(r,otherSide(side)).map(person=>({person,group:solo?'singles' as const:'teams' as const})),
      ];
      for(const {person,group} of contacts){
        const pair=buckets[group].get(person.id)??{person,played:0,wins:0,losses:0,draws:0,ownGoals:0,partnerGoals:0,unattributed:0,recent:[]};
        buckets[group].set(person.id,pair);pair.played++;
        if(result==='W')pair.wins++;else if(result==='L')pair.losses++;else pair.draws++;
        pair.recent.push({game,own,against,result});pair.recent=pair.recent.slice(-5);
        if(group==='with')for(const goal of game.goals){
          if(goal.actor_side!==side||goal.flags.includes('own_goal'))continue;
          const scorer=goalPlayer(goal,r);
          if(scorer===self.id)pair.ownGoals++;
          else if(scorer===person.id)pair.partnerGoals++;
          else pair.unattributed++;
        }
      }
    }
  }
  const sorted=(pairs:Map<string,ChemistryPair>)=>[...pairs.values()].sort((a,b)=>b.played-a.played||b.wins/b.played-a.wins/a.played||a.person.name.localeCompare(b.person.name));
  return Object.fromEntries([...people].map(([id,p])=>[id,{with:sorted(p.with),singles:sorted(p.singles),teams:sorted(p.teams)}]));
}
