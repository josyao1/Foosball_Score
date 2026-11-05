import { expect, it } from 'vitest';
import { playerPassports } from './players';
import type { Game, Rivalry } from './types';
const r: Rivalry = {id:'r',player_a:'Josh',player_b:'Brooks',created_at:'2026-01-01'};
const game = (seq: string, id='g', rivalry_id='r', day=1): Game => ({ id,rivalry_id,revision:1,started_at:`2026-10-${String(day).padStart(2,'0')}T18:00:00Z`,ended_at:`2026-10-${String(day).padStart(2,'0')}T19:00:00Z`,goals:[...seq].map((s,i)=>({id:`${id}-${i}`,actor_side:s as 'a'|'b',rung:'attacker',flags:[],elapsed_ms:(i+1)*1000,occurred_at:'2026-10-01T18:00:00Z'})) });
it('combines names and side swaps across rivalries and includes confirmed legacy team members', () => {
  const other = {...r,id:'other',player_a:'Andrew',player_b:' jOSH '};
  const team = {...r,id:'team',player_a:'Josh and Brooks',player_b:'Andrew'};
  const people = playerPassports([game('aaaaaaaaaa'),game('bbbbbbbbbb','other','other'),game('aaaaaaaaaa','team','team')],[r,other,team]);
  const josh = people.find(p=>p.key==='josh')!;
  expect(josh).toMatchObject({played:3,wins:3,goals:25,bestStreak:3});
  expect(people.find(p=>p.key==='josh and brooks')).toBeUndefined();
  expect(people.find(p=>p.key==='brooks')).toMatchObject({played:2,wins:1,goals:5});
});
it('counts own goals against their actor in signatures, excluding them from rung stats', () => {
  const g=game('aaaab');
  g.goals[0].flags=['own_goal']; g.goals[1].flags=['dunk','bank'];
  const [josh,brooks] = ['josh','brooks'].map(key=>playerPassports([g],[r]).find(p=>p.key===key)!);
  expect(josh).toMatchObject({wins:1,goals:3,types:{combo:1,own_goal:1,dunk:0,bank:0},bestRun:{value:3}});
  expect(brooks).toMatchObject({losses:1,goals:1,types:{own_goal:0},bestRun:{value:1}});
});
it('keeps each player’s best run even when the other player has the larger run', () => {
  const people=playerPassports([game('bbbaaaaaaaaaa')],[r]);
  expect(people.find(p=>p.key==='brooks')!.bestRun!.value).toBe(3);
  expect(people.find(p=>p.key==='josh')!.bestComeback!.value).toBe(3);
});
it('shows tied styles honestly and leaves empty/live profiles unset', () => {
  const g=game('aa'); g.goals[0].rung='goalie'; g.goals[0].flags=['bank']; g.goals[1].flags=['dunk'];
  const p=playerPassports([g,{...game('aaaaaaaaaa','live'),ended_at:null}],[r]).find(p=>p.key==='josh')!;
  expect(p.favoriteRungs).toEqual(['goalie','attacker']);
  expect(p.signatureTypes).toEqual(['dunk','bank']);
  expect(p.played).toBe(1); expect(p.quickestWin).toBeNull();
  const empty=playerPassports([],[r])[0];
  expect(empty.favoriteRungs).toEqual([]); expect(empty.signatureTypes).toEqual([]); expect(empty.recent).toEqual([]);
});
it('sorts recent form by completion and resets streaks on draws, retaining only five results', () => {
  const games=[game('aa','1','r',1),game('aa','2','r',2),game('ab','3','r',3),game('bb','4','r',4),game('aa','5','r',5),game('aa','6','r',6)];
  const p=playerPassports(games.reverse(),[r]).find(p=>p.key==='josh')!;
  expect(p.recent.map(g=>g.result)).toEqual(['W','D','L','W','W']);
  expect(p).toMatchObject({bestStreak:2,currentStreak:2,played:6,wins:4,losses:1,draws:1});
});
it('times quickest valid wins through the last goal and skips missing or self-match rivalries', () => {
  const p=playerPassports([game('aaaaaaaaaa'),game('aaaaaaaaaaa','continued'),game('aaaa','early'),game('aaaaaaaaaa','missing','missing')],[r]).find(p=>p.key==='josh')!;
  expect(p.quickestWin).toMatchObject({game:{id:'g'},value:10000});
  expect(playerPassports([game('aaaaaaaaaa')],[{...r,player_b:' josh '}])[0].played).toBe(0);
});

