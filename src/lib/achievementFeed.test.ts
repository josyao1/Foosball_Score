import { expect,it } from 'vitest';
import { recentAchievements,ACHIEVEMENT_FEED_WINDOW } from './achievementFeed';
import type { Game } from './types';
const now=Date.parse('2026-11-03T20:00:00Z');
const game=(id:string,age:number):Game=>({id,rivalry_id:'r',revision:1,started_at:'2026-11-03T00:00:00Z',ended_at:new Date(now-age).toISOString(),goals:[]});
it('keeps older unlocks, groups badges by player and game, and caps the newest entries at three',()=>{
 const latest=game('latest',1000),old=game('old',ACHIEVEMENT_FEED_WINDOW+1);
 const entries=recentAchievements([
  {key:'josh',name:'Josh',achievements:{dunk:latest,bank:latest,perfect:old,speed:game('oldest',2*ACHIEVEMENT_FEED_WINDOW)}},
  {key:'brooks',name:'Brooks',achievements:{gift:game('second',2000)}},
 ],now);
 expect(entries.map(e=>e.game.id)).toEqual(['latest','second','old']);
 expect(entries[0].badges.map(b=>b.id)).toEqual(['dunk','bank']);
 expect(entries.map(e=>e.recent)).toEqual([true,true,false]);
});
it('drops recent emphasis at exactly twelve hours without dropping the entry',()=>{
 const players=[{key:'j',name:'Josh',achievements:{dunk:game('g',ACHIEVEMENT_FEED_WINDOW-1)}}];
 expect(recentAchievements(players,now)[0].recent).toBe(true);
 expect(recentAchievements(players,now+1)[0].recent).toBe(false);
});
it('ignores invalid, unfinished, and future timestamps and separates players sharing a game',()=>{
 const shared=game('g',1000);
 const entries=recentAchievements([
  {key:'j',name:'Josh',achievements:{dunk:shared,bank:{...shared,ended_at:'bad'},speed:{...shared,ended_at:null},perfect:game('future',-1)}},
  {key:'b',name:'Brooks',achievements:{gift:shared}},
 ],now);
 expect(entries).toHaveLength(2);
 expect(entries.map(e=>e.badges.map(b=>b.id))).toEqual([['gift'],['dunk']]);
 expect(recentAchievements([],now)).toEqual([]);
});
