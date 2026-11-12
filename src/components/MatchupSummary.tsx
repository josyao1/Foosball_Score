import { Link } from 'react-router-dom';
import { ArrowUpRight, Flame } from 'lucide-react';
import { PlayerJersey } from './PlayerJersey';
import { useProfile } from '../lib/profile';
import { displayTeams, sidePlayers, matchesProfile } from '../lib/participants';
import { rivalryStats, score, playingTimeLabel } from '../lib/stats';
import { recordBook } from '../lib/records';
import type { Game, Rivalry, Side } from '../lib/types';
import './matchup-summary.css';

const situations = [
  ['opener', 'Scored first'], ['clutch', 'Reached 9–9'],
  ['comeback', 'Trailed by 3+'], ['matchPoint', 'Held match point'],
] as const;

export function MatchupSummary({ rivalry, games }: { rivalry: Rivalry; games: Game[] }) {
  const profile = useProfile();
  const teams = displayTeams(rivalry, profile);
  const history = games.filter(g => g.rivalry_id === rivalry.id && !g.deleted_at);
  const stats = rivalryStats(history);
  const { rates } = recordBook(history);
  const [first, second] = teams;
  const name = (side: Side) => teams.find(t => t.side === side)!.name;
  const gap = stats.wins[first.side] - stats.wins[second.side];
  const leader = gap > 0 ? first.name : second.name;
  const average = stats.completed ? (stats.totalGoals / stats.completed).toFixed(1) : '—';

  function identity(side: Side) {
    const members = [...sidePlayers(rivalry, side)].sort((a,b) => Number(matchesProfile(b,profile))-Number(matchesProfile(a,profile)));
    return <div className="rsp-identity"><span className="rsp-jerseys" aria-hidden="true">{members.map(p => <PlayerJersey key={p.id} name={p.name} decorative/>)}</span><strong>{name(side)}</strong></div>;
  }
  function rate(side: Side, key: typeof situations[number][0]) {
    const [wins, total] = rates[side][key];
    return <span className="rsp-rate" aria-label={`${name(side)}: ${wins} wins in ${total} qualifying games`}><b>{total ? `${Math.round(wins / total * 100)}%` : '—'}</b><small>{wins}/{total}</small></span>;
  }
  function hero() {
    return <div className="rsp-hero">
      <div className="rsp-matchup-identities">{teams.map(t=><div key={t.side}>{identity(t.side)}</div>)}</div>
      <div className="rsp-score" aria-label={`Series wins: ${first.name} ${stats.wins[first.side]}, ${second.name} ${stats.wins[second.side]}`}><b>{stats.wins[first.side]}</b><span>–</span><b>{stats.wins[second.side]}</b></div>
      <p className="rsp-lead">{stats.completed ? gap ? `${leader} leads by ${Math.abs(gap)}` : 'Series level' : 'No finished games yet'}</p>
      <div className="rsp-goals"><span><b>{stats.goals[first.side]}</b> goals</span><span><b>{stats.goals[second.side]}</b> goals</span></div>
    </div>;
  }
  function comparison() {
    return <div className="rsp-comparison"><h3>Win rate</h3>
      <div className="rsp-rate-labels"><span>{first.name}</span><span>{second.name}</span></div>
      {situations.map(([key,label])=><div className="rsp-rate-row" key={key}>{rate(first.side,key)}<span className="rsp-situation">{label}</span>{rate(second.side,key)}</div>)}
    </div>;
  }
  function footer() {
    const blowout = stats.blowout, choke = stats.choke;
    const result = blowout ? score(blowout.game.goals) : null;
    return <footer className="rsp-footer"><div className="rsp-metrics"><span><b>{stats.completed}</b> played</span><span><b>{average}</b> goals / game</span><span><b>{playingTimeLabel(stats.playingMs)}</b> playing</span></div>
      <div className="rsp-facts"><div><span>Current streak</span><strong>{stats.streak.side ? <><Flame size={14} aria-hidden="true"/>{name(stats.streak.side)} · {stats.streak.count} {stats.streak.count===1?'win':'wins'}</> : 'None yet'}</strong></div>
      <div><span>Biggest blowout</span>{blowout&&result ? <Link to={`/game/${blowout.game.id}`} aria-label={`${result[first.side]}–${result[second.side]} ${name(blowout.side)} by ${blowout.margin}`}><b>{result[first.side]}–{result[second.side]}</b><span>{name(blowout.side)} by {blowout.margin}</span><ArrowUpRight size={13} aria-hidden="true"/></Link> : <strong>None yet</strong>}</div>
      <div><span>Biggest choke</span>{choke ? <Link to={`/game/${choke.game.id}`}><b>{choke.lead}-goal lead</b><span>{name(choke.side)} led, then lost</span><ArrowUpRight size={13} aria-hidden="true"/></Link> : <strong>None yet</strong>}</div></div>
    </footer>;
  }
  return <section className="rsp-summary rsp-panel" aria-label="Rivalry comparison">
    <div className="rsp-main">{hero()}{comparison()}</div>
    {footer()}
  </section>;
}
