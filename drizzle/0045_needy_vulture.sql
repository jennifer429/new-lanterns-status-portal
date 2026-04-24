CREATE TABLE `implementationOrgs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`orgType` varchar(100) NOT NULL,
	`color` varchar(20),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `implementationOrgs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskOrgAssignment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`taskId` varchar(50) NOT NULL,
	`implOrgId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taskOrgAssignment_id` PRIMARY KEY(`id`)
);
