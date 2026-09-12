CREATE TABLE `auth_users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL COLLATE NOCASE,
  `name` text NOT NULL,
  `password_hash` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_users_email` ON `auth_users` (`email`);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `user_id` text,
  `guest_id` text,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_user` ON `auth_sessions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_guest` ON `auth_sessions` (`guest_id`);
--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_expiry` ON `auth_sessions` (`expires_at`);
