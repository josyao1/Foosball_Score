import { Chemistry } from '../components/Chemistry';
import { playerChemistry } from '../lib/chemistry';
import type { PlayerChemistry } from '../lib/chemistry';
import { TabUnderline } from "../components/TabUnderline";
import { NewPlayer } from '../components/NewPlayer';
import { useProfile, profileFirst } from "../lib/profile";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Award, Plus, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { FINISH_LABELS, FINISH_TYPES, playerPassports, RUNG_LABELS } from '../lib/players';
import type { FinishType, PlayerPassport } from '../lib/players';
import { RUNGS } from '../lib/types';
import type { GoalFlag, Rung } from '../lib/types';
import { clock, duration, playingTimeLabel } from '../lib/stats';
import { gameDate, gameTime } from '../lib/time';
import { GoalBall } from '../components/GoalBall';
import { Achievements } from '../components/Achievements';
import { MASTERY, TIERS } from '../lib/mastery';
import { MasteryBadges } from '../components/MasteryBadges';
import { PlayerCarousel } from '../components/PlayerCarousel';
import { usePlayerAppearance } from '../lib/PlayerAppearanceContext';
import { PlayerJersey } from '../components/PlayerJersey';
import { ScoutingNote } from '../components/ScoutingNote';
import { useScoutingNotes } from '../lib/useScoutingNotes';
import type { ScoutingNote as Note } from '../lib/scouting';
import '../players.css';

const flags: Record<FinishType, GoalFlag[]> = {dunk:['dunk'],bank:['bank'],combo:['dunk','bank'],own_goal:['own_goal']};
const figures: Record<Rung, number> = {goalie:3,defender:2,middle:5,attacker:3};
const share = (count: number, total: number) => total ? Math.round(count/total*100) : 0;


