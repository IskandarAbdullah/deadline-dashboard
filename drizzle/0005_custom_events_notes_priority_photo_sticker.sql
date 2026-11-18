ALTER TABLE `deadlines` ADD COLUMN `origin` text DEFAULT 'ulearn' NOT NULL;
--> statement-breakpoint
ALTER TABLE `deadlines` ADD COLUMN `priority` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `day_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date_key` text NOT NULL,
	`text` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_notes_date_key_unique` ON `day_notes` (`date_key`);
--> statement-breakpoint
CREATE TABLE `user_data` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
