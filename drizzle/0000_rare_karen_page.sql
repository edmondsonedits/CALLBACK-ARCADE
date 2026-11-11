CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`round_id` text NOT NULL,
	`player_id` text NOT NULL,
	`text` text NOT NULL,
	`normalized_text` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`submitted_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_answers_round_player_unique` ON `answers` (`round_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `idx_answers_room_round` ON `answers` (`room_id`,`round_id`);--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`round_id` text NOT NULL,
	`player_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_assignments_round_player_kind` ON `assignments` (`round_id`,`player_id`,`kind`);--> statement-breakpoint
CREATE TABLE `callbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`round_id` text NOT NULL,
	`lore_id` text NOT NULL,
	`source_author_id` text,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_callbacks_round_lore_unique` ON `callbacks` (`round_id`,`lore_id`);--> statement-breakpoint
CREATE TABLE `cleanup_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`object_key` text,
	`run_after` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cleanup_queue_run_after` ON `cleanup_queue` (`run_after`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`round_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`prompt_json` text NOT NULL,
	`lease_owner` text,
	`lease_expires_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`object_key` text,
	`content_type` text,
	`byte_size` integer,
	`safety` text,
	`error_code` text,
	`updated_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_jobs_prompt_hash_unique` ON `jobs` (`prompt_hash`);--> statement-breakpoint
CREATE INDEX `idx_jobs_room_status` ON `jobs` (`room_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_jobs_status_lease` ON `jobs` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE TABLE `lore` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`round_id` text NOT NULL,
	`source_answer_id` text,
	`author_player_id` text,
	`kind` text NOT NULL,
	`short_meaning` text NOT NULL,
	`payload_json` text NOT NULL,
	`safety` text NOT NULL,
	`used_at` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_lore_room_used` ON `lore` (`room_id`,`used_at`);--> statement-breakpoint
CREATE TABLE `metrics_daily` (
	`day` text NOT NULL,
	`metric` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `metric`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`nickname` text NOT NULL,
	`nickname_normalized` text NOT NULL,
	`role` text NOT NULL,
	`seat` integer NOT NULL,
	`avatar` integer NOT NULL,
	`color` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`pending_activation` integer DEFAULT false NOT NULL,
	`connected_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`removed_at` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_players_room_name_unique` ON `players` (`room_id`,`nickname_normalized`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_players_room_seat_unique` ON `players` (`room_id`,`seat`);--> statement-breakpoint
CREATE INDEX `idx_players_room_role` ON `players` (`room_id`,`role`);--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`round_id` text NOT NULL,
	`player_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_predictions_round_player_kind_unique` ON `predictions` (`round_id`,`player_id`,`kind`);--> statement-breakpoint
CREATE TABLE `processed_actions` (
	`room_id` text NOT NULL,
	`action_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action_type` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`room_id`, `action_id`)
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expiry` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`host_token_hash` text NOT NULL,
	`phase` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`last_action_id` text,
	`state_json` text NOT NULL,
	`status` text DEFAULT 'LOBBY' NOT NULL,
	`game_length` text DEFAULT 'standard' NOT NULL,
	`content_mode` text DEFAULT 'party' NOT NULL,
	`deadline_at` integer,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rooms_code_unique` ON `rooms` (`code`);--> statement-breakpoint
CREATE INDEX `idx_rooms_expiry` ON `rooms` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_rooms_status_updated` ON `rooms` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`round_index` integer NOT NULL,
	`kind` text NOT NULL,
	`prompt_id` text,
	`state_json` text DEFAULT '{}' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rounds_room_index_unique` ON `rounds` (`room_id`,`round_index`);--> statement-breakpoint
CREATE INDEX `idx_rounds_room_kind` ON `rounds` (`room_id`,`kind`);--> statement-breakpoint
CREATE TABLE `score_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_key` text NOT NULL,
	`room_id` text NOT NULL,
	`round_id` text NOT NULL,
	`player_id` text NOT NULL,
	`kind` text NOT NULL,
	`points` integer NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_score_events_key_unique` ON `score_events` (`event_key`);--> statement-breakpoint
CREATE INDEX `idx_score_events_room_player` ON `score_events` (`room_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `idx_score_events_room_round` ON `score_events` (`room_id`,`round_id`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`round_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`answer_id` text NOT NULL,
	`rank` integer NOT NULL,
	`weight` integer NOT NULL,
	`audience` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_votes_round_voter_rank_unique` ON `votes` (`round_id`,`voter_id`,`rank`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_votes_round_voter_answer_unique` ON `votes` (`round_id`,`voter_id`,`answer_id`);--> statement-breakpoint
CREATE INDEX `idx_votes_room_round` ON `votes` (`room_id`,`round_id`);
--> statement-breakpoint
PRAGMA optimize;
