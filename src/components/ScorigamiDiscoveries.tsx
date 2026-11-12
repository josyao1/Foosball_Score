import { useMemo, useState } from 'react';
import { ArrowUpRight, MoveRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog } from './Dialog';
import { GoalBall } from './GoalBall';
import { missingScores, scorigamiRecords } from '../lib/scorigamiDiscoveries';
import type { OddityId, OddityMatch } from '../lib/scorigamiDiscoveries';
import type { ScoreBucket } from '../lib/scorigami';
import { clock, playingTime, score } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import { playerName } from '../lib/types';
import type { Game, GoalFlag, Rivalry } from '../lib/types';

const labels: Record<OddityId, string> = {
  dunks: 'Dunks in a game', banks: 'Banks in a game', ownGoals: 'Own goals in a game',
  rung: 'Goals from one rung', specials: 'Special goals in a game',
};
const flags: Record<OddityId, GoalFlag[]> = {
  dunks: ['dunk'], banks: ['bank'], ownGoals: ['own_goal'], rung: [], specials: ['dunk', 'bank'],
};
function RecordIcon({ id }: { id: OddityId }) {
  return id === 'rung' ? <span className="sc-oddity-rod" aria-hidden="true"><i/><i/><i/></span>
    : <GoalBall flags={flags[id]} size={28}/>;
}
function GamePreview({ match, rivalry }: { match: OddityMatch; rivalry?: Rivalry }) {
  const { game, holders } = match, s = score(game.goals);
  return <Link className="sc-oddity-game" to={`/game/${game.id}`}>
    <span className="sc-oddity-game-names">{rivalry?.player_a ?? 'Black'} <span>vs</span> {rivalry?.player_b ?? 'White'}</span>
    <strong>{s.a}–{s.b} <ArrowUpRight size={14} aria-hidden="true"/></strong>
    {holders.length > 0 && <span className="sc-oddity-holders">{holders.map(h => `${rivalry ? playerName(rivalry, h.side) : h.side === 'a' ? 'Black' : 'White'} · ${h.rung}`).join(' / ')}</span>}
    <small>{gameDate(game.started_at)} · {gameTime(game.started_at)} · {clock(playingTime([game]))} played</small>
  </Link>;
}

export function ScorigamiDiscoveries({ games, buckets, maxScore, rivalries }: {
  games: Game[]; buckets: Map<string, ScoreBucket>; maxScore: number; rivalries: Rivalry[];
}) {
  const [selected, setSelected] = useState<OddityId | null>(null);
  const records = useMemo(() => scorigamiRecords(games), [games]);
  const missing = useMemo(() => missingScores(buckets, maxScore), [buckets, maxScore]);
  const rivalryMap = useMemo(() => new Map(rivalries.map(r => [r.id, r])), [rivalries]);
  const detail = records.find(r => r.id === selected && r.value > 0);
  const special = records.find(r => r.id === 'specials')!;
  const featured = special.matches[0];
  const specialGoals = featured?.game.goals.filter(g => g.flags.length > 0) ?? [];
  const ticket = ({ high, low }: { high: number; low: number }) => <span className="sc-missing-ticket" key={`${high}-${low}`}>
    <strong>{high}–{low}</strong><small>{high === 10 ? 'Unplayed' : 'Overtime · unplayed'}</small>
  </span>;
  return <div className="sc-discoveries">
    <section className="sc-missing" aria-labelledby="sc-missing-title">
      <header><h2 id="sc-missing-title">Still missing</h2><p>{buckets.size ? 'The next spaces in your score collection.' : 'Your score collection starts here.'}</p></header>
      <div className="sc-missing-tickets">{missing.slice(0, 6).map(ticket)}</div>
      {missing.length > 6 && <details className="sc-missing-more"><summary>{missing.length - 6} more unplayed scores</summary><div className="sc-missing-tickets">{missing.slice(6).map(ticket)}</div></details>}
    </section>
    <section className="sc-oddities" aria-labelledby="sc-oddities-title">
      <header className="sc-section-heading"><h2 id="sc-oddities-title">Oddities</h2><span className="sc-section-count">Single-game records</span></header>
      <p className="sc-section-note">Both teams combined. Rung records count one side’s total.</p>
      <div className="sc-oddity-grid">{records.filter(r => r.id !== 'specials').map(record => {
        const latest = record.matches[0];
        const rivalry = latest && rivalryMap.get(latest.game.rivalry_id);
        const s = latest && score(latest.game.goals);
        return <button type="button" key={record.id} className={`sc-oddity-ticket sc-oddity-${record.id}`}
          disabled={!record.value} onClick={() => setSelected(record.id)} aria-haspopup="dialog"
          aria-label={`${labels[record.id]}: ${record.value || 'none yet'}. ${record.matches.length} record games`}>
          <span className="sc-oddity-top"><RecordIcon id={record.id}/><ArrowUpRight size={15} aria-hidden="true"/></span>
          <strong className="sc-oddity-value">{record.value || '—'}</strong>
          <span className="sc-oddity-label">{labels[record.id]}</span>
          <small>{record.value ? `${record.matches.length} of ${games.length} games` : 'No record yet'}</small>
          {latest && <span className="sc-oddity-preview">
            <span>{record.id === 'rung' && rivalry ? latest.holders.map(h => `${playerName(rivalry, h.side)} · ${h.rung}`).join(' / ') : `${rivalry?.player_a ?? 'Black'} vs ${rivalry?.player_b ?? 'White'}`}</span>
            <span><b>{s!.a}–{s!.b}</b> · {gameDate(latest.game.started_at)}</span>
          </span>}
        </button>;
      })}</div>
      {featured && <button type="button" className="sc-special-feature" onClick={() => setSelected('specials')} aria-haspopup="dialog">
        <span className="sc-special-copy"><small>Most special goals</small><strong>{special.value} of {featured.game.goals.length} goals</strong><span>{special.matches.length === 1 ? 'One game' : `${special.matches.length} games tied`} · {rivalryMap.get(featured.game.rivalry_id)?.player_a} vs {rivalryMap.get(featured.game.rivalry_id)?.player_b}</span></span>
        <span className="sc-special-balls" aria-hidden="true">{specialGoals.slice(0, 12).map(g => <GoalBall key={g.id} flags={g.flags} size={24}/>)}{specialGoals.length > 12 && <small>+{specialGoals.length - 12}</small>}</span>
        <MoveRight size={18} aria-hidden="true"/>
      </button>}
    </section>
    {detail && <Dialog title={labels[detail.id]} onClose={() => setSelected(null)} closeOnBackdrop className="sc-oddity-dialog">
      <div className="sc-oddity-detail-number"><RecordIcon id={detail.id}/><strong>{detail.value}</strong><span>{detail.matches.length} of {games.length} games</span></div>
      <p className="sc-section-note">{detail.id === 'rung' ? 'One side’s goals from a single rung, including both teammates. Own goals excluded.' : detail.id === 'specials' ? 'Dunks, banks and own goals across both teams. Each goal counts once.' : detail.id === 'ownGoals' ? 'Own goals made across both teams.' : 'Combined across both teams. Dunk + bank counts in each category; own goals excluded.'}</p>
      <div className="sc-oddity-game-list" role="region" aria-label="Record games" tabIndex={0}>
        {detail.matches.map(match => <GamePreview key={match.game.id} match={match} rivalry={rivalryMap.get(match.game.rivalry_id)}/>)}
      </div>
    </Dialog>}
  </div>;
}
