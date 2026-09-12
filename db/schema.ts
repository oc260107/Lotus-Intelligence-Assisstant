import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  owner: text('owner').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(0),
});

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    mime: text('mime').notNull(),
    expires: text('expires').notNull(),
  },
  (t) => [index('idx_attachments_owner').on(t.owner)],
);

export const llmLimits = sqliteTable('llm_limits', {
  owner: text('owner').primaryKey(),
  minute: integer('minute').notNull(),
  count: integer('count').notNull(),
  day: text('day').notNull(),
  dailyCount: integer('daily_count').notNull(),
});

export const authUsers = sqliteTable(
  'auth_users',
  {
    id: text('id').primaryKey(),
    email: text('email'),
    phone: text('phone'),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('idx_auth_users_email').on(t.email),
    uniqueIndex('idx_auth_users_phone').on(t.phone),
  ],
);

export const authSessions = sqliteTable(
  'auth_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    kind: text('kind').notNull(),
    userId: text('user_id').references(() => authUsers.id, { onDelete: 'cascade' }),
    guestId: text('guest_id'),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (t) => [
    index('idx_auth_sessions_user').on(t.userId),
    index('idx_auth_sessions_guest').on(t.guestId),
    index('idx_auth_sessions_expiry').on(t.expiresAt),
  ],
);


export const userProfiles = sqliteTable(
  'user_profiles',
  {
    userId: text('user_id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
    encryptedPayload: text('encrypted_payload').notNull(),
    documentFingerprint: text('document_fingerprint'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('idx_user_profiles_document_fingerprint').on(t.documentFingerprint)],
);
