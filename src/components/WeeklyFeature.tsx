import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Swords, Trophy } from 'lucide-react';
import { PlayerJersey } from './PlayerJersey';
import { Dialog } from './Dialog';
import { WeeklyBriefing } from './WeeklyBriefing';
import { sidePlayers } from '../lib/participants';
import { score } from '../lib/stats';
import { gameDate } from '../lib/time';
import { WEEKDAYS } from '../lib/weeklyFeature';
import { useWeeklyFeature } from '../lib/useWeeklyFeature';
import type { Rivalry } from '../lib/types';
import './weekly-feature.css';

type Feature = ReturnType<typeof useWeeklyFeature>;
const seenThisVisit = new Set<string>();
const calendarDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {timeZone:'UTC', month:'short', day:'numeric'});
export function WeeklyTeams({ rivalry, result, label }: { rivalry: Rivalry; result?: {a:number;b:number}; label: string }) {
  return <div className="weekly-match"><div className="weekly-score-label">{label}</div><div className={`weekly-teams${result ? ' has-result' : ''}`}>{(['a', 'b'] as const).map(side => <div className="weekly-team" key={side}>
    <div className="weekly-jerseys">{sidePlayers(rivalry, side).map(player => <PlayerJersey key={player.id} name={player.name} decorative />)}</div>
    <strong>{side === 'a' ? rivalry.player_a : rivalry.player_b}</strong>
    {result && <b>{result[side]}</b>}
  </div>)}</div></div>;
}

export function WeeklyFeatureCards({ feature, onNavigate }: { feature: Feature; onNavigate?: () => void }) {
  const { best, matchup, evidence, settings } = feature;
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const id = useId();
  function showCard(index: number) {
    const row = track.current, card = row?.children[index] as HTMLElement | undefined;
    if (!row || !card) return;
    setActive(index);
    row.scrollTo({ left: card.offsetLeft, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function followSwipe() {
    const row = track.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    setActive(row.scrollLeft > (row.scrollWidth - row.clientWidth) / 2 ? 1 : 0);
  }
  return <div className="weekly-carousel">
    <div className="weekly-cards" ref={track} onScroll={followSwipe}>
    <article id={`${id}-matchup`} className="weekly-card weekly-upcoming" aria-label="Recommended matchup">
      <header><span><Swords size={16} aria-hidden="true"/>{WEEKDAYS[settings.weekday]} matchup</span><small>{calendarDate(feature.week.featureDay)}</small></header>
      {matchup ? <>
        <WeeklyTeams rivalry={matchup} result={evidence ? {a:evidence.winsA,b:evidence.winsB} : undefined} label={evidence ? `Series wins · last ${evidence.count}` : 'Next matchup'} />
        <div className="weekly-reason">
          {evidence ? <><strong>{evidence.close === 0 ? 'Time for a rematch' : evidence.count === 1 ? 'Their last game came down to two goals' : `${evidence.close} of ${evidence.count} games decided by two goals`}</strong><span>{evidence.daysSincePlayed < 1 ? 'Last played today' : `Last played ${Math.floor(evidence.daysSincePlayed)} ${Math.floor(evidence.daysSincePlayed) === 1 ? 'day' : 'days'} ago`}</span></>
            : <><strong>A fresh matchup</strong><span>Chosen for this week.</span></>}
        </div>
        <Link className="weekly-action" to={`/rivalry/${matchup.id}`} onClick={onNavigate}>Open matchup <ArrowUpRight size={16}/></Link>
      </> : <div className="weekly-empty"><strong>The next rivalry starts here.</strong><p>Finish a first-to-10 game to build the first recommendation, or choose a matchup in Backlog.</p><Link to="/rivalries" onClick={onNavigate}>Explore rivalries <ArrowUpRight size={15}/></Link></div>}
    </article>
    <article id={`${id}-game`} className="weekly-card weekly-best" aria-label="Game of the week">
      <header><span><Trophy size={16} aria-hidden="true"/>Game of the week</span><small>{feature.manualGame ? 'Weekly pick' : 'Best so far'}</small></header>
      {best ? <>
        <WeeklyTeams rivalry={best.rivalry} result={score(best.game.goals)} label={`Final score · ${gameDate(best.game.started_at)}`} />
        <div className="weekly-reason"><strong>{best.captions[0]}</strong><span>{best.rating.total.toFixed(1)} / 100 intensity</span></div>
        <Link className="weekly-action" to={`/game/${best.game.id}`} onClick={onNavigate}>View game <ArrowUpRight size={16}/></Link>
      </> : <div className="weekly-empty"><strong>This week’s classic is still to come.</strong><p>The most intense finished game earns this spot. Close scores, comebacks and lead changes all count.</p><Link to="/hall-of-fame" onClick={onNavigate}>Past classics <ArrowUpRight size={15}/></Link></div>}
    </article>
    </div>
    <div className="weekly-carousel-controls" role="group" aria-label="Weekly cards">
      {['Matchup', 'Game of the week'].map((label, index) => <button key={label} type="button" aria-pressed={active === index} aria-controls={`${id}-${index === 0 ? 'matchup' : 'game'}`} onClick={() => showCard(index)}><span aria-hidden="true"/>{label}</button>)}
    </div>
  </div>;
}

export function WeeklyFeature({ feature, pausePopup = false, briefing = false, profile = null, rank }: { feature: Feature; pausePopup?: boolean; briefing?: boolean; profile?: string|null; rank?: number }) {
  const [open, setOpen] = useState(false);
  const key = `tabletalk.weekly-feature.${feature.week.key}`;
  const eligible = feature.settings.enabled && !feature.loading && feature.week.isFeatureDay && !!(feature.matchup || feature.best);
  useEffect(() => {
    if (!eligible || pausePopup || seenThisVisit.has(key)) return;
    try { if (localStorage.getItem(key)) return; } catch { /* Use memory when storage is blocked. */ }
    seenThisVisit.add(key);
    try { localStorage.setItem(key, 'seen'); } catch { /* Already tracked for this visit. */ }
    setOpen(true);
  }, [eligible, key, pausePopup]);
  useEffect(() => { if (!eligible) setOpen(false); }, [eligible]);
  if (!feature.settings.enabled) return null;
  return <section className="weekly-feature" aria-label={briefing ? "This week at the table" : undefined} aria-labelledby={briefing ? undefined : "weekly-feature-title"}>
    {briefing ? <WeeklyBriefing key={feature.week.key} feature={feature} profile={profile} rank={rank}/> : <>
    <div className="weekly-heading"><h2 id="weekly-feature-title">This week at the table</h2><span><CalendarDays size={14} aria-hidden="true"/>Week of {calendarDate(feature.week.key)}</span></div>
    <WeeklyFeatureCards feature={feature}/></>}
    {open && !pausePopup && <Dialog title="This week at the table" className="weekly-popup" closeOnBackdrop onClose={() => setOpen(false)}>
      <WeeklyFeatureCards feature={feature} onNavigate={() => setOpen(false)}/>
      <button className="button secondary" onClick={() => setOpen(false)}>Back to Home</button>
    </Dialog>}
  </section>;
}
