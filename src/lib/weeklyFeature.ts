import { rankedClassics } from './hallOfFame';
import { score, winner } from './stats';
import { sidePlayers } from './participants';
import type { Game, Rivalry } from './types';

export interface WeeklySettings {
  revision: number;
  enabled: boolean;
  weekday: number;
  override_week: string | null;
  rivalry_id: string | null;
  game_id: string | null;
}
export const DEFAULT_WEEKLY_SETTINGS: WeeklySettings = { revision: 0, enabled: true, weekday: 5, override_week: null, rivalry_id: null, game_id: null };
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ZONE = 'America/Los_Angeles';
const DAY = 86_400_000;
export function pacificDay(now: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function shiftDay(day: string, delta: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + delta * DAY).toISOString().slice(0, 10);
}
export function pacificMidnight(day: string) {
  const noon = Date.parse(`${day}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, timeZoneName: 'shortOffset' })
    .formatToParts(noon).find(p => p.type === 'timeZoneName')!.value;
  const match = offset.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const minutes = match ? (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === '-' ? -1 : 1) : 0;
  // Noon already reflects a DST transition on Sunday. Iterate from the candidate
  // midnight to obtain the offset at midnight itself.
  let result = Date.parse(`${day}T00:00:00Z`) - minutes * 60_000;
  for (let i = 0; i < 2; i++) {
    const local = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(result);
    const get = (type: string) => local.find(p => p.type === type)!.value;
    const localMs = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00Z`);
    result += Date.parse(`${day}T00:00:00Z`) - localMs;
  }
  return result;
}
export function leagueWeek(now: number, weekday = 5) {
  const today = pacificDay(now);
  const dayOfWeek = new Date(`${today}T12:00:00Z`).getUTCDay();
  const key = shiftDay(today, -((dayOfWeek + 6) % 7));
  const featureDay = shiftDay(key, (weekday + 6) % 7);
  return { key, start: pacificMidnight(key), end: pacificMidnight(shiftDay(key, 7)), featureDay, isFeatureDay: today === featureDay };
}
export function validateWeeklySettings(settings: WeeklySettings) {
  if (typeof settings.enabled !== 'boolean' || !Number.isInteger(settings.weekday) || settings.weekday < 0 || settings.weekday > 6
    || !Number.isInteger(settings.revision) || settings.revision < 0) throw new Error('Choose a valid feature day.');
  if (settings.override_week !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(settings.override_week)
    || !Number.isFinite(Date.parse(`${settings.override_week}T12:00:00Z`))
    || new Date(`${settings.override_week}T12:00:00Z`).toISOString().slice(0, 10) !== settings.override_week
    || new Date(`${settings.override_week}T12:00:00Z`).getUTCDay() !== 1)) throw new Error('Choose a valid league week.');
  if ([settings.rivalry_id, settings.game_id].some(id => id !== null && (typeof id !== 'string' || !id.trim() || id.length > 128))) throw new Error('Choose a valid matchup or game.');
  if ((settings.rivalry_id || settings.game_id) && !settings.override_week) throw new Error('Weekly picks need a league week.');
}

