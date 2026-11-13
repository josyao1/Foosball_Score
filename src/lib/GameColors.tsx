import { createContext, useContext, useState } from 'react';
import { otherSide, type Side } from './types';

export const GameColors = createContext(false);
export function useGameColor() {
  const flipped = useContext(GameColors);
  return (side: Side): Side => flipped ? otherSide(side) : side;
}
function read(id: string) {
  try { return localStorage.getItem(`tabletalk:game-colors:${id}`) === 'flipped'; }
  catch { return false; }
}
/** A display preference only. Canonical sides and recorded goals never move. */
export function useLocalGameColors(id: string) {
  const [choice, setChoice] = useState(() => ({id, flipped: read(id)}));
  const flipped = choice.id === id ? choice.flipped : read(id);
  function toggle() {
    const next = !flipped;
    setChoice({id, flipped: next});
    try { localStorage.setItem(`tabletalk:game-colors:${id}`, next ? 'flipped' : 'default'); } catch { /* Still usable when storage is unavailable. */ }
  }
  return [flipped, toggle] as const;
}
