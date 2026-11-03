import { gameHighlights } from './records';
import { clock } from './stats';
import { otherSide, playerName } from './types';
import type { Game, Rivalry } from './types';

export interface ClassicFactor { label: string; points: number; max: number; detail: string }
const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
export const ratingLabel = (n: number) => n.toFixed(1);

export function classicScore(game: Game) {
  const highlights = gameHighlights(game);
  if (!highlights.moments.quickest) return null;
  const { scores, goals, moments, leadChanges, totalMs, hadMatchPoint } = highlights;
  const close = scores.slice(1).filter(s => Math.abs(s.a - s.b) <= 2).length;
  const comeback = moments.comeback;
  const deficitScore = comeback ? scores[comeback.start + 1] : null;
  const late = !!(comeback?.side && deficitScore && deficitScore[otherSide(comeback.side)] >= 9);
  const specials = goals.filter(g => !g.flags.includes('own_goal') && (g.flags.includes('dunk') || g.flags.includes('bank'))).length;
  const bothMatchPoint = hadMatchPoint.a && hadMatchPoint.b;
  const final = scores.at(-1)!;
  const margin = Math.abs(final.a - final.b);
  const factors: ClassicFactor[] = [
    { label: 'Close finish', max: 20, points: clamp(20 - (margin - 2) * 4, 20), detail: `${margin}-goal winning margin. 20 points for a 2-goal finish, minus 4 per extra goal; 0 at 7 or more.` },
    { label: 'Closeness', max: 20, points: 20 * close / goals.length, detail: `${close} of ${goals.length} after-goal scores were within 2 goals. That share × 20.` },
    { label: 'Lead changes', max: 15, points: clamp(leadChanges * 3, 15), detail: `${leadChanges} lead changes × 3 points, capped at 15. Ties don’t count as changes.` },
    { label: 'Winning comeback', max: 20, points: clamp((comeback?.value ?? 0) * 3, 15) + (late ? 5 : 0), detail: `${comeback?.value ?? 0}-goal deficit recovered × 3, capped at 15; ${late ? '+5' : 'no bonus'} for recovering that deficit with the opponent at 9+.` },
    { label: 'Total goals', max: 10, points: clamp((goals.length - 10) / 18 * 10, 10), detail: `${goals.length} goals. Scales from 0 points at 10 goals to 10 at 28.` },
    { label: 'Special goals', max: 5, points: clamp(specials, 5), detail: `${specials} dunk or bank goals × 1 point, capped at 5. Combos count once; own goals don’t count.` },
    { label: 'Game length', max: 5, points: clamp(totalMs / 60000 * .5, 5), detail: `${clock(totalMs)} through the final goal. Half a point per minute, capped at 5.` },
    { label: 'Match-point drama', max: 5, points: bothMatchPoint ? 5 : 0, detail: bothMatchPoint ? 'Both sides were one goal away from a valid win: +5.' : '5 points when both sides hold match point during the game.' },
  ];
  return { total: factors.reduce((sum, f) => sum + f.points, 0), factors, highlights, specials, deficitScore, bothMatchPoint };
}

export function rankedClassics(games: Game[], rivalries: Rivalry[]) {
  const byId = new Map(rivalries.map(r => [r.id, r]));
  return games.flatMap(game => {
    const rivalry = byId.get(game.rivalry_id);
    if (!rivalry) return [];
    const rating = classicScore(game);
    if (!rating) return [];
    const captions: string[] = [];
    const comeback = rating.highlights.moments.comeback;
    if (rating.bothMatchPoint) captions.push('Both held match point');
    if (comeback?.side && rating.deficitScore) {
      const side = comeback.side, s = rating.deficitScore;
      if (comeback.value >= 2) captions.push(`${playerName(rivalry, side)} recovered from ${s[side]}–${s[otherSide(side)]}`);
    }
    if (rating.highlights.leadChanges >= 2) captions.push(`${rating.highlights.leadChanges} lead changes`);
    if (rating.specials >= 2) captions.push(`${rating.specials} special goals`);
    if (!captions.length) captions.push(`${rating.highlights.goals.length} goals in ${clock(rating.highlights.totalMs)}`);
    return [{ game, rivalry, rating, captions: captions.slice(0, 3) }];
  }).sort((a, b) => b.rating.total - a.rating.total || Date.parse(a.game.started_at) - Date.parse(b.game.started_at) || a.game.id.localeCompare(b.game.id));
}
export type RankedClassic = ReturnType<typeof rankedClassics>[number];
