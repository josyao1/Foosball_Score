import { allPlayers, sidePlayers, matchesProfile } from './participants';
import { useSyncExternalStore } from 'react';
import type { Rivalry, Player } from './types';
export const PROFILE_KEY='tabletalk.profile.v1';
const PROFILE_EVENT='tabletalk-profile-change';
let fallback:string|null=null;
let sessionOverride=false;
export const profileKey=(name:string)=>name.trim().toLowerCase();
function readProfile(){
  if(sessionOverride)return fallback;
  try {const saved=localStorage.getItem(PROFILE_KEY);return saved ? profileKey(saved) : null;}
  catch{return fallback;}
}
function subscribe(notify:()=>void){
  const storage=(event:StorageEvent)=>{if(event.key===PROFILE_KEY || event.key===null){sessionOverride=false;notify();}};
  window.addEventListener('storage',storage);window.addEventListener(PROFILE_EVENT,notify);
  return ()=>{window.removeEventListener('storage',storage);window.removeEventListener(PROFILE_EVENT,notify);};
}
export function useProfile(){return useSyncExternalStore(subscribe,readProfile,()=>null);}
/** No expiry; storage failure retains the preference for this page session. */
export function selectProfile(name:string|null){
  fallback=name ? profileKey(name) : null;
  let persisted=true;sessionOverride=false;
  try{if(fallback)localStorage.setItem(PROFILE_KEY,fallback);else localStorage.removeItem(PROFILE_KEY);}catch{persisted=false;sessionOverride=true;}
  window.dispatchEvent(new Event(PROFILE_EVENT));
  return persisted;
}
export function profileChoices(rivalries:Rivalry[],registry:Player[]=[]){
  return allPlayers(rivalries,registry).map(p=>({key:p.id,name:p.name})).sort((a,b)=>a.name.localeCompare(b.name));
}
export function profileFirst<T>(items:T[],matches:(item:T)=>boolean):T[]{
  return [...items.filter(matches),...items.filter(item=>!matches(item))];
}
export function isProfileRivalry(rivalry:Rivalry,key:string|null){return [...sidePlayers(rivalry,'a'),...sidePlayers(rivalry,'b')].some(p=>matchesProfile(p,key));}
