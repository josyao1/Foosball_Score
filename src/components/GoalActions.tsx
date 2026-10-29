import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

export function GoalActions({ time, description, onEdit, onRemove }: {
  time: string;
  description: string;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{left:number;top:number} | null>(null);
  const close = (restoreFocus = false) => {
    setPosition(null);
    if (restoreFocus) trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!position || !panel.current) return;
    // Measure the actual panel (including wrapped names), and flip above near the bottom.
    const rect = trigger.current!.getBoundingClientRect();
    const height = panel.current.getBoundingClientRect().height;
    const top = rect.bottom + 4 + height <= window.innerHeight - 8
      ? rect.bottom + 4 : Math.max(8, rect.top - height - 4);
    panel.current.style.top = `${top}px`;
    panel.current.querySelector<HTMLButtonElement>('button')?.focus();
  }, [position]);
  useEffect(() => {
    if (!position) return;
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
    };
    const dismiss = () => close();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [position]);

  return <>
    <button ref={trigger} type="button" className="goal-actions-trigger" aria-label={`Goal actions at ${time}`} aria-expanded={!!position} aria-controls={position ? id : undefined} onClick={() => {
      if (position) { close(true); return; }
      const rect = trigger.current!.getBoundingClientRect();
      setPosition({left:Math.max(8, Math.min(rect.right - 190, window.innerWidth - 198)), top:rect.bottom + 4});
    }}><MoreHorizontal size={18} aria-hidden="true"/></button>
    {position && createPortal(<div ref={panel} id={id} className="goal-actions-panel" role="group" aria-label={`Actions for goal at ${time}`} style={position} onBlur={event => {
      // Touch browsers may blur the focused button without focusing the tapped
      // action. Leave it mounted until its click; outside presses dismiss above.
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) close();
    }}>
      <p>{description}</p>
      {onEdit && <button type="button" aria-label={`Edit goal at ${time}`} onClick={() => { close(true); onEdit(); }}><Pencil size={15} aria-hidden="true"/>Edit goal</button>}
      {onRemove && <button type="button" className="goal-action-remove" aria-label={`Remove goal at ${time}`} onClick={() => { close(true); onRemove(); }}><Trash2 size={15} aria-hidden="true"/>Delete goal</button>}
    </div>, document.body)}
  </>;
}
