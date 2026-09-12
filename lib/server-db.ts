import { env } from 'cloudflare:workers';

export function database() {
  const db = (env as any).DB as D1Database;
  if (!db) throw new Error('Storage unavailable');
  return db;
}

export function bucket() {
  return (env as any).BUCKET as R2Bucket;
}
