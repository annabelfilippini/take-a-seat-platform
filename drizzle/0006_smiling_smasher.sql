CREATE TABLE `creator_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creator_id` text NOT NULL,
	`clerk_user_id` text NOT NULL,
	`email` text NOT NULL,
	`accepted_invite_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_accounts_clerk_user_idx` ON `creator_accounts` (`clerk_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `creator_accounts_creator_idx` ON `creator_accounts` (`creator_id`);--> statement-breakpoint
CREATE TABLE `creator_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_invites_creator_idx` ON `creator_invites` (`creator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `creator_invites_token_hash_idx` ON `creator_invites` (`token_hash`);