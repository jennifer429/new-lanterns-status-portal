CREATE TABLE `notionRetryQueue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`writeType` varchar(50) NOT NULL,
	`payload` text NOT NULL,
	`retryCount` int NOT NULL DEFAULT 0,
	`lastError` text,
	`ownerNotified` tinyint NOT NULL DEFAULT 0,
	`status` varchar(30) NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notionRetryQueue_id` PRIMARY KEY(`id`)
);
