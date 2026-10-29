import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { Pause, Play } from 'lucide-react';
import { momentWindow, recordLabels } from '../lib/records';
import type { Moment } from '../lib/records';
import { clock, creditedSide, duration, gameStats, orderedGoals } from '../lib/stats';
import { playerName } from '../lib/types';
import type { Game, Rivalry } from '../lib/types';
import { useMomentumReplay } from '../hooks/useMomentumReplay';
import { GoalBall } from './GoalBall';
import '../momentum.css';

const LEFT = 54, RIGHT = 690, TOP = 14, CENTER = 94, BOTTOM = 174;
const exactClock = (ms: number) => `${clock(ms)}.${String(Math.floor(ms) % 1000).padStart(3, '0')}`;
const PARTICLES = [[0,-28],[21,-21],[29,0],[21,21],[0,28],[-21,21],[-29,0],[-21,-21]];
type Props = { game: Game; rivalry: Rivalry; highlight?: Moment };

export function MomentumChart(props: Props) {
  // A changed score/timestamp invalidates the old replay, including edits from another phone.
  const version = JSON.stringify([props.game.id, props.game.goals, props.highlight]);
  return <MomentumView key={version} {...props}/>;
}

/** Every step is a recorded goal; the horizontal axis is actual elapsed game time. */
function MomentumView({ game, rivalry, highlight }: Props) {
  const id = useId().replace(/:/g, '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ index: number; key: number; burst: boolean } | null>(null);
  const previousGoalCount = useRef(0);
  const celebrationKey = useRef(0);
  const lastCelebrationAt = useRef(-Infinity);
  const points = useRef<(SVGGElement | null)[]>([]);
  const pendingFocus = useRef<number | null>(null);
  const goals = useMemo(() => orderedGoals(game.goals), [game.goals]);
  const { momentum } = useMemo(() => gameStats(game), [game]);
  const highlightedWindow = highlight ? momentWindow(game, highlight) : null;
  const limit = Math.max(2, ...momentum.map(p => Math.abs(p.lead)));
  // Finish at the last goal, not the later tap on the Finish game button.
  const total = Math.max(1, momentum[momentum.length - 1].elapsed);
  const replay = useMomentumReplay(total);
  const replaying = replay.position !== null;
  const chartTotal = replaying ? total : Math.max(total, duration(game));
  const playhead = replay.position ?? chartTotal;
  const chosenIndex = goals.findIndex(g => g.id === selectedId);
  // Manual stepping can inspect separate goals sharing one timestamp. Playing or
  // scrubbing still includes every goal at or before the current game time.
  const inspectingGoal = replaying && !replay.playing && chosenIndex >= 0 && goals[chosenIndex].elapsed_ms === playhead;
  const visibleCount = inspectingGoal ? chosenIndex + 1 : goals.filter(g => g.elapsed_ms <= playhead).length;
  const current = momentum[visibleCount];
  const x = (ms: number) => LEFT + (ms / chartTotal) * (RIGHT - LEFT);
  const y = (lead: number) => CENTER - (lead / limit) * (CENTER - TOP);
  const steps = momentum.slice(0, visibleCount + 1).map((p, i) => i ? `H${x(p.elapsed)}V${y(p.lead)}` : `M${LEFT},${CENTER}`).join(' ') + ` H${x(playhead)}`;
  const area = `${steps} V${CENTER} H${LEFT} Z`;
  const selectedIndex = replaying ? visibleCount - 1 : Math.max(0, selectedId ? goals.findIndex(g => g.id === selectedId) : highlight?.end ?? goals.length - 1);
  const goal = goals[selectedIndex];
  const selected = momentum[selectedIndex + 1];
  useEffect(() => {
    const scored = visibleCount > previousGoalCount.current && replay.advancedByPlayback;
    previousGoalCount.current = visibleCount;
    if (!scored) { setCelebration(null); return; }
    // Throttle particles only. Every goal gets a fresh name/time alert and deadline.
    const now = performance.now();
    const burst = now - lastCelebrationAt.current >= 500;
    if (burst) lastCelebrationAt.current = now;
    setCelebration({index: visibleCount - 1, key: ++celebrationKey.current, burst});
    const timeout = window.setTimeout(() => setCelebration(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [visibleCount, replay.advancedByPlayback]);
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    points.current[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  }, [visibleCount, selectedId]);
  const leadLabel = current.lead === 0 ? 'Tied' : `${playerName(rivalry, current.lead > 0 ? 'a' : 'b')} leads by ${Math.abs(current.lead)}`;
  const choose = (index: number, focus = false) => {
    const bounded = Math.max(0, Math.min(goals.length - 1, index));
    if (!goals[bounded]) return;
    setSelectedId(goals[bounded].id);
    if (replaying) replay.seek(goals[bounded].elapsed_ms);
    if (focus) {
      if (points.current[bounded]) points.current[bounded]?.focus();
      else pendingFocus.current = bounded;
    }
  };
  const seek = (ms: number) => { setSelectedId(null); replay.seek(ms); };
  const onKey = (event: KeyboardEvent<SVGGElement>, index: number) => {
    const target = event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowRight' ? index + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? goals.length - 1 : null;
    if (target !== null) { event.preventDefault(); choose(target, true); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(index); }
  };
  const selectPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!goals.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const plotX = (event.clientX - rect.left) / rect.width * 720;
    if (replaying) {
      seek((plotX - LEFT) / (RIGHT - LEFT) * total);
      return;
    }
    const plotY = (event.clientY - rect.top) / rect.height * 220;
    let nearest = 0, distance = Infinity;
    momentum.slice(1).forEach((p, index) => {
      const next = Math.abs(x(p.elapsed) - plotX) + Math.abs(y(p.lead) - plotY) * 0.15;
      if (next < distance) { distance = next; nearest = index; }
    });
    choose(nearest);
  };

  return <section id="momentum" style={{ scrollMarginTop: 100 }} className="momentum-report" aria-labelledby={`${id}-heading`}>
    <header className="momentum-heading">
      <div><div className="momentum-title"><h2 id={`${id}-heading`}>Momentum</h2>
        {!!goals.length && <span className="momentum-header-controls"><button className="momentum-play" type="button" aria-label={replay.playing ? 'Pause replay' : 'Play replay'} title={replay.playing ? 'Pause' : `Play at ${replay.speed}×`} onClick={replay.playing ? replay.pause : () => { setSelectedId(null); replay.play(); }}>
          <span>{replay.playing ? <Pause size={13} aria-hidden="true"/> : <Play size={13} aria-hidden="true"/>}</span>
        </button><button className="momentum-speed-toggle" type="button" aria-label={`Replay speed ${replay.speed}×. Click to change speed`} title="Cycle speed: 2×, 4×, 8×, 16×" onClick={replay.cycleSpeed}>{replay.speed}×</button></span>}
      </div><p>{replaying ? leadLabel : 'Goal lead over time'}</p></div>
      <span className="momentum-result"><small>{replaying ? replay.playing ? 'Replaying' : playhead >= total ? 'Replay complete' : 'Paused' : game.ended_at ? 'Final' : 'Current'}</small><strong>{current.a} – {current.b}</strong><time>{clock(playhead)}</time></span>
    </header>
    {highlight && !replaying && <p className="record-focus-note">{recordLabels[highlight.kind]} · {clock(highlightedWindow?.startMs ?? 0)}–{clock(highlightedWindow?.endMs ?? 0)}. Shaded below.</p>}
    <div className="momentum-player"><i className="momentum-kit black" aria-hidden="true"/><strong>{rivalry.player_a}</strong><span>Black · leads above</span></div>
    {!goals.length ? <div className="momentum-empty"><strong>Tied · 0 – 0</strong><p>The first goal will start the momentum chart.</p></div> : <>
      <div className="momentum-visually-hidden">Goal difference</div>
      <div className="momentum-plot-wrap">
        <svg className="momentum-plot" viewBox="0 0 720 220" preserveAspectRatio="none" aria-labelledby={`${id}-heading ${id}-help`} onPointerDown={selectPointer} onPointerMove={e => { if (!replaying && (e.pointerType === 'mouse' || e.buttons)) selectPointer(e); }}>
          <defs><clipPath id={`${id}-black`}><rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={CENTER - TOP}/></clipPath><clipPath id={`${id}-white`}><rect x={LEFT} y={CENTER} width={RIGHT - LEFT} height={BOTTOM - CENTER}/></clipPath></defs>
          <rect className="momentum-plot-bg" x={LEFT} y={TOP} width={RIGHT - LEFT} height={BOTTOM - TOP}/>
          {[0, .25, .5, .75, 1].map(fraction => <g key={fraction} className="momentum-time-grid"><line x1={x(chartTotal * fraction)} x2={x(chartTotal * fraction)} y1={TOP} y2={BOTTOM}/></g>)}
          {[-limit, 0, limit].map(lead => <g key={lead} className={`momentum-lead-grid ${lead === 0 ? 'is-tied' : ''}`}><line x1={LEFT} x2={RIGHT} y1={y(lead)} y2={y(lead)}/></g>)}
          <path d={area} className="momentum-area-black" clipPath={`url(#${id}-black)`}/><path d={area} className="momentum-area-white" clipPath={`url(#${id}-white)`}/>
          {highlightedWindow && !replaying && <rect className="momentum-record-window" x={x(highlightedWindow.startMs)} y={TOP} width={Math.max(3, x(highlightedWindow.endMs) - x(highlightedWindow.startMs))} height={BOTTOM - TOP}/>}
          <path d={steps} className="momentum-step-outline"/><path d={steps} className="momentum-step"/>
          <line className="momentum-selection-line" x1={x(replaying ? playhead : selected.elapsed)} x2={x(replaying ? playhead : selected.elapsed)} y1={TOP} y2={BOTTOM}/>
          {goals.slice(0, visibleCount).map((g, index) => {
            const p = momentum[index + 1];
            const label = `Goal ${index + 1}, ${exactClock(g.elapsed_ms)}, ${playerName(rivalry, creditedSide(g))} scores, ${p.a} to ${p.b}`;
            return <g key={g.id} ref={el => { points.current[index] = el; }} role="button" tabIndex={index === selectedIndex ? 0 : -1} aria-label={label} aria-pressed={index === selectedIndex} className={`momentum-point ${index === selectedIndex ? 'selected' : ''}`} onFocus={() => { if (!replaying) choose(index); }} onKeyDown={e => onKey(e, index)} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); choose(index); }}><title>{label}</title><circle className="momentum-point-target" cx={x(p.elapsed)} cy={y(p.lead)} r="14"/><circle className="momentum-point-dot" cx={x(p.elapsed)} cy={y(p.lead)} r={index === selectedIndex ? 6 : 3.5}/></g>;
          })}
          {!replaying && <circle className="momentum-final-marker" cx={RIGHT} cy={y(current.lead)} r="5"><title>{game.ended_at ? 'Final' : 'Current'} score {current.a} to {current.b} at {exactClock(chartTotal)}</title></circle>}
        </svg>
        <div className="momentum-axis-labels">
          {[0, .25, .5, .75, 1].map(fraction => <span key={fraction} className={`momentum-time-label${fraction === 0 ? ' first' : fraction === 1 ? ' last' : ''}`} style={{left:`${x(chartTotal * fraction) / 720 * 100}%`}}>{clock(chartTotal * fraction)}</span>)}
          {[-limit, 0, limit].map(lead => <span key={lead} className="momentum-lead-label" style={{top:`${y(lead) / 220 * 100}%`}}>{lead === 0 ? 'Tied' : `${lead > 0 ? '+' : '−'}${Math.abs(lead)}`}</span>)}
        </div>
        {replaying && <div className="momentum-replay-ball" aria-hidden="true" style={{left:`${x(playhead) / 720 * 100}%`, top:`${y(current.lead) / 220 * 100}%`}}><GoalBall flags={goal?.flags} size={22}/></div>}
        {celebration && (() => {
          const scoredGoal = goals[celebration.index];
          const scoredPoint = momentum[celebration.index + 1];
          const left = x(scoredGoal.elapsed_ms) / 720 * 100;
          const top = y(scoredPoint.lead) / 220 * 100;
          return <div key={celebration.key} className={`momentum-goal-celebration side-${creditedSide(scoredGoal)}`} aria-hidden="true">
            {celebration.burst && <div className="momentum-goal-burst" style={{left:`${left}%`, top:`${top}%`}}>
              <i className="momentum-goal-ring"/>
              {PARTICLES.map(([dx,dy],index) => <i key={index} className="momentum-goal-particle" style={{'--dx':`${dx}px`, '--dy':`${dy}px`} as CSSProperties}/>)}
            </div>}
            <div className="momentum-axis-alert">
              <i className="momentum-axis-goal-tick" style={{left:`${(x(scoredGoal.elapsed_ms) - LEFT) / (RIGHT - LEFT) * 100}%`}}/>
              <span className="momentum-goal-callout" style={{left:`clamp(90px, ${(x(scoredGoal.elapsed_ms) - LEFT) / (RIGHT - LEFT) * 100}%, calc(100% - 90px))`}}><b>+1</b> <span className="momentum-goal-name">{playerName(rivalry, creditedSide(scoredGoal))}</span><time>{exactClock(scoredGoal.elapsed_ms)}</time></span>
            </div>
          </div>;
        })()}
      </div>
      <div className="momentum-visually-hidden">Elapsed time</div>
    </>}
    <div className="momentum-player below"><i className="momentum-kit white" aria-hidden="true"/><strong>{rivalry.player_b}</strong><span>White · leads below</span></div>
    {!!goals.length && <>
      <div className="momentum-inspector">
        <button type="button" aria-label="Previous goal" disabled={selectedIndex <= 0} onClick={() => choose(selectedIndex - 1)}>←</button>
        <div className="momentum-selection" aria-live={replay.playing ? 'off' : 'polite'} aria-atomic="true">
          {goal && selected ? <><div className="momentum-selection-meta"><span>Goal {selectedIndex + 1} of {goals.length}</span><time>{exactClock(goal.elapsed_ms)}</time><strong>{selected.a} – {selected.b}</strong></div><p><strong>{playerName(rivalry, creditedSide(goal))}</strong> scores{goal.flags.includes('own_goal') ? <> · own goal by {playerName(rivalry, goal.actor_side)}</> : <> · {goal.rung}</>}</p></> : <><div className="momentum-selection-meta"><span>Kickoff</span><strong>0 – 0</strong></div><p>Waiting for the first goal</p></>}
        </div>
        <button type="button" aria-label="Next goal" disabled={selectedIndex === goals.length - 1} onClick={() => choose(selectedIndex + 1)}>→</button>
      </div>
      <p className="momentum-visually-hidden" id={`${id}-help`}>Touch or hover to inspect a goal. Use ← and → when a chart point has keyboard focus. Replay runs at {replay.speed}×; touch the chart to seek.</p>
    </>}
  </section>;
}
