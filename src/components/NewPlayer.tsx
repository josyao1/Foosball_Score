import { useState } from 'react';
import { Dialog } from './Dialog';
import { useStore } from '../lib/store';
export function NewPlayer({onClose}:{onClose:()=>void}){
 const store=useStore();const [name,setName]=useState(''),[error,setError]=useState('');
 return <Dialog title="New player" onClose={onClose} dismissible={!store.busy}><form onSubmit={async e=>{e.preventDefault();try{await store.createPlayer(name);onClose();}catch(e){setError(e instanceof Error?e.message:'Could not create player.');}}}>
  <label>Player name<input autoFocus required maxLength={40} autoComplete="off" value={name} disabled={store.busy} onChange={e=>setName(e.target.value)}/></label>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <button className="button primary full" disabled={store.busy}>{store.busy?'Creating…':'Create player'}</button>
 </form></Dialog>;
}
