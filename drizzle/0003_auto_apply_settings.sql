-- Add auto-apply settings to user_profiles
ALTER TABLE `user_profiles` ADD COLUMN `autoApplyConfidenceThreshold` int DEFAULT 70;
ALTER TABLE `user_profiles` ADD COLUMN `autoApplyMaxPerDay` int DEFAULT 5;
ALTER TABLE `user_profiles` ADD COLUMN `autoApplyNotifyEmail` boolean DEFAULT true;
ALTER TABLE `user_profiles` ADD COLUMN `companyWhitelist` json;
ALTER TABLE `user_profiles` ADD COLUMN `companyBlacklist` json;
ALTER TABLE `user_profiles` ADD COLUMN `lastAutoApplyRun` timestamp;

-- Create auto_apply_logs table
CREATE TABLE `auto_apply_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `runAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `jobsScanned` int DEFAULT 0,
  `jobsMatched` int DEFAULT 0,
  `jobsApplied` int DEFAULT 0,
  `jobsSkipped` int DEFAULT 0,
  `status` enum('success','partial','failed') DEFAULT 'success' NOT NULL,
  `errorMessage` text,
  `notificationSent` boolean DEFAULT false,
  `appliedJobIds` json,
  CONSTRAINT `fk_auto_apply_logs_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Create scheduled_tasks table
CREATE TABLE `scheduled_tasks` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `taskType` enum('auto_apply','job_refresh','notification') NOT NULL,
  `intervalHours` int DEFAULT 6,
  `lastRunAt` timestamp,
  `nextRunAt` timestamp,
  `isEnabled` boolean DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_scheduled_tasks_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_user_task_type` (`userId`, `taskType`)
) ENGINE=InnoDB;

-- Create indexes
CREATE INDEX `auto_apply_logs_userId_idx` ON `auto_apply_logs` (`userId`);
CREATE INDEX `auto_apply_logs_runAt_idx` ON `auto_apply_logs` (`runAt`);
CREATE INDEX `scheduled_tasks_userId_idx` ON `scheduled_tasks` (`userId`);
CREATE INDEX `scheduled_tasks_nextRunAt_idx` ON `scheduled_tasks` (`nextRunAt`);
