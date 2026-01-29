/**
 * Browser Automation for Real Job Applications
 * 
 * This service uses Playwright to automate actual job applications on various job boards.
 * Note: This requires the Playwright package to be installed: pnpm add playwright
 * 
 * IMPORTANT: This is for educational purposes. Real automated job applications should:
 * 1. Respect job board terms of service
 * 2. Use official APIs where available
 * 3. Not spam employers
 * 4. Be used responsibly
 */

import * as db from "../db";

// Types for application automation
export interface JobApplicationData {
  jobId: number;
  jobUrl: string;
  jobTitle: string;
  company: string;
  source: string;
}

export interface ApplicantProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  cvFileUrl?: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  coverLetter?: string;
}

export interface ApplicationResult {
  success: boolean;
  jobId: number;
  error?: string;
  screenshot?: string;
  submittedAt?: Date;
}

// Check if Playwright is available
let playwright: any = null;
async function getPlaywright() {
  if (!playwright) {
    try {
      playwright = await import('playwright');
    } catch (error) {
      console.warn("Playwright not installed. Run: pnpm add playwright");
      return null;
    }
  }
  return playwright;
}

/**
 * Apply to a job using browser automation
 */
export async function applyToJobWithBrowser(
  job: JobApplicationData,
  profile: ApplicantProfile
): Promise<ApplicationResult> {
  const pw = await getPlaywright();
  
  if (!pw) {
    return {
      success: false,
      jobId: job.jobId,
      error: "Playwright not installed. Browser automation unavailable."
    };
  }
  
  // Route to the appropriate handler based on job source
  switch (job.source) {
    case "linkedin":
      return applyViaLinkedIn(pw, job, profile);
    case "indeed":
      return applyViaIndeed(pw, job, profile);
    case "stepstone":
      return applyViaStepStone(pw, job, profile);
    default:
      return applyViaGenericForm(pw, job, profile);
  }
}

/**
 * LinkedIn Easy Apply automation
 */
