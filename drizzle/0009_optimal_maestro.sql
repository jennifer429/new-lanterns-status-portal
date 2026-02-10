CREATE TABLE `intakeFileAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`questionId` varchar(50) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`driveFileId` varchar(100),
	`fileSize` int,
	`mimeType` varchar(100),
	`uploadedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intakeFileAttachments_id` PRIMARY KEY(`id`)
);
