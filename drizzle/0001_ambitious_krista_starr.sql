CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`contactName` varchar(255),
	`contactEmail` varchar(320),
	`contactPhone` varchar(50),
	`startDate` varchar(50),
	`goalDate` varchar(50),
	`status` enum('active','completed','paused') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `sectionProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`sectionName` varchar(255) NOT NULL,
	`status` enum('pending','in-progress','complete') NOT NULL DEFAULT 'pending',
	`progress` int NOT NULL DEFAULT 0,
	`expectedEnd` varchar(50),
	`actualEnd` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sectionProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskCompletion` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`sectionName` varchar(255) NOT NULL,
	`taskId` varchar(50) NOT NULL,
	`completed` int NOT NULL DEFAULT 0,
	`completedAt` timestamp,
	`completedBy` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taskCompletion_id` PRIMARY KEY(`id`)
);