export function weeklyFeature(games: Game[], rivalries: Rivalry[], settings = DEFAULT_WEEKLY_SETTINGS, now = Date.now()) {
  const week = leagueWeek(now, settings.weekday);
  const classics = rankedClassics(games.filter(g => g.ended_at && Date.parse(g.ended_at) <= now), rivalries);
  const weekGames = classics.filter(entry => Date.parse(entry.game.ended_at!) >= week.start && Date.parse(entry.game.ended_at!) < week.end);
  const overrides = settings.override_week === week.key;
  const best = (overrides && settings.game_id ? weekGames.find(e => e.game.id === settings.game_id) : undefined) ?? weekGames[0] ?? null;
  // Freeze the evidence at Monday. Fresh leagues can still build a first pick.
  const prior = classics.filter(e => Date.parse(e.game.ended_at!) < week.start);
  const source = prior.length ? prior : classics;
  const cutoff = prior.length ? week.start : now;
  const liveRivalries = new Set(games.filter(g => !g.ended_at && !g.deleted_at).map(g => g.rivalry_id));
  const availableRivalries = new Map(rivalries.filter(r => !r.deleted_at).map(r => [r.id,r]));
  const finished = games.filter(g => !g.deleted_at && g.ended_at && Date.parse(g.ended_at) <= now && availableRivalries.has(g.rivalry_id));
  const activePlayers = new Set(finished.filter(g => Date.parse(g.ended_at!) >= now - 30 * DAY).flatMap(g => {
    const r = availableRivalries.get(g.rivalry_id)!;
    return [...sidePlayers(r,'a'),...sidePlayers(r,'b')].map(p => p.id);
  }));
  const candidates = rivalries.filter(r => !r.deleted_at).flatMap(rivalry => {
    if (liveRivalries.has(rivalry.id)) return [];
    if ([...sidePlayers(rivalry,'a'),...sidePlayers(rivalry,'b')].some(p => !activePlayers.has(p.id))) return [];
    const recent = source.filter(e => e.rivalry.id === rivalry.id && Date.parse(e.game.ended_at!) >= cutoff - 90 * DAY)
      .sort((a, b) => Date.parse(b.game.ended_at!) - Date.parse(a.game.ended_at!)).slice(0, 8);
    if (!recent.length) return [];
    const count = recent.length;
    const close = recent.filter(e => { const s = score(e.game.goals); return Math.abs(s.a - s.b) <= 2; }).length;
    const winsA = recent.filter(e => winner(e.game) === 'a').length;
    const avg = recent.reduce((n, e) => n + e.rating.total, 0) / count;
    const balance = 1 - Math.abs(winsA - (count - winsA)) / count;
    const confidence = count / (count + 2);
    const lastPlayed = Math.max(...finished.filter(g => g.rivalry_id === rivalry.id).map(g => Date.parse(g.ended_at!)));
    const daysSincePlayed = Math.max(0, (now - lastPlayed) / DAY);
    const cooldownPenalty = daysSincePlayed < 1 ? 45 : daysSincePlayed < 3 ? 30 : daysSincePlayed < 7 ? 15 : 0;
    const rating = confidence * (40 * Math.min(avg / 100, 1) + 25 * close / count + 20 * balance) + 5 * Math.min(count / 8, 1) - cooldownPenalty;
    return [{ rivalry, rating, count, close, winsA, winsB: count - winsA, averageIntensity: avg, daysSincePlayed, cooldownPenalty }];
  }).sort((a, b) => b.rating - a.rating || a.rivalry.id.localeCompare(b.rivalry.id));
  const pool = candidates.filter(c => c.rating >= (candidates[0]?.rating ?? 0) - 5);
  const weekNumber = Math.floor(Date.parse(`${week.key}T12:00:00Z`) / (7 * DAY));
  const automatic = pool.length ? pool[weekNumber % pool.length] : null;
  const manualRivalry = overrides && settings.rivalry_id ? rivalries.find(r => r.id === settings.rivalry_id && !r.deleted_at) : null;
  const matchup = manualRivalry ?? automatic?.rivalry ?? null;
  const evidence = matchup ? candidates.find(c => c.rivalry.id === matchup.id) ?? null : null;
  return { week, best, weekGames, candidates, matchup, evidence, manualMatchup: !!manualRivalry, manualGame: !!best && overrides && settings.game_id === best.game.id };
}

/** Keep score order while reserving four of ten suggestions for singles. */
export function matchupShortlist(candidates: ReturnType<typeof weeklyFeature>['candidates']) {
  const ranked = [...candidates].sort((a,b) => b.rating-a.rating || a.rivalry.id.localeCompare(b.rivalry.id));
  const singles = ranked.filter(c => sidePlayers(c.rivalry,'a').length === 1 && sidePlayers(c.rivalry,'b').length === 1);
  const selected = new Set(singles.slice(0,4).map(c => c.rivalry.id));
  for (const candidate of ranked) {
    if (selected.size >= 10) break;
    selected.add(candidate.rivalry.id);
  }
  return ranked.filter(c => selected.has(c.rivalry.id));
}
