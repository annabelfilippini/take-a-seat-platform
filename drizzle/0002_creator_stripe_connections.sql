CREATE TABLE `creator_stripe_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creator_id` text NOT NULL,
	`stripe_account_id` text NOT NULL,
	`livemode` integer DEFAULT false NOT NULL,
	`account_country` text NOT NULL,
	`dashboard` text DEFAULT 'express' NOT NULL,
	`onboarding_started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`connected_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_stripe_connections_creator_idx` ON `creator_stripe_connections` (`creator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `creator_stripe_connections_account_idx` ON `creator_stripe_connections` (`stripe_account_id`);
