CREATE TABLE `user_facts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`fact` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_profile` (
	`category` text PRIMARY KEY NOT NULL,
	`summary` text NOT NULL,
	`updated_at` text NOT NULL
);
