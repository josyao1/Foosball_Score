import { useState } from 'react';
import { Check, ChevronDown, Sparkles, UserRound } from 'lucide-react';
import { Dialog } from './Dialog';
import { profileChoices, selectProfile, useProfile } from '../lib/profile';
import type { Rivalry, Player } from '../lib/types';
export function ProfilePicker({rivalries,players=[]}:{rivalries:Rivalry[];players?:Player[]}){
  const selected=useProfile(),choices=profileChoices(rivalries,players);
  const current=choices.find(p=>(p.key===selected||p.name.trim().toLowerCase()===selected));
  const [open,setOpen]=useState(false),[warning,setWarning]=useState(false);
  function choose(key:string|null){
    if(selectProfile(key)){setOpen(false);setWarning(false);}else setWarning(true);
  }
  return <>
    <button type="button" className={`profile-picker${current ? '' : ' needs-profile'}`} aria-haspopup="dialog" aria-label={current ? `Your profile: ${current.name}. Change profile` : 'Select profile'} onClick={()=>setOpen(true)}>{current ? <UserRound size={16} aria-hidden="true"/> : <Sparkles className="profile-sparkle" size={16} aria-hidden="true"/>}<span>{current?.name ?? 'Select profile'}</span><ChevronDown size={13} aria-hidden="true"/></button>
    {open && <Dialog className="profile-dialog" title="Your profile" onClose={()=>setOpen(false)} closeOnBackdrop>
      <p className="profile-copy">Choose who’s playing. Your rivalries and passport appear first on this browser.</p>
      {warning && <p role="status" className="profile-copy">This browser couldn’t save your choice for future visits.</p>}
      <div className="profile-options">{choices.map(p=><button type="button" key={p.key} aria-pressed={(p.key===selected||p.name.trim().toLowerCase()===selected)} onClick={()=>choose(p.key)}><span>{p.name}</span>{(p.key===selected||p.name.trim().toLowerCase()===selected) && <Check size={16} aria-hidden="true"/>}</button>)}</div>
      {!choices.length && <p className="profile-copy">Add a player on the Players tab.</p>}
      {selected && <button type="button" className="profile-reset" onClick={()=>choose(null)}>Use without a profile</button>}
    </Dialog>}
  </>;
}
