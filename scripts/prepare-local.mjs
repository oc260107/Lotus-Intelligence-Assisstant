import {
  existsSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);

if (!existsSync('.dev.vars')) copyFileSync('.dev.vars.example', '.dev.vars');

let devVars = readFileSync('.dev.vars', 'utf8');
function setField(key, value) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(devVars)) devVars = devVars.replace(pattern, `${key}=${value}`);
  else devVars += `${devVars.endsWith('\n') || !devVars ? '' : '\n'}${key}=${value}\n`;
}

if (process.env.OPENAI_API_KEY?.trim()) setField('OPENAI_API_KEY', process.env.OPENAI_API_KEY.trim());
if (process.env.OPENAI_MODEL?.trim()) setField('OPENAI_MODEL', process.env.OPENAI_MODEL.trim());

const keyMatch = devVars.match(/^PROFILE_ENCRYPTION_KEY=(.*)$/m);
if (!keyMatch || !keyMatch[1].trim()) {
  setField('PROFILE_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
  console.log('[LIA setup] Generated a private local PROFILE_ENCRYPTION_KEY in .dev.vars.');
}
writeFileSync('.dev.vars', devVars);

function run(args, label) {
  console.log(`[LIA setup] ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: '1',
      CLOUDFLARE_CF_FETCH_ENABLED: 'false',
      WRANGLER_SEND_METRICS: 'false',
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run(['node_modules/vinext/dist/cli.js', 'build'], 'Building Vinext application');

mkdirSync('.sites-runtime', { recursive: true });
writeFileSync(
  '.sites-runtime/local-database.json',
  JSON.stringify({
    name: 'lia-local-database',
    compatibility_date: '2026-05-15',
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'lia-local-d1',
        database_id: '00000000-0000-4000-8000-000000000000',
        migrations_dir: '../drizzle',
      },
    ],
  }),
);

run(
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    '.sites-runtime/local-database.json',
    '--persist-to',
    '.wrangler/state',
  ],
  'Applying local D1 migrations',
);

console.log('\n[LIA setup] Local setup complete. Run `pnpm dev` or use `npm run demo`.');
