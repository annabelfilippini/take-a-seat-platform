ALTER TABLE `creator_onboarding_profiles` ADD `email` text;--> statement-breakpoint
ALTER TABLE `creator_onboarding_profiles` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `creator_onboarding_profiles` ADD `application_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `creator_onboarding_profiles` ADD `review_submitted_at` text;