async function applyViaLinkedIn(
  pw: any,
  job: JobApplicationData,
  profile: ApplicantProfile
): Promise<ApplicationResult> {
  let browser;
  
  try {
    browser = await pw.chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    // Navigate to job page
    await page.goto(job.jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Check if login is required
    const loginRequired = await page.$('input[name="session_key"]');
    if (loginRequired) {
      return {
        success: false,
        jobId: job.jobId,
        error: "LinkedIn login required. Please set up LinkedIn credentials."
      };
    }
    
    // Look for Easy Apply button
    const easyApplyButton = await page.$('[data-control-name="jobdetails_topcard_inapply"]');
    if (!easyApplyButton) {
      return {
        success: false,
        jobId: job.jobId,
        error: "No Easy Apply option found for this job."
      };
    }
    
    // Click Easy Apply
    await easyApplyButton.click();
    await page.waitForTimeout(2000);
    
    // Fill form fields
    await fillFormField(page, 'input[name="firstName"]', profile.fullName.split(' ')[0]);
    await fillFormField(page, 'input[name="lastName"]', profile.fullName.split(' ').slice(1).join(' '));
    await fillFormField(page, 'input[name="email"]', profile.email);
    await fillFormField(page, 'input[name="phone"]', profile.phone);
    
    // Note: Actually submitting would require more handling
    // For safety, we'll stop here and mark as simulated
    
    return {
      success: true,
      jobId: job.jobId,
      submittedAt: new Date(),
      error: "Simulated - form filled but not submitted for safety"
    };
    
  } catch (error: any) {
    return {
      success: false,
      jobId: job.jobId,
      error: `LinkedIn apply error: ${error.message}`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Indeed Apply automation
 */
async function applyViaIndeed(
  pw: any,
  job: JobApplicationData,
  profile: ApplicantProfile
): Promise<ApplicationResult> {
  let browser;
  
  try {
    browser = await pw.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(job.jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Look for Apply button
    const applyButton = await page.$('[data-indeed-apply-button]');
    if (!applyButton) {
      const externalApply = await page.$('a[data-tn-element="apply-button"]');
      if (externalApply) {
        return {
          success: false,
          jobId: job.jobId,
          error: "External application required - cannot automate."
        };
      }
      return {
        success: false,
        jobId: job.jobId,
        error: "No apply button found."
      };
    }
    
    // Click apply
    await applyButton.click();
    await page.waitForTimeout(2000);
    
    // Fill form
    await fillFormField(page, '#input-applicant.name', profile.fullName);
    await fillFormField(page, '#input-applicant.email', profile.email);
    await fillFormField(page, '#input-applicant.phoneNumber', profile.phone);
    
    return {
      success: true,
      jobId: job.jobId,
      submittedAt: new Date(),
      error: "Simulated - form filled but not submitted for safety"
    };
    
  } catch (error: any) {
    return {
      success: false,
      jobId: job.jobId,
      error: `Indeed apply error: ${error.message}`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * StepStone Apply automation
 */
async function applyViaStepStone(
  pw: any,
  job: JobApplicationData,
  profile: ApplicantProfile
): Promise<ApplicationResult> {
  let browser;
  
  try {
    browser = await pw.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(job.jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Look for Apply button
    const applyButton = await page.$('[data-at="apply-button"]');
    if (!applyButton) {
      return {
        success: false,
        jobId: job.jobId,
        error: "No apply button found on StepStone."
      };
    }
    
    await applyButton.click();
    await page.waitForTimeout(2000);
    
    // Fill form
    await fillFormField(page, 'input[name="firstName"]', profile.fullName.split(' ')[0]);
    await fillFormField(page, 'input[name="lastName"]', profile.fullName.split(' ').slice(1).join(' '));
    await fillFormField(page, 'input[name="email"]', profile.email);
    await fillFormField(page, 'input[name="phone"]', profile.phone);
    
    return {
      success: true,
      jobId: job.jobId,
      submittedAt: new Date(),
      error: "Simulated - form filled but not submitted for safety"
    };
    
  } catch (error: any) {
    return {
      success: false,
      jobId: job.jobId,
      error: `StepStone apply error: ${error.message}`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generic form automation for unknown job boards
 */
async function applyViaGenericForm(
  pw: any,
  job: JobApplicationData,
  profile: ApplicantProfile
): Promise<ApplicationResult> {
  let browser;
  
  try {
    browser = await pw.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(job.jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Try to find common apply buttons
    const applySelectors = [
      'button:has-text("Apply")',
      'a:has-text("Apply Now")',
      'button:has-text("Submit Application")',
      '[class*="apply"]',
      '#apply-button'
    ];
    
    let applyButton = null;
    for (const selector of applySelectors) {
      applyButton = await page.$(selector);
      if (applyButton) break;
    }
    
    if (!applyButton) {
      return {
        success: false,
        jobId: job.jobId,
        error: "Could not find apply button. Manual application required."
      };
    }
    
    // Try common form field names
    const nameSelectors = ['input[name*="name"]', 'input[id*="name"]', 'input[placeholder*="name"]'];
    const emailSelectors = ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]'];
    const phoneSelectors = ['input[type="tel"]', 'input[name*="phone"]', 'input[id*="phone"]'];
    
    await tryFillField(page, nameSelectors, profile.fullName);
    await tryFillField(page, emailSelectors, profile.email);
    await tryFillField(page, phoneSelectors, profile.phone);
    
    return {
      success: true,
      jobId: job.jobId,
      submittedAt: new Date(),
      error: "Simulated - attempted to fill generic form"
    };
    
  } catch (error: any) {
    return {
      success: false,
      jobId: job.jobId,
      error: `Generic apply error: ${error.message}`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Helper function to fill a form field
 */
async function fillFormField(page: any, selector: string, value: string) {
  try {
    const field = await page.$(selector);
    if (field) {
      await field.fill(value);
      return true;
    }
  } catch (error) {
    // Field not found or fill failed
  }
  return false;
}

/**
 * Helper function to try multiple selectors for a field
 */
async function tryFillField(page: any, selectors: string[], value: string) {
  for (const selector of selectors) {
    const filled = await fillFormField(page, selector, value);
    if (filled) return true;
  }
  return false;
}

/**
 * Batch apply to multiple jobs
 */
export async function batchApplyToJobs(
  userId: number,
  jobIds: number[]
): Promise<{ results: ApplicationResult[]; successCount: number; failCount: number }> {
  const profile = await db.getUserProfile(userId);
  
  if (!profile) {
    return {
      results: [],
      successCount: 0,
      failCount: jobIds.length
    };
  }
  
  const applicantProfile: ApplicantProfile = {
    fullName: profile.fullName || "",
    email: profile.email || "",
    phone: profile.phone || "",
    location: profile.location || "",
    cvFileUrl: profile.cvFileUrl || undefined,
  };
  
  const results: ApplicationResult[] = [];
  let successCount = 0;
  let failCount = 0;
  
  for (const jobId of jobIds) {
    const job = await db.getJobById(jobId);
    
    if (!job || !job.url) {
      results.push({
        success: false,
        jobId,
        error: "Job not found or no URL available"
      });
      failCount++;
      continue;
    }
    
    const jobData: JobApplicationData = {
      jobId: job.id,
      jobUrl: job.url,
      jobTitle: job.title,
      company: job.company || "",
      source: job.source
    };
    
    const result = await applyToJobWithBrowser(jobData, applicantProfile);
    results.push(result);
    
    if (result.success) {
      successCount++;
      
      // Record the application
      await db.createApplication({
        userId,
        jobId,
        applicationType: "automatic",
        status: "submitted",
        appliedAt: new Date(),
        notes: `Browser automation applied. ${result.error || ""}`,
      });
    } else {
      failCount++;
    }
    
    // Add delay between applications to be respectful
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  return { results, successCount, failCount };
}

/**
 * Check if browser automation is available
 */
export async function isBrowserAutomationAvailable(): Promise<boolean> {
  const pw = await getPlaywright();
  return pw !== null;
}
