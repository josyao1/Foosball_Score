import { earnedAchievements } from './achievements';
import type { AchievementHistory, PlayerAchievements } from './achievements';
import { emptyMastery, advanceMastery } from './mastery';
import type { PlayerMastery } from './mastery';
import { gameHighlights } from './records';
import { creditedSide, score } from './stats';
import { RUNGS, otherSide, playerName } from './types';
import type { Game, Rivalry, Rung } from './types';

export const FINISH_TYPES = ['dunk', 'bank', 'combo', 'own_goal'] as const;
export type FinishType = typeof FINISH_TYPES[number];
export const FINISH_LABELS: Record<FinishType, string> = {dunk:'Dunk',bank:'Bank',combo:'Dunk + bank',own_goal:'Own goal'};
export const RUNG_LABELS: Record<Rung, string> = {goalie:'Goalie',defender:'Defender',middle:'Middle',attacker:'Attacker'};
interface Best { value: number; game: Game }
export interface PlayerPassport {
  mastery: PlayerMastery; achievements:PlayerAchievements; achievementHistory:AchievementHistory;
  key: string; name: string; played: number; wins: number; losses: number; draws: number;
  goals: number; playingMs: number; bestStreak: number; currentStreak: number;
  rungs: Record<Rung, number>; types: Record<FinishType, number>;
  favoriteRungs: Rung[]; signatureTypes: FinishType[];
  firstPlayed: string | null;
  recent: {game: Game; opponent: string; own: number; against: number; result: 'W'|'L'|'D'}[];
  bestRun: Best | null; bestComeback: Best | null; quickestWin: Best | null;
  rivals: {rivalry: Rivalry; played: number; wins: number; losses: number}[];
}
const keyFor = (name: string) => name.trim().toLowerCase();
const favorites = <T extends string>(keys: readonly T[], counts: Record<T, number>): T[] => {
  const max = Math.max(...keys.map(key => counts[key]));
  return max > 0 ? keys.filter(key => counts[key] === max) : [];
};

