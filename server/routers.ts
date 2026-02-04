import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { refreshJobs, scoreJobsForUser, getMatchingJobs, calculateRelevanceScore } from "./services/jobEngine";
import { learnFromManualApplication, processAutoApply, getAutoApplyCandidates } from "./services/autoApply";
import { sendJobNotificationEmail, checkAndNotify } from "./services/emailService";
import { storagePut, storageGet } from "./storage";
import { parseCV } from "./services/cvParser";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // User Profile Management
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserProfile(ctx.user.id);
    }),
    
    update: protectedProcedure
      .input(z.object({
        fullName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        location: z.string().optional(),
        cvSummary: z.string().optional(),
        cvFileUrl: z.string().optional(),
        skills: z.array(z.string()).optional(),
        preferredTitles: z.array(z.string()).optional(),
        preferredLocations: z.array(z.string()).optional(),
        experienceYears: z.number().optional(),
        education: z.string().optional(),
        notificationEmail: z.string().email().optional(),
        autoApplyEnabled: z.boolean().optional(),
        relevanceThreshold: z.number().min(0).max(100).optional(),
        onboardingCompleted: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserProfile({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
    
    // Upload CV file
    uploadCV: protectedProcedure
      .input(z.object({
        fileData: z.string(), // Base64 encoded file data
        fileName: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { fileData, fileName, mimeType } = input;
        
        // Validate file type
        const allowedTypes = [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];
        if (!allowedTypes.includes(mimeType)) {
          throw new Error("Invalid file type. Please upload a PDF or Word document.");
        }
        
        // Decode base64 to buffer
        const buffer = Buffer.from(fileData, "base64");
        
        // Check file size (max 10MB)
        if (buffer.length > 10 * 1024 * 1024) {
          throw new Error("File too large. Maximum size is 10MB.");
        }
        
        // Generate storage path
        const timestamp = Date.now();
        const ext = fileName.split(".").pop() || "pdf";
        const storagePath = `cvs/${ctx.user.id}/${timestamp}_cv.${ext}`;
        
        // Upload to storage
        const { url } = await storagePut(storagePath, buffer, mimeType);
        
        // Update profile with CV URL
        await db.upsertUserProfile({
          userId: ctx.user.id,
          cvFileUrl: url,
        });
        
        return { success: true, url };
      }),
    
    // Parse CV with AI
    parseCV: protectedProcedure
      .input(z.object({
        cvText: z.string(), // Extracted text from CV
      }))
      .mutation(async ({ ctx, input }) => {
        const { cvText } = input;
        
        // Parse CV using AI
        const parsedData = await parseCV(cvText);
        
        // Build update payload with only non-null values to preserve existing data
        const updatePayload: Record<string, unknown> = {
          userId: ctx.user.id,
          cvParsedAt: new Date(),
        };
        
        if (parsedData.fullName !== null) updatePayload.fullName = parsedData.fullName;
        if (parsedData.email !== null) updatePayload.email = parsedData.email;
        if (parsedData.phone !== null) updatePayload.phone = parsedData.phone;
        if (parsedData.location !== null) updatePayload.location = parsedData.location;
        if (parsedData.summary !== null) updatePayload.cvSummary = parsedData.summary;
        if (parsedData.skills && parsedData.skills.length > 0) updatePayload.skills = parsedData.skills;
        if (parsedData.preferredTitles && parsedData.preferredTitles.length > 0) updatePayload.preferredTitles = parsedData.preferredTitles;
        if (parsedData.experienceYears !== null) updatePayload.experienceYears = parsedData.experienceYears;
        if (parsedData.education !== null) updatePayload.education = parsedData.education;
        
        // Update profile with filtered parsed data
        await db.upsertUserProfile(updatePayload as any);
        
        return { success: true, parsedData };
      }),
    
    // Complete onboarding
    completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      await db.upsertUserProfile({
        userId: ctx.user.id,
        onboardingCompleted: true,
      });
      return { success: true };
    }),
    
    // Get CV download URL
    getCVUrl: protectedProcedure.query(async ({ ctx }) => {
      const profile = await db.getUserProfile(ctx.user.id);
      if (!profile?.cvFileUrl) {
        return { url: null };
      }
      return { url: profile.cvFileUrl };
    }),
  }),

  // Job Management
  jobs: router({
    list: protectedProcedure
      .input(z.object({
        sources: z.array(z.string()).optional(),
        minScore: z.number().optional(),
        maxAgeHours: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        schengenOnly: z.boolean().optional(),
        visaSponsorship: z.enum(["yes", "no", "unknown"]).optional(),
        showVisaSponsorshipOnly: z.boolean().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const options = input || {};
        
        // Get jobs with scores for this user
        let jobsWithScores = await db.getJobsWithScores(ctx.user.id, {
          minScore: options.minScore,
          sources: options.sources,
          limit: options.limit || 100, // Fetch more to allow for filtering
          offset: options.offset || 0,
        });
        
        // Filter by age if specified
        if (options.maxAgeHours) {
          const minDate = new Date(Date.now() - options.maxAgeHours * 60 * 60 * 1000);
          jobsWithScores = jobsWithScores.filter(j => j.job.postedAt && j.job.postedAt >= minDate);
        }
        
        // Filter by Schengen if specified
        if (options.schengenOnly) {
          jobsWithScores = jobsWithScores.filter(j => j.job.isSchengen === true);
        }
        
        // Filter by VISA sponsorship if specified
        if (options.visaSponsorship) {
          jobsWithScores = jobsWithScores.filter(j => j.job.visaSponsorship === options.visaSponsorship);
        }
        
        // Show only jobs with VISA sponsorship (for non-Schengen jobs)
        if (options.showVisaSponsorshipOnly) {
          jobsWithScores = jobsWithScores.filter(j => 
            j.job.isSchengen === true || j.job.visaSponsorship === "yes"
          );
        }
        
        // Apply final limit
        return jobsWithScores.slice(0, options.limit || 50);
      }),
    
    getById: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ ctx, input }) => {
        const job = await db.getJobById(input.jobId);
        if (!job) return null;
        
        // Get score for this user
        const scores = await db.getJobScoresForUser(ctx.user.id);
        const jobScore = scores.find(s => s.jobId === input.jobId);
        
        // Check if already applied
        const hasApplied = await db.hasAppliedToJob(ctx.user.id, input.jobId);
        
        return {
          ...job,
          relevanceScore: jobScore?.relevanceScore || 0,
          matchedKeywords: jobScore?.matchedKeywords || [],
          hasApplied,
        };
      }),
    
    refresh: protectedProcedure.mutation(async ({ ctx }) => {
      // Refresh jobs from all sources
      const result = await refreshJobs(ctx.user.id);
      
      // Score jobs for this user
      const profile = await db.getUserProfile(ctx.user.id);
      const skills = profile?.skills || [];
      await scoreJobsForUser(ctx.user.id, skills);
      
      return result;
    }),
    
    scoreAll: protectedProcedure.mutation(async ({ ctx }) => {
      const profile = await db.getUserProfile(ctx.user.id);
      const skills = profile?.skills || [];
      const count = await scoreJobsForUser(ctx.user.id, skills);
      return { scoredCount: count };
    }),
  }),

  // Application Management
  applications: router({
    list: protectedProcedure
      .input(z.object({
        type: z.enum(["manual", "automatic"]).optional(),
        status: z.string().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.getApplicationsWithJobs(ctx.user.id, input?.limit);
      }),
    
    submitApplication: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        coverLetter: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if already applied
        const hasApplied = await db.hasAppliedToJob(ctx.user.id, input.jobId);
        if (hasApplied) {
          throw new Error("Already applied to this job");
        }
        
        // Create manual application
        await db.createApplication({
          userId: ctx.user.id,
          jobId: input.jobId,
          applicationType: "manual",
          status: "submitted",
          appliedAt: new Date(),
          coverLetter: input.coverLetter,
          notes: input.notes,
        });
        
        // Learn from this application for auto-apply
        await learnFromManualApplication(ctx.user.id, input.jobId);
        
        return { success: true };
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        applicationId: z.number(),
        status: z.enum(["pending", "submitted", "viewed", "interview", "rejected", "accepted"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateApplicationStatus(
          input.applicationId,
          input.status,
          input.status !== "pending" && input.status !== "submitted" ? new Date() : undefined
        );
        return { success: true };
      }),
    
    getStats: protectedProcedure.query(async ({ ctx }) => {
      return db.getApplicationStats(ctx.user.id);
    }),
  }),

  // Auto-Apply Management
  autoApply: router({
    // Get candidates that would be auto-applied (preview)
    getCandidates: protectedProcedure.query(async ({ ctx }) => {
      return getAutoApplyCandidates(ctx.user.id);
    }),
    
    // Run auto-apply
    run: protectedProcedure.mutation(async ({ ctx }) => {
      return processAutoApply(ctx.user.id);
    }),
    
    // Get learned patterns
    getPatterns: protectedProcedure.query(async ({ ctx }) => {
      return db.getApplicationPatterns(ctx.user.id);
    }),
    
    // Get auto-apply history/logs
    getHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const { getAutoApplyHistory } = await import("./services/autoApply");
        return getAutoApplyHistory(ctx.user.id, input?.limit || 20);
      }),
    
    // Get auto-apply stats
    getStats: protectedProcedure.query(async ({ ctx }) => {
      const { getAutoApplyStats } = await import("./services/autoApply");
      return getAutoApplyStats(ctx.user.id);
    }),
    
    // Update auto-apply settings
    updateSettings: protectedProcedure
      .input(z.object({
        autoApplyEnabled: z.boolean().optional(),
        autoApplyConfidenceThreshold: z.number().min(50).max(100).optional(),
        autoApplyMaxPerDay: z.number().min(1).max(20).optional(),
        autoApplyNotifyEmail: z.boolean().optional(),
        companyWhitelist: z.array(z.string()).optional(),
        companyBlacklist: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserProfile({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
    
    // Add company to whitelist
    addToWhitelist: protectedProcedure
      .input(z.object({ company: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getUserProfile(ctx.user.id);
        const whitelist = profile?.companyWhitelist || [];
        
        // Canonicalize input: trim and lowercase
        const canonicalInput = input.company.trim().toLowerCase();
        
        // Check for duplicates using case-insensitive substring matching (both directions)
        const isDuplicate = whitelist.some(existing => {
          const existingLower = existing.toLowerCase();
          return existingLower.includes(canonicalInput) || canonicalInput.includes(existingLower);
        });
        
        if (!isDuplicate) {
          whitelist.push(canonicalInput);
          await db.upsertUserProfile({
            userId: ctx.user.id,
            companyWhitelist: whitelist,
          });
        }
        return { success: true, whitelist };
      }),
    
    // Add company to blacklist
    addToBlacklist: protectedProcedure
      .input(z.object({ company: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getUserProfile(ctx.user.id);
        const blacklist = profile?.companyBlacklist || [];
        if (!blacklist.includes(input.company)) {
          blacklist.push(input.company);
          await db.upsertUserProfile({
            userId: ctx.user.id,
            companyBlacklist: blacklist,
          });
        }
        return { success: true, blacklist };
      }),
    
    // Remove company from whitelist
    removeFromWhitelist: protectedProcedure
      .input(z.object({ company: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getUserProfile(ctx.user.id);
        const whitelist = (profile?.companyWhitelist || []).filter(c => c !== input.company);
        await db.upsertUserProfile({
          userId: ctx.user.id,
          companyWhitelist: whitelist,
        });
        return { success: true, whitelist };
      }),
    
    // Remove company from blacklist
    removeFromBlacklist: protectedProcedure
      .input(z.object({ company: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getUserProfile(ctx.user.id);
        const blacklist = (profile?.companyBlacklist || []).filter(c => c !== input.company);
        await db.upsertUserProfile({
          userId: ctx.user.id,
          companyBlacklist: blacklist,
        });
        return { success: true, blacklist };
      }),
  }),

  // Search Filters
  filters: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getSearchFilters(ctx.user.id);
    }),
    
    save: protectedProcedure
      .input(z.object({
        name: z.string(),
        keywords: z.array(z.string()).optional(),
        locations: z.array(z.string()).optional(),
        sources: z.array(z.string()).optional(),
        minRelevanceScore: z.number().optional(),
        maxPostingAge: z.number().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.saveSearchFilter({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
    
    getDefault: protectedProcedure.query(async ({ ctx }) => {
      return db.getDefaultFilter(ctx.user.id);
    }),
  }),

  // Notifications
  notifications: router({
    checkAndSend: protectedProcedure.mutation(async ({ ctx }) => {
      return checkAndNotify(ctx.user.id);
    }),
    
    getHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return db.getEmailNotifications(ctx.user.id, input?.limit);
      }),
    
    sendTest: protectedProcedure.mutation(async ({ ctx }) => {
      const profile = await db.getUserProfile(ctx.user.id);
      const email = profile?.notificationEmail || "bhowmick.saurav@outlook.com";
      
      const testJobs = [{
        id: 0,
        title: "Test Job - Data Scientist",
        company: "Test Company",
        location: "Berlin, Germany",
        score: 85,
        postedAt: new Date(),
        url: "https://example.com/test-job"
      }];
      
      const success = await sendJobNotificationEmail(ctx.user.id, testJobs, email);
      return { success, email };
    }),
  }),

  // Analytics
  analytics: router({
    getOverview: protectedProcedure.query(async ({ ctx }) => {
      const stats = await db.getApplicationStats(ctx.user.id);
      const recentApps = await db.getRecentApplicationTrend(ctx.user.id, 30);
      const lastRefresh = await db.getLastRefresh(ctx.user.id);
      
      // Calculate success rate
      const totalResponses = stats.interview + stats.accepted + stats.rejected;
      const successRate = totalResponses > 0 
        ? Math.round(((stats.interview + stats.accepted) / totalResponses) * 100)
        : 0;
      
      // Calculate average response time (mock for now)
      const avgResponseDays = 7;
      
      return {
        totalApplications: stats.total,
        manualApplications: stats.manual,
        automaticApplications: stats.automatic,
        pendingApplications: stats.pending,
        interviewsScheduled: stats.interview,
        acceptedOffers: stats.accepted,
        rejectedApplications: stats.rejected,
        successRate,
        avgResponseDays,
        lastRefresh: lastRefresh?.refreshedAt,
        nextRefresh: lastRefresh?.nextRefreshAt,
        recentApplications: recentApps.slice(0, 10),
      };
    }),
    
    getApplicationTrend: protectedProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const days = input?.days || 30;
        const apps = await db.getRecentApplicationTrend(ctx.user.id, days);
        
        // Group by date
        const byDate: Record<string, { manual: number; automatic: number }> = {};
        
        apps.forEach(app => {
          const date = app.appliedAt.toISOString().split('T')[0];
          if (!byDate[date]) {
            byDate[date] = { manual: 0, automatic: 0 };
          }
          if (app.applicationType === 'manual') {
            byDate[date].manual++;
          } else {
            byDate[date].automatic++;
          }
        });
        
        return Object.entries(byDate).map(([date, counts]) => ({
          date,
          ...counts,
          total: counts.manual + counts.automatic,
        }));
      }),
  }),

  // Refresh Status
  refresh: router({
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const lastRefresh = await db.getLastRefresh(ctx.user.id);
      
      if (!lastRefresh) {
        return {
          lastRefresh: null,
          nextRefresh: null,
          status: "never",
          jobsFound: 0,
        };
      }
      
      const now = new Date();
      const nextRefresh = lastRefresh.nextRefreshAt || new Date(lastRefresh.refreshedAt.getTime() + 5 * 60 * 60 * 1000);
      const isOverdue = now > nextRefresh;
      
      return {
        lastRefresh: lastRefresh.refreshedAt,
        nextRefresh,
        status: isOverdue ? "overdue" : "scheduled",
        jobsFound: lastRefresh.jobsFound,
        newJobs: lastRefresh.newJobs,
      };
    }),
  }),

  // Scheduler
  scheduler: router({
    // Get scheduled tasks for user
    getTasks: protectedProcedure.query(async ({ ctx }) => {
      return db.getScheduledTasks(ctx.user.id);
    }),
    
    // Update scheduled task settings
    updateTask: protectedProcedure
      .input(z.object({
        taskType: z.enum(["auto_apply", "job_refresh", "notification"]),
        intervalHours: z.number().min(1).max(24).optional(),
        isEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateScheduledTaskSettings } = await import("./services/scheduler");
        await updateScheduledTaskSettings(ctx.user.id, input.taskType, {
          intervalHours: input.intervalHours,
          isEnabled: input.isEnabled,
        });
        return { success: true };
      }),
    
    // Initialize scheduled tasks for user
    initialize: protectedProcedure.mutation(async ({ ctx }) => {
      const { initializeUserScheduledTasks } = await import("./services/scheduler");
      await initializeUserScheduledTasks(ctx.user.id);
      return { success: true };
    }),
    
    // Manually trigger a task
    trigger: protectedProcedure
      .input(z.object({
        taskType: z.enum(["auto_apply", "job_refresh"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { triggerAutoApply, triggerJobRefresh } = await import("./services/scheduler");
        
        if (input.taskType === "auto_apply") {
          return triggerAutoApply(ctx.user.id);
        } else {
          return triggerJobRefresh(ctx.user.id);
        }
      }),
    
    // Get scheduler status
    getStatus: protectedProcedure.query(async () => {
      const { getSchedulerStatus } = await import("./services/scheduler");
      return getSchedulerStatus();
    }),
  }),

  browserAutomation: router({
    isAvailable: protectedProcedure.query(async () => {
      const { isBrowserAutomationAvailable } = await import("./services/browserAutoApply");
      return { available: await isBrowserAutomationAvailable() };
    }),

    // Apply to a single job using browser automation
    applyToJob: protectedProcedure
      .input(z.object({
        jobId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { batchApplyToJobs } = await import("./services/browserAutoApply");
        const result = await batchApplyToJobs(ctx.user.id, [input.jobId]);
        const first = result.results[0];
        if (!first) {
          throw new Error("No application result returned.");
        }
        return first;
      }),
  })
    
    // Apply to multiple jobs using browser automation
    batchApply: protectedProcedure
      .input(z.object({
        jobIds: z.array(z.number()).max(20, "Cannot apply to more than 20 jobs at once"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { batchApplyToJobs } = await import("./services/browserAutoApply");
        return batchApplyToJobs(ctx.user.id, input.jobIds);
      }),
  }),
});

export type AppRouter = typeof appRouter;
