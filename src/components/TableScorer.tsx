import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import { ScreenAwake } from './ScreenAwake';
import { useScreenWakeLock } from '../lib/useScreenWakeLock';
import { MatchPointNumber } from "./MatchPointNumber";
import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Maximize, Minimize } from 'lucide-react';
import { matchesProfile, sidePlayers } from '../lib/participants';
import { matchPointSide } from '../lib/stats';
import { useProfile } from '../lib/profile';
import { RUNGS, otherSide, playerName } from '../lib/types';
import type { Game, Rivalry, Rung, Side } from '../lib/types';
import { RungButton } from './RungControls';
import './table-scorer.css';

type Props = {
  children: ReactNode;
  promptPaused: boolean;
  game: Game;
  rivalry: Rivalry;
  scores: Record<Side, number>;
  disabled: boolean;
  onGoal: (side: Side, rung: Rung) => void;
};
const farRungs = [...RUNGS].reverse();

export function TableScorer({game, rivalry, scores, disabled, onGoal, children, promptPaused}: Props) {
  const profile = useProfile();
  const lock = useScreenWakeLock(true);
  const [dismissed, setDismissed] = useState(false);
  const [requested, setRequested] = useState(false);
  const needsWake = lock.status === 'off' || lock.status === 'released' || lock.status === 'unavailable';
  const showPrompt = !dismissed && !promptPaused && (needsWake || (requested && lock.status === 'requesting'));
  const [near, setNear] = useState<Side>('a');
  const [active, setActive] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const far = otherSide(near);
  const point = matchPointSide(scores);

  function open() {
    const modal = dialog.current;
    const surface = board.current;
    if (!modal || !surface || modal.open) return;
    setNear(sidePlayers(rivalry, 'b').some(person => matchesProfile(person, profile)) ? 'b' : 'a');
    setDismissed(false);
    setRequested(false);
    modal.showModal();
    setActive(true);
    // Use the whole viewport even when the browser declines native fullscreen.
    if (surface.requestFullscreen && !document.fullscreenElement) {
      void surface.requestFullscreen().then(() => {
        if ((!modal.isConnected || !modal.open) && document.fullscreenElement === surface)
          return document.exitFullscreen();
      }).catch(() => {});
    }
  }

  useEffect(() => {
    if (!active) return;
    closeButton.current?.focus({preventScroll:true});
    const modal = dialog.current;
    const surface = board.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const fullscreenChanged = () => {
      if (!document.fullscreenElement && modal?.open) modal.close();
    };
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      document.body.style.overflow = previousOverflow;
      if (surface && document.fullscreenElement === surface) void document.exitFullscreen().catch(() => {});
    };
  }, [active]);

  function pads(side: Side, isFar: boolean) {
    return <div className="table-pads" role="group"
      aria-label={`${isFar ? 'Far' : 'Near'} side: ${playerName(rivalry, side)}`}>
      {(isFar ? farRungs : RUNGS).map(rung =>
        <RungButton key={rung} rivalry={rivalry} lineup={game.lineup} side={side} rung={rung}
          disabled={disabled} onGoal={onGoal}/>
      )}
    </div>;
  }

  return <>
    <div className="live-score-toolbar">
      {children}
      <ScreenAwake {...lock}/>
      <button type="button" className="table-launch" onClick={open} disabled={disabled}
      aria-haspopup="dialog" aria-label="Full screen" title="Full screen"><Maximize size={16} aria-hidden="true"/><span>Full screen</span></button>
    </div>
    <dialog ref={dialog} className="table-mode" aria-label="Full screen scoring"
      onClose={event => { if (!event.currentTarget.open) setActive(false); }}>
      <div className="table-surface" ref={board}>
        {active && <>
          {pads(far, true)}
          <div className="table-midfield">
            <button type="button" className="table-tool" onClick={() => setNear(far)}>
              <ArrowUpDown size={16} aria-hidden="true"/>Flip sides
            </button>
            <div className="table-score" role="status" aria-label="Current score">
              {[near, far].map(side => <span key={side} className="table-team-score">
                <span className={`table-kit kit-${side}`} aria-label={side === 'a' ? 'Black' : 'White'}/>
                <span className="table-team-name">{playerName(rivalry, side)}</span>
                <MatchPointNumber active={point === side}><strong>{scores[side]}</strong></MatchPointNumber>
                {point === side && <small className="match-point-label">Match point</small>}
              </span>)}
            </div>
            <button ref={closeButton} type="button" className="table-tool" aria-label="Exit full screen"
              onClick={() => dialog.current?.close()}><Minimize size={16} aria-hidden="true"/>Exit</button>
          </div>
          {pads(near, false)}
          {showPrompt && <Dialog title="Keep screen awake?" className="table-wake-prompt" closeOnBackdrop onClose={() => setDismissed(true)}>
            <p>{requested && lock.status === 'unavailable' ? 'Your phone declined the request. Check Low Power Mode or keep scoring.' : 'Keep the display on while you score.'}</p>
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setDismissed(true)}>Dismiss</button>
              <button type="button" className="button primary" disabled={lock.status === 'requesting'}
                onClick={() => {
                  setRequested(true);
                  if (lock.enabled) lock.retry();
                  else lock.setEnabled(true);
                }}>{lock.status === 'requesting' ? 'Turning on…' : 'Turn on'}</button>
            </div>
          </Dialog>}
        </>}
      </div>
    </dialog>
  </>;
}
