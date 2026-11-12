import { CarouselTrack, updateCarouselProgress } from './CarouselTrack';
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { displayTeams, type DisplayTeams } from "../lib/participants";
import { Avatar } from "./Scoreboard";
import { MatchupTicket } from './MatchupTicket';
import { rivalryStats, score } from "../lib/stats";
import { gameDate } from "../lib/time";
import type { Game, Rivalry } from "../lib/types";
import "../rivalry-layouts.css";

type Entry = {
  teams: DisplayTeams;
  rivalry: Rivalry;
  stats: ReturnType<typeof rivalryStats>;
  live: boolean;
  latest: Game | undefined;
  recent: Game[];
  history: Game[];
};

function Names({ rivalry }: { rivalry: Rivalry }) {
  return (
    <span className="rc-names">
      <span className="rc-a">{rivalry.player_a}</span>
      <span className="rc-vs">vs</span>
      <span className="rc-b">{rivalry.player_b}</span>
    </span>
  );
}

function Record({ entry, label = true }: { entry: Entry; label?: boolean }) {
  return (
    <span className="rc-record">
      {label && <span className="rc-label">Head to head</span>}
      <span className="rc-record-numbers">
        <strong className="rc-a">{entry.stats.wins.a}</strong>
        <span aria-hidden="true">–</span>
        <strong className="rc-b">{entry.stats.wins.b}</strong>
        <span className="rc-sr">wins</span>
      </span>
      {entry.stats.draws > 0 && (
        <small>{entry.stats.draws} {entry.stats.draws === 1 ? "draw" : "draws"}</small>
      )}
    </span>
  );
}

function Status({ entry }: { entry: Entry }) {
  const { streak, completed } = entry.stats;
  const streakTeam = entry.teams.find(team => team.side === streak.side);
  return (
    <span className="rc-status">
      {entry.live && <span className="rc-live"><Radio size={12} aria-hidden="true" />Live</span>}
      <span>{streakTeam
        ? `${streakTeam.name} · ${streak.count}-win streak`
        : completed ? "Last game drawn" : entry.live ? "No completed games" : "No games yet"}</span>
    </span>
  );
}

function Played({ entry }: { entry: Entry }) {
  return <span className="rc-played">{entry.stats.completed} played</span>;
}

function Card({ entry }: { entry: Entry }) {
  const { rivalry } = entry;
  return (
    <Link className="rc-item rc-card" to={`/rivalry/${rivalry.id}`}>
      <div className="rc-card-top"><Played entry={entry} /><ArrowUpRight size={17} aria-hidden="true" /></div>
      <div className="rc-card-players">
        <div><Avatar name={rivalry.player_a} side="a" /><strong>{rivalry.player_a}</strong></div>
        <span className="rc-vs">vs</span>
        <div><Avatar name={rivalry.player_b} side="b" /><strong>{rivalry.player_b}</strong></div>
      </div>
      <Record entry={entry} />
      <Status entry={entry} />
    </Link>
  );
}

function CompactRow({ entry, forest }: { entry: Entry; forest: boolean }) {
  return (
    <Link className={`rc-item rc-list-row${forest ? " rc-forest-row" : ""}`} to={`/rivalry/${entry.rivalry.id}`}>
      {forest && <span className="rc-list-avatars" aria-hidden="true"><Avatar name={entry.rivalry.player_a} side="a" /><Avatar name={entry.rivalry.player_b} side="b" /></span>}
      <div className="rc-list-identity"><Names rivalry={entry.rivalry} /><Status entry={entry} /></div>
      <Record entry={entry} />
      <Played entry={entry} />
      <ArrowUpRight className="rc-row-arrow" size={16} aria-hidden="true" />
    </Link>
  );
}

