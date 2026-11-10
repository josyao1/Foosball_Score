import { Fragment, useId, useState } from 'react';
import { Award, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MASTERY, TIERS } from '../lib/mastery';
import type { MasteryId, PlayerMastery } from '../lib/mastery';
import { gameDate } from '../lib/time';

export function MasteryBadges({progress}:{progress:PlayerMastery}) {
  const [selected,setSelected]=useState<MasteryId|null>(null);
  // Retain the last tier list in each row so CSS can reverse an in-flight fold.
  const [shownByRow, setShownByRow] = useState<Partial<Record<MasteryId, MasteryId>>>({});
  const id=useId();
  const earned=MASTERY.filter(b=>progress[b.id].earned.length).length;
  const rows=Array.from({length:Math.ceil(MASTERY.length/2)},(_,i)=>MASTERY.slice(i*2,i*2+2));
  return <section className="passport-mastery" aria-label="IXL mastery badges">
    <div className="mastery-heading"><h3>IXL mastery</h3><span>{earned} / {MASTERY.length} badges</span></div>
    <div className={`mastery-grid${selected ? ' has-selection' : ''}`}>{rows.map((row)=>{
      const rowId = row[0].id;
      const panelId = `${id}-${rowId}-details`;
      const active = row.find(badge => badge.id === shownByRow[rowId]);
      const open = !!active && selected === active.id;
      return <Fragment key={row[0].id}>
        {row.map(badge=>{
          const state=progress[badge.id],level=state.earned.length,next=badge.thresholds[level];
          return <button type="button" id={`${id}-${badge.id}`} className={`mastery-badge tier-${level}`} key={badge.id} aria-expanded={selected===badge.id} aria-controls={panelId} onClick={() => {
            setShownByRow(previous => ({...previous, [rowId]: badge.id}));
            setSelected(previous => previous === badge.id ? null : badge.id);
          }}>
            <Award size={22} aria-hidden="true"/><span><strong>{badge.label}</strong>{' '}<small>{level ? TIERS[level-1] : 'Not earned'} · {next ? `${state.count} / ${next}` : `${state.count} total`}</small></span><span className="mastery-expand" aria-hidden="true">{selected===badge.id ? '−' : '+'}</span>
          </button>;
        })}
        <div id={panelId} role="region" aria-labelledby={active ? `${id}-${active.id}` : undefined}
          aria-hidden={!open} inert={!open} className="mastery-disclosure" data-open={open}>
          <div className="mastery-disclosure-clip">{active && <div className="mastery-requirements">
          <p>{active.id==='recovery' ? 'Win a first-to-10, win-by-two game after your opponent was one goal from winning.' : active.id==='allRungs' ? 'Score from goalie, defender, middle and attacker in the same finished game.' : `Accumulate ${active.unit} across finished games.`}</p>
          {active.thresholds.map((threshold,i)=>{
            const game=progress[active.id].earned[i];
            const unit = active.id === 'wins' && threshold === 1 ? 'win' : active.unit;
            return <div className="mastery-tier" key={threshold}><span><b className={`mastery-tier-label medal-${i+1}`}>{TIERS[i]}</b><small>{threshold} {unit}</small></span>{game ? <Link to={`/game/${game.id}`} aria-label={`${active.label}: ${TIERS[i]}, ${threshold} ${unit}. View earning game`} title={gameDate(game.started_at)}>Earned<ArrowUpRight size={13}/></Link> : <span className="mastery-remaining">{threshold-progress[active.id].count} to go</span>}</div>;
          })}
          </div>}</div>
        </div>
      </Fragment>;
    })}</div>
  </section>;
}
