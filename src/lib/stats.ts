import { RUNGS, otherSide } from "./types";
import type { Game, Goal, Rung, Side } from "./types";
export const creditedSide = (goal: Goal): Side =>
  goal.flags.includes("own_goal")
    ? otherSide(goal.actor_side)
    : goal.actor_side;
export const orderedGoals = (goals: Goal[]) =>
  [...goals].sort(
    (a, b) =>
      a.elapsed_ms - b.elapsed_ms ||
      a.occurred_at.localeCompare(b.occurred_at) ||
      a.id.localeCompare(b.id),
  );
export function score(goals: Goal[]) {
  return goals.reduce(
    (s, g) => {
      s[creditedSide(g)]++;
      return s;
    },
    { a: 0, b: 0 },
  );
}
export function winner(game: Game): Side | null {
  const s = score(game.goals);
  return s.a === s.b ? null : s.a > s.b ? "a" : "b";
}
export const isWinningScore = (s: Record<Side, number>) =>
  Math.max(s.a, s.b) >= 10 && Math.abs(s.a - s.b) >= 2;
export const clock = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
export const duration = (g: Game, now = Date.now()) =>
  Math.max(
    0,
    (g.ended_at ? Date.parse(g.ended_at) : now) - Date.parse(g.started_at),
  );
export { gameDate as dateLabel } from './time';
export function gameStats(game: Game) {
  const rungs = {
    a: Object.fromEntries(RUNGS.map((r) => [r, 0])) as Record<Rung, number>,
    b: Object.fromEntries(RUNGS.map((r) => [r, 0])) as Record<Rung, number>,
  };
  const dunks = { a: 0, b: 0 },
    banks = { a: 0, b: 0 },
    ownGoals = { a: 0, b: 0 },
    maxLead = { a: 0, b: 0 },
    s = { a: 0, b: 0 };
  const momentum = [{ elapsed: 0, a: 0, b: 0, lead: 0 }];
  for (const g of orderedGoals(game.goals)) {
    s[creditedSide(g)]++;
    if (g.flags.includes("own_goal")) ownGoals[g.actor_side]++;
    else rungs[g.actor_side][g.rung]++;
    if (g.flags.includes("dunk")) dunks[g.actor_side]++;
    if (g.flags.includes("bank")) banks[g.actor_side]++;
    maxLead.a = Math.max(maxLead.a, s.a - s.b);
    maxLead.b = Math.max(maxLead.b, s.b - s.a);
    momentum.push({ elapsed: g.elapsed_ms, a: s.a, b: s.b, lead: s.a - s.b });
  }
  return { rungs, dunks, banks, ownGoals, maxLead, momentum };
}
export function rivalryStats(games: Game[]) {
  const completed = games
    .filter((g) => g.ended_at)
    .sort(
      (a, b) =>
        Date.parse(a.ended_at!) - Date.parse(b.ended_at!) ||
        a.id.localeCompare(b.id),
    );
  const wins = { a: 0, b: 0 },
    goals = { a: 0, b: 0 },
    longestStreak = { a: 0, b: 0 };
  let draws = 0;
  let streak: { side: Side | null; count: number } = { side: null, count: 0 };
  let blowout: { game: Game; margin: number; side: Side } | null = null,
    choke: { game: Game; lead: number; side: Side } | null = null;
  for (const game of completed) {
    const s = score(game.goals),
      w = winner(game);
    goals.a += s.a;
    goals.b += s.b;
    if (!w) {
      draws++;
      streak = { side: null, count: 0 };
      continue;
    }
    wins[w]++;
    streak =
      streak.side === w
        ? { side: w, count: streak.count + 1 }
        : { side: w, count: 1 };
    longestStreak[w] = Math.max(longestStreak[w], streak.count);
    const margin = Math.abs(s.a - s.b);
    if (!blowout || margin > blowout.margin)
      blowout = { game, margin, side: w };
    const losing = otherSide(w),
      lead = gameStats(game).maxLead[losing];
    if (lead > 0 && (!choke || lead > choke.lead))
      choke = { game, lead, side: losing };
  }
  return {
    wins,
    draws,
    goals,
    totalGoals: goals.a + goals.b,
    streak,
    longestStreak,
    blowout,
    choke,
    completed: completed.length,
  };
}
