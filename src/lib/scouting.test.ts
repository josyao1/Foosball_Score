import { expect, it } from 'vitest';
import { scoutingCandidates, chooseScoutingNotes } from './scouting';
import type { Game, Player, Rivalry } from './types';
const player=(name:string):Player=>({id:name,name,created_at:'2026-01-01'});
const roster=(id:string,a:string[],b:string[]):Rivalry=>({id,player_a:a.join(' and '),player_b:b.join(' and '),created_at:'2026-01-01',members:{a:a.map(player),b:b.map(player)}});
const r=roster('r',['josh'],['brooks']);
function game(id:string,seq='aaaaaaaaaabb',rid='r',start=0):Game {
 const ms=Date.parse('2026-11-01T18:00:00Z')+start;
 return {id,rivalry_id:rid,revision:1,started_at:new Date(ms).toISOString(),ended_at:new Date(ms+120000).toISOString(),goals:[...seq].map((s,i)=>({id:`${id}-${i}`,actor_side:s as 'a'|'b',rung:'attacker',flags:[],elapsed_ms:(i+1)*1000,occurred_at:new Date(ms+i*1000).toISOString()}))};
}
it('requires three games together and compares other partnerships; ignores 1–0 pairings',()=>{
 const rivals=[roster('pair',['josh','max'],['brooks']),roster('other',['josh','frank'],['brooks']),roster('new',['josh','andrew'],['brooks'])];
 const gs=[...Array.from({length:3},(_,i)=>game(`p${i}`,undefined,'pair')),game('loss','abbbbbbbbbb','other'),game('new',undefined,'new')];
 const notes=scoutingCandidates(gs,rivals).josh;
 expect(notes.find(n=>n.id==='buddy:max')?.text).toContain('3–0');
 expect(notes.some(n=>n.id==='buddy:andrew')).toBe(false);
});
it('personal facts use goal lineup snapshots and exclude unknown legacy team attribution',()=>{
 const team=roster('r',['josh','max'],['brooks']);
 const g=game('team');
 g.goals=g.goals.map((goal,i)=>({...goal,lineup:{a:{defense:i<5?'max':'josh',attack:i<5?'josh':'max'},b:{defense:'brooks',attack:'brooks'}}}));
 const notes=scoutingCandidates([g],[team]);
 expect(notes.josh.find(n=>n.id==='outing')?.text).toContain('5 goals');
 expect(notes.max.find(n=>n.id==='outing')?.text).toContain('5 goals');
 expect(scoutingCandidates([{...g,goals:g.goals.map(x=>({...x,lineup:null}))}],[team]).josh.find(n=>n.id==='outing')?.text).toContain('not recorded');
});
it('counts own goals against the actor and never as a personal scoring contribution',()=>{
 const g=game('g','aaaaab');g.goals[0].flags=['own_goal'];
 expect(scoutingCandidates([g],[r]).josh.find(n=>n.id==='outing')?.text).toContain('4 goals');
 expect(scoutingCandidates([g],[r]).brooks.find(n=>n.id==='outing')?.text).toContain('1 goal');
});
it('rematches require the next appearance, same rivalry, and a nonnegative gap under 30 minutes',()=>{
 const gs=Array.from({length:3},(_,i)=>[game(`l${i}`,'abbbbbbbbbb','r',i*3600000),game(`w${i}`,undefined,'r',i*3600000+130000)]).flat();
 expect(scoutingCandidates(gs,[r]).josh.find(n=>n.id==='rematch')?.text).toContain('3 of 3');
 expect(scoutingCandidates(gs.map(g=>g.id.startsWith('w')?{...g,started_at:new Date(Date.parse(g.started_at)+2000000).toISOString()}:g),[r]).josh.some(n=>n.id==='rematch')).toBe(false);
});
it('removes archived/live evidence, handles restoration and supplies no invented notes for non-scorers',()=>{
 const g=game('g','aaaaaaaaaa');
 expect(scoutingCandidates([g],[r]).brooks).toBeUndefined();
 expect(scoutingCandidates([{...g,deleted_at:'2026-11-02'}],[r])).toEqual({});
 expect(scoutingCandidates([{...g,ended_at:null}],[r])).toEqual({});
 expect(scoutingCandidates([g],[{...r,deleted_at:'2026-11-02'}])).toEqual({});
 expect(scoutingCandidates([g],[r]).josh.length).toBeGreaterThan(0);
});
it('keeps eligible selections until a clearly stronger challenger and replaces vanished facts',()=>{
 const base=scoutingCandidates([game('g')],[r]).josh[0];
 const a={...base,id:'a',family:'a',weight:50},b={...base,id:'b',family:'b',weight:55};
 expect(chooseScoutingNotes({josh:[a,b]},{josh:'a'}).josh.id).toBe('a');
 expect(chooseScoutingNotes({josh:[a,{...b,weight:61}]},{josh:'a'}).josh.id).toBe('b');
 expect(chooseScoutingNotes({josh:[b]},{josh:'a'}).josh.id).toBe('b');
 expect(chooseScoutingNotes({josh:[{...a,text:'Updated claim'}]},{josh:'a'}).josh.text).toBe('Updated claim');
});
it('goalie-opening facts exclude team games, own goals and games opened by the opponent',()=>{
 const gs=Array.from({length:3},(_,i)=>{const g=game(`g${i}`);g.goals[0].rung='goalie';return g;});
 expect(scoutingCandidates(gs,[r]).josh.find(n=>n.id==='goalie-opener')?.text).toContain('3–0');
 gs[0].goals[0].flags=['own_goal'];
 expect(scoutingCandidates(gs,[r]).josh.some(n=>n.id==='goalie-opener')).toBe(false);
 gs[0].goals[0].flags=[];
 expect(scoutingCandidates(gs,[roster('r',['josh','max'],['brooks'])]).josh.some(n=>n.id==='goalie-opener')).toBe(false);
});
it('goal styles update their numerator after edits; combo counts but own goals never do',()=>{
 const g=game('g','aaaaabbbbbbbbbb');
 g.goals.slice(0,4).forEach(goal=>goal.flags=['dunk','bank']);
 const find=(g:Game)=>scoutingCandidates([g],[r]).josh.find(n=>n.id==='style:attacker:dunk');
 expect(find(g)?.text).toBe('4 of your 5 attacker goals were dunks.');
 g.goals[0].flags=[];
 expect(find(g)?.text).toBe('3 of your 5 attacker goals were dunks.');
 g.goals[1].flags=['own_goal','dunk'];
 expect(find(g)).toBeUndefined();
});
it('all drawn partnerships do not earn Best bud and selection is independent of input ordering',()=>{
 const team=roster('r',['josh','max'],['brooks']);
 const gs=Array.from({length:3},(_,i)=>game(`g${i}`,'abab'));
 expect(scoutingCandidates(gs,[team]).josh.some(n=>n.family==='buddy')).toBe(false);
 expect(chooseScoutingNotes(scoutingCandidates(gs,[r]))).toEqual(chooseScoutingNotes(scoutingCandidates([...gs].reverse(),[r])));
});
