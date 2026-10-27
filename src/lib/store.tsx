import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Data, Game } from "./types";
import { LocalRepository } from "./storage";
import type { Repository } from "./storage";
import { cloudConfigured, createCloudRepository } from "./supabase";
function useDataStore() {
  const [data, setData] = useState<Data>({ rivalries: [], games: [] }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const repo = useRef<Repository | null>(null),
    locked = useRef(false),
    generation = useRef(0);
  const getRepo = useCallback(() => {
    if (!repo.current)
      repo.current = cloudConfigured
        ? createCloudRepository()
        : new LocalRepository(localStorage);
    return repo.current;
  }, []);
  const refresh = useCallback(async () => {
    if (locked.current) return;
    const gen = ++generation.current;
    try {
      const d = await getRepo().load();
      if (gen === generation.current) {
        setData(d);
        setError("");
      }
    } catch (e) {
      if (gen === generation.current)
        setError(e instanceof Error ? e.message : "Could not load scores.");
    } finally {
      setLoading(false);
    }
  }, [getRepo]);
  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 8000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, [refresh]);
  async function mutate<T>(
    fn: (repo: Repository) => Promise<T>,
    apply: (old: Data, result: T) => Data,
  ): Promise<T> {
    if (locked.current) throw new Error("A save is already in progress.");
    locked.current = true;
    generation.current++;
    setBusy(true);
    setError("");
    try {
      const result = await fn(getRepo());
      setData((old) => apply(old, result));
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      try {
        setData(await getRepo().load());
      } catch {
        /* Keep existing data and original error. */
      }
      throw e;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    ...data,
    loading,
    busy,
    error,
    cloud: cloudConfigured,
    refresh,
    createRivalry: (a: string, b: string) =>
      mutate(
        (r) => r.createRivalry(a, b),
        (d, r) => ({ ...d, rivalries: [...d.rivalries, r] }),
      ),
    saveGame: (g: Game) =>
      mutate(
        (r) => r.saveGame(g),
        (d, s) => ({
          ...d,
          games: [...d.games.filter((x) => x.id !== s.id), s],
        }),
      ),
    discardGame: (g: Game) =>
      mutate(
        (r) => r.discardGame(g),
        (d) => ({ ...d, games: d.games.filter((x) => x.id !== g.id) }),
      ),
    deleteGame:(g:Game)=>mutate(r=>r.deleteGame(g),d=>({...d,games:d.games.filter(x=>x.id!==g.id)})),
    deleteRivalry:(id:string,expectedGames:Record<string,number>)=>mutate(r=>r.deleteRivalry(id,expectedGames),d=>({rivalries:d.rivalries.filter(r=>r.id!==id),games:d.games.filter(g=>g.rivalry_id!==id)})),
    clearDemo: () =>
      mutate(
        async (r) => {
          if (r instanceof LocalRepository) await r.clear();
        },
        () => ({ rivalries: [], games: [] }),
      ),
  };
}
const Context = createContext<ReturnType<typeof useDataStore> | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useDataStore();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useStore() {
  const context = useContext(Context);
  if (!context) throw new Error("Store provider missing");
  return context;
}
