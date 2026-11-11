CREATE TABLE `callback_session_mirror_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`session_code` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `callback_session_mirror_codes_session_code_unique` ON `callback_session_mirror_codes` (`session_code`);--> statement-breakpoint
CREATE TABLE `callback_session_mirrors` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`session_code` text NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_session_mirrors_room` ON `callback_session_mirrors` (`session_code`);--> statement-breakpoint
CREATE TABLE `callback_session_presentations` (
	`session_code` text PRIMARY KEY NOT NULL,
	`presentation_json` text NOT NULL
);
