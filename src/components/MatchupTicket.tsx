import { Link } from 'react-router-dom';
import { ArrowUpRight, Flame, Radio, Sparkles } from 'lucide-react';
import { PlayerJersey } from './PlayerJersey';
import { sidePlayers, type DisplayTeams } from '../lib/participants';
import { rivalryStats, score, winner } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import type { Game, Rivalry } from '../lib/types';
import './matchup-ticket.css';

export function MatchupTicket({rivalry,teams,games}:{rivalry:Rivalry;teams:DisplayTeams;games:Game[]}) {
  const history=games.filter(g=>g.ended_at&&!g.deleted_at).sort((a,b)=>Date.parse(a.ended_at!)-Date.parse(b.ended_at!)||a.id.localeCompare(b.id));
  const recent=[...history].reverse();
  const live=games.find(g=>!g.ended_at&&!g.deleted_at);
  const stats=rivalryStats(history);
  const [first,second]=teams;
  const gap=stats.wins[first.side]-stats.wins[second.side];
  const lead=gap===0?'Series level':`${gap>0?first.name:second.name} leads by ${Math.abs(gap)}`;
  const streak=teams.find(t=>t.side===stats.streak.side);
  const matchup=teams.map(t=>t.name).join(' vs ');

  function jerseys(team:DisplayTeams[number]) {
    // Display ordering follows the selected profile, including within a team.
    const members=[...sidePlayers(rivalry,team.side)].sort((a,b)=>team.name.indexOf(a.name)-team.name.indexOf(b.name));
    return <span className="rtp-jerseys" aria-hidden="true">{members.map(p=><PlayerJersey key={p.id} name={p.name} decorative/>)}</span>;
  }
  function identities() {
    return <div className="rtp-identities">{teams.map(t=><div key={t.side}>{jerseys(t)}<strong>{t.name}</strong></div>)}</div>;
  }
  function numbers(a:number,b:number) {
    return <div className="rtp-numbers" aria-label="Series wins"><strong>{a}</strong><span aria-hidden="true">–</span><strong>{b}</strong></div>;
  }
  function recentRows(items:Game[]) {
    return <ul className="rtp-recent">{items.map(g=>{
      const s=score(g.goals);
      return <li key={g.id}><Link to={`/game/${g.id}`} aria-label={`${gameDate(g.started_at)}, ${gameTime(g.started_at)}: ${first.name} ${s[first.side]}, ${second.name} ${s[second.side]}`}>
        <time dateTime={g.started_at}>{gameDate(g.started_at)}<small>{gameTime(g.started_at)}</small></time>
        <b>{s[first.side]} <span>–</span> {s[second.side]}</b><ArrowUpRight size={14} aria-hidden="true"/>
      </Link></li>;
    })}</ul>;
  }
  const lastFive=recent.slice(0,5);
  const dominant=lastFive.length===5&&teams.find(t=>lastFive.filter(g=>winner(g)===t.side).length>=4);
  const closeThree=recent.length>=3&&recent.slice(0,3).every(g=>{const s=score(g.goals);return Math.abs(s.a-s.b)===2;});
  const fact=closeThree?'Last 3 games decided by two goals':dominant?`${dominant.name} has won ${lastFive.filter(g=>winner(g)===dominant.side).length} of the last 5`:null;
  return <div className="rtp-matchup">
      <article className="rtp-ticket" aria-label={matchup}>
          <div className="rtp-body">
            {identities()}{numbers(stats.wins[first.side],stats.wins[second.side])}
            <p className="rtp-lead">{lead}</p>
            {streak&&<span className="rtp-streak"><Flame size={13} aria-hidden="true"/>{streak.name} · {stats.streak.count}-win streak</span>}
          </div>
          <section className="rtp-stub" aria-label="Recent games">{fact&&<p className="rtp-fact"><Sparkles size={14} aria-hidden="true"/>{fact}</p>}{recentRows(recent.slice(0,2))}{!recent.length&&<p className="rtp-empty">No finished games yet.</p>}</section>
        <footer className="rtp-footer">{live?<Link className="rtp-live" to={`/game/${live.id}`}><Radio size={13} aria-hidden="true"/>Resume game</Link>:<span/>}
          <Link className="rtp-stats" aria-label={`View stats for ${matchup}`} to={`/rivalry/${rivalry.id}`}>View stats <ArrowUpRight size={14} aria-hidden="true"/></Link>
        </footer>
      </article>
  </div>;
}
