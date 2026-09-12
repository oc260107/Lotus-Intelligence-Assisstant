import { z } from 'zod';
import { bucket, database } from '@/lib/server-db';
import {
  createSession,
  destroySession,
  getIdentity,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  verifyPassword,
  type AuthIdentity,
} from '@/lib/auth';
import { mutationGuard } from '@/lib/server';

const credentialsSchema = z.object({
  identifierType: z.enum(['email', 'phone']),
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(8).max(128),
});

const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().min(1).max(254),
  phone: z.string().trim().min(1).max(32),
  password: z.string().min(8).max(128),
});

type ParsedIdentifier = { email: string | null; phone: string | null; value: string };
type WorkspaceRow = { payload: string; revision: number };
type JsonRecord = Record<string, unknown>;

function parseIdentifier(type: 'email' | 'phone', raw: string): ParsedIdentifier | null {
  if (type === 'email') {
    const email = normalizeEmail(raw);
    if (!z.string().email().max(254).safeParse(email).success) return null;
    return { email, phone: null, value: email };
  }
  const phone = normalizePhone(raw);
  if (!phone) return null;
  return { email: null, phone, value: phone };
}

function authJson(data: unknown, status = 200, cookie?: string) {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (cookie) headers.set('Set-Cookie', cookie);
  return Response.json(data, { status, headers });
}

function publicIdentity(identity: Awaited<ReturnType<typeof getIdentity>>) {
  if (!identity) return null;
  return { kind: identity.kind, name: identity.name, email: identity.email, phone: identity.phone };
}

