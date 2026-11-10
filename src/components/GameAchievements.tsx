import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import { ACHIEVEMENTS, earnedAchievements, hardCarryWinner, streakAchievementPlayers, lunchBreakPlayers } from '../lib/achievements';
import { gameHighlights } from '../lib/records';
import { playerName } from '../lib/types';
import type { Game, Rivalry, Side } from '../lib/types';
import { AchievementIcon } from './AchievementIcon';
import { Dialog } from './Dialog';

const StreakContext=createContext<ReturnType<typeof streakAchievementPlayers>>(new Map());
const LunchContext=createContext<ReturnType<typeof lunchBreakPlayers>>(new Map());
export function GameAchievementProvider({games,rivalries,children}:{games:Game[];rivalries:Rivalry[];children:ReactNode}){
  const streaks=useMemo(()=>streakAchievementPlayers(games,rivalries),[games,rivalries]);
  const lunches=useMemo(()=>lunchBreakPlayers(games,rivalries),[games,rivalries]);
  return <StreakContext.Provider value={streaks}><LunchContext.Provider value={lunches}>{children}</LunchContext.Provider></StreakContext.Provider>;
}
export function gameAwards(game:Game,rivalry:Rivalry,streakSides:Side[]=[],streakPeople:{side:Side;name:string}[]=[]){
  if(!game.ended_at)return [];
  const highlights=gameHighlights(game);
  const carry = hardCarryWinner(game, rivalry, highlights);
  const awards = (['a','b'] as const).flatMap(side=>{
    const ids=earnedAchievements(game,side,highlights,rivalry);
    if(streakSides.includes(side))ids.push('streak');
    return ids.map(id=>({side,name:id==='streak'&&streakPeople.some(p=>p.side===side)?streakPeople.filter(p=>p.side===side).map(p=>p.name).join(' and '):playerName(rivalry,side),badge:ACHIEVEMENTS.find(b=>b.id===id)!}));
  });
  if (carry) awards.push({side: carry.side, name: carry.player.name, badge: ACHIEVEMENTS.find(badge => badge.id === 'hardCarry')!});
  return awards;
}
export function useGameAwards(game:Game,rivalry:Rivalry){
  const streaks=useContext(StreakContext);
  const lunches=useContext(LunchContext);
  return useMemo(()=>[...gameAwards(game,rivalry,[...new Set(streaks.get(game.id)?.map(p=>p.side))],streaks.get(game.id)),...(['a','b'] as const).flatMap(side=>{const people=lunches.get(game.id)?.filter(p=>p.side===side)??[];return people.length?[{side,name:people.map(p=>p.name).join(' and '),badge:ACHIEVEMENTS.find(b=>b.id==='lunchBreak')!}]:[];})],[game,rivalry,streaks,lunches]);
}
export function GameAchievementMarker({game,rivalry,fallback=null}:{game:Game;rivalry:Rivalry;fallback?:ReactNode}){
  const awards=useGameAwards(game,rivalry);
  if(!awards.length)return fallback;
  const label=awards.map(a=>`${a.name}: ${a.badge.name}`).join('; ');
  return <span className="game-achievement-marker" role="img" aria-label={`Achievements — ${label}`} title={label}><Award size={14} aria-hidden="true"/></span>;
}
export function GameAchievementTags({awards}:{awards:ReturnType<typeof gameAwards>}){
  const [selected,setSelected]=useState<string|null>(null);
  const active=awards.find(a=>`${a.side}-${a.badge.id}`===selected);
  return <>
    {awards.map(a=><button type="button" key={`${a.side}-${a.badge.id}`} className="game-highlight-tag game-achievement-tag" aria-label={`${a.name}: ${a.badge.name}. Achievement details`} onClick={()=>setSelected(`${a.side}-${a.badge.id}`)}><AchievementIcon id={a.badge.id}/><span>{a.name}</span><strong>{a.badge.name}</strong></button>)}
    {active && <Dialog className="achievement-dialog" title={active.badge.name} onClose={()=>setSelected(null)} closeOnBackdrop><div className="game-achievement-description"><AchievementIcon id={active.badge.id}/><strong>{active.name}</strong><p>{active.badge.requirement}</p><small>Achieved in this game</small></div></Dialog>}
  </>;
}
