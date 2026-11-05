import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { ACHIEVEMENTS } from '../lib/achievements';
import type { AchievementHistory, AchievementId, PlayerAchievements } from '../lib/achievements';
import type { PlayerPassport } from '../lib/players';
import { gameDate, gameTime } from '../lib/time';
import { clock, score } from '../lib/stats';
import { Dialog } from './Dialog';
import { AchievementIcon } from './AchievementIcon';

export function Achievements({name,earned,history={},players=[]}:{name:string;earned:PlayerAchievements;history?:AchievementHistory;players?:Pick<PlayerPassport,'key'|'name'|'achievements'>[]}) {
  const [open,setOpen]=useState(false);
  const [selected,setSelected]=useState<AchievementId|null>(null);
  const lastTile=useRef<HTMLButtonElement>(null);
  const lastSelected=useRef<AchievementId|null>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const historyList=useRef<HTMLElement>(null);
  useEffect(()=>{if(open && !selected) lastTile.current?.focus();},[open,selected]);
  const badge=ACHIEVEMENTS.find(b=>b.id===selected);
  const game=badge ? earned[badge.id] : undefined;
  const ordered=ACHIEVEMENTS;
  const earningGames=badge ? (history[badge.id] ?? (game ? [game] : [])) : [];
  const earnCount=(id:AchievementId)=>history[id]?.length ?? (earned[id] ? 1 : 0);
  const others=badge ? players.filter(p=>p.name.trim().toLowerCase()!==name.trim().toLowerCase() && p.achievements[badge.id]).sort((a,b)=>a.name.localeCompare(b.name)) : [];
  useLayoutEffect(()=>{
    const list=historyList.current;
    if(!list)return;
    if(earningGames.length<=3){list.style.removeProperty('max-height');return;}
    const rows=Array.from(list.children).slice(0,3) as HTMLElement[];
    const resize=()=>{
      const height=rows.reduce((sum,row)=>sum+row.getBoundingClientRect().height,0);
      if(height>0)list.style.maxHeight=`${height}px`;
    };
    resize();
    const observer=typeof ResizeObserver==='undefined' ? null : new ResizeObserver(resize);
    rows.forEach(row=>observer?.observe(row));
    window.addEventListener('resize',resize);
    return ()=>{observer?.disconnect();window.removeEventListener('resize',resize);};
  },[open,selected,earningGames]);
  function close(){setOpen(false);setSelected(null);trigger.current?.focus();}
  return <>
    <div className="passport-achievements"><button type="button" ref={trigger} className="achievements-trigger" aria-haspopup="dialog" onClick={()=>{lastSelected.current=null;setSelected(null);setOpen(true);}}><Sparkles size={19} aria-hidden="true"/><span><strong>Achievements</strong><small>{Object.keys(earned).length} / {ACHIEVEMENTS.length} earned</small></span><ArrowRight size={18} aria-hidden="true"/></button></div>
    {open && createPortal(<Dialog className="achievement-dialog" title={badge ? badge.name : 'Achievements'} onClose={close} closeOnBackdrop>
      {badge ? <div className={`achievement-detail ${game ? 'is-earned' : 'is-locked'}`} style={{'--achievement-color':badge.color} as CSSProperties}>
        <button type="button" autoFocus className="achievement-back" onClick={()=>setSelected(null)}><ArrowLeft size={15}/>All achievements</button>
        <div className="achievement-emblem"><AchievementIcon id={badge.id}/></div>
        <p className="achievement-state">{game ? 'Earned' : 'Not earned'}</p>
        <p className="achievement-requirement">{badge.requirement}</p>
        {game && <section ref={historyList} aria-label="Earning games" tabIndex={earningGames.length>3 ? 0 : undefined} className={`achievement-history${earningGames.length>3 ? ' is-scrollable' : ''}`}>{earningGames.map((earnedGame,index)=>{
          const result=score(earnedGame.goals);
          return <Link key={earnedGame.id} className="achievement-game" to={`/game/${earnedGame.id}`} onClick={close}><span><small>{index===0 ? `First earned by ${name}` : `Earned again · ${index+1} of ${earningGames.length}`}</small><strong>{gameDate(earnedGame.started_at)} · {gameTime(earnedGame.started_at)}</strong><span>Final {result.a}–{result.b} · Game time {clock(Math.max(0,...earnedGame.goals.map(g=>g.elapsed_ms)))}</span></span><ArrowUpRight size={19}/></Link>;
        })}</section>}
        <section className="achievement-others" aria-label={game ? 'Also earned by' : 'Earned by'}>
          <h3>{game ? 'Also earned by' : 'Earned by'}</h3>
          {others.length ? <ul>{others.map(p=>{
            const first=p.achievements[badge.id]!;
            return <li key={p.key}><Link to={`/game/${first.id}`} onClick={close} aria-label={`${p.name}: first earned ${badge.name}. View game`} title={`${gameDate(first.started_at)} · ${gameTime(first.started_at)}`}>{p.name}<ArrowUpRight size={13} aria-hidden="true"/></Link></li>;
          })}</ul> : <p>{game ? 'No one else yet.' : 'No one has earned this yet.'}</p>}
        </section>
      </div> : <div className="achievement-collection"><p>{name} · {Object.keys(earned).length} of {ACHIEVEMENTS.length} earned</p><div className="achievement-grid">{ordered.map(item=><button type="button" key={item.id} ref={lastSelected.current===item.id ? lastTile : undefined} className={`achievement-tile ${earned[item.id] ? 'is-earned' : 'is-locked'}`} style={{'--achievement-color':item.color} as CSSProperties} aria-label={`${item.name}, ${earned[item.id] ? 'earned' : 'not earned'}${earnCount(item.id)>1 ? ` ${earnCount(item.id)} times` : ''}`} onClick={()=>{lastSelected.current=item.id;setSelected(item.id);}}>{earnCount(item.id)>1 && <span className="achievement-repeat" aria-hidden="true">×{earnCount(item.id)}</span>}<div className="achievement-emblem"><AchievementIcon id={item.id}/></div><strong>{item.name}</strong><small>{earned[item.id] ? 'Earned' : 'Not earned'}</small></button>)}</div></div>}
    </Dialog>,document.body)}
  </>;
}
