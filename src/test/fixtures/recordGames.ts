import { otherSide, RUNGS } from '../../lib/types';
import type { Data, Game, GoalFlag, Side } from '../../lib/types';

/** Test-only fixture. Never imported by application code. */
export function createRecordDemoData(): Data {
  const rivalryId = 'records-josh-brooks', secondId = 'records-andrew-alex';
  const make = (id: string, sequence: string, date: string, spacing: number | number[], rid = rivalryId, live = false): Game => {
    const started = Date.parse(date);
    let elapsed = 0;
    const goals = [...sequence].map((letter, index) => {
      const side = letter as Side;
      elapsed += typeof spacing === 'number' ? spacing : spacing[index] ?? 18000;
      const flags: GoalFlag[] = index % 11 === 4 ? ['own_goal'] : index % 7 === 3 ? ['dunk', 'bank'] : index % 5 === 2 ? ['bank'] : index % 4 === 1 ? ['dunk'] : [];
      return { id: `${id}-goal-${String(index).padStart(3, '0')}`, actor_side: flags.includes('own_goal') ? otherSide(side) : side, rung: RUNGS[index % 4], flags, elapsed_ms: elapsed, occurred_at: new Date(started + elapsed).toISOString() };
    });
    return { id, rivalry_id: rid, started_at: date, ended_at: live ? null : new Date(started + elapsed + 8000).toISOString(), revision: 1, goals };
  };
  return {
    rivalries: [
      { id: rivalryId, player_a: 'Josh', player_b: 'Brooks', created_at: '2026-10-20T18:00:00Z' },
      { id: secondId, player_a: 'Andrew', player_b: 'Alex', created_at: '2026-10-20T18:00:00Z' },
      { id: 'records-new-rivalry', player_a: 'Josh & Brooks', player_b: 'Andrew & Alex', created_at: '2026-10-20T18:00:00Z' },
    ],
    games: [
      make('demo-comeback', 'bbbbbb' + 'aaaaaaaa' + 'b' + 'aa', '2026-10-23T19:10:00Z', 16000),
      make('demo-burst', 'aabb' + 'aaaaa' + 'bb' + 'aaa', '2026-10-24T19:15:00Z', [22000, 17000, 20000, 19000, 20000, 6000, 5000, 7000, 5000, 21000, 18000, 19000, 18000, 21000]),
      make('demo-deuce', 'abba'.repeat(4) + 'ab' + 'ba' + 'bb', '2026-10-25T19:05:00Z', 17000),
      make('demo-fast-win', 'aab' + 'aaa' + 'b' + 'aaaaa', '2026-10-26T19:00:00Z', 8000),
      make('demo-fast-response', 'babbbabbbbabb', '2026-10-26T19:20:00Z', [19000, 1250, 22000, 18000, 19000, 20000, 18000, 19000, 21000, 20000, 19000, 19000, 18000]),
      make('demo-early-finish', 'aabbab', '2026-10-26T19:40:00Z', 14000),
      make('demo-second-rivalry', 'ab'.repeat(8) + 'bb', '2026-10-25T20:00:00Z', 15000, secondId),
      make('demo-live', 'abbaab', new Date(Date.now() - 80000).toISOString(), 10000, secondId, true),
    ],
  };
}
