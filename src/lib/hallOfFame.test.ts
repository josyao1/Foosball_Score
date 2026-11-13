import { describe, expect, it } from 'vitest';
import { classicScore, rankedClassics } from './hallOfFame';
import type { Game, GoalFlag, Rivalry } from './types';

const rivalry: Rivalry = { id: 'r', player_a: 'Josh', player_b: 'Brooks', created_at: '2026-01-01' };
function game(sequence: string, step = 30000): Game {
  return { id: 'g', rivalry_id: 'r', revision: 1, started_at: '2026-11-01T18:00:00Z', ended_at: '2026-11-01T19:00:00Z', goals: [...sequence].map((side, i) => ({ id: `${i}`, actor_side: side === 'a' ? 'a' : 'b', rung: 'attacker', flags: [] as GoalFlag[], elapsed_ms: (i + 1) * step, occurred_at: '2026-11-01T18:00:01Z' })) };
}
const points = (g: Game, label: string) => classicScore(g)!.factors.find(f => f.label === label)!.points;
describe('classic score', () => {
  it('excludes live, early, tied and continued games', () => {
    expect(classicScore({ ...game('aaaaaaaaaa'), ended_at: null })).toBeNull();
    for (const sequence of ['ab', 'aaaa', 'aaaaaaaaaab', 'aaaaaaaaaaa']) expect(classicScore(game(sequence))).toBeNull();
  });
  it('scores a shutout transparently without counting kickoff as a close score', () => {
    const g = game('aaaaaaaaaa');
    expect(points(g, 'Closeness')).toBe(4);
    expect(points(g, 'Game length')).toBeCloseTo(25/6);
    expect(classicScore(g)!.total).toBeCloseTo(4+25/6);
  });
  it('rewards a late comeback and both sides having match point', () => {
    const g = game('ababababbbbbb' + 'aaaaaaa'); // 4–9 to 11–9
    expect(points(g, 'Winning comeback')).toBe(20);
    expect(points(g, 'Match-point drama')).toBe(5);
    expect(rankedClassics([g], [rivalry])[0].captions).toContain('Josh recovered from 4–9');
  });
  it('caps game-length points at six while retaining the six-minute benchmark', () => {
    expect(points(game('aaaaaaaaaa', 36000), 'Game length')).toBe(5);
    expect(points(game('aaaaaaaaaa', 43200), 'Game length')).toBeCloseTo(5.5);
    expect(points(game('aaaaaaaaaa', 50400), 'Game length')).toBe(6);
    expect(points(game('aaaaaaaaaa', 360000), 'Game length')).toBe(6);
  });
  it('awards beyond-benchmark bonuses and counts a dunk-bank combo once, excluding own goals', () => {
    const g = game('abababababababababaa', 120000);
    g.goals.forEach(goal => { goal.flags = ['bank', 'dunk']; });
    expect(points(g, 'Special goals')).toBe(12.5);
    expect(points(g, 'Game length')).toBe(6);
    g.goals.forEach(goal => { goal.flags = []; });
    g.goals[0].flags = ['bank', 'dunk'];
    g.goals[1] = { ...g.goals[1], actor_side: 'a', flags: ['own_goal', 'dunk'] };
    expect(points(g, 'Special goals')).toBe(1);
  });
  it.each([[8,20],[7,16],[6,12],[5,8],[4,4],[3,0],[0,0]])('awards the close-finish bonus for 10–%i', (loser, expected) => {
    expect(points(game('b'.repeat(loser)+'a'.repeat(10)), 'Close finish')).toBe(expected);
  });
  it('puts a close 10–8 ahead of a 10–4 with an early reversal and three special goals', () => {
    const close = game('aaaabbbb' + 'ab'.repeat(4) + 'aa');
    const blowout = game('ababbbbbbbabab');
    blowout.goals.slice(0,3).forEach(goal => { goal.flags = ['dunk']; });
    expect(classicScore(close)!.total).toBeGreaterThan(classicScore(blowout)!.total);
    expect(classicScore(close)!.factors.reduce((sum,f)=>sum+f.max,0)).toBe(100);
    expect(points(game('ab'.repeat(10)+'aa'), 'Total goals')).toBe(10);
    expect(points(game('ab'.repeat(13)+'aa'), 'Total goals')).toBe(12.5);
    expect(points(game('ab'.repeat(13)+'aa'), 'Close finish')).toBe(20);
  });
  it('is invariant to side swaps and ignores time spent waiting to finish', () => {
    const g = game('ababababbbbbb' + 'aaaaaaa');
    const flipped: Game = { ...g, ended_at: '2026-11-03T00:00:00Z', goals: g.goals.map(goal => ({ ...goal, actor_side: goal.actor_side === 'a' ? 'b' : 'a' })) };
    expect(classicScore(g)!.total).toBe(classicScore(flipped)!.total);
  });
  it('ranks across rivalries, skips missing rivalries and breaks ties deterministically', () => {
    const low = game('aaaaaaaaaa'), high = game('ababababbbbbb' + 'aaaaaaa');
    const rows = rankedClassics([{...low,id:'low'}, {...high,id:'b',rivalry_id:'other'}, {...high,id:'a'}, {...high,id:'orphan',rivalry_id:'missing'}], [rivalry,{...rivalry,id:'other'}]);
    expect(rows.map(row => row.game.id)).toEqual(['a','b','low']);
    expect(rows.every(row => Number.isFinite(row.rating.total) && row.rating.total >= 0)).toBe(true);
  });
  it('lets exceptional games exceed 100 while keeping finish and closeness bounded', () => {
    const g=game('a'+'bbaa'.repeat(12)+'a',30000);
    g.goals.forEach(goal=>{goal.flags=['dunk'];});
    const rating=classicScore(g)!;
    expect(rating.total).toBeGreaterThan(100);
    expect(points(g,'Lead changes')).toBeGreaterThan(15);
    expect(points(g,'Total goals')).toBeGreaterThan(10);
    expect(points(g,'Close finish')).toBe(20);
    expect(points(g,'Closeness')).toBeLessThanOrEqual(20);
  });
  it('rates the 12–10 late-comeback example around 92 with achievable benchmarks', () => {
    const g=game('baababbbaabbbbaaaaabaa',431000/22);
    g.goals[0].flags=['dunk']; g.goals[1].flags=['bank'];
    const rating=classicScore(g)!;
    expect(rating.highlights.leadChanges).toBe(3);
    expect(rating.highlights.moments.comeback?.value).toBe(4);
    expect(rating.total).toBeCloseTo(91.7658,3);
  });
  it('breaks rating ties by actual time, including mixed offsets and equivalent instants', () => {
    const g = game('aaaaaaaaaa');
    const rows = rankedClassics([
      {...g, id:'later', started_at:'2026-11-02T01:00:00-08:00'},
      {...g, id:'b', started_at:'2026-11-02T08:00:00Z'},
      {...g, id:'a', started_at:'2026-11-02T00:00:00-08:00'},
    ], [rivalry]);
    expect(rows.map(row => row.game.id)).toEqual(['a', 'b', 'later']);
  });
});
