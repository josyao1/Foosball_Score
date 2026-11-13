import { expect,it } from 'vitest';
import { earnedAchievements, streakAchievementGames } from './achievements';
import { playerPassports } from './players';
import type { Game, Side } from './types';
function game(seq:string,id='g'):Game {
 return {id,rivalry_id:'r',revision:1,started_at:'2026-11-03T18:00:00Z',ended_at:'2026-11-03T18:10:00Z',goals:[...seq].map((s,i)=>({id:`${id}-${i}`,actor_side:s as Side,rung:'attacker',flags:[],elapsed_ms:(i+1)*10000,occurred_at:'2026-11-03T18:00:00Z'}))};
}
it('counts separate saved match points, then requires a valid win',()=>{
 expect(earnedAchievements(game('aaaaaabbbbbbbbbaaaaa'),'a')).toContain('escape');
 expect(earnedAchievements(game('aaaaaaabbbbbbbbbaaaa'),'a')).not.toContain('escape');
 expect(earnedAchievements(game('bbbbbbbbbaaaaaaaaaa'),'a')).not.toContain('escape');
 expect(earnedAchievements(game('bbbbbbbbbaaaaaaaaaaaa'),'a')).not.toContain('escape');
});
it('attributes winning-shot badges and treats an opponent own goal as a gift only',()=>{
 const g=game('aaaaaaaaaa');g.goals[9].rung='goalie';g.goals[9].flags=['dunk','bank'];
 expect(earnedAchievements(g,'a')).toEqual(expect.arrayContaining(['dunk','bank','goalie','perfect','speed']));
 expect(earnedAchievements(g,'b')).toEqual([]);
 g.goals[9].actor_side='b';g.goals[9].flags=['own_goal','dunk','bank'];
 const earned=earnedAchievements(g,'a');
 expect(earned).toContain('gift');
 for(const id of ['dunk','bank','goalie']) expect(earned).not.toContain(id);
 expect(earnedAchievements(g,'b')).not.toContain('gift');
});
it('recognizes deuce marathons and deep comebacks',()=>{
 expect(earnedAchievements(game('ab'.repeat(12)+'aa'),'a')).toContain('extra');
 expect(earnedAchievements(game('ab'.repeat(11)+'aa'),'a')).not.toContain('extra');
 expect(earnedAchievements(game('bbbbbb'+'aaaaaaaaaa'),'a')).toContain('comeback');
 expect(earnedAchievements(game('bbbbb'+'aaaaaaaaaa'),'a')).not.toContain('comeback');
});
it('requires five uninterrupted personal goals on one rung',()=>{
 const g=game('aaaaa');expect(earnedAchievements(g,'a')).toContain('rungRun');
 g.goals[2].rung='middle';expect(earnedAchievements(g,'a')).not.toContain('rungRun');
 g.goals[2].rung='attacker';g.goals[2].actor_side='b';expect(earnedAchievements(g,'a')).not.toContain('rungRun');
 g.goals[2].flags=['own_goal'];expect(earnedAchievements(g,'a')).not.toContain('rungRun');
});
it('checks timing boundaries and own-goal attribution',()=>{
 const g=game('aaaaaaaaaa');g.goals[9].elapsed_ms=240000;
 expect(earnedAchievements(g,'a')).not.toContain('speed');g.goals[9].elapsed_ms=239999;
 expect(earnedAchievements(g,'a')).toContain('speed');
 const reply=game('ba');reply.goals[1].elapsed_ms=13000;
 expect(earnedAchievements(reply,'a')).toContain('reply');reply.goals[1].elapsed_ms++;
 expect(earnedAchievements(reply,'a')).not.toContain('reply');
 reply.goals[1].elapsed_ms=13000;reply.goals[1].actor_side='b';reply.goals[1].flags=['own_goal'];
 expect(earnedAchievements(reply,'a')).not.toContain('reply');
 const own=game('aaa');own.goals.forEach(g=>g.flags=['own_goal']);
 expect(earnedAchievements(own,'a')).toContain('own');expect(earnedAchievements(own,'b')).not.toContain('own');
});
it('ignores live games, disallows premature winning badges, and retains first earning game across side swaps',()=>{
 const g=game('aaaaaaaaaa','first');
 expect(earnedAchievements({...g,ended_at:null},'a')).toEqual([]);
 expect(earnedAchievements(game('aa'),'a')).not.toContain('perfect');
 const later=game('bbbbbbbbbb','later');later.rivalry_id='s';later.ended_at='2026-11-04T18:10:00Z';
 const people=playerPassports([later,g],[{id:'r',player_a:'Josh',player_b:'Brooks',created_at:''},{id:'s',player_a:'Andrew',player_b:' jOSH ',created_at:''}]);
 expect(people.find(p=>p.key==='josh')!.achievements.perfect?.id).toBe('first');
});

