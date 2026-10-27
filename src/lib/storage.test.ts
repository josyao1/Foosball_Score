import { expect, it } from "vitest";
import { LocalRepository } from "./storage";
import type { Game } from "./types";
const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  };
};
it("persists a live game and rejects a stale scorer without losing its goals", async () => {
  const storage = memory(),
    repo = new LocalRepository(storage, { rivalries: [], games: [] });
  const rivalry = await repo.createRivalry(" A ", " B ");
  const g: Game = {
    id: "g",
    rivalry_id: rivalry.id,
    started_at: new Date().toISOString(),
    ended_at: null,
    revision: 0,
    goals: [],
  };
  const saved = await repo.saveGame(g);
  expect(saved.revision).toBe(1);
  const updated = await repo.saveGame({
    ...saved,
    goals: [
      {
        id: "goal",
        actor_side: "a",
        rung: "attacker",
        flags: [],
        elapsed_ms: 1200,
        occurred_at: new Date(Date.parse(g.started_at) + 1200).toISOString(),
      },
    ],
  });
  await expect(repo.saveGame(saved)).rejects.toThrow(/changed/);
  const second = new LocalRepository(storage);
  expect((await second.load()).games[0].goals).toHaveLength(1);
  expect(updated.revision).toBe(2);
});
it("prevents concurrent live games in the same rivalry", async () => {
  const repo = new LocalRepository(memory(), { rivalries: [], games: [] });
  const r = await repo.createRivalry("A", "B");
  const g: Game = {
    id: "one",
    rivalry_id: r.id,
    started_at: new Date().toISOString(),
    ended_at: null,
    revision: 0,
    goals: [],
  };
  await repo.saveGame(g);
  await expect(repo.saveGame({ ...g, id: "two" })).rejects.toThrow(/live game/);
});
it("rejects duplicate reversed pairings", async () => {
  const repo = new LocalRepository(memory(), { rivalries: [], games: [] });
  await repo.createRivalry("Josh", "Brooks");
  await expect(repo.createRivalry(" brooks ", "JOSH")).rejects.toThrow(
    /already/,
  );
});
it('does not confuse different player names containing the pairing delimiter', async () => {
  const repo = new LocalRepository(memory(), { rivalries: [], games: [] });
  await repo.createRivalry('A|B', 'C');
  await repo.createRivalry('A', 'B|C');
  expect((await repo.load()).rivalries).toHaveLength(2);
});
it('deletes one completed game without removing another rivalry',async()=>{const repo=new LocalRepository(memory(),{rivalries:[],games:[]});const a=await repo.createRivalry('A','B'),b=await repo.createRivalry('C','D');const base:Game={id:'one',rivalry_id:a.id,started_at:new Date().toISOString(),ended_at:null,revision:0,goals:[]};const one=await repo.saveGame(base);await repo.saveGame({...base,id:'two',rivalry_id:b.id});await repo.deleteGame(one);expect((await repo.load()).games.map(g=>g.id)).toEqual(['two']);expect((await repo.load()).rivalries).toHaveLength(2)});
it('rejects rivalry deletion when a game changed since confirmation',async()=>{const repo=new LocalRepository(memory(),{rivalries:[],games:[]});const r=await repo.createRivalry('A','B');await repo.saveGame({id:'g',rivalry_id:r.id,started_at:new Date().toISOString(),ended_at:null,revision:0,goals:[]});await expect(repo.deleteRivalry(r.id,{})).rejects.toThrow(/changed/);await repo.deleteRivalry(r.id,{g:1});expect((await repo.load()).games).toHaveLength(0);expect((await repo.load()).rivalries).toHaveLength(0)});
