import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_WEEKLY_SETTINGS, leagueWeek, pacificMidnight, weeklyFeature, matchupShortlist } from './weeklyFeature';
import { LocalRepository } from './storage';
import type { Game, Rivalry } from './types';
const now = Date.parse('2026-11-20T20:00:00Z');
const r: Rivalry = {id:'r',player_a:'Josh',player_b:'Brooks',created_at:'2026-01-01'};
const other: Rivalry = {id:'s',player_a:'Andrew',player_b:'Frank',created_at:'2026-01-01'};
function game(id: string, rival = 'r', ended = '2026-11-10T20:00:00Z', sequence = 'ab'.repeat(8)+'aa'): Game {
  return {id,rivalry_id:rival,revision:1,started_at:new Date(Date.parse(ended)-600_000).toISOString(),ended_at:ended,
    goals:[...sequence].map((side,i)=>({id:`${id}-${i}`,actor_side:side==='a'?'a':'b',rung:'attacker',flags:[],elapsed_ms:(i+1)*20_000,occurred_at:ended}))};
}
afterEach(() => vi.useRealTimers());

it('uses Pacific Monday boundaries and the configured popup day', () => {
  expect(leagueWeek(Date.parse('2026-11-16T07:59:59Z')).key).toBe('2026-11-09');
  expect(leagueWeek(Date.parse('2026-11-16T08:00:00Z')).key).toBe('2026-11-16');
  expect(leagueWeek(now)).toMatchObject({key:'2026-11-16',featureDay:'2026-11-20',isFeatureDay:true});
  expect(leagueWeek(now,3)).toMatchObject({featureDay:'2026-11-18',isFeatureDay:false});
});
it('handles daylight saving weeks rather than assuming seven 24-hour days', () => {
  const spring=leagueWeek(Date.parse('2026-03-04T20:00:00Z')),fall=leagueWeek(Date.parse('2026-10-28T20:00:00Z'));
  expect((spring.end-spring.start)/3_600_000).toBe(167);
  expect((fall.end-fall.start)/3_600_000).toBe(169);
  expect(new Date(pacificMidnight('2026-03-08')).toISOString()).toBe('2026-03-08T08:00:00.000Z');
});
it('picks the highest-intensity valid finished game this week', () => {
  const low=game('low','r','2026-11-17T20:00:00Z','aaaaaaaaaa');
  const high=game('high','r','2026-11-18T20:00:00Z','ababababbbbbb'+'aaaaaaa');
  const games=[low,high,game('prior'),{...high,id:'deleted',deleted_at:'x'},{...high,id:'live',ended_at:null},game('early','r','2026-11-19T20:00:00Z','ab'),game('future','r','2026-11-21T20:00:00Z')];
  const feature=weeklyFeature(games,[r],DEFAULT_WEEKLY_SETTINGS,now);
  expect(feature.best?.game.id).toBe('high');expect(feature.weekGames).toHaveLength(2);
});
it('deprioritizes a recently played rivalry and keeps quality evidence fixed', () => {
  const history=[game('a'),game('b','r','2026-11-11T20:00:00Z'),game('c','s'),game('d','s','2026-11-11T20:00:00Z')];
  const base=weeklyFeature(history,[r,other],DEFAULT_WEEKLY_SETTINGS,now);
  const recent=game('just-played','r','2026-11-20T19:00:00Z');
  const next=weeklyFeature([...history,recent],[r,other],DEFAULT_WEEKLY_SETTINGS,now);
  expect(next.matchup?.id).toBe('s');
  const original=base.candidates.find(c=>c.rivalry.id==='r')!,changed=next.candidates.find(c=>c.rivalry.id==='r')!;
  expect(changed.count).toBe(original.count);expect(changed.rating).toBeCloseTo(original.rating-45);
});
it('excludes live matchups but respects an explicit manual choice', () => {
  const games=[game('a'),game('b','s'),{...game('live'),ended_at:null}];
  expect(weeklyFeature(games,[r,other],DEFAULT_WEEKLY_SETTINGS,now).matchup?.id).toBe('s');
  const settings={...DEFAULT_WEEKLY_SETTINGS,override_week:'2026-11-16',rivalry_id:'r'};
  expect(weeklyFeature(games,[r,other],settings,now).matchup?.id).toBe('r');
});
it('expires overrides and ignores deleted or out-of-week selections', () => {
  const games=[game('old'),game('this-week','s','2026-11-18T20:00:00Z')];
  const settings={...DEFAULT_WEEKLY_SETTINGS,override_week:'2026-11-09',rivalry_id:'r',game_id:'old'};
  const feature=weeklyFeature(games,[{...r,deleted_at:'x'},other],settings,now);
  expect(feature.best?.game.id).toBe('this-week');expect(feature.manualGame).toBe(false);expect(feature.matchup?.id).toBe('s');
});
it('allows choosing a qualifying game while keeping its actual intensity', () => {
  const games=[game('low','r','2026-11-17T20:00:00Z','aaaaaaaaaa'),game('high','r','2026-11-18T20:00:00Z')];
  const settings={...DEFAULT_WEEKLY_SETTINGS,override_week:'2026-11-16',game_id:'low'};
  const feature=weeklyFeature(games,[r],settings,now);
  expect(feature.best?.game.id).toBe('low');expect(feature.manualGame).toBe(true);
});
it('is deterministic across input ordering and handles an empty league', () => {
  const games=[game('a'),game('b','s')];
  expect(weeklyFeature(games,[r,other],DEFAULT_WEEKLY_SETTINGS,now).matchup?.id).toBe(weeklyFeature([...games].reverse(),[other,r],DEFAULT_WEEKLY_SETTINGS,now).matchup?.id);
  expect(weeklyFeature([],[],DEFAULT_WEEKLY_SETTINGS,now)).toMatchObject({best:null,matchup:null,candidates:[]});
});
it('does not promote dormant players just because their rivalry has rested', () => {
  expect(weeklyFeature([game('old','r','2026-10-01T20:00:00Z'),game('fresh','s')],[r,other],DEFAULT_WEEKLY_SETTINGS,now).candidates.map(c=>c.rivalry.id)).toEqual(['s']);
});
it('persists shared local settings and rejects stale writes and invalid picks', async () => {
  vi.useFakeTimers();vi.setSystemTime(now);
  let raw:string|null=null;
  const repo=new LocalRepository({getItem:()=>raw,setItem:(_k,v)=>{raw=v;}},{rivalries:[r],games:[game('current','r','2026-11-18T20:00:00Z')]});
  const settings={...DEFAULT_WEEKLY_SETTINGS,weekday:3,override_week:'2026-11-16',rivalry_id:'r',game_id:'current'};
  await repo.updateWeeklySettings(settings);
  expect((await repo.load()).weekly_settings).toEqual({...settings,revision:1});
  await expect(repo.updateWeeklySettings(settings)).rejects.toThrow('another device');
  await expect(repo.updateWeeklySettings({...settings,revision:1,weekday:8})).rejects.toThrow('valid feature day');
  await expect(repo.updateWeeklySettings({...settings,revision:1,game_id:'missing'})).rejects.toThrow('qualifying game');
});

