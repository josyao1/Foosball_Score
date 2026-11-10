import {useId} from 'react';
import {defaultLineup,sidePlayers} from '../lib/participants';
import {RUNGS,playerName} from '../lib/types';
import type {Lineup,Rivalry,Rung,Side} from '../lib/types';
import './rung-controls.css';
function Rod({rung}:{rung:Rung}){return <span className="rung-illustration" aria-hidden="true">{Array.from({length:rung==='defender'?2:rung==='middle'?5:3},(_,i)=><i key={i}/>)}</span>}
type RungProps = {
  rivalry: Rivalry;
  lineup?: Lineup | null;
  disabled: boolean;
  onGoal: (side: Side, rung: Rung) => void;
};

export function RungButton({rivalry, lineup, side, rung, label = true, disabled, onGoal}:
  RungProps & {side: Side; rung: Rung; label?: boolean}) {
  const nameId = useId();
  const people = sidePlayers(rivalry, side);
  const position = rung === 'goalie' || rung === 'defender' ? 'defense' : 'attack';
  const scorerId = (lineup ?? defaultLineup(rivalry))[side][position];
  const assigned = people.length === 2 && people.some(person => person.id === scorerId);

  return <button type="button" className={`rung-button side-${side}${assigned ? ' has-assignee' : ''}`}
    disabled={disabled} onClick={() => onGoal(side, rung)}
    aria-label={`${playerName(rivalry, side)} ${rung} goal`} aria-describedby={assigned ? nameId : undefined}>
    <Rod rung={rung}/>
    {(label || assigned) && <span className="rung-label">
      {label && <span>{rung[0].toUpperCase() + rung.slice(1)}</span>}
      {assigned && <span className="rung-assignee-stack">{people.map(person => <strong key={person.id}
        className="rung-assignee" id={person.id === scorerId ? nameId : undefined}
        aria-hidden={person.id !== scorerId}>{person.name}</strong>)}</span>}
    </span>}
    <b aria-hidden="true">+</b>
  </button>;
}

export function RungControls({rivalry,layout,disabled,lineup,onGoal}:RungProps & {layout:string}){
 const rungs=[...RUNGS].reverse();
 const button=(side:Side,rung:Rung,label=true)=><RungButton key={`${side}-${rung}`} {...{rivalry,lineup,disabled,onGoal,side,rung,label}}/>;
 if(layout==='rows')return <div className="rung-row-table"><div className="rung-table-head"><span className="text-a">{rivalry.player_a}</span><span>Rung</span><span className="text-b">{rivalry.player_b}</span></div>{rungs.map(rung=><div className="rung-table-row" key={rung}>{button('a',rung,false)}<span>{rung}</span>{button('b',rung,false)}</div>)}</div>;
 if(layout==='pitch')return <div className="rung-pitch"><div className="pitch-center-circle" aria-hidden="true"/>{rungs.map(rung=><div className="pitch-rung-row" key={rung}>{button('a',rung)}<span className="pitch-rung-line" aria-hidden="true"/>{button('b',rung)}</div>)}</div>;
 if(layout==='broadcast')return <div className="rung-broadcast">{(['a','b'] as const).map(side=><div className={`broadcast-player side-${side}`} key={side}><span className="broadcast-player-name">{playerName(rivalry,side)}</span><div className="broadcast-buttons">{rungs.map(rung=>button(side,rung))}</div></div>)}</div>;
 return <div className={`rung-controls ${layout==='grid'?'rung-pad-grid':''}`}>{(['a','b'] as const).map(side=><div className={`rung-column side-${side}`} key={side}>{rungs.map(rung=>button(side,rung))}</div>)}</div>
}
