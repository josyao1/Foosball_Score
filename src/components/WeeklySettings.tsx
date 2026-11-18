import { useState } from 'react';
import { useStore } from '../lib/store';
import { useWeeklyFeature } from '../lib/useWeeklyFeature';
import { WEEKDAYS, type WeeklySettings as Settings } from '../lib/weeklyFeature';
import { score } from '../lib/stats';
import { WeeklyFeatureCards } from './WeeklyFeature';
import { gameDate, gameTime } from '../lib/time';

export function WeeklySettings() {
  const store = useStore();
  const feature = useWeeklyFeature();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [notice, setNotice] = useState(''), [error, setError] = useState('');
  const current = draft ?? feature.settings;
  const currentOverride = current.override_week === feature.week.key;
  function edit(patch: Partial<Settings>) { setNotice(''); setDraft({...current, ...patch}); }
  function choose(patch: Partial<Settings>) {
    edit({ ...(!currentOverride ? {rivalry_id:null,game_id:null} : {}), override_week:feature.week.key, ...patch });
  }
  async function save() {
    setError(''); setNotice('');
    try { await store.updateWeeklySettings(current); setDraft(null); setNotice('Weekly feature updated for everyone.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save the weekly feature.'); }
  }
  return <section className="weekly-settings" aria-label="Weekly feature settings">
    <p>Two weekly picks for everyone. Weeks run Monday–Sunday, Pacific time. Manual picks last for this week only.</p>
    <div className="weekly-settings-fields">
      <label className="weekly-enabled"><input type="checkbox" checked={current.enabled} disabled={store.busy} onChange={e => edit({enabled:e.target.checked})}/>Show the weekly feature</label>
      <label>Feature day<select aria-label="Feature day" value={current.weekday} disabled={store.busy} onChange={e => edit({weekday:Number(e.target.value)})}>{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select><small>The banner stays on Home; the popup appears once on this day.</small></label>
      <label>Matchup to play<select value={currentOverride ? current.rivalry_id ?? '' : ''} disabled={store.busy} onChange={e => choose({rivalry_id:e.target.value || null})}>
        <option value="">Automatic recommendation</option>{store.rivalries.map(r => <option key={r.id} value={r.id}>{r.player_a} vs {r.player_b}</option>)}
      </select></label>
      <label>Game of the week<select value={currentOverride ? current.game_id ?? '' : ''} disabled={store.busy} onChange={e => choose({game_id:e.target.value || null})}>
        <option value="">Highest intensity this week</option>{feature.weekGames.map(({game, rivalry, rating}) => {const s=score(game.goals);return <option key={game.id} value={game.id}>{rivalry.player_a} {s.a}–{s.b} {rivalry.player_b} · {gameDate(game.ended_at!)} {gameTime(game.ended_at!)} · {rating.total.toFixed(1)}</option>;})}
      </select></label>
    </div>
    {(error || store.error) && <p role="alert" className="form-error">{error || store.error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="weekly-settings-actions"><button className="button primary" disabled={!draft || store.busy} onClick={() => void save()}>{store.busy ? 'Saving…' : 'Save weekly feature'}</button>
      {draft && <button className="text-button" disabled={store.busy} onClick={() => {setDraft(null);setError('');void store.refresh();}}>Reload settings</button>}
      <button className="text-button" disabled={store.busy} onClick={() => edit({override_week:null,rivalry_id:null,game_id:null})}>Use automatic picks</button>
    </div>
    <h3>Current feature</h3><WeeklyFeatureCards feature={feature}/>
    <details className="weekly-method"><summary>How the matchup is picked</summary><p>Ranked games contribute intensity, close finishes and even win records. A larger sample counts more than a one-off result. Players must have played in the last 30 days. Rivalries lose 45 points after a meeting in the last day, 30 within three days, or 15 within a week. Live matchups are excluded. Game-quality evidence is fixed on Monday; the recent-play penalty updates so a played recommendation can make room for another matchup. Near-equal contenders rotate weekly.</p>
      <ol>{feature.candidates.slice(0,5).map(c => <li key={c.rivalry.id}><span>{c.rivalry.player_a} vs {c.rivalry.player_b}<small>{c.close}/{c.count} close finishes · {c.winsA}–{c.winsB} in the sample{c.cooldownPenalty > 0 ? ` · −${c.cooldownPenalty} for recent play` : ''}</small></span><strong>{c.rating.toFixed(1)}</strong></li>)}</ol>
    </details>
  </section>;
}
