CREATE TABLE `emailLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`direction` varchar(10) NOT NULL,
	`type` varchar(30) NOT NULL,
	`toAddress` varchar(255) NOT NULL,
	`fromAddress` varchar(255) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`organizationId` int,
	`triggeredBy` varchar(255),
	`messageId` varchar(255),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailLog_id` PRIMARY KEY(`id`)
);
