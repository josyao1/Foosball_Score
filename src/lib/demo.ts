import type { Data, Game, Side } from "./types";
export function createDemoData(): Data {
  const rivalryId = crypto.randomUUID(),
    secondId = crypto.randomUUID();
  const makeGame = (seq: string, daysAgo: number, rid = rivalryId): Game => {
    const started = Date.now() - daysAgo * 86400000;
    let elapsed = 0;
    return {
      id: crypto.randomUUID(),
      rivalry_id: rid,
      started_at: new Date(started).toISOString(),
      ended_at: new Date(started + seq.length * 27000 + 17000).toISOString(),
      revision: 1,
      goals: [...seq].map((side, i) => {
        elapsed += 19000 + (i % 4) * 5000;
        return {
          id: crypto.randomUUID(),
          actor_side: side as Side,
          rung: (
            ["attacker", "middle", "attacker", "defender", "goalie"] as const
          )[i % 5],
          flags: i % 9 === 4 ? ["dunk"] : i % 7 === 2 ? ["bank"] : [],
          elapsed_ms: elapsed,
          occurred_at: new Date(started + elapsed).toISOString(),
        };
      }),
    };
  };
  return {
    rivalries: [
      {
        id: rivalryId,
        player_a: "Brooks",
        player_b: "Josh",
        created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      },
      {
        id: secondId,
        player_a: "Josh",
        player_b: "Alex",
        created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      },
    ],
    games: [
      makeGame("ababaaaabaaaab", 12),
      makeGame("bbababbabbabbb", 10),
      makeGame("aaaabbbbabbbabbbb", 7),
      makeGame("abaaabaabaaabaaa", 4),
      makeGame("ababaababaaaabaa", 2),
      makeGame("aaabaabaaabaaaa", 1),
      makeGame("abababbbaabbbbbbb", 5, secondId),
    ],
  };
}
