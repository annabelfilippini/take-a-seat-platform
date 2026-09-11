CREATE TABLE `creator_notification_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creator_id` text NOT NULL,
	`booking_email_enabled` integer DEFAULT true NOT NULL,
	`booking_sms_enabled` integer DEFAULT true NOT NULL,
	`booking_profile_enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_notification_preferences_creator_idx` ON `creator_notification_preferences` (`creator_id`);--> statement-breakpoint
CREATE TABLE `creator_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_notifications_booking_type_idx` ON `creator_notifications` (`booking_id`,`type`);