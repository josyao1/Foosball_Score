import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Swords, Radio } from 'lucide-react';
import { useStore } from '../lib/store';
import { useWeeklyFeature } from '../lib/useWeeklyFeature';
import { score } from '../lib/stats';
import { useProfile } from '../lib/profile';
import { HomePersonal } from '../components/HomePersonal';
import { WeeklyFeature } from '../components/WeeklyFeature';
import { gameHistory } from '../components/RecentGames';
import { HomeActivity } from '../components/HomeActivity';
import { NewRivalry } from './Home';
import './dashboard.css';

export function Dashboard() {
  const { games, rivalries } = useStore();
  const feature = useWeeklyFeature();
  const profile = useProfile();
  const bestRank = useMemo(() => feature.best ? gameHistory(games.filter(g => g.ended_at && Date.parse(g.ended_at) <= feature.now),rivalries)
    .find(entry => entry.game.id === feature.best?.game.id)?.rank : undefined,[games,rivalries,feature.best,feature.now]);
  const [creating, setCreating] = useState(false);
  const live = games.filter(g => !g.ended_at && !g.deleted_at && Date.parse(g.started_at) <= feature.now).flatMap(game => {
    const rivalry = rivalries.find(r => r.id === game.rivalry_id && !r.deleted_at);
    return rivalry ? [{game, rivalry}] : [];
  });
  return <div className="league-home">
    <header className="league-home-heading"><div><h1>Home</h1><span>{new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles',weekday:'long',month:'long',day:'numeric'}).format(feature.now)}</span></div>
      <button className="button primary" onClick={() => setCreating(true)}><Swords size={17}/>Find or create</button>
    </header>
    {live.length > 0 && <section className="home-live" aria-label="Live games">{live.map(({game,rivalry}) => {const s=score(game.goals);return <Link key={game.id} to={`/game/${game.id}`}><Radio size={17}/><span><strong>{rivalry.player_a} vs {rivalry.player_b}</strong><small>Game in progress · Resume scoring</small></span><b>{s.a}–{s.b}</b><ArrowUpRight size={16}/></Link>;})}</section>}
    <HomePersonal weekStart={feature.week.start} now={feature.now}/>
    <div className={`home-briefing-grid${feature.settings.enabled ? ' has-weekly' : ''}`}>
      <WeeklyFeature feature={feature} pausePopup={creating} briefing profile={profile} rank={bestRank}/>
      <HomeActivity games={games} rivalries={rivalries} now={feature.now}/>
    </div>
    {!games.length && <p className="home-first-game">Start a rivalry to score your first game. Results and achievements will appear here.</p>}
    {creating && <NewRivalry onClose={() => setCreating(false)}/>}
  </div>;
}
