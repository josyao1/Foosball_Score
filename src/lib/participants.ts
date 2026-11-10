import type { Data, Game, Goal, Lineup, Player, Rivalry, Side } from './types';
import { playerName } from './types';
const key=(name:string)=>name.trim().toLowerCase();
/** Only this explicitly confirmed legacy team is split; names are not a roster syntax. */
export function legacyNames(name:string):string[]{
  return key(name)==='josh and brooks' ? ['Josh','Brooks'] : [name.trim()];
}
export function sidePlayers(r:Rivalry,side:Side):Player[]{
  return r.members?.[side] ?? legacyNames(playerName(r,side)).filter(Boolean).map(name=>({id:key(name),name,created_at:r.created_at}));
}
export function allPlayers(rivalries:Rivalry[],registry:Player[]=[]):Player[]{
  const people=new Map(registry.map(p=>[p.id,p]));
  for(const r of rivalries)for(const side of ['a','b'] as const)for(const p of sidePlayers(r,side))if(!people.has(p.id))people.set(p.id,p);
  return [...people.values()];
}
export function validateRoster(a:Player[],b:Player[]){
  if(!a.length||!b.length||a.length>2||b.length>2)throw new Error('Choose one or two players on each side.');
  const ids=[...a,...b].map(p=>p.id);
  if(new Set(ids).size!==ids.length)throw new Error('Each player can appear on only one side, once.');
}
export function rosterKey(a:Player[],b:Player[]){return [a.map(p=>p.id).sort().join(','),b.map(p=>p.id).sort().join(',')].sort().join('|');}
export function defaultLineup(r:Rivalry):Lineup{
  const position=(s:Side)=>{const members=sidePlayers(r,s);return {defense:members[0]?.id ?? '',attack:members.at(-1)?.id ?? ''};};
  return {a:position('a'),b:position('b')};
}
export function validateLineup(lineup:Lineup,r:Rivalry){
  for(const side of ['a','b'] as const){
    const ids=sidePlayers(r,side).map(p=>p.id),pos=lineup?.[side];
    if(pos?.swapped_at_ms !== undefined && (!Number.isSafeInteger(pos.swapped_at_ms)||pos.swapped_at_ms<0))throw new Error('Invalid swap time.');
    if(!pos||!ids.includes(pos.defense)||!ids.includes(pos.attack)||(ids.length===2&&pos.defense===pos.attack))throw new Error('Assign each teammate to attack or defense.');
  }
}
export function goalPlayer(g:Goal,r:Rivalry):string|null{
  const members=sidePlayers(r,g.actor_side);
  if(members.length===1)return members[0].id;
  return g.lineup?.[g.actor_side]?.[g.rung==='goalie'||g.rung==='defender'?'defense':'attack'] ?? null;
}
export function goalCredit(g:Goal,r:Rivalry,playerId:string):number{
  const id=goalPlayer(g,r);
  return id ? (id===playerId ? 1:0) : sidePlayers(r,g.actor_side).some(p=>p.id===playerId) ? 1/sidePlayers(r,g.actor_side).length : 0;
}
export function matchesProfile(p:Player,profile:string|null){return !!profile&&(p.id===profile||key(p.name)===profile);}
type DisplayTeam = { side: Side; name: string; kit: 'black' | 'white'; mine: boolean };
export type DisplayTeams = [DisplayTeam, DisplayTeam];

export function displayTeams(rivalry: Rivalry, profile: string | null): DisplayTeams {
  function team(side: Side): DisplayTeam {
    const members = sidePlayers(rivalry, side);
    const selected = members.find(player => matchesProfile(player, profile));
    const name = selected && members.length > 1
      ? [selected, ...members.filter(player => player.id !== selected.id)].map(player => player.name).join(' and ')
      : playerName(rivalry, side);
    return {side, name, kit: side === 'a' ? 'black' : 'white', mine: Boolean(selected)};
  }
  const black = team('a'), white = team('b');
  return white.mine ? [white, black] : [black, white];
}

export function rivalryMatchesProfile(rivalry: Rivalry, profile: string | null) {
  return (['a', 'b'] as const).some(side => sidePlayers(rivalry, side).some(player => matchesProfile(player, profile)));
}
export function orderRivalries(rivalries:Rivalry[],games:Game[],profile:string|null){
  const latest=new Map<string,number>();
  for(const g of games)latest.set(g.rivalry_id,Math.max(latest.get(g.rivalry_id)??0,Date.parse(g.started_at)||0));
  const mine=(r:Rivalry)=>rivalryMatchesProfile(r,profile);
  return [...rivalries].sort((a,b)=>Number(mine(b))-Number(mine(a))||(latest.get(b.id)??0)-(latest.get(a.id)??0)||(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||a.id.localeCompare(b.id));
}
/** Upgrade local legacy records without changing any game or event. */
export function normalizePlayers(data:Data):Data{
  if(data.players && data.rivalries.every(r=>r.members))return data;
  const players=[...(data.players??[])];
  const get=(name:string,created_at:string)=>{
    let p=players.find(p=>key(p.name)===key(name));
    if(!p){p={id:crypto.randomUUID(),name:name.trim(),created_at};players.push(p);}return p;
  };
  // Solo spellings take precedence over the confirmed legacy team's display casing.
  for(const r of data.rivalries)for(const name of [r.player_a,r.player_b])if(legacyNames(name).length===1)get(name,r.created_at);
  const rivalries=data.rivalries.map(r=>({...r,members:r.members??{a:legacyNames(r.player_a).map(n=>get(n,r.created_at)),b:legacyNames(r.player_b).map(n=>get(n,r.created_at))}}));
  return {...data,players,rivalries};
}

export function hasDistinctSides(r:Rivalry){const a=sidePlayers(r,'a'),b=sidePlayers(r,'b');return a.length>0&&b.length>0&&!a.some(p=>b.some(q=>q.id===p.id));}
