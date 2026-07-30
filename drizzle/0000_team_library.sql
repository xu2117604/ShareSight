CREATE TABLE `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `phone` text NOT NULL,
  `name` text NOT NULL,
  `password_hash` text NOT NULL,
  `role` text DEFAULT 'member' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);
--> statement-breakpoint
CREATE INDEX `users_created_at_idx` ON `users` (`created_at`);
--> statement-breakpoint
CREATE TABLE `files` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `object_key` text NOT NULL,
  `title` text NOT NULL,
  `file_name` text NOT NULL,
  `file_size` integer NOT NULL,
  `content_type` text NOT NULL,
  `category` text NOT NULL,
  `folder` text DEFAULT '0' NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `uploader_phone` text NOT NULL,
  `uploader_name` text NOT NULL,
  `uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_object_key_unique` ON `files` (`object_key`);
--> statement-breakpoint
CREATE INDEX `files_uploaded_at_idx` ON `files` (`uploaded_at`);
--> statement-breakpoint
CREATE TABLE `folders` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `parent_id` integer DEFAULT 0 NOT NULL,
  `name` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folders_parent_name_idx` ON `folders` (`parent_id`,`name`);
--> statement-breakpoint
CREATE INDEX `folders_parent_idx` ON `folders` (`parent_id`,`created_at`);
