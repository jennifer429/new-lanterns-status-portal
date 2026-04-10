ALTER TABLE `users` ADD `invitedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `inviteToken` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `inviteTokenExpiresAt` timestamp;