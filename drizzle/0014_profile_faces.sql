CREATE TABLE `profile_face_jobs` (
  `job_id` text PRIMARY KEY NOT NULL,
  `profile_hash` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `request_hash` text NOT NULL,
  `status` text NOT NULL,
  `face_id` text,
  `error_code` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profile_face_jobs_profile_key` ON `profile_face_jobs` (`profile_hash`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_profile_face_jobs_updated` ON `profile_face_jobs` (`updated_at`);
--> statement-breakpoint
CREATE TABLE `profile_faces` (
  `face_id` text PRIMARY KEY NOT NULL,
  `profile_hash` text NOT NULL,
  `object_key` text NOT NULL,
  `content_type` text NOT NULL,
  `byte_size` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_faces_object_key_unique` ON `profile_faces` (`object_key`);
--> statement-breakpoint
CREATE INDEX `idx_profile_faces_owner` ON `profile_faces` (`profile_hash`,`created_at`);
