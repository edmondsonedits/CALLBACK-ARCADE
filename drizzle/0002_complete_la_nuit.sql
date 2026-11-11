CREATE TABLE `feedback_votes` (
	`event_key` text PRIMARY KEY NOT NULL,
	`pair_id` text NOT NULL,
	`choice_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
