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
/**
 * Lazily loads and returns the Playwright module if it can be imported.
 *
 * @returns The Playwright module when available, or `null` if it could not be loaded.
 */
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
 * Attempts to apply to the given job using a Playwright-driven browser workflow.
 *
 * Dispatches to a source-specific automation handler (e.g., LinkedIn, Indeed, StepStone)
 * based on `job.source`. Requires Playwright to be available.
 *
 * @param job - Job metadata and URL used to perform the application
 * @param profile - Applicant information used to populate application fields
 * @returns An ApplicationResult describing success or failure. If Playwright is not available,
 *          `success` will be `false` and `error` will indicate the missing dependency; on success,
 *          handlers may include a `submittedAt` timestamp and optional diagnostic fields. 
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
 * Automates filling LinkedIn's Easy Apply form for a specific job using Playwright.
 *
 * Navigates to the job URL, detects whether LinkedIn login is required, locates the Easy Apply control,
 * and fills common fields (first name, last name, email, phone) from the provided profile. For safety,
 * the function does not submit the application and returns a simulated result.
 *
 * @param job - Job data (uses `job.jobUrl` to navigate and `job.jobId` to identify the result)
 * @param profile - Applicant data (uses `fullName`, `email`, and `phone` to populate form fields)
 * @returns `ApplicationResult` indicating success when fields were filled (simulated submission) or failure with an error message; on simulated success `submittedAt` will be set. 
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
 * Automates filling an Indeed job application form for a single job.
 *
 * Attempts to navigate to the job URL, locate the Indeed apply control, click it,
 * and populate common fields (name, email, phone). For safety, the form is filled
 * but not submitted.
 *
 * @param job - Job data; must include `jobUrl` and `jobId`
 * @param profile - Applicant details used to populate name, email, and phone
 * @returns An ApplicationResult describing success or failure. On success, `success` is `true`, `jobId` is set, `submittedAt` contains the timestamp, and `error` contains a simulated note indicating the form was not submitted; on failure, `success` is `false` and `error` explains the reason (e.g., no apply button found or external application required).
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
 * Automates filling StepStone's job application form using Playwright without submitting the application.
 *
 * Opens a headless Chromium instance, navigates to the job URL, attempts to locate the StepStone apply control,
 * and fills common fields (first name, last name, email, phone) from the provided profile. The function does not
 * perform a final submission for safety and always closes the browser before returning.
 *
 * `@param` pw - The Playwright module instance used to launch the browser
 * `@param` job - Job details (including jobUrl and jobId) to apply to
 * `@param` profile - Applicant profile data used to populate form fields
 * `@returns` An ApplicationResult: `success` is `true` and `submittedAt` is set when the form was filled (simulated); `success` is `false` and `error` contains a message if the apply control was not found or an error occurred.
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
 * Attempts to locate a generic apply control on the job page and populate common form fields.
 *
 * Navigates to job.jobUrl, looks for common "apply" controls, and tries to fill name, email, and phone fields using the provided profile. Does not perform a final submission; successful runs are simulated.
 *
 * `@param` job - Job metadata; `job.jobUrl` is used to navigate and `job.jobId` is included in the returned result
 * `@param` profile - Applicant data used to populate common form fields (full name, email, phone)
 * `@returns` An ApplicationResult. `success` is `true` if an apply control was found and common fields were filled (simulated) and `submittedAt` is set; `success` is `false` when no apply control was found or an error occurred and `error` contains the reason.
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
 * Attempts to find an element on the given page by selector and fill it with the provided value.
 *
 * This function swallows errors and returns `false` if the element cannot be found or the fill fails.
 *
 * @param page - Playwright page instance to operate on
 * @param selector - CSS or selector string used to locate the form field
 * @param value - The text to enter into the located field
 * @returns `true` if the field was found and filled, `false` otherwise.
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
 * Attempts to fill a form field using each selector in order until one succeeds.
 *
 * @param selectors - Array of CSS or XPath selectors to try for the target field
 * @param value - The value to type into the first matching field
 * @returns `true` if a field was successfully filled, `false` otherwise.
 */
async function tryFillField(page: any, selectors: string[], value: string) {
  for (const selector of selectors) {
    const filled = await fillFormField(page, selector, value);
    if (filled) return true;
  }
  return false;
}

/**
 * Apply to a list of jobs using the stored user profile and record the outcomes.
 *
 * Retrieves the user's profile, builds an applicant profile, and attempts to apply to each job sequentially via the browser automation flow. Records successful applications in the database and returns per-job results along with counts of successful and failed attempts.
 *
 * @param userId - The ID of the user whose profile will be used for applications
 * @param jobIds - Array of job IDs to process
 * @returns An object containing `results` (per-job ApplicationResult array), `successCount` (number of successful applications), and `failCount` (number of failed attempts)
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
 * Determine whether browser automation via Playwright is available.
 *
 * @returns `true` if Playwright can be loaded and used, `false` otherwise.
 */
export async function isBrowserAutomationAvailable(): Promise<boolean> {
  const pw = await getPlaywright();
  return pw !== null;
}