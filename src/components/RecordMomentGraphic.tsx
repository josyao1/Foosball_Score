import { Timer } from 'lucide-react';
import { gameHighlights, momentWindow } from '../lib/records';
import type { Moment } from '../lib/records';
import { clock } from '../lib/stats';
import type { Game } from '../lib/types';

/** A small, decorative preview. Labels and the score transition carry the same information in text. */
export function RecordMomentGraphic({ game, moment }: { game: Game; moment: Moment }) {
  if (moment.kind === 'triple' || moment.kind === 'response') return null;
  const { goals, scores } = gameHighlights(game);
  if (moment.kind === 'drought') {
    const window = momentWindow(game, moment);
    return <div className="record-stopwatch record-drought-timer"><Timer size={46} strokeWidth={1.3} aria-hidden="true"/><div><span>Neither side scored between</span><strong>{clock(window.startMs)} – {clock(window.endMs)}</strong></div></div>;
  }
  if (moment.kind === 'quickest' || moment.kind === 'longest') {
    const final = scores.at(-1)!;
    return <div className="record-stopwatch"><Timer size={46} strokeWidth={1.3} aria-hidden="true"/><div><span>Final score</span><strong>{final.a} – {final.b}</strong></div><small>From kickoff<br/>to the winning goal</small></div>;
  }
  const offset = moment.kind === 'comeback' ? moment.start + 1 : moment.start;
  const values = scores.slice(offset, moment.end + 2).map(s => moment.kind === 'run'
    ? s[moment.side!] - scores[offset][moment.side!]
    : moment.side === 'b' ? s.b - s.a : s.a - s.b);
  const low = Math.min(0, ...values), high = Math.max(1, ...values);
  const y = (value: number) => 52 - (value - low) / (high - low) * 44;
  const plotStart = offset === 0 ? 0 : goals[offset - 1].elapsed_ms;
  const plotSpan = Math.max(1, goals[moment.end].elapsed_ms - plotStart);
  const stepX = (i: number) => 8 + ((i === 0 ? plotStart : goals[offset + i - 1].elapsed_ms) - plotStart) / plotSpan * 304;
  const path = values.map((v, i) => i ? `H${stepX(i)}V${y(v)}` : `M8 ${y(v)}`).join(' ');
  return <div className="record-mini">
    <svg viewBox="0 0 320 64" aria-hidden="true" focusable="false">
      <path d={`M8 ${y(0)}H312`} className="record-mini-guide"/>
      <path d={`${path}V${y(0)}H8Z`} className="record-mini-area"/>
      <path d={path} className="record-mini-curve"/>
    </svg>
    <div className="record-mini-labels"><span>{clock(plotStart)}</span><span>{moment.kind === 'run' ? 'Unanswered goals' : moment.kind === 'comeback' ? 'Deficit to victory' : 'Black side’s lead'}</span><span>{clock(goals[moment.end].elapsed_ms)}</span></div>
  </div>;
}
