CREATE TABLE `llm_limits` (
	`owner` text PRIMARY KEY NOT NULL,
	`minute` integer NOT NULL,
	`count` integer NOT NULL,
	`day` text NOT NULL,
	`daily_count` integer NOT NULL
);
