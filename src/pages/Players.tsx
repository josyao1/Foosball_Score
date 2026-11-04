import { useProfile, profileFirst } from "../lib/profile";
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Search, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { FINISH_LABELS, FINISH_TYPES, playerPassports, RUNG_LABELS } from '../lib/players';
import type { FinishType, PlayerPassport } from '../lib/players';
import { RUNGS } from '../lib/types';
import type { GoalFlag, Rung } from '../lib/types';
import { clock, playingTimeLabel } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import { GoalBall } from '../components/GoalBall';
import { Achievements } from '../components/Achievements';
import { MasteryBadges } from '../components/MasteryBadges';
import { PlayerCarousel } from '../components/PlayerCarousel';
import '../players.css';

const flags: Record<FinishType, GoalFlag[]> = {dunk:['dunk'],bank:['bank'],combo:['dunk','bank'],own_goal:['own_goal']};
const figures: Record<Rung, number> = {goalie:3,defender:2,middle:5,attacker:3};
const share = (count: number, total: number) => total ? Math.round(count/total*100) : 0;

function Passport({ player: p, players }: { player: PlayerPassport; players:PlayerPassport[] }) {
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
    <section className="passport-form" aria-label="Recent form">
      <div><h3>Recent form</h3><span>Oldest → latest</span></div>
      {p.recent.length ? <ol>{p.recent.map(result=><li key={result.game.id}><Link className={`form-stamp result-${result.result}`} to={`/game/${result.game.id}`} title={`${result.result === 'W' ? 'Won' : result.result === 'L' ? 'Lost' : 'Drew'} ${result.own}–${result.against} vs ${result.opponent} · ${gameDate(result.game.started_at)}, ${gameTime(result.game.started_at)}`} aria-label={`${result.result === 'W' ? 'Won' : result.result === 'L' ? 'Lost' : 'Drew'} ${result.own}–${result.against} against ${result.opponent}, ${gameDate(result.game.started_at)}, ${gameTime(result.game.started_at)}`}>{result.result}</Link></li>)}</ol> : <span className="passport-muted">No finished games</span>}
    </section>
    <section className="passport-bests" aria-label="Personal bests"><div className="passport-bests-heading"><h3>Personal bests</h3><span>Best win streak <strong>{p.bestStreak}</strong></span></div>
      <dl>{bests.map(({label,record,value})=><div key={label}><dt>{label}</dt><dd>{record ? <Link to={`/game/${record.game.id}`} aria-label={`${p.name}: ${label}, ${value}. View game`}>{value}<ArrowUpRight size={13}/></Link> : '—'}</dd></div>)}</dl>
    </section>
    <MasteryBadges progress={p.mastery}/>
    <Achievements name={p.name} earned={p.achievements} history={p.achievementHistory} players={players}/>

  </article>;
}

export function Players() {
  const {games,rivalries} = useStore();
  const profile=useProfile();
  const people = useMemo(()=>playerPassports(games,rivalries),[games,rivalries]);
  const [query,setQuery] = useState('');
  const visible = profileFirst(people.filter(p=>p.name.toLowerCase().includes(query.trim().toLowerCase())),p=>p.key===profile);
  return <section className="players-page">
    <header className="players-heading"><div><h1>Players</h1><p>Your table, by player.</p></div><label className="players-search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="Find a player" placeholder="Find a player" value={query} onChange={e=>setQuery(e.target.value)}/></label></header>
    <p className="players-note">Finished games across all rivalries. Own goals count against their scorer; team names stay separate.</p>
    {visible.length ? <PlayerCarousel entries={visible.map(p=>({id:p.key,content:<Passport player={p} players={people}/>}))}/> : <div className="empty-state"><Users size={30}/><h2>{people.length ? 'No matching players' : 'No players yet'}</h2><p>{people.length ? 'Try another name.' : 'Create a rivalry and your players will appear here.'}</p>{!people.length && <Link className="button primary" to="/">Go to rivalries</Link>}</div>}
  </section>;
}
