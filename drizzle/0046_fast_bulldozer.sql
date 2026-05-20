CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notionPageId` varchar(64),
	`organizationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`role` varchar(100),
	`email` varchar(320),
	`phone` varchar(100),
	`notes` text,
	`partner` varchar(100),
	`site` varchar(100),
	`updatedBy` varchar(255),
	`isArchived` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contacts_notionPageId_unique` UNIQUE(`notionPageId`)
);
--> statement-breakpoint
CREATE TABLE `systems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notionPageId` varchar(64),
	`organizationId` int NOT NULL,
	`systemName` varchar(255) NOT NULL,
	`systemType` varchar(100),
	`vendor` varchar(255),
	`version` varchar(100),
	`notes` text,
	`partner` varchar(100),
	`site` varchar(100),
	`updatedBy` varchar(255),
	`isArchived` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systems_id` PRIMARY KEY(`id`),
	CONSTRAINT `systems_notionPageId_unique` UNIQUE(`notionPageId`)
);
--> statement-breakpoint
ALTER TABLE `activityFeed` MODIFY COLUMN `source` enum('manual','clickup','linear') NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `linearIssueId`;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `clickupListId`;