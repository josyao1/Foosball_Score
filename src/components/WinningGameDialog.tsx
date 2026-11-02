import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Flag, Play, RotateCcw, Undo2 } from 'lucide-react';
import { Dialog } from './Dialog';
import { useStore } from '../lib/store';
import { removeGoal } from '../lib/mutations';
import { orderedGoals, score } from '../lib/stats';
import { playerName } from '../lib/types';
import type { Game, Rivalry } from '../lib/types';
import './winning-game.css';

export function WinningGameDialog({snapshot,rivalry,onClose,onRematch}: {
 snapshot:Game; rivalry:Rivalry; onClose:(game:Game)=>void; onRematch:(game:Game)=>void;
}) {
 const store = useStore();
 const latestStore = useRef(store);
 useLayoutEffect(() => { latestStore.current = store; });
 const [pending,setPending] = useState<'undo'|'finish'|'rematch'|null>(null);
 const [error,setError] = useState('');
 const locked = useRef(false);
 const mounted = useRef(false);
 useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
 const nextGame = useRef<Game|null>(null);
 const current = store.games.find(game => game.id === snapshot.id);
 const saved = !!current?.ended_at;
 const stale = !current || (!saved && current.revision !== snapshot.revision);
 const shown = saved ? current! : snapshot;
 const scores = score(shown.goals);
 const leader = scores.a > scores.b ? 'a' : 'b';
 const busy = pending !== null || store.busy;

 async function act(action:'undo'|'finish'|'rematch') {
  if (locked.current || latestStore.current.busy) return;
  locked.current = true;
  setPending(action);
  setError('');
  try {
   let game = latestStore.current.games.find(g => g.id === snapshot.id);
   if (!game) throw new Error('This game was removed. Close this popup to refresh.');
   if (!game.ended_at && game.revision !== snapshot.revision)
    throw new Error('The score changed on another device. Review the latest score first.');
   if (action === 'undo') {
    if (game.ended_at) throw new Error('This game is already finished. Edit its goals on the result page.');
    const last = orderedGoals(snapshot.goals).at(-1)!;
    const updated = await latestStore.current.saveGame(removeGoal(game,snapshot.revision,last.id));
    if (mounted.current) onClose(updated);
    return;
   }
   if (!game.ended_at) {
    const end = Math.max(Date.now(), ...game.goals.map(goal => Date.parse(goal.occurred_at)));
    game = await latestStore.current.saveGame({...game,ended_at:new Date(end).toISOString()});
   }
   if (!mounted.current) return;
   if (action === 'finish') { onClose(game); return; }
   // Finishing and creating are separate guarded saves. If creation fails, the
   // result remains saved and this dialog offers a retry without finishing twice.
   const active = latestStore.current.games.find(g => g.rivalry_id === snapshot.rivalry_id && g.id !== snapshot.id && !g.ended_at);
   if (active) { onRematch(active); return; }
   if (!nextGame.current) nextGame.current = {
    id:crypto.randomUUID(),rivalry_id:snapshot.rivalry_id,started_at:new Date().toISOString(),ended_at:null,revision:0,goals:[],
   };
   const created = await latestStore.current.saveGame(nextGame.current);
   if (mounted.current) onRematch(created);
  } catch (e) {
   if (mounted.current) setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
  } finally {
   locked.current = false;
   if (mounted.current) setPending(null);
  }
 }
 return <Dialog title={saved ? 'Game saved' : 'Winning score'} onClose={() => onClose(shown)} dismissible={!busy}>
  <div className="winning-game-score" aria-label={`${rivalry.player_a} ${scores.a}, ${rivalry.player_b} ${scores.b}`}>
   <div><span>{rivalry.player_a}</span><strong>{scores.a}</strong></div>
   <span aria-hidden="true">–</span>
   <div><span>{rivalry.player_b}</span><strong>{scores.b}</strong></div>
  </div>
  <p className="winning-game-copy">{saved ? 'Result saved. Ready for another?' : `${playerName(rivalry,leader)} has the winning score.`}</p>
  {stale && <p className="form-error" role="status">This game changed. Close this popup to review the latest score.</p>}
  {error && <p className="form-error" role="alert">{error}</p>}
  <div className="winning-game-actions" aria-busy={busy}>
   {!saved && <>
    <button type="button" className="button secondary" disabled={busy || stale} onClick={() => void act('undo')}><Undo2 size={17} aria-hidden="true"/>{pending === 'undo' ? 'Undoing…' : 'Undo goal'}</button>
    <button type="button" autoFocus className="button secondary" disabled={busy} onClick={() => onClose(snapshot)}><Play size={17} aria-hidden="true"/>{stale ? 'Review score' : 'Keep playing'}</button>
   </>}
   <button type="button" className="button secondary" disabled={busy || stale} onClick={() => saved ? onClose(shown) : void act('finish')}><Flag size={17} aria-hidden="true"/>{pending === 'finish' ? 'Saving…' : saved ? 'View result' : 'Finish game'}</button>
   <button type="button" className="button primary" disabled={busy || stale} onClick={() => void act('rematch')}><RotateCcw size={17} aria-hidden="true"/>{pending === 'rematch' ? 'Starting…' : saved ? 'Start rematch' : 'Finish & rematch'}</button>
  </div>
 </Dialog>;
}
