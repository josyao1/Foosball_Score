import { RivalryOptions } from "../components/RivalryOptions";
import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, ArrowLeftRight, Award, ChevronDown, Flag, Pause, Play, Sparkles, Timer, Trophy, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog } from '../components/Dialog';
import { useStore } from '../lib/store';
import { rankedClassics, ratingLabel } from '../lib/hallOfFame';
import type { RankedClassic } from '../lib/hallOfFame';
import { clock } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import { useMomentumReplay } from '../hooks/useMomentumReplay';
import { GoalBall } from '../components/GoalBall';
import '../hall-of-fame.css';

/** Time-proportional steps, from kickoff through the actual final goal. */
export function PosterMomentum({ entry, position = null }: { entry: RankedClassic; position?: number | null }) {
  const { scores, goals, totalMs, moments } = entry.rating.highlights;
  const playhead = Math.min(totalMs, position ?? totalMs);
  const visible = goals.filter(goal => goal.elapsed_ms <= playhead);
  const current = scores[visible.length];
  const limit = Math.max(2, ...scores.map(s => Math.abs(s.a - s.b)));
  const x = (ms: number) => 12 + ms / Math.max(1, totalMs) * 616;
  const y = (lead: number) => 90 - lead / limit * 72;
  const path = 'M12 90 ' + visible.map((g, i) => `H${x(g.elapsed_ms)} V${y(scores[i + 1].a - scores[i + 1].b)}`).join(' ') + ` H${x(playhead)}`;
  const end = scores.at(-1)!;
  const comeback = moments.comeback && moments.comeback.value >= 2 ? moments.comeback : null;
  const low = comeback ? scores[comeback.start + 1] : null;
  const lowTime = comeback ? goals[comeback.start].elapsed_ms : 0;
  const showLow = !!low && playhead >= lowTime;
  const finished = playhead >= totalMs;
  const winner = end.a > end.b ? entry.rivalry.player_a : entry.rivalry.player_b;
  return <figure className="hall-momentum">
    <figcaption><span><i className="hall-side black"/><span className="hall-full-legend">{entry.rivalry.player_a} above</span><span className="hall-mobile-legend">Black ↑</span></span><span><i className="hall-side white"/><span className="hall-full-legend">{entry.rivalry.player_b} below</span><span className="hall-mobile-legend">White ↓</span></span></figcaption>
    <svg viewBox="0 0 640 180" role="img" aria-label={`${position===null?'Score lead':`Replay at ${clock(playhead)}`} over ${clock(totalMs)}; ${entry.rivalry.player_a} above the tied line, ${entry.rivalry.player_b} below. ${entry.rating.highlights.leadChanges} lead changes.`}>
      <path className="hall-trace-fill" d={`${path} V90 H12 Z`}/>
      <path className="hall-tie-line" d="M12 90H628"/>
      <path className="hall-trace" d={path}/>
      {showLow && <g className="hall-low-marker" transform={`translate(${x(lowTime)} ${y(low!.a - low!.b)})`}><title>Comeback low point: {low!.a}–{low!.b} at {clock(lowTime)}</title><circle r="7"/><path d="M-3 0h6M0 -3l-3 3 3 3"/></g>}
      {finished && <g className="hall-win-marker" transform={`translate(${x(totalMs)} ${y(end.a - end.b)})`}><title>{winner} wins {end.a}–{end.b} at {clock(totalMs)}</title><circle r="5"/><path d="M0 -5v-11l-14 4 14 5"/></g>}
      {position !== null && !finished && <g className="hall-replay-cursor" transform={`translate(${x(playhead)} ${y(current.a - current.b)})`} aria-hidden="true"><circle r="14"/><g transform="translate(-12 -12)"><GoalBall size={24} flags={visible.at(-1)?.flags}/></g></g>}
    </svg>
    <div className="hall-axis"><span>{position === null ? '0:00' : <time>{clock(playhead)}</time>}</span><span><span className="hall-axis-label">Final goal · </span>{clock(totalMs)}</span></div>
    <div className="hall-marker-key">
      {low && <span className="hall-low-key" style={{visibility:showLow?'visible':'hidden'}}><Undo2 size={12} aria-hidden="true"/>Low point · {low.a}–{low.b}</span>}
      <span className="hall-win-key" style={{visibility:finished?'visible':'hidden'}}><Flag size={12} aria-hidden="true"/>Winner · {end.a}–{end.b}</span>
    </div>
  </figure>;
}

