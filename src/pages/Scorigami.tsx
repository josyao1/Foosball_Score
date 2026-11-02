import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../lib/store';
import { scorigami, scoreKey } from '../lib/scorigami';
import { score } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import type { Game, Rivalry } from '../lib/types';
import '../scorigami.css';
import { ScorePopover } from '../components/ScorePopover';

const PAGE = 5;
const REGULAR_SCORES = Array.from({ length: 9 }, (_, low) => [10, low] as const);

function MatchLink({ game, rivalry }: { game: Game; rivalry?: Rivalry }) {
  const s = score(game.goals);
  return <Link className="sc-match" to={`/game/${game.id}`} aria-label={`${rivalry?.player_a ?? 'Black'} ${s.a}, ${rivalry?.player_b ?? 'White'} ${s.b}. ${gameDate(game.started_at)}, ${gameTime(game.started_at)}. View game`}>
    <span className="sc-match-players"><span>{rivalry?.player_a ?? 'Black'} <b>{s.a}</b></span><span>{rivalry?.player_b ?? 'White'} <b>{s.b}</b></span></span>
    <span className="sc-match-date">{gameDate(game.started_at)} · {gameTime(game.started_at)} <ArrowUpRight size={14} aria-hidden="true"/></span>
  </Link>;
}

export function Scorigami() {
  const { games, rivalries } = useStore();
  const [scope, setScope] = useState('');
  const [selection, setSelection] = useState<readonly [number, number]>([10, 0]);
  const [overtimePage, setOvertimePage] = useState(0);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const charts = useRef<HTMLDivElement>(null);
  const [popupAnchor, setPopupAnchor] = useState<HTMLButtonElement | null>(null);
  const closePopup = useCallback(() => setPopupAnchor(null), []);
  const data = useMemo(() => scorigami(games, scope), [games, scope]);
  const rivalryMap = useMemo(() => new Map(rivalries.map(r => [r.id, r])), [rivalries]);
  const lastPage = Math.max(0, Math.ceil((data.maxScore - 10) / PAGE) - 1);
  const page = Math.min(overtimePage, lastPage);
  const overtimeScores = Array.from({ length: Math.min(PAGE, data.maxScore - 10 - page * PAGE) }, (_, i) => {
    const high = 11 + page * PAGE + i;
    return [high, high - 2] as const;
  });
  const [selectedHigh, selectedLow] = selection;
  const selectedKey = scoreKey(selectedHigh, selectedLow), selected = data.buckets.get(selectedKey);
  const matches = selected?.games ?? [];
  const count = matches.length;
  const first = matches.at(-1);
  const peak = data.common?.games.length ?? 1;
  const regularCount = data.completed.filter(g => { const s = score(g.goals); return Math.max(s.a, s.b) === 10; }).length;
  const overtimeCount = data.completed.length - regularCount;
  const select = (high: number, low: number, anchor: HTMLButtonElement) => {
    setSelection([high, low]); setShowAll(false); setPopupAnchor(anchor);
  };
  const revealCommon = () => {
    if (!data.common) return;
    const {high, key} = data.common;
    setOvertimePage(Math.max(0, Math.floor((high - 11) / PAGE)));
    setRevealKey(key);
  };
  useLayoutEffect(() => {
    if (!revealKey) return;
    const anchor = charts.current?.querySelector<HTMLButtonElement>(`button[data-score="${revealKey}"]`);
    if (anchor) {
      const [high, low] = revealKey.split('-').map(Number);
      setSelection([high, low]); setShowAll(false); setPopupAnchor(anchor);
    }
    setRevealKey(null);
  }, [revealKey, page]);

  useLayoutEffect(() => {
    if (popupAnchor && !popupAnchor.isConnected) {
      closePopup();
      charts.current?.querySelector<HTMLButtonElement>('.sc-bar-button')?.focus({ preventScroll: true });
    }
  }, [data, page, popupAnchor, closePopup]);

  const bars = (scores: readonly (readonly [number, number])[], regular: boolean) => <div
    className={`sc-bars ${regular ? 'sc-bars--regular' : 'sc-bars--overtime'}`}
    style={{ '--bar-columns': scores.length } as CSSProperties}>
    {scores.map(([high, low]) => {
      const key = scoreKey(high, low), n = data.buckets.get(key)?.games.length ?? 0;
      const open = popupAnchor?.dataset.score === key;
      return <button key={key} type="button" data-score={key} className="sc-bar-button"
        style={{ '--bar-share': `${n / peak * 100}%` } as CSSProperties}
        aria-label={`${high}–${low}: ${n} ${n === 1 ? 'game' : 'games'}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'sc-score-popup' : undefined}
        onClick={e => select(high, low, e.currentTarget)}>
        <span className="sc-bar-plot" aria-hidden="true"><span className={`sc-bar-fill${n ? '' : ' sc-bar-fill--empty'}`}><span className="sc-bar-count">{n || '–'}</span></span></span>
        <span className="sc-bar-label" aria-hidden="true"><span className={regular ? 'sc-score-prefix' : undefined}>{high}–</span>{low}</span>
      </button>;
    })}
  </div>;
  const sectionCount = (n: number) => <span className="sc-section-count"><strong>{n}</strong> {n === 1 ? 'game' : 'games'}{data.completed.length > 0 && <span> · {Math.round(n / data.completed.length * 100)}%</span>}</span>;

  return <div className="scorigami-page">
    <header className="sc-heading"><div><h1>Scorigami</h1><p>How your games finish.</p></div><label className="sc-filter">Rivalry<select value={scope} onChange={e => { setScope(e.target.value); setOvertimePage(0); setRevealKey(null); setShowAll(false); closePopup(); }}><option value="">All rivalries</option>{rivalries.map(r => <option key={r.id} value={r.id}>{r.player_a} vs {r.player_b}</option>)}</select></label></header>
    <div className="sc-summary"><span><strong>{data.buckets.size}</strong> different scores</span><span><strong>{data.completed.length}</strong> finished games</span>{data.common && <button type="button" onClick={revealCommon}>Most common <strong>{data.common.high}–{data.common.low}</strong><span>{data.common.games.length}×</span></button>}</div>
    <div ref={charts} className={`sc-distributions${overtimeCount ? ' sc-distributions--paired' : ''}`}>
      <section className="sc-distribution sc-regular" aria-labelledby="sc-regular-title">
        <header className="sc-section-heading"><h2 id="sc-regular-title">Regular finishes</h2>{sectionCount(regularCount)}</header>
        <p className="sc-section-note">Winner scored 10<span className="sc-phone-axis"> · Opponent’s score below</span></p>
        {bars(REGULAR_SCORES, true)}
        <div className="sc-chart-caption"><span>Blowout</span><span>Close game</span></div>
      </section>
      <section className="sc-distribution sc-overtime" aria-labelledby="sc-overtime-title">
        <header className="sc-section-heading"><h2 id="sc-overtime-title">Overtime</h2>{sectionCount(overtimeCount)}</header>
        {overtimeCount ? <><p className="sc-section-note">Past 10, decided by two</p>{bars(overtimeScores, false)}
          {lastPage > 0 ? <div className="sc-overtime-pages"><button type="button" aria-label="Previous overtime scores" disabled={page === 0} onClick={() => { closePopup(); setOvertimePage(page - 1); }}><ChevronLeft size={18}/></button><span>{overtimeScores[0][0]}–{overtimeScores.at(-1)![0]} winning score</span><button type="button" aria-label="Next overtime scores" disabled={page === lastPage} onClick={() => { closePopup(); setOvertimePage(page + 1); }}><ChevronRight size={18}/></button></div> : <p className="sc-overtime-caption">Final score · same scale as regular finishes</p>}
        </> : <p className="sc-empty">No overtime finishes yet.</p>}
      </section>
    </div>
    {!data.completed.length && <p className="sc-empty">Finish a game and its final score will appear here.</p>}
    <p className="sc-caption">Bar height = game count. Tap a score for details. Standard finishes only.</p>
    {popupAnchor && <ScorePopover anchor={popupAnchor} score={`${selectedHigh}–${selectedLow}`} count={count} onClose={closePopup}>
      {count ? <><p className="sc-frequency">{Math.round(count / data.completed.length * 100)}% of finished games</p><span className="sc-popover-latest">Latest game</span><MatchLink game={matches[0]} rivalry={rivalryMap.get(matches[0].rivalry_id)}/>{first && <p className="sc-first">First recorded {gameDate(first.ended_at!)}</p>}
        {count > 1 && <details className="sc-history"><summary>Previous games ({count - 1})</summary><div className="sc-previous">{(showAll ? matches.slice(1) : matches.slice(1, 4)).map(game => <MatchLink key={game.id} game={game} rivalry={rivalryMap.get(game.rivalry_id)}/>)}</div>{count > 4 && <button className="text-button sc-more" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${count} games`}</button>}</details>}
      </> : <p className="sc-empty">This score hasn't happened yet.</p>}
    </ScorePopover>}
    <p className="sc-credit">Inspired by <a href="https://nflscorigami.com/" target="_blank" rel="noreferrer">NFL Scorigami</a>.</p>
  </div>;
}
