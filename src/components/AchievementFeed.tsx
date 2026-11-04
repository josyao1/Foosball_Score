import { useEffect,useMemo,useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { playerPassports } from '../lib/players';
import { recentAchievements } from '../lib/achievementFeed';
import { gameDate,gameTime } from '../lib/time';
import type { Game,Rivalry } from '../lib/types';
import { AchievementIcon } from './AchievementIcon';
import '../achievement-feed.css';
export function AchievementFeed({games,rivalries}:{games:Game[];rivalries:Rivalry[]}){
  const [now,setNow]=useState(()=>Date.now());
  const players=useMemo(()=>playerPassports(games,rivalries),[games,rivalries]);
  const entries=useMemo(()=>recentAchievements(players,now),[players,now]);
  useEffect(()=>{
    const refresh=()=>setNow(Date.now());
    const timer=window.setInterval(refresh,60000);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  if(!entries.length)return null;
  return <section className="achievement-feed" aria-label="Recent achievements">
    <header><h2>Recent achievements</h2></header>
    <ul>{entries.map(entry=><li key={`${entry.playerKey}-${entry.game.id}`} className={entry.recent ? 'is-recent' : undefined}><Link to={`/game/${entry.game.id}`} aria-label={`${entry.name} earned ${entry.badges.map(b=>b.name).join(', ')}. ${gameDate(entry.game.ended_at!)}, ${gameTime(entry.game.ended_at!)}. View game`}>
      <div className="achievement-feed-top"><strong>{entry.name} <span>earned {entry.badges.length===1 ? 'an achievement' : `${entry.badges.length} achievements`}</span></strong><time dateTime={entry.game.ended_at!}>{gameDate(entry.game.ended_at!)} · {gameTime(entry.game.ended_at!)}</time><ArrowUpRight size={16} aria-hidden="true"/></div>
      <div className="achievement-feed-badges">{entry.badges.map(badge=><span key={badge.id} style={{'--feed-ink':badge.color} as CSSProperties}><AchievementIcon id={badge.id}/>{badge.name}</span>)}</div>
    </Link></li>)}</ul>
  </section>;
}