/** Participant labels are identities; doubles labels are never split or credited to individuals. */
export function playerPassports(games: Game[], rivalries: Rivalry[]): PlayerPassport[] {
  const people = new Map<string, PlayerPassport>();
  const byRivalry = new Map(rivalries.map(r => [r.id, r]));
  for (const rivalry of rivalries) for (const side of ['a','b'] as const) {
    const name = playerName(rivalry, side).trim(), key = keyFor(name);
    if (!key || people.has(key)) continue;
    people.set(key, { mastery:emptyMastery(), achievements:{}, achievementHistory:{}, key, name, played:0, wins:0, losses:0, draws:0, goals:0, playingMs:0, bestStreak:0, currentStreak:0,
      rungs:{goalie:0,defender:0,middle:0,attacker:0}, types:{dunk:0,bank:0,combo:0,own_goal:0},
      favoriteRungs:[], signatureTypes:[], recent:[], firstPlayed:null, bestRun:null, bestComeback:null, quickestWin:null, rivals:[] });
  }
  const completed = games.filter(g => g.ended_at).sort((a,b) => Date.parse(a.ended_at!) - Date.parse(b.ended_at!) || a.id.localeCompare(b.id));
  for (const game of completed) {
    const rivalry = byRivalry.get(game.rivalry_id);
    if (!rivalry || !keyFor(rivalry.player_a) || !keyFor(rivalry.player_b) || keyFor(rivalry.player_a) === keyFor(rivalry.player_b)) continue;
    const highlights = gameHighlights(game), final = score(game.goals);
    const runs = {a:0,b:0}, bestRuns = {a:0,b:0};
    for (const goal of highlights.goals) {
      const side = creditedSide(goal);
      runs[side]++; runs[otherSide(side)] = 0;
      bestRuns[side] = Math.max(bestRuns[side], runs[side]);
    }
    for (const side of ['a','b'] as const) {
      const p = people.get(keyFor(playerName(rivalry,side)))!;
      const result = final[side] > final[otherSide(side)] ? 'W' : final[side] < final[otherSide(side)] ? 'L' : 'D';
      p.played++;
      if (result === 'W') { p.wins++; p.currentStreak++; p.bestStreak = Math.max(p.bestStreak, p.currentStreak); }
      else { p.currentStreak = 0; if (result === 'L') p.losses++; else p.draws++; }
      if(p.currentStreak===5){
        p.achievements.streak ??= game;
        (p.achievementHistory.streak ??= []).push(game);
      }
      p.playingMs += highlights.totalMs;
      if (!p.firstPlayed || Date.parse(game.started_at) < Date.parse(p.firstPlayed)) p.firstPlayed = game.started_at;
      p.recent.push({game,opponent:playerName(rivalry,otherSide(side)),own:final[side],against:final[otherSide(side)],result});
      p.recent = p.recent.slice(-5);
      for (const goal of highlights.goals) {
        if (goal.actor_side !== side) continue;
        if (goal.flags.includes('own_goal')) { p.types.own_goal++; continue; }
        p.goals++; p.rungs[goal.rung]++;
        const type = goal.flags.includes('dunk') ? goal.flags.includes('bank') ? 'combo' : 'dunk' : goal.flags.includes('bank') ? 'bank' : null;
        if (type) p.types[type]++;
      }
      for (const achievement of earnedAchievements(game,side,highlights)) {
        p.achievements[achievement] ??= game;
        (p.achievementHistory[achievement] ??= []).push(game);
      }
      const actorGoals = highlights.goals.filter(g=>g.actor_side === side && !g.flags.includes('own_goal'));
      advanceMastery(p.mastery, {
        goals:actorGoals.length, wins:result === 'W' ? 1 : 0,
        dunks:actorGoals.filter(g=>g.flags.includes('dunk')).length,
        banks:actorGoals.filter(g=>g.flags.includes('bank')).length,
        goalie:actorGoals.filter(g=>g.rung==='goalie').length,
        defender:actorGoals.filter(g=>g.rung==='defender').length,
        middle:actorGoals.filter(g=>g.rung==='middle').length,
        attacker:actorGoals.filter(g=>g.rung==='attacker').length,
        allRungs:highlights.allRungs.includes(side) ? 1 : 0,
        recovery:result === 'W' && highlights.moments.quickest?.side === side && highlights.hadMatchPoint[otherSide(side)] ? 1 : 0,
      },game);
      if (bestRuns[side] > (p.bestRun?.value ?? 0)) p.bestRun = {value:bestRuns[side],game};
      const comeback = highlights.moments.comeback;
      if (comeback?.side === side && (!p.bestComeback || comeback.value > p.bestComeback.value || (comeback.value === p.bestComeback.value && comeback.start > gameHighlights(p.bestComeback.game).moments.comeback!.start))) p.bestComeback = {value:comeback.value,game};
      const quickest = highlights.moments.quickest;
      if (quickest?.side === side && (!p.quickestWin || quickest.value < p.quickestWin.value)) p.quickestWin = {value:quickest.value,game};
      let rival = p.rivals.find(entry => entry.rivalry.id === rivalry.id);
      if (!rival) { rival = {rivalry,played:0,wins:0,losses:0}; p.rivals.push(rival); }
      rival.played++; if (result === 'W') rival.wins++; if (result === 'L') rival.losses++;
    }
  }
  for (const p of people.values()) {
    p.favoriteRungs = favorites(RUNGS,p.rungs);
    p.signatureTypes = favorites(FINISH_TYPES,p.types);
    p.rivals.sort((a,b) => b.played-a.played || a.rivalry.id.localeCompare(b.rivalry.id));
  }
  return [...people.values()].sort((a,b) => b.played-a.played || a.name.localeCompare(b.name));
}
