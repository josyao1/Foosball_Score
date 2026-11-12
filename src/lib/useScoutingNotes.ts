import { useEffect, useMemo, useRef } from 'react';
import { chooseScoutingNotes, scoutingCandidates } from './scouting';
import type { Game, Rivalry } from './types';

const storageKey='tabletalk.scouting-notes.v1';
export function readScoutingChoices():Record<string,string>{
  try {
    const value:unknown=JSON.parse(localStorage.getItem(storageKey)??'{}');
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    return Object.fromEntries(Object.entries(value).filter(([,id])=>typeof id==='string'));
  } catch { return {}; }
}
export function useScoutingNotes(games:Game[],rivalries:Rivalry[],ready=true){
  const remembered=useRef<Record<string,string>|null>(null);
  if(remembered.current===null)remembered.current=readScoutingChoices();
  const candidates=useMemo(()=>scoutingCandidates(games,rivalries),[games,rivalries]);
  const notes=useMemo(()=>chooseScoutingNotes(candidates,remembered.current??{}),[candidates]);
  useEffect(()=>{
    if(!ready)return;
    const choices=Object.fromEntries(Object.entries(notes).map(([id,n])=>[id,n.id]));
    remembered.current=choices;
    try { localStorage.setItem(storageKey,JSON.stringify(choices)); } catch { /* Private mode still gets current, computed notes. */ }
  },[notes,ready]);
  return notes;
}
