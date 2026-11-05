import { expect,it } from 'vitest';
import { defaultLineup, goalPlayer, sidePlayers, validateRoster, orderRivalries } from './participants';
import { playerPassports } from './players';
import { scorePlayerStats } from './scorigami';
import type { Game, Rivalry, Player } from './types';
const j:Player={id:'j',name:'Josh',created_at:''}, b:Player={id:'b',name:'Brooks',created_at:''}, a:Player={id:'a',name:'Andrew',created_at:''};
const r:Rivalry={id:'r',player_a:'Josh and Brooks',player_b:'Andrew',created_at:'2026-01-01',members:{a:[j,b],b:[a]}};
const game=(id:string,n=5):Game=>({id,rivalry_id:'r',revision:1,started_at:'2026-01-01T00:00:00Z',ended_at:'2026-01-01T00:01:00Z',goals:Array.from({length:n},(_,i)=>({id:`${id}-${i}`,actor_side:'a',rung:'goalie',flags:[],elapsed_ms:(i+1)*1000,occurred_at:'2026-01-01T00:00:10Z'}))});
it('maps confirmed legacy team to individuals but does not split arbitrary names',()=>{
 expect(sidePlayers({...r,members:undefined},'a').map(p=>p.name)).toEqual(['Josh','Brooks']);
 expect(sidePlayers({...r,members:undefined,player_a:'Rock and Roll'},'a')).toHaveLength(1);
});
it('splits legacy counts, floors cumulative totals and shares results and achievements',()=>{
 const g=game('one');g.goals[0].flags=['own_goal'];g.goals[1].flags=['dunk'];
 const people=playerPassports([g,game('two')],[r]);
 for(const key of ['j','b']) {
  const p=people.find(p=>p.key===key)!;
  expect(p).toMatchObject({played:2,wins:2,goals:4,types:{own_goal:0,dunk:0}});
  expect(p.mastery.goals.count).toBe(4);
  expect(p.mastery.allRungs.count).toBe(0);
 }
 expect(people).toHaveLength(3);
 expect(scorePlayerStats([g],[r]).map(p=>[p.name,p.wins])).toEqual([['Brooks',1],['Josh',1],['Andrew',0]]);
});
it('uses goal position snapshots after swaps and counts only individual all-rung mastery',()=>{
 const g=game('g',10),lineup=defaultLineup(r);
 g.lineup={...lineup,a:{defense:'b',attack:'j'}};
 g.goals=g.goals.map((goal,i)=>({...goal,rung:(['goalie','defender','middle','attacker'] as const)[i%4],lineup}));
 const first=g.goals[0];expect(goalPlayer(first,r)).toBe('j');
 const people=playerPassports([g],[r]);
 expect(people.find(p=>p.key==='j')!.mastery.allRungs.count).toBe(0);
 expect(people.find(p=>p.key==='b')!.mastery.allRungs.count).toBe(0);
 // Josh takes attack for the final two shots, completing all four personally.
 g.goals[6].lineup=g.lineup;g.goals[7].lineup=g.lineup;
 const updated=playerPassports([g],[r]);
 expect(updated.find(p=>p.key==='j')!.mastery.allRungs.count).toBe(1);
 expect(updated.find(p=>p.key==='b')!.mastery.allRungs.count).toBe(0);
 expect(updated.find(p=>p.key==='j')!.achievements.perfect?.id).toBe('g');
 expect(updated.find(p=>p.key==='b')!.achievements.perfect?.id).toBe('g');
});
it('rejects shared or duplicate members and keeps selected team rivalries first by recency',()=>{
 expect(()=>validateRoster([j,j],[a])).toThrow();expect(()=>validateRoster([j,b],[b])).toThrow();
 expect(()=>validateRoster([],[a])).toThrow();expect(()=>validateRoster([j,b,a],[a])).toThrow();
 const solo={...r,id:'solo',player_a:'Josh',members:{a:[j],b:[a]}};
 const other={...r,id:'other',members:{a:[b],b:[a]}};
 const g={...game('later'),rivalry_id:'solo',started_at:'2026-02-01'};
 expect(orderRivalries([other,r,solo],[g],'j').map(r=>r.id)).toEqual(['solo','r','other']);
});
it('includes a created profile with no rivalries',()=>{
 expect(playerPassports([],[],[j])[0]).toMatchObject({key:'j',name:'Josh',played:0});
});

it('creates profiles before rosters and persists swaps without changing earlier goals',async()=>{
 const {LocalRepository}=await import('./storage');
 let raw:string|null=null;const repo=new LocalRepository({getItem:()=>raw,setItem:(_k,v)=>{raw=v;}});
 const j=await repo.createPlayer('Josh'),b=await repo.createPlayer('Brooks'),a=await repo.createPlayer('Andrew');
 await expect(repo.createPlayer(' josh ')).rejects.toThrow();
 const r=await repo.createTeamRivalry([j.id,b.id],[a.id]);
 await expect(repo.createTeamRivalry([a.id],[b.id,j.id])).rejects.toThrow('already');
 let g=await repo.saveGame({...game('test',0),ended_at:null,revision:0,rivalry_id:r.id,lineup:defaultLineup(r)});
 const original=g.lineup!;
 g=await repo.saveGame({...g,goals:[{...game('shot',1).goals[0],lineup:original}]});
 const beforeSwap=g;
 g=await repo.saveGame({...g,lineup:{...original,a:{defense:b.id,attack:j.id}}});
 expect(goalPlayer(g.goals[0],r)).toBe(j.id);
 await expect(repo.saveGame(beforeSwap)).rejects.toThrow('changed');
 const state=await repo.load();expect(state.players).toHaveLength(3);
 await repo.deleteRivalry(r.id,{[g.id]:g.revision});
 expect((await repo.load()).players).toHaveLength(3);
});

it('does not use identical display labels as identity',()=>{
 const named={id:'ann-bob',name:'Ann and Bob',created_at:''};
 const two=[{id:'ann',name:'Ann',created_at:''},{id:'bob',name:'Bob',created_at:''}];
 const rivalry={...r,player_a:'Ann and Bob',player_b:'Ann and Bob',members:{a:[named],b:two}};
 const people=playerPassports([game('win',10)],[rivalry]);
 expect(people.find(p=>p.key==='ann-bob')).toMatchObject({played:1,wins:1,goals:10});
 expect(people.find(p=>p.key==='ann')).toMatchObject({played:1,losses:1});
});
