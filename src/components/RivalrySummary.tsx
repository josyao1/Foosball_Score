import { useId } from "react";
import { Link } from "react-router-dom";
import { rivalryStats, score } from "../lib/stats";
import { otherSide, playerName } from "../lib/types";
import type { Game, Rivalry, Side } from "../lib/types";
import "../rivalry-summary.css";

type Summary = {
  rivalry: Rivalry;
  stats: ReturnType<typeof rivalryStats>;
  average: string;
};
type SummaryProps = { data: Summary };

function TeamLabel({ rivalry, side }: { rivalry: Rivalry; side: Side }) {
  return <span className="rs-team-label"><span className={`rs-kit kit-${side === "a" ? "black" : "white"}`}>{side === "a" ? "Black" : "White"}</span><span>{playerName(rivalry, side)}</span></span>;
}

function Streak({ data }: SummaryProps) {
  const { streak } = data.stats;
  return <>{streak.side ? `${playerName(data.rivalry, streak.side)} · ${streak.count} ${streak.count === 1 ? "win" : "wins"}` : "No current streak"}</>;
}

function Blowout({ data }: SummaryProps) {
  const best = data.stats.blowout;
  if (!best) return <span className="rs-empty">None yet</span>;
  const result = score(best.game.goals);
  return <Link to={`/game/${best.game.id}`} className="rs-game-fact"><strong>{result.a}–{result.b}</strong><span>{playerName(data.rivalry, best.side)} by {best.margin}</span></Link>;
}

function Choke({ data }: SummaryProps) {
  const best = data.stats.choke;
  if (!best) return <span className="rs-empty">None yet</span>;
  return <Link to={`/game/${best.game.id}`} className="rs-game-fact"><strong>{best.lead}-goal lead</strong><span>{playerName(data.rivalry, best.side)} led, then lost</span></Link>;
}

function ClubSummary({ data }: SummaryProps) {
  const { rivalry, stats: s } = data;
  return <section className="rs-summary rs-club" aria-label="Head to head summary">
    <div className="rs-club-record">
      <div className="rs-club-player"><TeamLabel rivalry={rivalry} side="a" /><strong>{s.wins.a}<small>wins</small></strong><span>{s.goals.a} total goals</span></div>
      <div className="rs-club-middle"><span>Head to head</span><b>{s.completed} played</b><span>{s.draws} draws</span></div>
      <div className="rs-club-player"><TeamLabel rivalry={rivalry} side="b" /><strong>{s.wins.b}<small>wins</small></strong><span>{s.goals.b} total goals</span></div>
    </div>
    <dl className="rs-club-strip">
      <div><dt>Current streak</dt><dd><Streak data={data} /></dd></div>
      <div><dt>Biggest blowout</dt><dd><Blowout data={data} /></dd></div>
      <div><dt>Biggest choke</dt><dd><Choke data={data} /></dd></div>
      <div><dt>Avg. goals / game</dt><dd>{data.average}</dd></div>
    </dl>
  </section>;
}

function PaperSummary({ data }: SummaryProps) {
  const { rivalry, stats: s } = data;
  return <section className="rs-summary rs-paper" aria-label="Head to head ledger">
    <header className="rs-paper-heading"><h2>Head to head</h2><p>{s.completed} played / {s.draws} draws</p></header>
    <div className="rs-ledger-wrap" role="region" aria-label="Player records" tabIndex={0}>
      <table className="rs-ledger"><caption className="rs-sr">Completed game records</caption><thead><tr><th scope="col">Player</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">Total goals</th></tr></thead>
        <tbody>{(["a", "b"] as const).map(side => <tr key={side}><th scope="row"><TeamLabel rivalry={rivalry} side={side} /></th><td data-label="Wins">{s.wins[side]}</td><td data-label="Losses">{s.wins[otherSide(side)]}</td><td data-label="Total goals">{s.goals[side]}</td></tr>)}</tbody>
      </table>
    </div>
    <dl className="rs-paper-notes"><div><dt>Current streak</dt><dd><Streak data={data} /></dd></div><div><dt>Avg. goals / game</dt><dd>{data.average}</dd></div><div><dt>Biggest blowout</dt><dd><Blowout data={data} /></dd></div><div><dt>Biggest choke</dt><dd><Choke data={data} /></dd></div></dl>
  </section>;
}

