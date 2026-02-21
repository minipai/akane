CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`summary` text
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text,
	`emotion` text,
	`tool_calls` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
