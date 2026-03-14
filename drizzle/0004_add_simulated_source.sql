-- Add 'simulated' to the jobs source enum for fallback/test data
ALTER TABLE `jobs` MODIFY COLUMN `source` enum('linkedin','indeed','stepstone','energy_jobline','datacareer','adzuna','jsearch','remoteok','simulated') NOT NULL;
