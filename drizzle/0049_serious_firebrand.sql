CREATE TABLE `syncCheckpoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pipeline` varchar(100) NOT NULL,
	`lastSuccessfulSync` timestamp NOT NULL,
	`consecutiveFailures` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `syncCheckpoints_id` PRIMARY KEY(`id`),
	CONSTRAINT `syncCheckpoints_pipeline_unique` UNIQUE(`pipeline`)
);
