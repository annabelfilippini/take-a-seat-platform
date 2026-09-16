ALTER TABLE `customer_bookings` ADD `calendar_sync_lock` text;--> statement-breakpoint
ALTER TABLE `customer_bookings` ADD `calendar_sync_lock_expires_at` integer;