function PitchSummary({ data }: SummaryProps) {
  const { rivalry, stats: s } = data;
  return <section className="rs-summary rs-pitch" aria-label="Head to head field">
    <div className="rs-touchline"><span>Current streak <strong><Streak data={data} /></strong></span><span>Avg. goals / game <strong>{data.average}</strong></span></div>
    <div className="rs-football-field">
      <span className="rs-halfway" aria-hidden="true" />
      <span className="rs-centre-circle" aria-hidden="true" />
      <span className="rs-foos-rod rs-foos-rod-black" aria-hidden="true"><i /><i /><i /></span>
      <span className="rs-foos-rod rs-foos-rod-white" aria-hidden="true"><i /><i /><i /></span>
      <div className="rs-field-player"><TeamLabel rivalry={rivalry} side="a" /><div className="rs-field-goal kit-black"><b>{s.wins.a}</b><span>wins</span></div><span className="rs-field-note">{s.goals.a} total goals</span></div>
      <div className="rs-field-centre"><span>Head to head</span><strong>{s.completed} played</strong><span>{s.draws} draws</span></div>
      <div className="rs-field-player"><TeamLabel rivalry={rivalry} side="b" /><div className="rs-field-goal kit-white"><b>{s.wins.b}</b><span>wins</span></div><span className="rs-field-note">{s.goals.b} total goals</span></div>
    </div>
    <div className="rs-pitch-results"><div><span>Biggest blowout</span><Blowout data={data} /></div><div><span>Biggest choke</span><Choke data={data} /></div></div>
  </section>;
}

function MonoSummary({ data }: SummaryProps) {
  const { rivalry, stats: s } = data;
  return <section className="rs-summary rs-mono" aria-label="Head to head numbers">
    <div className="rs-mono-columns">{(["a", "b"] as const).map(side => <div key={side}><TeamLabel rivalry={rivalry} side={side} /><div className="rs-mono-wins"><strong>{s.wins[side]}</strong><span>wins</span></div><p>{s.goals[side]} total goals</p></div>)}</div>
    <dl className="rs-mono-matrix"><div><dt>Played</dt><dd>{s.completed}</dd></div><div><dt>Draws</dt><dd>{s.draws}</dd></div><div><dt>Avg. goals / game</dt><dd>{data.average}</dd></div><div><dt>Current streak</dt><dd><Streak data={data} /></dd></div><div><dt>Biggest blowout</dt><dd><Blowout data={data} /></dd></div><div><dt>Biggest choke</dt><dd><Choke data={data} /></dd></div></dl>
  </section>;
}

function Segments({ value, max, kit }: { value: number; max: number; kit: "black" | "white" | "neutral" }) {
  const count = max > 0 ? Math.round(12 * Math.min(value / max, 1)) : 0;
  return <span className={`rs-segments rs-segments-${kit}`} aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i className={i < count ? "filled" : ""} key={i} />)}</span>;
}

function ArcadeSummary({ data }: SummaryProps) {
  const { rivalry, stats: s } = data;
  return <section className="rs-summary rs-arcade" aria-label="Head to head HUD">
    <div className="rs-hud-panels">{(["a", "b"] as const).map(side => <div className="rs-hud-player" key={side}><TeamLabel rivalry={rivalry} side={side} /><div className="rs-hud-counters"><span><small>Wins</small><b>{s.wins[side]}</b></span><span><small>Losses</small><b>{s.wins[otherSide(side)]}</b></span></div><div className="rs-hud-goals"><span>{s.goals[side]} total goals</span><Segments value={s.goals[side]} max={Math.max(s.goals.a, s.goals.b)} kit={side === "a" ? "black" : "white"} /></div></div>)}</div>
    <div className="rs-hud-session"><span>{s.completed} played</span><span>{s.draws} draws</span><span>{data.average} avg. goals / game</span></div>
    <div className="rs-hud-streak"><div><span>Current streak</span><strong><Streak data={data} /></strong></div><Segments value={s.streak.count} max={Math.max(s.longestStreak.a, s.longestStreak.b)} kit="neutral" /></div>
    <dl className="rs-hud-events"><div><dt>Biggest blowout</dt><dd><Blowout data={data} /></dd></div><div><dt>Biggest choke</dt><dd><Choke data={data} /></dd></div></dl>
  </section>;
}

