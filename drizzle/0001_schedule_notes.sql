CREATE TABLE IF NOT EXISTS `schedule_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_date` text NOT NULL,
	`content` text NOT NULL,
	`created_by_phone` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `schedule_notes_date_idx` ON `schedule_notes` (`note_date`,`created_at`);
