import { expect, it } from 'vitest';
import { matchStory } from './matchStory';
import type { Game, Rivalry, Side } from './types';
const r:Rivalry={id:'r',player_a:'Josh',player_b:'Brooks',created_at:''};
const game=(seq:string):Game=>({id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-12T18:00:00Z',ended_at:'2026-11-12T18:08:00Z',goals:[...seq].map((s,i)=>({id:String(i),actor_side:s as Side,rung:'attacker',flags:[],elapsed_ms:(i+1)*20000,occurred_at:''}))});
it('leads with a late comeback and avoids duplicate sequence facts',()=>{
 const story=matchStory(game('abababababbbbb'+'aaaaaa'),r);
 expect(story.headline.value).toBe('Recovered from 5–9');
 expect(story.facts.length).toBeLessThanOrEqual(2);
 expect(new Set([story.headline,...story.facts].map(f=>f.group)).size).toBe(story.facts.length+1);
});
it('does not invent individual team contributions for historical goals',()=>{
 const story=matchStory(game('aaaaaaaaaa'),{...r,player_a:'Josh and Brooks'});
 expect([story.headline,...story.facts].some(f=>f.group==='team')).toBe(false);
});
it('uses previous finished games only when describing a broken streak',()=>{
 const g=game('ababababababababaa');
 const losses=Array.from({length:3},(_,i)=>({...game('bbbbbbbbbb'),id:`old${i}`,started_at:`2026-11-0${i+1}T18:00:00Z`,ended_at:`2026-11-0${i+1}T18:08:00Z`}));
 expect(matchStory(g,r,losses).headline.id).toBe('streakBreak');
 expect(matchStory(g,r,losses.map(g=>({...g,deleted_at:'now'}))).headline.id).not.toBe('streakBreak');
});
it('handles a scoreless finished game without filler facts',()=>{
 expect(matchStory(game(''),r).facts).toEqual([]);
 expect(matchStory(game(''),r).headline.value).toBe('No goals recorded');
});
