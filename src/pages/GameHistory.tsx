import { ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { GameHistoryList, GamePlayerSearch, filterGameHistory, gameHistory } from '../components/RecentGames';
import { useStore } from '../lib/store';

export function GameHistory() {
  const { games, rivalries } = useStore();
  const [params,setParams] = useSearchParams();
  const query = params.get('player') ?? '';
  const history = gameHistory(games, rivalries);
  const entries = filterGameHistory(history,query);
  return <>
    <Link className="rivalry-directory-back" to="/"><ArrowLeft size={16} aria-hidden="true"/>Home</Link>
    <div className="rivalry-directory-heading game-history-heading"><h1>Game history</h1><span>{entries.length} {entries.length === 1 ? 'game' : 'games'}</span>
      {history.length > 0 && <GamePlayerSearch query={query} onChange={value=>setParams(current=>{
        const next = new URLSearchParams(current);
        if(value) next.set('player',value); else next.delete('player');
        return next;
      },{replace:true})}/>}
    </div>
    {history.length ? <section className="recent-results game-history" aria-label="All games">
      {entries.length ? <GameHistoryList entries={entries}/> : <p role="status">No games found for this player.</p>}
    </section> : <div className="empty-state"><p>No finished games yet.</p><Link className="button secondary" to="/rivalries">Explore rivalries</Link></div>}
  </>;
}
