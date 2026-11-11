ALTER TABLE `arcade_phone_rooms` ADD `bot_enabled_json` text DEFAULT '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true}' NOT NULL;--> statement-breakpoint
ALTER TABLE `arcade_phone_rooms` ADD `active_seats_json` text;--> statement-breakpoint
ALTER TABLE `arcade_phone_rooms` ADD `version` integer DEFAULT 1 NOT NULL;