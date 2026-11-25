import { Flag, Flame } from 'lucide-react';
import { useContext, type CSSProperties } from 'react';
import { PlayerAppearanceContext } from '../lib/PlayerAppearanceContext';
import { playerAppearance } from '../lib/playerAppearance';
import { clock, creditedSide, orderedGoals } from '../lib/stats';
import { goalPlayer, sidePlayers } from '../lib/participants';
import { playerName, type Game, type Goal, type Rivalry, type Side } from '../lib/types';
import { GoalActions } from './GoalActions';
import { GoalBall, GoalLegend, goalKind, GOAL_LABELS } from './GoalBall';
import { PlayerJersey } from './PlayerJersey';
import './goal-lane-timeline.css';

function laneEntries(game: Game, rivalry: Rivalry) {
  const goals = orderedGoals(game.goals);
  const score = { a: 0, b: 0 };
  let lastLeader: Side | null = null;
  let runStart = 0;
  return goals.map((goal, index) => {
    const side = creditedSide(goal);
    score[side]++;
    const leader = score.a === score.b ? null : score.a > score.b ? 'a' : 'b';
    const landmark = index === 0 ? 'Opening goal'
      : leader && lastLeader && leader !== lastLeader ? 'Takes the lead' : null;
    if (leader) lastLeader = leader;
    if (index === 0 || creditedSide(goals[index - 1]) !== side) runStart = index;
    const runLength = index - runStart + 1;
    const runEnds = index === goals.length - 1 || creditedSide(goals[index + 1]) !== side;
    const actor = sidePlayers(rivalry, goal.actor_side).find(player => player.id === goalPlayer(goal, rivalry));
    return {
      goal, side, actor, landmark, a: score.a, b: score.b,
      run: runEnds && runLength >= 3 ? { count: runLength, start: goals[runStart].elapsed_ms } : null,
    };
  });
}

export function GoalLaneTimeline({ game, rivalry, onEdit, onRemove }: {
  game: Game;
  rivalry: Rivalry;
  onEdit?: (goal: Goal) => void;
  onRemove?: (goal: Goal) => void;
}) {
  const players = useContext(PlayerAppearanceContext);
  const entries = laneEntries(game, rivalry);
  const longScore = entries.some(entry => entry.a >= 100 || entry.b >= 100);
  return <section className="panel goal-lanes-panel" aria-label="Goal timeline">
    <div className={`goal-lanes-content${longScore ? ' goal-lanes-long-score' : ''}`}>
      <header className="goal-lanes-heading">
        <h2>Goal timeline</h2>
        <span>{entries.length} {entries.length === 1 ? 'goal' : 'goals'}</span>
      </header>
      <div className="goal-lanes-teams">
        {(['a', 'b'] as const).map(side => <div key={side} className={`goal-lane-team goal-lane-team-${side}`} role="group" aria-label={`${side === 'a' ? 'Left' : 'Right'} side: ${playerName(rivalry, side)}`}>
          <span className="goal-lane-color"><span className={`goal-lane-dot goal-lane-dot-${side}`} aria-hidden="true"/>{side === 'a' ? 'Black' : 'White'}</span>
          {sidePlayers(rivalry, side).map(player => <div className="goal-lane-person" key={player.id}>
            <PlayerJersey name={player.name} appearance={player.appearance ?? undefined} decorative/>
            <strong>{player.name}</strong>
          </div>)}
        </div>)}
        <span className="goal-lanes-score-label">Score</span>
      </div>
      {!entries.length ? <div className="empty-inline">No goals yet.</div> : <ol className="goal-lanes-list" aria-label="Goals in order" role="list">
        {entries.map(({ goal, side, actor, landmark, a, b, run }) => {
          const own = goal.flags.includes('own_goal');
          const team = sidePlayers(rivalry, goal.actor_side).length > 1;
          const kind = goalKind(goal.flags);
          const rung = goal.rung[0].toUpperCase() + goal.rung.slice(1);
          const actorName = actor?.name ?? playerName(rivalry, goal.actor_side);
          // Match the jersey source while keeping unassigned and own-goal credit neutral.
          const jersey = actor && !own ? playerAppearance(actor.appearance ? actor : players.find(player =>
            player.id === actor.id || player.name.toLowerCase() === actor.name.trim().toLowerCase()) ?? actor) : null;
          const primary = own ? 'Own goal' : team && actor ? actor.name : kind === 'regular' ? rung : GOAL_LABELS[kind];
          const secondary = own ? `By ${actorName}` : team && actor ? `${rung}${kind !== 'regular' ? ` · ${GOAL_LABELS[kind]}` : ''}` : kind !== 'regular' ? rung : null;
          return <li key={goal.id} className="goal-lane-row" data-scoring-side={side}>
            <div className={`goal-lane-event${jersey ? ' goal-lane-event-tinted' : ''}`} data-side={side}
              style={jersey ? { '--scorer-color': jersey.color, '--scorer-trim': jersey.trim } as CSSProperties : undefined}>
              <div className="goal-lane-event-title"><GoalBall flags={goal.flags} size={20}/><strong className={!own && team && actor ? 'timeline-individual-scorer' : undefined}>{primary}</strong></div>
              {secondary && <span className={`goal-lane-detail${own ? ' goal-lane-own-actor' : ''}`}>{secondary}</span>}
              {own && <span className="goal-lane-detail">{rung}</span>}
              {!own && team && !actor && <span className="goal-lane-detail">Scorer not recorded</span>}
              <div className="goal-lane-event-meta">
                <time>{clock(goal.elapsed_ms)}</time>
                {(onEdit || onRemove) && <GoalActions
                  time={clock(goal.elapsed_ms)}
                  description={`${own ? `${playerName(rivalry, side)} · own goal by ${actorName}` : actorName} · ${goal.rung} rung${!own && kind !== 'regular' ? ` · ${GOAL_LABELS[kind]}` : ''}`}
                  onEdit={onEdit ? () => onEdit(goal) : undefined}
                  onRemove={onRemove ? () => onRemove(goal) : undefined}
                />}
              </div>
              {landmark && <span className="goal-lane-landmark"><Flag size={12} aria-hidden="true"/>{landmark}</span>}
            </div>
            <div className="goal-lane-spine">
              <span className="goal-lane-score" aria-label={`${playerName(rivalry, 'a')} ${a}, ${playerName(rivalry, 'b')} ${b}`}>
                <span className={side === 'a' ? 'timeline-score-changed' : 'timeline-score-unchanged'}>{a}</span>
                <span className="goal-lane-score-dash">–</span>
                <span className={side === 'b' ? 'timeline-score-changed' : 'timeline-score-unchanged'}>{b}</span>
              </span>
            </div>
            {run && <div className="goal-lane-run">
              <span><Flame size={14} aria-hidden="true"/><span>{playerName(rivalry, side)} · <strong>{run.count} unanswered</strong></span></span>
              <time>{clock(run.start)}–{clock(goal.elapsed_ms)}</time>
            </div>}
          </li>;
        })}
      </ol>}
      <details className="goal-lanes-key"><summary>Goal types</summary><GoalLegend/></details>
    </div>
  </section>;
}
