import { useEffect, useId, useState } from 'react';
import { completedGamesInPeriod, goalShare, GOAL_TYPES, playerDistribution, STATS_PERIODS } from '../lib/distribution';
import type { ShotType, StatsPeriod } from '../lib/distribution';
import { playerName } from '../lib/types';
import type { Game, GoalFlag, Rivalry, Side } from '../lib/types';
import { GoalBall } from './GoalBall';
import { RungTable } from './GameRungStats';
import '../breakdown.css';
import './rivalry-player-stats.css';

const SIDES:Side[] = ['a', 'b'];
const FLAGS:Record<ShotType,GoalFlag[]> = {
 regular:[], dunk:['dunk'], bank:['bank'], combo:['dunk','bank'], own_goal:['own_goal'],
};

export function RivalryBreakdown({games,rivalry}:{games:Game[];rivalry:Rivalry}) {
 const id = useId();
 const [period,setPeriod] = useState<StatsPeriod>('all');
 const [now,setNow] = useState(Date.now);
 useEffect(() => {
  const timer = window.setInterval(() => setNow(Date.now()), 60_000);
  return () => window.clearInterval(timer);
 }, []);
 const completed = completedGamesInPeriod(games,period,Math.max(now,Date.now()));
 const d = playerDistribution(completed);
 const periodLabel = STATS_PERIODS.find(([key]) => key === period)![1];
 return <section className="rivalry-breakdown rivalry-player-stats" aria-labelledby={`${id}-heading`}>
  <header className="section-heading player-stats-heading">
   <h2 id={`${id}-heading`}>Player stats</h2>
   <div className="segmented stats-period" role="group" aria-label="Player stats period">
    {STATS_PERIODS.map(([key,label]) => <button type="button" key={key}
     className={period === key ? 'active' : ''} aria-pressed={period === key}
     aria-label={`${key === 'all' ? 'All time' : key}: ${label}`}
     onClick={() => {setNow(Date.now());setPeriod(key)}}>{key === 'all' ? 'All time' : key}</button>)}
   </div>
  </header>
  <div className="panel shared-player-stats">
   <p className="stats-period-summary" role="status">{periodLabel} · {completed.length} completed {completed.length === 1 ? 'game' : 'games'}</p>
   {completed.length === 0 && <p className="stats-period-empty">No completed games in this period.</p>}
   <div className="shared-stats-visuals">
    <section className="rivalry-rung-section">
     <h3>Goals by rung</h3>
     <p className="stats-visual-caption">Count + share of each player’s goals scored</p>
     <RungTable rungs={{a:d.a.rungs,b:d.b.rungs}} rivalry={rivalry} totals={{a:d.a.scored,b:d.b.scored}}/>
    </section>
    <section className="rivalry-type-section">
     <h3>Goal types</h3>
     <p className="stats-visual-caption">Count + share of each player’s recorded goals</p>
     <div className="rung-table-players type-player-headings">
      {SIDES.map(side => <span key={side} className="rung-table-player"><i className={`stats-kit stats-kit-${side}`} aria-hidden="true"/><strong>{playerName(rivalry,side)}</strong></span>)}
     </div>
     <ul className="rivalry-type-list" role="list">
      {GOAL_TYPES.map(([key,label]) => <li key={key} className={`rivalry-type-row type-${key}`}>
       <div className="type-share-value type-share-a" role="group" aria-label={`${rivalry.player_a}, ${label}: ${d.a.types[key]} goals, ${goalShare(d.a.types[key],d.a.total)}%`}>
        <strong className={d.a.types[key] ? '' : 'is-zero'}>{d.a.types[key]}</strong><small>{goalShare(d.a.types[key],d.a.total)}%</small>
       </div>
       <div className="type-share-label"><span aria-hidden="true"><GoalBall flags={FLAGS[key]} size={27}/></span><span>{key === 'own_goal' ? 'Own goals made' : label}</span></div>
       <div className="type-share-value type-share-b" role="group" aria-label={`${rivalry.player_b}, ${label}: ${d.b.types[key]} goals, ${goalShare(d.b.types[key],d.b.total)}%`}>
        <strong className={d.b.types[key] ? '' : 'is-zero'}>{d.b.types[key]}</strong><small>{goalShare(d.b.types[key],d.b.total)}%</small>
       </div>
      </li>)}
     </ul>
     <p className="rung-table-note">Each goal counts once. Dunk + bank is its own type. Own goals count for the player who made them, only here.</p>
    </section>
   </div>
  </div>
 </section>;
}
