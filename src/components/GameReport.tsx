import {GoalActions} from "./GoalActions";
import {GoalBall, GoalLegend, goalKind, GOAL_LABELS} from "./GoalBall";
import { Zap, CornerUpRight, Undo2 } from "lucide-react";
import {
  clock,
  creditedSide,
  orderedGoals,
} from "../lib/stats";
import { playerName } from "../lib/types";
import type { Game, Goal, Rivalry } from "../lib/types";
export { MomentumChart as Momentum } from "./MomentumChart";
export { RungStats } from "./GameRungStats";
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
                <div className="timeline-player"><strong>{playerName(rivalry, creditedSide(goal))}</strong>
                <div className="goal-tags">
                  {!!goal.flags.length && <span className={`goal-pill goal-pill-${goalKind(goal.flags)}`}>
                    {goal.flags.includes('own_goal') ? <Undo2 size={11}/> : goal.flags.includes('dunk') ? <Zap size={11}/> : <CornerUpRight size={11}/>}
                    {GOAL_LABELS[goalKind(goal.flags)]}
                  </span>}
                </div></div>
                <span className="timeline-detail">
                  {goal.flags.includes("own_goal")
                    ? `${playerName(rivalry, goal.actor_side)} own goal · `
                    : ""}
                  {goal.rung} rung
                </span>
              </div>
              <strong className="timeline-score">
                <span className={`text-a ${creditedSide(goal) === "a" ? "timeline-score-changed" : "timeline-score-unchanged"}`}>{a}</span>
                <span className="muted"> – </span>
                <span className={`text-b ${creditedSide(goal) === "b" ? "timeline-score-changed" : "timeline-score-unchanged"}`}>{b}</span>
              </strong>
              {(onEdit || onRemove) && <GoalActions
                time={clock(goal.elapsed_ms)}
                description={`${playerName(rivalry, creditedSide(goal))} · ${goal.rung} rung${goal.flags.includes('own_goal') ? ` · own goal by ${playerName(rivalry, goal.actor_side)}` : goal.flags.length ? ` · ${goal.flags.join(' + ')}` : ''}`}
                onEdit={onEdit ? () => onEdit(goal) : undefined}
                onRemove={onRemove ? () => onRemove(goal) : undefined}
              />}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
