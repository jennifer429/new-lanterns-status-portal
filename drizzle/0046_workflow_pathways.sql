CREATE TABLE `workflowPathways` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`workflowType` varchar(20) NOT NULL,
	`pathId` varchar(100) NOT NULL,
	`enabled` tinyint NOT NULL DEFAULT 0,
	`sourceSystem` varchar(255),
	`middlewareSystem` varchar(255),
	`destinationSystem` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflowPathways_id` PRIMARY KEY(`id`)
);
