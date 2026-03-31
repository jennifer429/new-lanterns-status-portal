CREATE TABLE `orgNotes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `organizationId` int,
  `clientId` int,
  `label` varchar(100) NOT NULL DEFAULT 'General',
  `fileName` varchar(255) NOT NULL,
  `fileUrl` text NOT NULL,
  `driveFileId` varchar(500),
  `fileSize` int,
  `mimeType` varchar(100),
  `uploadedBy` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `orgNotes_id` PRIMARY KEY(`id`)
);
