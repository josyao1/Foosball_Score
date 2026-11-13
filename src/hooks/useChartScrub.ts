import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

/** One gesture stays attached to the plot, even outside its bounds. */
export function useChartScrub({ total, position, times, left, right, width, height, stretch = false, seek }: {
  total: number; position: number | null; times: number[];
  left: number; right: number; width: number; height: number; stretch?: boolean;
  seek: (ms: number) => void;
}) {
  const pointer = useRef<number | null>(null);
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Account for SVG's centered letterboxing on wide/short poster previews.
    const scale = stretch ? rect.width / width : Math.min(rect.width / width, rect.height / height);
    const inset = stretch ? 0 : (rect.width - width * scale) / 2;
    const x = (event.clientX - rect.left - inset) / scale;
    seek(Math.max(0, Math.min(total, (x - left) / (right - left) * total)));
  };
  const finish = (event: PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    onPointerDown(event: PointerEvent<SVGSVGElement>) {
      if (event.button !== 0 || event.isPrimary === false || pointer.current !== null) return;
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      move(event);
    },
    onPointerMove(event: PointerEvent<SVGSVGElement>) {
      if (pointer.current === event.pointerId) move(event);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture() { pointer.current = null; },
    onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
      if (event.target !== event.currentTarget) return;
      const at = position ?? total;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? total
        : event.key === 'ArrowRight' ? times.find(ms => ms > at) ?? total
        : event.key === 'ArrowLeft' ? [...times].reverse().find(ms => ms < at) ?? 0 : null;
      if (next !== null) { event.preventDefault(); seek(next); }
    },
  };
}
