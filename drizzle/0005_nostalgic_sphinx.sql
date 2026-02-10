CREATE TABLE `intakeResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`questionId` varchar(50) NOT NULL,
	`section` varchar(255) NOT NULL,
	`response` text,
	`fileUrl` text,
	`status` enum('not_started','in_progress','complete') NOT NULL DEFAULT 'not_started',
	`updatedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intakeResponses_id` PRIMARY KEY(`id`)
);