it('awards Double agent only to the player who made two own goals and then validly won',()=>{
 const g=game('a'.repeat(12));g.goals[0].flags=['own_goal'];g.goals[1].flags=['own_goal'];
 expect(earnedAchievements(g,'a')).toContain('doubleAgent');
 expect(earnedAchievements(g,'b')).not.toContain('doubleAgent');
 expect(earnedAchievements({...g,goals:g.goals.slice(0,-1)},'a')).not.toContain('doubleAgent');
 g.goals[1].flags=[];expect(earnedAchievements(g,'a')).not.toContain('doubleAgent');
});
it('awards Trading blows to both players only when all first ten goals alternate',()=>{
 const g=game('ab'.repeat(5)+'aaaaa');
 expect(earnedAchievements(g,'a')).toContain('trading');expect(earnedAchievements(g,'b')).toContain('trading');
 expect(earnedAchievements(game('ab'.repeat(4)),'a')).not.toContain('trading');
 g.goals[1].actor_side='a';expect(earnedAchievements(g,'a')).not.toContain('trading');
});
it('requires five personally scored final goals for Closing time and a valid finish',()=>{
 expect(earnedAchievements(game('aaaaabaaaaa'),'a')).toContain('closing');
 expect(earnedAchievements(game('aaaaaabaaaa'),'a')).not.toContain('closing');
 const g=game('aaaaabaaaaa');g.goals[8].actor_side='b';g.goals[8].flags=['own_goal'];
 expect(earnedAchievements(g,'a')).not.toContain('closing');
 expect(earnedAchievements(game('aaaaaa'),'a')).not.toContain('closing');
});
it('requires a strict lead after every goal for Never in doubt',()=>{
 expect(earnedAchievements(game('aabaaabaaaaa'),'a')).toContain('neverDoubt');
 expect(earnedAchievements(game('abaaaaaaaaa'),'a')).not.toContain('neverDoubt');
 expect(earnedAchievements(game('baaaaaaaaaa'),'a')).not.toContain('neverDoubt');
 expect(earnedAchievements(game('aaa'),'a')).not.toContain('neverDoubt');
});
it('requires breaking at least a four-goal opponent run personally and winning',()=>{
 expect(earnedAchievements(game('bbbbaaaaaaaaaa'),'a')).toContain('breaker');
 expect(earnedAchievements(game('bbbaaaaaaaaaa'),'a')).not.toContain('breaker');
 expect(earnedAchievements(game('bbbbaaaaaaaaaaa'),'a')).not.toContain('breaker');
 const g=game('bbbbaaaaaaaaaa');g.goals[4].actor_side='b';g.goals[4].flags=['own_goal'];
 expect(earnedAchievements(g,'a')).not.toContain('breaker');
});
it('finds four different rungs in a sliding unanswered run without crediting own goals',()=>{
 const g=game('aaaaa');
 g.goals[0].rung='goalie';g.goals[1].rung='goalie';g.goals[2].rung='defender';g.goals[3].rung='middle';
 expect(earnedAchievements(g,'a')).toContain('around');
 g.goals[2].actor_side='b';expect(earnedAchievements(g,'a')).not.toContain('around');
 g.goals[2].flags=['own_goal'];expect(earnedAchievements(g,'a')).not.toContain('around');
 g.goals[2].actor_side='a';g.goals[2].flags=[];g.goals[2].rung='goalie';
 expect(earnedAchievements(g,'a')).not.toContain('around');
});

