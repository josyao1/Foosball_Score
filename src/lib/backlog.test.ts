import { expect, it } from 'vitest';
import { LocalRepository } from './storage';
import { playerPassports } from './players';
import { scorigami } from './scorigami';
import { rankedClassics } from './hallOfFame';
import { recordBook } from './records';
import { rivalryStats } from './stats';
import type { Data, Game } from './types';
const date='2026-01-01T00:00:00Z';
async function setup() {
 let raw=''; const repo=new LocalRepository({getItem:()=>raw||null,setItem:(_,s)=>{raw=s;}});
 const people=await Promise.all(['josh','brooks','andrew'].map(n=>repo.createPlayer(n)));
 const r=await repo.createTeamRivalry([people[0].id,people[1].id],[people[2].id]);
 const lineup={a:{defense:people[0].id,attack:people[1].id},b:{defense:people[2].id,attack:people[2].id}};
 const swapped={...lineup,a:{defense:people[1].id,attack:people[0].id,swapped_at_ms:5000}};
 const game=await repo.saveGame({id:'game',rivalry_id:r.id,revision:0,started_at:date,ended_at:'2026-01-01T00:01:00Z',lineup:swapped,goals:Array.from({length:10},(_,i)=>({id:`goal${i}`,actor_side:'a',rung:'attacker',elapsed_ms:(i+1)*1000,occurred_at:new Date(Date.parse(date)+(i+1)*1000).toISOString(),flags:i===3?['bank']:[],lineup:i<5?lineup:swapped}))});
 return {repo,r,game,raw:()=>JSON.parse(raw) as Data};
}
const revisions=(games:Game[])=>Object.fromEntries(games.map(g=>[g.id,g.revision]));
const stats=(d:Data)=>({profiles:playerPassports(d.games,d.rivalries,d.players),scores:scorigami(d.games),classics:rankedClassics(d.games,d.rivalries).map(x=>JSON.stringify(x)),records:recordBook(d.games),h2h:rivalryStats(d.games)});
it('round-trips a game with all goal snapshots, flags, IDs and timestamps, restoring every derived view',async()=>{
 const {repo,game,raw}=await setup(); const before=await repo.load();
 await repo.deleteGame(game);
 expect((await repo.load()).games).toEqual([]);
 expect(raw().games[0].goals).toEqual(game.goals);
 expect((await repo.loadBacklog()).games[0].deleted_at).toBeTruthy();
 await expect(repo.saveGame(game)).rejects.toThrow(/backlog|changed/);
 const archived=(await repo.loadBacklog()).games[0];
 await repo.restoreGame(archived);
 const after=await repo.load();
 expect(after.games[0]).toEqual({...game,revision:game.revision+2,deleted_at:null});
 // Revision changes are metadata, not scoring changes.
 const restored={...after,games:after.games.map(g=>({...g,revision:game.revision,deleted_at:undefined}))};
 expect(JSON.stringify(stats(restored))).toEqual(JSON.stringify(stats(before)));
});
it('restores a rivalry without resurrecting separately removed games; purge removes only its children',async()=>{
 const {repo,r,game,raw}=await setup();
 const second=await repo.saveGame({...game,id:'second',revision:0,goals:game.goals.map(g=>({...g,id:`second-${g.id}`}))});
 await repo.deleteGame(second);
 await repo.deleteRivalry(r.id,{[game.id]:game.revision});
 expect((await repo.load()).rivalries).toEqual([]);
 expect((await repo.load()).games).toEqual([]);
 let backlog=await repo.loadBacklog();
 await expect(repo.restoreGame(backlog.games.find(g=>g.id===second.id)!)).rejects.toThrow(/rivalry/);
 await repo.restoreRivalry(backlog.rivalries[0],revisions(backlog.games));
 expect((await repo.load()).games.map(g=>g.id)).toEqual([game.id]);
 expect((await repo.loadBacklog()).games.map(g=>g.id)).toEqual([second.id]);
 await repo.deleteRivalry(r.id,revisions((await repo.load()).games));
 backlog=await repo.loadBacklog();
 await repo.purgeRivalry(backlog.rivalries[0],revisions(backlog.games));
 expect(raw().rivalries).toEqual([]);expect(raw().games).toEqual([]);expect(raw().players).toHaveLength(3);
});
it('rejects stale restores, stale purges, and attempts to purge active records',async()=>{
 const {repo,r,game}=await setup();
 await expect(repo.purgeGame(game)).rejects.toThrow(/backlog/);
 await expect(repo.purgeRivalry(r,{[game.id]:game.revision})).rejects.toThrow(/backlog/);
 await repo.deleteGame(game);const old=(await repo.loadBacklog()).games[0];
 await repo.restoreGame(old);await repo.deleteGame((await repo.load()).games[0]);
 await expect(repo.restoreGame(old)).rejects.toThrow(/changed/);
 await expect(repo.purgeGame(old)).rejects.toThrow(/changed/);
 expect((await repo.loadBacklog()).games).toHaveLength(1);
});
it('reserves archived matchups, retains live games inside rivalries, and leaves live discard unchanged',async()=>{
 const {repo,r,game}=await setup();
 const live=await repo.saveGame({id:'live',rivalry_id:r.id,started_at:date,ended_at:null,revision:0,goals:[]});
 await expect(repo.deleteGame(live)).rejects.toThrow(/finished/);
 await repo.deleteRivalry(r.id,revisions((await repo.load()).games));
 const backlog=await repo.loadBacklog();
 await expect(repo.saveGame(live)).rejects.toThrow(/changed|no longer/);
 await expect(repo.createTeamRivalry(r.members!.b.map(p=>p.id),r.members!.a.map(p=>p.id))).rejects.toThrow(/backlog/);
 await repo.restoreRivalry(backlog.rivalries[0],revisions(backlog.games));
 const restored=(await repo.load()).games.find(g=>g.id===live.id)!;
 expect(restored.started_at).toBe(date);expect(restored.ended_at).toBeNull();
 await repo.discardGame(restored);
 expect((await repo.loadBacklog()).games).toEqual([]);
 expect((await repo.load()).games.map(g=>g.id)).toEqual([game.id]);
});
