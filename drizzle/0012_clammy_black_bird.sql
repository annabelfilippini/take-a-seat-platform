ALTER TABLE `creator_onboarding_profiles` ADD `public_slug` text;--> statement-breakpoint
ALTER TABLE `creator_onboarding_profiles` ADD `published_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `creator_onboarding_profiles_public_slug_idx` ON `creator_onboarding_profiles` (`public_slug`);