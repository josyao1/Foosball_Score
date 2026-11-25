import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { playerPassports } from '../lib/players';
import { playerChemistry } from '../lib/chemistry';
import { useScoutingManager } from '../lib/useScoutingManager';
import { activeAvailability, AVAILABLE, useAvailabilityDate, validateAvailability } from '../lib/playerAvailability';
import { PlayerPassportCard, type PassportTab } from '../pages/Players';
import type { AvailabilityDraft, Player } from '../lib/types';
import './player-availability.css';

export function PlayerAvailabilitySettings() {
 const {players=[],games=[],rivalries=[]}=useStore();
 const people=useMemo(()=>playerPassports(games,rivalries,players).sort((a,b)=>a.name.localeCompare(b.name)),[games,rivalries,players]);
 const chemistry=useMemo(()=>playerChemistry(games,rivalries),[games,rivalries]);
 const {notes}=useScoutingManager();
 const [selected,setSelected]=useState('');
 const person=people.find(p=>p.key===selected)??people[0];
 const player=players.find(p=>p.id===person?.key);
 return <section className="availability-settings" aria-label="Player availability">
  <div className="availability-preview-intro"><h2>Out of the lineup</h2><p>Set a player’s status for everyone. The OUT tag and faded jersey appear on their profile.</p></div>
  {person&&player ? <AvailabilityEditor key={player.id} player={player} people={people} person={person} note={notes[person.key]} chemistry={chemistry[person.key]} select={setSelected}/> : <p>No players yet. Add a player first.</p>}
 </section>;
}
function AvailabilityEditor({player,people,person,note,chemistry,select}:{
 player:Player; people:ReturnType<typeof playerPassports>; person:ReturnType<typeof playerPassports>[number];
 note:React.ComponentProps<typeof PlayerPassportCard>['note']; chemistry:React.ComponentProps<typeof PlayerPassportCard>['chemistry']; select:(id:string)=>void;
}) {
 const {updateAvailability,busy}=useStore();
 const today=useAvailabilityDate();
 // Keep the original revision with an edited draft so concurrent changes cannot be overwritten.
 const [edit,setEdit]=useState<{player:Player;draft:AvailabilityDraft}|null>(null);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [tab,setTab]=useState<PassportTab>('overview');
 const draft=edit?.draft??activeAvailability(player.availability,today)??AVAILABLE;
 const update=(patch:Partial<AvailabilityDraft>)=>{setEdit({player:edit?.player??player,draft:{...draft,...patch}});setError('');setNotice('');};
 async function save(event:React.FormEvent) {
  event.preventDefault();setError('');setNotice('');
  try {
   const value=validateAvailability(draft);
   if(value?.returnDate&&value.returnDate<=today)throw new Error('Choose a future return date, or mark the player available.');
   await updateAvailability(edit?.player??player,value);
   setEdit(null);setNotice('Saved for everyone.');
  } catch(e){setError(e instanceof Error?e.message:'Could not save availability.');}
 }
 return <div className="availability-preview-layout">
  <form className="availability-draft-controls" onSubmit={save}>
   <label>Player<select value={player.id} disabled={busy} onChange={event=>select(event.target.value)}>{people.map(p=><option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
   <label>Availability<select value={draft.status} disabled={busy} onChange={event=>update({status:event.target.value as AvailabilityDraft['status']})}><option value="available">Available</option><option value="out">Out</option></select></label>
   <label className="availability-status-text">Status text<input value={draft.reason} maxLength={48} disabled={busy||draft.status==='available'} placeholder="OOO, injured, on vacation…" onChange={event=>update({reason:event.target.value})}/></label>
   <label>Estimated return<input type="date" value={draft.returnDate} min={today} disabled={busy||draft.status==='available'} onChange={event=>update({returnDate:event.target.value})}/></label>
   {draft.returnDate&&draft.status==='out'&&<button type="button" className="text-button" disabled={busy} onClick={()=>update({returnDate:''})}>Return date unknown</button>}
   <p>Automatically available at the start of the return date, Pacific time. Leave it blank to clear the status yourself.</p>
   <button type="submit" disabled={busy||!edit}>{busy?'Saving…':'Save status'}</button>
   {edit&&<button type="button" disabled={busy} onClick={()=>{setEdit(null);setError('');setNotice('');}}>Reset changes</button>}
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </form>
  <div className="availability-profile-preview"><PlayerPassportCard player={person} players={people} tab={tab} setTab={setTab} note={note} chemistry={chemistry} availability={activeAvailability(draft,today)}/></div>
 </div>;
}
