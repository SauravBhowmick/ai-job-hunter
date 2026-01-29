import * as db from "../db";
import { calculateRelevanceScore } from "./jobEngine";
import { sendAutoApplyNotification } from "./emailService";

// Learn patterns from manual applications
export async function learnFromManualApplication(userId: number, jobId: number) {
  const job = await db.getJobById(jobId);
  if (!job) return;
  
  // Extract pattern features from the applied job
  const keywords = job.keywords || [];
  const company = job.company;
  const location = job.location;
  
  // Get existing patterns for user
  const existingPatterns = await db.getApplicationPatterns(userId);
  
  // Check if we have a similar pattern
  let matchedPattern = existingPatterns.find(p => {
    const patternKeywords = p.keywords || [];
    const overlap = keywords.filter(k => patternKeywords.includes(k));
    return overlap.length >= 2; // At least 2 matching keywords
  });
  
  if (matchedPattern) {
    // Update existing pattern
    const newKeywords = Array.from(new Set([...(matchedPattern.keywords || []), ...keywords]));
    const newCompanies = Array.from(new Set([...(matchedPattern.companies || []), company].filter(Boolean)));
    const newLocations = Array.from(new Set([...(matchedPattern.locations || []), location].filter(Boolean)));
    
    await db.updatePatternStats(
      matchedPattern.id,
      (matchedPattern.applicationCount || 0) + 1,
      matchedPattern.successRate || 0
    );
  } else {
    // Create new pattern
    await db.saveApplicationPattern({
      userId,
      patternType: "learned",
      keywords: keywords,
      companies: company ? [company] : [],
      locations: location ? [location] : [],
      minRelevanceScore: 60,
      applicationCount: 1,
      successRate: 0,
      isActive: true
    });
  }
}

// Check if company is in whitelist
function isCompanyWhitelisted(company: string | null, whitelist: string[] | null): boolean {
  if (!whitelist || whitelist.length === 0) return false;
  if (!company) return false;
  const companyLower = company.toLowerCase();
  return whitelist.some(w => companyLower.includes(w.toLowerCase()) || w.toLowerCase().includes(companyLower));
}

// Check if company is in blacklist
function isCompanyBlacklisted(company: string | null, blacklist: string[] | null): boolean {
  if (!blacklist || blacklist.length === 0) return false;
  if (!company) return false;
  const companyLower = company.toLowerCase();
  return blacklist.some(b => companyLower.includes(b.toLowerCase()) || b.toLowerCase().includes(companyLower));
}

// Check if a job matches user's application patterns
export function matchesApplicationPattern(
  job: { title?: string | null; description?: string | null; keywords?: string[] | null; company?: string | null; location?: string | null },
  patterns: { keywords?: string[] | null; companies?: string[] | null; locations?: string[] | null; minRelevanceScore?: number | null }[],
  companyWhitelist?: string[] | null,
  companyBlacklist?: string[] | null
): { matches: boolean; matchedPattern?: typeof patterns[0]; confidence: number; reason?: string } {
  
  // Check blacklist first - immediate rejection
  if (isCompanyBlacklisted(job.company, companyBlacklist || null)) {
    return { matches: false, confidence: 0, reason: "Company is blacklisted" };
  }
  
  // Check whitelist - automatic boost
  const isWhitelisted = isCompanyWhitelisted(job.company, companyWhitelist || null);
  const whitelistBoost = isWhitelisted ? 30 : 0;
  
  for (const pattern of patterns) {
    let matchScore = whitelistBoost;
    const patternKeywords = pattern.keywords || [];
    const patternCompanies = pattern.companies || [];
    const patternLocations = pattern.locations || [];
    const jobKeywords = job.keywords || [];
    
    // Check keyword matches
    const keywordMatches = jobKeywords.filter(k => 
      patternKeywords.some(pk => k.toLowerCase().includes(pk.toLowerCase()) || pk.toLowerCase().includes(k.toLowerCase()))
    );
    if (keywordMatches.length >= 2) {
      matchScore += 40;
    } else if (keywordMatches.length >= 1) {
      matchScore += 20;
    }
    
    // Check company match (from learned patterns)
    if (job.company && patternCompanies.some(c => c.toLowerCase() === job.company?.toLowerCase())) {
      matchScore += 30;
    }
    
    // Check location match
    if (job.location && patternLocations.some(l => job.location?.toLowerCase().includes(l.toLowerCase()))) {
      matchScore += 20;
    }
    
    // Check title/description for pattern keywords
    const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    const textMatches = patternKeywords.filter(pk => text.includes(pk.toLowerCase()));
    matchScore += Math.min(30, textMatches.length * 10);
    
    // Whitelisted companies get a lower threshold
    const threshold = isWhitelisted ? 50 : 60;
    
    if (matchScore >= threshold) {
      return { 
        matches: true, 
        matchedPattern: pattern, 
        confidence: Math.min(100, matchScore),
        reason: isWhitelisted ? "Company is whitelisted" : undefined
      };
    }
  }
  
  return { matches: false, confidence: 0 };
}

