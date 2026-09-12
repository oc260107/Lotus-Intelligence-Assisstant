PRAGMA foreign_keys = OFF;
--> statement-breakpoint
CREATE TABLE `auth_users_new` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text COLLATE NOCASE,
  `phone` text,
  `name` text NOT NULL,
  `password_hash` text NOT NULL,
  `created_at` text NOT NULL,
  CHECK (`email` IS NOT NULL OR `phone` IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `auth_users_new` (`id`, `email`, `phone`, `name`, `password_hash`, `created_at`)
SELECT `id`, `email`, NULL, `name`, `password_hash`, `created_at` FROM `auth_users`;
--> statement-breakpoint
DROP TABLE `auth_users`;
--> statement-breakpoint
ALTER TABLE `auth_users_new` RENAME TO `auth_users`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_users_email` ON `auth_users` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_users_phone` ON `auth_users` (`phone`);
--> statement-breakpoint
PRAGMA foreign_keys = ON;
