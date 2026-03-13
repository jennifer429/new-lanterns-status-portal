CREATE TABLE `vendorAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(50) NOT NULL,
	`systemType` varchar(100) NOT NULL,
	`vendorName` varchar(255),
	`previousValue` text,
	`newValue` text,
	`performedBy` varchar(320) NOT NULL,
	`performedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendorAuditLog_id` PRIMARY KEY(`id`)
);
