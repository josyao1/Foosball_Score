import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useStore } from '../lib/store';
import { playerAppearance } from '../lib/playerAppearance';
import type { Player, PlayerAppearance } from '../lib/types';
import { Dialog } from './Dialog';
import { PlayerJersey } from './PlayerJersey';
import './player-settings.css';

function PlayerEditor({player,onClose,onSaved}:{player:Player;onClose:()=>void;onSaved:()=>void}) {
 const store=useStore();
 const [name,setName]=useState(player.name);
 const [appearance,setAppearance]=useState(()=>playerAppearance(player));
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const change=(key:keyof PlayerAppearance,value:string)=>setAppearance(a=>({...a,[key]:value}));
 async function save(e:React.FormEvent) {
  e.preventDefault();if(saving)return;setSaving(true);setError('');
  try {await store.updatePlayer(player,{name,appearance});onSaved();}
  catch(e){setError(e instanceof Error?e.message:'Could not save player.');setSaving(false);}
 }
 return <Dialog title="Edit player" onClose={onClose} dismissible={!saving} closeOnBackdrop className="player-settings-dialog">
  <form className="player-settings-form" onSubmit={e=>void save(e)}>
   <div className="player-settings-preview"><PlayerJersey name={name} appearance={appearance}/><div><strong>{name||'Player'}</strong><span>{appearance.subtitle||'Your table, your team.'}</span></div></div>
   <label>Name<input autoFocus value={name} onChange={e=>setName(e.target.value)} required maxLength={40} disabled={saving} autoComplete="off"/></label>
   <label>Subtitle<input value={appearance.subtitle} onChange={e=>change('subtitle',e.target.value)} maxLength={100} disabled={saving} placeholder="Team or role"/></label>
   <label>Jersey lettering<input value={appearance.letters} onChange={e=>change('letters',e.target.value)} required maxLength={6} disabled={saving} autoComplete="off"/></label>
   <fieldset className="player-settings-colors"><legend>Uniform colors</legend>{([['color','Shirt'],['trim','Trim'],['lettering','Letters']] as const).map(([key,label])=><label key={key}><input type="color" aria-label={`${label} color`} value={appearance[key]} onChange={e=>change(key,e.target.value)} disabled={saving}/><span>{label}</span></label>)}</fieldset>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="player-settings-actions"><button type="button" className="text-button" onClick={onClose} disabled={saving}>Cancel</button><button className="button primary" disabled={saving||store.busy}>{saving?'Saving…':'Save changes'}</button></div>
  </form>
 </Dialog>;
}
export function PlayerSettings() {
 const {players=[],loading,error,refresh}=useStore();
 const [editing,setEditing]=useState<Player|null>(null),[notice,setNotice]=useState('');
 return <section className="player-settings" aria-label="Player settings">
  <p className="muted">Names, jerseys, and subtitles. Shared across the table.</p>
  {loading?<p>Loading players…</p>:error?<p role="alert">{error} <button className="text-button" onClick={()=>void refresh()}>Retry</button></p>:null}
  {notice&&<p role="status">{notice}</p>}
  <div className="player-settings-list">{[...players].sort((a,b)=>a.name.localeCompare(b.name)).map(player=><button key={player.id} className="player-settings-row" onClick={()=>{setNotice('');setEditing(player);}} aria-label={`Edit ${player.name}`}>
   <PlayerJersey name={player.name} appearance={playerAppearance(player)} decorative/><span><strong>{player.name}</strong><small>{playerAppearance(player).subtitle||'No subtitle'}</small></span><Pencil size={17}/>
  </button>)}</div>
  {!loading&&!error&&!players.length&&<p>No players yet. Add one from the Players tab.</p>}
  {editing&&<PlayerEditor player={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);setNotice('Player updated.');}}/>}
 </section>;
}
