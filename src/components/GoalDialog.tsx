import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CornerUpRight, Zap, Undo2, Check } from "lucide-react";
import { Dialog } from "./Dialog";
import { clock } from "../lib/stats";
import { RUNGS, otherSide, playerName } from "../lib/types";
import type { Goal, GoalFlag, Rivalry } from "../lib/types";
export function GoalDialog({
  goal,
  rivalry,
  editing = false,
  onSave,
  onClose,
}: {
  goal: Goal;
  rivalry: Rivalry;
  editing?: boolean;
  onSave: (goal: Goal) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(goal),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(!editing && goal.flags.length === 0);
  const [secondsLeft, setSecondsLeft] = useState(3);
  const autoAllowed = useRef(autoEnabled), inFlight = useRef(false), dismissed = useRef(false), mounted = useRef(false);
  const latestSave = useRef<() => Promise<void>>(async () => {});
  function stopAutoSave() {
    autoAllowed.current = false;
    setAutoEnabled(false);
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
    const deadline = Date.now() + 3000;
    const tick = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 250);
    const timeout = window.setTimeout(() => {
      if (autoAllowed.current && !dismissed.current) void latestSave.current();
    }, 3000);
    return () => { clearInterval(tick); clearTimeout(timeout); };
  }, [editing, autoEnabled]);
  const own = draft.flags.includes("own_goal"),
    credited = own ? otherSide(draft.actor_side) : draft.actor_side;
  function toggle(flag: GoalFlag) {
    if (inFlight.current || dismissed.current) return;
    stopAutoSave();
    setDraft((g) => ({
      ...g,
      flags: g.flags.includes(flag)
        ? g.flags.filter((f) => f !== flag)
        : flag === "own_goal"
          ? ["own_goal"]
          : [...g.flags.filter((f) => f !== "own_goal"), flag],
    }));
  }
  return (
    <Dialog title={editing ? "Edit goal" : "Add goal"} onClose={() => { dismiss(); onClose(); }} onDismiss={dismiss} dismissible={!pending}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className={`goal-preview side-${credited}`}>
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
          <p className="muted">
            {playerName(rivalry, draft.actor_side)}’s{" "}
            <strong>{draft.rung}</strong> rung · timestamp locked in
          </p>
        )}
        <p className="field-title">Anything special?</p>
        <div className="flag-options">
          {(
            [
              {
                flag: "dunk",
                label: "Dunk",
                description: "Smashed straight back",
                Icon: Zap,
              },
              {
                flag: "bank",
                label: "Bank shot",
                description: "Off the wall",
                Icon: CornerUpRight,
              },
              {
                flag: "own_goal",
                label: "Own goal",
                description: "Point to the opponent",
                Icon: Undo2,
              },
            ] as const
          ).map(({ flag, label, description, Icon }) => (
            <button
              type="button"
              disabled={pending}
              key={flag}
              className={`flag-option ${draft.flags.includes(flag) ? "selected" : ""}`}
              aria-pressed={draft.flags.includes(flag)}
              onPointerDown={stopAutoSave}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") stopAutoSave(); }}
              onClick={() => toggle(flag)}
            >
              <Icon size={20} />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <span className="checkbox">
                {draft.flags.includes(flag) && <Check size={14} />}
              </span>
            </button>
          ))}
        </div>
        <p className="helper">
          {own
            ? `${playerName(rivalry, draft.actor_side)} made the own goal. ${playerName(rivalry, credited)} gets the point.`
            : "Leave all off for a regular goal. Dunk and bank can be combined."}
        </p>
        {!editing && !pending && (
          <p className="goal-auto-save" role="status">
            {autoEnabled ? `Regular goal saves in ${secondsLeft}…` : "Auto-save stopped. Confirm when ready."}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button autoFocus className="button primary full" disabled={pending}>
          {pending
            ? "Saving…"
            : editing
              ? "Save correction"
              : `Add goal for ${playerName(rivalry, credited)}`}
        </button>
      </form>
    </Dialog>
  );
}
