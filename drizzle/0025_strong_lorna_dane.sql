CREATE TABLE `booking_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`first_attempt_at` integer NOT NULL,
	`sent_at` integer,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `zoom_host_reservations` (
	`booking_id` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `respond_by` integer;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `capture_before` integer;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `workflow_step` text;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `workflow_retry_at` integer;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `workflow_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `workflow_error` text;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `workflow_lock` text;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `workflow_lock_until` integer;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `zoom_host_id` text;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `zoom_meeting_id` text;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `zoom_create_attempt_at` integer;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `zoom_synced_revision` text;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `stripe_refund_id` text;