function Pitch({ entry }: { entry: Entry }) {
  return (
    <Link className="rc-item rc-pitch" to={`/rivalry/${entry.rivalry.id}`}>
      <div className="rc-pitch-caption"><span>Head to head</span><Played entry={entry} /></div>
      <div className="rc-field">
        <span className="rc-field-line" aria-hidden="true" />
        <span className="rc-field-circle" aria-hidden="true" />
        <div className="rc-field-side rc-a"><strong>{entry.rivalry.player_a}</strong><span className="rc-goal-box">{entry.stats.wins.a}<small>wins</small></span></div>
        <div className="rc-field-side rc-b"><strong>{entry.rivalry.player_b}</strong><span className="rc-goal-box">{entry.stats.wins.b}<small>wins</small></span></div>
      </div>
      <div className="rc-pitch-footer"><Status entry={entry} /><span className="rc-draws">{entry.stats.draws} draws</span></div>
    </Link>
  );
}

function Versus({ entry }: { entry: Entry }) {
  return (
    <Link className="rc-item rc-versus" to={`/rivalry/${entry.rivalry.id}`}>
      <span className="rc-versus-caption">Head to head</span>
      <div className="rc-versus-halves">
        <div className="rc-versus-half rc-versus-a"><span>{entry.rivalry.player_a}</span><strong>{entry.stats.wins.a}<small>wins</small></strong></div>
        <span className="rc-versus-divider" aria-hidden="true">/</span>
        <div className="rc-versus-half rc-versus-b"><span>{entry.rivalry.player_b}</span><strong>{entry.stats.wins.b}<small>wins</small></strong></div>
      </div>
      <div className="rc-versus-summary"><Played entry={entry} /><span>{entry.stats.draws} draws</span></div>
      <Status entry={entry} />
    </Link>
  );
}

function Ticket({entry}:{entry:Entry}) {
  return <MatchupTicket rivalry={entry.rivalry} teams={entry.teams} games={entry.history}/>;
}

function ticketOffset(list: HTMLUListElement, index: number) {
  const item = list.children[index];
  if (!item) return 0;
  const padding = Number.parseFloat(getComputedStyle(list).scrollPaddingLeft) || 0;
  const left = item.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft - padding;
  return Math.max(0, Math.min(left, list.scrollWidth - list.clientWidth));
}

