import { useSyncExternalStore } from 'react';
import type { Rivalry } from './types';
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
export function profileChoices(rivalries:Rivalry[]){
  const names=new Map<string,string>();
  for(const rivalry of rivalries)for(const name of [rivalry.player_a,rivalry.player_b]){
    const key=profileKey(name);if(key&&!names.has(key))names.set(key,name.trim());
  }
  return [...names].map(([key,name])=>({key,name})).sort((a,b)=>a.name.localeCompare(b.name));
}
export function profileFirst<T>(items:T[],matches:(item:T)=>boolean):T[]{
  return [...items.filter(matches),...items.filter(item=>!matches(item))];
}
export function isProfileRivalry(rivalry:Rivalry,key:string|null){return !!key&&[rivalry.player_a,rivalry.player_b].some(name=>profileKey(name)===key);}
