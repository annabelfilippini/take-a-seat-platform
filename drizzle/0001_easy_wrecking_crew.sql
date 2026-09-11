CREATE TABLE `creator_onboarding_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`instagram_platform` text NOT NULL,
	`bio` text NOT NULL,
	`calendar_connected_at` text,
	`stripe_connected_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
