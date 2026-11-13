import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Download, Send } from 'lucide-react';
import { useStore } from '../lib/store';
import { rankedClassics } from '../lib/hallOfFame';
import { matchTicketSvg, ticketPng } from '../lib/matchTicket';
import { matchStory, type MatchStory } from '../lib/matchStory';
import { Dialog } from './Dialog';
import type { Game, Player, Rivalry } from '../lib/types';
import './match-ticket.css';
const noPlayers:Player[]=[];

function ShareTicket({game,rivalry,players,story,rank,onClose}:{game:Game;rivalry:Rivalry;players:Player[];story:MatchStory;rank:number|null;onClose:()=>void}){
 const [ready,setReady]=useState<{url:string;file:File}|null>(null),[error,setError]=useState(''),[copying,setCopying]=useState(false),[copied,setCopied]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
   let cancelled=false,url:string|undefined;setReady(null);setError('');setCopied(false);
   ticketPng(matchTicketSvg(game,rivalry,players,story,rank)).then(blob=>{
     if(cancelled)return;
     url=URL.createObjectURL(blob);
     setReady({url,file:new File([blob],`tabletalk-${game.id.replace(/[^a-z0-9-]/gi,'')}.png`,{type:'image/png'})});
   }).catch(()=>{if(!cancelled)setError('The ticket could not be prepared. Try again.');});
   return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};
 },[game,rivalry,players,story,rank,attempt]);
 const canCopy=typeof ClipboardItem!=='undefined'&&typeof navigator.clipboard?.write==='function';
 async function copy(){
   if(!ready)return;setCopying(true);setError('');setCopied(false);
   try{await navigator.clipboard.write([new ClipboardItem({'image/png':ready.file})]);setCopied(true);}
   catch{setError('Couldn’t copy the image. Download it instead.');}
   finally{setCopying(false);}
 }
 return <Dialog title="Match ticket" onClose={onClose} closeOnBackdrop className="share-ticket-dialog">
   {ready?<img className="share-ticket-preview" src={ready.url} alt={`Match ticket for ${rivalry.player_a} vs ${rivalry.player_b}`}/>:!error&&<p role="status">Preparing your ticket…</p>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   <div className="share-ticket-actions">
     {!ready&&error&&<button className="button secondary" onClick={()=>setAttempt(n=>n+1)}>Try again</button>}
     {ready&&<a className={`button ${canCopy?'secondary':'primary'}`} href={ready.url} download={ready.file.name}><Download size={16}/>Download image</a>}
     {ready&&canCopy&&<button className="button primary" onClick={copy} disabled={copying}>{copied?<Check size={16}/>:<Copy size={16}/>}<span aria-live="polite">{copying?'Copying…':copied?'Copied':'Copy image'}</span></button>}
   </div>
 </Dialog>;
}
export function MatchTicketActions({game,rivalry,mode='both'}:{game:Game;rivalry:Rivalry;mode?:'stamp'|'share'|'both'}){
 const {games,rivalries,players}=useStore();
 const [open,setOpen]=useState(false);
 const classics=useMemo(()=>rankedClassics(games,rivalries),[games,rivalries]);
 const index=classics.findIndex(row=>row.game.id===game.id),rank=index>=0?index+1:null;
 const story=useMemo(()=>matchStory(game,rivalry,games,players??noPlayers),[game,rivalry,games,players]);
 return <div className="match-ticket-actions">
   {mode!=='share'&&rank!==null&&<Link className={rank<=10?`hall-rank-stamp hall-rank-${Math.min(rank,4)}`:"all-time-rank"} to="/hall-of-fame" aria-label={`${rank<=10?'Hall of Fame':'All-time'} #${rank}`} title="Current all-time rank across all rivalries"><span className="hall-rank-label">{rank<=10?'Hall of Fame':'All-time'}</span><b>#{rank}</b></Link>}
   {mode!=='share'&&rank===null&&<span className="all-time-rank" title="This game does not qualify for the Hall of Fame ranking">Unranked</span>}
   {mode!=='stamp'&&<button type="button" className="share-match-button" aria-label="Share ticket" title="Share ticket" onClick={()=>setOpen(true)}><Send size={16} aria-hidden="true"/><span>Share</span></button>}
   {open&&<ShareTicket game={game} rivalry={rivalry} players={players??noPlayers} story={story} rank={rank} onClose={()=>setOpen(false)}/>}
 </div>;
}
