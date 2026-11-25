import { build } from 'esbuild';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// Bundle shared app analytics for Deno without maintaining a duplicate algorithm.
const outfile=process.argv[2]??join(tmpdir(),'foosball-slack-deploy','index.js');
await build({entryPoints:['supabase/functions/foosball-slack-notify/index.ts'],bundle:true,platform:'neutral',format:'esm',target:'es2022',outfile});
console.log(outfile);
