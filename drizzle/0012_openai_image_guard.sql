CREATE TABLE `openai_image_reservations` (
  `job_id` text PRIMARY KEY NOT NULL,
  `room_id` text NOT NULL,
  `credit_window_id` text NOT NULL,
  `reserved_at` integer NOT NULL,
  `day_utc` text NOT NULL,
  `billing_blocked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_openai_image_reservations_window` ON `openai_image_reservations` (`credit_window_id`);
--> statement-breakpoint
CREATE INDEX `idx_openai_image_reservations_day` ON `openai_image_reservations` (`credit_window_id`,`day_utc`);
--> statement-breakpoint
CREATE INDEX `idx_openai_image_reservations_room` ON `openai_image_reservations` (`credit_window_id`,`room_id`);
--> statement-breakpoint
CREATE TABLE `openai_image_circuits` (
  `credit_window_id` text PRIMARY KEY NOT NULL,
  `created_at` integer NOT NULL
);
