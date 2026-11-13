import { describe, expect, it } from 'vitest';
import { LocalRepository } from './storage';
import { defaultAppearance, playerAppearance } from './playerAppearance';
import { defaultLineup } from './participants';

async function setup(){
 let raw='';const repo=new LocalRepository({getItem:()=>raw||null,setItem:(_,s)=>{raw=s;}});
 const j=await repo.createPlayer('josh'),b=await repo.createPlayer('brooks'),a=await repo.createPlayer('andrew');
 const r=await repo.createTeamRivalry([j.id,b.id],[a.id]);
 const game=await repo.saveGame({id:'test-game',rivalry_id:r.id,started_at:'2026-11-01T10:00:00Z',ended_at:'2026-11-01T10:05:00Z',revision:0,lineup:defaultLineup(r),goals:[{id:'test-goal',actor_side:'a',rung:'goalie',flags:[],elapsed_ms:12000,occurred_at:'2026-11-01T10:00:12Z',lineup:defaultLineup(r)}]});
 return {repo,j,b,r,game,raw:()=>JSON.parse(raw)};
}
describe('player settings',()=>{
 it('renames by ID and keeps archived games, goal attribution, and roster identity intact',async()=>{
  const {repo,j,r,game,raw}=await setup();
  await repo.deleteRivalry(r.id,{[game.id]:game.revision});
  const before=raw();const appearance={...defaultAppearance('josh'),color:'#112233',subtitle:'New team'};
  await repo.updatePlayer(j,{name:'Joshua',appearance});
  const after=raw();expect(after.games).toEqual(before.games);
  expect(after.rivalries[0].deleted_at).toBe(before.rivalries[0].deleted_at);
  expect(after.rivalries[0].player_a).toBe('Joshua and brooks');
  expect(after.rivalries[0].members.a[0]).toMatchObject({id:j.id,name:'Joshua',appearance});
  const archived=(await repo.loadBacklog()).rivalries[0];
  await repo.restoreRivalry(archived,{[game.id]:before.games[0].revision});
  expect((await repo.load()).games[0].goals).toEqual(before.games[0].goals);
  expect((await repo.load()).players?.find(p=>p.id===j.id)?.appearance).toEqual(appearance);
 });
 it('rejects stale edits and duplicate names without changing data',async()=>{
  const {repo,j,b,raw}=await setup();const appearance=defaultAppearance(j.name);
  await expect(repo.updatePlayer(j,{name:' BROOKS ',appearance})).rejects.toThrow(/already/);
  await repo.updatePlayer(j,{name:'Joshua',appearance});const before=raw();
  await expect(repo.updatePlayer(j,{name:'Different',appearance})).rejects.toThrow(/another device/);
  expect(raw()).toEqual(before);expect(raw().players.find((p:{id:string})=>p.id===b.id).name).toBe('brooks');
 });
 it('validates settings and keeps explicit blank subtitles and custom colors after renaming',async()=>{
  const {repo,j}=await setup();const appearance=defaultAppearance('josh');
  await expect(repo.updatePlayer(j,{name:' ',appearance})).rejects.toThrow();
  await expect(repo.updatePlayer(j,{name:'josh',appearance:{...appearance,color:'red'}})).rejects.toThrow();
  await expect(repo.updatePlayer(j,{name:'josh',appearance:{...appearance,letters:'TOO LONG'}})).rejects.toThrow();
  const custom={...appearance,subtitle:'',lettering:'#123456'};
  await repo.updatePlayer(j,{name:'Different',appearance:custom});
  expect(playerAppearance((await repo.load()).players!.find(p=>p.id===j.id)!)).toEqual(custom);
 });
});
