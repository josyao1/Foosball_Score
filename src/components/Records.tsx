import { useMemo } from "react";
import { Link } from 'react-router-dom';
import { ArrowUpRight, Play, BookOpen } from 'lucide-react';
import { gameDate, gameTime } from '../lib/time';
import { gameHighlights, gameFinalScore, momentScore, recordBook, recordLabels, recordValue } from '../lib/records';
import type { Moment, RecordKind } from '../lib/records';
import { playerName } from '../lib/types';
import type { Game, Rivalry, Side } from '../lib/types';
import '../records.css';
import { RecordMomentGraphic } from './RecordMomentGraphic';

const kinds: RecordKind[] = ['run', 'comeback', 'quickest', 'leadChanges', 'triple', 'response'];
const explanations: Record<RecordKind, string> = {
  run: 'Consecutive points without an answer.', burst: 'Most points in a rolling 30-second window.',
  quickest: 'Start to final goal. First to 10, win by 2; no early finishes or goals after the winning score.',
  comeback: 'Largest deficit overcome to win; later scores break ties.', triple: 'Time from the first to third point; opponent goals can occur between them.',
  response: 'Fastest goal immediately after conceding.', leadChanges: 'Switches in who is ahead. Tying the score is not a lead change.',
};
export const momentLink = (game: Game, moment: Moment) => `/game/${game.id}?record=${moment.kind}#momentum`;
function Player({ rivalry, side }: { rivalry: Rivalry; side: Side }) {
  return <span className="record-player"><i className={`record-side ${side}`} aria-hidden="true"/>{playerName(rivalry, side)}</span>;
}
function Sequence({ game, moment }: { game: Game; moment: Moment }) {
  return <span className="record-sequence" aria-label={`Score moves from ${momentScore(game, moment)}`}>
    <small>{momentScore(game, moment)}</small>
  </span>;
}
export function RecordBook({ games, rivalry }: { games: Game[]; rivalry: Rivalry }) {
  const { book, rates, completed } = useMemo(() => recordBook(games), [games]);
  const recordCount = kinds.filter(kind => book[kind]).length;
  return <section className="record-book" aria-labelledby="record-book-title">
    <div className="section-heading"><div><h2 id="record-book-title"><BookOpen size={24} aria-hidden="true"/> Record book</h2><p>{completed.length} finished {completed.length === 1 ? 'game' : 'games'} · {recordCount} records</p></div></div>
    {!recordCount ? <p className="record-empty">Finish a game to start the record book.</p> : <div className="record-ledger">
      {kinds.filter(kind => book[kind]).map(kind => {
        const { game, moment, ties } = book[kind]!;
        return <article key={kind} className="record-entry">
          <Link to={momentLink(game, moment)} className="record-page" aria-label={`${recordLabels[kind]}: ${recordValue(moment)}. ${moment.side ? playerName(rivalry, moment.side) : `${rivalry.player_a} vs ${rivalry.player_b}`}. ${gameDate(game.started_at)}, ${gameTime(game.started_at)}. ${ties ? `Matched in ${ties} other games. ` : ''}View game`}>
            <h3>{recordLabels[kind]}</h3>
            <div className="record-achievement"><strong>{recordValue(moment)}</strong><Sequence game={game} moment={moment}/></div>
            <div className="record-holder">{moment.side ? <Player rivalry={rivalry} side={moment.side}/> : <span>{rivalry.player_a} & {rivalry.player_b}</span>}</div>
            <RecordMomentGraphic game={game} moment={moment}/>
            <p className="record-definition">{explanations[kind]}</p>
            {ties > 0 && <small className="record-ties">Matched in {ties} other {ties === 1 ? 'game' : 'games'}</small>}
          </Link>
          <div className="record-entry-footer"><Link to={momentLink(game, moment)} className="record-game-source" aria-label={`View ${recordLabels[kind]} game`}><span>{gameDate(game.started_at)} <ArrowUpRight size={12} aria-hidden="true"/></span><small>{gameTime(game.started_at)} · Final {gameFinalScore(game)}</small></Link>
            <Link to={`/game/${game.id}?record=${moment.kind}&play=1#momentum`} className="record-watch" aria-label={`Watch ${recordLabels[kind].toLowerCase()} moment`}><Play size={13} aria-hidden="true"/> Watch moment</Link>
          </div>
        </article>;
      })}
      {kinds.some(kind => !book[kind]) && <div className="record-unwritten"><span>Still to be set</span><p>{kinds.filter(kind => !book[kind]).map(kind => recordLabels[kind]).join(' · ')}</p></div>}
    </div>}
    <section className="record-rates" aria-labelledby="record-rates-title"><h3 id="record-rates-title">More rivalry stats</h3>
      <div className="record-rate-table" role="table" aria-label="Rivalry win rates">
        <div role="row" className="record-rate-row"><span role="columnheader">Wins / games</span>{(['a', 'b'] as const).map(side => <strong role="columnheader" key={side}><Player rivalry={rivalry} side={side}/></strong>)}</div>
        {([['opener', 'After scoring first'], ['clutch', 'After reaching 9–9'], ['comeback', 'After trailing by 3+']] as const).map(([key, label]) => <div role="row" className="record-rate-row" key={key}><span role="rowheader">{label}</span>{(['a', 'b'] as const).map(side => { const [wins, total] = rates[side][key]; return <span role="cell" key={side}>{total ? <><strong>{Math.round(wins / total * 100)}%</strong> <small>({wins}/{total})</small></> : '—'}</span>; })}</div>)}
      </div>
    </section>
  </section>;
}
export function GameHighlightTags({ game, rivalry, selected }: { game: Game; rivalry: Rivalry; selected?: Moment }) {
  const moments = useMemo(() => {
    const { run, burst, response } = gameHighlights(game).moments;
    return [
      run && run.value >= 5 ? run : undefined,
      burst && burst.value >= 3 ? burst : undefined,
      response && response.value < 3000 ? response : undefined,
    ].filter((moment): moment is Moment => !!moment);
  }, [game]);
  if (!game.ended_at || !moments.length) return null;
  return <div className="game-highlight-tags" role="group" aria-label="Notable moments">
    {moments.map(moment => {
      const label = moment.kind === 'run' ? `${moment.value}-goal run`
        : moment.kind === 'burst' ? `${moment.value} goals in 30s`
        : `${recordValue(moment)} response`;
      return <Link key={moment.kind} to={momentLink(game, moment)} className={`game-highlight-tag ${selected?.kind === moment.kind ? 'is-selected' : ''}`}>
        <span>{playerName(rivalry, moment.side!)}</span>{" "}<strong>{label}</strong>
      </Link>;
    })}
  </div>;
}
