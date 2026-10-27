import { expect, it } from "vitest";
import { changeGoal, removeGoal } from "./mutations";
import type { Game, Goal } from "./types";
const goal: Goal = {
  id: "one",
  actor_side: "a",
  rung: "attacker",
  flags: [],
  elapsed_ms: 1000,
  occurred_at: "2026-10-26T00:00:01Z",
};
const game: Game = {
  id: "g",
  rivalry_id: "r",
  started_at: "2026-10-26T00:00:00Z",
  ended_at: null,
  revision: 2,
  goals: [goal, { ...goal, id: "two" }],
};
it("rejects an old correction after the latest game revision has been polled", () => {
  expect(() =>
    changeGoal({ ...game, revision: 3 }, 2, { ...goal, rung: "goalie" }, true),
  ).toThrow(/changed/);
});
it("retrying a removal never removes the next goal", () => {
  const first = removeGoal(game, 2, "two");
  expect(first.goals.map((g) => g.id)).toEqual(["one"]);
  expect(() => removeGoal({ ...first, revision: 3 }, 2, "two")).toThrow(
    /changed/,
  );
  expect(game.goals).toHaveLength(2);
});
it("rejects a pending new goal when the game finished on another device", () => {
  expect(() =>
    changeGoal(
      { ...game, ended_at: "2026-10-26T00:01:00Z" },
      2,
      { ...goal, id: "three" },
      false,
    ),
  ).toThrow(/finished/);
});
it("does not resurrect a removed goal correction", () => {
  expect(() => changeGoal({ ...game, goals: [] }, 2, goal, true)).toThrow(
    /removed/,
  );
});
