import { env } from 'cloudflare:workers';

export type ProtectedTravelCompanion = {
  id: string;
  fullName: string;
  dateOfBirth: string;
  documentType: 'passport' | 'cccd';
  documentNumber: string;
  email: string;
  phone: string;
  address: string;
  seatPreference?: 'Aisle' | 'Window' | 'No preference';
};


export type PendingTravellerProfilePayload = {
  fullName: string;
  dateOfBirth: string;
  documentType: 'passport' | 'cccd';
  documentNumber: string;
  email: string;
  phone: string;
  address: string;
  seatPreference?: 'Aisle' | 'Window' | 'No preference';
};

export type ProtectedPersonalProfile = {
  dateOfBirth: string;
  documentType: 'passport' | 'cccd';
  documentNumber: string;
  address: string;
  companions?: ProtectedTravelCompanion[];
};

const VERSION = 'v1';
const AAD = new TextEncoder().encode('lia-personal-profile-v1');
const PENDING_AAD = new TextEncoder().encode('lia-pending-traveller-profile-v1');

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array {
  if (!value || value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
    throw new Error('PROFILE_DECRYPT');
  }
  const result = new Uint8Array(value.length / 2);
  for (let i = 0; i < result.length; i += 1) {
    result[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return result;
}

function profileSecret(): string {
  const secret = (env as unknown as { PROFILE_ENCRYPTION_KEY?: string }).PROFILE_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error('PROFILE_KEY_MISSING');
  return secret;
}

async function encryptionKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(profileSecret()));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export function normalizeDocumentNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s.\-_/]+/g, '');
}

export async function documentFingerprint(
  documentType: ProtectedPersonalProfile['documentType'],
  documentNumber: string,
): Promise<string> {
  const secret = profileSecret();
  const keySeed = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`lia-document-fingerprint-v1:${secret}`),
  );
  const key = await crypto.subtle.importKey(
    'raw',
    keySeed,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const normalized = normalizeDocumentNumber(documentNumber);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${documentType}:${normalized}`),
  );
  return `v1.${bytesToHex(new Uint8Array(signature))}`;
}

async function encryptJson(payload: unknown, aad: Uint8Array): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await encryptionKey();
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plaintext);
  return `${VERSION}.${bytesToHex(iv)}.${bytesToHex(new Uint8Array(encrypted))}`;
}

async function decryptJson<T>(value: string, aad: Uint8Array): Promise<T> {
  const [version, ivHex, cipherHex] = value.split('.');
  if (version !== VERSION || !ivHex || !cipherHex) throw new Error('PROFILE_DECRYPT');
  const key = await encryptionKey();
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: hexToBytes(ivHex), additionalData: aad },
      key,
      hexToBytes(cipherHex),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    throw new Error('PROFILE_DECRYPT');
  }
}

export async function encryptPersonalProfile(payload: ProtectedPersonalProfile): Promise<string> {
  return encryptJson(payload, AAD);
}

export async function decryptPersonalProfile(value: string): Promise<ProtectedPersonalProfile> {
  const parsed = await decryptJson<ProtectedPersonalProfile>(value, AAD);
  if (!Array.isArray(parsed.companions)) parsed.companions = [];
  return parsed;
}

export async function travellerContactFingerprint(email: string, phone: string): Promise<string> {
  const secret = profileSecret();
  const keySeed = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`lia-traveller-contact-fingerprint-v1:${secret}`),
  );
  const key = await crypto.subtle.importKey('raw', keySeed, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${email.trim().toLowerCase()}|${phone.trim()}`));
  return `v1.${bytesToHex(new Uint8Array(signature))}`;
}

export async function encryptPendingTravellerProfile(payload: PendingTravellerProfilePayload): Promise<string> {
  return encryptJson(payload, PENDING_AAD);
}

export async function decryptPendingTravellerProfile(value: string): Promise<PendingTravellerProfilePayload> {
  return decryptJson<PendingTravellerProfilePayload>(value, PENDING_AAD);
}
