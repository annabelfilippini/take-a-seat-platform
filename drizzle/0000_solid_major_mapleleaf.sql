CREATE TABLE `creator_availability_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creator_id` text NOT NULL,
	`timezone` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`buffer_minutes` integer DEFAULT 15 NOT NULL,
	`min_notice_minutes` integer DEFAULT 1440 NOT NULL,
	`max_bookings_per_day` integer,
	`max_bookings_per_week` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `creator_calendar_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creator_id` text NOT NULL,
	`provider` text DEFAULT 'google' NOT NULL,
	`calendar_id` text DEFAULT 'primary' NOT NULL,
	`scopes` text NOT NULL,
	`access_token_encrypted` text NOT NULL,
	`refresh_token_encrypted` text,
	`token_type` text DEFAULT 'Bearer' NOT NULL,
	`expires_at` integer NOT NULL,
	`connected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_calendar_connections_creator_provider_idx` ON `creator_calendar_connections` (`creator_id`,`provider`);