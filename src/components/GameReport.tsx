import {GoalBall, GoalLegend} from "./GoalBall";
import { Pencil, Trash2, Zap, CornerUpRight, Undo2 } from "lucide-react";
import {
  clock,
  creditedSide,
  gameStats,
  orderedGoals,
} from "../lib/stats";
import { RUNGS, playerName } from "../lib/types";
import type { Game, Goal, Rivalry } from "../lib/types";
export { MomentumChart as Momentum } from "./MomentumChart";
export function RungStats({ game, rivalry }: { game: Game; rivalry: Rivalry }) {
  const s = gameStats(game);
  return (
    <section className="panel">
      <div className="section-heading compact">
        <div>
          <h2>Goals by rung</h2>
          <p>Goals by rung, excluding own goals.</p>
        </div>
      </div>
      <div className="rung-stat-legend">
        <span className="text-a">{rivalry.player_a}</span>
        <span className="text-b">{rivalry.player_b}</span>
      </div>
      {RUNGS.map((r) => (
        <div className="rung-stat" key={r}>
          <strong className="text-a">{s.rungs.a[r]}</strong>
          <div className="rung-bar left">
            <i
              style={{
                width: `${(s.rungs.a[r] / Math.max(1, ...Object.values(s.rungs.a), ...Object.values(s.rungs.b))) * 100}%`,
              }}
            />
          </div>
          <span>{r}</span>
          <div className="rung-bar right">
            <i
              style={{
                width: `${(s.rungs.b[r] / Math.max(1, ...Object.values(s.rungs.a), ...Object.values(s.rungs.b))) * 100}%`,
              }}
            />
          </div>
          <strong className="text-b">{s.rungs.b[r]}</strong>
        </div>
      ))}
      <div className="shot-totals">
        {[
          { label: "Dunks", data: s.dunks },
          { label: "Bank shots", data: s.banks },
          { label: "Own goals made", data: s.ownGoals },
        ].map(({ label, data }) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              <em className="text-a">{data.a}</em>
              <span> / </span>
              <em className="text-b">{data.b}</em>
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
export function Timeline({
  game,
  rivalry,
  onEdit,
  onRemove,
  compact = false,
}: {
  game: Game;
  rivalry: Rivalry;
  onEdit?: (g: Goal) => void;
  onRemove?: (g: Goal) => void;
  compact?: boolean;
}) {
  const s = { a: 0, b: 0 };
  const entries = orderedGoals(game.goals).map((goal) => {
    s[creditedSide(goal)]++;
    return { goal, a: s.a, b: s.b };
  });
  if (compact) entries.reverse();
  return (
    <section className="panel timeline-panel">
      <div className="section-heading compact">
        <div>
          <h2>{compact ? "Goal feed" : "Goal timeline"}</h2>
          <p>{compact ? "Latest goal first." : "Goals in order."}</p>
        </div>
        <span className="count-badge">{game.goals.length} goals</span>
      </div>
      <GoalLegend/>
      {!entries.length ? (
        <div className="empty-inline">No goals yet.</div>
      ) : (
        <ol className="timeline">
          {entries.map(({ goal, a, b }) => (
            <li key={goal.id}>
              <time>{clock(goal.elapsed_ms)}</time>
              <GoalBall flags={goal.flags}/>
              <div className="timeline-description">
                <strong>{playerName(rivalry, creditedSide(goal))}</strong>
                <span>
                  {goal.flags.includes("own_goal")
                    ? `${playerName(rivalry, goal.actor_side)} own goal · `
                    : ""}
                  {goal.rung} rung
                </span>
                <div className="goal-tags">
                  {goal.flags.map((f) => (
                    <span key={f}>
                      {f === "dunk" ? (
                        <Zap size={11} />
                      ) : f === "bank" ? (
                        <CornerUpRight size={11} />
                      ) : (
                        <Undo2 size={11} />
                      )}{" "}
                      {f === "own_goal"
                        ? "Own goal"
                        : f === "bank"
                          ? "Bank"
                          : "Dunk"}
                    </span>
                  ))}
                </div>
              </div>
              <strong className="timeline-score">
                <span className="text-a">{a}</span>
                <span className="muted"> – </span>
                <span className="text-b">{b}</span>
              </strong>
              {onEdit && (
                <button
                  className="icon-button"
                  onClick={() => onEdit(goal)}
                  aria-label={`Edit goal at ${clock(goal.elapsed_ms)}`}
                >
                  <Pencil size={15} />
                </button>
              )}
              {onRemove && (
                <button
                  className="icon-button"
                  onClick={() => onRemove(goal)}
                  aria-label={`Remove goal at ${clock(goal.elapsed_ms)}`}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
