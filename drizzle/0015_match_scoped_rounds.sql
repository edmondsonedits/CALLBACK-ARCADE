-- Keep legacy rounds and published archives; current matches use their own round IDs.
CREATE TABLE IF NOT EXISTS `match_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`match_number` integer NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS `idx_match_rounds_room_match_index_unique` ON `match_rounds` (`room_id`,`match_number`,`round_index`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_match_rounds_room_match` ON `match_rounds` (`room_id`,`match_number`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `callback_schema_migrations` (
	`id` text PRIMARY KEY NOT NULL
);

--> statement-breakpoint
INSERT OR IGNORE INTO match_rounds(id,room_id,match_number,round_index,kind,prompt_id,state_json,started_at,completed_at,created_at)
   SELECT COALESCE(NULLIF(json_extract(r.state_json,'$.id'),''),r.id),r.room_id,
     COALESCE(json_extract(room.state_json,'$.matchNumber'),1),r.round_index,
     COALESCE(json_extract(r.state_json,'$.kind'),r.kind),
     COALESCE(json_extract(r.state_json,'$.promptId'),r.prompt_id),r.state_json,
     COALESCE(json_extract(r.state_json,'$.startedAt'),r.started_at),r.completed_at,r.created_at
   FROM rounds r JOIN rooms room ON room.id=r.room_id
   WHERE json_valid(r.state_json) AND json_valid(room.state_json)
     AND (r.round_index<=COALESCE(json_extract(room.state_json,'$.roundIndex'),-1)
       OR json_extract(r.state_json,'$.id')=json_extract(room.state_json,'$.currentRound.id'))
     AND NOT EXISTS(SELECT 1 FROM callback_schema_migrations WHERE id='match-rounds-v1');
--> statement-breakpoint
INSERT OR IGNORE INTO callback_schema_migrations(id) VALUES('match-rounds-v1');
