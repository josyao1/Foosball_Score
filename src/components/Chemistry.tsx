import { useState } from 'react';
import { PlayerJersey } from './PlayerJersey';
import type { ChemistryPair, PlayerChemistry } from '../lib/chemistry';
import './chemistry.css';

export function Chemistry({name,data}:{name:string;data?:PlayerChemistry}){
 const [mode,setMode]=useState<'with'|'against'>('with');
 function row(pair:ChemistryPair,withPlayer:boolean){
   const total=pair.ownGoals+pair.partnerGoals,percent=total?Math.round(pair.ownGoals/total*100):0;
   return <li className="chemistry-pair" key={pair.person.id}>
     <div className="chemistry-pair-head">
       <span className="chemistry-jerseys" aria-hidden="true"><PlayerJersey name={name} decorative/><span>{withPlayer?'+':'vs'}</span><PlayerJersey name={pair.person.name} decorative/></span>
       <div className="chemistry-person"><strong>{withPlayer?'With':'Against'} {pair.person.name}</strong><small>{pair.played} {pair.played===1?'game':'games'}</small></div>
       <div className="chemistry-record"><b>{pair.wins}W–{pair.losses}L{pair.draws>0?`–${pair.draws}D`:''}</b><small>{Math.round(pair.wins/pair.played*100)}% wins</small></div>
     </div>
     {withPlayer&&<div className="chemistry-contribution">
       {total>0?<><div className="chemistry-share-labels"><span>{name} <b>{percent}%</b><small>{pair.ownGoals} goals</small></span><span>{pair.person.name} <b>{100-percent}%</b><small>{pair.partnerGoals} goals</small></span></div>
       <div className="chemistry-share-track" role="img" aria-label={`${name} ${percent} percent, ${pair.person.name} ${100-percent} percent of attributed goals`}><i style={{width:`${percent}%`}}/></div></>:<small>No individually attributed goals yet.</small>}
       {pair.unattributed>0&&<small className="chemistry-unknown">{pair.unattributed} older {pair.unattributed===1?'goal has':'goals have'} no recorded scorer.</small>}
     </div>}
   </li>;
 }
 const withPairs=data?.with??[],singles=data?.singles??[],teams=data?.teams??[];
 return <section className="passport-chemistry" aria-label={`${name} chemistry`}>
   <div className="chemistry-switch" data-mode={mode} role="group" aria-label="Chemistry view">{(['with','against'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>setMode(value)}>{value==='with'?'With':'Against'}</button>)}</div>
   <div className="chemistry-scroll" tabIndex={0} role="region" aria-label={mode==='with'?'Partnership records':'Opponent records'} key={mode}>
   {mode==='with'?<>
     {withPairs.length?<><ul className="chemistry-list chemistry-partners" aria-label="Partnerships">{withPairs.map(pair=>row(pair,true))}</ul></>:<p className="chemistry-empty">Finish a game with a teammate to see your partnerships.</p>}
   </>:<>
     {!singles.length&&!teams.length?<p className="chemistry-empty">Your opponents will appear after your first finished game.</p>:<div className="chemistry-opponents">
       {singles.length>0&&<section><h3>Singles</h3><ul className="chemistry-list">{singles.map(pair=>row(pair,false))}</ul></section>}
       {teams.length>0&&<section><h3>Team games</h3><ul className="chemistry-list">{teams.map(pair=>row(pair,false))}</ul></section>}
     </div>}
   </>}
   </div>
 </section>;
}
