import { useLayoutEffect, useRef } from 'react';
import './tab-underline.css';

export function TabUnderline({ selection }: { selection: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const line = ref.current;
    const row = line?.parentElement;
    const active = row?.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]');
    if (!line || !row || !active) return;

    const align = () => {
      line.style.width = active.offsetWidth + 'px';
      line.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    align();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(align);
    observer?.observe(row);
    for (const tab of row.querySelectorAll('a, button')) observer?.observe(tab);
    window.addEventListener('resize', align);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', align);
    };
  }, [selection]);

  return <span ref={ref} className="tab-underline" aria-hidden="true" />;
}