function ClaySummary({ data }: SummaryProps) {
  const { rivalry, stats: s } = data;
  return <section className="rs-summary rs-clay" aria-label="Head to head ticket">
    <div className="rs-ticket-body"><header><h2>Head to head</h2><span>Wins</span></header>{(["a", "b"] as const).map(side => <div className="rs-ticket-score" key={side}><div><TeamLabel rivalry={rivalry} side={side} /><small>{s.goals[side]} total goals</small></div><strong>{s.wins[side]}</strong></div>)}<div className="rs-ticket-average"><span>Avg. goals / game</span><strong>{data.average}</strong></div></div>
    <aside className="rs-ticket-stub"><div className="rs-result-stamps"><span><strong>{s.completed}</strong>played</span><span><strong>{s.draws}</strong>draws</span></div><dl><div><dt>Current streak</dt><dd><Streak data={data} /></dd></div><div><dt>Biggest blowout</dt><dd><Blowout data={data} /></dd></div><div><dt>Biggest choke</dt><dd><Choke data={data} /></dd></div></dl></aside>
  </section>;
}

function BlueprintSummary({ data }: SummaryProps) {
  const { rivalry, stats: s } = data;
  return <section className="rs-summary rs-blueprint" aria-label="Head to head schematic">
    <div className="rs-schematic"><div className="rs-schematic-node"><TeamLabel rivalry={rivalry} side="a" /><strong>{s.wins.a}<small>wins</small></strong><span>{s.goals.a} total goals</span></div><div className="rs-schematic-connector"><span>Head to head</span><i aria-hidden="true" /><span>{s.completed} played<br />{s.draws} draws</span></div><div className="rs-schematic-node"><TeamLabel rivalry={rivalry} side="b" /><strong>{s.wins.b}<small>wins</small></strong><span>{s.goals.b} total goals</span></div></div>
    <dl className="rs-blueprint-defs"><div><dt>Current streak</dt><dd><Streak data={data} /></dd></div><div><dt>Avg. goals / game</dt><dd>{data.average}</dd></div><div><dt>Biggest blowout</dt><dd><Blowout data={data} /></dd></div><div><dt>Biggest choke</dt><dd><Choke data={data} /></dd></div></dl>
  </section>;
}

function WinRing({ data }: SummaryProps) {
  const titleId = useId();
  const { wins } = data.stats;
  const total = wins.a + wins.b;
  const share = total ? (wins.a / total) * 100 : 0;
  return <div className="rs-win-ring"><svg viewBox="0 0 160 160" role="img" aria-labelledby={titleId}><title id={titleId}>{total ? `Share of wins: ${data.rivalry.player_a} ${Math.round(share)} percent, ${data.rivalry.player_b} ${Math.round(100 - share)} percent. Draws excluded.` : "No wins yet"}</title><circle cx="80" cy="80" r="60" fill="none" stroke="var(--muted)" strokeWidth="21" /><circle cx="80" cy="80" r="60" fill="none" stroke={total ? "#ffffff" : "var(--line)"} strokeWidth="18" /><circle cx="80" cy="80" r="60" fill="none" stroke="#151515" strokeWidth="18" pathLength="100" strokeDasharray={`${share} ${100 - share}`} transform="rotate(-90 80 80)" /></svg><span aria-hidden="true"><strong>{total}</strong><small>wins</small></span></div>;
}

