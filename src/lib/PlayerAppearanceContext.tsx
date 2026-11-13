import { createContext, useContext } from 'react';
import type { Player } from './types';
import { playerAppearance } from './playerAppearance';
export const PlayerAppearanceContext = createContext<Player[]>([]);
export function usePlayerAppearance(name:string) {
 const players=useContext(PlayerAppearanceContext);
 return playerAppearance(players.find(p=>p.name.toLowerCase()===name.trim().toLowerCase())??{name});
}
