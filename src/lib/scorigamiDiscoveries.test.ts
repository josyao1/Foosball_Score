import { describe, expect, it } from 'vitest';
import { scorigami } from './scorigami';
import { missingScores, scorigamiRecords } from './scorigamiDiscoveries';
import type { Game, GoalFlag, Rung, Side } from './types';

function game(id: string, a = 10, b = 8, rivalry = 'r'): Game {
  return { id, rivalry_id: rivalry, revision: 1, started_at: '2026-11-01T18:00:00Z', ended_at: '2026-11-01T18:05:00Z',
    goals: Array.from({length: a + b}, (_, i) => ({ id: `${id}-${i}`, actor_side: (i < a ? 'a' : 'b') as Side,
      rung: 'attacker' as Rung, flags: [] as GoalFlag[], elapsed_ms: i * 1000, occurred_at: '2026-11-01T18:00:00Z' })) };
}
const record = (games: Game[], id: string) => scorigamiRecords(scorigami(games).completed).find(r => r.id === id)!;

describe('scorigami records', () => {
  it('sums both teams, counts combos in both categories but only once as special, and excludes own goals from rung records', () => {
    const g = game('mixed', 11, 7);
    g.goals[0].flags = ['own_goal', 'dunk', 'bank'];
    g.goals[1].flags = ['dunk', 'bank'];
    g.goals[12].flags = ['dunk'];
    expect(record([g], 'dunks').value).toBe(2);
    expect(record([g], 'banks').value).toBe(1);
    expect(record([g], 'ownGoals').value).toBe(1);
    expect(record([g], 'specials').value).toBe(3);
    expect(record([g], 'rung').value).toBe(10);
  });
  it('combines teammate goals before and after swaps without combining opposing sides', () => {
    const g = game('team');
    g.goals.forEach((goal, i) => { goal.lineup = { a: { attack: i < 5 ? 'josh' : 'brooks', defense: i < 5 ? 'brooks' : 'josh' }, b: { attack: 'andrew', defense: 'andrew' } }; });
    const r = record([g], 'rung');
    expect(r.value).toBe(10);
    expect(r.matches[0].holders).toEqual([{side:'a', rung:'attacker'}]);
  });
  it('counts a game once even when both teams tie its single-rung record', () => {
    const g = game('ties');
    g.goals[0].rung = g.goals[1].rung = 'goalie';
    const r = record([g], 'rung');
    expect(r.value).toBe(8);
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].holders).toHaveLength(2);
  });
  it('replaces broken records, retains all ties, and recalculates after archive, restore, edit and filtering', () => {
    const old = game('old'), tied = game('tied'), next = game('new', 10, 8, 'other');
    old.goals[0].flags = tied.goals[0].flags = ['bank'];
    next.goals[0].flags = next.goals[1].flags = ['bank'];
    expect(record([old, tied], 'banks').matches).toHaveLength(2);
    expect(record([old, tied, next], 'banks').matches.map(m=>m.game.id)).toEqual(['new']);
    next.deleted_at = '2026-11-02T00:00:00Z';
    expect(record([old, tied, next], 'banks').value).toBe(1);
    next.deleted_at = null;
    expect(record([old, tied, next], 'banks').value).toBe(2);
    expect(scorigamiRecords(scorigami([old, tied, next], 'r').completed).find(r=>r.id==='banks')?.value).toBe(1);
    next.goals[1].flags = [];
    expect(record([old, tied, next], 'banks').matches).toHaveLength(3);
    expect(record([{...next, ended_at:null}], 'banks').value).toBe(0);
  });
});
it('shows missing regular finishes, overtime gaps and one new overtime target', () => {
  const data = scorigami([game('ten',10,8), game('long',13,11)]);
  const missing = missingScores(data.buckets, data.maxScore);
  expect(missing).toContainEqual({high:10,low:0});
  expect(missing).not.toContainEqual({high:10,low:8});
  expect(missing.filter(s=>s.high>10)).toEqual([{high:11,low:9},{high:12,low:10},{high:14,low:12}]);
  expect(missingScores(new Map(),10)).toHaveLength(10);
});
