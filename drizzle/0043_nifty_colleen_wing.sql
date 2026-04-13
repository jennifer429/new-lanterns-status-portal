CREATE TABLE `partnerDocAudit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255) NOT NULL,
	`userEmail` varchar(320) NOT NULL,
	`action` enum('upload','view','download') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partnerDocAudit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partnerDocCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partnerDocCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partnerDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`categoryId` int,
	`title` varchar(500) NOT NULL,
	`description` text,
	`filename` varchar(500) NOT NULL,
	`driveFileId` varchar(255),
	`url` varchar(2000) NOT NULL,
	`mimeType` varchar(255) NOT NULL,
	`size` int NOT NULL,
	`uploadedById` int NOT NULL,
	`uploadedByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partnerDocuments_id` PRIMARY KEY(`id`)
);
