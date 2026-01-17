import { InsertJob, InsertJobScore } from "../../drizzle/schema";
import * as db from "../db";

// Keywords for CV-based matching (Saurav Bhowmick's profile)
const HIGH_PRIORITY_KEYWORDS = [
  "data scientist", "data science", "energy systems", "power systems", 
  "machine learning", "ml engineer", "time series", "forecasting", 
  "anomaly detection", "python", "renewable energy", "grid", "voltage",
  "lstm", "tensorflow", "pandas", "numpy", "deep learning", "neural network",
  "predictive modeling", "data analysis", "energy analyst", "power analyst"
];

const MEDIUM_PRIORITY_KEYWORDS = [
  "data analyst", "data engineer", "automation", "research", "analyst",
  "modeling", "visualization", "sql", "power", "energy", "electricity",
  "smart grid", "wind", "solar", "battery", "storage", "sustainability",
  "climate", "carbon", "emissions", "efficiency", "optimization",
  "statistics", "matlab", "grafana", "influxdb", "scikit-learn"
];

const LOW_PRIORITY_KEYWORDS = [
  "engineer", "scientist", "researcher", "developer", "consultant",
  "manager", "lead", "senior", "junior", "intern", "student"
];

// Job sources configuration
const JOB_SOURCES = ["linkedin", "indeed", "stepstone", "energy_jobline", "datacareer"] as const;

