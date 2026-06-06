ALTER TABLE `emailLog` MODIFY COLUMN `direction` enum('inbound','outbound') NOT NULL;--> statement-breakpoint
ALTER TABLE `emailLog` MODIFY COLUMN `status` enum('sent','failed','queued','bounced') NOT NULL DEFAULT 'sent';--> statement-breakpoint
ALTER TABLE `notionRetryQueue` MODIFY COLUMN `status` enum('pending','succeeded','failed_permanent') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `orgCustomTasks` MODIFY COLUMN `type` enum('upload','schedule','form','review') NOT NULL DEFAULT 'review';--> statement-breakpoint
ALTER TABLE `partnerTaskTemplates` MODIFY COLUMN `type` enum('upload','schedule','form','review') NOT NULL DEFAULT 'review';--> statement-breakpoint
ALTER TABLE `reconciliationLog` MODIFY COLUMN `status` enum('healthy','issues_found','error') NOT NULL DEFAULT 'healthy';--> statement-breakpoint
ALTER TABLE `intakeResponses` ADD CONSTRAINT `uq_intake_org_question` UNIQUE(`organizationId`,`questionId`);--> statement-breakpoint
ALTER TABLE `question_options` ADD CONSTRAINT `uq_qoption_question_value` UNIQUE(`questionId`,`optionValue`);--> statement-breakpoint
ALTER TABLE `responses` ADD CONSTRAINT `uq_responses_org_question` UNIQUE(`organizationId`,`questionId`);--> statement-breakpoint
ALTER TABLE `sectionProgress` ADD CONSTRAINT `uq_section_org_name` UNIQUE(`organizationId`,`sectionName`);--> statement-breakpoint
ALTER TABLE `taskCompletion` ADD CONSTRAINT `uq_taskcompletion_org_task` UNIQUE(`organizationId`,`taskId`);--> statement-breakpoint
ALTER TABLE `taskOrgAssignment` ADD CONSTRAINT `uq_taskorg_org_task` UNIQUE(`organizationId`,`taskId`);--> statement-breakpoint
ALTER TABLE `validationResults` ADD CONSTRAINT `uq_validation_org_testkey` UNIQUE(`organizationId`,`testKey`);--> statement-breakpoint
ALTER TABLE `onboardingFeedback` ADD CONSTRAINT `chk_feedback_rating` CHECK (rating between 1 and 5);--> statement-breakpoint
ALTER TABLE `orgNotes` ADD CONSTRAINT `chk_orgnote_owner` CHECK (organizationId is not null or clientId is not null);--> statement-breakpoint
ALTER TABLE `sectionProgress` ADD CONSTRAINT `chk_section_progress_pct` CHECK (progress between 0 and 100);--> statement-breakpoint
ALTER TABLE `taskCompletion` ADD CONSTRAINT `chk_task_status_exclusive` CHECK ((completed + notApplicable + inProgress + blocked) <= 1);--> statement-breakpoint
ALTER TABLE `activityFeed` ADD CONSTRAINT `activityFeed_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fileAttachments` ADD CONSTRAINT `fileAttachments_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `implementationOrgs` ADD CONSTRAINT `implementationOrgs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `intakeFileAttachments` ADD CONSTRAINT `intakeFileAttachments_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `intakeResponses` ADD CONSTRAINT `intakeResponses_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `onboardingFeedback` ADD CONSTRAINT `onboardingFeedback_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orgCustomTasks` ADD CONSTRAINT `orgCustomTasks_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orgNotes` ADD CONSTRAINT `orgNotes_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orgNotes` ADD CONSTRAINT `orgNotes_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partnerDocAudit` ADD CONSTRAINT `partnerDocAudit_documentId_partnerDocuments_id_fk` FOREIGN KEY (`documentId`) REFERENCES `partnerDocuments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partnerDocuments` ADD CONSTRAINT `partnerDocuments_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partnerTaskTemplates` ADD CONSTRAINT `partnerTaskTemplates_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partnerTemplates` ADD CONSTRAINT `partnerTemplates_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `passwordResetTokens` ADD CONSTRAINT `passwordResetTokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `question_options` ADD CONSTRAINT `question_options_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `responses` ADD CONSTRAINT `responses_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `responses` ADD CONSTRAINT `responses_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sectionProgress` ADD CONSTRAINT `sectionProgress_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskCompletion` ADD CONSTRAINT `taskCompletion_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskOrgAssignment` ADD CONSTRAINT `taskOrgAssignment_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskOrgAssignment` ADD CONSTRAINT `taskOrgAssignment_implOrgId_implementationOrgs_id_fk` FOREIGN KEY (`implOrgId`) REFERENCES `implementationOrgs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;