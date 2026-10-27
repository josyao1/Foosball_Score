export type Side = "a" | "b";
export const RUNGS = ["goalie", "defender", "middle", "attacker"] as const;
export type Rung = (typeof RUNGS)[number];
export type GoalFlag = "dunk" | "bank" | "own_goal";
export interface Goal {
  id: string;
  actor_side: Side;
  rung: Rung;
  flags: GoalFlag[];
  elapsed_ms: number;
  occurred_at: string;
}
export interface Game {
  id: string;
  rivalry_id: string;
  started_at: string;
  ended_at: string | null;
  revision: number;
  goals: Goal[];
}
export interface Rivalry {
  id: string;
  player_a: string;
  player_b: string;
  created_at: string;
}
export interface Data {
  rivalries: Rivalry[];
  games: Game[];
}
export const otherSide = (side: Side): Side => (side === "a" ? "b" : "a");
export const playerName = (r: Rivalry, s: Side) =>
  s === "a" ? r.player_a : r.player_b;
