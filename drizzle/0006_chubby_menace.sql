-- Adds online Arcade transport only; earlier migration-owned tables are retained.
CREATE TABLE `online_arcade_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`host_token_hash` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `online_arcade_results` (
	`event_key` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`match_id` text NOT NULL,
	`result_json` text NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `online_arcade_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `online_arcade_seats` (
	`room_code` text NOT NULL,
	`seat_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`nickname` text NOT NULL,
	`nickname_normalized` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`input_json` text DEFAULT '{}' NOT NULL,
	`last_seen_at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `seat_id`),
	FOREIGN KEY (`room_code`) REFERENCES `online_arcade_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_online_arcade_expiry` ON `online_arcade_rooms` (`expires_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_online_arcade_seat_name` ON `online_arcade_seats` (`room_code`,`nickname_normalized`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_online_arcade_seat_token` ON `online_arcade_seats` (`room_code`,`token_hash`);
