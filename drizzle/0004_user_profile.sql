CREATE TABLE `user_profiles` (
  `user_id` text PRIMARY KEY NOT NULL,
  `encrypted_payload` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
