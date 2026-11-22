import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search, Timer, X } from 'lucide-react';
import type { Game, Rivalry } from '../lib/types';
import { clock, playingTime, score, winner } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import { sidePlayers } from '../lib/participants';
import { PlayerJersey } from './PlayerJersey';
import { rankedClassics } from '../lib/hallOfFame';
import './recent-games.css';

export function gameHistory(games: Game[], rivalries: Rivalry[]) {
  const parents = new Map(rivalries.filter(r => !r.deleted_at).map(r => [r.id, r]));
  const ranks = new Map(rankedClassics(games, rivalries).slice(0,20).map((entry,index) => [entry.game.id,index+1]));
  return games.filter(g => g.ended_at && !g.deleted_at && parents.has(g.rivalry_id))
    .sort((a,b) => Date.parse(b.ended_at!) - Date.parse(a.ended_at!) || b.id.localeCompare(a.id))
    .map(game => ({game, rivalry: parents.get(game.rivalry_id)!, rank:ranks.get(game.id)}));
}
export function recentGames(games: Game[], rivalries: Rivalry[]) {
  return gameHistory(games, rivalries).slice(0,5);
}
export function filterGameHistory(entries:ReturnType<typeof gameHistory>, query:string) {
  const name = query.trim().toLowerCase();
  return name ? entries.filter(({rivalry}) => (['a','b'] as const).some(side =>
    sidePlayers(rivalry,side).some(player => player.name.toLowerCase().includes(name)))) : entries;
}
export function GamePlayerSearch({query,onChange}:{query:string;onChange:(query:string)=>void}) {
  const [opened,setOpened] = useState(false);
  const input = useRef<HTMLInputElement>(null), toggle = useRef<HTMLButtonElement>(null);
  const id = useId(), expanded = opened || Boolean(query);
  useEffect(()=>{ if(opened) input.current?.focus(); },[opened]);
  const close = () => { setOpened(false); onChange(''); toggle.current?.focus(); };
  return <>
  <button ref={toggle} type="button" className="game-search-toggle" aria-label={expanded?'Close player search':'Search players'} aria-expanded={expanded} aria-controls={id}
    onClick={()=>expanded?close():setOpened(true)}>{expanded?<X size={20} aria-hidden="true"/>:<Search size={20} aria-hidden="true"/>}</button>
  <div id={id} className={`game-player-search${expanded?' is-open':''}`}>
    <Search size={17} aria-hidden="true"/>
    <input ref={input} type="search" aria-label="Search games by player name" placeholder="Search players…" value={query}
      onChange={event=>onChange(event.target.value)} autoComplete="off" onKeyDown={event=>{if(event.key==='Escape' && opened){event.preventDefault();close();}}}/>
    {query && <button type="button" aria-label="Clear player search" onClick={()=>onChange('')}><X size={16} aria-hidden="true"/></button>}
  </div></>;
}
export function RecentGames({games,rivalries}: {games:Game[];rivalries:Rivalry[]}) {
  const entries = recentGames(games, rivalries);
  if (!entries.length) return null;
  return <section className="recent-results" aria-label="Recent games">
    <header><h2>Recent games</h2><Link className="recent-see-all" to="/games">See all <ChevronRight size={15} aria-hidden="true"/></Link></header>
    <GameHistoryList entries={entries}/>
  </section>;
}

export function GameHistoryList({entries}: {entries:ReturnType<typeof gameHistory>}) {
  return <ol>{entries.map(({game,rivalry,rank}) => {
      const result = score(game.goals), won = winner(game);
      return <li key={game.id}><Link to={`/game/${game.id}`}>
        <time dateTime={game.started_at}><span>{gameDate(game.started_at)}</span><small>{gameTime(game.started_at)}</small></time>
        <div className="recent-result-match">
          <span className={`recent-result-team${won==='a'?' is-winner':''}`}><span className="recent-result-jerseys" aria-hidden="true">{sidePlayers(rivalry,'a').map(player=><PlayerJersey key={player.id} name={player.name} decorative/>)}</span><span>{rivalry.player_a}</span></span>
          <strong aria-label={`${result.a} to ${result.b}`}><b className={won==='a'?'is-winner':''}>{result.a}</b><i>–</i><b className={won==='b'?'is-winner':''}>{result.b}</b></strong>
          <span className={`recent-result-team${won==='b'?' is-winner':''}`}><span className="recent-result-jerseys" aria-hidden="true">{sidePlayers(rivalry,'b').map(player=><PlayerJersey key={player.id} name={player.name} decorative/>)}</span><span>{rivalry.player_b}</span></span>
        </div>
        <span className="recent-result-meta">
          {rank && <span className={`recent-rank-stamp${rank > 10 ? ' recent-rank-stamp-subtle' : ''}`} data-rank={rank} role="img" aria-label={`Hall of Fame #${rank}`} title={`Current all-time Hall of Fame rank: #${rank}`}><span>Hall of Fame</span><b>#{rank}</b></span>}
          <span className="recent-result-duration" aria-label={`Game time ${clock(playingTime([game]))}`}><Timer size={13}/>{clock(playingTime([game]))}</span>
        </span>
        <ChevronRight className="recent-result-arrow" size={16} aria-hidden="true"/>
      </Link></li>;
    })}</ol>;
}
