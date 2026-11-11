import { Link } from 'react-router-dom';
import { ChevronRight, Timer } from 'lucide-react';
import type { Game, Rivalry } from '../lib/types';
import { clock, playingTime, score, winner } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import './recent-games.css';

export function recentGames(games: Game[], rivalries: Rivalry[]) {
  const parents = new Map(rivalries.filter(r => !r.deleted_at).map(r => [r.id, r]));
  return games.filter(g => g.ended_at && !g.deleted_at && parents.has(g.rivalry_id))
    .sort((a,b) => Date.parse(b.ended_at!) - Date.parse(a.ended_at!) || b.id.localeCompare(a.id))
    .slice(0,5).map(game => ({game, rivalry: parents.get(game.rivalry_id)!}));
}
export function RecentGames({games,rivalries}: {games:Game[];rivalries:Rivalry[]}) {
  const entries = recentGames(games, rivalries);
  if (!entries.length) return null;
  return <section className="recent-results" aria-label="Recent games">
    <header><h2>Recent games</h2><span>Across the table</span></header>
    <ol>{entries.map(({game,rivalry}) => {
      const result = score(game.goals), won = winner(game);
      return <li key={game.id}><Link to={`/game/${game.id}`}>
        <time dateTime={game.started_at}><span>{gameDate(game.started_at)}</span><small>{gameTime(game.started_at)}</small></time>
        <div className="recent-result-match">
          <span className={won==='a'?'is-winner':''}>{rivalry.player_a}</span>
          <strong aria-label={`${result.a} to ${result.b}`}><b className={won==='a'?'is-winner':''}>{result.a}</b><i>–</i><b className={won==='b'?'is-winner':''}>{result.b}</b></strong>
          <span className={won==='b'?'is-winner':''}>{rivalry.player_b}</span>
        </div>
        <span className="recent-result-duration" aria-label={`Game time ${clock(playingTime([game]))}`}><Timer size={13}/>{clock(playingTime([game]))}</span>
        <ChevronRight className="recent-result-arrow" size={16} aria-hidden="true"/>
      </Link></li>;
    })}</ol>
  </section>;
}
