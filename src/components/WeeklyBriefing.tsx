import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Swords, Timer, Trophy } from 'lucide-react';
import { PlayerJersey } from './PlayerJersey';
import { sidePlayers } from '../lib/participants';
import { isProfileRivalry } from '../lib/profile';
import { clock, playingTime, score } from '../lib/stats';
import { gameDate } from '../lib/time';
import { personalMatchup } from '../lib/weeklyFeature';
import type { useWeeklyFeature } from '../lib/useWeeklyFeature';
import type { Rivalry } from '../lib/types';
import './weekly-briefing.css';

type Feature = ReturnType<typeof useWeeklyFeature>;
function BriefingTeams({rivalry,result}:{rivalry:Rivalry;result?:{a:number;b:number}}) {
  return <div className={`briefing-teams${result ? ' has-result' : ''}`}>
    {(['a','b'] as const).map(side => <div className={`briefing-team briefing-team-${side}`} key={side}>
      <span className="briefing-jerseys">{sidePlayers(rivalry,side).map(player => <PlayerJersey key={player.id} name={player.name} decorative/>)}</span>
      <strong>{side === 'a' ? rivalry.player_a : rivalry.player_b}</strong>
      {result && <b>{result[side]}</b>}
    </div>)}
    <span className="briefing-versus" aria-hidden="true">{result ? '–' : 'vs'}</span>
  </div>;
}

export function WeeklyBriefing({feature,profile,rank}:{feature:Feature;profile:string|null;rank?:number}) {
  const id=useId(), tabs=useRef<(HTMLButtonElement|null)[]>([]);
  const track=useRef<HTMLDivElement>(null), settled=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [chosen,setChosen]=useState<number|null>(null);
  const automatic=feature.week.isFeatureDay || !feature.best ? 1 : 0;
  const active=chosen ?? automatic, activeRef=useRef(active);
  useLayoutEffect(()=>{activeRef.current=active;},[active]);
  function scrollToCard(index:number,animate=false) {
    const row=track.current;if(!row)return;
    const left=row.clientWidth*index;
    const behavior=animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'smooth':'instant';
    if(row.scrollTo)row.scrollTo({left,behavior});else row.scrollLeft=left;
  }
  const automaticSelection=chosen===null;
  useLayoutEffect(()=>{if(automaticSelection)scrollToCard(automatic);},[automatic,automaticSelection]);
  useLayoutEffect(()=>{
    const row=track.current;
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>scrollToCard(activeRef.current));
    if(row)observer?.observe(row);
    return ()=>{observer?.disconnect();if(settled.current!==null)clearTimeout(settled.current);};
  },[]);
  const pick=personalMatchup(feature.candidates,profile), best=feature.best;
  const personalized=pick && isProfileRivalry(pick.rivalry,profile?.trim().toLowerCase() || null);
  function select(index:number,focus=false) {
    if(settled.current!==null)clearTimeout(settled.current);
    setChosen(index);scrollToCard(index,true);if(focus)tabs.current[index]?.focus();
  }
  function followSwipe() {
    if(settled.current!==null)clearTimeout(settled.current);
    // Wait for momentum/smooth scrolling to settle instead of fighting each frame.
    settled.current=setTimeout(()=>{
      const row=track.current;if(!row?.clientWidth)return;
      const index=Math.max(0,Math.min(1,Math.round(row.scrollLeft/row.clientWidth)));
      if(index===activeRef.current)return;
      if(row.contains(document.activeElement))tabs.current[index]?.focus();
      setChosen(index);
    },140);
  }
  return <div className="weekly-briefing">
    <div className="briefing-tabs" role="tablist" aria-label="Weekly highlights">
      {['Game of the week','Play next'].map((label,index)=><button key={label} ref={el=>{tabs.current[index]=el;}} type="button" role="tab"
        id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={active===index} tabIndex={active===index?0:-1}
        onClick={()=>select(index)} onKeyDown={event=>{
          const next=event.key==='Home'?0:event.key==='End'?1:['ArrowRight','ArrowLeft'].includes(event.key)?1-index:null;
          if(next!==null){event.preventDefault();select(next,true);}
        }}>{index===0?<Trophy size={15} aria-hidden="true"/>:<Swords size={15} aria-hidden="true"/>}{label}</button>)}
    </div>
    <div className="briefing-track" ref={track} onScroll={followSwipe}>
    {[0,1].map(index=><div key={index} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} aria-hidden={active!==index} inert={active!==index} tabIndex={active===index?0:-1} className={`briefing-panel ${index===0?'briefing-best':'briefing-next'}`}>
      {feature.loading ? <p className="briefing-empty" role="status">Loading this week’s briefing…</p> : index===0 ? best ? <>
        <div className="briefing-meta"><span>{feature.manualGame?'Weekly pick':'Best so far'} · {gameDate(best.game.started_at)}</span>
          {rank && rank<=20 ? <span className={`recent-rank-stamp${rank>10?' recent-rank-stamp-subtle':''}`} data-rank={rank} role="img" aria-label={`Hall of Fame #${rank}`}><span>Hall of Fame</span><b>#{rank}</b></span>:null}
        </div>
        <BriefingTeams rivalry={best.rivalry} result={score(best.game.goals)}/>
        <div className="briefing-story"><strong>{best.captions[0]}</strong><span><Timer size={13} aria-hidden="true"/>{clock(playingTime([best.game]))}<span aria-hidden="true">·</span>{best.rating.total.toFixed(1)} intensity</span></div>
        <Link className="briefing-action" to={`/game/${best.game.id}`}>View game <ArrowUpRight size={16} aria-hidden="true"/></Link>
      </> : <div className="briefing-empty"><h3>This week’s classic is still to come.</h3><p>The most intense finished game earns this spot.</p><Link to="/hall-of-fame">Past classics <ArrowUpRight size={16} aria-hidden="true"/></Link></div> : pick ? <>
        <div className="briefing-meta"><span>{personalized?'Suggested for you':'Top table pick'}</span><span>Play next</span></div>
        <BriefingTeams rivalry={pick.rivalry}/>
        <div className="briefing-story"><strong>{pick.close===0?'Time for a rematch':pick.count===1?'A recent game finished within two goals':`${pick.close} of ${pick.count} recent games finished within two goals`}</strong>
          <span>{pick.daysSincePlayed<1?'Last played within 24 hours':`Last played ${Math.floor(pick.daysSincePlayed)} ${Math.floor(pick.daysSincePlayed)===1?'day':'days'} ago`}</span>
        </div>
        <Link className="briefing-action" to={`/rivalry/${pick.rivalry.id}`}>Open matchup <ArrowUpRight size={16} aria-hidden="true"/></Link>
      </> : <div className="briefing-empty"><h3>Your next rivalry starts here.</h3><p>Play a first-to-10 game to build a recommendation.</p><Link to="/rivalries">Explore rivalries <ArrowUpRight size={16} aria-hidden="true"/></Link></div>}
    </div>)}
    </div>
  </div>;
}
