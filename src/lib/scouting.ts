import { goalCredit, goalPlayer, hasDistinctSides, sidePlayers } from './participants';
import { creditedSide, orderedGoals, score } from './stats';
import { otherSide, RUNGS } from './types';
import type { Game, Goal, Rivalry, Side } from './types';

export type ScoutKind = 'chemistry' | 'reaction' | 'habit' | 'story';
export interface ScoutEvidence { game: Game; matchup: string; result: string; detail: string }
export interface ScoutingNote {
  id: string; family: string; kind: ScoutKind; title: string; text: string;
  explanation: string; sample: number; weight: number; evidence: ScoutEvidence[];
}
interface Appearance {
  game: Game; rivalry: Rivalry; side: Side; won: boolean; solo: boolean;
  goals: Goal[]; personal: Goal[]; own: Goal[]; estimated: number;
}
const pct=(n:number,d:number)=>Math.round(100*n/d);
const plural=(n:number,word:string)=>`${n} ${word}${n===1?'':'s'}`;
const wins=(a:Appearance[])=>a.filter(g=>g.won).length;
const record=(a:Appearance[])=>{
  const losses=a.filter(g=>!g.won&&score(g.goals)[g.side]<score(g.goals)[otherSide(g.side)]).length;
  const draws=a.length-wins(a)-losses;
  return `${wins(a)}–${losses}${draws?` (${plural(draws,'draw')})`:''}`;
};
const newest=(a:Appearance,b:Appearance)=>Date.parse(b.game.ended_at!)-Date.parse(a.game.ended_at!)||a.game.id.localeCompare(b.game.id);

