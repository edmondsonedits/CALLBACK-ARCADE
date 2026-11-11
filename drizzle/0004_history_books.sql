CREATE TABLE `history_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`match_number` integer NOT NULL,
	`room_code` text NOT NULL,
	`game_length` text NOT NULL,
	`title` text NOT NULL,
	`player_count` integer NOT NULL,
	`winner_names` text NOT NULL,
	`played_at` integer NOT NULL,
	`archive_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_history_room_match_unique` ON `history_matches` (`room_id`,`match_number`);--> statement-breakpoint
CREATE INDEX `idx_history_played_at` ON `history_matches` (`played_at`);--> statement-breakpoint
CREATE INDEX `idx_history_game_length` ON `history_matches` (`game_length`,`played_at`);--> statement-breakpoint
CREATE TABLE `history_media` (
	`match_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`match_id`, `asset_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_history_media_match` ON `history_media` (`match_id`);