function PosterCaption({ caption }: { caption: string }) {
  const [kind, Icon] = caption === 'Both held match point' ? ['match-point', Flag] as const
    : caption.includes('recovered from') ? ['comeback', Undo2] as const
    : caption.endsWith('lead changes') ? ['lead-changes', ArrowLeftRight] as const
    : caption.endsWith('special goals') ? ['special', Sparkles] as const
    : ['duration', Timer] as const;
  return <li className={`hall-moment-pill hall-moment-${kind}`}><Icon size={16} aria-hidden="true"/><span>{caption}</span></li>;
}

function MatchPoster({ entry, rank, onRating }: { entry: RankedClassic; rank: number; onRating: () => void }) {
  const { game, rivalry, rating, captions } = entry;
  const replay = useMomentumReplay(rating.highlights.totalMs);
  const count = replay.position === null ? rating.highlights.goals.length : rating.highlights.goals.filter(goal=>goal.elapsed_ms <= replay.position!).length;
  const displayed = rating.highlights.scores[count];
  return <article className={`hall-poster${rank === 1 ? ' hall-feature hall-gold' : rank === 2 ? ' hall-silver' : rank === 3 ? ' hall-bronze' : ''}`} aria-label={`Rank ${rank}: ${rivalry.player_a} versus ${rivalry.player_b}`}>
    <header className="hall-poster-head">
      <span className="hall-rank">{rank<=3 && <Award className="hall-medal" aria-label={`${rank===1?'Gold':rank===2?'Silver':'Bronze'} medal`}/>}#{rank}</span>
      <div className="hall-date"><time dateTime={game.started_at}>{gameDate(game.started_at)}</time><span>{gameTime(game.started_at)}</span></div>
      <button className="hall-rating" onClick={onRating} aria-label={`Classic score ${ratingLabel(rating.total)} out of 100. View formula for rank ${rank}`}><strong>{ratingLabel(rating.total)}</strong><span>Classic score <small>/100</small></span></button>
    </header>
    <div className="hall-poster-match">
      <h2 className="hall-score"><Link to={`/game/${game.id}`} aria-label={`${rivalry.player_a} ${displayed.a}, ${rivalry.player_b} ${displayed.b}. View game`}>
        <span className="hall-contender"><span className="hall-player"><i className="hall-side black"/>{rivalry.player_a}</span><strong>{displayed.a}</strong></span>
        <span className="hall-score-divider" aria-hidden="true">–</span>
        <span className="hall-contender"><span className="hall-player"><i className="hall-side white"/>{rivalry.player_b}</span><strong>{displayed.b}</strong></span>
      </Link></h2>
      <PosterMomentum entry={entry} position={replay.position}/>
    </div>
    <ul className="hall-captions" aria-label="Game highlights">{captions.map(caption => <PosterCaption key={caption} caption={caption}/>)}</ul>
    <footer className="hall-poster-footer">
      <Link to={`/rivalry/${rivalry.id}`} aria-label={`View rivalry: ${rivalry.player_a} versus ${rivalry.player_b}`}>Rivalry <ArrowUpRight size={15}/></Link>
      <div className="hall-replay-controls"><span className="hall-replay-speed">16×</span><button type="button" className="hall-play" onClick={replay.playing?replay.pause:replay.play} aria-label={`${replay.playing?'Pause':'Play'} replay of rank ${rank}: ${rivalry.player_a} versus ${rivalry.player_b}`}>{replay.playing?<Pause size={15}/>:<Play size={15}/>} {replay.playing?'Pause replay':'Play replay'}</button></div>
    </footer>
  </article>;
}

