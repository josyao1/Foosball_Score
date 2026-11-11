import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import type { BacklogData, Game, Rivalry } from '../lib/types';
import { gameDate, gameTime } from '../lib/time';
import { clock, duration, score } from '../lib/stats';
import { ConfirmDialog } from '../components/Dialog';
import './backlog.css';

type Selection = {kind:'game'; game:Game; rivalry:Rivalry} | {kind:'rivalry'; rivalry:Rivalry; games:Game[]};
const revisions=(games:Game[])=>Object.fromEntries(games.map(g=>[g.id,g.revision]));
const title=(r:Rivalry)=>`${r.player_a} vs ${r.player_b}`;
function GameInfo({game}:{game:Game}) {
  const s=score(game.goals);
  return <div className="backlog-game-info"><strong>{s.a} – {s.b}</strong><span>{gameDate(game.started_at)} · {gameTime(game.started_at)}
    <small>{game.ended_at?`Game time ${clock(duration(game))}`:'Unfinished'} · {game.goals.length} goals</small></span></div>;
}
export function Backlog() {
  const store=useStore();
  const [data,setData]=useState<BacklogData>({rivalries:[],games:[]});
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [pending,setPending]=useState(false),[purging,setPurging]=useState<Selection|null>(null);
  const generation=useRef(0),locked=useRef(false);
  const refresh=useCallback(async()=>{
    if(locked.current)return;
    const gen=++generation.current;
    try {const next=await store.loadBacklog();if(gen===generation.current){setData(next);setError('');}}
    catch(e){if(gen===generation.current)setError(e instanceof Error?e.message:'Could not load backlog.');}
    finally {if(gen===generation.current)setLoading(false);}
  },[store.loadBacklog]);
  useEffect(()=>{
    void refresh();const onFocus=()=>void refresh();
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},8000);
    window.addEventListener('focus',onFocus);
    return ()=>{generation.current++;clearInterval(timer);window.removeEventListener('focus',onFocus);};
  },[refresh]);
  async function act(item:Selection,purge=false) {
    if(locked.current)return;
    locked.current=true;generation.current++;setPending(true);setError('');setNotice('');
    try {
      if(item.kind==='game') await (purge?store.purgeGame(item.game):store.restoreGame(item.game));
      else await (purge?store.purgeRivalry(item.rivalry,revisions(item.games)):store.restoreRivalry(item.rivalry,revisions(item.games)));
      setNotice(purge?'Permanently deleted.':'Restored. Stats are up to date.');
    } catch(e) {setError(e instanceof Error?e.message:'Could not update backlog.');throw e;}
    finally {
      locked.current=false;setPending(false);
      // Keep the mutation error visible while still replacing any stale entries.
      const gen=++generation.current;
      try {const next=await store.loadBacklog();if(gen===generation.current)setData(next);} catch {/* Existing data remains available to retry. */}
    }
  }
  const archived=data.rivalries.filter(r=>r.deleted_at).sort((a,b)=>b.deleted_at!.localeCompare(a.deleted_at!));
  const parents=new Map(data.rivalries.map(r=>[r.id,r]));
  const games=data.games.filter(g=>g.deleted_at&&!parents.get(g.rivalry_id)?.deleted_at).sort((a,b)=>b.deleted_at!.localeCompare(a.deleted_at!));
  function actions(item:Selection) {
    return <div className="backlog-actions">
      <button className="button secondary" disabled={pending||store.busy} onClick={()=>void act(item).catch(()=>{})}><RotateCcw size={15}/>Undo</button>
      <button className="icon-button" aria-label={`Permanently delete ${item.kind==='game'?'game':title(item.rivalry)}`} disabled={pending||store.busy} onClick={()=>setPurging(item)}><Trash2 size={17}/></button>
    </div>;
  }
  return <div className="backlog-page">
    <Link className="back-link" to="/"><ArrowLeft size={16}/>Rivalries</Link>
    <div className="page-heading"><div><h1>Backlog</h1><p className="muted">Removed from the table. Kept here until you decide.</p></div></div>
    {error&&<p role="alert" className="form-error">{error} <button className="text-button" onClick={()=>void refresh()}>Retry</button></p>}
    {notice&&<p role="status" className="backlog-notice">{notice}</p>}
    {loading?<p>Loading backlog…</p>:<>
      {!archived.length&&!games.length?<div className="empty-state"><Archive size={30}/><h2>Nothing in the backlog</h2><p>Deleted rivalries and finished games will appear here.</p></div>:<>
        {archived.length>0&&<section aria-label="Deleted rivalries"><h2>Rivalries <small>{archived.length}</small></h2><div className="backlog-list">
          {archived.map(r=>{
            const children=data.games.filter(g=>g.rivalry_id===r.id),separate=children.filter(g=>g.deleted_at).length;
            return <article className="backlog-entry" id={r.id} key={r.id}>
              <div className="backlog-entry-head"><div><h3>{title(r)}</h3><p>{children.length} games · {children.reduce((sum,g)=>sum+g.goals.length,0)} goals saved</p>
                <small className="muted">Deleted {gameDate(r.deleted_at!)} · {gameTime(r.deleted_at!)}</small></div>{actions({kind:'rivalry',rivalry:r,games:children})}</div>
              {separate>0&&<p className="backlog-note">{separate} previously deleted {separate===1?'game stays':'games stay'} in the backlog when you undo.</p>}
              {children.some(g=>!g.ended_at&&!g.deleted_at)&&<p className="backlog-note">Includes an unfinished game. Its original start time is preserved.</p>}
              {children.length>0&&<details className="backlog-children"><summary>Saved games</summary><p className="muted">Restore the rivalry to manage its games individually.</p><div>{children.map(g=><div className="backlog-child" key={g.id}><GameInfo game={g}/>{g.deleted_at&&<small className="muted">Previously deleted</small>}</div>)}</div></details>}
            </article>;
          })}
        </div></section>}
        {games.length>0&&<section aria-label="Deleted games"><h2>Games <small>{games.length}</small></h2><div className="backlog-list">{games.map(g=>{
          const r=parents.get(g.rivalry_id)!;
          return <article className="backlog-entry" key={g.id}><div className="backlog-entry-head"><div><h3><Link to={`/rivalry/${r.id}`}>{title(r)}</Link></h3><GameInfo game={g}/><small className="muted">Deleted {gameDate(g.deleted_at!)} · {gameTime(g.deleted_at!)}</small></div>{actions({kind:'game',game:g,rivalry:r})}</div></article>;
        })}</div></section>}
      </>}
    </>}
    {purging&&<ConfirmDialog title={purging.kind==='game'?'Permanently delete game?':'Permanently delete rivalry?'}
      description={purging.kind==='game'?`Erase this game and all ${purging.game.goals.length} goals from ${title(purging.rivalry)}. This cannot be undone.`:`Erase ${title(purging.rivalry)}, all ${purging.games.length} saved games (including previously deleted games), and their goals. Player profiles stay. This cannot be undone.`}
      confirm="Delete permanently" danger onClose={()=>setPurging(null)} onConfirm={()=>act(purging,true)}/>}
  </div>;
}
