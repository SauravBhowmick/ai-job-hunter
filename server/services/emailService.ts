import * as db from "../db";
import { notifyOwner } from "../_core/notification";

const DEFAULT_NOTIFICATION_EMAIL = "bhowmick.saurav@outlook.com";

interface JobNotification {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  score: number | null;
  postedAt: Date | null;
  url: string | null;
}

// Format jobs for email notification
function formatJobsForEmail(jobs: JobNotification[]): string {
  if (jobs.length === 0) {
    return "No new matching jobs found in this period.";
  }
  
  let content = `🎯 ${jobs.length} New Job Opportunities Found!\n\n`;
  content += "=" .repeat(50) + "\n\n";
  
  jobs.forEach((job, index) => {
    content += `${index + 1}. ${job.title}\n`;
    content += `   Company: ${job.company || 'Not specified'}\n`;
    content += `   Location: ${job.location || 'Not specified'}\n`;
    content += `   Relevance Score: ${job.score || 0}%\n`;
    content += `   Posted: ${job.postedAt ? formatTimeAgo(job.postedAt) : 'Unknown'}\n`;
    if (job.url) {
      content += `   Apply: ${job.url}\n`;
    }
    content += "\n" + "-".repeat(50) + "\n\n";
  });
  
  content += "\n📊 Summary:\n";
  content += `Total Jobs: ${jobs.length}\n`;
  content += `Average Relevance: ${Math.round(jobs.reduce((sum, j) => sum + (j.score || 0), 0) / jobs.length)}%\n`;
  content += `Highest Match: ${Math.max(...jobs.map(j => j.score || 0))}%\n`;
  
  return content;
}

// Format time ago string
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }
}

// Send job notification email
export async function sendJobNotificationEmail(
  userId: number,
  jobs: JobNotification[],
  recipientEmail?: string
): Promise<boolean> {
  const profile = await db.getUserProfile(userId);
  const email = recipientEmail || profile?.notificationEmail || DEFAULT_NOTIFICATION_EMAIL;
  
  if (jobs.length === 0) {
    console.log("No jobs to notify about");
    return false;
  }
  
  const title = `🎯 AI Job Hunter: ${jobs.length} New Matching Jobs Found`;
  const content = formatJobsForEmail(jobs);
  
  try {
    // Use the built-in notification system to notify the owner
    const success = await notifyOwner({ title, content });
    
    // Log the notification
    await db.logEmailNotification({
      userId,
      recipientEmail: email,
      subject: title,
      jobCount: jobs.length,
      sentAt: new Date(),
      status: success ? "sent" : "failed"
    });
    
    console.log(`Email notification ${success ? 'sent' : 'failed'} to ${email} with ${jobs.length} jobs`);
    return success;
  } catch (error) {
    console.error("Error sending email notification:", error);
    
    await db.logEmailNotification({
      userId,
      recipientEmail: email,
      subject: title,
      jobCount: jobs.length,
      sentAt: new Date(),
      status: "failed"
    });
    
    return false;
  }
}

// Check for new jobs and send notification if found
export async function checkAndNotify(userId: number): Promise<{ notified: boolean; jobCount: number }> {
  const profile = await db.getUserProfile(userId);
  const minScore = profile?.relevanceThreshold || 50;
  
  // Get jobs posted in the last 5 hours with good relevance
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
  
  const jobsWithScores = await db.getJobsWithScores(userId, {
    minScore,
    limit: 50
  });
  
  // Filter to recent jobs
  const recentJobs = jobsWithScores.filter(j => 
    j.job.postedAt && j.job.postedAt >= fiveHoursAgo
  );
  
  if (recentJobs.length === 0) {
    return { notified: false, jobCount: 0 };
  }
  
  // Format for notification
  const jobsForNotification: JobNotification[] = recentJobs.map(j => ({
    id: j.job.id,
    title: j.job.title,
    company: j.job.company,
    location: j.job.location,
    score: j.score,
    postedAt: j.job.postedAt,
    url: j.job.url
  }));
  
  const success = await sendJobNotificationEmail(userId, jobsForNotification);
  
  return { notified: success, jobCount: recentJobs.length };
}

// Schedule notification check (called by scheduled task)
export async function runScheduledNotificationCheck(): Promise<void> {
  console.log("Running scheduled notification check...");
  
  // In a real implementation, this would iterate through all users
  // For now, we'll handle notifications through the API
  console.log("Scheduled check complete");
}
