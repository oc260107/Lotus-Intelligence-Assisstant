ALTER TABLE `user_profiles` ADD COLUMN `document_fingerprint` text;
CREATE UNIQUE INDEX `idx_user_profiles_document_fingerprint` ON `user_profiles` (`document_fingerprint`);
