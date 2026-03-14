import { eq, desc, and, gte, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  jobs, InsertJob, Job,
  userProfiles, InsertUserProfile, UserProfile,
  applications, InsertApplication, Application,
  jobScores, InsertJobScore,
  searchFilters, InsertSearchFilter,
  applicationPatterns, InsertApplicationPattern,
  emailNotifications, InsertEmailNotification,
  refreshLogs, InsertRefreshLog,
  autoApplyLogs, InsertAutoApplyLog,
  scheduledTasks, InsertScheduledTask
} from "../drizzle/schema";
import { ENV } from './_core/env';

// Add this helper function at the top of the file
async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[DB Error] ${context}:`, error);
    throw error; // Re-throw to let caller handle
  }
}

// Apply similar pattern to other critical functions:
// - getUserProfile
// - upsertUser
// - upsertUserProfile
// - getJobById
// - createApplication

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER FUNCTIONS ============
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = 'admin';
    updateSet.role = 'admin';
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ USER PROFILE FUNCTIONS ============
export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserProfile(profile: InsertUserProfile) {
  const db = await getDb();
  if (!db) return;
  
  const existing = await getUserProfile(profile.userId);
  if (existing) {
    await db.update(userProfiles).set(profile).where(eq(userProfiles.userId, profile.userId));
  } else {
    await db.insert(userProfiles).values(profile);
  }
}

// ============ JOB FUNCTIONS ============
export async function insertJob(job: InsertJob) {
  const db = await getDb();
  if (!db) return;
  await db.insert(jobs).values(job);
}

export async function insertJobs(jobList: InsertJob[]) {
  const db = await getDb();
  if (!db) return;
  if (jobList.length === 0) return;
  await db.insert(jobs).values(jobList);
}

export async function getJobs(options: {
  sources?: string[];
  minPostedAt?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(jobs.isActive, true)];
  
  if (options.sources && options.sources.length > 0) {
    conditions.push(inArray(jobs.source, options.sources as any));
  }
  if (options.minPostedAt) {
    conditions.push(gte(jobs.postedAt, options.minPostedAt));
  }
  
  return db.select().from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.postedAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0);
}

export async function getJobById(jobId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getJobByExternalId(externalId: string, source: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs)
    .where(and(eq(jobs.externalId, externalId), eq(jobs.source, source as any)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ JOB SCORE FUNCTIONS ============
export async function upsertJobScore(score: InsertJobScore) {
  const db = await getDb();
  if (!db) return;
  await db.insert(jobScores).values(score).onDuplicateKeyUpdate({
    set: { relevanceScore: score.relevanceScore, matchedKeywords: score.matchedKeywords, calculatedAt: new Date() }
  });
}

export async function getJobScoresForUser(userId: number, minScore?: number) {
  const db = await getDb();
  if (!db) return [];
  
  let conditions = [eq(jobScores.userId, userId)];
  if (minScore !== undefined) {
    conditions.push(gte(jobScores.relevanceScore, minScore));
  }
  
  return db.select().from(jobScores)
    .where(and(...conditions))
    .orderBy(desc(jobScores.relevanceScore));
}

export async function getJobsWithScores(userId: number, options: {
  minScore?: number;
  sources?: string[];
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    job: jobs,
    score: jobScores.relevanceScore,
    matchedKeywords: jobScores.matchedKeywords
  })
  .from(jobs)
  .leftJoin(jobScores, and(eq(jobs.id, jobScores.jobId), eq(jobScores.userId, userId)))
  .where(eq(jobs.isActive, true))
  .orderBy(desc(jobScores.relevanceScore), desc(jobs.postedAt))
  .limit(options.limit || 50)
  .offset(options.offset || 0);
  
  return result;
}

// ============ APPLICATION FUNCTIONS ============
export async function createApplication(application: InsertApplication) {
  const db = await getDb();
  if (!db) return;
  await db.insert(applications).values(application);
}

export async function getApplications(userId: number, options?: {
  type?: "manual" | "automatic";
  status?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let conditions = [eq(applications.userId, userId)];
  if (options?.type) {
    conditions.push(eq(applications.applicationType, options.type));
  }
  if (options?.status) {
    conditions.push(eq(applications.status, options.status as any));
  }
  
  return db.select().from(applications)
    .where(and(...conditions))
    .orderBy(desc(applications.appliedAt))
    .limit(options?.limit || 100);
}

export async function getApplicationWithJob(applicationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select({
    application: applications,
    job: jobs
  })
  .from(applications)
  .innerJoin(jobs, eq(applications.jobId, jobs.id))
  .where(eq(applications.id, applicationId))
  .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function getApplicationsWithJobs(userId: number, limit?: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    application: applications,
    job: jobs
  })
  .from(applications)
  .innerJoin(jobs, eq(applications.jobId, jobs.id))
  .where(eq(applications.userId, userId))
  .orderBy(desc(applications.appliedAt))
  .limit(limit || 100);
}

export async function updateApplicationStatus(applicationId: number, status: string, responseAt?: Date) {
  const db = await getDb();
  if (!db) return;
  
  const updateData: any = { status };
  if (responseAt) updateData.responseAt = responseAt;
  
  await db.update(applications).set(updateData).where(eq(applications.id, applicationId));
}

export async function hasAppliedToJob(userId: number, jobId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select().from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.jobId, jobId)))
    .limit(1);
  
  return result.length > 0;
}

// ============ SEARCH FILTER FUNCTIONS ============
export async function saveSearchFilter(filter: InsertSearchFilter) {
  const db = await getDb();
  if (!db) return;
  await db.insert(searchFilters).values(filter);
}

export async function getSearchFilters(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(searchFilters).where(eq(searchFilters.userId, userId));
}

export async function getDefaultFilter(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(searchFilters)
    .where(and(eq(searchFilters.userId, userId), eq(searchFilters.isDefault, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ APPLICATION PATTERN FUNCTIONS ============
export async function saveApplicationPattern(pattern: InsertApplicationPattern) {
  const db = await getDb();
  if (!db) return;
  await db.insert(applicationPatterns).values(pattern);
}

export async function getApplicationPatterns(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(applicationPatterns)
    .where(and(eq(applicationPatterns.userId, userId), eq(applicationPatterns.isActive, true)));
}

export async function updatePatternStats(patternId: number, applicationCount: number, successRate: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(applicationPatterns)
    .set({ applicationCount, successRate })
    .where(eq(applicationPatterns.id, patternId));
}

// ============ EMAIL NOTIFICATION FUNCTIONS ============
export async function logEmailNotification(notification: InsertEmailNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(emailNotifications).values(notification);
}

export async function getEmailNotifications(userId: number, limit?: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailNotifications)
    .where(eq(emailNotifications.userId, userId))
    .orderBy(desc(emailNotifications.sentAt))
    .limit(limit || 50);
}

// ============ REFRESH LOG FUNCTIONS ============
export async function logRefresh(log: InsertRefreshLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(refreshLogs).values(log);
}

export async function getLastRefresh(userId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const conditions = userId ? [eq(refreshLogs.userId, userId)] : [];
  
  const result = await db.select().from(refreshLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(refreshLogs.refreshedAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ ANALYTICS FUNCTIONS ============
export async function getApplicationStats(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, manual: 0, automatic: 0, pending: 0, submitted: 0, interview: 0, accepted: 0, rejected: 0 };
  
  const allApps = await db.select().from(applications).where(eq(applications.userId, userId));
  
  return {
    total: allApps.length,
    manual: allApps.filter(a => a.applicationType === 'manual').length,
    automatic: allApps.filter(a => a.applicationType === 'automatic').length,
    pending: allApps.filter(a => a.status === 'pending').length,
    submitted: allApps.filter(a => a.status === 'submitted').length,
    interview: allApps.filter(a => a.status === 'interview').length,
    accepted: allApps.filter(a => a.status === 'accepted').length,
    rejected: allApps.filter(a => a.status === 'rejected').length,
  };
}

/**
 * Retrieves applications for a user within the last N days.
 *
 * @param userId - The user's id to filter applications
 * @param days - Number of days in the past to include (default 30)
 * @returns The list of applications for the user applied on or after the calculated start date, ordered newest first
 */
export async function getRecentApplicationTrend(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return db.select().from(applications)
    .where(and(eq(applications.userId, userId), gte(applications.appliedAt, startDate)))
    .orderBy(desc(applications.appliedAt));
}

/**
 * Persist an auto-apply run record to the database.
 *
 * @param log - The auto-apply run entry to insert (matches `InsertAutoApplyLog`)
 */
export async function logAutoApplyRun(log: InsertAutoApplyLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(autoApplyLogs).values(log);
}

/**
 * Fetches recent auto-apply run logs for a user, ordered by most recent run.
 *
 * @param userId - ID of the user whose logs will be retrieved
 * @param limit - Maximum number of logs to return (defaults to 20)
 * @returns An array of auto-apply log records ordered by `runAt` descending; returns an empty array if the database is unavailable.
 */
export async function getAutoApplyLogs(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(autoApplyLogs)
    .where(eq(autoApplyLogs.userId, userId))
    .orderBy(desc(autoApplyLogs.runAt))
    .limit(limit);
}

/**
 * Calculates the total number of jobs auto-applied for a user since the start of the current day (local time).
 *
 * @param userId - The id of the user whose auto-apply logs will be aggregated
 * @returns The sum of `jobsApplied` from today's auto-apply logs for the user, or `0` if the database is unavailable or no logs exist
 */
export async function getTodayAutoApplyCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const logs = await db.select().from(autoApplyLogs)
    .where(and(eq(autoApplyLogs.userId, userId), gte(autoApplyLogs.runAt, today)));
  
  return logs.reduce((sum, log) => sum + (log.jobsApplied || 0), 0);
}

/**
 * Inserts a new scheduled task or updates an existing one matched by `userId` and `taskType`.
 *
 * @param task - The scheduled task record to insert or use to update the existing task (matched by `userId` and `taskType`)
 */
export async function upsertScheduledTask(task: InsertScheduledTask) {
  const db = await getDb();
  if (!db) return;
  
  const existing = await db.select().from(scheduledTasks)
    .where(and(eq(scheduledTasks.userId, task.userId), eq(scheduledTasks.taskType, task.taskType)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(scheduledTasks).set(task)
      .where(and(eq(scheduledTasks.userId, task.userId), eq(scheduledTasks.taskType, task.taskType)));
  } else {
    await db.insert(scheduledTasks).values(task);
  }
}

/**
 * Fetches scheduled tasks for a user.
 *
 * @param userId - ID of the user whose scheduled tasks to retrieve
 * @returns An array of scheduled tasks for the specified user; empty array if none are found or the database is unavailable
 */
export async function getScheduledTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduledTasks)
    .where(eq(scheduledTasks.userId, userId));
}

/**
 * Fetches a single scheduled task for a user by task type.
 *
 * @param userId - The user's numeric id
 * @param taskType - The scheduled task type: `"auto_apply"`, `"job_refresh"`, or `"notification"`
 * @returns The matching scheduled task, or `undefined` if no task exists or the database is unavailable
 */
export async function getScheduledTask(userId: number, taskType: "auto_apply" | "job_refresh" | "notification") {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scheduledTasks)
    .where(and(eq(scheduledTasks.userId, userId), eq(scheduledTasks.taskType, taskType)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Retrieves scheduled tasks that are enabled and whose next run time is due now or earlier.
 *
 * @returns An array of scheduled tasks with `isEnabled` = `true` and `nextRunAt` less than or equal to the current time; returns an empty array if the database is unavailable.
 */
export async function getDueScheduledTasks() {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  return db.select().from(scheduledTasks)
    .where(and(
      eq(scheduledTasks.isEnabled, true),
      lte(scheduledTasks.nextRunAt, now)
    ));
}

/**
 * Advance a scheduled task's run timestamps for a user.
 *
 * Sets `lastRunAt` to the current time and `nextRunAt` to the current time plus `intervalHours` hours
 * for the scheduled task matching `userId` and `taskType`. If the database is unavailable, no changes are made.
 *
 * @param userId - The ID of the user who owns the scheduled task
 * @param taskType - The type of scheduled task to update (`"auto_apply"`, `"job_refresh"`, or `"notification"`)
 * @param intervalHours - Number of hours to add to the current time to compute `nextRunAt`
 */
export async function updateScheduledTaskRun(userId: number, taskType: "auto_apply" | "job_refresh" | "notification", intervalHours: number) {
  const db = await getDb();
  if (!db) return;
  
  const now = new Date();
  const nextRun = new Date(now.getTime() + intervalHours * 60 * 60 * 1000);
  
  await db.update(scheduledTasks)
    .set({ lastRunAt: now, nextRunAt: nextRun })
    .where(and(eq(scheduledTasks.userId, userId), eq(scheduledTasks.taskType, taskType)));
}

/**
 * Update the user's profile to record the current time as the last auto-apply run.
 *
 * If the database client is unavailable, the function returns without making changes.
 *
 * @param userId - The id of the user whose profile `lastAutoApplyRun` will be set to the current time
 */
export async function updateProfileLastAutoApply(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(userProfiles)
    .set({ lastAutoApplyRun: new Date() })
    .where(eq(userProfiles.userId, userId));
}