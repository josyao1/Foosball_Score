import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GameHistoryList, gameHistory } from '../components/RecentGames';
import { useStore } from '../lib/store';

export function GameHistory() {
  const { games, rivalries } = useStore();
  const entries = gameHistory(games, rivalries);
  return <>
    <Link className="rivalry-directory-back" to="/"><ArrowLeft size={16} aria-hidden="true"/>Home</Link>
    <div className="rivalry-directory-heading game-history-heading"><h1>Game history</h1><span>{entries.length} {entries.length === 1 ? 'game' : 'games'}</span></div>
    {entries.length ? <section className="recent-results game-history" aria-label="All games">
      <GameHistoryList entries={entries}/>
    </section> : <div className="empty-state"><p>No finished games yet.</p><Link className="button secondary" to="/rivalries">Explore rivalries</Link></div>}
  </>;
}
