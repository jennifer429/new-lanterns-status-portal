ALTER TABLE `activityFeed` MODIFY COLUMN `source` enum('manual') NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `linearIssueId`;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `clickupListId`;