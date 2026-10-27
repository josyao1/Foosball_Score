import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Plus,
  Swords,
  Activity,
  Target,
  ChevronRight,
} from "lucide-react";
import { gameTime } from "../lib/time";
import { useStore } from "../lib/store";
import { dateLabel, score, winner } from "../lib/stats";
import { playerName } from "../lib/types";
import type { Game, Rivalry } from "../lib/types";
import { RivalryCollection } from "../components/RivalryCollection";
import { useDesign } from "../components/SiteDesign";
import { Dialog } from "../components/Dialog";
export function NewRivalry({ onClose }: { onClose: () => void }) {
  const store = useStore(),
    navigate = useNavigate(),
    [a, setA] = useState(""),
    [b, setB] = useState(""),
    [error, setError] = useState("");
  return (
    <Dialog title="New rivalry" onClose={onClose} dismissible={!store.busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await store.createRivalry(a, b);
            navigate(`/rivalry/${r.id}`);
            onClose();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not create rivalry.",
            );
          }
        }}
      >
        <div className="form-grid">
          <label>
            <span className="text-a">Black side</span>
            <input
              disabled={store.busy}
              autoFocus
              required
              maxLength={40}
              value={a}
              onChange={(e) => setA(e.target.value)}
              placeholder="First player"
              autoComplete="off"
            />
          </label>
          <label>
            <span className="text-b">White side</span>
            <input
              disabled={store.busy}
              required
              maxLength={40}
              value={b}
              onChange={(e) => setB(e.target.value)}
              placeholder="Second player"
              autoComplete="off"
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={store.busy}>
          {store.busy ? "Creating…" : "Create rivalry"}
          <ArrowUpRight size={18} />
        </button>
      </form>
    </Dialog>
  );
}
export function GameCard({
  game,
  rivalry,
  index,
}: {
  game: Game;
  rivalry: Rivalry;
  index?: number;
}) {
  const s = score(game.goals),
    w = winner(game);
  return (
    <Link className="game-card" to={`/game/${game.id}`}>
      <div className="game-card-date">
        <span>
          {index !== undefined
            ? `Game ${String(index).padStart(2, "0")}`
            : dateLabel(game.started_at)}
        </span>
        <small>{index !== undefined ? `${dateLabel(game.started_at)} · ${gameTime(game.started_at)}` : gameTime(game.started_at)}</small>
      </div>
      <div className="mini-match">
        <span className={`mini-name ${w === "a" ? "text-a" : ""}`}>
          {rivalry.player_a}
        </span>
        <strong>
          <span className="text-a">{s.a}</span>
          <i>–</i>
          <span className="text-b">{s.b}</span>
        </strong>
        <span className={`mini-name ${w === "b" ? "text-b" : ""}`}>
          {rivalry.player_b}
        </span>
      </div>
      <span className={`game-result ${!game.ended_at ? "live" : ""}`}>
        {!game.ended_at
          ? "Live"
          : w
            ? `${playerName(rivalry, w)} wins`
            : "Draw"}
      </span>
      <ChevronRight size={18} />
    </Link>
  );
}
export function Home() {
  const design=useDesign();
  const { rivalries, games } = useStore(),
    [creating, setCreating] = useState(false);
  const completed = games.filter((g) => g.ended_at);
  return (
    <>
      <div className="home-heading">
        <h1>Rivalries</h1>
        <div className="table-art" aria-hidden="true">
          <div className="table-outline">
            <div className="table-circle" />
            <div className="table-center" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`table-rod rod-${i}`}>
                {Array.from(
                  { length: i === 1 ? 5 : i === 2 ? 2 : 3 },
                  (_, j) => (
                    <i key={j} />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <button className="button primary" onClick={() => setCreating(true)}>
          <Plus size={18} />
          New rivalry
        </button>
      </div>
      <div className="overview-strip">
        <div>
          <Swords size={19} />
          <strong>{rivalries.length}</strong>
          <span>rivalries</span>
        </div>
        <div>
          <Activity size={19} />
          <strong>{completed.length}</strong>
          <span>games played</span>
        </div>
        <div>
          <Target size={19} />
          <strong>{completed.reduce((n, g) => n + g.goals.length, 0)}</strong>
          <span>goals scored</span>
        </div>
      </div>
      <section>
        {rivalries.length ? (
          <RivalryCollection rivalries={rivalries} games={games} layout={design.homeLayout}/>
        ) : (
          <div className="empty-state">
            <Swords size={40} />
            <h3>No rivalries yet</h3>
            <p>Add two players to start keeping score.</p>
            <button
              className="button primary"
              onClick={() => setCreating(true)}
            >
              Create your first rivalry
            </button>
          </div>
        )}
      </section>
      {creating && <NewRivalry onClose={() => setCreating(false)} />}
    </>
  );
}
