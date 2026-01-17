import * as db from "../db";
import { calculateRelevanceScore } from "./jobEngine";

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

// Check if a job matches user's application patterns
export function matchesApplicationPattern(
  job: { title?: string | null; description?: string | null; keywords?: string[] | null; company?: string | null; location?: string | null },
  patterns: { keywords?: string[] | null; companies?: string[] | null; locations?: string[] | null; minRelevanceScore?: number | null }[]
): { matches: boolean; matchedPattern?: typeof patterns[0]; confidence: number } {
  
  for (const pattern of patterns) {
    let matchScore = 0;
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
    
    // Check company match
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
    
    if (matchScore >= 60) {
      return { matches: true, matchedPattern: pattern, confidence: Math.min(100, matchScore) };
    }
  }
  
  return { matches: false, confidence: 0 };
}

// Auto-apply to matching jobs
export async function processAutoApply(userId: number): Promise<{ applied: number; skipped: number }> {
  // Get user profile
  const profile = await db.getUserProfile(userId);
  if (!profile || !profile.autoApplyEnabled) {
    return { applied: 0, skipped: 0 };
  }
  
  // Get user's application patterns
  const patterns = await db.getApplicationPatterns(userId);
  if (patterns.length === 0) {
    return { applied: 0, skipped: 0 };
  }
  
  // Get recent jobs with scores
  const jobsWithScores = await db.getJobsWithScores(userId, {
    minScore: profile.relevanceThreshold || 50,
    limit: 100
  });
  
  let applied = 0;
  let skipped = 0;
  
  for (const { job, score } of jobsWithScores) {
    // Skip if already applied
    const hasApplied = await db.hasAppliedToJob(userId, job.id);
    if (hasApplied) {
      skipped++;
      continue;
    }
    
    // Check if job matches patterns
    const { matches, confidence } = matchesApplicationPattern(job, patterns);
    
    if (matches && confidence >= 70) {
      // Auto-apply to this job
      await db.createApplication({
        userId,
        jobId: job.id,
        applicationType: "automatic",
        status: "submitted",
        appliedAt: new Date(),
        notes: `Auto-applied with ${confidence}% pattern match confidence. Relevance score: ${score}`,
      });
      
      applied++;
      
      // Limit auto-applications per run
      if (applied >= 5) break;
    } else {
      skipped++;
    }
  }
  
  return { applied, skipped };
}

// Get auto-apply candidates (jobs that would be auto-applied)
export async function getAutoApplyCandidates(userId: number): Promise<any[]> {
  const profile = await db.getUserProfile(userId);
  if (!profile) return [];
  
  const patterns = await db.getApplicationPatterns(userId);
  if (patterns.length === 0) return [];
  
  const jobsWithScores = await db.getJobsWithScores(userId, {
    minScore: profile.relevanceThreshold || 50,
    limit: 50
  });
  
  const candidates = [];
  
  for (const { job, score, matchedKeywords } of jobsWithScores) {
    const hasApplied = await db.hasAppliedToJob(userId, job.id);
    if (hasApplied) continue;
    
    const { matches, confidence } = matchesApplicationPattern(job, patterns);
    
    if (matches && confidence >= 60) {
      candidates.push({
        job,
        score,
        matchedKeywords,
        autoApplyConfidence: confidence,
        wouldAutoApply: confidence >= 70
      });
    }
  }
  
  return candidates;
}
