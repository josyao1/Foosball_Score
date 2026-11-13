import { expect, it } from 'vitest';
import { playerChemistry } from './chemistry';
import type { Game, Player, Rivalry } from './types';
const p=(id:string):Player=>({id,name:id,created_at:'2026-01-01'});
const r=(id:string,a:string[],b:string[]):Rivalry=>({id,player_a:a.join(' and '),player_b:b.join(' and '),created_at:'2026-01-01',members:{a:a.map(p),b:b.map(p)}});
const g=(id:string,rid:string,seq='aab'):Game=>({id,rivalry_id:rid,revision:1,started_at:'2026-11-01T12:00:00Z',ended_at:'2026-11-01T12:05:00Z',goals:[...seq].map((s,i)=>({id:`${id}-${i}`,actor_side:s as 'a'|'b',rung:'attacker',flags:[],elapsed_ms:i*1000,occurred_at:'2026-11-01T12:00:00Z'}))});
it('keeps solo and team opposition separate and counts shared results once per opponent',()=>{
 const data=playerChemistry([g('solo','s'),g('team','t')],[r('s',['josh'],['andrew']),r('t',['josh','brooks'],['andrew','max'])]);
 expect(data.josh.with[0]).toMatchObject({person:{id:'brooks'},played:1,wins:1});
 expect(data.josh.singles[0]).toMatchObject({person:{id:'andrew'},played:1,wins:1});
 expect(data.josh.teams.map(x=>x.person.id)).toEqual(['andrew','max']);
 expect(data.andrew.with[0]).toMatchObject({losses:1});
});
it('uses each goal lineup including swaps; excludes own goals and identifies unknown legacy goals',()=>{
 const game=g('t','t','aaaaa');
 game.goals[0].lineup={a:{attack:'josh',defense:'brooks'},b:{attack:'andrew',defense:'andrew'}};
 game.goals[1].lineup={a:{attack:'brooks',defense:'josh'},b:{attack:'andrew',defense:'andrew'}};
 game.goals[2].flags=['own_goal'];
 const data=playerChemistry([game],[r('t',['josh','brooks'],['andrew'])]);
 expect(data.josh.with[0]).toMatchObject({ownGoals:1,partnerGoals:1,unattributed:2});
 expect(data.brooks.with[0]).toMatchObject({ownGoals:1,partnerGoals:1,unattributed:2});
});
it('excludes live and archived games and rivalries; restoring returns all records',()=>{
 const game=g('t','t'),rival=r('t',['josh','brooks'],['andrew']);
 expect(playerChemistry([{...game,ended_at:null}],[rival])).toEqual({});
 expect(playerChemistry([{...game,deleted_at:'today'}],[rival])).toEqual({});
 expect(playerChemistry([game],[{...rival,deleted_at:'today'}])).toEqual({});
 expect(playerChemistry([game],[rival]).josh.with[0].played).toBe(1);
});
it('prioritizes established partnerships and retains only five recent results in order',()=>{
 const games=Array.from({length:7},(_,i)=>({...g(String(i),'old'),ended_at:`2026-11-0${i+1}T12:05:00Z`}));
 const data=playerChemistry([...games,g('new','new')],[r('old',['josh','brooks'],['andrew']),r('new',['josh','max'],['andrew'])]);
 expect(data.josh.with.map(x=>x.person.id)).toEqual(['brooks','max']);
 expect(data.josh.with[0].recent.map(x=>x.game.id)).toEqual(['2','3','4','5','6']);
});
