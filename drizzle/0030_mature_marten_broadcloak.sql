ALTER TABLE `taskCompletion` ADD `inProgress` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `taskCompletion` ADD `blocked` int DEFAULT 0 NOT NULL;