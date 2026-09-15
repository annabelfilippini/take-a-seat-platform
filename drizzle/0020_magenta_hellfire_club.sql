CREATE TABLE `creator_media` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `creator_media_chunks` (
	`media_id` text NOT NULL,
	`position` integer NOT NULL,
	`content` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_media_chunk_idx` ON `creator_media_chunks` (`media_id`,`position`);