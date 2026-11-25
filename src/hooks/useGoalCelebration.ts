import { useEffect, useRef, useState } from 'react';

export const GOAL_PARTICLES = [[0,-28],[21,-21],[29,0],[21,21],[0,28],[-21,21],[-29,0],[-21,-21]];

/** Playback celebrates new goals; inspecting and seeking never do. */
export function useGoalCelebration(visibleCount: number, advancedByPlayback: boolean) {
  const [celebration, setCelebration] = useState<{ index: number; key: number; burst: boolean } | null>(null);
  const previousGoalCount = useRef(0);
  const celebrationKey = useRef(0);
  const lastCelebrationAt = useRef(-Infinity);
  useEffect(() => {
    const scored = visibleCount > previousGoalCount.current && advancedByPlayback;
    previousGoalCount.current = visibleCount;
    if (!scored) { setCelebration(null); return; }
    // Limit particles to two bursts a second, without suppressing goal callouts.
    const now = performance.now();
    const burst = now - lastCelebrationAt.current >= 500;
    if (burst) lastCelebrationAt.current = now;
    setCelebration({index: visibleCount - 1, key: ++celebrationKey.current, burst});
    const timeout = window.setTimeout(() => setCelebration(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [visibleCount, advancedByPlayback]);
  return celebration;
}
