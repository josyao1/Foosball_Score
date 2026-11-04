import { ACHIEVEMENTS } from './achievements';
import type { PlayerPassport } from './players';
import type { Game } from './types';
export const ACHIEVEMENT_FEED_WINDOW=12*60*60*1000;
export interface AchievementFeedEntry {
  playerKey:string;name:string;game:Game;earnedAt:number;recent:boolean;
  badges:(typeof ACHIEVEMENTS[number])[];
}
/** Only a player's first unlock qualifies; repeat performances do not renew an alert. */
export function recentAchievements(players:Pick<PlayerPassport,'key'|'name'|'achievements'>[],now:number):AchievementFeedEntry[]{
  const entries:AchievementFeedEntry[]=[];
  for(const player of players){
    const byGame=new Map<string,AchievementFeedEntry>();
    for(const badge of ACHIEVEMENTS){
      const game=player.achievements[badge.id];
      if(!game?.ended_at)continue;
      const earnedAt=Date.parse(game.ended_at),age=now-earnedAt;
      if(!Number.isFinite(earnedAt) || age<0)continue;
      let entry=byGame.get(game.id);
      if(!entry){entry={playerKey:player.key,name:player.name,game,earnedAt,recent:age<ACHIEVEMENT_FEED_WINDOW,badges:[]};byGame.set(game.id,entry);}
      entry.badges.push(badge);
    }
    entries.push(...byGame.values());
  }
  return entries.sort((a,b)=>b.earnedAt-a.earnedAt || a.name.localeCompare(b.name) || a.game.id.localeCompare(b.game.id)).slice(0,3);
}
