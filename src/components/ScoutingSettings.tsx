import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStore } from '../lib/store';
import { activeScoutingOverride, SCOUTING_REPLACEMENT_MARGIN } from '../lib/scouting';
import { useScoutingManager } from '../lib/useScoutingManager';
import type { Player } from '../lib/types';
import { PlayerJersey } from './PlayerJersey';
import { ScoutingNote } from './ScoutingNote';
import './scouting-settings.css';

export function ScoutingSettings(){
  const store=useStore();
  const {candidates,notes,overrides,choose}=useScoutingManager();
  const [filter,setFilter]=useState('');
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const players=[...(store.players??[])].sort((a,b)=>a.name.localeCompare(b.name));
  async function save(player:Player,noteId:string|null){
    if(saving)return;
    setSaving(true);setError('');setNotice('');
    try{await choose(player,noteId);setNotice(`${player.name}: ${noteId?'scouting note updated for everyone.':'automatic selection restored.'}`);}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not save scouting note.');}
    finally{setSaving(false);}
  }
  return <section className="scout-settings" aria-label="Scouting notes">
    <div className="scout-settings-intro">
      <p>Choose the note shown on each profile, for everyone. New facts can replace your pick with an {SCOUTING_REPLACEMENT_MARGIN}-point lead; existing alternatives must also gain {SCOUTING_REPLACEMENT_MARGIN} points. Ineligible picks return to automatic.</p>
      <label>Player<select value={filter} onChange={event=>setFilter(event.target.value)}>
        <option value="">All players</option>{players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}
      </select></label>
    </div>
    {(error||store.error)&&<p role="alert" className="form-error">{error||store.error}</p>}
    {notice&&<p role="status" className="scout-settings-notice">{notice}</p>}
    {store.loading?<p>Loading scouting notes…</p>:players.length===0?<p>No players yet.</p>:<div className="scout-settings-players">
      {players.filter(player=>!filter||player.id===filter).map(player=>{
        const options=candidates[player.id]??[],current=notes[player.id];
        const manual=activeScoutingOverride(options,overrides[player.id]);
        return <details className="scout-settings-player" key={player.id}>
          <summary><PlayerJersey name={player.name} decorative/><span><strong>{player.name}</strong>
            <small>{current?`${current.title} · ${manual?'Manual':'Automatic'}`:'No eligible note yet'}</small></span>
            <span className="scout-settings-count">{options.length} {options.length===1?'option':'options'}</span><ChevronDown size={17} aria-hidden="true"/>
          </summary>
          <div className="scout-settings-body">
            {overrides[player.id]&&<button type="button" className="text-button scout-settings-auto" disabled={saving||store.busy}
              onClick={()=>void save(player,null)}>Use automatic selection for {player.name}</button>}
            {options.length?<ol className="scout-settings-options">{options.map((note,index)=><li key={note.id}>
              <div className="scout-settings-option-heading"><span>#{index+1} · Score {note.weight.toFixed(1)}</span>
                {note.id===current?.id&&<strong>Showing now</strong>}</div>
              <ScoutingNote name={player.name} note={note}/>
              <button type="button" className="button secondary scout-settings-choose" disabled={saving||store.busy||manual?.id===note.id}
                aria-label={`Use ${note.title} for ${player.name}`} onClick={()=>void save(player,note.id)}>
                {manual?.id===note.id?'Selected manually':'Use this note'}</button>
            </li>)}</ol>:<p>No note currently meets the requirements. More finished games can unlock one.</p>}
          </div>
        </details>;
      })}
    </div>}
  </section>;
}
