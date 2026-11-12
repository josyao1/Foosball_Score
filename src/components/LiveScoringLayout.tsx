import type { ReactNode } from 'react';
import { RungButton } from './RungControls';
import { GoalBall } from './GoalBall';
import { MatchPointNumber } from './MatchPointNumber';
import { matchPointSide } from '../lib/stats';
import { RUNGS, playerName, otherSide } from '../lib/types';
import type { Lineup, Rivalry, Rung, Side } from '../lib/types';

export function LiveScoringLayout({rivalry, lineup, scores, disabled, onGoal, pulse, clock, whitePositions, blackPositions, rematchFrom, near}:
  {rivalry: Rivalry; lineup?: Lineup | null; scores: Record<Side, number>;
   disabled: boolean; onGoal: (side: Side, rung: Rung) => void;
   pulse?: {id: string; side: Side}; clock?: ReactNode; whitePositions?: ReactNode; blackPositions?: ReactNode; rematchFrom?: Record<Side, number>; near: Side}) {
  const far = otherSide(near);
  const sidePositions = (side: Side) => side === 'a' ? blackPositions : whitePositions;
  const point = matchPointSide(scores);
  const number = (side: Side) => <MatchPointNumber active={point === side}>
    <strong key={pulse?.side === side ? pulse.id : side} className={`live-layout-number${pulse?.side === side ? ' just-scored' : ''}${rematchFrom ? ' gs-rematch-number' : ''}`}>
      {rematchFrom ? <><span className="gs-rematch-old" aria-hidden="true">{rematchFrom[side]}</span><span className="gs-rematch-new">{scores[side]}</span></> : scores[side]}
    </strong>
  </MatchPointNumber>;
  const kit = (side: Side) => <span className={`live-layout-kit kit-${side}`} aria-hidden="true"/>;
  const pad = (side: Side, rungs: readonly Rung[]) => <div className="live-layout-pad" role="group" aria-label={`${side === 'a' ? 'Black' : 'White'} scoring rungs`}>{rungs.map(rung =>
    <RungButton key={rung} {...{rivalry, lineup, side, rung, disabled, onGoal}}/>
  )}</div>;
  return <div className="live-layout-table">
    <div className="live-table-name">{kit(far)}{playerName(rivalry, far)}</div>
    {sidePositions(far)}
    {pad(far, [...RUNGS].reverse())}
    <div className="live-table-score" aria-live="polite" aria-label={`Current score: ${playerName(rivalry,'a')} ${scores.a}; ${playerName(rivalry,'b')} ${scores.b}`}>
      <div className="live-table-timer" aria-live="off">{clock}</div>
      {([near,far]).map(side => <div key={side}>{number(side)}<span>{kit(side)}{playerName(rivalry,side)}</span>{point === side && <small className="match-point-label">Match point</small>}</div>)}
      <span className="live-table-ball" aria-hidden="true"><GoalBall size={22}/></span>
    </div>
    {pad(near, RUNGS)}
    <div className="live-table-name">{kit(near)}{playerName(rivalry, near)}</div>
    {sidePositions(near)}
  </div>;
}
