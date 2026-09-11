CREATE TABLE `customer_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`creator_name` text NOT NULL,
	`seat_id` text NOT NULL,
	`seat_name` text NOT NULL,
	`customer_name` text,
	`customer_email` text NOT NULL,
	`customer_note` text,
	`appointment_start_at` text NOT NULL,
	`appointment_end_at` text NOT NULL,
	`timezone` text NOT NULL,
	`status` text DEFAULT 'checkout_started' NOT NULL,
	`stripe_checkout_session_id` text,
	`stripe_payment_intent_id` text,
	`google_calendar_event_id` text,
	`google_calendar_html_link` text,
	`approved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_bookings_stripe_checkout_session_idx` ON `customer_bookings` (`stripe_checkout_session_id`);