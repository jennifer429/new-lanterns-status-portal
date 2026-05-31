CREATE TABLE `connectivityCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationSlug` varchar(100) NOT NULL,
	`data` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `connectivityCache_id` PRIMARY KEY(`id`),
	CONSTRAINT `connectivityCache_organizationSlug_unique` UNIQUE(`organizationSlug`)
);
