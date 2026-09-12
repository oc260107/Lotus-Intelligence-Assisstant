import { env } from 'cloudflare:workers';

export type ProtectedPersonalProfile = {
  dateOfBirth: string;
  documentType: 'passport' | 'cccd';
  documentNumber: string;
  address: string;
};

const VERSION = 'v1';
const AAD = new TextEncoder().encode('lia-personal-profile-v1');

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

export async function encryptPersonalProfile(payload: ProtectedPersonalProfile): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await encryptionKey();
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, plaintext);
  return `${VERSION}.${bytesToHex(iv)}.${bytesToHex(new Uint8Array(encrypted))}`;
}

export async function decryptPersonalProfile(value: string): Promise<ProtectedPersonalProfile> {
  const [version, ivHex, cipherHex] = value.split('.');
  if (version !== VERSION || !ivHex || !cipherHex) throw new Error('PROFILE_DECRYPT');
  const key = await encryptionKey();
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: hexToBytes(ivHex), additionalData: AAD },
      key,
      hexToBytes(cipherHex),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as ProtectedPersonalProfile;
  } catch {
    throw new Error('PROFILE_DECRYPT');
  }
}
