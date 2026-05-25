CREATE TABLE `reconciliationLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rowsChecked` int NOT NULL DEFAULT 0,
	`outOfSync` int NOT NULL DEFAULT 0,
	`issues` text,
	`durationMs` int,
	`status` varchar(30) NOT NULL DEFAULT 'healthy',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reconciliationLog_id` PRIMARY KEY(`id`)
);
