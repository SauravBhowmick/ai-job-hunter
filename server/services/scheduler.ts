import * as db from "../db";
import { processAutoApply } from "./autoApply";
import { refreshJobs, scoreJobsForUser } from "./jobEngine";
import { checkAndNotify } from "./emailService";

// Interval in milliseconds for checking scheduled tasks (5 minutes)
const SCHEDULER_CHECK_INTERVAL = 5 * 60 * 1000;

let schedulerInterval: NodeJS.Timer | null = null;

/**
 * Initialize scheduled task for a user
 */
export async function initializeUserScheduledTasks(userId: number) {
  const now = new Date();
  const defaultIntervalHours = 6;
  const nextRun = new Date(now.getTime() + defaultIntervalHours * 60 * 60 * 1000);
  
  // Create auto-apply scheduled task if not exists
  await db.upsertScheduledTask({
    userId,
    taskType: "auto_apply",
    intervalHours: defaultIntervalHours,
    lastRunAt: null,
    nextRunAt: nextRun,
    isEnabled: true,
  });
  
  // Create job refresh scheduled task
  await db.upsertScheduledTask({
    userId,
    taskType: "job_refresh",
    intervalHours: 5, // Every 5 hours
    lastRunAt: null,
    nextRunAt: new Date(now.getTime() + 5 * 60 * 60 * 1000),
    isEnabled: true,
  });
  
  // Create notification scheduled task
  await db.upsertScheduledTask({
    userId,
    taskType: "notification",
    intervalHours: 6,
    lastRunAt: null,
    nextRunAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
    isEnabled: true,
  });
}

/**
 * Run a specific scheduled task
 */
async function runScheduledTask(task: {
  userId: number;
  taskType: "auto_apply" | "job_refresh" | "notification";
  intervalHours: number | null;
}) {
  const { userId, taskType, intervalHours } = task;
  
  console.log(`[Scheduler] Running ${taskType} for user ${userId}`);
  
  try {
    switch (taskType) {
      case "auto_apply":
        const profile = await db.getUserProfile(userId);
        if (profile?.autoApplyEnabled) {
          await processAutoApply(userId);
        }
        break;
        
      case "job_refresh":
        await refreshJobs(userId);
        const userProfile = await db.getUserProfile(userId);
        if (userProfile) {
          await scoreJobsForUser(userId, userProfile.skills || []);
        }
        break;
        
      case "notification":
        const notifyProfile = await db.getUserProfile(userId);
        if (notifyProfile?.notificationEmail) {
          await checkAndNotify(userId);
        }
        break;
    }
    
    // Update the scheduled task with next run time
    await db.updateScheduledTaskRun(userId, taskType, intervalHours || 6);
    
    console.log(`[Scheduler] Completed ${taskType} for user ${userId}`);
  } catch (error) {
    console.error(`[Scheduler] Error running ${taskType} for user ${userId}:`, error);
  }
}

/**
 * Check and run due scheduled tasks
 */
export async function checkAndRunDueTasks() {
  try {
    const dueTasks = await db.getDueScheduledTasks();
    
    if (dueTasks.length === 0) {
      return { tasksRun: 0 };
    }
    
    console.log(`[Scheduler] Found ${dueTasks.length} due tasks`);
    
    for (const task of dueTasks) {
      await runScheduledTask(task as any);
    }
    
    return { tasksRun: dueTasks.length };
  } catch (error) {
    console.error("[Scheduler] Error checking due tasks:", error);
    return { tasksRun: 0, error };
  }
}

/**
 * Start the scheduler background process
 */
export function startScheduler() {
  if (schedulerInterval) {
    console.log("[Scheduler] Already running");
    return;
  }
  
  console.log("[Scheduler] Starting background scheduler");
  
  // Run immediately on startup
  checkAndRunDueTasks();
  
  // Then run every 5 minutes
  schedulerInterval = setInterval(async () => {
    await checkAndRunDueTasks();
  }, SCHEDULER_CHECK_INTERVAL);
}

/**
 * Stop the scheduler background process
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Stopped background scheduler");
  }
}

/**
 * Manually trigger auto-apply for a user
 */
export async function triggerAutoApply(userId: number) {
  return processAutoApply(userId);
}

/**
 * Manually trigger job refresh for a user
 */
export async function triggerJobRefresh(userId: number) {
  const result = await refreshJobs(userId);
  const profile = await db.getUserProfile(userId);
  if (profile) {
    await scoreJobsForUser(userId, profile.skills || []);
  }
  return result;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    isRunning: schedulerInterval !== null,
    checkIntervalMinutes: SCHEDULER_CHECK_INTERVAL / 60000,
  };
}

/**
 * Update a user's scheduled task settings
 */
export async function updateScheduledTaskSettings(
  userId: number,
  taskType: "auto_apply" | "job_refresh" | "notification",
  settings: {
    intervalHours?: number;
    isEnabled?: boolean;
  }
) {
  const existing = await db.getScheduledTask(userId, taskType);
  
  if (existing) {
    const now = new Date();
    const intervalHours = settings.intervalHours || existing.intervalHours || 6;
    const nextRun = new Date(now.getTime() + intervalHours * 60 * 60 * 1000);
    
    await db.upsertScheduledTask({
      userId,
      taskType,
      intervalHours,
      isEnabled: settings.isEnabled ?? existing.isEnabled,
      nextRunAt: nextRun,
    });
  } else {
    await initializeUserScheduledTasks(userId);
  }
}
