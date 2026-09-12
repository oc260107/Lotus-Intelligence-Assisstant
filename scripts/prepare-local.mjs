import {existsSync,copyFileSync,mkdirSync,readFileSync,appendFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);

if(!existsSync('.dev.vars'))copyFileSync('.dev.vars.example','.dev.vars');
if(!existsSync('.env'))copyFileSync('.env.example','.env');

const devVars=readFileSync('.dev.vars','utf8');
if(!/^PROFILE_ENCRYPTION_KEY=/m.test(devVars)){
  const prefix=devVars.length&&!devVars.endsWith('\n')?'\n':'';
  appendFileSync('.dev.vars',`${prefix}PROFILE_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\n`);
  console.log('Created a local PROFILE_ENCRYPTION_KEY in .dev.vars. Keep this file private and do not delete the key while profile data exists.');
}

function run(args){
  const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:{...process.env,CI:'1'}});
  if(r.error)throw r.error;
  if(r.status!==0)process.exit(r.status||1);
}

run(['scripts/run-framework.mjs','build']);
mkdirSync('.sites-runtime',{recursive:true});
writeFileSync('.sites-runtime/local-database.json',JSON.stringify({name:'lia-local-database',compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:'../drizzle'}]}));
run(['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config','.sites-runtime/local-database.json','--persist-to','.wrangler/state']);
console.log('\nLIA đã sẵn sàng. Chạy pnpm dev rồi mở http://localhost:5173/');
