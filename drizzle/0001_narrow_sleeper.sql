CREATE TABLE `lore_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`round_id` text NOT NULL,
	`from_lore_id` text NOT NULL,
	`relation` text NOT NULL,
	`to_lore_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lore_edges_relation_unique` ON `lore_edges` (`room_id`,`from_lore_id`,`relation`,`to_lore_id`);--> statement-breakpoint
CREATE INDEX `idx_lore_edges_room_round` ON `lore_edges` (`room_id`,`round_id`);