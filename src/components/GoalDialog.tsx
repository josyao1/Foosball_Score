import { useGameColor } from '../lib/GameColors';
import { goalPlayer, sidePlayers } from '../lib/participants';
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CornerUpRight, Zap, Undo2, Check } from "lucide-react";
import { Dialog } from "./Dialog";
import { clock } from "../lib/stats";
import { RUNGS, otherSide, playerName } from "../lib/types";
import type { Goal, GoalFlag, Rivalry, Side } from "../lib/types";
const AUTO_SAVE_MS = 3000;

export function GoalDialog({
  goal,
  rivalry,
  editing = false,
  currentScore,
  onSave,
  onClose,
}: {
  goal: Goal;
  rivalry: Rivalry;
  editing?: boolean;
  currentScore?: Record<Side, number>;
  onSave: (goal: Goal) => Promise<void>;
  onClose: () => void;
}) {
  const color = useGameColor();
  const [draft, setDraft] = useState(goal),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(!editing);
  const [autoVersion, setAutoVersion] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(3);
  const autoAllowed = useRef(autoEnabled), inFlight = useRef(false), dismissed = useRef(false), mounted = useRef(false);
  const latestSave = useRef<() => Promise<void>>(async () => {});
  function stopAutoSave() {
    autoAllowed.current = false;
    setAutoEnabled(false);
  }
  function restartAutoSave() {
    if (editing || inFlight.current || dismissed.current || error) return;
    // Block a timer already queued at the old deadline until the new effect runs.
    autoAllowed.current = false;
    setSecondsLeft(3);
    setAutoEnabled(true);
    setAutoVersion(version => version + 1);
  }
  function dismiss() {
    dismissed.current = true;
    stopAutoSave();
  }
  async function save() {
    if (inFlight.current || dismissed.current || !mounted.current) return;
    inFlight.current = true;
    stopAutoSave();
    setPending(true);
    setError("");
    try {
      await onSave(draft);
      if (mounted.current) {
        dismissed.current = true;
        onClose();
      }
    } catch (e) {
      inFlight.current = false;
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Could not save the goal.");
        setPending(false);
      }
    }
  }
  // The page clock/polling can rerender without restarting the deadline or using a stale game revision.
  useLayoutEffect(() => { latestSave.current = save; });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (editing || !autoEnabled) return;
    autoAllowed.current = true;
    const deadline = Date.now() + AUTO_SAVE_MS;
    const tick = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 250);
    const timeout = window.setTimeout(() => {
      if (autoAllowed.current && !dismissed.current) void latestSave.current();
    }, AUTO_SAVE_MS);
    return () => { clearInterval(tick); clearTimeout(timeout); };
  }, [editing, autoEnabled, autoVersion]);
  const own = draft.flags.includes("own_goal"),
    credited = own ? otherSide(draft.actor_side) : draft.actor_side;
  function toggle(flag: GoalFlag) {
    if (inFlight.current || dismissed.current) return;
    restartAutoSave();
    setDraft((g) => ({
      ...g,
      flags: g.flags.includes(flag)
        ? g.flags.filter((f) => f !== flag)
        : flag === "own_goal"
          ? ["own_goal"]
          : [...g.flags.filter((f) => f !== "own_goal"), flag],
    }));
  }
  const actorId=goalPlayer(draft,rivalry);
  const actor=sidePlayers(rivalry,draft.actor_side).find(p=>p.id===actorId)?.name;
  const hitter = actor ?? playerName(rivalry, draft.actor_side);
  return (
    <Dialog className="goal-dialog" title={editing ? "Edit goal" : "Add goal"} onClose={() => { dismiss(); onClose(); }} onDismiss={dismiss} dismissible={!pending}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {currentScore && <p className="table-dialog-score" aria-label="Current score">
          {rivalry.player_a} <strong>{currentScore.a} – {currentScore.b}</strong> {rivalry.player_b}
        </p>}
        <div className={`goal-preview side-${color(credited)}`}>
          <span>
            {playerName(rivalry, credited)} <strong>+1</strong>
          </span>
          <span className="time">{clock(draft.elapsed_ms)}</span>
        </div>
        {editing ? (
          <div className="form-grid">
            <label>
              Player who hit it
              <select
                disabled={pending}
                value={draft.actor_side}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    actor_side: e.target.value as Goal["actor_side"],
                  })
                }
              >
                <option value="a">{rivalry.player_a}</option>
                <option value="b">{rivalry.player_b}</option>
              </select>
            </label>
            <label>
              Rung
              <select
                disabled={pending}
                value={draft.rung}
                onChange={(e) =>
                  setDraft({ ...draft, rung: e.target.value as Goal["rung"] })
                }
              >
                {RUNGS.map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="goal-rung-summary">
            {hitter !== playerName(rivalry, credited) && `${hitter} · `}{draft.rung} rung
          </p>
        )}
        {editing && sidePlayers(rivalry,draft.actor_side).length>1 && <p className="helper">{actor ? `Attributed to ${actor}` : "Historical team goal · shared credit"}</p>}
        <div className="flag-options" role="group" aria-label="Goal type">
          {(
            [
              {
                flag: "dunk",
                label: "Dunk",
                Icon: Zap,
              },
              {
                flag: "bank",
                label: "Bank shot",
                Icon: CornerUpRight,
              },
              {
                flag: "own_goal",
                label: "Own goal",
                Icon: Undo2,
              },
            ] as const
          ).map(({ flag, label, Icon }) => (
            <button
              type="button"
              disabled={pending}
              key={flag}
              data-goal-type={flag}
              className={`flag-option ${draft.flags.includes(flag) ? "selected" : ""}`}
              aria-pressed={draft.flags.includes(flag)}
              onPointerDown={restartAutoSave}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") restartAutoSave(); }}
              onClick={() => toggle(flag)}
            >
              {draft.flags.includes(flag) ? <Check size={18} /> : <Icon size={18} />}
              <strong>{label}</strong>
            </button>
          ))}
        </div>
        {!editing && !pending && (
          <p className="goal-auto-save" role="status">
            {autoEnabled ? `${draft.flags.length ? "Goal" : "Regular goal"} saves in ${secondsLeft}…` : "Auto-save stopped. Confirm when ready."}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button autoFocus className="button primary full goal-save-button" disabled={pending}>
          {pending
            ? "Saving…"
            : editing
              ? "Save correction"
              : `Add goal for ${playerName(rivalry, credited)}`}
          {autoEnabled && !editing && !pending && <span aria-hidden="true" className="goal-countdown-track">
            <span key={autoVersion} style={{animationDuration: `${AUTO_SAVE_MS}ms`}} />
          </span>}
        </button>
      </form>
    </Dialog>
  );
}
