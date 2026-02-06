CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` varchar(50) NOT NULL,
	`sectionId` varchar(50) NOT NULL,
	`sectionTitle` varchar(255) NOT NULL,
	`questionNumber` int NOT NULL,
	`questionText` text NOT NULL,
	`questionType` varchar(50) NOT NULL,
	`options` text,
	`placeholder` text,
	`notes` text,
	`required` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `questions_questionId_unique` UNIQUE(`questionId`)
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`questionId` int NOT NULL,
	`response` text,
	`fileUrl` text,
	`userEmail` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `responses_id` PRIMARY KEY(`id`)
);