/** Facts use active finished games only. No inferred legacy scorer is treated as an individual event. */
export function scoutingCandidates(games:Game[],rivalries:Rivalry[]):Record<string,ScoutingNote[]> {
  const byRivalry=new Map(rivalries.filter(r=>!r.deleted_at&&hasDistinctSides(r)).map(r=>[r.id,r]));
  const histories=new Map<string,Appearance[]>();
  const completed=games.filter(g=>g.ended_at&&!g.deleted_at&&byRivalry.has(g.rivalry_id))
    .sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at)||a.id.localeCompare(b.id));
  const latest=Math.max(0,...completed.map(g=>Date.parse(g.ended_at!)));
  for(const game of completed){
    const rivalry=byRivalry.get(game.rivalry_id)!,goals=orderedGoals(game.goals),final=score(goals);
    for(const side of ['a','b'] as const)for(const member of sidePlayers(rivalry,side)){
      const personal=goals.filter(g=>!g.flags.includes('own_goal')&&goalPlayer(g,rivalry)===member.id);
      const entry:Appearance={game,rivalry,side,goals,personal,
        own:goals.filter(g=>g.flags.includes('own_goal')&&goalPlayer(g,rivalry)===member.id),
        estimated:goals.filter(g=>!g.flags.includes('own_goal')).reduce((n,g)=>n+goalCredit(g,rivalry,member.id),0),
        won:final[side]>final[otherSide(side)],solo:sidePlayers(rivalry,'a').length===1&&sidePlayers(rivalry,'b').length===1};
      histories.set(member.id,[...(histories.get(member.id)??[]),entry]);
    }
  }
  const result:Record<string,ScoutingNote[]>={};
  for(const [id,history] of histories){
    if(!history.some(h=>h.estimated>0))continue;
    const notes:ScoutingNote[]=[],known=history.flatMap(h=>h.personal);
    function add(note:Omit<ScoutingNote,'weight'|'evidence'>,entries:Appearance[],base:number,effect=0){
      const unique=[...new Map(entries.map(a=>[a.game.id,a])).values()].sort(newest);
      const age=Math.max(0,latest-Math.max(...unique.map(a=>Date.parse(a.game.ended_at!))));
      const freshness=4*Math.exp(-age/(14*86400000));
      const evidence=unique.map(a=>{
        const s=score(a.goals);
        return {game:a.game,matchup:`${a.rivalry.player_a} vs ${a.rivalry.player_b}`,result:`${s.a}–${s.b}`,
          detail:`${a.won?'Won':s.a===s.b?'Draw':'Lost'}${sidePlayers(a.rivalry,a.side).length>1?' · Team game':''}`};
      });
      notes.push({...note,evidence,weight:base+Math.min(16,Math.sqrt(note.sample)*4)+Math.min(18,effect)+freshness});
    }
    const partners=new Map<string,{name:string;entries:Appearance[]}>();
    for(const h of history)for(const mate of sidePlayers(h.rivalry,h.side).filter(p=>p.id!==id)){
      const pair=partners.get(mate.id)??{name:mate.name,entries:[]};pair.entries.push(h);partners.set(mate.id,pair);
    }
    for(const [mate,pair] of partners){
      const a=pair.entries,others=history.filter(h=>sidePlayers(h.rivalry,h.side).length>1&&!a.includes(h));
      const rate=wins(a)/a.length,baseline=others.length?wins(others)/others.length:.5;
      if(a.length>=3&&wins(a)>=2&&rate>=.6&&(!others.length||rate-baseline>=.15)){
        add({id:`buddy:${mate}`,family:'buddy',kind:'chemistry',title:`Best bud: ${pair.name}`,
          text:`${record(a)} alongside ${pair.name}${others.length?`, compared with ${record(others)} with other teammates`: ' together so far'}.`,
          explanation:`At least 3 games together and 2 wins. ${wins(a)} wins in ${a.length} games with ${pair.name}.${others.length?` Other teammates: ${wins(others)} wins in ${others.length} games. Opponents and team sizes can differ; this is a pairing record, not proof of a teammate's impact.`:' Still an early partnership; no other pairing to compare yet.'}`,
          sample:a.length},[...a,...others],40,(rate-baseline)*24);
      }
    }
    const rematches=history.filter((h,i)=>{
      const prev=history[i-1];if(!prev)return false;
      const ps=score(prev.goals),gap=Date.parse(h.game.started_at)-Date.parse(prev.game.ended_at!);
      return ps[prev.side]<ps[otherSide(prev.side)]&&h.rivalry.id===prev.rivalry.id&&gap>=0&&gap<1800000;
    });
    if(rematches.length>=3&&wins(rematches)/rematches.length>=.65){
      add({id:'rematch',family:'rematch',kind:'reaction',title:'Run it back',text:`Won ${wins(rematches)} of ${rematches.length} immediate rematches after a loss.`,
        explanation:'Your next appearance must be against the same rivalry, starting within 30 minutes of the previous loss ending. Singles and team results both count.',sample:rematches.length},rematches,43,(wins(rematches)/rematches.length-wins(history)/history.length)*30);
    }
    const solo=history.filter(h=>h.solo);
    const goalieOpen=solo.filter(h=>h.goals[0]?.rung==='goalie'&&!h.goals[0].flags.includes('own_goal')&&h.goals[0].actor_side===h.side);
    if(goalieOpen.length>=3&&wins(goalieOpen)/goalieOpen.length>=.75){
      add({id:'goalie-opener',family:'opener',kind:'habit',title:'Start from the back',text:`${record(goalieOpen)} in singles when your goalie shot opens the scoring.`,
        explanation:`Only 1v1 games where the very first goal was your regular, dunk or bank goal from the goalie rung. ${wins(goalieOpen)} wins in ${goalieOpen.length} games; a pattern so far, not a prediction.`,sample:goalieOpen.length},goalieOpen,39,(wins(goalieOpen)/goalieOpen.length-wins(solo)/solo.length)*24);
    }
    const closers=history.filter(h=>h.won&&h.personal.some(g=>g.id===h.goals.at(-1)?.id));
    for(const rung of RUNGS){
      const all=known.filter(g=>g.rung===rung),end=closers.filter(h=>h.goals.at(-1)?.rung===rung);
      if(closers.length>=6&&end.length>=4&&end.length/closers.length-all.length/known.length>=.15){
        add({id:`closer:${rung}`,family:'closer',kind:'habit',title:'Closing shift',text:`${pct(end.length,closers.length)}% of your winning shots come from ${rung}, versus ${pct(all.length,known.length)}% of your goals overall.`,
          explanation:`${end.length} of ${closers.length} personally scored final goals in wins came from ${rung}, compared with ${all.length} of ${known.length} known personal goals. Own goals and historical team estimates are excluded.`,sample:closers.length},closers,38,(end.length/closers.length-all.length/known.length)*35);
      }
      for(const flag of ['dunk','bank'] as const){
        const special=all.filter(g=>g.flags.includes(flag));
        if(all.length>=5&&special.length>=3&&special.length/all.length>=.5){
          add({id:`style:${rung}:${flag}`,family:'style',kind:'habit',title:flag==='dunk'?'Above the rim':'Bank branch',text:`${special.length} of your ${all.length} ${rung} goals were ${flag==='dunk'?'dunks':'bank shots'}.`,
            explanation:`Known personal goals only. Dunk + bank counts toward each applicable style; own goals and unassigned legacy goals are excluded.${history.length<5?' Early sample; this may change quickly.':''}`,sample:all.length},history.filter(h=>h.personal.some(g=>g.rung===rung)),30,special.length/all.length*16);
        }
      }
    }
    const behind:Goal[]=[],ahead:Goal[]=[];
    for(const h of history){
      const s={a:0,b:0};
      for(const g of h.goals){
        if(h.personal.some(p=>p.id===g.id)){
          if(s[h.side]<s[otherSide(h.side)])behind.push(g);
          else if(s[h.side]>s[otherSide(h.side)])ahead.push(g);
        }
        s[creditedSide(g)]++;
      }
    }
    const banks=(gs:Goal[])=>gs.filter(g=>g.flags.includes('bank')).length;
    if(behind.length>=15&&ahead.length>=15&&banks(behind)>=4&&banks(behind)/behind.length-banks(ahead)/ahead.length>=.1){
      add({id:'trailing-banks',family:'pressure',kind:'habit',title:'Different gear',text:`Bank shots make up ${pct(banks(behind),behind.length)}% of your goals while trailing, versus ${pct(banks(ahead),ahead.length)}% while ahead.`,
        explanation:`Score immediately before each known personal goal. Trailing: ${banks(behind)} banks / ${behind.length} goals. Ahead: ${banks(ahead)} / ${ahead.length}. Tied scores, own goals and unknown personal attribution are excluded.`,sample:behind.length+ahead.length},history.filter(h=>h.personal.length>0),37,15);
    }
    for(const trigger of ['dunk','own_goal'] as const){
      const events:{h:Appearance;reply:boolean}[]=[];
      for(const h of solo)h.goals.forEach((g,i)=>{
        if(!h.goals[i+1])return;
        const matches=trigger==='dunk'?g.actor_side!==h.side&&g.flags.includes('dunk')&&!g.flags.includes('own_goal'):g.actor_side===h.side&&g.flags.includes('own_goal');
        if(matches)events.push({h,reply:creditedSide(h.goals[i+1])===h.side});
      });
      const replies=events.filter(e=>e.reply).length;
      if(events.length>=5&&replies/events.length>=.65){
        add({id:`reply:${trigger}`,family:'reply',kind:'reaction',title:trigger==='dunk'?'Dunk rebuttal':'Damage control',text:`Your side scores next after ${replies} of ${events.length} ${trigger==='dunk'?'opponent dunks':'your own goals'} in singles.`,
          explanation:'Counts the next recorded goal in the same 1v1 game, including points received from an opponent’s own goal. Events at the end of a game have no next-goal opportunity and are excluded.',sample:events.length},events.map(e=>e.h),35,(replies/events.length-.5)*25);
      }
    }
    // A factual outing gives new players something personal without claiming a trend.
    const outing=[...history].filter(h=>h.estimated>0).sort((a,b)=>b.personal.length-a.personal.length||Number(b.won)-Number(a.won)||newest(a,b))[0];
    const n=outing.personal.length,s=score(outing.goals),mate=sidePlayers(outing.rivalry,outing.side).filter(p=>p.id!==id).map(p=>p.name).join(' and ');
    const unknown=n===0,sideScore=s[outing.side],against=s[otherSide(outing.side)];
    const text=unknown?`Your side scored ${sideScore} in a ${sideScore}–${against} game; individual scorers were not recorded.`:
      `${plural(n,'goal')}${outing.own.length?` and ${plural(outing.own.length,'own goal')}`:''} in ${outing.won?'a win':'a game'}${mate?` alongside ${mate}`:''}, ${sideScore}–${against}.`;
    add({id:'outing',family:'outing',kind:'story',title:history.length===1?'First chapter':mate?'Shared spotlight':'Standout outing',text,
      explanation:unknown?'This historical team game has no personal scoring assignments. No estimated goal split is presented as a personal fact.':`Your highest personally attributed goal total in a finished game. ${mate?`Team total: ${sideScore}; your goals: ${n}. `:''}Own goals are reported separately and credited to the opponent.`,sample:1},[outing],12,Math.min(10,n));
    result[id]=notes.sort((a,b)=>b.weight-a.weight||a.id.localeCompare(b.id));
  }
  return result;
}

/** Persist IDs only: numbers, eligibility and evidence always come from the current snapshot. */
export function chooseScoutingNotes(candidates:Record<string,ScoutingNote[]>,previous:Record<string,string>={}):Record<string,ScoutingNote>{
  const selected:Record<string,ScoutingNote>={},used=new Map<string,number>();
  const ids=Object.keys(candidates).sort((a,b)=>(candidates[b][0]?.weight??0)-(candidates[a][0]?.weight??0)||a.localeCompare(b));
  for(const id of ids){
    const options=candidates[id];if(!options.length)continue;
    const adjusted=(n:ScoutingNote)=>n.weight-Math.min(6,(used.get(n.family)??0)*3);
    const best=[...options].sort((a,b)=>adjusted(b)-adjusted(a)||a.id.localeCompare(b.id))[0];
    const prior=options.find(n=>n.id===previous[id]);
    const note=prior&&best.weight<prior.weight+8?prior:best;
    selected[id]=note;used.set(note.family,(used.get(note.family)??0)+1);
  }
  return selected;
}
