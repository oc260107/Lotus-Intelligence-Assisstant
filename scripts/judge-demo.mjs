import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);

function fail(message) {
  console.error(`\n[LIA setup] ${message}\n`);
  process.exit(1);
}

const major = Number(process.versions.node.split('.')[0]);
if (major < 22 || major >= 25) {
  fail(`Node.js 22.x or 24.x is required. Current version: ${process.version}`);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const pnpmArgs = ['--yes', 'pnpm@11.19.0'];

function run(command, args, label) {
  console.log(`\n[LIA setup] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CI: '1' },
  });
  if (result.error) fail(`${label} failed to start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}. See README.md → Troubleshooting.`);
}

run(npx, [...pnpmArgs, 'install', '--frozen-lockfile'], 'Installing pinned dependencies');

// If the evaluator supplied an OpenAI key through the shell, persist it only in
// the git-ignored local runtime file so Wrangler can read it.
if (process.env.OPENAI_API_KEY?.trim()) {
  const path = '.dev.vars';
  let text = existsSync(path) ? readFileSync(path, 'utf8') : readFileSync('.dev.vars.example', 'utf8');
  const setField = (key, value) => {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    if (pattern.test(text)) text = text.replace(pattern, `${key}=${value}`);
    else text += `${text.endsWith('\n') || !text ? '' : '\n'}${key}=${value}\n`;
  };
  setField('OPENAI_API_KEY', process.env.OPENAI_API_KEY.trim());
  if (process.env.OPENAI_MODEL?.trim()) setField('OPENAI_MODEL', process.env.OPENAI_MODEL.trim());
  writeFileSync(path, text);
}

run(process.execPath, ['scripts/prepare-local.mjs'], 'Building app and preparing the local database');

console.log('\n[LIA setup] Ready. Starting http://localhost:5173/');
console.log('[LIA setup] Press Ctrl+C to stop.\n');

const child = spawn(npx, [...pnpmArgs, 'dev'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('error', (error) => fail(`Dev server failed to start: ${error.message}`));
child.on('exit', (code, signal) => {
  if (signal) process.exit(0);
  process.exit(code ?? 0);
});
