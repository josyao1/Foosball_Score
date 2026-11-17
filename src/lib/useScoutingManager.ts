import { useEffect, useMemo, useRef } from 'react';
import { activeScoutingOverride, makeScoutingOverride, scoutingCandidates } from './scouting';
import { useScoutingSelection } from './useScoutingNotes';
import { useStore } from './store';
import type { Player, ScoutingOverride } from './types';

export function useScoutingManager() {
  const store=useStore();
  const candidates=useMemo(()=>scoutingCandidates(store.games,store.rivalries),[store.games,store.rivalries]);
  const overrides=useMemo(()=>Object.fromEntries((store.players??[]).filter(p=>p.scouting_override)
    .map(p=>[p.id,p.scouting_override!])) as Record<string,ScoutingOverride>,[store.players]);
  const notes=useScoutingSelection(candidates,!store.loading,overrides);
  const attempted=useRef(new Set<string>());
  // Clear expired picks with revision checks so they cannot reappear after later edits.
  useEffect(()=>{
    if(store.loading || store.busy || store.error)return;
    const expired=store.players?.find(player=>player.scouting_override
      && !activeScoutingOverride(candidates[player.id]??[],player.scouting_override)
      && !attempted.current.has(`${player.id}:${player.scouting_revision??0}`));
    if(!expired)return;
    attempted.current.add(`${expired.id}:${expired.scouting_revision??0}`);
    void store.updateScoutingOverride(expired,null).catch(()=>{/* Store exposes the error; an automatic note is already displayed. */});
  },[store,candidates]);
  async function choose(player:Player,noteId:string|null){
    await store.updateScoutingOverride(player,noteId===null?null:makeScoutingOverride(noteId,candidates[player.id]??[]));
  }
  return {candidates,notes,overrides,choose};
}
