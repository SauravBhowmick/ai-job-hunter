-- Add CV file handling and onboarding fields to user_profiles
ALTER TABLE `user_profiles` ADD COLUMN `cvFileUrl` varchar(500);
ALTER TABLE `user_profiles` ADD COLUMN `cvParsedAt` timestamp;
ALTER TABLE `user_profiles` ADD COLUMN `onboardingCompleted` boolean DEFAULT false;

-- Add country, Schengen, and VISA sponsorship fields to jobs
ALTER TABLE `jobs` ADD COLUMN `country` varchar(3);
ALTER TABLE `jobs` ADD COLUMN `isSchengen` boolean DEFAULT false;
ALTER TABLE `jobs` ADD COLUMN `visaSponsorship` enum('yes','no','unknown') DEFAULT 'unknown';

-- Update jobs source enum to include new job sources
ALTER TABLE `jobs` MODIFY COLUMN `source` enum('linkedin','indeed','stepstone','energy_jobline','datacareer','adzuna','jsearch','remoteok') NOT NULL;

-- Create index for Schengen filtering
CREATE INDEX `jobs_isSchengen_idx` ON `jobs` (`isSchengen`);
CREATE INDEX `jobs_country_idx` ON `jobs` (`country`);
CREATE INDEX `jobs_visaSponsorship_idx` ON `jobs` (`visaSponsorship`);
