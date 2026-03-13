CREATE TABLE `systemVendorOptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`systemType` varchar(100) NOT NULL,
	`vendorName` varchar(255) NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdBy` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemVendorOptions_id` PRIMARY KEY(`id`)
);