it('requires four separate special categories by the same actor for Full house',()=>{
 const g=game('aaaa');
 g.goals[0].flags=['dunk'];g.goals[1].flags=['bank'];g.goals[2].flags=['dunk','bank'];g.goals[3].flags=['own_goal'];
 expect(earnedAchievements(g,'a')).toContain('fullHouse');expect(earnedAchievements(g,'b')).not.toContain('fullHouse');
 g.goals[1].flags=['dunk','bank'];expect(earnedAchievements(g,'a')).not.toContain('fullHouse');
 g.goals[1].flags=['bank'];g.goals[3].actor_side='b';expect(earnedAchievements(g,'a')).not.toContain('fullHouse');
});
it('requires the score gap to stay within two in either direction for Walking the tightrope',()=>{
 const tight=game('bbaa'.repeat(4)+'aa');
 expect(earnedAchievements(tight,'a')).toContain('tightrope');
 expect(earnedAchievements(game('aaa'+'ba'.repeat(6)+'bba'),'a')).not.toContain('tightrope');
 expect(earnedAchievements(game('bbbaaa'+'ba'.repeat(5)+'aa'),'a')).not.toContain('tightrope');
 expect(earnedAchievements(tight,'b')).not.toContain('tightrope');
 expect(earnedAchievements({...tight,ended_at:null},'a')).not.toContain('tightrope');
 expect(earnedAchievements(game('ab'),'a')).not.toContain('tightrope');
});
it('marks the fifth win across rivalries and side swaps, with draws resetting the run',()=>{
 const rivalries=[{id:'r',player_a:'Josh',player_b:'Brooks',created_at:''},{id:'s',player_a:'Andrew',player_b:' JOSH ',created_at:''}];
 const games=Array.from({length:6},(_,i)=>({...game(i%2 ? 'bbbbbbbbbb' : 'aaaaaaaaaa',`w${i+1}`),rivalry_id:i%2 ? 's':'r',ended_at:`2026-11-03T18:${String(i+10).padStart(2,'0')}:00Z`}));
 const streaks=streakAchievementGames([...games].reverse(),rivalries);
 expect([...streaks]).toEqual([['w5',['a']]]);
 const josh=playerPassports(games,rivalries).find(p=>p.key==='josh')!;
 expect(josh.achievements.streak?.id).toBe('w5');
 games[2].goals=game('ab').goals;
 expect(streakAchievementGames(games,rivalries).size).toBe(0);
 expect(playerPassports(games,rivalries).find(p=>p.key==='josh')!.achievements.streak).toBeUndefined();
});
it('awards Marathon at ten minutes through the last goal, not the finish tap',()=>{
 const g=game('aaaaaaaaaa');g.goals[9].elapsed_ms=599999;
 g.ended_at='2026-11-03T19:00:00Z';expect(earnedAchievements(g,'a')).not.toContain('marathon');
 g.goals[9].elapsed_ms=600000;expect(earnedAchievements(g,'a')).toContain('marathon');
 expect(earnedAchievements(g,'b')).not.toContain('marathon');
 expect(earnedAchievements({...g,ended_at:null},'a')).not.toContain('marathon');
 expect(earnedAchievements({...g,goals:[...g.goals,{...g.goals[9],id:'extra',elapsed_ms:610000}]},'a')).not.toContain('marathon');
});
it('awards Circus for three consecutive special credited goals despite opponent interruptions',()=>{
 const g=game('abababa');
 g.goals[0].flags=['dunk'];g.goals[2].flags=['bank'];g.goals[4].actor_side='b';g.goals[4].flags=['own_goal'];
 expect(earnedAchievements(g,'a')).toContain('circus');
 expect(earnedAchievements(g,'b')).not.toContain('circus');
 expect(earnedAchievements({...g,ended_at:null},'a')).not.toContain('circus');
 g.goals[2].flags=[];
 expect(earnedAchievements(g,'a')).not.toContain('circus');
 g.goals[2].flags=['dunk','bank'];g.goals[4].actor_side='a';g.goals[4].flags=[];
 expect(earnedAchievements(g,'a')).not.toContain('circus');
 g.goals[4].flags=['dunk','bank'];
 expect(earnedAchievements(g,'a')).toContain('circus');
});

it('does not award Circus to the own-goal actor in the reported own/combo/own sequence',()=>{
 const g=game('aaa');
 g.goals[0].flags=['own_goal'];g.goals[1].flags=['dunk','bank'];g.goals[2].flags=['own_goal'];
 expect(earnedAchievements(g,'a')).not.toContain('circus');
 expect(earnedAchievements(g,'b')).not.toContain('circus');
 const third={...g.goals[2],id:'third-own',elapsed_ms:40000};
 g.goals.push(third);
 expect(earnedAchievements(g,'b')).toContain('circus');
 expect(earnedAchievements(g,'a')).not.toContain('circus');
});
it('keeps every qualifying game across side swaps while retaining only the first unlock for the feed',()=>{
 const first=game('aaaaaaaaaa','first');
 const second:Game={...game('bbbbbbbbbb','second'),rivalry_id:'s',ended_at:'2026-11-04T18:10:00Z'};
 const rivals=[{id:'r',player_a:'Josh',player_b:'Brooks',created_at:''},{id:'s',player_a:'Andrew',player_b:' JOSH ',created_at:''}];
 const josh=playerPassports([second,first],rivals).find(p=>p.key==='josh')!;
 expect(josh.achievementHistory.perfect?.map(g=>g.id)).toEqual(['first','second']);
 expect(josh.achievements.perfect?.id).toBe('first');
 second.ended_at=null;
 expect(playerPassports([first,second],rivals).find(p=>p.key==='josh')!.achievementHistory.perfect?.map(g=>g.id)).toEqual(['first']);
});
it('awards Wrong way for an own goal while holding match point immediately before it',()=>{
 for (const [seq,yes] of [['aaaaaaaaabbbbbbbb',true],['ab'.repeat(9),false],['ab'.repeat(9)+'a',true],['aaaaaaaaaabb',false],['ab'.repeat(9)+'b',false]] as const) {
   const g=game(seq+'a');g.goals.at(-1)!.flags=['own_goal'];
   expect(earnedAchievements(g,'a').includes('wrongWay')).toBe(yes);
   expect(earnedAchievements(g,'b')).not.toContain('wrongWay');
   expect(earnedAchievements({...g,ended_at:null},'a')).not.toContain('wrongWay');
 }
});
