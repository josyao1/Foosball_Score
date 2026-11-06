import {useId} from 'react';
import {defaultLineup,sidePlayers} from '../lib/participants';
import {RUNGS,playerName} from '../lib/types';
import type {Lineup,Rivalry,Rung,Side} from '../lib/types';
import './rung-controls.css';
function Rod({rung}:{rung:Rung}){return <span className="rung-illustration" aria-hidden="true">{Array.from({length:rung==='defender'?2:rung==='middle'?5:3},(_,i)=><i key={i}/>)}</span>}
export function RungControls({rivalry,lineup,layout,disabled,onGoal}:{rivalry:Rivalry;lineup?:Lineup|null;layout:string;disabled:boolean;onGoal:(side:Side,rung:Rung)=>void}){
 const rungs=[...RUNGS].reverse();
 const id=useId(),positions=lineup??defaultLineup(rivalry);
 const button=(side:Side,rung:Rung,label=true)=>{
  const people=sidePlayers(rivalry,side);
  const scorer=people.length===2 ? people.find(p=>p.id===positions[side][rung==='goalie'||rung==='defender'?'defense':'attack']) : null;
  const nameId=`${id}-${side}-${rung}`;
  return <button key={`${side}-${rung}`} className={`rung-button side-${side}${scorer?' has-assignee':''}`} disabled={disabled} onClick={()=>onGoal(side,rung)} aria-label={`${playerName(rivalry,side)} ${rung} goal`} aria-describedby={scorer?nameId:undefined}><Rod rung={rung}/>{(label||scorer)&&<span className="rung-label">{label&&<span>{rung[0].toUpperCase()+rung.slice(1)}</span>}{scorer&&<strong className="rung-assignee" id={nameId}>{scorer.name}</strong>}</span>}<b>+</b></button>;
 };
 if(layout==='rows')return <div className="rung-row-table"><div className="rung-table-head"><span className="text-a">{rivalry.player_a}</span><span>Rung</span><span className="text-b">{rivalry.player_b}</span></div>{rungs.map(rung=><div className="rung-table-row" key={rung}>{button('a',rung,false)}<span>{rung}</span>{button('b',rung,false)}</div>)}</div>;
 if(layout==='pitch')return <div className="rung-pitch"><div className="pitch-center-circle" aria-hidden="true"/>{rungs.map(rung=><div className="pitch-rung-row" key={rung}>{button('a',rung)}<span className="pitch-rung-line" aria-hidden="true"/>{button('b',rung)}</div>)}</div>;
 if(layout==='broadcast')return <div className="rung-broadcast">{(['a','b'] as const).map(side=><div className={`broadcast-player side-${side}`} key={side}><span className="broadcast-player-name">{playerName(rivalry,side)}</span><div className="broadcast-buttons">{rungs.map(rung=>button(side,rung))}</div></div>)}</div>;
 return <div className={`rung-controls ${layout==='grid'?'rung-pad-grid':''}`}>{(['a','b'] as const).map(side=><div className={`rung-column side-${side}`} key={side}>{rungs.map(rung=>button(side,rung))}</div>)}</div>
}
