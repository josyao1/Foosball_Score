import type { Data, Game, Rivalry } from "./types";
export interface Repository {
  load(): Promise<Data>;
  createRivalry(a: string, b: string): Promise<Rivalry>;
  saveGame(game: Game): Promise<Game>;
  discardGame(game: Game): Promise<void>;
  deleteGame(game: Game): Promise<void>;
  deleteRivalry(id:string,expectedGames:Record<string,number>):Promise<void>;
}
export const STORAGE_KEY = "table-talk-demo-v1";
const pairingKey = (a: string, b: string) =>
  JSON.stringify([a.trim().toLowerCase(), b.trim().toLowerCase()].sort());
export function validateNames(a: string, b: string) {
  if (!a.trim() || !b.trim() || a.trim().length > 40 || b.trim().length > 40)
    throw new Error("Enter two names, each up to 40 characters.");
  if (a.trim().toLowerCase() === b.trim().toLowerCase())
    throw new Error("Choose two different players.");
}
export class LocalRepository implements Repository {
  constructor(
    private storage: Pick<Storage, "getItem" | "setItem">,
    private seed?: Data,
    private key = STORAGE_KEY,
  ) {}
  private read(): Data {
    const raw = this.storage.getItem(this.key);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (!Array.isArray(d.rivalries) || !Array.isArray(d.games))
          throw new Error();
        return d;
      } catch {
        throw new Error(
          "Browser data could not be read. Export or clear this site’s storage to start again.",
        );
      }
    }
    const d = this.seed ?? { rivalries: [], games: [] };
    this.write(d);
    return d;
  }
  private write(data: Data) {
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
    } catch {
      throw new Error(
        "Browser storage is unavailable or full. Allow site storage before saving.",
      );
    }
  }
  async load() {
    return this.read();
  }
  async createRivalry(a: string, b: string): Promise<Rivalry> {
    validateNames(a, b);
    const d = this.read(),
      pair = pairingKey(a, b);
    if (
      d.rivalries.some(
        (r) =>
          pairingKey(r.player_a, r.player_b) === pair,
      )
    )
      throw new Error("This rivalry already exists.");
    const r = {
      id: crypto.randomUUID(),
      player_a: a.trim(),
      player_b: b.trim(),
      created_at: new Date().toISOString(),
    };
    this.write({ ...d, rivalries: [...d.rivalries, r] });
    return r;
  }
  async saveGame(g: Game) {
    const d = this.read(),
      old = d.games.find((x) => x.id === g.id);
    if ((old?.revision ?? 0) !== g.revision)
      throw new Error(
        "This game changed on another device or tab. Review the latest score and try again.",
      );
    if (!d.rivalries.some((r) => r.id === g.rivalry_id))
      throw new Error("This rivalry no longer exists.");
    if (
      !g.ended_at &&
      d.games.some(
        (x) => x.rivalry_id === g.rivalry_id && x.id !== g.id && !x.ended_at,
      )
    )
      throw new Error(
        "This rivalry already has a live game. Resume it instead.",
      );
    if (g.ended_at && !g.goals.length)
      throw new Error("Score a goal before finishing, or discard this game.");
    const saved = { ...g, revision: g.revision + 1 };
    this.write({
      ...d,
      games: [...d.games.filter((x) => x.id !== g.id), saved],
    });
    return saved;
  }
  async discardGame(g: Game) {
    const d = this.read(),
      old = d.games.find((x) => x.id === g.id);
    if (!old || old.revision !== g.revision)
      throw new Error("This game changed. Refresh and try again.");
    if (old.ended_at) throw new Error("Only live games can be discarded.");
    this.write({ ...d, games: d.games.filter((x) => x.id !== g.id) });
  }
  async deleteGame(g:Game){const d=this.read(),old=d.games.find(x=>x.id===g.id);if(!old||old.revision!==g.revision)throw new Error('This game changed. Close the dialog and try again.');this.write({...d,games:d.games.filter(x=>x.id!==g.id)})}
  async deleteRivalry(id:string,expectedGames:Record<string,number>){const d=this.read(),current=d.games.filter(g=>g.rivalry_id===id);if(!d.rivalries.some(r=>r.id===id))throw new Error('This rivalry no longer exists.');if(current.length!==Object.keys(expectedGames).length||current.some(g=>expectedGames[g.id]!==g.revision))throw new Error('This rivalry changed. Close the dialog and review its games.');this.write({rivalries:d.rivalries.filter(r=>r.id!==id),games:d.games.filter(g=>g.rivalry_id!==id)})}
  async clear() {
    this.write({ rivalries: [], games: [] });
  }
}
