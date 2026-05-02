CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`tick_time` integer NOT NULL,
	`world_state` text NOT NULL,
	`event_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
