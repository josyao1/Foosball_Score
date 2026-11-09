import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

function canAnimate(node: HTMLElement) {
  return typeof node.animate === 'function'
    && window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches;
}

export function ScorePopover({ anchor, score, count, share, onClose, children }: {
  anchor: HTMLButtonElement; score: string; count: number; share?: number; onClose: () => void; children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const native = 'popover' in HTMLElement.prototype;
  const animation = useRef<Animation | null>(null);
  const close = useCallback((restoreFocus = false) => {
    const node = panel.current;
    if (!node || node.inert) return;
    node.inert = true;
    node.style.pointerEvents = 'none';
    if (restoreFocus) anchor.focus({preventScroll: true});
    if (!canAnimate(node)) { onClose(); return; }

    const current = getComputedStyle(node);
    const start = {opacity: current.opacity, transform: current.transform};
    animation.current?.cancel();
    const exit = node.animate([start, {
      opacity: 0, transform: node.style.getPropertyValue('--ticket-start')
    }], {duration: 140, easing: 'ease-in', fill: 'forwards'});
    animation.current = exit;
    exit.onfinish = onClose;
  }, [anchor, onClose]);
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node) return;
    if (native) node.showPopover();
    const position = () => {
      const trigger = anchor.getBoundingClientRect(), bounds = {width: node.offsetWidth, height: node.offsetHeight};
      node.style.setProperty('--ticket-start', 'scale(.95)');
      if (window.innerWidth <= 600) {
        node.style.removeProperty('left');
        node.style.removeProperty('top');
        node.style.transformOrigin = 'center';
        return;
      }
      const besideRight=trigger.right+12+bounds.width<=window.innerWidth-8;
      const besideLeft=trigger.left-12-bounds.width>=8;
      const left = besideRight ? trigger.right+12 : besideLeft ? trigger.left-12-bounds.width : Math.max(8, Math.min(trigger.left + trigger.width / 2 - bounds.width / 2, window.innerWidth - bounds.width - 8));
      const top = besideRight || besideLeft ? Math.max(8,Math.min(trigger.top,window.innerHeight-bounds.height-8)) : trigger.bottom + 8 + bounds.height <= window.innerHeight - 8 ? trigger.bottom + 8 : Math.max(8, trigger.top - bounds.height - 8);
      // Grow from the panel edge nearest the score bar.
      const originX = Math.max(0, Math.min(bounds.width, trigger.left + trigger.width / 2 - left));
      const originY = Math.max(0, Math.min(bounds.height, trigger.top + trigger.height / 2 - top));
      node.style.transformOrigin = `${originX}px ${originY}px`;
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
    };
    position();
    if (canAnimate(node)) {
      animation.current = node.animate([
        {opacity: 0, transform: node.style.getPropertyValue('--ticket-start')},
        {opacity: 1, transform: 'none'}
      ], {duration: 180, easing: 'ease-out'});
    }
    node.focus({ preventScroll: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(position) : null;
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      if (animation.current) {
        animation.current.onfinish = null;
        animation.current.cancel();
      }
    };
  }, [anchor, native]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(true); } };
    const dismiss = (event: Event) => { if (!panel.current?.contains(event.target as Node)) onClose(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [anchor, close, onClose]);
  return createPortal(<div id="sc-score-popup" ref={panel} popover={native ? 'manual' : undefined} className="sc-score-popover" tabIndex={-1} role="dialog" aria-label={`${score} score details`} onToggle={e => { if (e.newState === 'closed') onClose(); }} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== anchor) close();
  }}>
    <header><div><h2>{score}</h2><span>{count ? `${count} ${count === 1 ? 'game' : 'games'}${share===undefined?'':` · ${share}% of finishes`}` : 'Not played yet'}</span></div><button type="button" aria-label="Close score details" onClick={() => close(true)}><X size={17} aria-hidden="true"/></button></header>
    {children}
  </div>, document.body);
}
