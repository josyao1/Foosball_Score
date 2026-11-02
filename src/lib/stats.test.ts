import { describe, expect, it } from "vitest";
import {
  score,
  winner,
  isWinningScore,
  rivalryStats,
  gameStats,
  clock,
  playingTime,
  playingTimeLabel,
} from "./stats";
import type { Game, Goal, Side } from "./types";
const goals = (sides: Side[]): Goal[] =>
  sides.map((side, i) => ({
    id: `g${i}`,
    actor_side: side,
    rung: "attacker",
    flags: [],
    elapsed_ms: (i + 1) * 1000,
    occurred_at: new Date(100000 + (i + 1) * 1000).toISOString(),
  }));
const game = (sides: Side[], n = 0, complete = true): Game => ({
  id: `m${n}`,
  rivalry_id: "r",
  started_at: new Date(100000 + n * 100000).toISOString(),
  ended_at: complete ? new Date(199000 + n * 100000).toISOString() : null,
  revision: 1,
  goals: goals(sides),
});
describe("scoring", () => {
  it("credits own goals to the opponent, retaining the actor rung", () => {
    const g = goals(["a", "a"]);
    g[1].flags = ["own_goal"];
    g[1].rung = "goalie";
    expect(score(g)).toEqual({ a: 1, b: 1 });
    expect(gameStats({ ...game([]), goals: g }).rungs.b.goalie).toBe(0);
    expect(gameStats({ ...game([]), goals: g }).ownGoals.a).toBe(1);
  });
  it("requires 10 goals and a two-goal margin", () => {
    expect(isWinningScore({ a: 10, b: 9 })).toBe(false);
    expect(isWinningScore({ a: 11, b: 9 })).toBe(true);
    expect(isWinningScore({ a: 8, b: 6 })).toBe(false);
    expect(isWinningScore({ a: 13, b: 15 })).toBe(true);
  });
  it("treats an early tied finish as a draw", () => {
    expect(winner(game(["a", "b"]))).toBe(null);
  });
  it("formats seconds without dropping minute boundaries", () => {
    expect(clock(61999)).toBe("1:01");
    expect(clock(0)).toBe("0:00");
  });
});
describe("rivalry history", () => {
  it("ignores live games and breaks a streak at a draw", () => {
    const s = rivalryStats([
      game(["a"], 1),
      game(["a"], 2),
      game(["a", "b"], 3),
      game(["b"], 4),
      game(["a"], 5, false),
    ]);
    expect(s.wins).toEqual({ a: 2, b: 1 });
    expect(s.draws).toBe(1);
    expect(s.streak).toEqual({ side: "b", count: 1 });
    expect(s.totalGoals).toBe(5);
  });
  it("finds the largest surrendered lead from the losing player only", () => {
    const comeback = game(["a", "a", "a", "b", "b", "b", "b"], 1);
    const s = rivalryStats([comeback, game(["a", "a"], 2)]);
    expect(s.choke?.lead).toBe(3);
    expect(s.choke?.side).toBe("a");
    expect(s.blowout?.margin).toBe(2);
  });
  it("handles empty rivalries", () => {
    const s = rivalryStats([]);
    expect(s.wins).toEqual({ a: 0, b: 0 });
    expect(s.streak).toEqual({ side: null, count: 0 });
    expect(s.choke).toBe(null);
  });
  it("counts combined dunk/bank flags and excludes own goals from offensive rungs", () => {
    const g = game(["a", "a", "b"]);
    g.goals[0].flags = ["dunk", "bank"];
    g.goals[1].flags = ["own_goal"];
    const s = gameStats(g);
    expect(s.dunks.a).toBe(1);
    expect(s.banks.a).toBe(1);
    expect(s.rungs.a.attacker).toBe(1);
    expect(s.rungs.b.attacker).toBe(1);
  });
});

describe('time spent playing', () => {
  const timed = (ms: number, complete = true) => ({ ...game(['a'], 0, complete), goals: [{ ...goals(['a'])[0], elapsed_ms: ms }] });
  it('sums the last goal of completed games and rounds the total once', () => {
    const games = [timed(20000), timed(20000), timed(900000, false), game([])];
    expect(playingTime(games)).toBe(40000);
    expect(playingTimeLabel(playingTime(games))).toBe('1 min');
    expect(rivalryStats(games).playingMs).toBe(40000);
  });
  it('ignores finish-button delays and goal array ordering', () => {
    const g = timed(90000);
    g.goals.push({ ...g.goals[0], id:'earlier', elapsed_ms:1000 });
    expect(playingTime([g])).toBe(90000);
    expect(playingTimeLabel(playingTime([g]))).toBe('2 min');
  });
  it('formats empty time and minute/hour boundaries without seconds', () => {
    expect(playingTimeLabel(playingTime([]))).toBe('0 min');
    expect(playingTimeLabel(29999)).toBe('0 min');
    expect(playingTimeLabel(30000)).toBe('1 min');
    expect(playingTimeLabel(59.5 * 60000)).toBe('1h 0m');
    expect(playingTimeLabel(125 * 60000)).toBe('2h 5m');
  });
});
