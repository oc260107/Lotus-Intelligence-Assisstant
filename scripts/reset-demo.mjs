import {existsSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);

for(const path of ['.wrangler/state','.next','.vinext','.sites-runtime']){
  if(existsSync(path)){
    rmSync(path,{recursive:true,force:true});
    console.log(`[LIA reset] Removed ${path}`);
  }
}

console.log('[LIA reset] Local accounts, profiles, trips, chats, notifications, bookings and preference history have been cleared.');
console.log('[LIA reset] .dev.vars was preserved, including your local OpenAI key.');

const r=spawnSync(process.execPath,['scripts/prepare-local.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,CI:'1'}});
if(r.error)throw r.error;
if(r.status!==0)process.exit(r.status||1);
console.log('\n[LIA reset] Fresh demo database is ready. Run: pnpm dev');