function CoralSummary({ data }: SummaryProps) {
  const { rivalry, stats: s } = data;
  return <section className="rs-summary rs-coral" aria-label="Head to head win share">
    <div className="rs-coral-record"><div className="rs-coral-player"><TeamLabel rivalry={rivalry} side="a" /><strong>{s.wins.a} <small>wins</small></strong><span>{s.goals.a} total goals</span></div><div className="rs-coral-chart"><WinRing data={data} /><p>{s.completed} played · {s.draws} draws</p></div><div className="rs-coral-player"><TeamLabel rivalry={rivalry} side="b" /><strong>{s.wins.b} <small>wins</small></strong><span>{s.goals.b} total goals</span></div></div>
    <dl className="rs-coral-chips"><div><dt>Current streak</dt><dd><Streak data={data} /></dd></div><div><dt>Avg. goals / game</dt><dd>{data.average}</dd></div><div><dt>Biggest blowout</dt><dd><Blowout data={data} /></dd></div><div><dt>Biggest choke</dt><dd><Choke data={data} /></dd></div></dl>
  </section>;
}

function StadiumSummary({ data }: SummaryProps) {
  const { rivalry, stats: s } = data;
  return <section className="rs-summary rs-stadium" aria-label="Head to head broadcast">
    <div className="rs-broadcast-bar"><div className="rs-broadcast-team"><TeamLabel rivalry={rivalry} side="a" /><small>{s.goals.a} total goals</small></div><div className="rs-broadcast-score"><span>Wins</span><strong>{s.wins.a}<i>–</i>{s.wins.b}</strong></div><div className="rs-broadcast-team"><TeamLabel rivalry={rivalry} side="b" /><small>{s.goals.b} total goals</small></div><div className="rs-broadcast-count"><b>{s.completed} played</b><span>{s.draws} draws</span></div></div>
    <ul className="rs-broadcast-facts"><li><span>Current streak</span><strong><Streak data={data} /></strong></li><li><span>Biggest blowout</span><Blowout data={data} /></li><li><span>Biggest choke</span><Choke data={data} /></li><li><span>Avg. goals / game</span><strong>{data.average}</strong></li></ul>
  </section>;
}

function ForestSummary({ data }: SummaryProps) {
  const { rivalry, stats: s } = data;
  return <section className="rs-summary rs-forest" aria-label="Head to head win rates">
    <div className="rs-forest-bars"><header><h2>Head to head</h2><span>{s.completed} played · {s.draws} draws</span></header>{(["a", "b"] as const).map(side => <div className="rs-forest-player" key={side}><div><TeamLabel rivalry={rivalry} side={side} /><strong>{s.wins[side]} wins</strong></div><div className="rs-win-track" role="img" aria-label={`${playerName(rivalry, side)} won ${s.wins[side]} of ${s.completed} completed games`}><span className={`kit-${side === "a" ? "black" : "white"}`} style={{ width: `${s.completed ? s.wins[side] / s.completed * 100 : 0}%` }} /></div><small>{s.goals[side]} total goals</small></div>)}</div>
    <dl className="rs-forest-facts"><div><dt>Current streak</dt><dd><Streak data={data} /></dd></div><div><dt>Biggest blowout</dt><dd><Blowout data={data} /></dd></div><div><dt>Biggest choke</dt><dd><Choke data={data} /></dd></div><div><dt>Avg. goals / game</dt><dd>{data.average}</dd></div></dl>
  </section>;
}

export function RivalrySummary({ rivalry, games, designId }: { rivalry: Rivalry; games: Game[]; designId: string }) {
  const stats = rivalryStats(games.filter(game => game.rivalry_id === rivalry.id));
  const data: Summary = { rivalry, stats, average: stats.completed ? (stats.totalGoals / stats.completed).toFixed(1) : "—" };
  switch (designId) {
    case "paper": return <PaperSummary data={data} />;
    case "pitch": return <PitchSummary data={data} />;
    case "mono": return <MonoSummary data={data} />;
    case "arcade": return <ArcadeSummary data={data} />;
    case "clay": return <ClaySummary data={data} />;
    case "blueprint": return <BlueprintSummary data={data} />;
    case "coral": return <CoralSummary data={data} />;
    case "stadium": return <StadiumSummary data={data} />;
    case "forest": return <ForestSummary data={data} />;
    default: return <ClubSummary data={data} />;
  }
}
