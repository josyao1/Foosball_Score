import { expect, it } from 'vitest';
import { slackHighlights, slackStoryCandidates } from './slackHighlights';
import type { Game, Rivalry } from './types';
const rivalry:Rivalry={id:'r',player_a:'josh',player_b:'andrew',created_at:'2026-01-01'};
function game(seq:string,id='g',day=20):Game {return {id,rivalry_id:'r',started_at:`2026-11-${day}T18:00:00Z`,ended_at:`2026-11-${day}T18:10:00Z`,revision:1,goals:[...seq].map((side,i)=>({id:`${id}-${i}`,actor_side:side as 'a'|'b',rung:(['goalie','defender','middle','attacker'] as const)[i%4],flags:[],elapsed_ms:(i+1)*20000,occurred_at:`2026-11-${day}T18:00:00Z`}))};}
const ids=(g:Game,history:Game[]=[])=>slackStoryCandidates(g,rivalry,history).map(c=>c.id);
it('puts side-independent Scorigami first and excludes early or overplayed results',()=>{
 const g=game('bbbbbaaaaaaaaaa');
 expect(ids(g)[0]).toBe('scorigami');
 const old=game('aaaaabbbbbbbbbb','old',19);
 expect(ids(g,[old])).not.toContain('scorigami');
 expect(ids(game('aaaa'))).toEqual([]);
 expect(ids(game('aaaaaaaaaaa'))).toEqual([]);
});
it('orders late comeback, saves, huge comeback, first win and losing streak as agreed',()=>{
 const g=game('bbbbbbbbbaaaaaaaaaaa');
 const history=Array.from({length:6},(_,i)=>game('bbbbbbbbbb',`loss-${i}`,10+i));
 expect(ids(g,history).slice(0,6)).toEqual(['scorigami','lateComeback','saves','hugeComeback','firstWin','longStreakBreak']);
 const deuce=game('ab'.repeat(8)+'bababaaa');
 expect(ids(deuce)).toContain('saves');
 expect(ids(deuce).indexOf('saves')).toBeLessThan(ids(deuce).indexOf('bothMatchPoint'));
});
it('first win requires previous losses and does not fire after an earlier win',()=>{
 const g=game('ababababababababaa');
 expect(ids(g,[game('bbbbbbbbbb','loss',19)])).not.toContain('firstWin');
 const history=[game('bbbbbbbbbb','l1',16),game('bbbbbbbbbb','l2',17),game('bbbbbbbbbb','l3',18)];
 expect(ids(g,history)).toContain('firstWin');
 expect(ids(g,[game('aaaaaaaaaa','win',15),...history])).not.toContain('firstWin');
 expect(ids(g,[...history,{...game('aaaaaaaaaa','deleted-win',15),deleted_at:'2026-11-16'}])).toContain('firstWin');
});
it('does not emit rejected categories and permits no story or extra',()=>{
 const g=game('ababababababababaa');
 const copy={...g,id:'old',started_at:'2026-11-19T18:00:00Z',ended_at:'2026-11-19T18:10:00Z'};
 expect(slackStoryCandidates(g,rivalry,[copy])).toEqual([]);
 // Fill the top 10 with stronger games; this result has no new record either.
 const stronger=Array.from({length:10},(_,i)=>game('bbbbbbbbbaaaaaaaaaaa',`strong-${i}`,10+i));
 expect(slackHighlights(g,rivalry,[copy,...stronger],[rivalry])).toEqual([]);
});
it('counts rung and special facts without own goals, and picks strongest equal-category fact',()=>{
 const g=game('ababababababababaa');
 g.goals.forEach(goal=>{if(goal.actor_side==='a')goal.rung='middle';});
 const history=[game('ababababababababaa','old',19)];
 expect(slackStoryCandidates(g,rivalry,history).find(c=>c.id==='rung')?.text).toBe('josh scored 10 of 10 goals from midfield.');
 const own=game('ababababababababaa');
 own.goals[0].flags=['own_goal','bank'];
 expect(slackStoryCandidates(own,rivalry,history).some(c=>c.id==='specials')).toBe(false);
});
it('uses strict new records before Hall of Fame and never repeats the headline fact',()=>{
 const old=game('ababababababababaa','old',19);
 old.goals[0].flags=['bank'];
 const g=game('ababababababababaa');
 g.goals.filter(goal=>goal.actor_side==='a').slice(0,4).forEach(goal=>{goal.flags=['bank'];});
 const lines=slackHighlights(g,rivalry,[old],[rivalry]);
 expect(lines[0]).toBe('josh landed 4 banks.');
 expect(lines.filter(line=>line.includes('4 banks'))).toHaveLength(1);
 expect(lines).toHaveLength(2);
 const newScore=game('ab'.repeat(7)+'aaa');
 newScore.goals.slice(0,4).forEach(goal=>{goal.flags=['bank'];});
 expect(slackHighlights(newScore,rivalry,[old,game('aaaaabbbbbbbbbb','run-record',18)],[rivalry])).toEqual(['First-ever 10–7 finish at the table.','New table record: 4 banks.']);
});
it('allows HoF #10, excludes #11, and does not call tied records new',()=>{
 const g=game('ababababababababaa');
 const better=Array.from({length:10},(_,i)=>game('bbbbbbbbbaaaaaaaaaaa',`better-${i}`,10+i));
 const duplicate={...g,id:'old',started_at:'2026-11-10T17:00:00Z',ended_at:'2026-11-10T17:10:00Z'};
 expect(slackHighlights(g,rivalry,[...better.slice(0,8),duplicate],[rivalry])).toEqual(['🏆 Enters the Hall of Fame at #10.']);
 expect(slackHighlights(g,rivalry,[...better.slice(0,9),duplicate],[rivalry])).toEqual([]);
});
it('normalizes names for Slack without losing ampersands or allowing added message lines',()=>{
 const r={...rivalry,player_a:'josh & brooks\n<@everyone>'};
 const g=game('bbbbbbbbbaaaaaaaaaaa');
 const history=[game('bbbbbbbbbaaaaaaaaaaa','old',19)];
 const lines=slackHighlights(g,r,history,[r]);
 expect(lines[0]).toContain('josh & brooks &lt;@everyone&gt;');
 expect(lines[0]).not.toContain('\n');
});
