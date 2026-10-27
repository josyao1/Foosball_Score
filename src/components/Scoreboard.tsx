import { playerName } from "../lib/types";
import type { Rivalry, Side } from "../lib/types";
export function Avatar({
  name,
  side,
  large = false,
}: {
  name: string;
  side: Side;
  large?: boolean;
}) {
  return (
    <span className={`avatar side-${side} ${large ? "large" : ""}`}>
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
export function Scoreboard({
  rivalry,
  scores,
  label = "Final score",
}: {
  rivalry: Rivalry;
  scores: Record<Side, number>;
  label?: string;
}) {
  return (
    <div className="scoreboard">
      <div className="score-player side-a">
        <Avatar name={rivalry.player_a} side="a" />
        <span className="player-name">{playerName(rivalry, "a")}</span>
        <strong className="score-number">{scores.a}</strong>
      </div>
      <div className="score-divider">
        <span>{label}</span>
        <b>:</b>
      </div>
      <div className="score-player side-b">
        <Avatar name={rivalry.player_b} side="b" />
        <span className="player-name">{playerName(rivalry, "b")}</span>
        <strong className="score-number">{scores.b}</strong>
      </div>
    </div>
  );
}