// Auto-apply result type
export interface AutoApplyResult {
  applied: number;
  skipped: number;
  scanned: number;
  matched: number;
  appliedJobs: Array<{ id: number; title: string; company: string | null }>;
  skippedReasons: Record<string, number>;
}

// Auto-apply to matching jobs
export async function processAutoApply(userId: number): Promise<AutoApplyResult> {
  const result: AutoApplyResult = {
    applied: 0,
    skipped: 0,
    scanned: 0,
    matched: 0,
    appliedJobs: [],
    skippedReasons: {}
  };
  
  // Get user profile
  const profile = await db.getUserProfile(userId);
  if (!profile || !profile.autoApplyEnabled) {
    result.skippedReasons["Auto-apply disabled"] = 1;
    return result;
  }
  
  // Get settings from profile
  const confidenceThreshold = profile.autoApplyConfidenceThreshold || 70;
  const maxPerDay = profile.autoApplyMaxPerDay || 5;
  const companyWhitelist = profile.companyWhitelist;
  const companyBlacklist = profile.companyBlacklist;
  const notifyEmail = profile.autoApplyNotifyEmail !== false;
  
  // Check how many we've already applied today
  const todayCount = await db.getTodayAutoApplyCount(userId);
  const remainingToday = Math.max(0, maxPerDay - todayCount);
  
  if (remainingToday <= 0) {
    result.skippedReasons["Daily limit reached"] = 1;
    
    // Log the run anyway
    await db.logAutoApplyRun({
      userId,
      jobsScanned: 0,
      jobsMatched: 0,
      jobsApplied: 0,
      jobsSkipped: 0,
      status: "success",
      errorMessage: "Daily limit already reached",
      appliedJobIds: []
    });
    
    return result;
  }
  
  // Get user's application patterns
  const patterns = await db.getApplicationPatterns(userId);
  if (patterns.length === 0) {
    result.skippedReasons["No learned patterns"] = 1;
    return result;
  }
  
  // Get recent jobs with scores
  const jobsWithScores = await db.getJobsWithScores(userId, {
    minScore: profile.relevanceThreshold || 50,
    limit: 100
  });
  
  result.scanned = jobsWithScores.length;
  const appliedJobIds: number[] = [];
  
  for (const { job, score } of jobsWithScores) {
    // Stop if we've hit the daily limit
    if (result.applied >= remainingToday) {
      result.skippedReasons["Daily limit reached"] = (result.skippedReasons["Daily limit reached"] || 0) + 1;
      break;
    }
    
    // Skip if already applied
    const hasApplied = await db.hasAppliedToJob(userId, job.id);
    if (hasApplied) {
      result.skipped++;
      result.skippedReasons["Already applied"] = (result.skippedReasons["Already applied"] || 0) + 1;
      continue;
    }
    
    // Check if job matches patterns
    const { matches, confidence, reason } = matchesApplicationPattern(
      job, 
      patterns, 
      companyWhitelist,
      companyBlacklist
    );
    
    if (!matches) {
      result.skipped++;
      result.skippedReasons[reason || "Low confidence"] = (result.skippedReasons[reason || "Low confidence"] || 0) + 1;
      continue;
    }
    
    result.matched++;
    
    if (confidence >= confidenceThreshold) {
      // Auto-apply to this job
      await db.createApplication({
        userId,
        jobId: job.id,
        applicationType: "automatic",
        status: "submitted",
        appliedAt: new Date(),
        notes: `Auto-applied with ${confidence}% pattern match confidence. Relevance score: ${score}`,
      });
      
      result.applied++;
      result.appliedJobs.push({
        id: job.id,
        title: job.title,
        company: job.company
      });
      appliedJobIds.push(job.id);
    } else {
      result.skipped++;
      result.skippedReasons[`Confidence below ${confidenceThreshold}%`] = 
        (result.skippedReasons[`Confidence below ${confidenceThreshold}%`] || 0) + 1;
    }
  }
  
  // Log the auto-apply run
  await db.logAutoApplyRun({
    userId,
    jobsScanned: result.scanned,
    jobsMatched: result.matched,
    jobsApplied: result.applied,
    jobsSkipped: result.skipped,
    status: result.applied > 0 ? "success" : "partial",
    appliedJobIds,
    notificationSent: false
  });
  
  // Update last auto-apply run time
  await db.updateProfileLastAutoApply(userId);
  
  // Send notification if enabled and jobs were applied
  if (notifyEmail && result.applied > 0) {
    try {
      await sendAutoApplyNotification(userId, result);
    } catch (error) {
      console.error("Failed to send auto-apply notification:", error);
    }
  }
  
  return result;
}

