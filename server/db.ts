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
  refreshLogs, InsertRefreshLog
} from "../drizzle/schema";
import { ENV } from './_core/env';

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

export async function getRecentApplicationTrend(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return db.select().from(applications)
    .where(and(eq(applications.userId, userId), gte(applications.appliedAt, startDate)))
    .orderBy(desc(applications.appliedAt));
}
