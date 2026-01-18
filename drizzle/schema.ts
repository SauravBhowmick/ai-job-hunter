import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, float } from "drizzle-orm/mysql-core";
import { index } from "drizzle-orm/mysql-core";

// Update job_scores table
var jobScores = mysqlTable("job_scores", {
  // ... existing fields
}, (table) => ({
  userScoreIdx: index('idx_job_scores_user_score').on(table.userId, table.relevanceScore),
  jobUserIdx: index('idx_job_scores_job_user').on(table.jobId, table.userId),
}));

// Update users table
var users = mysqlTable("users", {
  // ... existing fields
}, (table) => ({
  openIdIdx: index('idx_users_open_id').on(table.openId),
}));

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User profile with CV data and job preferences
 */
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fullName: varchar("fullName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  location: varchar("location", { length: 255 }),
  cvSummary: text("cvSummary"),
  skills: json("skills").$type<string[]>(),
  preferredTitles: json("preferredTitles").$type<string[]>(),
  preferredLocations: json("preferredLocations").$type<string[]>(),
  experienceYears: int("experienceYears"),
  education: text("education"),
  notificationEmail: varchar("notificationEmail", { length: 320 }).default("bhowmick.saurav@outlook.com"),
  autoApplyEnabled: boolean("autoApplyEnabled").default(false),
  relevanceThreshold: int("relevanceThreshold").default(50),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Aggregated job listings from various sources
 */
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 255 }),
  source: mysqlEnum("source", ["linkedin", "indeed", "stepstone", "energy_jobline", "datacareer"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  company: varchar("company", { length: 255 }),
  location: varchar("location", { length: 255 }),
  description: text("description"),
  requirements: text("requirements"),
  salary: varchar("salary", { length: 100 }),
  jobType: varchar("jobType", { length: 100 }),
  url: text("url"),
  postedAt: timestamp("postedAt"),
  scrapedAt: timestamp("scrapedAt").defaultNow().notNull(),
  isActive: boolean("isActive").default(true),
  keywords: json("keywords").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/**
 * Job relevance scores for each user
 */
export const jobScores = mysqlTable("job_scores", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(),
  userId: int("userId").notNull(),
  relevanceScore: float("relevanceScore").notNull(),
  matchedKeywords: json("matchedKeywords").$type<string[]>(),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
});

export type JobScore = typeof jobScores.$inferSelect;
export type InsertJobScore = typeof jobScores.$inferInsert;

/**
 * Job applications tracking
 */
export const applications = mysqlTable("applications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId").notNull(),
  applicationType: mysqlEnum("applicationType", ["manual", "automatic"]).notNull(),
  status: mysqlEnum("status", ["pending", "submitted", "viewed", "interview", "rejected", "accepted"]).default("pending").notNull(),
  appliedAt: timestamp("appliedAt").defaultNow().notNull(),
  responseAt: timestamp("responseAt"),
  notes: text("notes"),
  coverLetter: text("coverLetter"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Application = typeof applications.$inferSelect;
export type InsertApplication = typeof applications.$inferInsert;

/**
 * Search filters saved by users
 */
export const searchFilters = mysqlTable("search_filters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }),
  keywords: json("keywords").$type<string[]>(),
  locations: json("locations").$type<string[]>(),
  sources: json("sources").$type<string[]>(),
  minRelevanceScore: int("minRelevanceScore").default(0),
  maxPostingAge: int("maxPostingAge").default(24),
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SearchFilter = typeof searchFilters.$inferSelect;
export type InsertSearchFilter = typeof searchFilters.$inferInsert;

/**
 * Application patterns for ML auto-apply learning
 */
export const applicationPatterns = mysqlTable("application_patterns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  patternType: varchar("patternType", { length: 100 }),
  keywords: json("keywords").$type<string[]>(),
  companies: json("companies").$type<string[]>(),
  locations: json("locations").$type<string[]>(),
  minRelevanceScore: int("minRelevanceScore"),
  applicationCount: int("applicationCount").default(0),
  successRate: float("successRate").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApplicationPattern = typeof applicationPatterns.$inferSelect;
export type InsertApplicationPattern = typeof applicationPatterns.$inferInsert;

/**
 * Email notification logs
 */
export const emailNotifications = mysqlTable("email_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 500 }),
  jobCount: int("jobCount").default(0),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;

/**
 * Job refresh logs for monitoring
 */
export const refreshLogs = mysqlTable("refresh_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  source: varchar("source", { length: 100 }),
  jobsFound: int("jobsFound").default(0),
  newJobs: int("newJobs").default(0),
  refreshedAt: timestamp("refreshedAt").defaultNow().notNull(),
  nextRefreshAt: timestamp("nextRefreshAt"),
  status: mysqlEnum("status", ["success", "partial", "failed"]).default("success").notNull(),
  errorMessage: text("errorMessage"),
});

export type RefreshLog = typeof refreshLogs.$inferSelect;
export type InsertRefreshLog = typeof refreshLogs.$inferInsert;
