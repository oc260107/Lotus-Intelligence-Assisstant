import { existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);

for (const path of ['.wrangler/state', '.wrangler/dev-registry', '.wrangler/registry', '.next', '.vinext', '.sites-runtime']) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    console.log(`[LIA reset] Removed ${path}`);
  }
}

console.log('[LIA reset] Local accounts, profiles, trips, chats, notifications, bookings and preference history were cleared.');
console.log('[LIA reset] .dev.vars was preserved, including the local OpenAI key and encryption key.');

const result = spawnSync(process.execPath, ['scripts/prepare-local.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CI: '1' },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log('\n[LIA reset] Fresh demo database is ready. Run: pnpm dev');