// Simulated job data for demonstration (in production, this would be real API calls)
function generateSimulatedJobs(): InsertJob[] {
  const now = new Date();
  const companies = [
    "Siemens Energy", "Vattenfall", "EnBW", "E.ON", "RWE", "Fraunhofer ISE",
    "Bosch", "BMW", "Volkswagen", "SAP", "Deutsche Telekom", "Infineon",
    "Ørsted", "Vestas", "SMA Solar", "Sonnen", "Enphase", "Tesla Energy",
    "Google DeepMind", "Microsoft Research", "Amazon AWS", "IBM Research"
  ];
  
  const locations = [
    "Berlin, Germany", "Munich, Germany", "Hamburg, Germany", "Frankfurt, Germany",
    "Stuttgart, Germany", "Offenburg, Germany", "Freiburg, Germany", "Cologne, Germany",
    "Düsseldorf, Germany", "Nuremberg, Germany", "Remote, Germany"
  ];
  
  const jobTemplates = [
    {
      title: "Senior Data Scientist - Energy Analytics",
      description: "We are looking for a Senior Data Scientist to join our Energy Analytics team. You will work on predictive modeling, time series forecasting, and anomaly detection for power systems. Experience with Python, TensorFlow, and energy domain knowledge required.",
      keywords: ["data scientist", "energy", "python", "tensorflow", "time series", "forecasting", "anomaly detection"]
    },
    {
      title: "Machine Learning Engineer - Renewable Energy",
      description: "Join our ML team to develop cutting-edge algorithms for renewable energy optimization. Work with large-scale datasets, implement LSTM models for load forecasting, and contribute to our smart grid solutions.",
      keywords: ["machine learning", "renewable energy", "lstm", "forecasting", "smart grid", "python"]
    },
    {
      title: "Energy Systems Analyst",
      description: "Analyze power systems data, develop predictive models for grid operations, and support decision-making with data-driven insights. Strong background in energy economics and data analysis required.",
      keywords: ["energy systems", "analyst", "power systems", "data analysis", "grid operations"]
    },
    {
      title: "Data Engineer - Power Systems",
      description: "Build and maintain data pipelines for power systems monitoring. Work with time-series databases like InfluxDB, create dashboards in Grafana, and ensure data quality for ML models.",
      keywords: ["data engineer", "power systems", "influxdb", "grafana", "data pipeline", "python"]
    },
    {
      title: "Research Scientist - Battery Analytics",
      description: "Conduct research on battery degradation prediction using machine learning. Develop models for state-of-health estimation and publish findings in peer-reviewed journals.",
      keywords: ["research scientist", "battery", "machine learning", "prediction", "deep learning"]
    },
    {
      title: "Power Grid Optimization Engineer",
      description: "Optimize power grid operations using advanced analytics and ML. Work on demand forecasting, renewable integration, and grid stability analysis.",
      keywords: ["power grid", "optimization", "analytics", "forecasting", "renewable", "machine learning"]
    },
    {
      title: "Data Analyst - Sustainability",
      description: "Analyze sustainability metrics, track carbon emissions, and develop dashboards for environmental reporting. SQL and Python skills required.",
      keywords: ["data analyst", "sustainability", "carbon", "emissions", "sql", "python", "visualization"]
    },
    {
      title: "AI Engineer - Smart Grid",
      description: "Develop AI solutions for smart grid applications including fault detection, load balancing, and predictive maintenance. Deep learning and power systems knowledge preferred.",
      keywords: ["ai engineer", "smart grid", "deep learning", "fault detection", "predictive maintenance"]
    },
    {
      title: "Energy Data Scientist",
      description: "Apply data science techniques to energy sector challenges. Build forecasting models, analyze consumption patterns, and support renewable energy integration projects.",
      keywords: ["data scientist", "energy", "forecasting", "consumption", "renewable energy", "python"]
    },
    {
      title: "Automation Engineer - Energy Systems",
      description: "Develop automation solutions for energy systems monitoring and control. Experience with PLC programming, SCADA systems, and Python scripting required.",
      keywords: ["automation", "energy systems", "plc", "scada", "python", "monitoring"]
    }
  ];
  
  const jobs: InsertJob[] = [];
  const hoursAgo = [1, 2, 3, 4, 5, 6, 8, 12, 18, 24, 36, 48];
  
  for (let i = 0; i < 30; i++) {
    const template = jobTemplates[i % jobTemplates.length];
    const company = companies[Math.floor(Math.random() * companies.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const source = JOB_SOURCES[Math.floor(Math.random() * JOB_SOURCES.length)];
    const hoursOffset = hoursAgo[Math.floor(Math.random() * hoursAgo.length)];
    
    const postedAt = new Date(now.getTime() - hoursOffset * 60 * 60 * 1000);
    
    jobs.push({
      externalId: `${source}-${Date.now()}-${i}`,
      source: source,
      title: template.title,
      company: company,
      location: location,
      description: template.description,
      requirements: "Bachelor's or Master's degree in relevant field. 3+ years of experience.",
      salary: Math.random() > 0.5 ? `€${60 + Math.floor(Math.random() * 60)}k - €${90 + Math.floor(Math.random() * 40)}k` : undefined,
      jobType: Math.random() > 0.3 ? "Full-time" : "Contract",
      url: `https://example.com/jobs/${source}/${i}`,
      postedAt: postedAt,
      isActive: true,
      keywords: template.keywords,
    });
  }
  
  return jobs;
}

// Calculate relevance score for a job based on user profile
export function calculateRelevanceScore(job: { title?: string | null; description?: string | null; keywords?: string[] | null }, userSkills?: string[]): { score: number; matchedKeywords: string[] } {
  const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const jobKeywords = job.keywords || [];
  
  let score = 0;
  const matchedKeywords: string[] = [];
  
  // Check high priority keywords (10 points each)
  for (const keyword of HIGH_PRIORITY_KEYWORDS) {
    if (text.includes(keyword) || jobKeywords.some(k => k.toLowerCase().includes(keyword))) {
      score += 10;
      matchedKeywords.push(keyword);
    }
  }
  
  // Check medium priority keywords (5 points each)
  for (const keyword of MEDIUM_PRIORITY_KEYWORDS) {
    if (text.includes(keyword) || jobKeywords.some(k => k.toLowerCase().includes(keyword))) {
      score += 5;
      matchedKeywords.push(keyword);
    }
  }
  
  // Check low priority keywords (2 points each)
  for (const keyword of LOW_PRIORITY_KEYWORDS) {
    if (text.includes(keyword) || jobKeywords.some(k => k.toLowerCase().includes(keyword))) {
      score += 2;
      matchedKeywords.push(keyword);
    }
  }
  
  // Check user-specific skills if provided
  if (userSkills) {
    for (const skill of userSkills) {
      if (text.includes(skill.toLowerCase())) {
        score += 8;
        matchedKeywords.push(skill);
      }
    }
  }
  
  // Normalize score to 0-100
  const normalizedScore = Math.min(100, score);
  
  return { score: normalizedScore, matchedKeywords: Array.from(new Set(matchedKeywords)) };
}

// Refresh jobs from all sources
export async function refreshJobs(userId?: number): Promise<{ jobsFound: number; newJobs: number }> {
  try {
    // In production, this would make real API calls to job boards
    // For now, we simulate with generated data
    const simulatedJobs = generateSimulatedJobs();
    
    let newJobsCount = 0;
    
    for (const job of simulatedJobs) {
      // Check if job already exists
      const existing = await db.getJobByExternalId(job.externalId!, job.source);
      if (!existing) {
        await db.insertJob(job);
        newJobsCount++;
      }
    }
    
    // Log the refresh
    const nextRefresh = new Date();
    nextRefresh.setHours(nextRefresh.getHours() + 5); // 5-hour refresh interval
    
    await db.logRefresh({
      userId: userId,
      source: "all",
      jobsFound: simulatedJobs.length,
      newJobs: newJobsCount,
      refreshedAt: new Date(),
      nextRefreshAt: nextRefresh,
      status: "success"
    });
    
    return { jobsFound: simulatedJobs.length, newJobs: newJobsCount };
  } catch (error) {
    console.error("Error refreshing jobs:", error);
    
    await db.logRefresh({
      userId: userId,
      source: "all",
      jobsFound: 0,
      newJobs: 0,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    });
    
    throw error;
  }
}

// Score all jobs for a user
export async function scoreJobsForUser(userId: number, userSkills?: string[]): Promise<number> {
  const jobs = await db.getJobs({ limit: 500 });
  let scoredCount = 0;
  
  for (const job of jobs) {
    const { score, matchedKeywords } = calculateRelevanceScore(job, userSkills);
    
    await db.upsertJobScore({
      jobId: job.id,
      userId: userId,
      relevanceScore: score,
      matchedKeywords: matchedKeywords,
    });
    
    scoredCount++;
  }
  
  return scoredCount;
}

// Get jobs matching user criteria
export async function getMatchingJobs(userId: number, options: {
  minScore?: number;
  maxAgeHours?: number;
  sources?: string[];
  limit?: number;
}) {
  const minPostedAt = options.maxAgeHours 
    ? new Date(Date.now() - options.maxAgeHours * 60 * 60 * 1000)
    : undefined;
  
  const jobsWithScores = await db.getJobsWithScores(userId, {
    minScore: options.minScore,
    sources: options.sources,
    limit: options.limit || 50
  });
  
  // Filter by posting time if specified
  if (minPostedAt) {
    return jobsWithScores.filter(j => j.job.postedAt && j.job.postedAt >= minPostedAt);
  }
  
  return jobsWithScores;
}

// Check for new jobs since last notification
export async function getNewJobsSinceLastCheck(userId: number, minScore: number = 50): Promise<any[]> {
  const lastRefresh = await db.getLastRefresh(userId);
  const lastCheckTime = lastRefresh?.refreshedAt || new Date(Date.now() - 5 * 60 * 60 * 1000);
  
  const jobsWithScores = await db.getJobsWithScores(userId, { minScore, limit: 100 });
  
  return jobsWithScores.filter(j => 
    j.job.postedAt && j.job.postedAt > lastCheckTime && (j.score || 0) >= minScore
  );
}

export { JOB_SOURCES, HIGH_PRIORITY_KEYWORDS, MEDIUM_PRIORITY_KEYWORDS };
