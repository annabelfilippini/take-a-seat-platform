CREATE TABLE `google_oauth_attempts` (
	`nonce` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
