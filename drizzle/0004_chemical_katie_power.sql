CREATE TABLE IF NOT EXISTS `media_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`target_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `media_signals` RENAME COLUMN `target_id` TO `recipient_id`;
--> statement-breakpoint
ALTER TABLE `media_signals` ADD COLUMN `expires_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `media_signals` SET `expires_at` = `created_at` + 120000 WHERE `expires_at` = 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_media_signals_recipient_expiry` ON `media_signals` (`room_id`,`recipient_id`,`expires_at`);
