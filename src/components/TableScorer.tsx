import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import { ScreenAwake } from './ScreenAwake';
import { useScreenWakeLock } from '../lib/useScreenWakeLock';
import { MatchPointNumber } from "./MatchPointNumber";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Maximize, Minimize } from 'lucide-react';
import { defaultLineup, matchesProfile, sidePlayers } from '../lib/participants';
import { duration, matchPointSide } from '../lib/stats';
import { useProfile } from '../lib/profile';
import { RUNGS, otherSide, playerName } from '../lib/types';
import type { Game, Rivalry, Rung, Side } from '../lib/types';
import { RungButton } from './RungControls';
import './table-scorer.css';

type Props = {
  children: ReactNode;
  promptPaused: boolean;
  busy: boolean;
  onSave: (game: Game) => Promise<unknown>;
  pauseControl: ReactNode;
  game: Game;
  rivalry: Rivalry;
  scores: Record<Side, number>;
  disabled: boolean;
  onGoal: (side: Side, rung: Rung) => void;
};
const farRungs = [...RUNGS].reverse();

export function TableScorer({game, rivalry, scores, disabled, onGoal, children, promptPaused, busy, onSave, pauseControl}: Props) {
  const profile = useProfile();
  const [swapError, setSwapError] = useState('');
  const [swapping, setSwapping] = useState(false);
  const swapLock = useRef(false);
  async function swap(side: Side) {
    if (swapLock.current || busy || game.paused_at) return;
    swapLock.current=true; setSwapping(true); setSwapError('');
    const lineup = game.lineup ?? defaultLineup(rivalry);
    try { await onSave({...game, lineup:{...lineup,[side]:{defense:lineup[side].attack,attack:lineup[side].defense,swapped_at_ms:duration(game)}}}); }
    catch(e) {setSwapError(e instanceof Error ? e.message : 'Could not swap positions.');}
    finally {swapLock.current=false;setSwapping(false);}
  }
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
  const namePositions = useRef(new Map<string, {x:number; y:number}>());
  const nameAnimations = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    const previous = namePositions.current;
    const next = new Map<string, {x:number; y:number}>();
    const occurrences = new Map<string,number>();
    const names = active ? [...(board.current?.querySelectorAll<HTMLElement>('.rung-assignee[aria-hidden="false"]') ?? [])] : [];
    // Match both copies of each teammate's name to their old rung positions.
    const moves = names.map(node => {
      const person = `${node.dataset.side}:${node.dataset.playerId}`;
      const index = occurrences.get(person) ?? 0;
      occurrences.set(person,index+1);
      const key = `${person}:${index}`, rect = node.getBoundingClientRect();
      const position = {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      next.set(key,position);
      return {node,from:previous.get(key),to:position};
    });
    nameAnimations.current.forEach(animation => animation.cancel());
    nameAnimations.current = [];
    namePositions.current = next;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    for (const {node,from,to} of moves) {
      if (!from || !node.animate || (from.x===to.x && from.y===to.y)) continue;
      nameAnimations.current.push(node.animate([
        {transform:`translate(${from.x-to.x}px, ${from.y-to.y}px)`},
        {transform:'translate(0, 0)'},
      ], {duration:380,easing:'cubic-bezier(.22,1,.36,1)'}));
    }
  }, [active,near,game.lineup?.a.attack,game.lineup?.a.defense,game.lineup?.b.attack,game.lineup?.b.defense]);
  useEffect(() => () => nameAnimations.current.forEach(animation => animation.cancel()), []);

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
    return <div className="table-end" role="group"
      aria-label={`${isFar ? 'Far' : 'Near'} side: ${playerName(rivalry, side)}`}>
      <header><span><i className={`table-kit kit-${side}`} aria-hidden="true"/>{side==='a'?'Black':'White'} · {playerName(rivalry,side)}</span>
        {sidePlayers(rivalry,side).length===2 && <button type="button" className="table-tool table-swap"
          disabled={busy || swapping || Boolean(game.paused_at)} onClick={()=>void swap(side)}
          aria-label={`Swap ${side==='a'?'black':'white'} rungs: ${playerName(rivalry,side)}`}>
          <ArrowLeftRight size={15}/><span>Swap rungs</span>
        </button>}
      </header>
      <div className="table-pads">{(isFar ? farRungs : RUNGS).map(rung =>
        <RungButton key={rung} rivalry={rivalry} lineup={game.lineup} side={side} rung={rung}
          disabled={disabled || swapping} onGoal={onGoal}/>
      )}</div>
    </div>;
  }

  return <>
    <div className="live-score-toolbar">
      {children}
      <div className="live-pause-control">{pauseControl}</div>
      <ScreenAwake {...lock}/>
      <button type="button" className="table-launch" onClick={open} disabled={busy}
      aria-haspopup="dialog" aria-label="Full screen" title="Full screen"><Maximize size={16} aria-hidden="true"/><span>Full screen</span></button>
    </div>
    <dialog ref={dialog} className="table-mode" aria-label="Full screen scoring"
      onClose={event => { if (!event.currentTarget.open) setActive(false); }}>
      <div className="table-surface" ref={board}>
        {active && <>
          {pads(far, true)}
          <div className="table-midfield">
            <div className="table-pause-controls">{pauseControl}</div>
            <div className="table-score-center"><div className="table-score" role="status" aria-label="Current score">
              {[near, far].map(side => <span key={side} className="table-team-score">
                <span className={`table-kit kit-${side}`} aria-label={side === 'a' ? 'Black' : 'White'}/>
                <span className="table-team-name">{playerName(rivalry, side)}</span>
                <MatchPointNumber active={point === side}><strong>{scores[side]}</strong></MatchPointNumber>
                {point === side && <small className="match-point-label">Match point</small>}
              </span>)}
            </div>
            <div className="table-clock">{children}</div></div>
            <button ref={closeButton} type="button" className="table-tool" aria-label="Exit full screen"
              onClick={() => dialog.current?.close()}><Minimize size={16} aria-hidden="true"/>Exit</button>
          </div>
          {pads(near, false)}
          {swapError && <p className="table-swap-error" role="alert">{swapError}</p>}
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
