CREATE TABLE `avatar_live_poses` (
	`scope` text NOT NULL,
	`player_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`pose_json` text NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`scope`, `player_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_avatar_poses_expiry` ON `avatar_live_poses` (`expires_at`);