import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { Game, Rivalry, Side } from '../lib/types';
import { defaultLineup, sidePlayers } from '../lib/participants';
export function TeamPositions({game,rivalry,busy,onSave}:{game:Game;rivalry:Rivalry;busy:boolean;onSave:(g:Game)=>Promise<unknown>}){
 const [error,setError]=useState(''),[pending,setPending]=useState(false);
 const lineup=game.lineup??defaultLineup(rivalry);
 const teams=(['a','b'] as const).filter(s=>sidePlayers(rivalry,s).length===2);
 if(!teams.length)return null;
 async function save(side?:Side){
  if(pending||busy)return;
  setPending(true);setError('');
  const next=side?{...lineup,[side]:{defense:lineup[side].attack,attack:lineup[side].defense,swapped_at_ms:Math.max(0,Date.now()-Date.parse(game.started_at))}}:lineup;
  try{await onSave({...game,lineup:next});}catch(e){setError(e instanceof Error?e.message:'Could not swap positions.');}finally{setPending(false);}
 }
 return <section className="team-positions" aria-label="Team positions">
  {teams.map(side=>{
   const people=sidePlayers(rivalry,side),name=(id:string)=>people.find(p=>p.id===id)?.name;
   return <div key={side} className="team-position-row"><span className={`position-side ${side}`}>{side==='a'?'Black':'White'}</span><div><span><strong>{name(lineup[side].defense)}</strong><small>Goalie + defender</small></span><span><strong>{name(lineup[side].attack)}</strong><small>Middle + attacker</small></span></div><button type="button" className="position-swap" disabled={busy||pending} aria-label={`Swap ${side==='a'?'black':'white'} positions`} onClick={()=>void save(side)}><ArrowLeftRight size={16}/><span>Swap</span></button></div>;
  })}
  {!game.lineup&&<button type="button" className="button secondary" disabled={busy||pending} onClick={()=>void save()}>Use these positions</button>}
  {error&&<p className="form-error" role="alert">{error}</p>}
 </section>;
}
