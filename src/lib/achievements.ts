import { gameHighlights } from './records';
import { creditedSide, isWinningScore, score } from './stats';
import { otherSide } from './types';
import type { Game, Rivalry, Rung, Side } from './types';

export const ACHIEVEMENTS = [
  {id:'escape',name:'Escape artist',requirement:'Save at least 3 match points in one game, then win.',color:'#417e76'},
  {id:'dunk',name:'Mic drop',requirement:'Score the winning goal with a dunk.',color:'#aa7425'},
  {id:'bank',name:'Bank closed',requirement:'Score the winning goal with a bank shot.',color:'#397e6c'},
  {id:'gift',name:'Gift wrapped',requirement:'Win from an opponent’s own goal.',color:'#a45e70'},
  {id:'rungRun',name:'One-track mind',requirement:'Score 5 unanswered goals from the same rung, without a different rung in between.',color:'#8c6545'},
  {id:'perfect',name:'Perfect paper',requirement:'Win 10–0.',color:'#678047'},
  {id:'extra',name:'Extra credit',requirement:'Win with a score of 14 or higher.',color:'#9a7934'},
  {id:'comeback',name:'Plot twist',requirement:'Win after trailing by 6 or more goals.',color:'#8b679d'},
  {id:'goalie',name:'From downtown',requirement:'Score the winning goal from the goalie rung.',color:'#557d99'},
  {id:'speed',name:'Speedrun',requirement:'Complete a valid win in under 4 minutes, measured through the final goal.',color:'#ba7049'},
  {id:'reply',name:'Instant reply',requirement:'Score within 3 seconds of conceding.',color:'#9b8250'},
  {id:'own',name:'Technical difficulties',requirement:'Make 3 own goals in one game.',color:'#99717a'},
  {id:'doubleAgent',name:'Double agent',requirement:'Make at least 2 own goals in one game, then win.',color:'#706987'},
  {id:'trading',name:'Trading blows',requirement:'The first 10 goals alternate between players.',color:'#a26b50'},
  {id:'closing',name:'Closing time',requirement:'Win by personally scoring the final 5 goals unanswered.',color:'#657e91'},
  {id:'neverDoubt',name:'Never in doubt',requirement:'Win without ever trailing or being tied after the opening goal.',color:'#698351'},
  {id:'breaker',name:'Streak breaker',requirement:'Score to end an opponent’s run of 4 or more goals, then win.',color:'#a26968'},
  {id:'around',name:'Around the table',requirement:'Score 4 unanswered goals in a row, one from each of the four rungs.',color:'#3f827b'},
  {id:'fullHouse',name:'Full house',requirement:'Record a dunk, a bank, a dunk + bank, and an own goal yourself in one game. Each must be a separate goal.',color:'#91678d'},
  {id:'streak',name:'On a roll',requirement:'Win 5 games in a row across rivalries. A loss or draw resets the streak.',color:'#ac7341'},
  {id:'tightrope',name:'Walking the tightrope',requirement:'Win without the score ever being more than 2 goals apart.',color:'#507d8e'},
  {id:'marathon',name:'Marathon',requirement:'Win a game lasting at least 10 minutes, measured through the final goal.',color:'#84704c'},
  {id:'circus',name:'Circus',requirement:'Record 3 special goals in a row.',color:'#98649c'},
] as const;
export type AchievementId=typeof ACHIEVEMENTS[number]['id'];
export type AchievementHistory=Partial<Record<AchievementId,Game[]>>;
export type PlayerAchievements=Partial<Record<AchievementId,Game>>;

