import { createClient } from "@supabase/supabase-js";
import type { Game, Data } from "./types";
import type { Repository } from "./storage";
import { validateNames } from "./storage";
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const cloudConfigured = Boolean(url && key);
export function createCloudRepository(): Repository {
  const client = createClient(url!, key!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  function fail(error: { message: string; code?: string } | null) {
    if (error)
      throw new Error(
        error.code === "23505"
          ? "This rivalry or live game already exists. Refresh to see it."
          : error.message,
      );
  }
  return {
    async load() {
      const { data, error } = await client.rpc("foos_load_state");
      fail(error);
      return data as Data;
    },
    async createRivalry(a, b) {
      validateNames(a, b);
      const { data, error } = await client
        .from("foos_rivalries")
        .insert({ player_a: a.trim(), player_b: b.trim() })
        .select()
        .single();
      fail(error);
      return data;
    },
    async saveGame(game: Game) {
      const { data, error } = await client.rpc("foos_save_game", {
        p_id: game.id,
        p_rivalry_id: game.rivalry_id,
        p_started_at: game.started_at,
        p_ended_at: game.ended_at,
        p_expected_revision: game.revision,
        p_goals: game.goals.map(
          ({ id, actor_side, rung, flags, elapsed_ms, occurred_at }) => ({
            id,
            actor_side,
            rung,
            flags,
            elapsed_ms,
            occurred_at,
          }),
        ),
      });
      fail(error);
      return { ...game, revision: data as number };
    },
    async deleteGame(game){const {error}=await client.rpc('foos_delete_game',{p_id:game.id,p_expected_revision:game.revision});fail(error)},
    async deleteRivalry(id,expectedGames){const {error}=await client.rpc('foos_delete_rivalry',{p_id:id,p_expected_games:expectedGames});fail(error)},
    async discardGame(game) {
      const { error } = await client.rpc("foos_discard_game", {
        p_id: game.id,
        p_expected_revision: game.revision,
      });
      fail(error);
    },
  };
}
