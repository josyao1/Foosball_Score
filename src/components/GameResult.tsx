import { Timer, Trophy } from 'lucide-react';
import { clock, duration, score, winner } from '../lib/stats';
import { sidePlayers } from '../lib/participants';
import { playerName, type Game, type Rivalry, type Side } from '../lib/types';
import { PlayerJersey } from './PlayerJersey';
import { TicketAchievements } from './TicketAchievements';
import { MatchTicketActions } from './MatchTicketActions';
import './game-result.css';

export function GameResult({ game, rivalry, animate }: {
  game: Game; rivalry: Rivalry; animate: boolean;
}) {
  const scores = score(game.goals), win = winner(game);
  const team = (side: Side) => <div className="result-team">
    <div className="result-jerseys">{sidePlayers(rivalry, side).map(person => <PlayerJersey key={person.id} name={person.name} decorative/>)}</div>
    <strong>{playerName(rivalry, side)}</strong>
  </div>;
  const number = (side: Side) => <b className={`result-digit${win === side ? ' is-winner' : ''}`}>{scores[side]}</b>;
  const outcome = <span className="result-outcome"><Trophy size={16} aria-hidden="true"/>{win ? `${playerName(rivalry, win)} wins.` : 'Draw.'}</span>;
  const timer = <span className="result-duration"><Timer size={14} aria-hidden="true"/>{clock(duration(game))}</span>;
  const rank = <MatchTicketActions game={game} rivalry={rivalry} mode="stamp"/>;
  const awards = <TicketAchievements gameId={game.id} animate={animate}/>;

  return <section className="game-result-panel" aria-label="Game result">
    <article className="result-design result-table" aria-label={`Final score: ${rivalry.player_a} ${scores.a}; ${rivalry.player_b} ${scores.b}`}>
      <header className="result-meta"><span className="result-final">Final {timer}</span>{rank}</header>
      <div className="result-table-field"><div className="result-center-circle" aria-hidden="true"/>
        <div className="result-table-side">{team('a')}{number('a')}</div><div className="result-table-side">{team('b')}{number('b')}</div>
        <span className="result-table-net result-table-net-left" aria-hidden="true"/><span className="result-table-net result-table-net-right" aria-hidden="true"/>
      </div>
      <div className="result-verdict">{outcome}</div>{awards}
    </article>
  </section>;
}
