import { creditedSide, isWinningScore, orderedGoals, score, winner } from './stats';
import { RUNGS, otherSide } from './types';
import type { Game, Side } from './types';

export type RecordKind = 'run' | 'burst' | 'quickest' | 'triple' | 'response' | 'comeback' | 'leadChanges';
export interface Moment {
  kind: RecordKind;
  value: number;
  side: Side | null;
  start: number;
  end: number;
}
export const recordLabels: Record<RecordKind, string> = {
  run: 'Biggest run', burst: '30-second burst', quickest: 'Quickest win',
  triple: 'Fastest three goals', response: 'Fastest response',
  comeback: 'Biggest comeback', leadChanges: 'Most lead changes',
};
const lowerWins = new Set<RecordKind>(['quickest', 'triple', 'response']);
export function gameHighlights(game: Game) {
  const goals = orderedGoals(game.goals);
  const scores: Record<Side, number>[] = [{ a: 0, b: 0 }];
  const timeAhead = { a: 0, b: 0, tied: 0 };
  const rungSets = { a: new Set<string>(), b: new Set<string>() };
  const moments: Partial<Record<RecordKind, Moment>> = {};
  const largestDeficit = { a: 0, b: 0 }, deficitIndex = { a: 0, b: 0 };
  let previousLeader: Side | null = null, leadChanges = 0, reachedDeuce = false;
  let runStart = 0, lastTime = 0, wonBeforeLast = false;
  const credited = goals.map(creditedSide);
  const consider = (candidate: Moment) => {
    const old = moments[candidate.kind];
    if (!old || (lowerWins.has(candidate.kind) ? candidate.value < old.value : candidate.value > old.value)) moments[candidate.kind] = candidate;
  };
  goals.forEach((goal, i) => {
    const before = scores[i], side = credited[i];
    const leading = before.a === before.b ? 'tied' : before.a > before.b ? 'a' : 'b';
    timeAhead[leading] += goal.elapsed_ms - lastTime;
    lastTime = goal.elapsed_ms;
    const after = { ...before, [side]: before[side] + 1 };
    scores.push(after);
    if (i < goals.length - 1 && isWinningScore(after)) wonBeforeLast = true;
    if (after.a === 9 && after.b === 9) reachedDeuce = true;
    const leader = after.a === after.b ? null : after.a > after.b ? 'a' : 'b';
    if (leader && previousLeader && leader !== previousLeader) leadChanges++;
    if (leader) previousLeader = leader;
    for (const s of ['a', 'b'] as const) {
      const deficit = after[otherSide(s)] - after[s];
      if (deficit > largestDeficit[s]) { largestDeficit[s] = deficit; deficitIndex[s] = i; }
    }
    if (!goal.flags.includes('own_goal')) rungSets[goal.actor_side].add(goal.rung);
    if (i === 0 || credited[i - 1] !== side) runStart = i;
    consider({ kind: 'run', value: i - runStart + 1, side, start: runStart, end: i });
    if (i > 0 && credited[i - 1] !== side) consider({ kind: 'response', value: goal.elapsed_ms - goals[i - 1].elapsed_ms, side, start: i - 1, end: i });
  });
  for (const side of ['a', 'b'] as const) {
    const indices = goals.map((_, i) => i).filter(i => credited[i] === side);
    let left = 0;
    indices.forEach((index, right) => {
      while (goals[index].elapsed_ms - goals[indices[left]].elapsed_ms > 30000) left++;
      consider({ kind: 'burst', value: right - left + 1, side, start: indices[left], end: index });
      if (right >= 2) consider({ kind: 'triple', value: goals[index].elapsed_ms - goals[indices[right - 2]].elapsed_ms, side, start: indices[right - 2], end: index });
    });
  }
  const final = scores.at(-1)!;
  const w = winner(game);
  if (game.ended_at && goals.length && w) {
    if (isWinningScore(final) && !wonBeforeLast) moments.quickest = { kind: 'quickest', value: lastTime, side: w, start: 0, end: goals.length - 1 };
    if (largestDeficit[w] > 0) moments.comeback = { kind: 'comeback', value: largestDeficit[w], side: w, start: deficitIndex[w], end: goals.length - 1 };
  }
  if (leadChanges) moments.leadChanges = { kind: 'leadChanges', value: leadChanges, side: null, start: 0, end: goals.length - 1 };
  return { moments, scores, goals, timeAhead, totalMs: lastTime, leadChanges, reachedDeuce, largestDeficit, allRungs: (['a', 'b'] as const).filter(side => rungSets[side].size === RUNGS.length) };
}
export interface BookRecord { game: Game; moment: Moment; ties: number }
export function recordBook(games: Game[]) {
  const book: Partial<Record<RecordKind, BookRecord>> = {};
  const rates = {
    a: { opener: [0, 0], clutch: [0, 0], comeback: [0, 0] },
    b: { opener: [0, 0], clutch: [0, 0], comeback: [0, 0] },
  };
  // Earliest game holds a tied record; stable IDs resolve simultaneous starts.
  const completed = games.filter(g => g.ended_at).sort((a, b) => a.started_at.localeCompare(b.started_at) || a.id.localeCompare(b.id));
  for (const game of completed) {
    const highlights = gameHighlights(game), w = winner(game);
    for (const moment of Object.values(highlights.moments)) {
      const old = book[moment.kind];
      if (!old || (lowerWins.has(moment.kind) ? moment.value < old.moment.value : moment.value > old.moment.value)) book[moment.kind] = { game, moment, ties: 0 };
      else if (moment.value === old.moment.value) old.ties++;
    }
    for (const side of ['a', 'b'] as const) {
      for (const [key, eligible] of [
        ['opener', highlights.goals.length > 0 && creditedSide(highlights.goals[0]) === side],
        ['clutch', highlights.reachedDeuce],
        ['comeback', highlights.largestDeficit[side] >= 3],
      ] as const) {
        if (eligible) { rates[side][key][1]++; if (w === side) rates[side][key][0]++; }
      }
    }
  }
  return { book, rates, completed };
}
export function selectedMoment(game: Game, key: string | null) {
  return key && Object.hasOwn(recordLabels, key) ? gameHighlights(game).moments[key as RecordKind] : undefined;
}
export function momentScore(game: Game, moment: Moment) {
  const { scores } = gameHighlights(game);
  const before = scores[moment.start + (moment.kind === 'comeback' ? 1 : 0)], after = scores[moment.end + 1];
  return `${before.a}–${before.b} → ${after.a}–${after.b}`;
}
export function recordValue(moment: Moment) {
  if (lowerWins.has(moment.kind)) {
    const seconds = Math.round(moment.value / 100) / 10;
    return seconds >= 60 ? `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}` : `${seconds}s`;
  }
  const unit = moment.kind === 'leadChanges' ? 'change' : 'goal';
  return `${moment.value} ${unit}${moment.value === 1 ? '' : 's'}`;
}
export const gameFinalScore = (game: Game) => { const s = score(game.goals); return `${s.a}–${s.b}`; };

export function momentWindow(game: Game, moment: Moment) {
  const goals = orderedGoals(game.goals);
  return { startMs: moment.kind === "quickest" || moment.kind === "leadChanges" ? 0 : goals[moment.start].elapsed_ms, endMs: goals[moment.end].elapsed_ms };
}