const passportTabs = ['overview','scoring','chemistry','badges','recent'] as const;
type PassportTab = typeof passportTabs[number];
function Passport({ player: p, players, tab, setTab, note, chemistry }: { player: PlayerPassport; players:PlayerPassport[]; tab:PassportTab; setTab:(tab:PassportTab)=>void; note?:Note; chemistry?:PlayerChemistry }) {
  const team = usePlayerAppearance(p.name).subtitle;
  const stamps=MASTERY.map(b=>({...b,level:p.mastery[b.id].earned.length})).filter(b=>b.level>0).sort((a,b)=>b.level-a.level).slice(0,3);
  const tabId = useId();
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollBeforeSwitch = useRef<{x:number;anchorTop:number;page:HTMLElement|null;pageTop:number;list:HTMLElement|null;left:number;top:number}|null>(null);
  function selectPage(next:PassportTab) {
    if(next===tab)return;
    const list=tabsRef.current?.closest<HTMLElement>('.player-carousel-list')??null;
    const y=window.scrollY,page=tabsRef.current?.closest<HTMLElement>('.players-page')??null;
    const anchorTop=tabsRef.current?.getBoundingClientRect().top??0;
    const pageRect=page?.getBoundingClientRect();
    scrollBeforeSwitch.current={x:window.scrollX,anchorTop,page,pageTop:(pageRect?.top??0)+y,list,left:list?.scrollLeft??0,top:list?.scrollTop??0};
    // Hold the document open through the commit so a shorter panel cannot clamp
    // the scroll position before we restore the clicked tab's viewport position.
    if(page && pageRect)page.style.minHeight=`${pageRect.height}px`;
    setTab(next);
  }
  useLayoutEffect(()=>{
    const tabs=tabsRef.current,active=tabs?.querySelector<HTMLElement>('[aria-selected="true"]');
    if(tabs&&active){
      if(active.offsetLeft<tabs.scrollLeft)tabs.scrollLeft=active.offsetLeft;
      else if(active.offsetLeft+active.offsetWidth>tabs.scrollLeft+tabs.clientWidth)
        tabs.scrollLeft=active.offsetLeft+active.offsetWidth-tabs.clientWidth;
    }
    const previous=scrollBeforeSwitch.current;
    if(!previous)return;
    scrollBeforeSwitch.current=null;
    if(previous.list){
      if(previous.list.scrollLeft!==previous.left)previous.list.scrollLeft=previous.left;
      if(previous.list.scrollTop!==previous.top)previous.list.scrollTop=previous.top;
    }
    const currentY=window.scrollY;
    const anchorTop=tabsRef.current?.getBoundingClientRect().top??previous.anchorTop;
    const targetY=Math.max(0,currentY+anchorTop-previous.anchorTop);
    // Reserve only enough space to keep this viewport valid, not the old card
    // heights. Cards can shrink naturally, including rows above the active one.
    if(previous.page)previous.page.style.minHeight=`${Math.max(0,targetY+window.innerHeight-previous.pageTop)}px`;
    if(window.scrollY!==targetY||window.scrollX!==previous.x)
      window.scrollTo({left:previous.x,top:targetY,behavior:'instant'});
  },[tab]);
  const badgeCount = Object.values(p.mastery).filter(b=>b.earned.length>0).length + Object.keys(p.achievements).length;
  const bests = [
    {label:'Biggest run',record:p.bestRun,value:`${p.bestRun?.value} straight`},
    {label:'Winning comeback',record:p.bestComeback,value:`${p.bestComeback?.value} goals down`},
    {label:'Quickest win',record:p.quickestWin,value:clock(p.quickestWin?.value ?? 0)},
  ];
  return <article className="player-passport" aria-label={`${p.name} passport`}>
    <header className="passport-header">
      <div className="passport-portrait"><PlayerJersey name={p.name}/></div>
      <div className="passport-identity"><h2>{p.name}</h2>{team && <span className="passport-team">{team}</span>}<span>{p.firstPlayed ? `Playing since ${gameDate(p.firstPlayed)}` : 'First game still to come'}</span></div>
      <div className="passport-winrate"><strong>{p.played ? `${share(p.wins,p.played)}%` : '—'}</strong><span>win rate</span></div>
    </header>
    <dl className="passport-totals">
      <div><dt>Record</dt><dd>{p.wins}W <span>–</span> {p.losses}L{p.draws > 0 && <small> · {p.draws}D</small>}</dd></div>
      <div><dt>Goals scored</dt><dd>{p.goals}</dd></div>
      <div><dt>At the table</dt><dd>{playingTimeLabel(p.playingMs)}</dd></div>
    </dl>
    <div ref={tabsRef} className="passport-tabs tab-underline-row" role="tablist" aria-label={`${p.name} passport pages`} onKeyDown={e=>{
      const keys=passportTabs;
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      e.preventDefault();e.stopPropagation();
      const next=e.key==='Home'?keys[0]:e.key==='End'?keys.at(-1)!:keys[(keys.indexOf(tab)+(e.key==='ArrowRight'?1:keys.length-1))%keys.length];
      selectPage(next);e.currentTarget.querySelector<HTMLButtonElement>(`[data-page="${next}"]`)?.focus({preventScroll:true});
    }}>
      {passportTabs.map(page=><button key={page} type="button" role="tab" data-page={page} id={`${tabId}-${page}`} aria-controls={`${tabId}-panel-${page}`} aria-selected={tab===page} tabIndex={tab===page?0:-1} onClick={()=>selectPage(page)}>
        {page==='overview'?'Overview':page==='scoring'?'Scoring':page==='recent'?'Recent games':page==='chemistry'?'Chemistry':'Badges'}{page==='badges'&&<span title="Earned mastery badges and achievements">{badgeCount}</span>}
      </button>)}
      <TabUnderline selection={tab} />
    </div>
    <div className={`passport-page passport-page-${tab}`} role="tabpanel" id={`${tabId}-panel-${tab}`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0}>
      {tab==='overview'&&<>
    {note&&<ScoutingNote note={note} name={p.name}/>}
    <section className="passport-form" aria-label="Recent form">
      <div><h3>Recent form</h3><span>Oldest → latest</span></div>
      {p.recent.length ? <ol>{p.recent.map(result=><li key={result.game.id}><Link className={`form-stamp result-${result.result}`} to={`/game/${result.game.id}`} title={`${result.result === 'W' ? 'Won' : result.result === 'L' ? 'Lost' : 'Drew'} ${result.own}–${result.against} vs ${result.opponent} · ${gameDate(result.game.started_at)}, ${gameTime(result.game.started_at)}`} aria-label={`${result.result === 'W' ? 'Won' : result.result === 'L' ? 'Lost' : 'Drew'} ${result.own}–${result.against} against ${result.opponent}, ${gameDate(result.game.started_at)}, ${gameTime(result.game.started_at)}`}>{result.result}</Link></li>)}</ol> : <span className="passport-muted">No finished games</span>}
    </section>
    <div className="passport-overview-style">
      <section className="passport-rungs"><h3>Favorite rung</h3><p className="passport-specialty">{p.favoriteRungs.length ? <>{p.favoriteRungs.map(rung=>RUNG_LABELS[rung]).join(' / ')} <small className="passport-overview-share" title="Share of goals scored, excluding own goals">{share(p.rungs[p.favoriteRungs[0]],p.goals)}%{p.favoriteRungs.length>1?' each':''}</small></> : 'Not set yet'}</p></section>
      <section className="passport-finishes"><h3>Signature finish</h3><p className="passport-specialty"><span className="passport-signature-balls" aria-hidden="true">{p.signatureTypes.map(type=><GoalBall key={type} flags={flags[type]} size={22}/>)}</span>{p.signatureTypes.length ? <>{p.signatureTypes.map(type=>FINISH_LABELS[type]).join(' / ')} <small className="passport-overview-share" title="Share of recorded goals, including own goals">{share(p.types[p.signatureTypes[0]],p.goals+p.types.own_goal)}%{p.signatureTypes.length>1?' each':''}</small></> : 'Not set yet'}</p></section>
    </div>
    {stamps.length>0&&<div className="passport-stamps" aria-label="Mastery highlights">{stamps.map(b=><button key={b.id} type="button" className={`medal-${b.level}`} title={`${TIERS[b.level-1]} · ${b.label}`} aria-label={`${TIERS[b.level-1]} ${b.label}. View badges`} onClick={()=>{selectPage('badges');document.getElementById(`${tabId}-badges`)?.focus({preventScroll:true});}}><Award size={16} aria-hidden="true"/><span>{b.label.replace(' proficiency','').replace('All four rungs mastered','All four rungs')}</span></button>)}</div>}
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
          <span>{RUNG_LABELS[rung]}</span><strong>{share(p.rungs[rung],p.goals)}%</strong><small className="passport-goal-count">{p.rungs[rung]} {p.rungs[rung]===1?'goal':'goals'}</small>
        </div>)}</div>
      </section>
      <section className="passport-finishes" aria-label="Goal type profile">
        <h3 title="Share of all your recorded goals, including regular and own goals">Signature finish</h3><p className="passport-specialty">{p.signatureTypes.length ? p.signatureTypes.map(type=>FINISH_LABELS[type]).join(' / ') : 'Not set yet'}</p>
        <div className="passport-type-lineup">{FINISH_TYPES.map(type=><div key={type} className={p.signatureTypes.includes(type) ? 'is-favorite' : ''} aria-label={`${FINISH_LABELS[type]}: ${p.types[type]} goals, ${share(p.types[type],p.goals+p.types.own_goal)} percent${p.signatureTypes.includes(type) ? ', signature' : ''}`}>
          <span aria-hidden="true"><GoalBall flags={flags[type]} size={22}/></span><span>{type==='combo' ? 'Dunk + bank' : FINISH_LABELS[type]}</span><strong>{share(p.types[type],p.goals+p.types.own_goal)}%</strong><small className="passport-goal-count">{p.types[type]} {p.types[type]===1?'goal':'goals'}</small>
        </div>)}</div>
      </section>
    </div>
      </>}
      {tab==='chemistry'&&<Chemistry name={p.name} data={chemistry}/>}
      {tab==='badges'&&<>
    <MasteryBadges progress={p.mastery}/>
    <Achievements name={p.name} earned={p.achievements} history={p.achievementHistory} players={players}/>
      </>}
      {tab==='recent' && (p.recent.length ? <ol className="passport-recent-list" aria-label="Recent games">{[...p.recent].reverse().map(result=><li key={result.game.id}>
        <Link to={`/game/${result.game.id}`}>
          <span className={`passport-result result-${result.result}`}><span className="rc-sr">{result.result==='W'?'Win':result.result==='L'?'Loss':'Draw'}</span><span className="passport-result-ball" aria-hidden="true"><GoalBall size={34}/><b>{result.result}</b></span></span>
          <span className="passport-recent-opponent"><strong>vs {result.opponent}</strong>{result.teammates.length>0 && <span className="passport-recent-teammate">with <b>{result.teammates.join(' and ')}</b></span>}<time dateTime={result.game.started_at}>{gameDate(result.game.started_at)} · {gameTime(result.game.started_at)}</time></span>
          <span className="passport-recent-score"><strong>{result.own}–{result.against}</strong><small>{clock(duration(result.game))} played</small></span>
          <ArrowUpRight size={13} aria-hidden="true"/>
        </Link>
      </li>)}</ol> : <p className="passport-recent-empty">No finished games yet.</p>)}
    </div>
  </article>;
}

