import { useEffect, useState } from 'react';
import type { AvailabilityDraft } from './types';

export const AVAILABLE:AvailabilityDraft={status:'available',reason:'',returnDate:''};
const pacificDate=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'});
export function availabilityDate(now=new Date()):string {
 const parts=pacificDate.formatToParts(now);
 return ['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-');
}
export function activeAvailability(value:AvailabilityDraft|null|undefined,now:Date|string=new Date()):AvailabilityDraft|null {
 const today=typeof now==='string'?now:availabilityDate(now);
 return value?.status==='out'&&(!value.returnDate||value.returnDate>today)?value:null;
}
export function validateAvailability(value:AvailabilityDraft|null):AvailabilityDraft|null {
 if(value===null||value.status==='available')return null;
 if(value.status!=='out'||typeof value.reason!=='string'||value.reason.trim().length>48)throw new Error('Enter a status up to 48 characters.');
 const date=value.returnDate;
 if(typeof date!=='string'||(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T12:00:00Z`))||new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date)))throw new Error('Choose a valid return date.');
 return {...value,reason:value.reason.trim()};
}
// One lightweight clock per profile page; no network request or background job is needed.
export function useAvailabilityDate() {
 const [today,setToday]=useState(()=>availabilityDate());
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;
  const refresh=()=>setToday(availabilityDate());
  const tick=()=>{refresh();timer=setTimeout(tick,60000-Date.now()%60000);};
  tick();
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  return ()=>{clearTimeout(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 return today;
}
