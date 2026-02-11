CREATE TABLE `partnerTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`questionId` varchar(50) NOT NULL,
	`label` varchar(255) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`s3Key` varchar(500) NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`uploadedBy` varchar(320),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`deactivatedBy` varchar(320),
	`deactivatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partnerTemplates_id` PRIMARY KEY(`id`)
);
