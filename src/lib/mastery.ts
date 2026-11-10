import type { Game } from './types';

export const MASTERY = [
  {id:'goals',label:'Goal scorer',unit:'goals scored',thresholds:[10,100,250,500,2000]},
  {id:'wins',label:'Winning proficiency',unit:'wins',thresholds:[1,15,30,60,240]},
  {id:'dunks',label:'Dunk proficiency',unit:'dunk goals',thresholds:[5,15,30,60,240]},
  {id:'banks',label:'Bank proficiency',unit:'bank goals',thresholds:[5,15,30,60,240]},
  {id:'goalie',label:'Goalie proficiency',unit:'goalie goals',thresholds:[10,25,50,100,400]},
  {id:'defender',label:'Defender proficiency',unit:'defender goals',thresholds:[10,25,50,100,400]},
  {id:'middle',label:'Middle proficiency',unit:'middle goals',thresholds:[10,25,50,100,400]},
  {id:'attacker',label:'Attacker proficiency',unit:'attacker goals',thresholds:[10,25,50,100,400]},
  {id:'allRungs',label:'All four rungs mastered',unit:'games scoring from all four rungs',thresholds:[1,3,5,10,40]},
  {id:'recovery',label:'Match-point recovery',unit:'wins after facing match point',thresholds:[1,3,5,10,40]},
] as const;
export const TIERS = ['Bronze','Silver','Gold','Platinum','Amethyst'] as const;
export type MasteryId = typeof MASTERY[number]['id'];
export interface MasteryProgress {count:number; earned:Game[]}
export type PlayerMastery = Record<MasteryId,MasteryProgress>;
export const emptyMastery = () => MASTERY.reduce((progress,badge)=>{
  progress[badge.id]={count:0,earned:[]};
  return progress;
},{} as PlayerMastery);
/** Called in completion order so each tier retains the game that first earned it. */
export function advanceMastery(progress:PlayerMastery, increments:Record<MasteryId,number>, game:Game) {
  for (const badge of MASTERY) {
    const state=progress[badge.id];
    state.count+=increments[badge.id];
    badge.thresholds.forEach((threshold,index)=>{
      if (state.count>=threshold && !state.earned[index]) state.earned[index]=game;
    });
  }
}
