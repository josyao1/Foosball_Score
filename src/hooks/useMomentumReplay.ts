import { useEffect, useRef, useState } from 'react';

/** Null position means the normal, complete chart. Replay never mutates game data. */
export function useMomentumReplay(total: number) {
  const [position, setPosition] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(16);
  const [advancedByPlayback, setAdvancedByPlayback] = useState(false);
  const cursor = useRef<number | null>(null);

  const moveTo = (ms: number | null) => {
    setAdvancedByPlayback(false);
    cursor.current = ms === null ? null : Math.max(0, Math.min(total, ms));
    setPosition(cursor.current);
  };
  const play = () => {
    if (cursor.current === null || cursor.current >= total) moveTo(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const seek = (ms: number) => { pause(); moveTo(ms); };
  const cycleSpeed = () => setSpeed(value => value === 16 ? 2 : value * 2);

  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      // Frame timestamps, rather than frame counts, preserve the real gaps between goals.
      const next = Math.min(total, (cursor.current ?? 0) + Math.max(0, now - previous) * speed);
      previous = now;
      cursor.current = next;
      setAdvancedByPlayback(true);
      setPosition(next);
      if (next >= total) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        cancelAnimationFrame(frame);
        setPlaying(false);
      }
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [playing, speed, total]);

  return { position, playing, speed, cycleSpeed, advancedByPlayback, play, pause, seek };
}
