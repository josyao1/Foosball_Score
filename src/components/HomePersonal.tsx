import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, UserRound } from 'lucide-react';
import { useStore } from '../lib/store';
import { useProfile, openProfilePicker } from '../lib/profile';
import { allPlayers, goalCredit, matchesProfile, sidePlayers } from '../lib/participants';
import { playingTime, playingTimeLabel, score, winner } from '../lib/stats';
import { otherSide, type Game, type Rivalry } from '../lib/types';
import { PlayerJersey } from './PlayerJersey';
import { useId, useState, type CSSProperties } from 'react';
import { usePlayerAppearance } from '../lib/PlayerAppearanceContext';

export function personalResults(games: Game[], rivalries: Rivalry[], profile: string | null, now: number) {
  const parents = new Map(rivalries.filter(r => !r.deleted_at).map(r => [r.id, r]));
  return games.flatMap(game => {
    const rivalry = parents.get(game.rivalry_id);
    if (!rivalry || game.deleted_at || !game.ended_at || Date.parse(game.ended_at) > now) return [];
    const side = (['a', 'b'] as const).find(s => sidePlayers(rivalry, s).some(p => matchesProfile(p, profile)));
    if (!side) return [];
    const won = winner(game);
    return [{ game, rivalry, side, result: won ? won === side ? 'W' : 'L' : 'D',
      team: sidePlayers(rivalry, 'a').length > 1 || sidePlayers(rivalry, 'b').length > 1 }];
  }).sort((a, b) => Date.parse(b.game.ended_at!) - Date.parse(a.game.ended_at!) || b.game.id.localeCompare(a.game.id));
}

export function HomePersonal({ weekStart, now }: { weekStart: number; now: number }) {
  const { games, rivalries, players } = useStore();
  const selected = useProfile();
  const player = allPlayers(rivalries, players).find(p => matchesProfile(p, selected));
  const kit = usePlayerAppearance(player?.name ?? '');
  const breakdownId = useId();
  const [expanded, setExpanded] = useState(true);
  if (!player) return <section className="home-personal home-profile-prompt" aria-label="Your home">
    <UserRound size={26} aria-hidden="true"/>
    <div><h2>Make yourself at home.</h2><p>Pick your jersey for your weekly record and latest result.</p></div>
    <button className="button secondary" onClick={openProfilePicker}>Choose your player <ArrowUpRight size={16}/></button>
  </section>;
  const results = personalResults(games, rivalries, selected, now);
  const weekly = results.filter(r => Date.parse(r.game.ended_at!) >= weekStart);
  const goals = Math.floor(weekly.reduce((total, { game, rivalry, side }) => total + game.goals.reduce((count, goal) =>
    count + (goal.actor_side === side && !goal.flags.includes('own_goal') ? goalCredit(goal, rivalry, player.id) : 0), 0), 0));
  const timePlayed = playingTime(weekly.map(r => r.game));
  const latest = results[0], finalScore = latest ? score(latest.game.goals) : null;
  const wins = weekly.filter(r => r.result === 'W').length, losses = weekly.filter(r => r.result === 'L').length, draws = weekly.filter(r => r.result === 'D').length;
  return <section className="home-personal home-personal-tinted" aria-label="Your home" style={{'--personal-color':kit.color,'--personal-trim':kit.trim} as CSSProperties}>
    <div className="home-personal-head">
    <div className="home-personal-identity"><PlayerJersey name={player.name} decorative/><div><h2>{player.name}</h2><span>This week at the table</span></div></div>
    <div className="home-personal-summary" aria-label="Weekly record"><strong>{weekly.length ? `${wins}W–${losses}L${draws ? `–${draws}D` : ''}` : '—'}</strong><small>{weekly.length} {weekly.length === 1 ? 'game' : 'games'}</small></div>
    </div>
    <div className="home-personal-breakdown">
    <button type="button" aria-expanded={expanded} aria-controls={breakdownId} onClick={() => setExpanded(value => !value)}><ChevronDown size={14} aria-hidden="true"/>Weekly breakdown</button>
    <div id={breakdownId} className="home-breakdown-panel" data-expanded={expanded} aria-hidden={!expanded} inert={!expanded}><div className="home-breakdown-clip">
    <div className="home-personal-records">{[false, true].map(team => {
      const entries = weekly.filter(r => r.team === team);
      const wins = entries.filter(r => r.result === 'W').length, losses = entries.filter(r => r.result === 'L').length, draws = entries.filter(r => r.result === 'D').length;
      return <div key={String(team)}><span>{team ? 'Team games' : 'Singles'}</span><strong>{entries.length ? `${wins}W–${losses}L` : '—'}</strong><small>{entries.length} {entries.length === 1 ? 'game' : 'games'}{draws ? ` · ${draws} ${draws === 1 ? 'draw' : 'draws'}` : ''}</small></div>;
    })}
      <div><span>Goals scored</span><strong>{goals}</strong></div>
      <div><span>Time played</span><strong>{playingTimeLabel(timePlayed)}</strong></div>
    </div></div></div></div>
    {latest && finalScore ? <Link className="home-personal-latest" to={`/game/${latest.game.id}`}>
      <div><small>Your latest result</small>{' '}<strong>{latest.result === 'W' ? 'Won' : latest.result === 'L' ? 'Lost' : 'Drew'} {finalScore[latest.side]}–{finalScore[otherSide(latest.side)]}</strong>{' '}<span>vs {sidePlayers(latest.rivalry, otherSide(latest.side)).map(p => p.name).join(' and ')}</span></div><ArrowUpRight size={18}/>
    </Link> : <div className="home-personal-latest"><p>Your first result goes here.</p></div>}
  </section>;
}