export function earnedAchievements(game:Game,side:Side,h=gameHighlights(game)):AchievementId[] {
  if (!game.ended_at) return [];
  const earned=new Set<AchievementId>();
  const opponent=otherSide(side);
  const validWin=h.moments.quickest?.side===side;
  let saved=0,own=0,run=0,lastRung:Rung|null=null;
  let opponentRun=0,brokeRun=false,specialRun=0;
  let recentRungs:Rung[]=[];
  const specialTypes=new Set<string>();
  h.goals.forEach((goal,i)=>{
    const scored=creditedSide(goal)===side;
    const ownGoal=goal.flags.includes('own_goal');
    if(scored){
      specialRun=goal.flags.some(flag=>['dunk','bank','own_goal'].includes(flag)) ? specialRun+1 : 0;
      if(specialRun>=3)earned.add('circus');
    }
    if(goal.actor_side===side){
      if(ownGoal)specialTypes.add('own');
      else if(goal.flags.includes('dunk') && goal.flags.includes('bank'))specialTypes.add('combo');
      else if(goal.flags.includes('dunk'))specialTypes.add('dunk');
      else if(goal.flags.includes('bank'))specialTypes.add('bank');
    }
    const before=h.scores[i];
    if (scored && !isWinningScore(before) && isWinningScore({...before,[opponent]:before[opponent]+1})) saved++;
    if (goal.actor_side===side && ownGoal) own++;
    if (goal.actor_side===side && !ownGoal) {
      if (opponentRun>=4) brokeRun=true;
      recentRungs=[...recentRungs,goal.rung].slice(-4);
      if (new Set(recentRungs).size===4) earned.add('around');
      run=goal.rung===lastRung ? run+1 : 1;
      lastRung=goal.rung;
      if (run>=5) earned.add('rungRun');
      if (i>0 && creditedSide(h.goals[i-1])===opponent && goal.elapsed_ms-h.goals[i-1].elapsed_ms<=3000) earned.add('reply');
    } else { run=0;lastRung=null;recentRungs=[]; }
    opponentRun=scored ? 0 : opponentRun+1;
  });
  if (own>=3) earned.add('own');
  if (specialTypes.size===4) earned.add('fullHouse');
  if (h.goals.length>=10 && h.goals.slice(1,10).every((goal,i)=>creditedSide(goal)!==creditedSide(h.goals[i]))) earned.add('trading');
  if (validWin) {
    const last=h.goals.at(-1)!;
    const final=h.scores.at(-1)!;
    if (saved>=3) earned.add('escape');
    if (last.flags.includes('own_goal')) earned.add('gift');
    else {
      if (last.flags.includes('dunk')) earned.add('dunk');
      if (last.flags.includes('bank')) earned.add('bank');
      if (last.rung==='goalie') earned.add('goalie');
    }
    if (final[side]===10 && final[opponent]===0) earned.add('perfect');
    if (final[side]>=14) earned.add('extra');
    if (h.largestDeficit[side]>=6) earned.add('comeback');
    if (h.totalMs<240000) earned.add('speed');
    if (h.totalMs>=600000) earned.add('marathon');
    if (own>=2) earned.add('doubleAgent');
    if (brokeRun) earned.add('breaker');
    if (h.goals.length>=5 && h.goals.slice(-5).every(g=>g.actor_side===side && !g.flags.includes('own_goal'))) earned.add('closing');
    if (h.scores.slice(1).every(s=>s[side]>s[opponent])) earned.add('neverDoubt');
    if (h.scores.every(s=>Math.abs(s.a-s.b)<=2)) earned.add('tightrope');
  }
  return [...earned];
}

/** Mark the fifth win of each streak using the same participant identities as passports. */
export function streakAchievementGames(games:Game[],rivalries:Rivalry[]):ReadonlyMap<string,Side[]> {
  const byId=new Map(rivalries.map(r=>[r.id,r]));
  const streaks=new Map<string,number>();
  const earned=new Map<string,Side[]>();
  const key=(name:string)=>name.trim().toLowerCase();
  const completed=games.filter(g=>g.ended_at).sort((a,b)=>Date.parse(a.ended_at!)-Date.parse(b.ended_at!) || a.id.localeCompare(b.id));
  for(const game of completed){
    const r=byId.get(game.rivalry_id);
    if(!r || !key(r.player_a) || !key(r.player_b) || key(r.player_a)===key(r.player_b))continue;
    const final=score(game.goals);
    for(const side of ['a','b'] as const){
      const identity=key(side==='a' ? r.player_a : r.player_b);
      const count=final[side]>final[otherSide(side)] ? (streaks.get(identity) ?? 0)+1 : 0;
      streaks.set(identity,count);
      if(count===5)earned.set(game.id,[...(earned.get(game.id) ?? []),side]);
    }
  }
  return earned;
}
