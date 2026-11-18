import { useId } from 'react';
import { sidePlayers } from '../lib/participants';
import { matchupShortlist } from '../lib/weeklyFeature';
import type { weeklyFeature } from '../lib/weeklyFeature';
import type { Rivalry } from '../lib/types';
import { PlayerJersey } from './PlayerJersey';

export function WeeklyMatchupPicker({ candidates, selected, savedRivalry, disabled, onChange }: {
  candidates: ReturnType<typeof weeklyFeature>['candidates'];
  selected: string | null;
  savedRivalry?: Rivalry;
  disabled: boolean;
  onChange: (id: string | null) => void;
}) {
  const name = useId();
  const options = matchupShortlist(candidates);
  const singles = options.filter(c => sidePlayers(c.rivalry,'a').length === 1 && sidePlayers(c.rivalry,'b').length === 1).length;
  const outside = savedRivalry && !options.some(c => c.rivalry.id === savedRivalry.id);
  return <fieldset className="weekly-matchup-picker" disabled={disabled}>
    <legend>Matchup to play</legend>
    <p>Ranked suggestions, with four places reserved for singles when available. Select a matchup, then save below.</p>
    <label className="weekly-pick-auto"><input type="radio" name={name} checked={selected === null} onChange={()=>onChange(null)}/><span>Automatic recommendation</span></label>
    {outside && <label className="weekly-pick-auto"><input type="radio" name={name} checked={selected === savedRivalry.id} onChange={()=>onChange(savedRivalry.id)}/><span><strong>{savedRivalry.player_a} vs {savedRivalry.player_b}</strong><small>Current pick · outside these suggestions</small></span></label>}
    {options.length ? <>
      <div className="weekly-suggestions-heading"><strong>{options.length} ranked suggestions</strong><span>{singles} singles</span></div>
      <ol className="weekly-suggestions">{options.map((candidate,index) => {
        const {rivalry,rating,count,close,daysSincePlayed,cooldownPenalty}=candidate;
        const solo=sidePlayers(rivalry,'a').length===1 && sidePlayers(rivalry,'b').length===1;
        const days=Math.floor(daysSincePlayed);
        return <li key={rivalry.id}><label className={`weekly-pick-option${selected===rivalry.id?' is-selected':''}`}>
          <input type="radio" name={name} aria-label={`${rivalry.player_a} vs ${rivalry.player_b}`} checked={selected===rivalry.id} onChange={()=>onChange(rivalry.id)}/>
          <span className="weekly-pick-details">
            <span className="weekly-pick-rank">#{index+1} <span>· {solo ? 'Singles' : 'Teams'}</span></span>
            <span className="weekly-pick-teams">{(['a','b'] as const).map(side=><span key={side}><span className="weekly-pick-jerseys">{sidePlayers(rivalry,side).map(p=><PlayerJersey key={p.id} name={p.name} decorative/>)}</span><strong>{side==='a'?rivalry.player_a:rivalry.player_b}</strong></span>)}</span>
            <small>{close}/{count} close finishes · {days===0?'Played today':`Last played ${days} ${days===1?'day':'days'} ago`}{cooldownPenalty>0?` · −${cooldownPenalty} for recent play`:''}</small>
          </span>
          <span className="weekly-pick-score"><strong>{rating.toFixed(1)}</strong><small>score</small></span>
        </label></li>;
      })}</ol>
    </> : <p>No eligible matchups yet. Suggestions appear once active players have finished ranked games; live matchups are excluded.</p>}
  </fieldset>;
}
