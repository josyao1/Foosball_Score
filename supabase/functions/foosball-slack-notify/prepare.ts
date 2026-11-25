import { slackHighlights } from '../../../src/lib/slackHighlights.ts';
import type { Data } from '../../../src/lib/types.ts';
import type { Job } from './worker.ts';

export async function prepareJob(job:Job,context:(job:Job)=>Promise<Data|null>,persist:(job:Job,message:string)=>Promise<Job|null>):Promise<Job|null> {
 // Old jobs and prepared retries retain exactly what was previously queued.
 if(job.story_prepared||!job.story_snapshot)return job;
 const state=await context(job);
 if(!state)return null;
 const {game,rivalry}=job.story_snapshot;
 const rivalries=[...state.rivalries.filter(r=>r.id!==rivalry.id),rivalry];
 const lines=slackHighlights(game,rivalry,state.games,rivalries)
  .map(line=>/^\p{Extended_Pictographic}/u.test(line)?line:`     ${line}`);
 return persist(job,[job.payload.message,...lines].join('\n'));
}
