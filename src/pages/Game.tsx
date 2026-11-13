import { GameResult } from '../components/GameResult';
import { GameColors, useLocalGameColors } from '../lib/GameColors';
import { MatchTicketActions } from '../components/MatchTicketActions';
import { TeamPositions } from '../components/TeamPositions';
import { sidePlayers } from '../lib/participants';
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigationType, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDownUp,
  Contrast,
  Flag,
  Undo2,
  Timer,
  Pause,
  Play,
  Trophy,
  CircleCheck,
  Trash2,
} from "lucide-react";
import { WinningGameDialog } from "../components/WinningGameDialog";
import { selectedMoment } from "../lib/records";
import { gameTime } from "../lib/time";
import { useStore } from "../lib/store";
import { changeGoal, removeGoal } from "../lib/mutations";
import {
  clock,
  creditedSide,
  dateLabel,
  duration,
  isWinningScore,
  orderedGoals,
  score,
  winner,
} from "../lib/stats";
import { playerName } from "../lib/types";
import type { Game, Goal, Rung, Side } from "../lib/types";
import { useDesign } from "../components/SiteDesign";
import { TableScorer } from "../components/TableScorer";
import { LiveScoringLayout } from "../components/LiveScoringLayout";
import { GoalDialog } from "../components/GoalDialog";
import { ConfirmDialog } from "../components/Dialog";
import { Momentum, RungStats, Timeline } from "../components/GameReport";
export function GamePage() {
  const design=useDesign();
  const location = useLocation();
  const kickoff = useNavigationType() === "PUSH" && location.state?.kickoff === true;
  const [searchParams] = useSearchParams();
  const recordKey = searchParams.get("record");
  const watchReplay = searchParams.get("play") === "1";
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
    [removing, setRemoving] = useState<Goal | null>(null),
    [winningGame,setWinningGame] = useState<Game|null>(null),
    [dismissedWin,setDismissedWin] = useState<string|null>(null);
  const [tableDraft, setTableDraft] = useState(false);
  const [colorsFlipped, flipColors] = useLocalGameColors(id ?? '');
  const [scoringNear, setScoringNear] = useState<Side>('a');
  const [pauseError, setPauseError] = useState('');
  const [confirmation, setConfirmation] = useState<{gameId: string; goal: Goal} | null>(null);
  const [rematch, setRematch] = useState<{gameId: string; previous: Record<Side, number>} | null>(null);
  const [lastLiveId, setLastLiveId] = useState<string | null>(null);
  const game = store.games.find((g) => g.id === id),
    r = store.rivalries.find((r) => r.id === game?.rivalry_id);
  const panel = useRef<HTMLElement>(null);
  const startedGame = kickoff && game && !game.ended_at ? game.id : null;
  useEffect(() => {
    if (!startedGame || !panel.current?.scrollIntoView) return;
    const frame = requestAnimationFrame(() => panel.current?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    }));
    return () => cancelAnimationFrame(frame);
  }, [startedGame]);
  useEffect(() => {
    if (id && game && !game.ended_at) setLastLiveId(id);
  }, [id, game?.ended_at]);
  useEffect(() => {
    if (!rematch) return;
    const timer = window.setTimeout(() => setRematch(null), 420);
    return () => window.clearTimeout(timer);
  }, [rematch]);
  useEffect(() => {
    if (recordKey || watchReplay) document.getElementById("momentum")?.scrollIntoView?.({ block: "start" });
  }, [id, recordKey, watchReplay]);
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    setDraft(null);
    setConfirm(null);
    setRemoving(null);
    setWinningGame(null);
    setDismissedWin(null);
  }, [id]);
  useEffect(() => {
    if (!game || game.ended_at || game.paused_at || !isWinningScore(score(game.goals)) ||
      draft || confirm || removing || winningGame || store.busy ||
      dismissedWin === `${game.id}:${game.revision}`) return;
    setWinningGame(game);
  }, [game,draft,confirm,removing,winningGame,store.busy,dismissedWin]);
  if (!game || !r)
    return (
      <div className="empty-state">
        <h1>Game not found</h1>
        <Link className="button primary" to="/">
          All rivalries
        </Link>
      </div>
    );
  const highlight = selectedMoment(game, recordKey);
  const live = !game.ended_at,
    s = score(game.goals),
    w = winner(game),
    won = isWinningScore(s),
    last = orderedGoals(game.goals).at(-1);
  const scoringDisabled = store.busy || Boolean(game.paused_at) || (!game.lineup && (['a','b'] as const).some(side => sidePlayers(r, side).length === 2));
  function beginGoal(side: Side, rung: Rung, fromTable = false) {
    if (scoringDisabled) return;
    setTableDraft(fromTable);
    const tapped = Date.now();
    setOpeningRevision(game!.revision);
    setEditing(false);
    setDraft({
      id: crypto.randomUUID(),
      actor_side: side,
      lineup: game!.lineup ?? null,
      rung,
      flags: [],
      elapsed_ms: duration(game!, tapped),
      occurred_at: new Date(
        Math.max(tapped, Date.parse(game!.started_at)),
      ).toISOString(),
    });
  }
  async function saveGoal(goal: Goal) {
    const updated = changeGoal(game!, openingRevision, goal, editing);
    await store.saveGame(updated);
    if (!editing) setConfirmation({gameId: updated.id, goal});
  }
  const confirmedGoal = live && confirmation?.gameId === game.id && last?.id === confirmation.goal.id
    ? confirmation.goal : undefined;
  function openConfirm(kind: "finish" | "discard" | "undo" | "delete") {
    setConfirmationGame(game!);
    setConfirm(kind);
  }
  const cg = confirmationGame ?? game,
    cs = score(cg.goals),
    clast = orderedGoals(cg.goals).at(-1);

  const pauseControl = <div className="pause-action"><button type="button" className={`table-tool game-pause${game.paused_at ? ' is-paused' : ''}`}
    disabled={store.busy || Boolean(draft || confirm || winningGame || removing)}
    onClick={()=>{setPauseError('');void store.setGamePaused(game,!game.paused_at).catch(e=>setPauseError(e instanceof Error ? e.message : 'Could not update pause.'));}}>
    {game.paused_at ? <Play size={15}/> : <Pause size={15}/>}{game.paused_at ? 'Resume game' : 'Pause game'}
  </button>{pauseError && <small role="alert">{pauseError}</small>}</div>;
  const gameClock = (<div className="game-clock">
          <Timer size={16} />
          <span>{clock(duration(game, now))}</span>{game.paused_at && <strong className="paused-label">Paused</strong>}
          <span className="clock-rule">First to 10 · win by 2</span>
        </div>);


  return (
    <GameColors.Provider value={live && colorsFlipped}>
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
        <div className="game-heading-actions">
        {!live && <MatchTicketActions game={game} rivalry={r} mode="share"/>}
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
      </div>
      {!live ? <GameResult key={game.id} game={game} rivalry={r} animate={lastLiveId === game.id}/>
        : <section ref={panel} className={`live-score-panel scorer-layout-${design.scorerLayout} ${live ? "is-live" : ""}`}>
        {<TableScorer key={game.id} game={game} rivalry={r} scores={s} disabled={scoringDisabled}
          centralClock
          colorControl={<button type="button" className="table-tool live-color-flip" aria-pressed={colorsFlipped}
            onClick={flipColors} title="Swap black and white for this game on this device">
            <Contrast size={15} aria-hidden="true"/><span>Flip colors</span></button>}
          flipControl={<button type="button" className="table-tool live-table-flip"
            onClick={()=>setScoringNear(side=>side === 'a' ? 'b' : 'a')} title="Switch the top and bottom teams">
            <ArrowDownUp size={15} aria-hidden="true"/>Flip sides</button>}
          promptPaused={Boolean(draft || winningGame || confirm || removing)}
          busy={store.busy} onSave={store.saveGame} pauseControl={pauseControl}
          onGoal={(side, rung) => beginGoal(side, rung, true)}>{gameClock}</TableScorer>}
        {<LiveScoringLayout rivalry={r} lineup={game.lineup} scores={s}
            near={scoringNear}
            rematchFrom={rematch?.gameId === game.id && !game.goals.length ? rematch.previous : undefined}
            clock={gameClock}
            whitePositions={<TeamPositions onlySide="b" game={game} rivalry={r} busy={store.busy || Boolean(game.paused_at)} onSave={store.saveGame}/>}
            blackPositions={<TeamPositions onlySide="a" game={game} rivalry={r} busy={store.busy || Boolean(game.paused_at)} onSave={store.saveGame}/>}
            disabled={scoringDisabled} onGoal={beginGoal}
            pulse={confirmedGoal && {id: confirmedGoal.id, side: creditedSide(confirmedGoal)}}/>}
        {live && (
          <>
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
                disabled={!last || scoringDisabled}
                onClick={() => openConfirm("undo")}
              >
                <Undo2 size={17} />
                Undo goal
              </button>
              <button
                className="button primary"
                disabled={!game.goals.length || scoringDisabled}
                onClick={() => openConfirm("finish")}
              >
                <Flag size={17} />
                Finish game
              </button>
            </div>
          </>
        )}
      </section>}
      {live ? (
        <div className="live-bottom live-feed-layout">
          <Timeline
            game={game}
            rivalry={r}
            compact
            confirmedId={confirmedGoal?.id}
            onEdit={game.paused_at ? undefined : (g) => {
              setOpeningRevision(game.revision);
              setEditing(true);
              setDraft(g);
            }}
          />
          <div className="live-game-footer">
            <details className="game-help">
            <summary>Scoring help</summary>
            <p>
              Tap a rung. Goals save after 3 seconds. Changing a special flag
              restarts the countdown. Own goals go to the other player.
            </p>
            <p>
              Pause freezes the clock across devices. Resume when you’re ready;
              leaving this page alone does not pause it.
            </p>
            </details>
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
          <div className="game-report-overview">
            <Momentum key={`${game.id}-${recordKey}`} game={game} rivalry={r} highlight={highlight} watchMoment={watchReplay} />
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
      {!live && <div className="danger-actions"><button className="text-button muted" disabled={store.busy} onClick={()=>openConfirm('delete')}><Trash2 size={15}/>Delete game</button></div>}
      {confirm==='delete'&&<ConfirmDialog title="Delete game?" description={`Delete this game (${score(cg.goals).a}–${score(cg.goals).b})? It’ll move to the backlog and stop counting toward stats until restored.`} confirm="Delete game" danger onClose={()=>setConfirm(null)} onConfirm={async()=>{await store.deleteGame(cg);navigate(`/rivalry/${r.id}`)}}/>}
      {winningGame && winningGame.id === id && <WinningGameDialog
        snapshot={winningGame}
        rivalry={r}
        onClose={acknowledged => {
          setDismissedWin(`${acknowledged.id}:${acknowledged.revision}`);
          setWinningGame(null);
        }}
        onRematch={(next, created) => {
          if (!next.goals.length) setRematch({gameId: next.id, previous: s});
          setWinningGame(null);
          navigate(`/game/${next.id}`, {state: {kickoff: created}});
        }}
      />}
      {draft && (
        <GoalDialog
          key={draft.id}
          goal={draft}
          rivalry={r}
          editing={editing}
          currentScore={tableDraft && !editing ? s : undefined}
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
    </GameColors.Provider>
  );
}
