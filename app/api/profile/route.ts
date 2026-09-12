import { z } from 'zod';
import { authIdentity, database, failure, mutationGuard } from '@/lib/server';
import { normalizeEmail, normalizePhone } from '@/lib/auth';
import {
  decryptPersonalProfile,
  documentFingerprint,
  encryptPersonalProfile,
  normalizeDocumentNumber,
  type ProtectedPersonalProfile,
} from '@/lib/profile-crypto';

const personalProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  dateOfBirth: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  documentType: z.enum(['passport', 'cccd']),
  documentNumber: z.string().trim().max(40),
  email: z.string().trim().min(1).max(254),
  phone: z.string().trim().min(1).max(32),
  address: z.string().trim().max(300),
});

type StoredProfileRow = { encrypted_payload: string; updated_at: string };
type LegacyProfileRow = { user_id: string; encrypted_payload: string };

function validBirthDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= new Date().toISOString().slice(0, 10);
}

function publicProfile(
  identity: { name: string; email: string | null; phone: string | null },
  protectedFields?: ProtectedPersonalProfile,
) {
  return {
    fullName: identity.name || '',
    dateOfBirth: protectedFields?.dateOfBirth || '',
    documentType: protectedFields?.documentType || 'passport',
    documentNumber: protectedFields?.documentNumber || '',
    email: identity.email || '',
    phone: identity.phone || '',
    address: protectedFields?.address || '',
  };
}

async function ensureDocumentIsUnique(
  userId: string,
  documentType: ProtectedPersonalProfile['documentType'],
  documentNumber: string,
) {
  const db = database();
  const fingerprint = await documentFingerprint(documentType, documentNumber);

  const indexedMatch = await db
    .prepare('SELECT user_id FROM user_profiles WHERE document_fingerprint = ? AND user_id <> ? LIMIT 1')
    .bind(fingerprint, userId)
    .first();
  if (indexedMatch) throw new Error('VALIDATION:That passport/CCCD number is already linked to another account.');

  // Profiles created before the uniqueness migration have a NULL fingerprint.
  // Compare those encrypted rows once so existing data is also protected from duplicates.
  const legacy = (await db
    .prepare('SELECT user_id, encrypted_payload FROM user_profiles WHERE document_fingerprint IS NULL AND user_id <> ?')
    .bind(userId)
    .all()) as { results?: LegacyProfileRow[] };

  const wantedNumber = normalizeDocumentNumber(documentNumber);
  for (const row of legacy.results || []) {
    const existing = await decryptPersonalProfile(row.encrypted_payload);
    if (
      existing.documentType === documentType &&
      normalizeDocumentNumber(existing.documentNumber) === wantedNumber
    ) {
      throw new Error('VALIDATION:That passport/CCCD number is already linked to another account.');
    }
  }

  return fingerprint;
}

export async function GET(request: Request) {
  try {
    const identity = await authIdentity(request);
    if (identity.kind === 'guest') {
      return Response.json({ complete: true, profile: null }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const row = (await database()
      .prepare('SELECT encrypted_payload, updated_at FROM user_profiles WHERE user_id = ? LIMIT 1')
      .bind(identity.userId)
      .first()) as StoredProfileRow | null;

    if (!row) {
      return Response.json(
        { complete: false, profile: publicProfile(identity) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const protectedFields = await decryptPersonalProfile(row.encrypted_payload);
    return Response.json(
      { complete: true, profile: publicProfile(identity, protectedFields), updatedAt: row.updated_at },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    mutationGuard(request);
    const identity = await authIdentity(request);
    if (identity.kind !== 'user' || !identity.userId) throw new Error('VALIDATION:Guest sessions do not store identity documents.');

    const parsed = personalProfileSchema.parse(await request.json());
    if (parsed.dateOfBirth && !validBirthDate(parsed.dateOfBirth)) throw new Error('VALIDATION:Please enter a valid date of birth.');

    const email = normalizeEmail(parsed.email);
    if (!z.string().email().max(254).safeParse(email).success) throw new Error('VALIDATION:Please enter a valid email address.');

    const phone = normalizePhone(parsed.phone);
    if (!phone) throw new Error('VALIDATION:Please enter a phone number with country code, for example +84912345678.');

    const documentNumber = normalizeDocumentNumber(parsed.documentNumber);
    if (documentNumber && !/^[A-Z0-9]{4,40}$/.test(documentNumber)) {
      throw new Error('VALIDATION:Passport/CCCD number may contain only letters and numbers.');
    }

    const existingEmail = await database()
      .prepare('SELECT id FROM auth_users WHERE email = ? COLLATE NOCASE AND id <> ? LIMIT 1')
      .bind(email, identity.userId)
      .first();
    if (existingEmail) throw new Error('VALIDATION:That email is already linked to another account.');

    const existingPhone = await database()
      .prepare('SELECT id FROM auth_users WHERE phone = ? AND id <> ? LIMIT 1')
      .bind(phone, identity.userId)
      .first();
    if (existingPhone) throw new Error('VALIDATION:That phone number is already linked to another account.');

    const fingerprint = documentNumber
      ? await ensureDocumentIsUnique(identity.userId, parsed.documentType, documentNumber)
      : null;

    const protectedFields: ProtectedPersonalProfile = {
      dateOfBirth: parsed.dateOfBirth,
      documentType: parsed.documentType,
      documentNumber,
      address: parsed.address,
    };
    const encryptedPayload = await encryptPersonalProfile(protectedFields);
    const updatedAt = new Date().toISOString();

    await database().batch([
      database()
        .prepare('UPDATE auth_users SET name = ?, email = ?, phone = ? WHERE id = ?')
        .bind(parsed.fullName, email, phone, identity.userId),
      database()
        .prepare(
          `INSERT INTO user_profiles (user_id, encrypted_payload, document_fingerprint, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             encrypted_payload = excluded.encrypted_payload,
             document_fingerprint = excluded.document_fingerprint,
             updated_at = excluded.updated_at`,
        )
        .bind(identity.userId, encryptedPayload, fingerprint, updatedAt),
    ]);

    return Response.json({
      ok: true,
      complete: true,
      updatedAt,
      profile: {
        fullName: parsed.fullName,
        dateOfBirth: parsed.dateOfBirth,
        documentType: parsed.documentType,
        documentNumber,
        email,
        phone,
        address: parsed.address,
      },
      user: { kind: 'user', name: parsed.fullName, email, phone },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Please check the personal information you entered.' }, { status: 400 });
    }
    if (
      error instanceof Error &&
      /user_profiles\.document_fingerprint|idx_user_profiles_document_fingerprint/i.test(error.message)
    ) {
      return Response.json({ error: 'That passport/CCCD number is already linked to another account.' }, { status: 409 });
    }
    return failure(error);
  }
}
