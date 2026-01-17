CREATE TABLE `application_patterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`patternType` varchar(100),
	`keywords` json,
	`companies` json,
	`locations` json,
	`minRelevanceScore` int,
	`applicationCount` int DEFAULT 0,
	`successRate` float DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `application_patterns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`applicationType` enum('manual','automatic') NOT NULL,
	`status` enum('pending','submitted','viewed','interview','rejected','accepted') NOT NULL DEFAULT 'pending',
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	`responseAt` timestamp,
	`notes` text,
	`coverLetter` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(500),
	`jobCount` int DEFAULT 0,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`userId` int NOT NULL,
	`relevanceScore` float NOT NULL,
	`matchedKeywords` json,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(255),
	`source` enum('linkedin','indeed','stepstone','energy_jobline','datacareer') NOT NULL,
	`title` varchar(500) NOT NULL,
	`company` varchar(255),
	`location` varchar(255),
	`description` text,
	`requirements` text,
	`salary` varchar(100),
	`jobType` varchar(100),
	`url` text,
	`postedAt` timestamp,
	`scrapedAt` timestamp NOT NULL DEFAULT (now()),
	`isActive` boolean DEFAULT true,
	`keywords` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refresh_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`source` varchar(100),
	`jobsFound` int DEFAULT 0,
	`newJobs` int DEFAULT 0,
	`refreshedAt` timestamp NOT NULL DEFAULT (now()),
	`nextRefreshAt` timestamp,
	`status` enum('success','partial','failed') NOT NULL DEFAULT 'success',
	`errorMessage` text,
	CONSTRAINT `refresh_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_filters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255),
	`keywords` json,
	`locations` json,
	`sources` json,
	`minRelevanceScore` int DEFAULT 0,
	`maxPostingAge` int DEFAULT 24,
	`isDefault` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `search_filters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(255),
	`email` varchar(320),
	`phone` varchar(50),
	`location` varchar(255),
	`cvSummary` text,
	`skills` json,
	`preferredTitles` json,
	`preferredLocations` json,
	`experienceYears` int,
	`education` text,
	`notificationEmail` varchar(320) DEFAULT 'bhowmick.saurav@outlook.com',
	`autoApplyEnabled` boolean DEFAULT false,
	`relevanceThreshold` int DEFAULT 50,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`)
);
