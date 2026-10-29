import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Trash2,
} from "lucide-react";
import { useDesign } from "../components/SiteDesign";
import { useStore } from "../lib/store";
import { RivalrySummary } from "../components/RivalrySummary";
import { ConfirmDialog } from "../components/Dialog";
import { RivalryBreakdown } from "../components/RivalryBreakdown";
import { RecordBook } from "../components/Records";
import { GameCard } from "./Home";
export function RivalryPage() {
  const design=useDesign();
  const { id } = useParams(),
    store = useStore(),
    navigate = useNavigate(),
[deleteSnapshot,setDeleteSnapshot]=useState<Record<string,number>|null>(null);
  const r = store.rivalries.find((r) => r.id === id);
  if (!r)
    return (
      <div className="empty-state">
        <h1>Rivalry not found</h1>
        <Link to="/" className="button primary">
          All rivalries
        </Link>
      </div>
    );
  const games = store.games
      .filter((g) => g.rivalry_id === id)
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)),
    live = games.find((g) => !g.ended_at);
  async function start() {
    if (live) {
      navigate(`/game/${live.id}`);
      return;
    }
    try {
      const g = await store.saveGame({
        id: crypto.randomUUID(),
        rivalry_id: r!.id,
        started_at: new Date().toISOString(),
        ended_at: null,
        revision: 0,
        goals: [],
      });
      navigate(`/game/${g.id}`);
    } catch {
      /* Store displays the error. */
    }
  }
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        All rivalries
      </Link>
      <div className="section-heading page-heading">
        <div>
          <h1>
            {r.player_a} <span className="muted-heading">vs</span> {r.player_b}
          </h1>
        </div>
        <button
          className="button primary"
          disabled={store.busy}
          onClick={() => void start()}
        >
          <Play size={17} />
          {live ? "Resume game" : "Start a game"}
        </button>
      </div>
      <RivalrySummary rivalry={r} games={games} designId={design.id}/>
      <RivalryBreakdown games={games} rivalry={r}/>
      <section>
        <div className="section-heading">
          <div>
            <h2>Game history</h2>
          </div>
        </div>
        <div className="game-list">
          {games.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                rivalry={r}
                index={games.length - games.indexOf(g)}
              />
            ))}
        </div>
        {!games.length && (
          <div className="empty-state">
            <p>No games yet.</p>
              <button
                className="button secondary"
                onClick={() => void start()}
                disabled={store.busy}
              >
                Start the first game
              </button>
          </div>
        )}
      </section>
      <RecordBook games={games} rivalry={r}/>
      <div className="danger-actions"><button className="text-button muted" disabled={store.busy} onClick={()=>setDeleteSnapshot(Object.fromEntries(games.map(g=>[g.id,g.revision])))}><Trash2 size={15}/>Delete rivalry</button></div>
      {deleteSnapshot&&<ConfirmDialog title="Delete rivalry?" description={`Delete ${r.player_a} vs ${r.player_b} and all ${Object.keys(deleteSnapshot).length} games and their goals? This cannot be undone.`} confirm="Delete rivalry" danger onClose={()=>setDeleteSnapshot(null)} onConfirm={async()=>{await store.deleteRivalry(r.id,deleteSnapshot);navigate('/')}}/>}
    </>
  );
}