function RatingBreakdown({ entry, onClose }: { entry: RankedClassic; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const id = useId();
  return <Dialog className="hall-rating-dialog" title="Classic score" onClose={onClose} closeOnBackdrop>
    <div className="hall-breakdown">
      <div className="hall-receipt-summary">
        <p className="hall-breakdown-total"><strong>{ratingLabel(entry.rating.total)}</strong><span>/ 100</span></p>
        <p className="hall-receipt-match">{entry.rivalry.player_a} vs {entry.rivalry.player_b}<span>{gameDate(entry.game.started_at)}</span></p>
      </div>
      <div className="hall-factor-list">
        {entry.rating.factors.map((factor,i)=>{
          const open=expanded===factor.label, bonus=Math.max(0,factor.points-factor.max);
          return <div className={`hall-factor${bonus>0?' hall-factor-bonus':''}`} key={factor.label}>
            <button type="button" aria-expanded={open} aria-controls={`${id}-factor-${i}`} onClick={()=>setExpanded(open?null:factor.label)}>
              <span className="hall-factor-label">{factor.label}</span>
              <span className="hall-factor-track" aria-hidden="true"><span style={{width:`${Math.min(100,Math.max(0,factor.points/factor.max*100))}%`}}/></span>
              <span className="hall-factor-score"><strong>{ratingLabel(factor.points)}</strong><small> / {factor.max}</small></span>
              <span className="hall-factor-extra">{bonus>0&&<span aria-label={`${ratingLabel(bonus)} bonus points`}>+{ratingLabel(bonus)}</span>}</span>
              <ChevronDown size={13} className={open?'is-open':''} aria-hidden="true"/>
            </button>
            <div id={`${id}-factor-${i}`} hidden={!open} className="hall-factor-detail">{factor.detail}</div>
          </div>;
        })}
      </div>
      <details className="hall-method-note"><summary>How the score works</summary><p>100 is a benchmark, not a ceiling. Gold marks bonus points above a category’s benchmark. Same formula for every rivalry. First to 10, win by 2; games must finish at their first winning score. Length stops at the final goal. Values are rounded for display; rankings use the unrounded total, then the earlier game.</p></details>
    </div>
  </Dialog>;
}

export function HallOfFame() {
  const { games, rivalries } = useStore();
  const [scope, setScope] = useState('');
  const entries = useMemo(() => rankedClassics(scope ? games.filter(game => game.rivalry_id === scope) : games, rivalries), [games, rivalries, scope]);
  const topEntries = entries.slice(0, 10);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const selected = entries.find(entry => entry.game.id === ratingId);
  return <section className="hall-page">
    <div className="hall-page-heading"><h1>Hall of Fame</h1><label className="hall-filter">Rivalry<select value={scope} onChange={e => { setScope(e.target.value); setRatingId(null); }}><RivalryOptions rivalries={rivalries} games={games}/></select></label></div>
    <p className="hall-intro">Top {topEntries.length} of {entries.length} ranked {entries.length === 1 ? 'game' : 'games'}. Tap a rating to see why.</p>
    {entries.length ? <div className="hall-gallery">{topEntries.map((entry, i) => <MatchPoster key={`${scope}:${entry.game.id}:${entry.game.revision}`} entry={entry} rank={i + 1} onRating={() => setRatingId(entry.game.id)}/>)}</div> : <div className="empty-state"><Trophy size={32}/><h2>No ranked games yet</h2><p>Finish a first-to-10, win-by-two game at its first winning score to enter the rankings.</p><Link className="button primary" to="/">Go to rivalries</Link></div>}
    {selected && <RatingBreakdown entry={selected} onClose={() => setRatingId(null)}/>}
  </section>;
}
