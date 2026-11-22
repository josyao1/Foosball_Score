import { RUNGS } from './types';
import type { Game, Rung, Side } from './types';
import type { ScoreBucket } from './scorigami';
import { creditedSide, matchPointSide } from './stats';
import { gameHighlights } from './records';
import type { Moment } from './records';

export type OddityId = 'dunks' | 'banks' | 'ownGoals' | 'rung' | 'run' | 'comeback' | 'leadChanges' | 'triple' | 'matchPoints' | 'specials';
export interface OddityMatch {
  game: Game;
  holders: { side: Side; rung: Rung }[];
  run?: { side: Side; durationMs: number };
  moment?: Moment;
  savedSides?: Side[];
}
export interface OddityRecord {
  id: OddityId;
  value: number;
  matches: OddityMatch[];
}

/** Input is the same active, valid, finished games shown in the score charts. */
export function scorigamiRecords(games: Game[]): OddityRecord[] {
  const records: OddityRecord[] = (['dunks', 'banks', 'ownGoals', 'rung', 'run', 'comeback', 'leadChanges', 'triple', 'matchPoints', 'specials'] as const)
    .map(id => ({ id, value: 0, matches: [] }));
  for (const game of games) {
    const highlights = gameHighlights(game);
    const saved = {a:0,b:0};
    highlights.goals.forEach((goal,index) => {
      const threat = matchPointSide(highlights.scores[index]), side = creditedSide(goal);
      if (threat && threat !== side) saved[side]++;
    });
    const totals = { dunks: 0, banks: 0, ownGoals: 0, specials: 0, rung: 0, run: 0,
      comeback: highlights.moments.comeback?.value ?? 0, leadChanges: highlights.leadChanges,
      triple: highlights.moments.triple?.value ?? null, matchPoints: Math.max(saved.a,saved.b) };
    let run: OddityMatch['run'];
    let runSide: Side | undefined, runCount = 0, runStart = 0;
    for (const goal of highlights.goals) {
      const side = creditedSide(goal);
      if (side !== runSide) { runSide = side; runCount = 0; runStart = goal.elapsed_ms; }
      runCount++;
      const durationMs = goal.elapsed_ms - runStart;
      if (runCount > totals.run || (runCount === totals.run && durationMs < (run?.durationMs ?? Infinity))) {
        totals.run = runCount;
        run = {side,durationMs};
      }
    }
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
      const lowerWins = record.id === 'triple';
      if (value === null || (!lowerWins && !value)) continue;
      if (record.matches.length && (lowerWins ? value > record.value : value < record.value)) continue;
      if (!record.matches.length || value !== record.value) { record.value = value; record.matches = []; }
      const moment = record.id === 'comeback' || record.id === 'leadChanges' || record.id === 'triple'
        ? highlights.moments[record.id] : undefined;
      record.matches.push({ game, holders: record.id === 'rung' ? holders : [],
        ...(record.id === 'run' ? {run} : {}), ...(moment ? {moment} : {}),
        ...(record.id === 'matchPoints' ? {savedSides: (['a','b'] as const).filter(side=>saved[side]===value)} : {}) });
    }
  }
  for (const record of records) record.matches.sort((a, b) =>
    (record.id === 'specials' ? a.game.goals.length - b.game.goals.length : 0) ||
    (record.id === 'run' ? a.run!.durationMs - b.run!.durationMs : 0) ||
    Date.parse(b.game.ended_at!) - Date.parse(a.game.ended_at!) || b.game.id.localeCompare(a.game.id));
  return records;
}

/** Prefer a different game for the feature without changing the record or its ties. */
export function featuredSpecialGame(records: OddityRecord[]) {
  const matches = records.find(record => record.id === 'specials')?.matches ?? [];
  const displayed = new Set(records.filter(record => record.id !== 'specials')
    .map(record => record.matches[0]?.game.id));
  // Special matches are already ordered by highest percentage, then recency.
  return matches.find(match => !displayed.has(match.game.id)) ?? matches[0];
}

export function missingScores(buckets: Map<string, ScoreBucket>, maxScore: number) {
  const regular = Array.from({ length: 9 }, (_, low) => ({ high: 10, low }))
    .filter(({ high, low }) => !buckets.has(`${high}-${low}`));
  const overtime = Array.from({ length: Math.max(1, maxScore - 9) }, (_, i) => ({ high: i + 11, low: i + 9 }))
    .filter(({ high, low }) => !buckets.has(`${high}-${low}`));
  return [...regular, ...overtime];
}
