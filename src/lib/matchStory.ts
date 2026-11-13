import { gameHighlights } from './records';
import { creditedSide, matchPointSide, winner } from './stats';
import { goalPlayer, sidePlayers } from './participants';
import { otherSide, RUNGS, type Game, type Player, type Rivalry, type Side } from './types';

export interface TicketFact { id: string; group: string; subject: string; value: string; priority: number }
export interface MatchStory { headline: TicketFact; facts: TicketFact[] }
/** Deterministic, evidence-backed stories; no badge names or generic filler. */
export function matchStory(game: Game, rivalry: Rivalry, games: Game[] = [], players: Player[] = []): MatchStory {
  const h = gameHighlights(game), {goals, scores, moments} = h;
  const registry = new Map(players.map(p=>[p.id,p]));
  const members = (side: Side) => sidePlayers(rivalry,side).map(p=>registry.get(p.id)??p);
  const name = (side: Side) => members(side).map(p=>p.name).join(' and ');
  const win = moments.quickest?.side;
  const candidates: TicketFact[] = [];
  const add = (id: string, group: string, subject: string, value: string, priority: number) => candidates.push({id,group,subject,value,priority});
  const comeback = moments.comeback;
  if (win && comeback?.side && comeback.value >= 3) {
    const s = scores[comeback.start+1], late = s[otherSide(win)] >= 9;
    add('comeback','comeback',name(win),`Recovered from ${s[win]}–${s[otherSide(win)]}`,late?100:85);
  }
  if (win) {
    const saved = goals.filter((goal,i)=>creditedSide(goal)===win && matchPointSide(scores[i])===otherSide(win)).length;
    if (saved>=2) add('saves','matchPoint',name(win),`Saved ${saved} match points`,95);
    else if (h.hadMatchPoint.a && h.hadMatchPoint.b) add('bothPoint','matchPoint','One goal from winning','Both held match point',80);
    const earlier = games.filter(g=>g.id!==game.id && g.rivalry_id===rivalry.id && !g.deleted_at && g.ended_at && Date.parse(g.ended_at)<Date.parse(game.started_at))
      .sort((a,b)=>Date.parse(b.ended_at!)-Date.parse(a.ended_at!) || a.id.localeCompare(b.id));
    let streak=0;
    for (const previous of earlier) { if (winner(previous)!==otherSide(win)) break; streak++; }
    if (streak>=3) add('streakBreak','history',name(win),`Ended a ${streak}-game losing streak`,90);
    if (goals.length>=18 && scores.every(s=>Math.abs(s.a-s.b)<=2)) add('close','close','Never more than 2 goals apart','Close from start to finish',82);
    let closing=0;
    for (const goal of [...goals].reverse()) { if (creditedSide(goal)!==win) break; closing++; }
    if (closing>=5) add('closing','sequence',name(win),`Closed with ${closing} straight goals`,78);
  }
  if (h.leadChanges>=3) add('leadChanges','close','Back and forth',`${h.leadChanges} lead changes`,76);
  if (moments.run?.side && moments.run.value>=5) add('run','sequence',name(moments.run.side),`${moments.run.value} unanswered goals`,72);
  if (moments.burst?.side && moments.burst.value>=3) add('burst','sequence',name(moments.burst.side),`${moments.burst.value} goals in 30 seconds`,70);
  for (const side of ['a','b'] as const) {
    const personal = goals.filter(g=>g.actor_side===side && !g.flags.includes('own_goal'));
    const specials = personal.filter(g=>g.flags.includes('dunk') || g.flags.includes('bank'));
    if (specials.length>=3) add(`specials-${side}`,'specials',name(side),`${specials.length} dunk or bank goals`,60);
    const team = members(side);
    if (team.length===2 && personal.length>=6 && personal.every(g=>goalPlayer(g,rivalry))) {
      const counts = team.map(p=>personal.filter(g=>goalPlayer(g,rivalry)===p.id).length);
      if (counts.every(n=>n>=2)) add(`team-${side}`,'team',`${team[0].name} / ${team[1].name}`,`${counts[0]} + ${counts[1]} goals together`,55);
    }
    const rungs = RUNGS.map(rung=>({rung,count:personal.filter(g=>g.rung===rung).length})).sort((a,b)=>b.count-a.count);
    const top = rungs[0];
    if (top.count>=3 && top.count/personal.length>=.5) add(`rung-${side}`,'rung',name(side),`${top.count} goals from ${top.rung}`,45);
  }
  candidates.sort((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id));
  const w=winner(game);
  const headline = candidates.shift() ?? {id:'result',group:'result',subject:w?name(w):'Final score',value:w?'Takes the win':goals.length?'Finishes level':'No goals recorded',priority:0};
  const used=new Set([headline.group]), facts:TicketFact[]=[];
  for (const fact of candidates) {
    if (used.has(fact.group)) continue;
    used.add(fact.group);facts.push(fact);
    if (facts.length===2) break;
  }
  return {headline,facts};
}
