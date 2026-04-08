CREATE TABLE `orgCustomTasks` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `organizationId` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `type` varchar(50) NOT NULL DEFAULT 'review',
  `section` varchar(255),
  `isComplete` tinyint NOT NULL DEFAULT 0,
  `createdBy` varchar(320),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