it('does not assign regular as a signature and allows own goals to be the signature', () => {
  const g=game('aaa');
  expect(playerPassports([g],[r]).find(p=>p.key==='josh')!.signatureTypes).toEqual([]);
  g.goals[0].flags=['own_goal','dunk','bank'];
  const p=playerPassports([g],[r]).find(p=>p.key==='josh')!;
  expect(p.signatureTypes).toEqual(['own_goal']);
  expect(p.types).toEqual({own_goal:1,dunk:0,bank:0,combo:0});
  expect(p.goals).toBe(2);
  expect(p.rungs.attacker).toBe(2);
});

it('earns cumulative tiers in completion order with the exact crossing game',()=>{
  const games=Array.from({length:25},(_,i)=>game('aaaaaaaaaa',`win-${i+1}`,'r',i+1));
  const p=playerPassports([...games].reverse(),[r]).find(p=>p.key==='josh')!;
  expect(p.mastery.goals.count).toBe(250);
  expect(p.mastery.goals.earned.map(g=>g.id)).toEqual(['win-5','win-10','win-25']);
  expect(p.mastery.wins.earned.map(g=>g.id)).toEqual(['win-5','win-15']);
  expect(p.mastery.attacker.earned.map(g=>g.id)).toEqual(['win-1','win-3','win-5','win-10']);
});
it('counts combos toward both skills, excludes own goals, and requires all four rungs within one game',()=>{
  const g=game('aaaaa');
  g.goals[0].rung='goalie';g.goals[1].rung='defender';g.goals[2].rung='middle';
  g.goals[0].flags=['dunk','bank'];g.goals[4].flags=['own_goal','dunk','bank'];
  const p=playerPassports([g],[r]).find(p=>p.key==='josh')!;
  expect(p.mastery.dunks.count).toBe(1);expect(p.mastery.banks.count).toBe(1);
  expect(p.mastery.goals.count).toBe(4);
  expect(p.mastery.allRungs.earned.map(g=>g.id)).toEqual(['g']);
  const first=game('aa','first'); first.goals[0].rung='goalie';first.goals[1].rung='defender';
  const second=game('aa','second'); second.goals[0].rung='middle';
  expect(playerPassports([first,second],[r]).find(p=>p.key==='josh')!.mastery.allRungs.count).toBe(0);
});
it('awards match-point recovery only for valid wins after facing match point, once per game',()=>{
  const saved=game('bbbbbbbbbaaaaaaaaaaa'); // 0–9 to 11–9
  const early=game('bbbbbbbbbaaaaaaaaaa','early'); // 10–9 is not a win by two
  const continued=game('bbbbbbbbbaaaaaaaaaaaa','continued'); // continued past the valid finish
  const p=playerPassports([saved,early,continued,{...saved,id:'live',ended_at:null}],[r]).find(p=>p.key==='josh')!;
  expect(p.mastery.recovery.count).toBe(1);
  expect(p.mastery.recovery.earned[0].id).toBe('g');
  expect(playerPassports([saved],[r]).find(p=>p.key==='brooks')!.mastery.recovery.count).toBe(0);
});

it('uses only 1v1 games for personal bests, including for the solo opponent of a team',()=>{
 const team={...r,id:'team',player_a:'Josh and Brooks',player_b:'Andrew'};
 const solo={...r,id:'solo',player_b:'Andrew'};
 const singles=game('bbbaaaaaaaaaa','single','solo');
 singles.goals.forEach(g=>{g.elapsed_ms*=10000;});
 const teamWin=game('bbbbbaaaaaaaaaa','team-win','team');
 const soloAgainstTeam=game('aaaaabbbbbbbbbb','solo-against-team','team');
 const expected=playerPassports([singles],[solo]);
 const actual=playerPassports([singles,teamWin,soloAgainstTeam],[solo,team]);
 for(const id of ['josh','andrew']){
  const before=expected.find(p=>p.key===id)!,after=actual.find(p=>p.key===id)!;
  expect([after.bestRun,after.bestComeback,after.quickestWin]).toEqual([before.bestRun,before.bestComeback,before.quickestWin]);
  expect(after.played).toBe(3);
 }
 const brooks=actual.find(p=>p.key==='brooks')!;
 expect([brooks.bestRun,brooks.bestComeback,brooks.quickestWin]).toEqual([null,null,null]);
 expect(brooks.wins).toBe(1);
});
