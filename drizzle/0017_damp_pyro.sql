CREATE TABLE `onboardingFeedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`rating` int NOT NULL,
	`comments` text,
	`submittedBy` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `onboardingFeedback_id` PRIMARY KEY(`id`)
);
