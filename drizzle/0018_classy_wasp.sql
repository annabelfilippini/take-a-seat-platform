ALTER TABLE `creator_onboarding_profiles` ADD `session_offerings` text;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `offering_duration_minutes` integer;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `offering_unit_amount` integer;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `offering_currency` text;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `offering_description` text;