CREATE TABLE IF NOT EXISTS `arcade_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	`match_number` integer NOT NULL,
	`game_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`result_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_arcade_matches_room_number` ON `arcade_matches` (`room_id`,`match_number`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `arcade_score_events` (
	`event_key` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL REFERENCES `arcade_matches`(`id`) ON UPDATE no action ON DELETE cascade,
	`room_id` text NOT NULL REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	`event_type` text NOT NULL,
	`player_id` text,
	`points` integer DEFAULT 0 NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_arcade_events_room_match` ON `arcade_score_events` (`room_id`,`match_id`);
