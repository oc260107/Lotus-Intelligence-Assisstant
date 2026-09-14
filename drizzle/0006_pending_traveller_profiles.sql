CREATE TABLE `pending_traveller_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `lookup_hash` text NOT NULL,
  `document_fingerprint` text NOT NULL,
  `encrypted_payload` text NOT NULL,
  `consented_by_user_id` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pending_traveller_lookup_hash` ON `pending_traveller_profiles` (`lookup_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pending_traveller_document_fingerprint` ON `pending_traveller_profiles` (`document_fingerprint`);
