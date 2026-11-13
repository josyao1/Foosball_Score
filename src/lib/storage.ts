import { validatePlayerSettings } from './playerAppearance';
import { normalizePlayers, rosterKey, validateRoster, validateLineup, defaultLineup, sidePlayers } from './participants';
import type { Data, Game, Rivalry, Player, PlayerSettings, BacklogData } from "./types";
export interface Repository {
  load(): Promise<Data>;
  loadBacklog(): Promise<BacklogData>;
  restoreGame(game: Game): Promise<void>;
  purgeGame(game: Game): Promise<void>;
  restoreRivalry(rivalry: Rivalry, expectedGames: Record<string,number>): Promise<void>;
  purgeRivalry(rivalry: Rivalry, expectedGames: Record<string,number>): Promise<void>;
  createPlayer(name:string):Promise<Player>;
  updatePlayer(player:Player, settings:PlayerSettings):Promise<void>;
  createTeamRivalry(a:string[],b:string[]):Promise<Rivalry>;
  createRivalry(a: string, b: string): Promise<Rivalry>;
  saveGame(game: Game): Promise<Game>;
  setGamePaused(game: Game, paused: boolean): Promise<Game>;
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
        const upgraded=normalizePlayers(d);
        if(upgraded!==d)this.write(upgraded);
        return upgraded;
      } catch {
        throw new Error(
          "Browser data could not be read. Export or clear this site’s storage to start again.",
        );
      }
    }
    const d = normalizePlayers(this.seed ?? { rivalries: [], games: [] });
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
    const d = this.read();
    const rivalries = d.rivalries.filter(r => !r.deleted_at);
    const ids = new Set(rivalries.map(r => r.id));
    return {...d, rivalries, games: d.games.filter(g => !g.deleted_at && ids.has(g.rivalry_id))};
  }
  async createPlayer(name:string):Promise<Player> {
    name=name.trim();
    if(!name||name.length>40)throw new Error('Enter a player name up to 40 characters.');
    const d=this.read();
    if(d.players!.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw new Error('This player already exists.');
    const player={id:crypto.randomUUID(),name,created_at:new Date().toISOString()};
    this.write({...d,players:[...d.players!,player]});return player;
  }
  async updatePlayer(player:Player, input:PlayerSettings):Promise<void> {
    const settings=validatePlayerSettings(input),d=this.read();
    const current=d.players!.find(p=>p.id===player.id);
    if(!current)throw new Error('Player no longer exists. Refresh and try again.');
    if((current.settings_revision??0)!==(player.settings_revision??0))throw new Error('This player was edited on another device. Close and reopen the editor to load the latest changes.');
    if(d.players!.some(p=>p.id!==player.id&&p.name.toLowerCase()===settings.name.toLowerCase()))throw new Error('This player name is already in use.');
    const updated={...current,...settings,settings_revision:(current.settings_revision??0)+1};
    const rivalries=d.rivalries.map(r=>{
      const members={a:sidePlayers(r,'a').map(p=>p.id===player.id?updated:p),b:sidePlayers(r,'b').map(p=>p.id===player.id?updated:p)};
      return {...r,members,player_a:members.a.map(p=>p.name).join(' and '),player_b:members.b.map(p=>p.name).join(' and ')};
    });
    this.write({...d,players:d.players!.map(p=>p.id===player.id?updated:p),rivalries});
  }
  async createTeamRivalry(a:string[],b:string[]):Promise<Rivalry> {
    const d=this.read();
    const resolve=(ids:string[])=>ids.map(id=>{const p=d.players!.find(p=>p.id===id);if(!p)throw new Error('Player not found. Refresh and try again.');return p;});
    const members={a:resolve(a),b:resolve(b)};validateRoster(members.a,members.b);
    const key=rosterKey(members.a,members.b);
    const duplicate=d.rivalries.find(r=>rosterKey(sidePlayers(r,'a'),sidePlayers(r,'b'))===key);
    if(duplicate)throw new Error(duplicate.deleted_at?'This rivalry is in the backlog. Restore it there.':'This rivalry already exists.');
    const r={id:crypto.randomUUID(),player_a:members.a.map(p=>p.name).join(' and '),player_b:members.b.map(p=>p.name).join(' and '),created_at:new Date().toISOString(),members};
    this.write({...d,rivalries:[...d.rivalries,r]});return r;
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
    if (old?.paused_at) throw new Error("Game is paused. Resume before editing or scoring.");
    if (old?.deleted_at) throw new Error("This game is in the backlog. Restore it before editing.");
    if (!d.rivalries.some((r) => r.id === g.rivalry_id && !r.deleted_at))
      throw new Error("This rivalry no longer exists.");
    if (
      !g.ended_at &&
      d.games.some(
        (x) => x.rivalry_id === g.rivalry_id && x.id !== g.id && !x.ended_at && !x.deleted_at,
      )
    )
      throw new Error(
        "This rivalry already has a live game. Resume it instead.",
      );
    if (g.ended_at && !g.goals.length)
      throw new Error("Score a goal before finishing, or discard this game.");
    const rivalry=d.rivalries.find(r=>r.id===g.rivalry_id)!;
    if(g.revision===0 && !g.lineup)g={...g,lineup:defaultLineup(rivalry)};
    if(g.lineup)validateLineup(g.lineup,rivalry);
    const goals=g.goals.map(goal=>{
      const previous=old?.goals.find(x=>x.id===goal.id);
      const lineup=goal.lineup??previous?.lineup??(!previous?g.lineup:null);
      if(lineup)validateLineup(lineup,rivalry);
      return lineup?{...goal,lineup}:goal;
    });
    const saved = { ...g, paused_at: old?.paused_at ?? null, paused_ms: old?.paused_ms ?? 0, goals, revision: g.revision + 1 };
    this.write({
      ...d,
      games: [...d.games.filter((x) => x.id !== g.id), saved],
    });
    return saved;
  }
  async setGamePaused(g: Game, paused: boolean) {
    const d = this.read(), old = this.checkedGame(d, g, false);
    if (old.ended_at) throw new Error('Finished games cannot be paused.');
    if (Boolean(old.paused_at) === paused) return old;
    const now = Math.max(Date.now(), Date.parse(old.started_at), ...old.goals.map(goal => Date.parse(goal.occurred_at)));
    const saved = {...old, revision: old.revision + 1,
      paused_at: paused ? new Date(now).toISOString() : null,
      paused_ms: (old.paused_ms ?? 0) + (!paused && old.paused_at ? Math.max(0, now - Date.parse(old.paused_at)) : 0)};
    this.write({...d, games: d.games.map(game => game.id === g.id ? saved : game)});
    return saved;
  }
  async discardGame(g: Game) {
    const d = this.read(),
      old = d.games.find((x) => x.id === g.id);
    if (!old || old.revision !== g.revision)
      throw new Error("This game changed. Refresh and try again.");
    if (old.deleted_at || d.rivalries.find(r=>r.id===old.rivalry_id)?.deleted_at) throw new Error("This game is in the backlog.");
    if (old.ended_at) throw new Error("Only live games can be discarded.");
    this.write({ ...d, games: d.games.filter((x) => x.id !== g.id) });
  }
  async loadBacklog(): Promise<BacklogData> {
    const d=this.read(), archived=new Set(d.rivalries.filter(r=>r.deleted_at).map(r=>r.id));
    const games=d.games.filter(g=>g.deleted_at||archived.has(g.rivalry_id));
    const parents=new Set(games.map(g=>g.rivalry_id));
    return {rivalries:d.rivalries.filter(r=>r.deleted_at||parents.has(r.id)),games};
  }
  private checkedGame(d:Data,g:Game,archived:boolean) {
    const old=d.games.find(x=>x.id===g.id);
    if(!old||old.revision!==g.revision)throw new Error('This game changed. Refresh and try again.');
    if(Boolean(old.deleted_at)!==archived)throw new Error(archived?'Only games in the backlog can be managed here.':'This game is in the backlog.');
    if(d.rivalries.find(r=>r.id===old.rivalry_id)?.deleted_at)throw new Error('Restore the rivalry first to manage this game.');
    return old;
  }
  async deleteGame(g:Game) {
    const d=this.read(),old=this.checkedGame(d,g,false);
    if(!old.ended_at)throw new Error('Only finished games can be moved to the backlog individually.');
    this.write({...d,games:d.games.map(x=>x.id===g.id?{...x,deleted_at:new Date().toISOString(),revision:x.revision+1}:x)});
  }
  async restoreGame(g:Game) {
    const d=this.read(),old=this.checkedGame(d,g,true);
    if(!old.ended_at&&d.games.some(x=>x.rivalry_id===old.rivalry_id&&x.id!==old.id&&!x.ended_at&&!x.deleted_at))throw new Error('This rivalry already has a live game. Finish or discard it before restoring this game.');
    this.write({...d,games:d.games.map(x=>x.id===g.id?{...x,deleted_at:null,revision:x.revision+1}:x)});
  }
  async purgeGame(g:Game) {
    const d=this.read();this.checkedGame(d,g,true);
    this.write({...d,games:d.games.filter(x=>x.id!==g.id)});
  }
  private checkedRivalry(d:Data,id:string,expected:Record<string,number>,archived:boolean,deletedAt?:string|null) {
    const r=d.rivalries.find(r=>r.id===id);
    if(!r)throw new Error('This rivalry no longer exists.');
    if(Boolean(r.deleted_at)!==archived)throw new Error(archived?'Only rivalries in the backlog can be managed here.':'This rivalry is in the backlog.');
    if(archived&&r.deleted_at!==deletedAt)throw new Error('This rivalry changed. Refresh and try again.');
    const games=d.games.filter(g=>g.rivalry_id===id&&(archived||!g.deleted_at));
    if(games.length!==Object.keys(expected).length||games.some(g=>expected[g.id]!==g.revision))throw new Error('This rivalry changed. Close the dialog and review its games.');
  }
  async deleteRivalry(id:string,expected:Record<string,number>) {
    const d=this.read();this.checkedRivalry(d,id,expected,false);
    this.write({...d,rivalries:d.rivalries.map(r=>r.id===id?{...r,deleted_at:new Date().toISOString()}:r),games:d.games.map(g=>g.rivalry_id===id?{...g,revision:g.revision+1}:g)});
  }
  async restoreRivalry(r:Rivalry,expected:Record<string,number>) {
    const d=this.read();this.checkedRivalry(d,r.id,expected,true,r.deleted_at);
    this.write({...d,rivalries:d.rivalries.map(x=>x.id===r.id?{...x,deleted_at:null}:x),games:d.games.map(g=>g.rivalry_id===r.id?{...g,revision:g.revision+1}:g)});
  }
  async purgeRivalry(r:Rivalry,expected:Record<string,number>) {
    const d=this.read();this.checkedRivalry(d,r.id,expected,true,r.deleted_at);
    this.write({...d,rivalries:d.rivalries.filter(x=>x.id!==r.id),games:d.games.filter(g=>g.rivalry_id!==r.id)});
  }
  async clear() {
    this.write({ rivalries: [], games: [] });
  }
}
