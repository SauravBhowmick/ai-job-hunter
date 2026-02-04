import { InsertJob } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "../_core/env";
import { 
  extractCountryCode, 
  isSchengenCountry, 
  detectVisaSponsorship,
} from "../../shared/schengen";
import { randomInt } from "crypto";

// Job scraper configuration
interface JobScraperConfig {
  adzunaAppId?: string;
  adzunaApiKey?: string;
  jsearchApiKey?: string;
}

interface ExternalJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  url: string;
  postedAt: Date;
  source: string;
}

// Adzuna API response types
interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string; area: string[] };
  description: string;
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  created: string;
  category?: { label: string };
}

interface AdzunaResponse {
  results: AdzunaJob[];
  count: number;
}

// JSearch API response types
interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_city: string;
  job_state: string;
  job_country: string;
  job_description: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_apply_link: string;
  job_posted_at_datetime_utc: string;
}

interface JSearchResponse {
  data: JSearchJob[];
  status: string;
}

/**
 * Retrieve job listings from the Adzuna API for the given keywords and countries.
 *
 * Queries Adzuna per country and returns results mapped to the module's ExternalJob shape.
 *
 * @param appId - Adzuna application ID
 * @param apiKey - Adzuna API key
 * @param keywords - Search terms to send to the API
 * @param countries - Country codes to query; defaults to ["de", "at", "ch", "nl", "fr"]
 * @returns An array of ExternalJob objects built from Adzuna search results; results for countries that fail to respond are omitted
 */
async function fetchFromAdzuna(
  appId: string,
  apiKey: string,
  keywords: string[],
  countries: string[] = ["de", "at", "ch", "nl", "fr"] // Default Schengen countries
): Promise<ExternalJob[]> {
  const jobs: ExternalJob[] = [];
  
  for (const country of countries) {
    try {
      const query = keywords.join(" ");
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?` + 
        new URLSearchParams({
          app_id: appId,
          app_key: apiKey,
          results_per_page: "50",
          what: query,
          content_type: "application/json",
        });
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Adzuna API error for ${country}:`, response.statusText);
        continue;
      }
      
      const data: AdzunaResponse = await response.json();
      
      for (const job of data.results) {
        jobs.push({
          id: `adzuna-${job.id}`,
          title: job.title,
          company: job.company?.display_name || "Unknown Company",
          location: job.location?.display_name || country.toUpperCase(),
          description: job.description || "",
          salary: job.salary_min && job.salary_max 
            ? `€${Math.round(job.salary_min / 1000)}k - €${Math.round(job.salary_max / 1000)}k`
            : undefined,
          url: job.redirect_url,
          postedAt: new Date(job.created),
          source: "adzuna",
        });
      }
    } catch (error) {
      console.error(`Error fetching from Adzuna for ${country}:`, error);
    }
  }
  
  return jobs;
}

/**
 * Retrieve job postings from the JSearch (RapidAPI) endpoint for the specified keywords and locations.
 *
 * @param apiKey - RapidAPI key used to authenticate JSearch requests
 * @param keywords - Array of search keywords combined into the query
 * @param locations - List of location names to query (defaults to ["Germany", "Netherlands", "France", "Austria", "Switzerland"])
 * @returns An array of `ExternalJob` objects mapped from JSearch results; `postedAt` is parsed from the job's UTC timestamp
 */
