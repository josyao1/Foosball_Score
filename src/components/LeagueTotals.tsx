import { Activity, Swords, Target, Timer } from 'lucide-react';
import { playingTime, playingTimeLabel } from '../lib/stats';
import type { Game, Rivalry } from '../lib/types';
import './league-totals.css';

/** Shared by Home and Rivalries so both use the same all-time scope. */
export function LeagueTotals({ games, rivalries, home = false }: { games: Game[]; rivalries: Rivalry[]; home?: boolean }) {
  const active = rivalries.filter(r => !r.deleted_at);
  const parents = new Set(active.map(r => r.id));
  const completed = games.filter(g => g.ended_at && !g.deleted_at && parents.has(g.rivalry_id));
  return <section className={home ? 'league-totals' : undefined} aria-label="All-time league totals">
    {home && <h2>All-time totals</h2>}
    <div className={home ? 'league-totals-grid' : 'overview-strip'}>
      <div><Swords size={19} aria-hidden="true"/><strong>{active.length}</strong><span>{active.length === 1 ? 'rivalry' : 'rivalries'}</span></div>
      <div><Activity size={19} aria-hidden="true"/><strong>{completed.length}</strong><span>{completed.length === 1 ? 'game' : 'games'}<span className="overview-detail"> played</span></span></div>
      <div><Target size={19} aria-hidden="true"/><strong>{completed.reduce((n, g) => n + g.goals.length, 0)}</strong><span>goals<span className="overview-detail"> scored</span></span></div>
      <div aria-label={`${playingTimeLabel(playingTime(completed))} spent playing`} title="Completed games, from start to last goal; rounded to the nearest minute"><Timer size={19} aria-hidden="true"/><strong>{playingTimeLabel(playingTime(completed))}</strong><span className="overview-detail">spent playing</span></div>
    </div>
  </section>;
}
