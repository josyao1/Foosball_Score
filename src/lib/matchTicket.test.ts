import { matchStory } from './matchStory';
// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { matchTicketSvg } from './matchTicket';
import { defaultAppearance } from './playerAppearance';
import { rankedClassics } from './hallOfFame';
import type { Game, Rivalry } from './types';
const r:Rivalry={id:'r',player_a:'Josh',player_b:'Brooks',created_at:'2026-01-01'};
const g:Game={id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-01T18:00:00Z',ended_at:'2026-11-01T18:05:00Z',goals:Array.from({length:10},(_,i)=>({id:String(i),actor_side:'a',rung:'attacker',flags:[],elapsed_ms:(i+1)*20000,occurred_at:'2026-11-01T18:00:00Z'}))};
it('exports safe standalone artwork with actual score, Pacific date, time-based momentum and highlight',()=>{
 const svg=matchTicketSvg(g,{...r,player_a:'<script>alert(1)</script> & Josh'},[],{headline:{id:'test',group:'test',subject:'Josh',value:'Dunk & bank',priority:1},facts:[]},3);
 const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
 expect(doc.querySelector('parsererror')).toBeNull();expect(doc.querySelector('script')).toBeNull();
 expect(doc.documentElement.textContent).toContain('Dunk & bank');
 expect(svg).toContain('Hall of Fame #3');expect(svg).toContain('10:00 AM PST');expect(svg).toContain('Final goal · 3:20');
 expect(svg).toContain('H199V626.5'); // First goal: 20s of 200s, one of ten goals lead.
 expect(svg).not.toContain('NaN');expect(svg).not.toContain('<image');expect(doc.querySelectorAll('text')).toBeTruthy();
});
it('uses all teammates and current custom jerseys, including renamed members',()=>{
 const members={a:[{id:'j',name:'old',created_at:''},{id:'m',name:'Max',created_at:''}],b:[{id:'b',name:'Brooks',created_at:''}]};
 const svg=matchTicketSvg(g,{...r,members},[{id:'j',name:'Joshua',created_at:'',appearance:{...defaultAppearance('josh'),letters:'JY',color:'#123456'}}],matchStory(g,r),null);
 expect(svg).toContain('Joshua');expect(svg).toContain('Max');expect(svg).toContain('#123456');expect(svg).toContain('JY');expect(svg).not.toContain('Hall of Fame #');
});
it('handles zero-goal manually finished games without invalid geometry',()=>{
 expect(matchTicketSvg({...g,goals:[]},r,[],matchStory({...g,goals:[]},r),null)).not.toMatch(/NaN|Infinity/);
});
it('ranks only active games and changes the current all-time order after archive and restore',()=>{
 const second={...g,id:'second',started_at:'2026-11-02T18:00:00Z'};
 expect(rankedClassics([g,second],[r]).map(x=>x.game.id)).toEqual(['g','second']);
 expect(rankedClassics([{...g,deleted_at:'now'},second],[r]).map(x=>x.game.id)).toEqual(['second']);
 expect(rankedClassics([g,second],[{...r,deleted_at:'now'}])).toEqual([]);
});

it('keeps only two story facts below the graph and labels the goal difference',()=>{
 const fact=(id:string)=>({id,group:id,subject:`Player ${id}`,value:`Fact ${id}`,priority:1});
 const svg=matchTicketSvg(g,r,[],{headline:fact('one'),facts:[fact('two'),fact('three')]},15);
 const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
 const body=doc.documentElement.textContent!;
 expect(body).toContain('Fact one');expect(body).toContain('Fact two');expect(body).not.toContain('Fact three');
 expect(body).toContain('All-time #15');expect(body).toContain('Tied');expect(body).toContain('+10');expect(body).toContain('-10');
 const factNodes=[...doc.querySelectorAll('text')].filter(node=>node.textContent?.startsWith('Fact'));
 expect(factNodes.every(node=>Number(node.getAttribute('y'))>818)).toBe(true);
});
