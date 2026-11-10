import type { ReactNode } from 'react';

export function MatchPointNumber({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className="match-point-number" data-point={active}>
    {children}
    {active && <span className="point-sparks" aria-hidden="true"><i/><i/><i/><i/></span>}
  </span>;
}
