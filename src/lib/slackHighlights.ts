import { gameHighlights } from './records';
import { rankedClassics } from './hallOfFame';
import { scorigamiRecords, type OddityId } from './scorigamiDiscoveries';
import { creditedSide, matchPointSide, score, winner } from './stats';
import { hasDistinctSides, sidePlayers } from './participants';
import { otherSide, RUNGS, type Game, type Rivalry, type Side } from './types';

export interface SlackStory { id:string; group:string; priority:number; strength:number; text:string }
export const slackText=(value:string)=>value.replace(/[\n\r\t]+/g,' ').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const earlier=(a:Game,b:Game)=>Date.parse(a.ended_at!)-Date.parse(b.ended_at!)||a.id.localeCompare(b.id);
const standard=(game:Game)=>!game.deleted_at&&!!game.ended_at&&!!gameHighlights(game).moments.quickest;
const scoreKey=(game:Game)=>Object.values(score(game.goals)).sort((a,b)=>b-a).join('–');
const rungLabel={goalie:'goalie',defender:'defense',middle:'midfield',attacker:'attack'};

/** Fixed editorial priority, then strongest evidence within the same category. */
export function slackStoryCandidates(game:Game,rivalry:Rivalry,games:Game[]):SlackStory[] {
 if(!standard(game)||!hasDistinctSides(rivalry))return [];
 const h=gameHighlights(game), win=h.moments.quickest!.side as Side, final=h.scores.at(-1)!;
 const name=(side:Side)=>slackText(sidePlayers(rivalry,side).map(p=>p.name).join(' & '));
 const prior=games.filter(g=>g.id!==game.id&&!g.deleted_at&&g.ended_at&&earlier(g,game)<0);
 const stories:SlackStory[]=[];
 const add=(id:string,group:string,priority:number,strength:number,text:string)=>stories.push({id,group,priority,strength,text});
 if(!prior.some(g=>standard(g)&&scoreKey(g)===scoreKey(game)))add('scorigami','scorigami',1,0,`First-ever ${scoreKey(game)} finish at the table.`);
 // Use the hardest deficit while facing match point, even if the largest deficit was earlier.
 const late=h.scores.filter(s=>matchPointSide(s)===otherSide(win)&&s[otherSide(win)]-s[win]>=3)
  .sort((a,b)=>(b[otherSide(win)]-b[win])-(a[otherSide(win)]-a[win])||b[otherSide(win)]-a[otherSide(win)])[0];
 if(late)add('lateComeback','comeback',2,late[otherSide(win)]-late[win],`${name(win)} came back from ${late[win]}–${late[otherSide(win)]} to win.`);
 const saved=h.goals.filter((goal,i)=>creditedSide(goal)===win&&matchPointSide(h.scores[i])===otherSide(win)).length;
 if(saved>=3)add('saves','matchPoints',3,saved,`${name(win)} saved ${saved} match points.`);
 const comeback=h.moments.comeback;
 if(comeback&&comeback.value>=5)add('hugeComeback','comeback',4,comeback.value,`${name(win)} overturned a ${comeback.value}-goal deficit.`);
 const rivalryHistory=prior.filter(g=>g.rivalry_id===rivalry.id).sort((a,b)=>earlier(b,a));
 const priorLosses=rivalryHistory.filter(g=>winner(g)===otherSide(win)).length;
 if(priorLosses>=3&&!rivalryHistory.some(g=>winner(g)===win))add('firstWin','history',5,priorLosses,`${name(win)} beats ${name(otherSide(win))} for the first time, after ${priorLosses} losses.`);
 let streak=0;
 for(const previous of rivalryHistory){if(winner(previous)!==otherSide(win))break;streak++;}
 if(streak>=5)add('longStreakBreak','history',6,streak,`${name(win)} ends a ${streak}-game losing streak against ${name(otherSide(win))}.`);
 if(h.hadMatchPoint.a&&h.hadMatchPoint.b)add('bothMatchPoint','matchPoints',7,0,'Both sides were one goal from winning.');
 if(comeback&&comeback.value>=3&&comeback.value<=4){
  const s=h.scores[comeback.start+1];
  add('comeback','comeback',8,comeback.value,`${name(win)} recovered from ${s[win]}–${s[otherSide(win)]} to win.`);
 }
 if(h.leadChanges>=4)add('leadChanges','leadChanges',9,h.leadChanges,`The lead changed hands ${h.leadChanges} times.`);
 const run=h.moments.run;
 if(run?.side&&run.value>=7)add('run','run',10,run.value,`${name(run.side)} scored ${run.value} unanswered goals.`);
 let closing=0;
 for(const goal of [...h.goals].reverse()){if(creditedSide(goal)!==win)break;closing++;}
 if(closing>=5)add('closing','run',11,closing,`${name(win)} scored the final ${closing} goals to take it.`);
 if(streak>=3&&streak<=4)add('streakBreak','history',12,streak,`${name(win)} ends a ${streak}-game losing streak against ${name(otherSide(win))}.`);
 for(const side of ['a','b'] as const){
  const goals=h.goals.filter(g=>g.actor_side===side&&!g.flags.includes('own_goal'));
  for(const rung of RUNGS){
   const count=goals.filter(g=>g.rung===rung).length;
   if(count>=5&&count/final[side]>=.6)add('rung','rung',13,count+count/final[side],`${name(side)} scored ${count} of ${final[side]} goals from ${rungLabel[rung]}.`);
  }
  for(const flag of ['bank','dunk'] as const){
   const count=goals.filter(g=>g.flags.includes(flag)).length;
   if(count>=3)add('specials',flag==='bank'?'banks':'dunks',14,count+count/final[side],`${name(side)} landed ${count} ${flag}s.`);
  }
 }
 return stories.sort((a,b)=>a.priority-b.priority||b.strength-a.strength||a.text.localeCompare(b.text));
}

