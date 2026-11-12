import { useState } from 'react';
import { ArrowUpRight, ChevronRight, NotebookPen, RotateCcw, Target, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog } from './Dialog';
import { gameDate, gameTime } from '../lib/time';
import type { ScoutingNote as Note } from '../lib/scouting';
import './scouting-note.css';

const icons={chemistry:Users,reaction:RotateCcw,habit:Target,story:NotebookPen};
export function ScoutingNote({note,name}:{note:Note;name:string}){
  const [open,setOpen]=useState(false);
  const Icon=icons[note.kind];
  return <>
    <button type="button" className={`scouting-note scouting-${note.kind}`} aria-label={`Scouting note for ${name}: ${note.title}. View evidence`} aria-haspopup="dialog" onClick={()=>setOpen(true)}>
      <span className="scouting-emblem" aria-hidden="true"><Icon size={20}/></span>
      <span className="scouting-copy"><span className="scouting-label">Scouting note</span><strong>{note.title}</strong><span className="scouting-claim">{note.text}</span></span>
      <ChevronRight className="scouting-chevron" size={16} aria-hidden="true"/>
    </button>
    {open&&<Dialog title={note.title} className="scouting-dialog" closeOnBackdrop onClose={()=>setOpen(false)}>
      <div className={`scouting-detail-intro scouting-${note.kind}`}><span className="scouting-emblem" aria-hidden="true"><Icon size={23}/></span><div><small>{name} · Scouting note</small><p>{note.text}</p></div></div>
      <p className="scouting-explanation">{note.explanation}</p>
      <h3 className="scouting-games-title">Supporting games <span>{note.evidence.length}</span></h3>
      <ol className="scouting-evidence" aria-label={`Supporting games for ${name}`} tabIndex={0}>
        {note.evidence.map(e=><li key={e.game.id}><Link to={`/game/${e.game.id}`} onClick={()=>setOpen(false)}>
          <span><strong>{e.matchup}</strong><time dateTime={e.game.started_at}>{gameDate(e.game.started_at)} · {gameTime(e.game.started_at)}</time><small>{e.detail}</small></span>
          <b>{e.result}</b><ArrowUpRight size={14} aria-hidden="true"/>
        </Link></li>)}
      </ol>
    </Dialog>}
  </>;
}
