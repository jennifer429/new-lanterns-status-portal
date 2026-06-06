CREATE TABLE `templateTaskCompletion` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`templateTaskId` int NOT NULL,
	`isComplete` tinyint NOT NULL DEFAULT 0,
	`completedAt` timestamp,
	`completedBy` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templateTaskCompletion_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_templatetask_org_task` UNIQUE(`organizationId`,`templateTaskId`)
);
--> statement-breakpoint
ALTER TABLE `templateTaskCompletion` ADD CONSTRAINT `templateTaskCompletion_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `templateTaskCompletion` ADD CONSTRAINT `templateTaskCompletion_templateTaskId_partnerTaskTemplates_id_fk` FOREIGN KEY (`templateTaskId`) REFERENCES `partnerTaskTemplates`(`id`) ON DELETE cascade ON UPDATE no action;