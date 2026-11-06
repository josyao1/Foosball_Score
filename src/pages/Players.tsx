import { NewPlayer } from '../components/NewPlayer';
import { useProfile, profileFirst } from "../lib/profile";
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Award, Plus, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { FINISH_LABELS, FINISH_TYPES, playerPassports, RUNG_LABELS } from '../lib/players';
import type { FinishType, PlayerPassport } from '../lib/players';
import { RUNGS } from '../lib/types';
import type { GoalFlag, Rung } from '../lib/types';
import { clock, playingTimeLabel } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import { GoalBall } from '../components/GoalBall';
import { Achievements } from '../components/Achievements';
import { MASTERY, TIERS } from '../lib/mastery';
import { MasteryBadges } from '../components/MasteryBadges';
import { PlayerCarousel } from '../components/PlayerCarousel';
import '../players.css';

const flags: Record<FinishType, GoalFlag[]> = {dunk:['dunk'],bank:['bank'],combo:['dunk','bank'],own_goal:['own_goal']};
const figures: Record<Rung, number> = {goalie:3,defender:2,middle:5,attacker:3};
const share = (count: number, total: number) => total ? Math.round(count/total*100) : 0;

type PassportTab = 'overview'|'scoring'|'badges';
function Passport({ player: p, players, tab, setTab }: { player: PlayerPassport; players:PlayerPassport[]; tab:PassportTab; setTab:(tab:PassportTab)=>void }) {
  const stamps=MASTERY.map(b=>({...b,level:p.mastery[b.id].earned.length})).filter(b=>b.level>0).sort((a,b)=>b.level-a.level).slice(0,3);
  const tabId = useId();
  const badgeCount = Object.values(p.mastery).filter(b=>b.earned.length>0).length + Object.keys(p.achievements).length;
  const bests = [
    {label:'Biggest run',record:p.bestRun,value:`${p.bestRun?.value} straight`},
    {label:'Winning comeback',record:p.bestComeback,value:`${p.bestComeback?.value} goals down`},
    {label:'Quickest win',record:p.quickestWin,value:clock(p.quickestWin?.value ?? 0)},
  ];
  return <article className="player-passport" aria-label={`${p.name} passport`}>
    <header className="passport-header">
      <div className="passport-portrait" aria-hidden="true"><svg viewBox="0 0 64 76"><path className="passport-rod" d="M0 36H64"/><circle cx="32" cy="16" r="9"/><path d="M19 31Q19 27 24 27H40Q45 27 45 31V46H39V59H42V69H22V59H25V46H19Z"/><path className="passport-shirt" d="M27 35H37"/></svg></div>
      <div className="passport-identity"><h2>{p.name}</h2><span>{p.firstPlayed ? `Playing since ${gameDate(p.firstPlayed)}` : 'First game still to come'}</span></div>
      <div className="passport-winrate"><strong>{p.played ? `${share(p.wins,p.played)}%` : '—'}</strong><span>win rate</span></div>
    </header>
    <dl className="passport-totals">
      <div><dt>Record</dt><dd>{p.wins}W <span>–</span> {p.losses}L{p.draws > 0 && <small> · {p.draws}D</small>}</dd></div>
      <div><dt>Goals scored</dt><dd>{p.goals}</dd></div>
      <div><dt>At the table</dt><dd>{playingTimeLabel(p.playingMs)}</dd></div>
    </dl>
    <div className="passport-tabs" role="tablist" aria-label={`${p.name} passport pages`} onKeyDown={e=>{
      const keys=['overview','scoring','badges'] as const;
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      e.preventDefault();e.stopPropagation();
      const next=e.key==='Home'?keys[0]:e.key==='End'?keys[2]:keys[(keys.indexOf(tab)+(e.key==='ArrowRight'?1:2))%3];
      setTab(next);e.currentTarget.querySelector<HTMLButtonElement>(`[data-page="${next}"]`)?.focus();
    }}>
      {(['overview','scoring','badges'] as const).map(page=><button key={page} type="button" role="tab" data-page={page} id={`${tabId}-${page}`} aria-controls={`${tabId}-panel-${page}`} aria-selected={tab===page} tabIndex={tab===page?0:-1} onClick={()=>setTab(page)}>
        {page==='overview'?'Overview':page==='scoring'?'Scoring':'Badges'}{page==='badges'&&<span title="Earned mastery badges and achievements">{badgeCount}</span>}
      </button>)}
    </div>
    <div className={`passport-page passport-page-${tab}`} role="tabpanel" id={`${tabId}-panel-${tab}`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
      {tab==='overview'&&<>
    <section className="passport-form" aria-label="Recent form">
      <div><h3>Recent form</h3><span>Oldest → latest</span></div>
      {p.recent.length ? <ol>{p.recent.map(result=><li key={result.game.id}><Link className={`form-stamp result-${result.result}`} to={`/game/${result.game.id}`} title={`${result.result === 'W' ? 'Won' : result.result === 'L' ? 'Lost' : 'Drew'} ${result.own}–${result.against} vs ${result.opponent} · ${gameDate(result.game.started_at)}, ${gameTime(result.game.started_at)}`} aria-label={`${result.result === 'W' ? 'Won' : result.result === 'L' ? 'Lost' : 'Drew'} ${result.own}–${result.against} against ${result.opponent}, ${gameDate(result.game.started_at)}, ${gameTime(result.game.started_at)}`}>{result.result}</Link></li>)}</ol> : <span className="passport-muted">No finished games</span>}
    </section>
    <div className="passport-overview-style">
      <section className="passport-rungs"><h3>Favorite rung</h3><p className="passport-specialty">{p.favoriteRungs.length ? <>{p.favoriteRungs.map(rung=>RUNG_LABELS[rung]).join(' / ')} <small className="passport-overview-share" title="Share of goals scored, excluding own goals">{share(p.rungs[p.favoriteRungs[0]],p.goals)}%{p.favoriteRungs.length>1?' each':''}</small></> : 'Not set yet'}</p></section>
      <section className="passport-finishes"><h3>Signature finish</h3><p className="passport-specialty"><span className="passport-signature-balls" aria-hidden="true">{p.signatureTypes.map(type=><GoalBall key={type} flags={flags[type]} size={22}/>)}</span>{p.signatureTypes.length ? <>{p.signatureTypes.map(type=>FINISH_LABELS[type]).join(' / ')} <small className="passport-overview-share" title="Share of recorded goals, including own goals">{share(p.types[p.signatureTypes[0]],p.goals+p.types.own_goal)}%{p.signatureTypes.length>1?' each':''}</small></> : 'Not set yet'}</p></section>
    </div>
    {stamps.length>0&&<div className="passport-stamps" aria-label="Mastery highlights">{stamps.map(b=><button key={b.id} type="button" className={`medal-${b.level}`} title={`${TIERS[b.level-1]} · ${b.label}`} aria-label={`${TIERS[b.level-1]} ${b.label}. View badges`} onClick={()=>{setTab('badges');document.getElementById(`${tabId}-badges`)?.focus();}}><Award size={16} aria-hidden="true"/><span>{b.label.replace(' proficiency','').replace('All four rungs mastered','All four rungs')}</span></button>)}</div>}
    <section className="passport-bests" aria-label="Personal bests"><div className="passport-bests-heading"><h3>Personal bests</h3><span>Best win streak <strong>{p.bestStreak}</strong></span></div>
      <dl>{bests.map(({label,record,value})=><div key={label}><dt>{label}</dt><dd>{record ? <Link to={`/game/${record.game.id}`} aria-label={`${p.name}: ${label}, ${value}. View game`}>{value}<ArrowUpRight size={13}/></Link> : '—'}</dd></div>)}</dl>
    </section>
      </>}
      {tab==='scoring'&&<>
    <div className="passport-style">
      <section className="passport-rungs" aria-label="Rung profile">
        <h3>Favorite rung</h3><p className="passport-specialty">{p.favoriteRungs.length ? p.favoriteRungs.map(rung=>RUNG_LABELS[rung]).join(' / ') : 'Not set yet'}</p>
        <div className="passport-rung-lineup">{RUNGS.map(rung=><div key={rung} className={p.favoriteRungs.includes(rung) ? 'is-favorite' : ''} aria-label={`${RUNG_LABELS[rung]}: ${p.rungs[rung]} goals, ${share(p.rungs[rung],p.goals)} percent${p.favoriteRungs.includes(rung) ? ', favorite' : ''}`}>
          <span className="passport-mini-rod" aria-hidden="true">{Array.from({length:figures[rung]},(_,i)=><i key={i}/>)}</span>
          <span>{RUNG_LABELS[rung]}</span><strong>{share(p.rungs[rung],p.goals)}%</strong>
        </div>)}</div>
      </section>
      <section className="passport-finishes" aria-label="Goal type profile">
        <h3 title="Share of all your recorded goals, including regular and own goals">Signature finish</h3><p className="passport-specialty">{p.signatureTypes.length ? p.signatureTypes.map(type=>FINISH_LABELS[type]).join(' / ') : 'Not set yet'}</p>
        <div className="passport-type-lineup">{FINISH_TYPES.map(type=><div key={type} className={p.signatureTypes.includes(type) ? 'is-favorite' : ''} aria-label={`${FINISH_LABELS[type]}: ${p.types[type]} goals, ${share(p.types[type],p.goals+p.types.own_goal)} percent${p.signatureTypes.includes(type) ? ', signature' : ''}`}>
          <span aria-hidden="true"><GoalBall flags={flags[type]} size={22}/></span><span>{type==='combo' ? 'Dunk + bank' : FINISH_LABELS[type]}</span><strong>{share(p.types[type],p.goals+p.types.own_goal)}%</strong>
        </div>)}</div>
      </section>
    </div>
      </>}
      {tab==='badges'&&<>
    <MasteryBadges progress={p.mastery}/>
    <Achievements name={p.name} earned={p.achievements} history={p.achievementHistory} players={players}/>
      </>}
    </div>
  </article>;
}

export function Players() {
  const {games,rivalries,players} = useStore();
  const profile=useProfile();
  const people = useMemo(()=>playerPassports(games,rivalries,players),[games,rivalries,players]);
  const [creating,setCreating] = useState(false);
  const [tab,setTab] = useState<PassportTab>('overview');
  const visible = profileFirst([...people].sort((a,b)=>(Date.parse(b.recent.at(-1)?.game.started_at??'')||0)-(Date.parse(a.recent.at(-1)?.game.started_at??'')||0)||a.name.localeCompare(b.name)),p=>p.key===profile||p.name.trim().toLowerCase()===profile);
  return <section className="players-page">
    <header className="players-heading"><div><h1>Players</h1><p>Your table, by player.</p></div><button className="button primary" onClick={()=>setCreating(true)}><Plus size={18}/>New player</button></header>
    <p className="players-note">Your singles and team games, together.</p>
    {visible.length ? <PlayerCarousel entries={visible.map(p=>({id:p.key,content:<Passport player={p} players={people} tab={tab} setTab={setTab}/>}))}/> : <div className="empty-state"><Users size={30}/><h2>No players yet</h2><p>Add your friends, then choose sides in a rivalry.</p></div>}
    {creating && <NewPlayer onClose={()=>setCreating(false)}/>}
  </section>;
}
