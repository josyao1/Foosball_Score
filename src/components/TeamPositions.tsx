import { duration } from '../lib/stats';
import { PlayerJersey } from './PlayerJersey';
import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { Game, Rivalry, Side } from '../lib/types';
import { defaultLineup, sidePlayers } from '../lib/participants';
export function TeamPositions({game,rivalry,busy,onSave,onlySide}:{game:Game;rivalry:Rivalry;busy:boolean;onSave:(g:Game)=>Promise<unknown>;onlySide?:Side}){
 const [error,setError]=useState(''),[pending,setPending]=useState(false);
 const lineup=game.lineup??defaultLineup(rivalry);
 const teams=(['a','b'] as const).filter(s=>(!onlySide||s===onlySide)&&sidePlayers(rivalry,s).length===2);
 if(!teams.length)return null;
 async function save(side?:Side){
  if(pending||busy)return;
  setPending(true);setError('');
  const next=side?{...lineup,[side]:{defense:lineup[side].attack,attack:lineup[side].defense,swapped_at_ms:duration(game)}}:lineup;
  try{await onSave({...game,lineup:next});}catch(e){setError(e instanceof Error?e.message:'Could not swap positions.');}finally{setPending(false);}
 }
 return <section className="team-positions" aria-label="Team positions">
  {teams.map(side=>{
   const people = sidePlayers(rivalry, side);
   return <div key={side} className="team-position-row">
     <span className={`position-side ${side}`}>{side==='a'?'Black':'White'}</span>
     <div className="position-lineup">
       {people.map((person, index) => {
         const onDefense = lineup[side].defense === person.id;
         const shift = (onDefense ? 0 : 1) - index;
         return <strong key={person.id} className={`position-name shift-${shift}`}
           style={{gridColumn: index + 1}} aria-label={`${person.name}, ${onDefense ? 'goalie and defender' : 'middle and attacker'}`}>
           <PlayerJersey name={person.name} decorative/><span>{person.name}</span>
         </strong>;
       })}
       <small>Goalie + defender</small><small>Middle + attacker</small>
     </div>
     <button type="button" className="position-swap" disabled={busy||pending} aria-label={`Swap ${side==='a'?'black':'white'} positions`} onClick={()=>void save(side)}>
       <ArrowLeftRight size={16}/><span>Swap</span>
     </button>
   </div>;
  })}
  {!game.lineup&&<button type="button" className="button secondary" disabled={busy||pending} onClick={()=>void save()}>Use these positions</button>}
  {error&&<p className="form-error" role="alert">{error}</p>}
 </section>;
}
