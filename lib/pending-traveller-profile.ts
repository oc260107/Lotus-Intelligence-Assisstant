import { database } from '@/lib/server-db';
import { normalizeEmail, normalizePhone } from '@/lib/auth';
import {
  decryptPendingTravellerProfile,
  documentFingerprint,
  encryptPendingTravellerProfile,
  encryptPersonalProfile,
  travellerContactFingerprint,
  type PendingTravellerProfilePayload,
  type ProtectedPersonalProfile,
} from '@/lib/profile-crypto';

export async function savePendingTravellerProfile(
  payload: PendingTravellerProfilePayload,
  consentedByUserId: string,
) {
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  if (!email || !phone) throw new Error('VALIDATION:Email and phone are required when saving a future traveller profile.');

  const lookupHash = await travellerContactFingerprint(email, phone);
  const docFingerprint = await documentFingerprint(payload.documentType, payload.documentNumber);
  const db = database();

  const existingAccount = await db
    .prepare(`SELECT u.id
      FROM auth_users u
      WHERE (u.email = ? COLLATE NOCASE OR u.phone = ?)
      LIMIT 1`)
    .bind(email, phone)
    .first();
  if (existingAccount) {
    throw new Error('VALIDATION:This traveller already has a LIA account. They should manage their own personal profile after signing in.');
  }

  const activeDocument = await db
    .prepare('SELECT user_id FROM user_profiles WHERE document_fingerprint = ? LIMIT 1')
    .bind(docFingerprint)
    .first();
  if (activeDocument) throw new Error('VALIDATION:This passport/CCCD is already linked to an existing account.');

  const existingPending = (await db
    .prepare('SELECT id, lookup_hash FROM pending_traveller_profiles WHERE document_fingerprint = ? LIMIT 1')
    .bind(docFingerprint)
    .first()) as { id: string; lookup_hash: string } | null;
  if (existingPending && existingPending.lookup_hash !== lookupHash) {
    throw new Error('VALIDATION:This passenger document is already stored for a different future-account contact.');
  }

  const encryptedPayload = await encryptPendingTravellerProfile({ ...payload, email, phone });
  const now = new Date().toISOString();
  const id = existingPending?.id || crypto.randomUUID();
  await db
    .prepare(`INSERT INTO pending_traveller_profiles
      (id, lookup_hash, document_fingerprint, encrypted_payload, consented_by_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(lookup_hash) DO UPDATE SET
        document_fingerprint = excluded.document_fingerprint,
        encrypted_payload = excluded.encrypted_payload,
        consented_by_user_id = excluded.consented_by_user_id,
        updated_at = excluded.updated_at`)
    .bind(id, lookupHash, docFingerprint, encryptedPayload, consentedByUserId, now, now)
    .run();
  return { id, saved: true };
}

export async function claimPendingTravellerProfile(userId: string, rawEmail: string, rawPhone: string) {
  const email = normalizeEmail(rawEmail);
  const phone = normalizePhone(rawPhone);
  if (!email || !phone) return null;
  const lookupHash = await travellerContactFingerprint(email, phone);
  const db = database();
  const row = (await db
    .prepare(`SELECT id, encrypted_payload, document_fingerprint
      FROM pending_traveller_profiles
      WHERE lookup_hash = ?
      LIMIT 1`)
    .bind(lookupHash)
    .first()) as { id: string; encrypted_payload: string; document_fingerprint: string } | null;
  if (!row) return null;

  const pending = await decryptPendingTravellerProfile(row.encrypted_payload);
  const fields: ProtectedPersonalProfile = {
    dateOfBirth: pending.dateOfBirth,
    documentType: pending.documentType,
    documentNumber: pending.documentNumber,
    address: pending.address,
    companions: [],
  };
  const encryptedPayload = await encryptPersonalProfile(fields);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO user_profiles (user_id, encrypted_payload, document_fingerprint, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        encrypted_payload = excluded.encrypted_payload,
        document_fingerprint = excluded.document_fingerprint,
        updated_at = excluded.updated_at`)
      .bind(userId, encryptedPayload, row.document_fingerprint, now),
    db.prepare('DELETE FROM pending_traveller_profiles WHERE id = ?').bind(row.id),
  ]);
  return pending;
}
