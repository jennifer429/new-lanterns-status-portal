CREATE TABLE `validationResults` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `organizationId` int NOT NULL,
  `testKey` varchar(20) NOT NULL,
  `actual` text,
  `status` enum('Pass','Fail','Not Tested','Pending') NOT NULL DEFAULT 'Not Tested',
  `signOff` varchar(255),
  `updatedBy` varchar(320),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `validationResults_orgId_testKey` (`organizationId`, `testKey`)
);
