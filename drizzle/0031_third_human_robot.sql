CREATE TABLE `architectureSystems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`slot` varchar(50) NOT NULL,
	`systemName` varchar(255),
	`vendor` varchar(255),
	`version` varchar(100),
	`notes` text,
	`updatedBy` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `architectureSystems_id` PRIMARY KEY(`id`)
);