async function fetchFromJSearch(
  apiKey: string,
  keywords: string[],
  locations: string[] = ["Germany", "Netherlands", "France", "Austria", "Switzerland"]
): Promise<ExternalJob[]> {
  const jobs: ExternalJob[] = [];
  
  for (const location of locations) {
    try {
      const query = keywords.join(" ");
      const url = "https://jsearch.p.rapidapi.com/search?" +
        new URLSearchParams({
          query: `${query} in ${location}`,
          page: "1",
          num_pages: "2",
        });
      
      const response = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      });
      
      if (!response.ok) {
        console.error(`JSearch API error for ${location}:`, response.statusText);
        continue;
      }
      
      const data: JSearchResponse = await response.json();
      
      if (data.data) {
        for (const job of data.data) {
          const locationStr = [job.job_city, job.job_state, job.job_country]
            .filter(Boolean)
            .join(", ");
          
          jobs.push({
            id: `jsearch-${job.job_id}`,
            title: job.job_title,
            company: job.employer_name || "Unknown Company",
            location: locationStr || location,
            description: job.job_description || "",
            salary: job.job_min_salary && job.job_max_salary
              ? `€${Math.round(job.job_min_salary / 1000)}k - €${Math.round(job.job_max_salary / 1000)}k`
              : undefined,
            url: job.job_apply_link,
            postedAt: new Date(job.job_posted_at_datetime_utc),
            source: "jsearch",
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching from JSearch for ${location}:`, error);
    }
  }
  
  return jobs;
}

/**
 * Convert an ExternalJob into the database InsertJob shape.
 *
 * @param job - The external job record to convert
 * @returns An InsertJob populated from `job`, with derived `country`, `isSchengen`, detected `visaSponsorship`, extracted `keywords`, default `jobType` set to `"Full-time"`, and `isActive` set to `true`
 */
function transformToDbJob(job: ExternalJob): InsertJob {
  const country = extractCountryCode(job.location);
  const schengen = isSchengenCountry(country);
  const visaSponsorship = detectVisaSponsorship(job.description, null);
  
  // Extract keywords from title and description
  const keywords = extractKeywords(job.title, job.description);
  
  return {
    externalId: job.id,
    source: job.source as any,
    title: job.title,
    company: job.company,
    location: job.location,
    country: country,
    isSchengen: schengen,
    visaSponsorship: visaSponsorship,
    description: job.description,
    salary: job.salary,
    jobType: "Full-time", // Default, could be extracted from description
    url: job.url,
    postedAt: job.postedAt,
    isActive: true,
    keywords: keywords,
  };
}

/**
 * Extracts up to 15 relevant tech and energy keywords from a job title and description.
 *
 * Scans the combined text for a predefined set of domain keywords and returns the unique matches
 * in the order they are found.
 *
 * @param title - Job title text
 * @param description - Job description text
 * @returns An array of matched keywords (unique, discovery order), limited to 15 items
 */
function extractKeywords(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  
  const techKeywords = [
    "python", "java", "javascript", "typescript", "react", "node", "sql",
    "machine learning", "ml", "ai", "artificial intelligence", "deep learning",
    "data science", "data scientist", "data analyst", "data engineer",
    "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn",
    "aws", "azure", "gcp", "cloud", "docker", "kubernetes",
    "agile", "scrum", "ci/cd", "devops", "git",
    "power systems", "energy", "renewable", "solar", "wind", "grid",
    "forecasting", "time series", "anomaly detection", "nlp",
  ];
  
  const found: string[] = [];
  for (const keyword of techKeywords) {
    if (text.includes(keyword) && !found.includes(keyword)) {
      found.push(keyword);
    }
  }
  
  return found.slice(0, 15); // Limit to 15 keywords
}

/**
 * Orchestrates job retrieval from configured external APIs, inserts new jobs into the database, and logs a refresh event.
 *
 * If no external APIs are configured or available, a simulated set of Schengen-focused jobs is generated and inserted instead.
 *
 * @param keywords - Search keywords used to query external job sources
 * @param userId - Optional user ID to associate with the refresh log and any generated simulated jobs
 * @returns An object with `jobsFound` as the total number of external (or simulated) jobs processed and `newJobs` as the number of jobs newly inserted into the database
 */
export async function scrapeJobs(
  keywords: string[],
  userId?: number
): Promise<{ jobsFound: number; newJobs: number }> {
  const config: JobScraperConfig = {
    adzunaAppId: ENV.adzunaAppId || undefined,
    adzunaApiKey: ENV.adzunaAppKey || undefined,
    jsearchApiKey: ENV.jsearchApiKey || undefined,
  };
  
  const allJobs: ExternalJob[] = [];
  
  // Fetch from Adzuna if configured
  if (config.adzunaAppId && config.adzunaApiKey) {
    console.log("Fetching jobs from Adzuna...");
    const adzunaJobs = await fetchFromAdzuna(
      config.adzunaAppId,
      config.adzunaApiKey,
      keywords
    );
    allJobs.push(...adzunaJobs);
    console.log(`Found ${adzunaJobs.length} jobs from Adzuna`);
  }
  
  // Fetch from JSearch if configured
  if (config.jsearchApiKey) {
    console.log("Fetching jobs from JSearch...");
    const jsearchJobs = await fetchFromJSearch(config.jsearchApiKey, keywords);
    allJobs.push(...jsearchJobs);
    console.log(`Found ${jsearchJobs.length} jobs from JSearch`);
  }
  
  // If no APIs configured, use simulated data
  if (allJobs.length === 0) {
    console.log("No job APIs configured, using simulated data...");
    return generateSimulatedSchengenJobs(userId);
  }
  
  // Insert jobs into database
  let newJobsCount = 0;
  for (const job of allJobs) {
    const dbJob = transformToDbJob(job);
    
    // Handle undefined externalId defensively
    if (!dbJob.externalId) {
      console.warn(`Job missing externalId, skipping: ${dbJob.title} at ${dbJob.company}`);
      continue;
    }
    
    // Check if job already exists
    const existing = await db.getJobByExternalId(dbJob.externalId, dbJob.source);
    if (!existing) {
      await db.insertJob(dbJob);
      newJobsCount++;
    }
  }
  
  // Log the refresh
  const nextRefresh = new Date();
  nextRefresh.setHours(nextRefresh.getHours() + 5);
  
  await db.logRefresh({
    userId: userId,
    source: "api",
    jobsFound: allJobs.length,
    newJobs: newJobsCount,
    refreshedAt: new Date(),
    nextRefreshAt: nextRefresh,
    status: "success",
  });
  
  return { jobsFound: allJobs.length, newJobs: newJobsCount };
}

/**
 * Create and insert a set of simulated job postings (primarily Schengen) and log the refresh.
 *
 * Generates 40 simulated jobs (approximately 80% Schengen, 20% non‑Schengen) with randomized
 * locations, companies, templates, posting times, visa sponsorship flags, salaries, and keywords,
 * inserts any that do not already exist in the database, and records a refresh entry.
 *
 * @param userId - Optional ID of the user associated with the refresh log entry
 * @returns An object with `jobsFound` equal to the total simulated jobs generated and `newJobs` equal to the number of jobs newly inserted into the database
 */
async function generateSimulatedSchengenJobs(
  userId?: number
): Promise<{ jobsFound: number; newJobs: number }> {
  const now = new Date();
  
  const schengenLocations = [
    { city: "Berlin", country: "Germany", code: "DE" },
    { city: "Munich", country: "Germany", code: "DE" },
    { city: "Hamburg", country: "Germany", code: "DE" },
    { city: "Frankfurt", country: "Germany", code: "DE" },
    { city: "Amsterdam", country: "Netherlands", code: "NL" },
    { city: "Rotterdam", country: "Netherlands", code: "NL" },
    { city: "Paris", country: "France", code: "FR" },
    { city: "Lyon", country: "France", code: "FR" },
    { city: "Vienna", country: "Austria", code: "AT" },
    { city: "Zurich", country: "Switzerland", code: "CH" },
    { city: "Stockholm", country: "Sweden", code: "SE" },
    { city: "Copenhagen", country: "Denmark", code: "DK" },
    { city: "Oslo", country: "Norway", code: "NO" },
    { city: "Helsinki", country: "Finland", code: "FI" },
    { city: "Brussels", country: "Belgium", code: "BE" },
    { city: "Madrid", country: "Spain", code: "ES" },
    { city: "Barcelona", country: "Spain", code: "ES" },
    { city: "Milan", country: "Italy", code: "IT" },
    { city: "Warsaw", country: "Poland", code: "PL" },
    { city: "Prague", country: "Czech Republic", code: "CZ" },
  ];
  
  const nonSchengenLocations = [
    { city: "London", country: "United Kingdom", code: "GB" },
    { city: "Dublin", country: "Ireland", code: "IE" },
    { city: "New York", country: "United States", code: "US" },
    { city: "San Francisco", country: "United States", code: "US" },
    { city: "Toronto", country: "Canada", code: "CA" },
    { city: "Singapore", country: "Singapore", code: "SG" },
  ];
  
  const companies = [
    { name: "Siemens Energy", visaSupport: true },
    { name: "Vattenfall", visaSupport: true },
    { name: "EnBW", visaSupport: true },
    { name: "E.ON", visaSupport: true },
    { name: "RWE", visaSupport: true },
    { name: "Fraunhofer ISE", visaSupport: true },
    { name: "Bosch", visaSupport: true },
    { name: "BMW", visaSupport: true },
    { name: "SAP", visaSupport: true },
    { name: "Deutsche Telekom", visaSupport: true },
    { name: "Spotify", visaSupport: true },
    { name: "Klarna", visaSupport: true },
    { name: "N26", visaSupport: true },
    { name: "Zalando", visaSupport: true },
    { name: "Delivery Hero", visaSupport: true },
    { name: "Google", visaSupport: true },
    { name: "Microsoft", visaSupport: true },
    { name: "Amazon", visaSupport: true },
    { name: "Meta", visaSupport: true },
    { name: "Apple", visaSupport: true },
    { name: "TechStartup GmbH", visaSupport: false },
    { name: "Local Consulting", visaSupport: false },
  ];
  
  const jobTemplates = [
    {
      title: "Senior Data Scientist - Energy Analytics",
      description: "We are looking for a Senior Data Scientist to join our Energy Analytics team. You will work on predictive modeling, time series forecasting, and anomaly detection for power systems. Experience with Python, TensorFlow, and energy domain knowledge required. We offer visa sponsorship for qualified candidates.",
      keywords: ["data scientist", "energy", "python", "tensorflow", "time series", "forecasting", "anomaly detection"],
    },
    {
      title: "Machine Learning Engineer - Renewable Energy",
      description: "Join our ML team to develop cutting-edge algorithms for renewable energy optimization. Work with large-scale datasets, implement LSTM models for load forecasting, and contribute to our smart grid solutions. Relocation support available.",
      keywords: ["machine learning", "renewable energy", "lstm", "forecasting", "smart grid", "python"],
    },
    {
      const secureRandomInt = (max: number): number => {
        const upper = Number.isFinite(max) ? Math.floor(max) : 0;
        if (upper <= 0) return 0;
        return randomInt(0, upper);
      };
    {
      title: "AI Research Scientist",
      description: "Conduct cutting-edge research in artificial intelligence and machine learning. Publish papers, develop novel algorithms, and work with top researchers. PhD required. Visa sponsorship provided.",
      keywords: ["ai", "research", "machine learning", "deep learning", "phd"],
    },
    {
      title: "Full Stack Developer - Clean Tech",
      description: "Develop web applications for clean technology solutions. React/TypeScript frontend, Node.js backend. Experience with sustainability tech a plus.",
      keywords: ["full stack", "react", "typescript", "node.js", "clean tech"],
    },
    {
      title: "Energy Systems Analyst",
      description: "Analyze power systems data, develop predictive models for grid operations, and support decision-making with data-driven insights. Strong background in energy economics and data analysis required.",
      if (
        locations.length === 0 ||
        companies.length === 0 ||
        jobTemplates.length === 0 ||
        hoursAgo.length === 0
      ) {
        throw new Error("Simulated job generation misconfigured: source arrays are empty");
      }

      const loc = locations[secureRandomInt(locations.length)];
    },
    {
      title: "Cloud Infrastructure Engineer",
      description: "Design and maintain cloud infrastructure on AWS/Azure. Implement CI/CD pipelines, containerization with Docker/Kubernetes. Remote-friendly position.",
      keywords: ["cloud", "aws", "azure", "docker", "kubernetes", "devops"],
    },
    {
      title: "Product Manager - Energy Platform",
      description: "Lead product development for our energy management platform. Work with engineering, design, and stakeholders to deliver innovative solutions.",
      keywords: ["product manager", "energy", "platform", "agile", "stakeholder management"],
    },
  ];
  
  const jobs: InsertJob[] = [];
  const hoursAgo = [1, 2, 3, 4, 6, 8, 12, 18, 24, 36, 48, 72];
  
  // Generate 80% Schengen jobs, 20% non-Schengen
  const totalJobs = 40;
  const schengenCount = Math.floor(totalJobs * 0.8);
  
  // Helper functions for secure randomness
  const secureRandomInt = (max: number): number => {
    if (max <= 0) return 0;
    return randomInt(0, max);
  };

  const secureRandomBool = (probability: number): boolean => {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    const scale = 1_000_000;
    const threshold = Math.floor(probability * scale);
    const value = randomInt(0, scale);
    return value < threshold;
  };

  for (let i = 0; i < totalJobs; i++) {
    const isSchengen = i < schengenCount;
    const locations = isSchengen ? schengenLocations : nonSchengenLocations;
    const loc = locations[secureRandomInt(locations.length)];
    const company = companies[secureRandomInt(companies.length)];
    const template = jobTemplates[secureRandomInt(jobTemplates.length)];
    const hoursOffset = hoursAgo[secureRandomInt(hoursAgo.length)];
    const postedAt = new Date(now.getTime() - hoursOffset * 60 * 60 * 1000);
    
    // Determine visa sponsorship
    let visaSponsorship: "yes" | "no" | "unknown" = "unknown";
    if (isSchengen) {
      visaSponsorship = "unknown"; // Schengen doesn't need visa for EU citizens
    } else if (company.visaSupport) {
      visaSponsorship = "yes";
    } else {
      visaSponsorship = secureRandomBool(0.5) ? "unknown" : "no";
    }
    
    jobs.push({
      externalId: `simulated-${Date.now()}-${i}`,
      source: "adzuna", // Use a valid source
      title: template.title,
      company: company.name,
      location: `${loc.city}, ${loc.country}`,
      country: loc.code,
      isSchengen: isSchengenCountry(loc.code),
      visaSponsorship: visaSponsorship,
      description: template.description,
      requirements: "Bachelor's or Master's degree in relevant field. 3+ years of experience.",
      salary: secureRandomBool(0.4) 
        ? `€${60 + secureRandomInt(60)}k - €${90 + secureRandomInt(40)}k`
        : undefined,
      jobType: "Full-time",
      url: `https://example.com/jobs/${i}`,
      postedAt: postedAt,
      isActive: true,
      keywords: template.keywords,
    });
  }
  
  // Insert jobs
  let newJobsCount = 0;
  for (const job of jobs) {
    const existing = await db.getJobByExternalId(job.externalId!, job.source);
    if (!existing) {
      await db.insertJob(job);
      newJobsCount++;
    }
  }
  
  // Log refresh
  const nextRefresh = new Date();
  nextRefresh.setHours(nextRefresh.getHours() + 5);
  
  await db.logRefresh({
    userId: userId,
    source: "simulated",
    jobsFound: jobs.length,
    newJobs: newJobsCount,
    refreshedAt: new Date(),
    nextRefreshAt: nextRefresh,
    status: "success",
  });
  
  return { jobsFound: jobs.length, newJobs: newJobsCount };
}

/**
 * Build a prioritized list of search keywords from a user's profile and sensible defaults.
 *
 * Merges the default keywords with up to the first 5 skills and the first 3 preferred titles
 * (each lowercased), preserving uniqueness and returning at most 10 keywords.
 *
 * @param profile - Optional object with `skills` and `preferredTitles` arrays to augment defaults
 * @returns An array of unique, lowercased keywords (defaults plus profile-derived terms), limited to 10 items
 */
export function getSearchKeywords(profile?: {
  skills?: string[] | null;
  preferredTitles?: string[] | null;
}): string[] {
  const defaults = ["data scientist", "machine learning", "python", "energy"];
  
  if (!profile) return defaults;
  
  const keywords = new Set<string>(defaults);
  
  if (profile.skills) {
    for (const skill of profile.skills.slice(0, 5)) {
      keywords.add(skill.toLowerCase());
    }
  }
  
  if (profile.preferredTitles) {
    for (const title of profile.preferredTitles.slice(0, 3)) {
      keywords.add(title.toLowerCase());
    }
  }
  
  return Array.from(keywords).slice(0, 10);
}