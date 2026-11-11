CREATE TABLE `arcade_phone_inputs` (
	`room_code` text NOT NULL,
	`seat` integer NOT NULL,
	`seq` integer NOT NULL,
	`packet_json` text NOT NULL,
	`received_at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `seat`, `seq`),
	FOREIGN KEY (`room_code`,`seat`) REFERENCES `arcade_phone_seats`(`room_code`,`seat`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_arcade_phone_inputs_age` ON `arcade_phone_inputs` (`room_code`,`received_at`);--> statement-breakpoint
CREATE TABLE `arcade_phone_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`game` text NOT NULL,
	`host_token_hash` text NOT NULL,
	`status_json` text NOT NULL,
	`private_states_json` text DEFAULT '{}' NOT NULL,
	`host_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`closed` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "arcade_phone_closed_check" CHECK("arcade_phone_rooms"."closed" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `idx_arcade_phone_rooms_expiry` ON `arcade_phone_rooms` (`expires_at`);--> statement-breakpoint
CREATE TABLE `arcade_phone_seats` (
	`room_code` text NOT NULL,
	`seat` integer NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_seq` integer DEFAULT 0 NOT NULL,
	`last_seen_at` integer NOT NULL,
	`input_at` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`room_code`, `seat`),
	FOREIGN KEY (`room_code`) REFERENCES `arcade_phone_rooms`(`code`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "arcade_phone_seat_check" CHECK("arcade_phone_seats"."seat" >= 0 AND "arcade_phone_seats"."seat" < 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_arcade_phone_seat_token` ON `arcade_phone_seats` (`room_code`,`token_hash`);