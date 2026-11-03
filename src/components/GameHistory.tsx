import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Game, Rivalry } from '../lib/types';
import { GameCard } from '../pages/Home';
import './game-history.css';
const PAGE_SIZE = 10;
export function GameHistory({ games, rivalry, onStart, busy }: {games: Game[]; rivalry: Rivalry; onStart: () => void; busy: boolean}) {
  const [requestedPage, setPage] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const pages = Math.max(1, Math.ceil(games.length / PAGE_SIZE));
  useEffect(() => { setPage(current => Math.min(current, pages)); }, [pages]);
  const page = Math.min(requestedPage, pages), offset = (page - 1) * PAGE_SIZE;
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])].filter(n => n > 0 && n <= pages).sort((a,b) => a-b);
  const go = (next: number) => {
    setPage(next);
    heading.current?.focus({preventScroll:true});
    heading.current?.scrollIntoView?.({block:'start',behavior:'auto'});
  };
  return <section className="game-history" aria-labelledby="game-history-title">
    <div className="section-heading"><h2 id="game-history-title" tabIndex={-1} ref={heading}>Game history</h2>{games.length > PAGE_SIZE && <span className="history-range">{offset + 1}–{Math.min(offset + PAGE_SIZE, games.length)} of {games.length}</span>}</div>
    <div className="game-list">{games.slice(offset, offset + PAGE_SIZE).map((game,i) => <GameCard key={game.id} game={game} rivalry={rivalry} index={games.length - offset - i}/>)}</div>
    {pages > 1 && <nav className="history-pagination" aria-label="Game history pages">
      <button type="button" aria-label="Previous history page" disabled={page === 1} onClick={() => go(page - 1)}><ChevronLeft size={16}/></button>
      {numbers.map((number,i) => <span className="history-page-group" key={number}>{i > 0 && number - numbers[i - 1] > 1 && <span className="history-page-gap" aria-hidden="true">…</span>}<button type="button" aria-label={`Page ${number}`} aria-current={page === number ? 'page' : undefined} onClick={() => go(number)}>{number}</button></span>)}
      <button type="button" aria-label="Next history page" disabled={page === pages} onClick={() => go(page + 1)}><ChevronRight size={16}/></button>
    </nav>}
    {!games.length && <div className="empty-state"><p>No games yet.</p><button className="button secondary" onClick={onStart} disabled={busy}>Start the first game</button></div>}
  </section>;
}
