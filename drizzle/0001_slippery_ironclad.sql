CREATE TABLE `diary` (
	`type` text NOT NULL,
	`date` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`type`, `date`)
);
