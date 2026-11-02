import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function ScorePopover({ anchor, score, count, onClose, children }: {
  anchor: HTMLButtonElement; score: string; count: number; onClose: () => void; children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const native = 'popover' in HTMLElement.prototype;
  const close = () => { onClose(); anchor.focus({ preventScroll: true }); };
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node) return;
    if (native) node.showPopover();
    const position = () => {
      const trigger = anchor.getBoundingClientRect(), bounds = node.getBoundingClientRect();
      const left = Math.max(8, Math.min(trigger.left + trigger.width / 2 - bounds.width / 2, window.innerWidth - bounds.width - 8));
      const top = trigger.bottom + 8 + bounds.height <= window.innerHeight - 8 ? trigger.bottom + 8 : Math.max(8, trigger.top - bounds.height - 8);
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
    };
    position();
    node.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(position) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [anchor, native]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); anchor.focus({preventScroll:true}); } };
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
  }, [anchor, onClose]);
  return createPortal(<div id="sc-score-popup" ref={panel} popover={native ? 'auto' : undefined} className="sc-score-popover" role="dialog" aria-label={`${score} score details`} onToggle={e => { if (e.newState === 'closed') onClose(); }} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== anchor) onClose();
  }}>
    <header><div><h2>{score}</h2><span>{count ? `${count} ${count === 1 ? 'game' : 'games'}` : 'Not played yet'}</span></div><button type="button" aria-label="Close score details" onClick={close}><X size={17} aria-hidden="true"/></button></header>
    {children}
  </div>, document.body);
}