function candidate(id:string,rating:number,singles:boolean) {
 const base=weeklyFeature([game('sample')],[r],DEFAULT_WEEKLY_SETTINGS,now).candidates[0];
 const person=(suffix:string)=>({id:id+suffix,name:id+suffix,created_at:''});
 return {...base,rating,rivalry:{...r,id,members:{a:[person('a')],b:singles?[person('b')]:[person('b'),person('c')]}}};
}
it('reserves four singles places without disrupting score order or changing the candidates',()=>{
 const candidates=[...Array.from({length:9},(_,i)=>candidate(`team-${i}`,100-i,false)),...Array.from({length:6},(_,i)=>candidate(`single-${i}`,50-i,true))];
 const before=candidates.map(c=>c.rivalry.id);
 expect(matchupShortlist(candidates).map(c=>c.rivalry.id)).toEqual([...before.slice(0,6),...before.slice(9,13)]);
 expect(candidates.map(c=>c.rivalry.id)).toEqual(before);
 expect(matchupShortlist([...candidates].reverse())).toEqual(matchupShortlist(candidates));
});
it('keeps more than four singles if they score well and fills remaining places when singles are scarce',()=>{
 const singles=Array.from({length:7},(_,i)=>candidate(`single-${i}`,100-i,true));
 const teams=Array.from({length:12},(_,i)=>candidate(`team-${i}`,50-i,false));
 expect(matchupShortlist([...singles,...teams]).filter(c=>c.rivalry.id.startsWith('single'))).toHaveLength(7);
 const sparse=matchupShortlist([...teams,...singles.slice(0,2)]);
 expect(sparse).toHaveLength(10);
 expect(sparse.filter(c=>c.rivalry.id.startsWith('single'))).toHaveLength(2);
 expect(matchupShortlist(singles.slice(0,2))).toHaveLength(2);
 expect(matchupShortlist([])).toEqual([]);
});
