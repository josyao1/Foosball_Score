import { allPlayers, orderRivalries, rosterKey, sidePlayers } from '../lib/participants';
import { RecentGames } from "../components/RecentGames";
import { AchievementFeed } from "../components/AchievementFeed";
import { GameAchievementMarker } from "../components/GameAchievements";
import { useProfile } from "../lib/profile";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Swords,
  Check,
  Activity,
  Target,
  Timer,
  ChevronRight,
} from "lucide-react";
import { gameTime } from "../lib/time";
import { useStore } from "../lib/store";
import { dateLabel, score, winner, playingTime, playingTimeLabel, clock } from "../lib/stats";
import { playerName } from "../lib/types";
import type { Game, Rivalry } from "../lib/types";
import { RivalryCollection } from "../components/RivalryCollection";
import { useDesign } from "../components/SiteDesign";
import { Dialog } from "../components/Dialog";
export function NewRivalry({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const navigate = useNavigate();
  const [rosters, setRosters] = useState<{Black: string[]; White: string[]}>({Black: [], White: []});
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const players = allPlayers(store.rivalries, store.players);
  const sides = ['Black', 'White'] as const;
  const [attempted, setAttempted] = useState(false);
  const [archivedExisting,setArchivedExisting]=useState<Rivalry|null>(null);
  const matchup = rosterKey(
    players.filter(player => rosters.Black.includes(player.id)),
    players.filter(player => rosters.White.includes(player.id)),
  );
  const existing = store.rivalries.find(rivalry =>
    rosterKey(sidePlayers(rivalry, 'a'), sidePlayers(rivalry, 'b')) === matchup
  );

  function togglePlayer(side: typeof sides[number], id: string) {
    setAttempted(false);
    setArchivedExisting(null);
    setRosters(previous => {
      const members = previous[side];
      const next = members.includes(id) ? members.filter(member => member !== id) : [...members, id];
      return {...previous, [side]: next};
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (adding) {
        await store.createPlayer(newName);
        setAdding(false);
        setNewName('');
        return;
      }
      setAttempted(true);
      if (existing) return;
      const rivalry = await store.createTeamRivalry(rosters.Black, rosters.White);
      navigate(`/rivalry/${rivalry.id}`);
      onClose();
    } catch (cause) {
      if(!adding) {
        try {
          const backlog=await store.loadBacklog();
          const archived=backlog.rivalries.find(r=>r.deleted_at&&rosterKey(sidePlayers(r,'a'),sidePlayers(r,'b'))===matchup);
          if(archived){setArchivedExisting(archived);return;}
        }catch {/* Retain the original creation error. */}
      }
      setError(cause instanceof Error ? cause.message : 'Could not create rivalry.');
    }
  }

  if(archivedExisting) return <Dialog title="Rivalry is in the backlog" onClose={onClose}>
    <p>{archivedExisting.player_a} vs {archivedExisting.player_b}</p><p className="muted">Restore it to keep its original games and history.</p>
    <div className="dialog-actions"><button className="button secondary" onClick={()=>{setArchivedExisting(null);setAttempted(false);}}>Change players</button>
    <span className="muted">Manage it at /backlog</span></div>
  </Dialog>;
  if (attempted && existing) {
    return <Dialog key="duplicate" title="Rivalry already exists" onClose={onClose}>
      <p>{existing.player_a} vs {existing.player_b}</p>
      <div className="dialog-actions">
        <button type="button" className="button secondary" onClick={() => {setAttempted(false); setError('');}}>Change players</button>
        <Link className="button primary" to={`/rivalry/${existing.id}`} onClick={onClose}>Open rivalry</Link>
      </div>
    </Dialog>;
  }

  return <Dialog className="roster-dialog" title="New rivalry" onClose={onClose} dismissible={!store.busy}>
    <form onSubmit={submit}>
      {players.length > 0 ? <div className="roster-scroll">
        <table className="roster-table" aria-label="Choose players for each side">
          <thead><tr><th scope="col">Player</th>{sides.map(side =>
            <th scope="col" key={side}>{side} <small>{rosters[side].length}/2</small></th>
          )}</tr></thead>
          <tbody>{players.map(player => <tr key={player.id}>
            <th scope="row">{player.name}</th>
            {sides.map(side => {
              const checked = rosters[side].includes(player.id);
              const other = side === 'Black' ? rosters.White : rosters.Black;
              return <td key={side}>
                <label className="roster-choice" data-side={side}>
                  <input type="checkbox" aria-label={`${player.name} on ${side}`} checked={checked}
                    disabled={store.busy || other.includes(player.id) || (!checked && rosters[side].length >= 2)}
                    onChange={() => togglePlayer(side, player.id)} />
                  <span aria-hidden="true">{checked ? <Check size={14}/> : <Plus size={12}/>}</span>
                </label>
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div> : <p className="roster-empty">Add players to choose sides.</p>}
      {adding && <label className="roster-new-player">Player name
        <input autoFocus required maxLength={40} autoComplete="off" value={newName} disabled={store.busy}
          onChange={event => setNewName(event.target.value)} />
      </label>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="roster-footer">
        {adding ? <button type="button" className="text-button" disabled={store.busy}
          onClick={() => {setAdding(false); setError('');}}>Cancel</button> :
          <button type="button" className="text-button" disabled={store.busy}
            onClick={() => {setError(''); setNewName(''); setAdding(true);}}><Plus size={15}/>Add player</button>}
        <button className="button primary" disabled={store.busy || (!adding && (!rosters.Black.length || !rosters.White.length))}>
          {store.busy ? 'Saving…' : adding ? 'Save player' : 'Create rivalry'}
        </button>
      </div>
    </form>
  </Dialog>;
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
        <small>{index !== undefined ? `${dateLabel(game.started_at)} · ${gameTime(game.started_at)}` : gameTime(game.started_at)}{game.ended_at && <span className="game-card-duration">Game time {clock(playingTime([game]))}</span>}</small>
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
      <GameAchievementMarker game={game} rivalry={rivalry} fallback={<ChevronRight size={18}/>}/>
    </Link>
  );
}
export function Home() {
  const design=useDesign();
  const profile=useProfile();
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
          <span>games<span className="overview-detail"> played</span></span>
        </div>
        <div>
          <Target size={19} />
          <strong>{completed.reduce((n, g) => n + g.goals.length, 0)}</strong>
          <span>goals<span className="overview-detail"> scored</span></span>
        </div>
        <div aria-label={`${playingTimeLabel(playingTime(completed))} spent playing`} title="Completed games, from start to last goal; rounded to the nearest minute">
          <Timer size={19} />
          <strong>{playingTimeLabel(playingTime(completed))}</strong>
          <span className="overview-detail">spent playing</span>
        </div>
      </div>
      <section>
        {rivalries.length ? (
          <RivalryCollection rivalries={orderRivalries(rivalries,games,profile)} games={games} profile={profile} layout={design.homeLayout}/>
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
      <RecentGames games={games} rivalries={rivalries}/>
      <AchievementFeed games={games} rivalries={rivalries}/>
      {creating && <NewRivalry onClose={() => setCreating(false)} />}
    </>
  );
}