function TicketCollection({ entries }: { entries: Entry[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const hintId = useId();
  const [narrow, setNarrow] = useState(false);
  const [current, setCurrent] = useState(0);
  const entryIds = entries.map(entry => entry.rivalry.id).join("|");
  const index = Math.min(current, entries.length - 1);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const sync = () => {
      const mobile = typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 700px)").matches
        : window.innerWidth <= 700;
      setNarrow(mobile);
      let nearest = 0;
      let distance = Infinity;
      if (mobile && list.scrollWidth > list.clientWidth) {
        for (let i = 0; i < list.children.length; i++) {
          const delta = Math.abs(ticketOffset(list, i) - list.scrollLeft);
          if (delta < distance) { nearest = i; distance = delta; }
        }
      }
      updateCarouselProgress(list);
      setCurrent(nearest);
    };
    sync();
    list.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    observer?.observe(list);
    return () => {
      list.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      observer?.disconnect();
    };
  }, [entryIds]);

  function goTo(target: number) {
    const list = listRef.current;
    if (!list) return;
    const next = Math.max(0, Math.min(target, entries.length - 1));
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ left: ticketOffset(list, next), behavior: reduce ? "auto" : "smooth" });
  }

  const carousel = narrow && entries.length > 1;
  return (
    <div className="rc-ticket-carousel" role="region" aria-label="Rivalry cards" aria-roledescription={carousel ? "carousel" : undefined}>
      {carousel && <div className="rc-ticket-carousel-controls">
        <span id={hintId}>Swipe left or right<span className="rc-sr">. Use the arrow keys, Home, or End when the list is focused.</span></span>
        <div className="rc-ticket-carousel-navigation">
          <button type="button" aria-label="Previous rivalry" aria-controls={listId} disabled={index === 0} onClick={() => goTo(index - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <span role="status" aria-live="polite" aria-atomic="true">{index + 1} / {entries.length}<span className="rc-sr"> rivalries</span></span>
          <button type="button" aria-label="Next rivalry" aria-controls={listId} disabled={index === entries.length - 1} onClick={() => goTo(index + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </div>}
      <ul
        id={listId}
        ref={listRef}
        className={`rc-collection rc-layout-tickets rc-ticket-carousel-list${entries.length === 1 ? " rc-ticket-single" : ""}`}
        aria-label="Rivalries"
        aria-describedby={carousel ? hintId : undefined}
        tabIndex={carousel ? 0 : undefined}
        onKeyDown={event => {
          if (!carousel || event.target !== event.currentTarget) return;
          const target = event.key === "ArrowLeft" ? index - 1 : event.key === "ArrowRight" ? index + 1 : event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : null;
          if (target === null) return;
          event.preventDefault();
          goTo(target);
        }}
      >
        {entries.map((entry, i) => <li key={entry.rivalry.id} aria-label={carousel ? `${i + 1} of ${entries.length}` : undefined}><Ticket entry={entry} /></li>)}
      </ul>
      {carousel && <CarouselTrack index={index} count={entries.length} label="Rivalry position" controls={listId} goTo={goTo}/>}
    </div>
  );
}

function Matrix({ entry }: { entry: Entry }) {
  return (
    <Link className="rc-item rc-matrix" to={`/rivalry/${entry.rivalry.id}`}>
      <Names rivalry={entry.rivalry} />
      <span className="rc-label">Head to head</span>
      <dl className="rc-matrix-grid">
        <div><dt className="rc-a">{entry.rivalry.player_a} wins</dt><dd className="rc-a">{entry.stats.wins.a}</dd></div>
        <div><dt className="rc-b">{entry.rivalry.player_b} wins</dt><dd className="rc-b">{entry.stats.wins.b}</dd></div>
        <div><dt>Played</dt><dd>{entry.stats.completed}</dd></div>
        <div><dt>Draws</dt><dd>{entry.stats.draws}</dd></div>
      </dl>
      <Status entry={entry} />
    </Link>
  );
}

function Tile({ entry }: { entry: Entry }) {
  return (
    <Link className="rc-item rc-tile" to={`/rivalry/${entry.rivalry.id}`}>
      <Names rivalry={entry.rivalry} />
      <Record entry={entry} />
      <div className="rc-tile-footer"><Played entry={entry} /><Status entry={entry} /></div>
    </Link>
  );
}

function Broadcast({ entry }: { entry: Entry }) {
  const latestScore = entry.latest ? score(entry.latest.goals) : null;
  return (
    <Link className="rc-item rc-broadcast" to={`/rivalry/${entry.rivalry.id}`}>
      <div className="rc-broadcast-result">
        <span className="rc-label">{entry.latest ? entry.latest.ended_at ? "Latest score" : "Live score" : "Latest score"}</span>
        <strong>{latestScore ? <><span className="rc-a">{latestScore.a}</span><span className="rc-score-dash">–</span><span className="rc-b">{latestScore.b}</span></> : "—"}</strong>
      </div>
      <div className="rc-broadcast-identity"><Names rivalry={entry.rivalry} /><Status entry={entry} /></div>
      <div className="rc-broadcast-history"><Record entry={entry} /><Played entry={entry} /></div>
    </Link>
  );
}

function RivalryTable({ entries }: { entries: Entry[] }) {
  return (
    <div className="rc-table-wrap" role="region" aria-label="Rivalry standings" tabIndex={0}>
      <table className="rc-table">
        <caption className="rc-sr">Rivalry standings</caption>
        <thead><tr><th scope="col">Players</th><th scope="col">Head to head</th><th scope="col">Played</th><th scope="col">Streak / live</th></tr></thead>
        <tbody>{entries.map((entry) => (
          <tr key={entry.rivalry.id}>
            <th scope="row"><Link to={`/rivalry/${entry.rivalry.id}`}><Names rivalry={entry.rivalry} /><ArrowUpRight size={15} aria-hidden="true" /></Link></th>
            <td data-label="Head to head"><Record entry={entry} label={false} /></td>
            <td data-label="Played">{entry.stats.completed}</td>
            <td data-label="Streak / live"><Status entry={entry} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function OtherRivalries({ entries, featured }: { entries: Entry[]; featured: boolean }) {
  const rows = <ul className="rc-directory-list">
    {entries.map(({ rivalry, stats, latest, live, teams: [first, second] }) => <li key={rivalry.id}>
      <Link className="rc-directory-row" to={`/rivalry/${rivalry.id}`}>
        <span className="rc-directory-match">{first.name} <small>vs</small> {second.name}</span>
        <strong aria-label={`Head to head: ${stats.wins[first.side]} to ${stats.wins[second.side]}`}>{stats.wins[first.side]}–{stats.wins[second.side]}</strong>
        <span className="rc-directory-date">{live ? 'Live' : latest ? gameDate(latest.started_at) : 'Unplayed'}</span>
        <ChevronRight size={15} aria-hidden="true"/>
      </Link>
    </li>)}
  </ul>;
  if (!featured) return <section className="rc-directory" aria-label="All rivalries">{rows}</section>;
  return <details className="rc-directory">
    <summary>Other rivalries <span>{entries.length}</span><ChevronRight size={16} aria-hidden="true"/></summary>
    {rows}
  </details>;
}

function FeaturedRivalries({ entries, profile }: { entries: Entry[]; profile: string | null }) {
  const winRate = (entry: Entry) => entry.teams[0].mine && entry.stats.completed > 0
    ? entry.stats.wins[entry.teams[0].side] / entry.stats.completed : 0;
  const recency = (entry: Entry) => Date.parse(entry.latest?.started_at ?? entry.rivalry.created_at) || 0;
  const ordered = [...entries].sort((a, b) =>
    Number(b.teams[0].mine) - Number(a.teams[0].mine)
    || b.stats.completed - a.stats.completed
    || winRate(b) - winRate(a)
    || recency(b) - recency(a)
    || a.rivalry.id.localeCompare(b.rivalry.id));
  const featured = ordered.filter(entry =>
    entry.live || entry.teams[0].mine || entry.stats.completed >= 3
  )
    .slice(0, 3);
  const selected = new Set(featured.map(entry => entry.rivalry.id));
  const others = ordered.filter(entry => !selected.has(entry.rivalry.id));
  return <>
    {featured.length > 0 && <TicketCollection key={profile} entries={featured}/>}
    {others.length > 0 && <OtherRivalries entries={others} featured={featured.length > 0}/>}
  </>;
}

export function RivalryCollection({ rivalries, games, layout, profile = null }: { rivalries: Rivalry[]; games: Game[]; layout: string; profile?: string | null }) {
  const grouped = new Map<string, Game[]>();
  for (const game of games) {
    const existing = grouped.get(game.rivalry_id);
    if (existing) existing.push(game);
    else grouped.set(game.rivalry_id, [game]);
  }
  const entries = rivalries.map((rivalry): Entry => {
    const rivalryGames = grouped.get(rivalry.id) ?? [];
    const liveGame = rivalryGames.find((game) => !game.ended_at);
    const ordered = [...rivalryGames].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at) || b.id.localeCompare(a.id));
    const latest = liveGame ?? ordered[0];
    return { rivalry, teams: displayTeams(rivalry, profile), stats: rivalryStats(rivalryGames), live: Boolean(liveGame), latest, recent: ordered.filter(game => game.ended_at).slice(0, 2), history: rivalryGames };
  });
  if (!entries.length) return null;
  if (layout === "tickets") return <FeaturedRivalries entries={entries} profile={profile} />;
  if (layout === "table") return <RivalryTable entries={entries} />;
  const presentation = ["cards", "list", "forest", "pitch", "versus", "tickets", "matrix", "tiles", "broadcast"].includes(layout) ? layout : "cards";
  return (
    <ul className={`rc-collection rc-layout-${presentation}`} aria-label="Rivalries">
      {entries.map((entry) => (
        <li key={entry.rivalry.id}>
          {presentation === "list" || presentation === "forest" ? <CompactRow entry={entry} forest={presentation === "forest"} />
            : presentation === "pitch" ? <Pitch entry={entry} />
            : presentation === "versus" ? <Versus entry={entry} />
            : presentation === "tickets" ? <Ticket entry={entry} />
            : presentation === "matrix" ? <Matrix entry={entry} />
            : presentation === "tiles" ? <Tile entry={entry} />
            : presentation === "broadcast" ? <Broadcast entry={entry} />
            : <Card entry={entry} />}
        </li>
      ))}
    </ul>
  );
}
