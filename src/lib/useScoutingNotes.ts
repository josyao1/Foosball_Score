import { useEffect, useMemo, useRef } from 'react';
import { chooseScoutingNotes, scoutingCandidates } from './scouting';
import type { ScoutingNote, ScoutingOverride } from './scouting';
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
  const candidates=useMemo(()=>scoutingCandidates(games,rivalries),[games,rivalries]);
  return useScoutingSelection(candidates,ready);
}
const noOverrides:Record<string,ScoutingOverride>={};
export function useScoutingSelection(candidates:Record<string,ScoutingNote[]>,ready=true,overrides:Record<string,ScoutingOverride>=noOverrides){
  const remembered=useRef<Record<string,string>|null>(null);
  const previousOverrides=useRef<Record<string,ScoutingOverride>>(overrides);
  if(remembered.current===null)remembered.current=readScoutingChoices();
  const notes=useMemo(()=>{
    const previous={...remembered.current};
    for(const id of Object.keys(previousOverrides.current))if(!overrides[id])delete previous[id];
    return chooseScoutingNotes(candidates,previous,overrides);
  },[candidates,overrides]);
  useEffect(()=>{
    if(!ready)return;
    const choices=Object.fromEntries(Object.entries(notes).map(([id,n])=>[id,n.id]));
    remembered.current=choices;
    previousOverrides.current=overrides;
    try { localStorage.setItem(storageKey,JSON.stringify(choices)); } catch { /* Private mode still gets current, computed notes. */ }
  },[notes,ready,overrides]);
  return notes;
}
