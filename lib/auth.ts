import { database } from '@/lib/server-db';

const COOKIE_NAME = 'lia_session';
const USER_SESSION_SECONDS = 60 * 60 * 24 * 30;
const GUEST_SESSION_SECONDS = 60 * 60 * 8;
const PBKDF2_ITERATIONS = 210_000;

type SessionKind = 'user' | 'guest';

export type AuthIdentity = {
  owner: string;
  kind: SessionKind;
  userId: string | null;
  guestId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
};

type SessionRow = {
  kind: SessionKind;
  user_id: string | null;
  guest_id: string | null;
  expires_at: string;
  email: string | null;
  phone: string | null;
  name: string | null;
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string | null {
  let phone = value.trim().replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
    throw new Error('Invalid hex value');
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const derived = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterationText, saltHex, expectedHex] = stored.split('$');
  const iterations = Number(iterationText);
  if (
    algorithm !== 'pbkdf2-sha256' ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !saltHex ||
    !expectedHex
  ) {
    return false;
  }

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = hexToBytes(saltHex);
    expected = hexToBytes(expectedHex);
  } catch {
    return false;
  }

  const actual = await derivePassword(password, salt, iterations);
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let i = 0; i < actual.length; i += 1) {
    difference |= actual[i] ^ expected[i];
  }
  return difference === 0;
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rawValue.join('='));
  }
  return null;
}

export async function getIdentity(request: Request): Promise<AuthIdentity | null> {
  const token = cookieValue(request, COOKIE_NAME);
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) return null;

  const tokenHash = await sha256Hex(token);
  const row = (await database()
    .prepare(
      `SELECT s.kind, s.user_id, s.guest_id, s.expires_at, u.email, u.phone, u.name
       FROM auth_sessions s
       LEFT JOIN auth_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first()) as SessionRow | null;

  if (!row) return null;

  if (row.kind === 'user') {
    if (!row.user_id || (!row.email && !row.phone) || !row.name) return null;
    return {
      owner: `user:${row.user_id}`,
      kind: 'user',
      userId: row.user_id,
      guestId: null,
      name: row.name,
      email: row.email,
      phone: row.phone,
    };
  }

  if (!row.guest_id) return null;
  return {
    owner: `guest:${row.guest_id}`,
    kind: 'guest',
    userId: null,
    guestId: row.guest_id,
    name: 'Guest',
    email: null,
    phone: null,
  };
}

export async function requireIdentity(request: Request): Promise<AuthIdentity> {
  const identity = await getIdentity(request);
  if (!identity) throw new Error('UNAUTHORIZED');
  return identity;
}

async function removeCurrentSession(request: Request): Promise<void> {
  const token = cookieValue(request, COOKIE_NAME);
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) return;
  const tokenHash = await sha256Hex(token);
  await database().prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(tokenHash).run();
}

export async function createSession(
  request: Request,
  identity: { kind: 'user'; userId: string } | { kind: 'guest'; guestId: string },
): Promise<string> {
  await removeCurrentSession(request);
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const maxAge = identity.kind === 'user' ? USER_SESSION_SECONDS : GUEST_SESSION_SECONDS;
  const expiresAt = new Date(now.getTime() + maxAge * 1000).toISOString();

  await database()
    .prepare(
      `INSERT INTO auth_sessions
       (token_hash, kind, user_id, guest_id, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      tokenHash,
      identity.kind,
      identity.kind === 'user' ? identity.userId : null,
      identity.kind === 'guest' ? identity.guestId : null,
      now.toISOString(),
      expiresAt,
    )
    .run();

  // Account cookies persist. Guest cookies are browser-session-only so a closed
  // browser does not reopen the previous guest conversation. The server-side
  // row still has a short expiry so abandoned guest data can be cleaned safely.
  return sessionCookie(request, token, identity.kind === 'user' ? maxAge : null);
}

export async function destroySession(request: Request): Promise<string> {
  await removeCurrentSession(request);
  return sessionCookie(request, '', 0);
}

function sessionCookie(request: Request, token: string, maxAge: number | null): string {
  const secure = new URL(request.url).protocol === 'https:';
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    maxAge === null ? '' : `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}
