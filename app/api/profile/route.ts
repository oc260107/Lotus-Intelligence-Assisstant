import { z } from 'zod';
import { authIdentity, database, failure, mutationGuard } from '@/lib/server';
import { normalizeEmail, normalizePhone } from '@/lib/auth';
import { savePendingTravellerProfile } from '@/lib/pending-traveller-profile';
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

const companionSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  fullName: z.string().trim().min(2).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  documentType: z.enum(['passport', 'cccd']),
  documentNumber: z.string().trim().min(4).max(40),
  email: z.string().trim().max(254).default(''),
  phone: z.string().trim().max(32).default(''),
  address: z.string().trim().max(300).default(''),
  seatPreference: z.enum(['Aisle', 'Window', 'No preference']).optional(),
});


const preAccountTravellerSchema = companionSchema.omit({ id: true }).extend({
  email: z.string().trim().min(1).max(254),
  phone: z.string().trim().min(1).max(32),
  consent: z.literal(true),
});

const savePreAccountTravellersSchema = z.object({
  action: z.literal('save_preaccount_travellers'),
  travellers: z.array(preAccountTravellerSchema).min(1).max(8),
});

type StoredProfileRow = { encrypted_payload: string; document_fingerprint: string | null; updated_at: string };
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


async function currentProtectedProfile(userId: string): Promise<{ row: StoredProfileRow | null; fields: ProtectedPersonalProfile }> {
  const row = (await database()
    .prepare('SELECT encrypted_payload, document_fingerprint, updated_at FROM user_profiles WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first()) as StoredProfileRow | null;
  if (!row) {
    return { row: null, fields: { dateOfBirth: '', documentType: 'passport', documentNumber: '', address: '', companions: [] } };
  }
  const fields = await decryptPersonalProfile(row.encrypted_payload);
  fields.companions ??= [];
  return { row, fields };
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
      return Response.json({ complete: true, profile: null, companions: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const { row, fields } = await currentProtectedProfile(identity.userId);
    if (!row) {
      return Response.json(
        { complete: false, profile: publicProfile(identity), companions: [] },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return Response.json(
      { complete: true, profile: publicProfile(identity, fields), companions: [], updatedAt: row.updated_at },
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

    const raw = await request.json();
    if (raw?.action === 'save_preaccount_travellers') {
      const parsed = savePreAccountTravellersSchema.parse(raw);
      let saved = 0;
      for (const traveller of parsed.travellers) {
        if (!validBirthDate(traveller.dateOfBirth)) throw new Error('VALIDATION:Please enter a valid traveller date of birth.');
        const documentNumber = normalizeDocumentNumber(traveller.documentNumber);
        if (!/^[A-Z0-9]{4,40}$/.test(documentNumber)) throw new Error('VALIDATION:Traveller passport/CCCD number may contain only letters and numbers.');
        const email = normalizeEmail(traveller.email);
        if (!z.string().email().max(254).safeParse(email).success) throw new Error('VALIDATION:A valid email is required so this profile can be claimed by the traveller later.');
        const phone = normalizePhone(traveller.phone);
        if (!phone) throw new Error('VALIDATION:A phone number with country code is required so this profile can be claimed by the traveller later.');
        await savePendingTravellerProfile({
          fullName: traveller.fullName,
          dateOfBirth: traveller.dateOfBirth,
          documentType: traveller.documentType,
          documentNumber,
          email,
          phone,
          address: traveller.address,
          seatPreference: traveller.seatPreference || 'No preference',
        }, identity.userId);
        saved += 1;
      }
      return Response.json({ ok: true, saved, claimRule: 'matching-email-and-phone-on-future-registration' });
    }
    if (raw?.action === 'save_companions') {
      throw new Error('VALIDATION:Legacy companion-list storage is disabled. Use consented pre-account traveller profiles instead.');
    }
    const parsed = personalProfileSchema.parse(raw);
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
      companions: [],
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
      companions: [],
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
    if (
      error instanceof Error &&
      /pending_traveller_profiles|idx_pending_traveller_lookup_hash|idx_pending_traveller_document_fingerprint/i.test(error.message)
    ) {
      return Response.json({ error: 'That future traveller profile conflicts with an existing stored identity or contact.' }, { status: 409 });
    }
    return failure(error);
  }
}
