import { describe, expect, it } from 'vitest';
import { scorigami } from './scorigami';
import type { Game } from './types';

export function scoredGame(id: string, a: number, b: number, rivalry = 'r', ended = '2026-11-01T19:00:00Z'): Game {
  return { id, rivalry_id: rivalry, revision: 1, started_at: '2026-11-01T18:00:00Z', ended_at: ended,
    goals: Array.from({length:a+b}, (_, i) => ({id:`${id}-${i}`,actor_side:i<a?'a':'b',rung:'attacker',flags:[],elapsed_ms:(i+1)*1000,occurred_at:'2026-11-01T18:00:01Z'})) };
}
describe('scorigami final scores', () => {
  it('combines reversed sides and scopes records while excluding live games', () => {
    const games=[scoredGame('old',10,8),scoredGame('new',8,10,'other','2026-11-02T19:00:00Z'),{...scoredGame('live',10,8),ended_at:null}];
    const result=scorigami(games);
    expect(result.buckets.size).toBe(1);
    expect(result.buckets.get('10-8')?.games.map(g=>g.id)).toEqual(['new','old']);
    expect(result.completed).toHaveLength(2);
    expect(scorigami(games,'r').buckets.get('10-8')?.games).toHaveLength(1);
    expect(scorigami(games,'missing').buckets.size).toBe(0);
  });
  it('excludes early finishes, draws and one-point wins while crediting own goals', () => {
    const own=scoredGame('own',11,7); own.goals[0].flags=['own_goal'];
    const result=scorigami([own,scoredGame('early',4,2),scoredGame('empty',0,0),scoredGame('one-point',10,9)]);
    expect([...result.buckets.keys()].sort()).toEqual(['10-8']);
  });
  it('only counts ten-point wins or two-point overtime finishes', () => {
    const result = scorigami([scoredGame('shutout',10,0),scoredGame('close',10,8),scoredGame('deuce',11,9),scoredGame('overtime',10,12),scoredGame('continued',11,0),scoredGame('extra',12,8)]);
    expect([...result.buckets.keys()].sort()).toEqual(['10-0','10-8','11-9','12-10']);
    expect(result.completed).toHaveLength(4);
  });
  it('recalculates after edits and deletions and supports unusually high scores', () => {
    const g=scoredGame('long',48,46);
    expect(scorigami([g]).maxScore).toBe(48);
    g.goals.pop();
    expect(scorigami([g]).buckets.has('48-45')).toBe(false);
    expect(scorigami([])).toMatchObject({maxScore:10,completed:[],common:undefined});
  });
});
