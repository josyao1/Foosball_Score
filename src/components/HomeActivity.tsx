import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { GameHistoryList, gameHistory } from './RecentGames';
import { AchievementIcon } from './AchievementIcon';
import { recentAchievements } from '../lib/achievementFeed';
import { playerPassports } from '../lib/players';
import type { Game, Rivalry } from '../lib/types';
import './home-activity.css';

export function HomeActivity({games,rivalries,now}:{games:Game[];rivalries:Rivalry[];now:number}) {
  const {entries,annotations}=useMemo(()=>{
    const parents=rivalries.filter(r=>!r.deleted_at), ids=new Set(parents.map(r=>r.id));
    const finished=games.filter(g=>!g.deleted_at && g.ended_at && Date.parse(g.ended_at)<=now && ids.has(g.rivalry_id));
    const entries=gameHistory(finished,parents).slice(0,5);
    const unlocks=recentAchievements(playerPassports(finished,parents),now,Infinity);
    const annotations=new Map<string,ReactNode>();
    for(const {game} of entries) {
      const badges=unlocks.filter(entry=>entry.game.id===game.id).flatMap(entry=>entry.badges.map(badge=>({name:entry.name,key:entry.playerKey,badge})));
      if(badges.length) annotations.set(game.id,<>
        {badges.slice(0,2).map(({name,key,badge})=><span key={`${key}-${badge.id}`} className="home-unlock"><span style={{color:badge.color}} aria-hidden="true"><AchievementIcon id={badge.id}/></span><span>{name} · {badge.name}</span></span>)}
        {badges.length>2 && <span className="home-unlock-more">+{badges.length-2} more</span>}
      </>);
    }
    return {entries,annotations};
  },[games,rivalries,now]);
  return <section className="recent-results home-activity" aria-label="Around the table">
    <header><h2>Around the table</h2><Link className="recent-see-all" to="/games">See all <ChevronRight size={15} aria-hidden="true"/></Link></header>
    {entries.length ? <GameHistoryList entries={entries} annotations={annotations}/> : <p className="home-activity-empty">The table is quiet. Your next result goes here.</p>}
  </section>;
}
