import { RivalryOptions } from "../components/RivalryOptions";
import { TabUnderline } from "../components/TabUnderline";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../lib/store';
import { scorigami, scoreKey, scorePlayerStats } from '../lib/scorigami';
import { score, clock, playingTime } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import type { Game, Rivalry } from '../lib/types';
import '../scorigami.css';
import { ScorePopover } from '../components/ScorePopover';
import { ScorigamiDiscoveries } from '../components/ScorigamiDiscoveries';

const PAGE = 5;
const REGULAR_SCORES = Array.from({ length: 9 }, (_, low) => [10, low] as const);

function MatchLink({ game, rivalry }: { game: Game; rivalry?: Rivalry }) {
  const s = score(game.goals);
  return <Link className="sc-match" to={`/game/${game.id}`} aria-label={`${rivalry?.player_a ?? 'Black'} ${s.a}, ${rivalry?.player_b ?? 'White'} ${s.b}. ${gameDate(game.started_at)}, ${gameTime(game.started_at)}. Game time ${clock(playingTime([game]))}. View game`}>
    <span className="sc-match-players"><span>{rivalry?.player_a ?? 'Black'} <b>{s.a}</b></span><span>{rivalry?.player_b ?? 'White'} <b>{s.b}</b></span></span>
    <span className="sc-match-duration">Game time {clock(playingTime([game]))}</span>
    <span className="sc-match-date">{gameDate(game.started_at)} · {gameTime(game.started_at)} <ArrowUpRight size={14} aria-hidden="true"/></span>
  </Link>;
}

export function Scorigami() {
  const { games, rivalries } = useStore();
  const [scope, setScope] = useState('');
  const [detailTab, setDetailTab] = useState<'players' | 'games'>('players');
  const [selection, setSelection] = useState<readonly [number, number]>([10, 0]);
  const [overtimePage, setOvertimePage] = useState(0);
  const [revealKey, setRevealKey] = useState<string | null>(null);
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
  const players = scorePlayerStats(matches, rivalries);
  const peak = data.common?.games.length ?? 1;
  const regularCount = data.completed.filter(g => { const s = score(g.goals); return Math.max(s.a, s.b) === 10; }).length;
  const overtimeCount = data.completed.length - regularCount;
  const select = (high: number, low: number, anchor: HTMLButtonElement) => {
    setSelection([high, low]); setDetailTab('players'); setPopupAnchor(anchor);
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
      setSelection([high, low]); setDetailTab('players'); setPopupAnchor(anchor);
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
    <header className="sc-heading"><div><h1>Scorigami</h1><p>How your games finish.</p></div><label className="sc-filter">Rivalry<select value={scope} onChange={e => { setScope(e.target.value); setOvertimePage(0); setRevealKey(null); closePopup(); }}><RivalryOptions rivalries={rivalries} games={games}/></select></label></header>
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
    <ScorigamiDiscoveries key={scope} games={data.completed} buckets={data.buckets} maxScore={data.maxScore} rivalries={rivalries}/>
    {popupAnchor && <ScorePopover key={selectedKey} anchor={popupAnchor} score={`${selectedHigh}–${selectedLow}`} count={count} share={data.completed.length ? Math.round(count / data.completed.length * 100) : 0} onClose={closePopup}>
      {count ? <>
        <div className="sc-detail-tabs tab-underline-row" role="tablist" aria-label="Score details" onKeyDown={e=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
          e.preventDefault();
          const next=e.key==='Home'?'players':e.key==='End'?'games':detailTab==='players'?'games':'players';
          setDetailTab(next);
          e.currentTarget.querySelector<HTMLButtonElement>(`#sc-tab-${next}`)?.focus();
        }}>
          <button type="button" role="tab" id="sc-tab-players" aria-controls="sc-panel-players" aria-selected={detailTab==='players'} tabIndex={detailTab==='players'?0:-1} onClick={()=>setDetailTab('players')}>Players</button>
          <button type="button" role="tab" id="sc-tab-games" aria-controls="sc-panel-games" aria-selected={detailTab==='games'} tabIndex={detailTab==='games'?0:-1} onClick={()=>setDetailTab('games')}>First / latest</button>
          <TabUnderline selection={detailTab} />
        </div>
        <div id={`sc-panel-${detailTab}`} role="tabpanel" aria-labelledby={`sc-tab-${detailTab}`} tabIndex={0} className="sc-detail-content">
          {detailTab==='players' ? <section className="sc-player-rates" aria-label="Player win rates at this score">
            <div className="sc-rate-labels"><span>Player</span><span>Win rate</span><span>W–L</span></div>
            <ul>{players.map(player=><li key={player.name.toLowerCase()}>
              <span className="sc-rate-name">{player.name}</span>
              <span className="sc-rate-value"><span className="sc-rate-track" aria-hidden="true"><span style={{width:`${player.percentage}%`}}/></span><strong>{player.percentage}%</strong></span>
              <small>{player.wins}–{player.played-player.wins}</small>
            </li>)}</ul>
          </section> : <div className="sc-ticket-games">
            <span className="sc-popover-latest">{count === 1 ? 'First & latest game' : 'Latest game'}</span>
            <MatchLink game={matches[0]} rivalry={rivalryMap.get(matches[0].rivalry_id)}/>
            {count > 1 && first && <><span className="sc-popover-latest">First game</span><MatchLink game={first} rivalry={rivalryMap.get(first.rivalry_id)}/></>}
          </div>}
        </div>
      </> : <p className="sc-empty">This score hasn't happened yet.</p>}
    </ScorePopover>}
    <p className="sc-credit">Inspired by <a href="https://nflscorigami.com/" target="_blank" rel="noreferrer">NFL Scorigami</a>.</p>
  </div>;
}