const recordPriority:OddityId[]=['matchPoints','comeback','leadChanges','run','banks','dunks','rung','specials','triple','ownGoals'];
const recordText=(id:OddityId,n:number)=>({
 matchPoints:`${n} match points saved.`,comeback:`a ${n}-goal winning comeback.`,leadChanges:`${n} lead changes.`,
 run:`${n} unanswered goals.`,banks:`${n} banks.`,dunks:`${n} dunks.`,rung:`${n} goals from one rung.`,
 specials:`${n} special goals.`,triple:`three goals in ${Number((n/1000).toFixed(1))} seconds.`,ownGoals:`${n} own goals.`,
})[id];

/** One story plus, at most, one distinct record or current top-10 rank. */
export function slackHighlights(game:Game,rivalry:Rivalry,games:Game[],rivalries:Rivalry[]):string[] {
 if(!standard(game)||rivalry.deleted_at||!hasDistinctSides(rivalry))return [];
 const activeRivalries=rivalries.filter(r=>!r.deleted_at&&hasDistinctSides(r));
 const rivalryIds=new Set(activeRivalries.map(r=>r.id));
 const others=games.filter(g=>g.id!==game.id&&!g.deleted_at&&g.ended_at&&rivalryIds.has(g.rivalry_id));
 const primary=slackStoryCandidates(game,rivalry,others)[0];
 const lines=primary?[primary.text]:[];
 const validOthers=others.filter(standard);
 const oldRecords=scorigamiRecords(validOthers),currentRecords=scorigamiRecords([game]);
 const record=validOthers.length?recordPriority.find(id=>{
  // A combined special total also repeats a banks/dunks headline for this game.
  if(primary&&(primary.group===id||(id==='specials'&&['banks','dunks'].includes(primary.group))))return false;
  const before=oldRecords.find(r=>r.id===id)!,now=currentRecords.find(r=>r.id===id)!;
  return now.matches.length>0&&(id==='triple'?before.matches.length>0&&now.value<before.value:now.value>before.value);
 }):undefined;
 if(record){
  lines.push(`New table record: ${recordText(record,currentRecords.find(r=>r.id===record)!.value)}`);
 }else{
  const rank=rankedClassics([...others,game],activeRivalries).findIndex(entry=>entry.game.id===game.id)+1;
  if(rank>=1&&rank<=10)lines.push(`🏆 Enters the Hall of Fame at #${rank}.`);
 }
 return lines;
}
