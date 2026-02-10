-- Create audit log table for tracking import/export events
CREATE TABLE `auditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`eventType` enum('import','export','delete','update') NOT NULL,
	`eventDescription` text,
	`userEmail` varchar(320) NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLog_id` PRIMARY KEY(`id`)
);
