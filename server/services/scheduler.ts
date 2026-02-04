import * as db from "../db";
import { processAutoApply } from "./autoApply";
import { refreshJobs, scoreJobsForUser } from "./jobEngine";
import { checkAndNotify } from "./emailService";

// Interval in milliseconds for checking scheduled tasks (5 minutes)
const SCHEDULER_CHECK_INTERVAL = 5 * 60 * 1000;

let schedulerInterval: NodeJS.Timer | null = null;

/**
 * Create default scheduled tasks for a new user.
 *
 * Creates three enabled tasks for the given user with initial intervals and next run times:
 * - `auto_apply`: interval 6 hours, next run 6 hours from now
 * - `job_refresh`: interval 5 hours, next run 5 hours from now
 * - `notification`: interval 6 hours, next run 6 hours from now
 *
 * @param userId - The ID of the user to initialize scheduled tasks for
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
 * Execute the scheduled task described by `task` for the specified user and update its next run time.
 *
 * Performs the action associated with `task.taskType` (auto_apply, job_refresh, or notification) for `task.userId`,
 * then advances the task's next run time using `task.intervalHours` (defaults to 6 hours when `null`).
 *
 * @param task - Object describing the scheduled task:
 *   - userId: The user's numeric identifier.
 *   - taskType: One of `"auto_apply" | "job_refresh" | "notification"` indicating which job to run.
 *   - intervalHours: Interval in hours to schedule the next run; if `null`, 6 hours is used.
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
      case "auto_apply": {
        const profile = await db.getUserProfile(userId);
        if (profile?.autoApplyEnabled) {
          await processAutoApply(userId);
        }
        break;
      }
        
      case "job_refresh": {
        await refreshJobs(userId);
        const userProfile = await db.getUserProfile(userId);
        if (userProfile) {
          await scoreJobsForUser(userId, userProfile.skills || []);
        }
        break;
      }
        
      case "notification": {
        const notifyProfile = await db.getUserProfile(userId);
        if (notifyProfile?.notificationEmail) {
          await checkAndNotify(userId);
        }
        break;
      }
    }
    
    // Update the scheduled task with next run time
    await db.updateScheduledTaskRun(userId, taskType, intervalHours || 6);
    
    console.log(`[Scheduler] Completed ${taskType} for user ${userId}`);
  } catch (error) {
    console.error(`[Scheduler] Error running ${taskType} for user ${userId}:`, error);
  }
}

/**
 * Finds scheduled tasks whose next run time has arrived and executes each one.
 *
 * @returns An object with `tasksRun` set to the number of tasks executed and an optional `error` property when execution failed
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
 * Stops the background scheduler if it is running.
 *
 * Clears the interval timer and resets the module's scheduler state.
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Stopped background scheduler");
  }
}

/**
 * Trigger the auto-apply process for the specified user.
 *
 * @param userId - The ID of the user to process
 * @returns The result of the auto-apply operation
 */
export async function triggerAutoApply(userId: number) {
  return processAutoApply(userId);
}

/**
 * Triggers a job refresh for the specified user and re-scores jobs using the user's skills if available.
 *
 * If a user profile with skills exists, jobs will be re-scored after the refresh completes.
 *
 * @param userId - ID of the user whose jobs will be refreshed
 * @returns The result of the job refresh operation
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
 * Provides the scheduler's running state and the configured check interval in minutes.
 *
 * @returns An object with `isRunning` set to `true` if the scheduler is active, `false` otherwise, and `checkIntervalMinutes` indicating the interval between scheduler checks in minutes.
 */
export function getSchedulerStatus() {
  return {
    isRunning: schedulerInterval !== null,
    checkIntervalMinutes: SCHEDULER_CHECK_INTERVAL / 60000,
  };
}

/**
 * Update scheduling configuration for a user's specific scheduled task.
 *
 * If the task exists, updates its interval (and recalculates the next run time relative to now)
 * and enabled state; if the task does not exist, initializes default scheduled tasks for the user.
 *
 * @param settings - New settings to apply to the task
 * @param settings.intervalHours - Desired interval between runs in hours; if omitted, the task's existing interval is preserved, or 6 hours is used when creating a new next run time
 * @param settings.isEnabled - Whether the task should be enabled; if omitted, the task's existing enabled state is preserved
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