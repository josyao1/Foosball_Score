import { hasDistinctSides, allPlayers, goalCredit, goalPlayer, sidePlayers } from './participants';
import { earnedAchievements, hardCarryWinner, lunchBreakPlayers } from './achievements';
import type { AchievementHistory, PlayerAchievements } from './achievements';
import { emptyMastery, advanceMastery } from './mastery';
import type { PlayerMastery } from './mastery';
import { gameHighlights } from './records';
import { creditedSide, score } from './stats';
import { RUNGS, otherSide, playerName } from './types';
import type { Game, Rivalry, Rung, Player } from './types';

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
  recent: {game: Game; opponent: string; teammates: string[]; own: number; against: number; result: 'W'|'L'|'D'}[];
  bestRun: Best | null; bestComeback: Best | null; quickestWin: Best | null;
  rivals: {rivalry: Rivalry; played: number; wins: number; losses: number}[];
}
const favorites = <T extends string>(keys: readonly T[], counts: Record<T, number>): T[] => {
  const max = Math.max(...keys.map(key => counts[key]));
  return max > 0 ? keys.filter(key => counts[key] === max) : [];
};

/** Individual passports; historical team contributions remain fractional until totals are displayed. */
export function playerPassports(games: Game[], rivalries: Rivalry[], registry:Player[]=[]): PlayerPassport[] {
  const people = new Map<string, PlayerPassport>();
  const byRivalry = new Map(rivalries.map(r => [r.id, r]));
  for (const player of allPlayers(rivalries,registry)) {
    const name = player.name, key = player.id;
    if (!key || people.has(key)) continue;
    people.set(key, { mastery:emptyMastery(), achievements:{}, achievementHistory:{}, key, name, played:0, wins:0, losses:0, draws:0, goals:0, playingMs:0, bestStreak:0, currentStreak:0,
      rungs:{goalie:0,defender:0,middle:0,attacker:0}, types:{dunk:0,bank:0,combo:0,own_goal:0},
      favoriteRungs:[], signatureTypes:[], recent:[], firstPlayed:null, bestRun:null, bestComeback:null, quickestWin:null, rivals:[] });
  }
  const lunchBreaks = lunchBreakPlayers(games,rivalries);
  const completed = games.filter(g => g.ended_at).sort((a,b) => Date.parse(a.ended_at!) - Date.parse(b.ended_at!) || a.id.localeCompare(b.id));
  for (const game of completed) {
    const rivalry = byRivalry.get(game.rivalry_id);
    if (!rivalry || !hasDistinctSides(rivalry)) continue;
    const highlights = gameHighlights(game), final = score(game.goals);
    const carry = hardCarryWinner(game, rivalry, highlights);
    const runs = {a:0,b:0}, bestRuns = {a:0,b:0};
    for (const goal of highlights.goals) {
      const side = creditedSide(goal);
      runs[side]++; runs[otherSide(side)] = 0;
      bestRuns[side] = Math.max(bestRuns[side], runs[side]);
    }
    for (const side of ['a','b'] as const) for(const member of sidePlayers(rivalry,side)) {
      const p = people.get(member.id)!;
      const result = final[side] > final[otherSide(side)] ? 'W' : final[side] < final[otherSide(side)] ? 'L' : 'D';
      p.played++;
      if (result === 'W') { p.wins++; p.currentStreak++; p.bestStreak = Math.max(p.bestStreak, p.currentStreak); }
      else { p.currentStreak = 0; if (result === 'L') p.losses++; else p.draws++; }
      if(p.currentStreak===5){
        p.achievements.streak ??= game;
        (p.achievementHistory.streak ??= []).push(game);
      }
      if(lunchBreaks.get(game.id)?.some(person=>person.id===member.id)){
        p.achievements.lunchBreak ??= game;
        (p.achievementHistory.lunchBreak ??= []).push(game);
      }
      p.playingMs += highlights.totalMs;
      if (!p.firstPlayed || Date.parse(game.started_at) < Date.parse(p.firstPlayed)) p.firstPlayed = game.started_at;
      p.recent.push({game,opponent:playerName(rivalry,otherSide(side)),teammates:sidePlayers(rivalry,side).filter(player=>player.id!==member.id).map(player=>player.name),own:final[side],against:final[otherSide(side)],result});
      p.recent = p.recent.slice(-5);
      for (const goal of highlights.goals) {
        if (goal.actor_side !== side) continue;
        const credit=goalCredit(goal,rivalry,member.id);
        if (goal.flags.includes('own_goal')) { p.types.own_goal+=credit; continue; }
        p.goals+=credit; p.rungs[goal.rung]+=credit;
        const type = goal.flags.includes('dunk') ? goal.flags.includes('bank') ? 'combo' : 'dunk' : goal.flags.includes('bank') ? 'bank' : null;
        if (type) p.types[type]+=credit;
      }
      const earned = earnedAchievements(game,side,highlights,rivalry);
      if (carry?.player.id === member.id) earned.push('hardCarry');
      for (const achievement of earned) {
        p.achievements[achievement] ??= game;
        (p.achievementHistory[achievement] ??= []).push(game);
      }
      const actorGoals = highlights.goals.filter(g=>g.actor_side === side && !g.flags.includes('own_goal'));
      advanceMastery(p.mastery, {
        goals:actorGoals.reduce((n,g)=>n+goalCredit(g,rivalry,member.id),0), wins:result === 'W' ? 1 : 0,
        dunks:actorGoals.filter(g=>g.flags.includes('dunk')).reduce((n,g)=>n+goalCredit(g,rivalry,member.id),0),
        banks:actorGoals.filter(g=>g.flags.includes('bank')).reduce((n,g)=>n+goalCredit(g,rivalry,member.id),0),
        goalie:actorGoals.filter(g=>g.rung==='goalie').reduce((n,g)=>n+goalCredit(g,rivalry,member.id),0),
        defender:actorGoals.filter(g=>g.rung==='defender').reduce((n,g)=>n+goalCredit(g,rivalry,member.id),0),
        middle:actorGoals.filter(g=>g.rung==='middle').reduce((n,g)=>n+goalCredit(g,rivalry,member.id),0),
        attacker:actorGoals.filter(g=>g.rung==='attacker').reduce((n,g)=>n+goalCredit(g,rivalry,member.id),0),
        allRungs:RUNGS.every(r=>actorGoals.some(g=>g.rung===r&&goalPlayer(g,rivalry)===member.id)) ? 1 : 0,
        recovery:result === 'W' && highlights.moments.quickest?.side === side && highlights.hadMatchPoint[otherSide(side)] ? 1 : 0,
      },game);
      if (sidePlayers(rivalry,'a').length === 1 && sidePlayers(rivalry,'b').length === 1) {
        if (bestRuns[side] > (p.bestRun?.value ?? 0)) p.bestRun = {value:bestRuns[side],game};
        const comeback = highlights.moments.comeback;
        if (comeback?.side === side && (!p.bestComeback || comeback.value > p.bestComeback.value || (comeback.value === p.bestComeback.value && comeback.start > gameHighlights(p.bestComeback.game).moments.comeback!.start))) p.bestComeback = {value:comeback.value,game};
        const quickest = highlights.moments.quickest;
        if (quickest?.side === side && (!p.quickestWin || quickest.value < p.quickestWin.value)) p.quickestWin = {value:quickest.value,game};
      }
      let rival = p.rivals.find(entry => entry.rivalry.id === rivalry.id);
      if (!rival) { rival = {rivalry,played:0,wins:0,losses:0}; p.rivals.push(rival); }
      rival.played++; if (result === 'W') rival.wins++; if (result === 'L') rival.losses++;
    }
  }
  for (const p of people.values()) {
    p.goals=Math.floor(p.goals);
    for(const rung of RUNGS)p.rungs[rung]=Math.floor(p.rungs[rung]);
    for(const type of FINISH_TYPES)p.types[type]=Math.floor(p.types[type]);
    for(const progress of Object.values(p.mastery))progress.count=Math.floor(progress.count);
    p.favoriteRungs = favorites(RUNGS,p.rungs);
    p.signatureTypes = favorites(FINISH_TYPES,p.types);
    p.rivals.sort((a,b) => b.played-a.played || a.rivalry.id.localeCompare(b.rivalry.id));
  }
  return [...people.values()].sort((a,b) => b.played-a.played || a.name.localeCompare(b.name));
}
