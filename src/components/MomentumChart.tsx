import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { clock, creditedSide, duration, gameStats, orderedGoals } from '../lib/stats';
import { playerName } from '../lib/types';
import type { Game, Rivalry } from '../lib/types';
import '../momentum.css';

const LEFT = 54, RIGHT = 690, TOP = 14, CENTER = 94, BOTTOM = 174;
const exactClock = (ms: number) => `${clock(ms)}.${String(Math.floor(ms) % 1000).padStart(3, '0')}`;

/** Every step is a recorded goal; the horizontal axis is actual elapsed time. */
export function MomentumChart({ game, rivalry }: { game: Game; rivalry: Rivalry }) {
  const id = useId().replace(/:/g, '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const points = useRef<(SVGGElement | null)[]>([]);
  const goals = orderedGoals(game.goals);
  const { momentum } = gameStats(game);
  const limit = Math.max(2, ...momentum.map(p => Math.abs(p.lead)));
  const total = Math.max(1, duration(game), ...momentum.map(p => p.elapsed));
  const x = (ms: number) => LEFT + (ms / total) * (RIGHT - LEFT);
  const y = (lead: number) => CENTER - (lead / limit) * (CENTER - TOP);
  const steps = momentum.map((p, i) => i ? `H${x(p.elapsed)}V${y(p.lead)}` : `M${LEFT},${CENTER}`).join(' ') + ` H${RIGHT}`;
  const area = `${steps} V${CENTER} H${LEFT} Z`;
  const final = momentum[momentum.length - 1];
  const selectedIndex = Math.max(0, selectedId ? goals.findIndex(g => g.id === selectedId) : goals.length - 1);
  const goal = goals[selectedIndex];
  const selected = momentum[selectedIndex + 1];
  const choose = (index: number, focus = false) => {
    const bounded = Math.max(0, Math.min(goals.length - 1, index));
    if (!goals[bounded]) return;
    setSelectedId(goals[bounded].id);
    if (focus) points.current[bounded]?.focus();
  };
  const onKey = (event: KeyboardEvent<SVGGElement>, index: number) => {
    const target = event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowRight' ? index + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? goals.length - 1 : null;
    if (target !== null) { event.preventDefault(); choose(target, true); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(index); }
  };
  const selectPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!goals.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const plotX = (event.clientX - rect.left) / rect.width * 720;
    const plotY = (event.clientY - rect.top) / rect.height * 220;
    let nearest = 0, distance = Infinity;
    momentum.slice(1).forEach((p, index) => {
      const next = Math.abs(x(p.elapsed) - plotX) + Math.abs(y(p.lead) - plotY) * 0.15;
      if (next < distance) { distance = next; nearest = index; }
    });
    choose(nearest);
  };
  return <section className="momentum-report" aria-labelledby={`${id}-heading`}>
    <header className="momentum-heading"><div><h2 id={`${id}-heading`}>Momentum</h2><p>Goal lead over time</p></div><span className="momentum-result"><small>{game.ended_at ? 'Final' : 'Current'}</small><strong>{final.a} – {final.b}</strong><time>{clock(total)}</time></span></header>
    <div className="momentum-player"><i className="momentum-kit black" aria-hidden="true"/><strong>{rivalry.player_a}</strong><span>Black · leads above</span></div>
    {!goals.length ? <div className="momentum-empty"><strong>Tied · 0 – 0</strong><p>The first goal will start the momentum chart.</p></div> : <>
      <div className="momentum-visually-hidden">Goal difference</div>
      <svg className="momentum-plot" viewBox="0 0 720 220" preserveAspectRatio="none" aria-labelledby={`${id}-heading ${id}-help`} onPointerDown={selectPointer} onPointerMove={e => { if (e.pointerType === 'mouse' || e.buttons) selectPointer(e); }}>
        <defs><clipPath id={`${id}-black`}><rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={CENTER - TOP}/></clipPath><clipPath id={`${id}-white`}><rect x={LEFT} y={CENTER} width={RIGHT - LEFT} height={BOTTOM - CENTER}/></clipPath></defs>
        <rect className="momentum-plot-bg" x={LEFT} y={TOP} width={RIGHT - LEFT} height={BOTTOM - TOP}/>
        {[0, .25, .5, .75, 1].map(fraction => <g key={fraction} className="momentum-time-grid"><line x1={x(total * fraction)} x2={x(total * fraction)} y1={TOP} y2={BOTTOM}/><text x={x(total * fraction)} y={202} textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>{clock(total * fraction)}</text></g>)}
        {[-limit, 0, limit].map(lead => <g key={lead} className={`momentum-lead-grid ${lead === 0 ? 'is-tied' : ''}`}><line x1={LEFT} x2={RIGHT} y1={y(lead)} y2={y(lead)}/><text x={LEFT - 10} y={y(lead) + 5} textAnchor="end">{lead === 0 ? 'Tied' : `${lead > 0 ? '+' : '−'}${Math.abs(lead)}`}</text></g>)}
        <path d={area} className="momentum-area-black" clipPath={`url(#${id}-black)`}/><path d={area} className="momentum-area-white" clipPath={`url(#${id}-white)`}/>
        <path d={steps} className="momentum-step-outline"/><path d={steps} className="momentum-step"/>
        <line className="momentum-selection-line" x1={x(selected.elapsed)} x2={x(selected.elapsed)} y1={TOP} y2={BOTTOM}/>
        {goals.map((g, index) => { const p = momentum[index + 1]; const label = `Goal ${index + 1}, ${exactClock(g.elapsed_ms)}, ${playerName(rivalry, creditedSide(g))} scores, ${p.a} to ${p.b}`; return <g key={g.id} ref={el => { points.current[index] = el; }} role="button" tabIndex={index === selectedIndex ? 0 : -1} aria-label={label} aria-pressed={index === selectedIndex} className={`momentum-point ${index === selectedIndex ? 'selected' : ''}`} onFocus={() => choose(index)} onKeyDown={e => onKey(e, index)} onClick={e => { e.stopPropagation(); choose(index); }}><title>{label}</title><circle className="momentum-point-target" cx={x(p.elapsed)} cy={y(p.lead)} r="14"/><circle className="momentum-point-dot" cx={x(p.elapsed)} cy={y(p.lead)} r={index === selectedIndex ? 6 : 3.5}/></g>; })}
        <circle className="momentum-final-marker" cx={RIGHT} cy={y(final.lead)} r="5"><title>{game.ended_at ? 'Final' : 'Current'} score {final.a} to {final.b} at {exactClock(total)}</title></circle>
      </svg>
      <div className="momentum-visually-hidden">Elapsed time</div>
    </>}
    <div className="momentum-player below"><i className="momentum-kit white" aria-hidden="true"/><strong>{rivalry.player_b}</strong><span>White · leads below</span></div>
    {goal && selected && <><div className="momentum-inspector"><button type="button" aria-label="Previous goal" disabled={selectedIndex === 0} onClick={() => choose(selectedIndex - 1)}>←</button><div className="momentum-selection" aria-live="polite" aria-atomic="true"><div className="momentum-selection-meta"><span>Goal {selectedIndex + 1} of {goals.length}</span><time>{exactClock(goal.elapsed_ms)}</time><strong>{selected.a} – {selected.b}</strong></div><p><strong>{playerName(rivalry, creditedSide(goal))}</strong> scores{goal.flags.includes('own_goal') ? <> · own goal by {playerName(rivalry, goal.actor_side)}</> : <> · {goal.rung}</>}</p></div><button type="button" aria-label="Next goal" disabled={selectedIndex === goals.length - 1} onClick={() => choose(selectedIndex + 1)}>→</button></div><p className="momentum-visually-hidden" id={`${id}-help`}>Touch or hover to inspect a goal. Use ← and → when a chart point has keyboard focus.</p></>}
  </section>;
}
