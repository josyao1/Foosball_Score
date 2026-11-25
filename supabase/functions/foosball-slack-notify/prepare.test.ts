import { expect, it, vi } from 'vitest';
import { prepareJob } from './prepare';
import type { Job } from './worker';
import type { Game, Rivalry } from '../../../src/lib/types';
const rivalry:Rivalry={id:'r',player_a:'josh',player_b:'brooks',created_at:'2026-01-01'};
const game:Game={id:'g',rivalry_id:'r',revision:1,started_at:'2026-11-20T18:00:00Z',ended_at:'2026-11-20T18:10:00Z',goals:[...'ababababababababaa'].map((side,i)=>({id:`g-${i}`,actor_side:side as 'a'|'b',rung:'middle',flags:[],elapsed_ms:i*10000,occurred_at:'2026-11-20T18:00:00Z'}))};
const job:Job={id:'job',claim_token:'token',attempt_count:1,payload:{message:'⚽ Final: josh 10–8 brooks · 10:00',game_url:'https://example.test/game/g'},story_snapshot:{game,rivalry}};
it('uses original goal and name snapshots, not a later correction, and preserves base text and button URL',async()=>{
 const context=vi.fn(async()=>({games:[{...game,goals:[]}],rivalries:[{...rivalry,player_a:'renamed'}]}));
 const persist=vi.fn(async(_job:Job,message:string)=>({...job,story_prepared:true,payload:{...job.payload,message}}));
 const result=await prepareJob(job,context,persist);
 expect(result?.payload.message).toBe(job.payload.message+'\n     First-ever 10–8 finish at the table.\n🏆 Enters the Hall of Fame at #1.');
 expect(result?.payload.game_url).toBe(job.payload.game_url);
 expect(persist).toHaveBeenCalledTimes(1);
});
it('reuses a frozen message on retries and leaves pre-rollout jobs untouched',async()=>{
 const context=vi.fn(),persist=vi.fn();
 for(const value of [{...job,story_prepared:true},{...job,story_snapshot:null}])expect(await prepareJob(value,context,persist)).toBe(value);
 expect(context).not.toHaveBeenCalled();expect(persist).not.toHaveBeenCalled();
});
it('does not persist when context indicates that the claim is no longer valid',async()=>{
 const persist=vi.fn();expect(await prepareJob(job,async()=>null,persist)).toBeNull();expect(persist).not.toHaveBeenCalled();
});