export function Players() {
  const {games,rivalries,players,loading} = useStore();
  const profile=useProfile();
  const people = useMemo(()=>playerPassports(games,rivalries,players),[games,rivalries,players]);
  const notes=useScoutingNotes(games,rivalries,!loading);
  const chemistry=useMemo(()=>playerChemistry(games,rivalries),[games,rivalries]);
  const [creating,setCreating] = useState(false);
  const [tab,setTab] = useState<PassportTab>('overview');
  const pageRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    // Release spare space as the visitor scrolls upward. Never shrink past the
    // current viewport, which would cause another browser scroll clamp.
    const releaseSpace=()=>{
      const page=pageRef.current;if(!page?.style.minHeight)return;
      const floor=parseFloat(page.style.minHeight),top=page.getBoundingClientRect().top+window.scrollY;
      const needed=Math.max(0,window.scrollY+window.innerHeight-top);
      if(needed<floor)page.style.minHeight=`${needed}px`;
    };
    window.addEventListener('scroll',releaseSpace,{passive:true});
    window.addEventListener('resize',releaseSpace);
    return ()=>{window.removeEventListener('scroll',releaseSpace);window.removeEventListener('resize',releaseSpace);};
  },[]);
  const lastPlayed = (player: PlayerPassport) => Date.parse(player.recent.at(-1)?.game.started_at ?? '') || 0;
  const ranked = [...people].sort((a, b) =>
    b.wins - a.wins || lastPlayed(b) - lastPlayed(a) || a.name.localeCompare(b.name)
  );
  const visible = profileFirst(ranked, p => p.key === profile || p.name.trim().toLowerCase() === profile);
  return <section ref={pageRef} className="players-page">
    <header className="players-heading"><div><h1>Players</h1></div><button className="button primary" onClick={()=>setCreating(true)}><Plus size={18}/>New player</button></header>
    {visible.length ? <PlayerCarousel entries={visible.map(p=>({id:p.key,content:<Passport player={p} players={people} tab={tab} setTab={setTab} note={notes[p.key]} chemistry={chemistry[p.key]}/>}))}/> : <div className="empty-state"><Users size={30}/><h2>No players yet</h2><p>Add your friends, then choose sides in a rivalry.</p></div>}
    {creating && <NewPlayer onClose={()=>setCreating(false)}/>}
  </section>;
}
