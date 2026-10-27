import { useMemo } from "react";
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { gameDate, gameTime } from '../lib/time';
import { gameHighlights, gameFinalScore, momentScore, recordBook, recordLabels, recordValue } from '../lib/records';
import type { Moment, RecordKind } from '../lib/records';
import { playerName } from '../lib/types';
import type { Game, Rivalry, Side } from '../lib/types';
import '../records.css';

const kinds: RecordKind[] = ['run', 'burst', 'quickest', 'comeback', 'triple', 'response', 'leadChanges'];
const explanations: Record<RecordKind, string> = {
  run: 'Consecutive points without an answer.', burst: 'Most points in a rolling 30-second window.',
  quickest: 'Start to final goal. First to 10, win by 2; no early finishes or goals after the winning score.',
  comeback: 'Largest deficit overcome to win.', triple: 'Time from the first to third point; opponent goals can occur between them.',
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
  return <section className="record-book" aria-labelledby="record-book-title">
    <div className="section-heading"><div><h2 id="record-book-title">Record book</h2><p>From {completed.length} finished {completed.length === 1 ? 'game' : 'games'}. Open a record to see the moment.</p></div></div>
    {!Object.keys(book).length ? <p className="record-empty">Finish a game to start the record book.</p> : <div className="record-ledger">
      {kinds.map(kind => {
        const entry = book[kind];
        if (!entry) return <div key={kind} className="record-row record-unset"><div><h3>{recordLabels[kind]}</h3><p>{explanations[kind]}</p></div><span>Not set yet</span></div>;
        const { game, moment, ties } = entry;
        return <Link key={kind} to={momentLink(game, moment)} className="record-row" aria-label={`${recordLabels[kind]}: ${recordValue(moment)}. ${moment.side ? playerName(rivalry, moment.side) : `${rivalry.player_a} vs ${rivalry.player_b}`}. ${gameDate(game.started_at)}, ${gameTime(game.started_at)}. ${ties ? `Matched in ${ties} other games. ` : ""}View game`}>
          <div className="record-label"><h3>{recordLabels[kind]}</h3>{moment.side ? <Player rivalry={rivalry} side={moment.side}/> : <span>{rivalry.player_a} vs {rivalry.player_b}</span>}<p>{explanations[kind]}</p></div>
          <div className="record-number"><strong>{recordValue(moment)}</strong><Sequence game={game} moment={moment}/>{ties > 0 && <small>Matched in {ties} other {ties === 1 ? 'game' : 'games'}</small>}</div>
          <div className="record-source"><span>{gameDate(game.started_at)}</span><small>{gameTime(game.started_at)} · {gameFinalScore(game)}</small><span className="record-open">View game <ArrowUpRight size={15}/></span></div>
        </Link>;
      })}
    </div>}
    <details className="record-rates"><summary>More rivalry stats</summary>
      <div className="record-rate-table" role="table" aria-label="Rivalry win rates">
        <div role="row" className="record-rate-row"><span role="columnheader">Wins / games</span>{(['a', 'b'] as const).map(side => <strong role="columnheader" key={side}><Player rivalry={rivalry} side={side}/></strong>)}</div>
        {([['opener', 'After scoring first'], ['clutch', 'After reaching 9–9'], ['comeback', 'After trailing by 3+']] as const).map(([key, label]) => <div role="row" className="record-rate-row" key={key}><span role="rowheader">{label}</span>{(['a', 'b'] as const).map(side => { const [wins, total] = rates[side][key]; return <span role="cell" key={side}>{total ? <><strong>{Math.round(wins / total * 100)}%</strong> <small>({wins}/{total})</small></> : '—'}</span>; })}</div>)}
      </div><p className="record-note">Finished games only. Draws count as games, but not wins.</p>
    </details>
    <details className="record-rules"><summary>How records are counted</summary><p>Runs and bursts count scoreboard points, including opponent own goals. Timing uses logged goal timestamps, not the time you press Finish. The clock includes any breaks. Ties show the earliest game; corrections and deletions recalculate every record.</p></details>
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
