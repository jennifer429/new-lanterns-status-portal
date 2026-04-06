CREATE TABLE `partnerTaskTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`type` varchar(50) NOT NULL DEFAULT 'review',
	`section` varchar(255),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdBy` varchar(320),
	`updatedBy` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partnerTaskTemplates_id` PRIMARY KEY(`id`)
);
