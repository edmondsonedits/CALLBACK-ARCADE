CREATE TABLE `player_creations` (
  `creation_id` text PRIMARY KEY NOT NULL,
  `profile_hash` text NOT NULL,
  `kind` text NOT NULL CHECK (`kind` IN ('scenery', 'fish')),
  `title` text DEFAULT '' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  `share_in_rooms` integer DEFAULT 0 NOT NULL CHECK (`share_in_rooms` IN (0, 1)),
  `revision` integer DEFAULT 0 NOT NULL,
  `state` text DEFAULT 'draft' NOT NULL CHECK (`state` IN ('draft', 'ready')),
  `draft_json` text NOT NULL,
  `placement_json` text NOT NULL,
  `current_object_key` text,
  `current_sha256` text,
  `current_byte_size` integer
);
--> statement-breakpoint
CREATE INDEX `idx_player_creations_owner` ON `player_creations` (`profile_hash`,`deleted_at`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_player_creations_room_share` ON `player_creations` (`profile_hash`,`share_in_rooms`,`deleted_at`,`state`);
--> statement-breakpoint
CREATE TABLE `player_creation_revisions` (
  `creation_id` text NOT NULL,
  `revision` integer NOT NULL,
  `idempotency_key` text NOT NULL,
  `source_json` text NOT NULL,
  `placement_json` text NOT NULL,
  `object_key` text NOT NULL,
  `sha256` text NOT NULL,
  `byte_size` integer NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`creation_id`, `revision`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_player_creation_revisions_object` ON `player_creation_revisions` (`object_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_player_creation_idempotency` ON `player_creation_revisions` (`creation_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_player_creation_revisions_created` ON `player_creation_revisions` (`creation_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER `trg_player_creations_scenery_limit` BEFORE INSERT ON `player_creations`
WHEN NEW.`kind` = 'scenery' AND (SELECT COUNT(*) FROM `player_creations` WHERE `profile_hash` = NEW.`profile_hash` AND `kind` = 'scenery' AND `deleted_at` IS NULL) >= 20
BEGIN SELECT RAISE(ABORT, 'SCENERY_LIBRARY_FULL'); END;
