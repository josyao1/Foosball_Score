import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Flag,
  Undo2,
  Timer,
  Trophy,
  CircleCheck,
  Trash2,
} from "lucide-react";
import { gameTime } from "../lib/time";
import { useStore } from "../lib/store";
import { changeGoal, removeGoal } from "../lib/mutations";
import {
  clock,
  dateLabel,
  duration,
  isWinningScore,
  orderedGoals,
  score,
  winner,
} from "../lib/stats";
import { playerName } from "../lib/types";
import type { Game, Goal, Rung, Side } from "../lib/types";
import { useDesign } from "../components/DesignSwitcher";
import { RungControls } from "../components/RungControls";
import { GameScoreboard } from "../components/GameScoreboard";
import { GoalDialog } from "../components/GoalDialog";
import { ConfirmDialog } from "../components/Dialog";
import { Momentum, RungStats, Timeline } from "../components/GameReport";
export function GamePage() {
  const design=useDesign();
  const { id } = useParams(),
    store = useStore(),
    navigate = useNavigate(),
    [now, setNow] = useState(Date.now()),
    [draft, setDraft] = useState<Goal | null>(null),
    [editing, setEditing] = useState(false),
    [openingRevision, setOpeningRevision] = useState(0),
    [confirmationGame, setConfirmationGame] = useState<Game | null>(null),
    [confirm, setConfirm] = useState<"finish" | "discard" | "undo" | "delete" | null>(
      null,
    ),
    [removing, setRemoving] = useState<Goal | null>(null);
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    setDraft(null);
    setConfirm(null);
    setRemoving(null);
  }, [id]);
  const game = store.games.find((g) => g.id === id),
    r = store.rivalries.find((r) => r.id === game?.rivalry_id);
  if (!game || !r)
    return (
      <div className="empty-state">
        <h1>Game not found</h1>
        <Link className="button primary" to="/">
          All rivalries
        </Link>
      </div>
    );
  const live = !game.ended_at,
    s = score(game.goals),
    w = winner(game),
    won = isWinningScore(s),
    last = orderedGoals(game.goals).at(-1);
  function beginGoal(side: Side, rung: Rung) {
    const tapped = Date.now();
    setOpeningRevision(game!.revision);
    setEditing(false);
    setDraft({
      id: crypto.randomUUID(),
      actor_side: side,
      rung,
      flags: [],
      elapsed_ms: Math.max(0, tapped - Date.parse(game!.started_at)),
      occurred_at: new Date(
        Math.max(tapped, Date.parse(game!.started_at)),
      ).toISOString(),
    });
  }
  async function saveGoal(goal: Goal) {
    await store.saveGame(changeGoal(game!, openingRevision, goal, editing));
  }
  function openConfirm(kind: "finish" | "discard" | "undo" | "delete") {
    setConfirmationGame(game!);
    setConfirm(kind);
  }
  const cg = confirmationGame ?? game,
    cs = score(cg.goals),
    clast = orderedGoals(cg.goals).at(-1);

  return (
    <>
      <Link className="back-link" to={`/rivalry/${r.id}`}>
        <ArrowLeft size={16} />
        {r.player_a} vs {r.player_b}
      </Link>
      <div className="section-heading game-heading">
        <div>
          <h1>{live ? "Live game" : "Game result"}</h1>
          <p>
            {dateLabel(game.started_at)} ·{" "}
            {gameTime(game.started_at)}
          </p>
        </div>
        <span className={`status-pill ${live ? "live" : ""}`}>
          {live ? (
            <>
              <i className="dot live-dot" />
              Live game
            </>
          ) : (
            <>
              <CircleCheck size={15} />
              Finished
            </>
          )}
        </span>
      </div>
      <section className={`live-score-panel scorer-layout-${design.scorerLayout} ${live ? "is-live" : ""}`}>
        <div className="game-clock">
          <Timer size={16} />
          <span>{clock(duration(game, now))}</span>
          <span className="clock-rule">First to 10 · win by 2</span>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <GameScoreboard
            rivalry={r}
            scores={s}
            designId={design.id}
            live={live}
          />
        </div>
        {!live && (
          <div className="winner-line">
            <Trophy size={18} />
            {w ? `${playerName(r, w)} wins.` : "Draw."}
          </div>
        )}
        {live && (
          <>
            <div className="scoring-hint">Tap the rung that hit the ball.</div>
            <RungControls rivalry={r} layout={design.scorerLayout} disabled={store.busy} onGoal={beginGoal}/>
            {won && (
              <div className="winning-notice" role="status">
                <Trophy size={16} />
                {w ? playerName(r, w) : ""} has the winning score. Ready to
                finish?
              </div>
            )}
            <div className="scoring-actions">
              <button
                className="button secondary"
                disabled={!last || store.busy}
                onClick={() => openConfirm("undo")}
              >
                <Undo2 size={17} />
                Undo goal
              </button>
              <button
                className="button primary"
                disabled={!game.goals.length || store.busy}
                onClick={() => openConfirm("finish")}
              >
                <Flag size={17} />
                Finish game
              </button>
            </div>
          </>
        )}
      </section>
      {live ? (
        <div className="live-bottom">
          <Timeline
            game={game}
            rivalry={r}
            compact
            onEdit={(g) => {
              setOpeningRevision(game.revision);
              setEditing(true);
              setDraft(g);
            }}
          />
          <div className="game-tips">
            <h3>Scoring</h3>
            <p>
              Tap a rung, add any shot flags, then save. Own goals go to the
              other player.
            </p>
            <p>
              The clock keeps running if you leave. Come back here to pick up
              where you left off.
            </p>
            <span className="save-status">
              <CircleCheck size={14} />
              {store.busy
                ? "Saving…"
                : store.cloud
                  ? "Saved to the shared table"
                  : "Saved on this browser"}
            </span>
            <button
              className="text-button muted"
              disabled={store.busy}
              onClick={() => openConfirm("discard")}
            >
              <Trash2 size={14} />
              Discard game
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="report-grid">
            <Momentum game={game} rivalry={r} />
            <RungStats game={game} rivalry={r} />
          </div>
          <Timeline
            game={game}
            rivalry={r}
            onEdit={(g) => {
              setOpeningRevision(game.revision);
              setEditing(true);
              setDraft(g);
            }}
            onRemove={(g) => {
              setOpeningRevision(game.revision);
              setRemoving(g);
            }}
          />
          <div className="report-footer">
            <Link to={`/rivalry/${r.id}`} className="button primary">
              Back to rivalry
            </Link>
            <span className="muted">
              Corrections update the rivalry’s stats automatically.
            </span>
          </div>
        </>
      )}
      <div className="danger-actions"><button className="text-button muted" disabled={store.busy} onClick={()=>openConfirm('delete')}><Trash2 size={15}/>Delete game</button></div>
      {confirm==='delete'&&<ConfirmDialog title="Delete game?" description={`Delete this game (${score(cg.goals).a}–${score(cg.goals).b}) and all of its goals? Rivalry stats will update. This cannot be undone.`} confirm="Delete game" danger onClose={()=>setConfirm(null)} onConfirm={async()=>{await store.deleteGame(cg);navigate(`/rivalry/${r.id}`)}}/>}
      {draft && (
        <GoalDialog
          key={draft.id}
          goal={draft}
          rivalry={r}
          editing={editing}
          onSave={saveGoal}
          onClose={() => setDraft(null)}
        />
      )}
      {confirm === "finish" && (
        <ConfirmDialog
          title={cs.a === cs.b ? "Finish as a draw?" : "Finish game?"}
          description={`${r.player_a} ${cs.a} – ${cs.b} ${r.player_b}. ${isWinningScore(cs) ? "The winning score has been reached." : "This is an early finish."} The result will count toward this rivalry.`}
          confirm="Save result"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const end = Math.max(
              Date.now(),
              ...cg.goals.map((g) => Date.parse(g.occurred_at)),
            );
            await store.saveGame({
              ...cg,
              ended_at: new Date(end).toISOString(),
            });
          }}
        />
      )}
      {confirm === "undo" && clast && (
        <ConfirmDialog
          title="Undo the last goal?"
          description={`Remove the goal at ${clock(clast.elapsed_ms)} and restore the previous score.`}
          confirm="Undo goal"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await store.saveGame(removeGoal(game, cg.revision, clast.id));
          }}
        />
      )}
      {confirm === "discard" && (
        <ConfirmDialog
          title="Discard this game?"
          description="This removes the unfinished game and its goals. It will not count toward the rivalry."
          confirm="Discard game"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await store.discardGame(cg);
            navigate(`/rivalry/${r.id}`);
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Remove this goal?"
          description="The final score and rivalry record will be recalculated. Use Edit if only the player, rung, or shot type is wrong."
          confirm="Remove goal"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await store.saveGame(
              removeGoal(game, openingRevision, removing.id),
            );
          }}
        />
      )}
    </>
  );
}
