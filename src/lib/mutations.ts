import type { Game, Goal } from "./types";
function checkRevision(game: Game, revision: number) {
  if (game.revision !== revision)
    throw new Error(
      "This game changed while this dialog was open. Close it, review the latest score, and try again.",
    );
}
export function changeGoal(
  game: Game,
  revision: number,
  goal: Goal,
  editing: boolean,
): Game {
  checkRevision(game, revision);
  if (!editing && game.ended_at)
    throw new Error(
      "This game was finished elsewhere. Close this dialog to see the result.",
    );
  if (editing && !game.goals.some((g) => g.id === goal.id))
    throw new Error(
      "This goal was removed elsewhere. Close this dialog to refresh.",
    );
  return {
    ...game,
    goals: [...game.goals.filter((g) => g.id !== goal.id), goal],
  };
}
export function removeGoal(
  game: Game,
  revision: number,
  targetId: string,
): Game {
  checkRevision(game, revision);
  return { ...game, goals: game.goals.filter((g) => g.id !== targetId) };
}