// Get auto-apply candidates (jobs that would be auto-applied) - for preview
export async function getAutoApplyCandidates(userId: number): Promise<any[]> {
  const profile = await db.getUserProfile(userId);
  if (!profile) return [];
  
  const patterns = await db.getApplicationPatterns(userId);
  if (patterns.length === 0) return [];
  
  const confidenceThreshold = profile.autoApplyConfidenceThreshold || 70;
  const companyWhitelist = profile.companyWhitelist;
  const companyBlacklist = profile.companyBlacklist;
  
  const jobsWithScores = await db.getJobsWithScores(userId, {
    minScore: profile.relevanceThreshold || 50,
    limit: 50
  });
  
  const candidates = [];
  
  for (const { job, score, matchedKeywords } of jobsWithScores) {
    const hasApplied = await db.hasAppliedToJob(userId, job.id);
    if (hasApplied) continue;
    
    const { matches, confidence, reason } = matchesApplicationPattern(
      job, 
      patterns,
      companyWhitelist,
      companyBlacklist
    );
    
    if (matches && confidence >= 50) { // Show candidates at 50%+ for preview
      const isWhitelisted = isCompanyWhitelisted(job.company, companyWhitelist);
      const isBlacklisted = isCompanyBlacklisted(job.company, companyBlacklist);
      
      candidates.push({
        job,
        score,
        matchedKeywords,
        autoApplyConfidence: confidence,
        wouldAutoApply: confidence >= confidenceThreshold,
        isWhitelisted,
        isBlacklisted,
        reason
      });
    }
  }
  
  // Sort by confidence descending
  candidates.sort((a, b) => b.autoApplyConfidence - a.autoApplyConfidence);
  
  return candidates;
}

// Get auto-apply history/logs
export async function getAutoApplyHistory(userId: number, limit: number = 20) {
  return db.getAutoApplyLogs(userId, limit);
}

// Get auto-apply stats
export async function getAutoApplyStats(userId: number) {
  const profile = await db.getUserProfile(userId);
  const logs = await db.getAutoApplyLogs(userId, 30);
  const todayCount = await db.getTodayAutoApplyCount(userId);
  const patterns = await db.getApplicationPatterns(userId);
  
  const maxPerDay = profile?.autoApplyMaxPerDay || 5;
  
  // Calculate stats from logs
  const totalApplied = logs.reduce((sum, log) => sum + (log.jobsApplied || 0), 0);
  const totalScanned = logs.reduce((sum, log) => sum + (log.jobsScanned || 0), 0);
  const successRate = totalScanned > 0 ? Math.round((totalApplied / totalScanned) * 100) : 0;
  
  return {
    isEnabled: profile?.autoApplyEnabled || false,
    confidenceThreshold: profile?.autoApplyConfidenceThreshold || 70,
    maxPerDay,
    appliedToday: todayCount,
    remainingToday: Math.max(0, maxPerDay - todayCount),
    totalAppliedLast30Days: totalApplied,
    patternsCount: patterns.length,
    successRate,
    lastRunAt: profile?.lastAutoApplyRun,
    whitelistedCompanies: profile?.companyWhitelist?.length || 0,
    blacklistedCompanies: profile?.companyBlacklist?.length || 0,
  };
}