function duplicateMessage(type: 'email' | 'phone') {
  return type === 'email'
    ? { error: 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.', code: 'EMAIL_EXISTS' }
    : { error: 'Số điện thoại này đã được đăng ký. Hãy đăng nhập hoặc dùng số khác.', code: 'PHONE_EXISTS' };
}

async function findExisting(type: 'email' | 'phone', value: string) {
  if (type === 'email') {
    return database().prepare('SELECT id FROM auth_users WHERE email = ? COLLATE NOCASE LIMIT 1').bind(value).first();
  }
  return database().prepare('SELECT id FROM auth_users WHERE phone = ? LIMIT 1').bind(value).first();
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function mergeById(userValue: unknown, guestValue: unknown): unknown[] {
  const user = Array.isArray(userValue) ? userValue : [];
  const guest = Array.isArray(guestValue) ? guestValue : [];
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of [...guest, ...user]) {
    const record = asRecord(item);
    const id = typeof record.id === 'string' ? record.id : JSON.stringify(item);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function hasStarter(value: unknown): boolean {
  const starter = asRecord(value);
  const messages = Array.isArray(starter.messages) ? starter.messages : [];
  const draft = asRecord(starter.draft);
  return messages.length > 0 || Object.keys(draft).length > 0;
}

function mergeWorkspacePayload(userPayload: string | null, guestPayload: string, accountName: string): string {
  const guest = asRecord(JSON.parse(guestPayload));
  if (!userPayload) {
    const profile = asRecord(guest.profile);
    return JSON.stringify({ ...guest, profile: { ...profile, name: accountName } });
  }

  const user = asRecord(JSON.parse(userPayload));
  const userProfile = asRecord(user.profile);
  const merged: JsonRecord = { ...guest, ...user };
  for (const key of ['trips', 'notifications', 'bookings', 'preferenceEvidence']) {
    merged[key] = mergeById(user[key], guest[key]);
  }
  merged.profile = { ...asRecord(guest.profile), ...userProfile, name: accountName };
  if (hasStarter(guest.starter)) merged.starter = guest.starter;
  else if (user.starter !== undefined) merged.starter = user.starter;
  return JSON.stringify(merged);
}

async function attachmentIds(owner: string): Promise<string[]> {
  const rows = await database().prepare('SELECT id FROM attachments WHERE owner = ?').bind(owner).all<{ id: string }>();
  return (rows.results || []).map((row) => row.id);
}

async function eraseGuestData(identity: AuthIdentity): Promise<void> {
  if (identity.kind !== 'guest') return;
  const ids = await attachmentIds(identity.owner);
  const storage = bucket();
  for (const id of ids) {
    try { await storage.delete(id); } catch { /* best-effort R2 cleanup */ }
  }
  await database().prepare('DELETE FROM attachments WHERE owner = ?').bind(identity.owner).run();
  await database().prepare('DELETE FROM workspaces WHERE owner = ?').bind(identity.owner).run();
  await database().prepare('DELETE FROM llm_limits WHERE owner = ?').bind(identity.owner).run();
}

async function promoteGuestData(identity: AuthIdentity | null, userId: string, accountName: string): Promise<void> {
  if (!identity || identity.kind !== 'guest') return;
  const guestOwner = identity.owner;
  const userOwner = `user:${userId}`;
  const db = database();
  const guestRow = (await db.prepare('SELECT payload, revision FROM workspaces WHERE owner = ?').bind(guestOwner).first()) as WorkspaceRow | null;

  if (guestRow) {
    const userRow = (await db.prepare('SELECT payload, revision FROM workspaces WHERE owner = ?').bind(userOwner).first()) as WorkspaceRow | null;
    const payload = mergeWorkspacePayload(userRow?.payload ?? null, guestRow.payload, accountName);
    if (userRow) {
      await db.prepare('UPDATE workspaces SET payload = ?, revision = revision + 1 WHERE owner = ?').bind(payload, userOwner).run();
    } else {
      await db.prepare('INSERT INTO workspaces (owner, payload, revision) VALUES (?, ?, 0)').bind(userOwner, payload).run();
    }
    await db.prepare('DELETE FROM workspaces WHERE owner = ?').bind(guestOwner).run();
  }

  // Guest uploads become account-owned only when the guest signs in/registers.
  await db.prepare('UPDATE attachments SET owner = ? WHERE owner = ?').bind(userOwner, guestOwner).run();
  await db.prepare('DELETE FROM llm_limits WHERE owner = ?').bind(guestOwner).run();
}

export async function GET(request: Request) {
  const identity = await getIdentity(request);
  if (!identity) return authJson({ authenticated: false }, 401);
  return authJson({ authenticated: true, user: publicIdentity(identity) });
}

export async function POST(request: Request) {
  try {
    mutationGuard(request);
    const body = z.object({ action: z.enum(['register', 'login', 'guest', 'logout']) }).passthrough().parse(await request.json());
    const priorIdentity = await getIdentity(request);

    if (body.action === 'logout') {
      if (priorIdentity?.kind === 'guest') await eraseGuestData(priorIdentity);
      const cookie = await destroySession(request);
      return authJson({ ok: true }, 200, cookie);
    }

    if (body.action === 'guest') {
      // Starting Guest again means a clean temporary session, never reopening an
      // earlier guest workspace.
      if (priorIdentity?.kind === 'guest') await eraseGuestData(priorIdentity);
      const guestId = crypto.randomUUID();
      const cookie = await createSession(request, { kind: 'guest', guestId });
      return authJson({ ok: true, user: { kind: 'guest', name: 'Guest', email: null, phone: null } }, 200, cookie);
    }

    if (body.action === 'register') {
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        return authJson({ error: 'Vui lòng nhập họ tên, email, số điện thoại và mật khẩu ít nhất 8 ký tự.' }, 400);
      }

      const email = normalizeEmail(parsed.data.email);
      if (!z.string().email().max(254).safeParse(email).success) return authJson({ error: 'Email không hợp lệ.' }, 400);
      const phone = normalizePhone(parsed.data.phone);
      if (!phone) return authJson({ error: 'Số điện thoại không hợp lệ. Hãy dùng mã quốc gia, ví dụ +84912345678.' }, 400);

      const existingEmail = await findExisting('email', email);
      if (existingEmail) return authJson(duplicateMessage('email'), 409);
      const existingPhone = await findExisting('phone', phone);
      if (existingPhone) return authJson(duplicateMessage('phone'), 409);

      const userId = crypto.randomUUID();
      const passwordHash = await hashPassword(parsed.data.password);
      const createdAt = new Date().toISOString();
      try {
        await database().prepare('INSERT INTO auth_users (id, email, phone, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(userId, email, phone, parsed.data.name, passwordHash, createdAt).run();
      } catch (error) {
        const duplicateEmail = await findExisting('email', email);
        if (duplicateEmail) return authJson(duplicateMessage('email'), 409);
        const duplicatePhone = await findExisting('phone', phone);
        if (duplicatePhone) return authJson(duplicateMessage('phone'), 409);
        throw error;
      }

      await promoteGuestData(priorIdentity, userId, parsed.data.name);
      const cookie = await createSession(request, { kind: 'user', userId });
      return authJson({ ok: true, user: { kind: 'user', name: parsed.data.name, email, phone } }, 201, cookie);
    }

    const parsed = credentialsSchema.safeParse(body);
    if (!parsed.success) return authJson({ error: 'Thông tin đăng nhập hoặc mật khẩu không hợp lệ.' }, 400);
    const identifier = parseIdentifier(parsed.data.identifierType, parsed.data.identifier);
    if (!identifier) return authJson({ error: 'Thông tin đăng nhập hoặc mật khẩu không đúng.' }, 401);

    const user = (parsed.data.identifierType === 'email'
      ? await database().prepare('SELECT id, email, phone, name, password_hash FROM auth_users WHERE email = ? COLLATE NOCASE LIMIT 1').bind(identifier.value).first()
      : await database().prepare('SELECT id, email, phone, name, password_hash FROM auth_users WHERE phone = ? LIMIT 1').bind(identifier.value).first()) as {
      id: string; email: string | null; phone: string | null; name: string; password_hash: string;
    } | null;

    if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) {
      return authJson({ error: 'Thông tin đăng nhập hoặc mật khẩu không đúng.', code: 'INVALID_CREDENTIALS' }, 401);
    }

    await promoteGuestData(priorIdentity, user.id, user.name);
    const cookie = await createSession(request, { kind: 'user', userId: user.id });
    return authJson({ ok: true, user: { kind: 'user', name: user.name, email: user.email, phone: user.phone } }, 200, cookie);
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) return authJson({ error: 'Yêu cầu đăng nhập không hợp lệ.' }, 400);
    if (error instanceof Error && error.message === 'FORBIDDEN') return authJson({ error: 'Request not permitted.' }, 403);
    return authJson({ error: 'Không thể xử lý đăng nhập lúc này. Vui lòng thử lại.' }, 503);
  }
}
