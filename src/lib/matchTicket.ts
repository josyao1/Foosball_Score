import type { MatchStory } from './matchStory';
import { sidePlayers } from './participants';
import { playerAppearance } from './playerAppearance';
import { gameStats, clock, score } from './stats';
import { gameDate, gameTime } from './time';
import type { Game, Player, Rivalry } from './types';

const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const text=(x:number,y:number,value:string,size=24,anchor='start',weight=400,family='Arial, sans-serif')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="#593c2c">${escape(value)}</text>`;
function lines(value:string,max:number):string[]{
 const result:string[]=[];let line='';
 for(const word of value.split(/\s+/)){
   if(line&&line.length+word.length+1>max){result.push(line);line='';}
   let rest=word;
   while(rest.length>max){result.push(rest.slice(0,max));rest=rest.slice(max);}
   line+=(line?' ':'')+rest;
 }
 if(line)result.push(line);return result;
}
function fittedText(x:number,y:number,value:string,size:number,maxWidth:number){
 const estimated=[...value].reduce((width,c)=>width+(/[MW@]/.test(c)?.95:/[il .,'!]/.test(c)?.28:.59),0)*size;
 return text(x,y,value,Math.min(size,size*maxWidth/Math.max(1,estimated)),'middle',600);
}
function jersey(player:Player,x:number,y:number){
 const a=playerAppearance(player);
 return `<g transform="translate(${x-35} ${y}) scale(.7)"><path fill="${escape(a.color)}" d="M33 8L20 14 4 36 20 48 27 39 24 98Q50 104 76 98L73 39 80 48 96 36 80 14 67 8Q50 17 33 8Z"/><path d="M34 9Q50 32 66 9M8 32L22 42M78 42L92 32" fill="none" stroke="${escape(a.trim)}" stroke-width="4"/><text x="50" y="64" text-anchor="middle" fill="${escape(a.lettering)}" font-family="Arial, sans-serif" font-size="${a.letters.length>3?14:18}" font-weight="700">${escape(a.letters)}</text></g>`;
}
/** Self-contained artwork: no remote images, fonts, or game-data requests during export. */
export function matchTicketSvg(game:Game,rivalry:Rivalry,players:Player[],story:MatchStory,rank:number|null){
 const final=score(game.goals),momentum=gameStats(game).momentum;
 const total=Math.max(1,momentum.at(-1)!.elapsed),maxLead=Math.max(2,...momentum.map(p=>Math.abs(p.lead)));
 const x=(ms:number)=>110+ms/total*890,y=(lead:number)=>635-lead/maxLead*85;
 let path=`M${x(0)} ${y(0)}`;
 for(const point of momentum.slice(1))path+=`H${x(point.elapsed)}V${y(point.lead)}`;
 const registry=new Map(players.map(p=>[p.id,p]));
 const teams=(['a','b'] as const).map((side,i)=>{
   const center=i===0?290:790,members=sidePlayers(rivalry,side).map(p=>registry.get(p.id)??p);
   const kits=members.map((p,j)=>jersey(p,center+(j-(members.length-1)/2)*88,160)).join('');
   const names=members.map(p=>p.name);
   return kits+text(center,335,String(final[side]),112,'middle',700,'Georgia, serif')+
     names.map((name,j)=>fittedText(center,385+j*32,name,29,410)).join('');
 }).join('');
 const teamNames=(['a','b'] as const).map(side=>sidePlayers(rivalry,side).map(p=>(registry.get(p.id)??p).name).join(' and '));
 const chosen=[story.headline,...story.facts].filter(f=>f.id!=='result').slice(0,2);
 const factWidth=920/Math.max(1,chosen.length);
 const facts=chosen.map((fact,i)=>{
   const center=80+factWidth*(i+.5);
   const subject=fact.id==='close'?'Throughout the game':fact.id==='bothPoint'?'Both sides':fact.subject;
   const value=fact.id==='close'?'Never more than 2 apart':fact.id==='bothPoint'?'Held match point':fact.value;
   return fittedText(center,855,subject,21,factWidth-40)+lines(value,30).slice(0,2).map((line,j)=>fittedText(center,895+j*29,line,26,factWidth-40)).join('');
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="960" viewBox="0 0 1080 960">
 <rect width="1080" height="960" fill="#f5e9d6"/><rect x="24" y="24" width="1032" height="912" rx="26" fill="#fff7e9" stroke="#c5aa8b" stroke-width="2"/>
 <path d="M50 26H1030" stroke="#795b45" stroke-width="8"/>
 ${text(65,89,`${gameDate(game.started_at)} · ${gameTime(game.started_at)}`,22)}${text(1015,89,'IXL League',23,'end',600)}
 ${text(1015,136,'Final',22,'end')}
 ${teams}${text(540,320,'–',48,'middle',400,'Georgia, serif')}
 <path d="M24 460H1056" stroke="#c5aa8b" stroke-width="2" stroke-dasharray="7 6"/><circle cx="24" cy="460" r="12" fill="#f5e9d6" stroke="#c5aa8b"/><circle cx="1056" cy="460" r="12" fill="#f5e9d6" stroke="#c5aa8b"/>
 ${fittedText(300,510,`${teamNames[0]} leads ↑`,20,435)}${fittedText(780,510,`${teamNames[1]} leads ↓`,20,435)}
 ${[maxLead,0,-maxLead].map(lead=>`<path d="M110 ${y(lead)}H1000" stroke="#c5aa8b" stroke-opacity="${lead===0?1:.35}" stroke-dasharray="${lead===0?'6 6':'0'}"/>${text(94,y(lead)+6,lead===0?'Tied':lead>0?`+${lead}`:String(lead),19,'end')}`).join('')}
 <path d="${path}V635H110Z" fill="#ebdbc1"/><path d="${path}" fill="none" stroke="#593c2c" stroke-width="4" stroke-linejoin="round"/>
 <circle cx="1000" cy="${y(momentum.at(-1)!.lead)}" r="6" fill="#593c2c"/>
 ${text(110,760,'0:00',20)}${text(555,760,clock(total===1?0:total/2),18,'middle')}${text(1000,760,`Final goal · ${clock(total===1?0:total)}`,20,'end')}
 ${text(540,795,rank?`${rank<=10?'Hall of Fame':'All-time'} #${rank}`:'Unranked',18,'middle',600)}
 ${facts?'<path d="M65 818H1015" stroke="#c5aa8b"/>':''}${facts}
 </svg>`;
}
export async function ticketPng(svg:string):Promise<Blob>{
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{
   const image=new Image();
   await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Could not prepare the ticket image.'));image.src=url;});
   const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=960;
   const context=canvas.getContext('2d');if(!context)throw new Error('This browser cannot create the ticket image.');
   context.drawImage(image,0,0);
   return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not save the ticket image.')),'image/png'));
 }finally{URL.revokeObjectURL(url);}
}
