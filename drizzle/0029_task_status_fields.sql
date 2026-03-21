ALTER TABLE `taskCompletion` ADD COLUMN `inProgress` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `taskCompletion` ADD COLUMN `blocked` int NOT NULL DEFAULT 0;
