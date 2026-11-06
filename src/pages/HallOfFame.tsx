import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, Play, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog } from '../components/Dialog';
import { useStore } from '../lib/store';
import { rankedClassics, ratingLabel } from '../lib/hallOfFame';
import type { RankedClassic } from '../lib/hallOfFame';
import { clock } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import '../hall-of-fame.css';

/** Time-proportional steps, from kickoff through the actual final goal. */
export function PosterMomentum({ entry }: { entry: RankedClassic }) {
  const { scores, goals, totalMs } = entry.rating.highlights;
  const limit = Math.max(2, ...scores.map(s => Math.abs(s.a - s.b)));
  const x = (ms: number) => 12 + ms / Math.max(1, totalMs) * 616;
  const y = (lead: number) => 90 - lead / limit * 72;
  const path = 'M12 90 ' + goals.map((g, i) => `H${x(g.elapsed_ms)} V${y(scores[i + 1].a - scores[i + 1].b)}`).join(' ');
  const end = scores.at(-1)!;
  return <figure className="hall-momentum">
    <figcaption><span><i className="hall-side black"/><span className="hall-full-legend">{entry.rivalry.player_a} above</span><span className="hall-mobile-legend">Black ↑</span></span><span><i className="hall-side white"/><span className="hall-full-legend">{entry.rivalry.player_b} below</span><span className="hall-mobile-legend">White ↓</span></span></figcaption>
    <svg viewBox="0 0 640 180" role="img" aria-label={`Score lead over ${clock(totalMs)}; ${entry.rivalry.player_a} above the tied line, ${entry.rivalry.player_b} below. ${entry.rating.highlights.leadChanges} lead changes.`}>
      <path className="hall-trace-fill" d={`${path} V90 H12 Z`}/>
      <path className="hall-tie-line" d="M12 90H628"/>
      <path className="hall-trace" d={path}/>
      <circle cx={x(totalMs)} cy={y(end.a - end.b)} r="4" className="hall-trace-end"/>
    </svg>
    <div className="hall-axis"><span>0:00</span><span><span className="hall-axis-label">Final goal · </span>{clock(totalMs)}</span></div>
  </figure>;
}

function MatchPoster({ entry, rank, onRating }: { entry: RankedClassic; rank: number; onRating: () => void }) {
  const { game, rivalry, rating, captions } = entry;
  const final = rating.highlights.scores.at(-1)!;
  return <article className={`hall-poster${rank === 1 ? ' hall-feature hall-gold' : rank === 2 ? ' hall-silver' : rank === 3 ? ' hall-bronze' : ''}`} aria-label={`Rank ${rank}: ${rivalry.player_a} versus ${rivalry.player_b}`}>
    <header className="hall-poster-head">
      <span className="hall-rank">#{rank}</span>
      <div className="hall-date"><time dateTime={game.started_at}>{gameDate(game.started_at)}</time><span>{gameTime(game.started_at)}</span></div>
      <button className="hall-rating" onClick={onRating} aria-label={`Classic score ${ratingLabel(rating.total)} out of 100. View formula for rank ${rank}`}><strong>{ratingLabel(rating.total)}</strong><span>Classic score <small>/100</small></span></button>
    </header>
    <div className="hall-poster-match">
      <h2 className="hall-score"><Link to={`/game/${game.id}`} aria-label={`${rivalry.player_a} ${final.a}, ${rivalry.player_b} ${final.b}. View game`}>
        <span className="hall-contender"><span className="hall-player"><i className="hall-side black"/>{rivalry.player_a}</span><strong>{final.a}</strong></span>
        <span className="hall-score-divider" aria-hidden="true">–</span>
        <span className="hall-contender"><span className="hall-player"><i className="hall-side white"/>{rivalry.player_b}</span><strong>{final.b}</strong></span>
      </Link></h2>
      <PosterMomentum entry={entry}/>
    </div>
    <ul className="hall-captions">{captions.map(caption => <li key={caption}>{caption}</li>)}</ul>
    <footer className="hall-poster-footer">
      <Link to={`/rivalry/${rivalry.id}`} aria-label={`View rivalry: ${rivalry.player_a} versus ${rivalry.player_b}`}>Rivalry <ArrowUpRight size={15}/></Link>
      <Link className="hall-play" to={`/game/${game.id}?play=1#momentum`} aria-label={`Play replay of rank ${rank}: ${rivalry.player_a} versus ${rivalry.player_b}`}><Play size={15}/>Play replay</Link>
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
    <div className="hall-page-heading"><h1>Hall of Fame</h1><label className="hall-filter">Rivalry<select value={scope} onChange={e => { setScope(e.target.value); setRatingId(null); }}><option value="">All rivalries</option>{rivalries.map(r => <option key={r.id} value={r.id}>{r.player_a} vs {r.player_b}</option>)}</select></label></div>
    <p className="hall-intro">Top {topEntries.length} of {entries.length} ranked {entries.length === 1 ? 'game' : 'games'}. Tap a rating to see why.</p>
    {entries.length ? <div className="hall-gallery">{topEntries.map((entry, i) => <MatchPoster key={entry.game.id} entry={entry} rank={i + 1} onRating={() => setRatingId(entry.game.id)}/>)}</div> : <div className="empty-state"><Trophy size={32}/><h2>No ranked games yet</h2><p>Finish a first-to-10, win-by-two game at its first winning score to enter the rankings.</p><Link className="button primary" to="/">Go to rivalries</Link></div>}
    {selected && <RatingBreakdown entry={selected} onClose={() => setRatingId(null)}/>}
  </section>;
}
