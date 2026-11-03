import { score } from './stats';
import type { Game, Rivalry } from './types';

export const scoreKey = (high: number, low: number) => `${high}-${low}`;
export interface ScoreBucket { key: string; high: number; low: number; games: Game[] }
/** Opposite table sides share a final score. Only completed first-to-10, win-by-two results enter the map. */
export function scorigami(games: Game[], rivalryId = '') {
  const completed = games.filter(g => {
    if (!g.ended_at || (rivalryId && g.rivalry_id !== rivalryId)) return false;
    const s = score(g.goals), high = Math.max(s.a, s.b), low = Math.min(s.a, s.b);
    return (high === 10 && low <= 8) || (high > 10 && high - low === 2);
  })
    .sort((a, b) => Date.parse(b.ended_at!) - Date.parse(a.ended_at!) || b.id.localeCompare(a.id));
  const buckets = new Map<string, ScoreBucket>();
  let maxScore = 10;
  for (const game of completed) {
    const s = score(game.goals), high = Math.max(s.a, s.b), low = Math.min(s.a, s.b);
    const key = scoreKey(high, low);
    if (!buckets.has(key)) buckets.set(key, { key, high, low, games: [] });
    buckets.get(key)!.games.push(game);
    maxScore = Math.max(maxScore, high);
  }
  const common = [...buckets.values()].sort((a, b) => b.games.length - a.games.length || a.high - b.high || a.low - b.low)[0];
  return { buckets, completed, maxScore, common };
}

/** Names are the app's participant identity; team labels remain intact. */
export function scorePlayerStats(games: Game[], rivalries: Rivalry[]) {
  const rivalryMap = new Map(rivalries.map(r => [r.id, r]));
  const people = new Map<string, {name: string; wins: number; played: number}>();
  for (const game of games) {
    const rivalry = rivalryMap.get(game.rivalry_id);
    if (!rivalry || !game.ended_at) continue;
    const result = score(game.goals);
    for (const side of ['a', 'b'] as const) {
      const name = (side === 'a' ? rivalry.player_a : rivalry.player_b).trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const person = people.get(key) ?? {name, wins: 0, played: 0};
      person.played++;
      if (result[side] > result[side === 'a' ? 'b' : 'a']) person.wins++;
      people.set(key, person);
    }
  }
  return [...people.values()].map(person => ({...person, percentage: Math.round(person.wins / person.played * 100)}))
    .sort((a,b) => b.percentage - a.percentage || b.played - a.played || a.name.localeCompare(b.name));
}
