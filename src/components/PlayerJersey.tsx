import './player-jersey.css';

import { usePlayerAppearance } from '../lib/PlayerAppearanceContext';
import type { PlayerAppearance } from '../lib/types';

export function PlayerJersey({name, decorative = false, appearance}: {name:string; decorative?:boolean; appearance?:PlayerAppearance}) {
  const saved=usePlayerAppearance(name);
  const kit=appearance??saved;
  return <svg className="player-jersey" viewBox="0 0 100 108" role={decorative ? undefined : 'img'}
    aria-hidden={decorative || undefined} focusable="false"
    aria-label={decorative ? undefined : `${name}: ${kit.letters} jersey`}>
    <path fill={kit.color} stroke={kit.color} strokeWidth="2" strokeLinejoin="round"
      d="M33 8L20 14 4 36 20 48 27 39 24 98Q50 104 76 98L73 39 80 48 96 36 80 14 67 8Q50 17 33 8Z"/>
    <path d="M34 9Q50 32 66 9" fill="none" stroke={kit.trim} strokeWidth="4"/>
    <path d="M8 32L22 42M78 42L92 32" fill="none" stroke={kit.trim} strokeWidth="4"/>
    <path d="M29 88H71" fill="none" stroke={kit.trim} strokeWidth="2" opacity=".45"/>
    <path d="M29 42L27 83M71 42L73 83" fill="none" stroke={kit.trim} opacity=".17"/>
    <text x="50" y="64" textAnchor="middle" fill={kit.lettering ?? kit.trim}
      fontFamily="'DM Sans', Arial, sans-serif" fontWeight="650" fontSize={kit.letters.length>3?15:18}
      letterSpacing=".3">{kit.letters}</text>
  </svg>;
}
