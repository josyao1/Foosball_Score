import { RUNGS } from './types';
import type { Game, Rung, Side } from './types';
import type { ScoreBucket } from './scorigami';

export type OddityId = 'dunks' | 'banks' | 'ownGoals' | 'rung' | 'specials';
export interface OddityMatch {
  game: Game;
  holders: { side: Side; rung: Rung }[];
}
export interface OddityRecord {
  id: OddityId;
  value: number;
  matches: OddityMatch[];
}

/** Input is the same active, valid, finished games shown in the score charts. */
export function scorigamiRecords(games: Game[]): OddityRecord[] {
  const records: OddityRecord[] = (['dunks', 'banks', 'ownGoals', 'rung', 'specials'] as const)
    .map(id => ({ id, value: 0, matches: [] }));
  for (const game of games) {
    const totals = { dunks: 0, banks: 0, ownGoals: 0, specials: 0, rung: 0 };
    const rungs = { a: { goalie: 0, defender: 0, middle: 0, attacker: 0 }, b: { goalie: 0, defender: 0, middle: 0, attacker: 0 } };
    for (const goal of game.goals) {
      const own = goal.flags.includes('own_goal');
      const dunk = goal.flags.includes('dunk'), bank = goal.flags.includes('bank');
      if (own || dunk || bank) totals.specials++;
      if (own) totals.ownGoals++;
      else {
        if (dunk) totals.dunks++;
        if (bank) totals.banks++;
        // Both teammates and all position assignments contribute to their side.
        rungs[goal.actor_side][goal.rung]++;
      }
    }
    totals.rung = Math.max(...Object.values(rungs.a), ...Object.values(rungs.b));
    const holders = (['a', 'b'] as const).flatMap(side => RUNGS
      .filter(rung => rungs[side][rung] === totals.rung && totals.rung > 0)
      .map(rung => ({ side, rung })));
    for (const record of records) {
      const value = totals[record.id];
      if (!value || value < record.value) continue;
      if (value > record.value) { record.value = value; record.matches = []; }
      record.matches.push({ game, holders: record.id === 'rung' ? holders : [] });
    }
  }
  for (const record of records) record.matches.sort((a, b) =>
    Date.parse(b.game.ended_at!) - Date.parse(a.game.ended_at!) || b.game.id.localeCompare(a.game.id));
  return records;
}

export function missingScores(buckets: Map<string, ScoreBucket>, maxScore: number) {
  const regular = Array.from({ length: 9 }, (_, low) => ({ high: 10, low }))
    .filter(({ high, low }) => !buckets.has(`${high}-${low}`));
  const overtime = Array.from({ length: Math.max(1, maxScore - 9) }, (_, i) => ({ high: i + 11, low: i + 9 }))
    .filter(({ high, low }) => !buckets.has(`${high}-${low}`));
  return [...regular, ...overtime];
}
