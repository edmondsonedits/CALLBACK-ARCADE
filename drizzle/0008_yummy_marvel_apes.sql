CREATE TABLE `callback_code_registry` (
	`code` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `callback_session_games` (
	`id` text PRIMARY KEY NOT NULL,
	`session_code` text NOT NULL,
	`child_kind` text NOT NULL,
	`child_code` text,
	`active` integer DEFAULT 1 NOT NULL,
	`game_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_session_game_child` ON `callback_session_games` (`child_kind`,`child_code`,`active`);--> statement-breakpoint
CREATE TABLE `callback_session_members` (
	`id` text PRIMARY KEY NOT NULL,
	`session_code` text NOT NULL,
	`seat` integer NOT NULL,
	`token_hash` text NOT NULL,
	`nickname` text NOT NULL,
	`nickname_normalized` text NOT NULL,
	`avatar_json` text,
	`avatar_preset` text,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_seat` ON `callback_session_members` (`session_code`,`seat`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token` ON `callback_session_members` (`session_code`,`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_nickname` ON `callback_session_members` (`session_code`,`nickname_normalized`);--> statement-breakpoint
CREATE INDEX `idx_session_member_room` ON `callback_session_members` (`session_code`);--> statement-breakpoint
CREATE TABLE `callback_sessions` (
	`code` text PRIMARY KEY NOT NULL,
	`host_token_hash` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`stage` text DEFAULT 'SELECTING' NOT NULL,
	`active_id` text,
	`last_action_id` text,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `character_profiles` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`profile_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_character_profiles_updated` ON `character_profiles` (`updated_at`);