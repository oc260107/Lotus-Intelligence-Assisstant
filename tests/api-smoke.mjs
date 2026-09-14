import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('wrangler/package.json'))('esbuild');
const sqlite = new DatabaseSync(':memory:');

for (const migration of [
  'drizzle/0000_mean_starfox.sql',
  'drizzle/0001_previous_mercury.sql',
  'drizzle/0002_lia_auth.sql',
  'drizzle/0003_auth_phone.sql',
  'drizzle/0004_user_profile.sql',
  'drizzle/0005_unique_identity_document.sql',
  'drizzle/0006_pending_traveller_profiles.sql',
]) {
  sqlite.exec(readFileSync(migration, 'utf8').replaceAll('--> statement-breakpoint', ''));
}

function prepared(sql, args = []) {
  return {
    __sql: sql,
    __args: args,
    bind(...nextArgs) {
      return prepared(sql, nextArgs);
    },
    async run() {
      const result = sqlite.prepare(sql).run(...args);
      return { meta: { changes: Number(result.changes) } };
    },
    async first() {
      return sqlite.prepare(sql).get(...args) || null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...args) };
    },
  };
}

globalThis.__liaTestEnv = {
  PROFILE_ENCRYPTION_KEY: 'test-profile-key-0123456789abcdef-test-profile-key',
  DB: {
    prepare(sql) {
      return prepared(sql);
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  },
};

const cloudflarePlugin = {
  name: 'test-cloudflare',
  setup(builder) {
    builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const env=globalThis.__liaTestEnv' }));
  },
};

async function bundle(entryPoint, outfile) {
  await build({ entryPoints: [entryPoint], bundle: true, platform: 'node', format: 'esm', outfile, plugins: [cloudflarePlugin] });
}

await bundle('app/api/auth/route.ts', '/tmp/lia-auth-smoke.mjs');
await bundle('app/api/profile/route.ts', '/tmp/lia-profile-smoke.mjs');
await bundle('app/api/state/route.ts', '/tmp/lia-state-smoke.mjs');
const auth = await import('/tmp/lia-auth-smoke.mjs');
const profile = await import('/tmp/lia-profile-smoke.mjs');
const state = await import('/tmp/lia-state-smoke.mjs');

function request(path, body, cookie = '', origin = 'https://lia.test') {
  return new Request(`https://lia.test${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function responseCookie(response) {
  const value = response.headers.get('set-cookie');
  assert(value, 'Expected Set-Cookie header');
  return value.split(';')[0];
}

async function authPost(body, cookie = '') {
  const response = await auth.POST(request('/api/auth', body, cookie));
  return { response, data: await response.json() };
}
async function stateGet(cookie) {
  const response = await state.GET(request('/api/state', undefined, cookie));
  return { response, data: await response.json() };
}
async function profileGet(cookie) {
  const response = await profile.GET(request('/api/profile', undefined, cookie));
  return { response, data: await response.json() };
}
async function profilePost(body, cookie) {
  const response = await profile.POST(request('/api/profile', body, cookie));
  return { response, data: await response.json() };
}

assert.equal((await stateGet('')).response.status, 401);

let result = await authPost({ action: 'register', name: 'Alice Nguyen', email: 'Alice@Example.com', phone: '+84 912 345 678', password: 'StrongPass123!' });
assert.equal(result.response.status, 201);
assert.equal(result.data.user.email, 'alice@example.com');
assert.equal(result.data.user.phone, '+84912345678');
const aliceCookie = responseCookie(result.response);

result = await authPost({ action: 'register', name: 'Duplicate Alice', email: 'ALICE@example.com', phone: '+84 988 111 222', password: 'AnotherPass123!' });
assert.equal(result.response.status, 409);
assert.equal(result.data.code, 'EMAIL_EXISTS');

result = await authPost({ action: 'login', identifierType: 'email', identifier: 'alice@example.com', password: 'WrongPass123!' });
assert.equal(result.response.status, 401);

let aliceState = await stateGet(aliceCookie);
assert.equal(aliceState.response.status, 200);
assert.equal(aliceState.data.state.trips.length, 0);

let aliceProfile = await profileGet(aliceCookie);
assert.equal(aliceProfile.response.status, 200);
assert.equal(aliceProfile.data.complete, false);
assert.equal(aliceProfile.data.profile.email, 'alice@example.com');
assert.equal(aliceProfile.data.profile.phone, '+84912345678');

const intent = { name: 'Alice Hanoi trip', from: 'SYD', to: 'HAN', start: '2026-12-10', end: '2026-12-28', budget: 1200, passengers: 1, baggage: 23, transit: 4, seat: 'Aisle' };
let response = await state.POST(request('/api/state', { action: 'create', revision: 0, tripId: null, intent }, aliceCookie));
let payload = await response.json();
assert.equal(response.status, 200, 'A new account can use LIA immediately without passenger identity onboarding');
assert.equal(payload.state.trips.length, 1);

let savedProfile = await profilePost({
  fullName: 'Alice Nguyen',
  dateOfBirth: '1998-04-12',
  documentType: 'passport',
  documentNumber: 'PA1234567',
  email: 'alice@example.com',
  phone: '+84 912 345 678',
  address: '12 Sample Street, Hanoi, Vietnam',
}, aliceCookie);
assert.equal(savedProfile.response.status, 200);
assert.equal(savedProfile.data.complete, true);
assert.equal(savedProfile.data.profile.documentNumber, 'PA1234567');

const stored = sqlite.prepare('SELECT encrypted_payload FROM user_profiles').get();
assert(stored?.encrypted_payload);
assert(!stored.encrypted_payload.includes('PA1234567'));
assert(!stored.encrypted_payload.includes('12 Sample Street'));

aliceProfile = await profileGet(aliceCookie);
assert.equal(aliceProfile.data.complete, true);
assert.equal(aliceProfile.data.profile.documentNumber, 'PA1234567');
assert.equal(aliceProfile.data.profile.address, '12 Sample Street, Hanoi, Vietnam');


result = await authPost({ action: 'register', name: 'Bob Tran', email: 'bob@example.com', phone: '+61 412 345 678', password: 'BobStrong123!' });
assert.equal(result.response.status, 201);
const bobCookie = responseCookie(result.response);
const bobState = await stateGet(bobCookie);
assert.equal(bobState.data.state.trips.length, 0);

savedProfile = await profilePost({ fullName: 'Bob Tran', dateOfBirth: '1997-01-02', documentType: 'cccd', documentNumber: '012345678901', email: 'bob@example.com', phone: '+61 412 345 678', address: '1 George Street, Sydney NSW' }, bobCookie);
assert.equal(savedProfile.response.status, 200);

result = await authPost({ action: 'register', name: 'Duplicate Bob', email: 'different@example.com', phone: '+61 (412) 345-678', password: 'AnotherPhone123!' });
assert.equal(result.response.status, 409);
assert.equal(result.data.code, 'PHONE_EXISTS');

// Alice can edit profile and the new account identity persists.
savedProfile = await profilePost({ fullName: 'Alice N.', dateOfBirth: '1998-04-12', documentType: 'passport', documentNumber: 'PA1234567', email: 'alice.new@example.com', phone: '+84 912 345 678', address: '99 New Address, Hanoi, Vietnam' }, aliceCookie);
assert.equal(savedProfile.response.status, 200);
assert.equal(savedProfile.data.user.email, 'alice.new@example.com');
result = await authPost({ action: 'login', identifierType: 'email', identifier: 'alice.new@example.com', password: 'StrongPass123!' });
assert.equal(result.response.status, 200);
const aliceLoginCookie = responseCookie(result.response);
aliceState = await stateGet(aliceLoginCookie);
assert.equal(aliceState.data.state.trips.length, 1);

// A guest can explore first, then create an account without losing the current trip workspace.
result = await authPost({ action: 'guest' });
assert.equal(result.response.status, 200);
const guestCookie = responseCookie(result.response);
const guestState = await stateGet(guestCookie);
assert.equal(guestState.data.auth.kind, 'guest');
assert.equal(guestState.data.state.trips.length, 0);
response = await state.POST(request('/api/state', { action: 'create', revision: 0, tripId: null, intent }, guestCookie));
assert.equal(response.status, 200);

result = await authPost({ action: 'register', name: 'Charlie Guest', email: 'charlie@example.com', phone: '+61 433 222 111', password: 'CharliePass123!' }, guestCookie);
assert.equal(result.response.status, 201);
assert.equal(result.data.guestWorkspaceTransferred, true);
const charlieCookie = responseCookie(result.response);
const charlieState = await stateGet(charlieCookie);
assert.equal(charlieState.data.state.trips.length, 1, 'Guest trip should move into the new account workspace');

result = await authPost({ action: 'logout' }, aliceLoginCookie);
assert.equal(result.response.status, 200);
assert.match(result.response.headers.get('set-cookie') || '', /Max-Age=0/);
assert.equal((await stateGet(aliceLoginCookie)).response.status, 401);

response = await auth.POST(request('/api/auth', { action: 'guest' }, '', 'https://evil.example'));
assert.equal(response.status, 403);

console.log('PASS: auth, optional passenger profile, encrypted identity fields, immediate workspace access, guest-to-account trip transfer, workspace isolation and origin protection.');
