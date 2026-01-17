import { describe, expect, it } from "vitest";
import { calculateRelevanceScore } from "./services/jobEngine";
import { matchesApplicationPattern } from "./services/autoApply";

describe("Job Engine - Relevance Scoring", () => {
  it("calculates high score for data scientist jobs with energy keywords", () => {
    const job = {
      title: "Senior Data Scientist - Energy Analytics",
      description: "We are looking for a Data Scientist to work on machine learning models for power systems forecasting and anomaly detection using Python and TensorFlow.",
      keywords: ["data scientist", "machine learning", "python", "energy", "forecasting"]
    };
    
    const result = calculateRelevanceScore(job);
    
    expect(result.score).toBeGreaterThan(50);
    expect(result.matchedKeywords.length).toBeGreaterThan(3);
    expect(result.matchedKeywords).toContain("data scientist");
    expect(result.matchedKeywords).toContain("machine learning");
  });
  
  it("calculates medium score for general data analyst jobs", () => {
    const job = {
      title: "Data Analyst",
      description: "Analyze business data and create visualizations using SQL and Python.",
      keywords: ["data analyst", "sql", "python", "visualization"]
    };
    
    const result = calculateRelevanceScore(job);
    
    expect(result.score).toBeGreaterThan(10);
    expect(result.score).toBeLessThan(80);
    expect(result.matchedKeywords).toContain("data analyst");
  });
  
  it("calculates low score for unrelated jobs", () => {
    const job = {
      title: "Marketing Manager",
      description: "Lead marketing campaigns and brand strategy.",
      keywords: ["marketing", "brand", "campaigns"]
    };
    
    const result = calculateRelevanceScore(job);
    
    expect(result.score).toBeLessThan(20);
  });
  
  it("includes user skills in scoring when provided", () => {
    const job = {
      title: "Energy Systems Engineer",
      description: "Work on renewable energy systems and grid optimization.",
      keywords: ["energy", "renewable", "grid"]
    };
    
    const userSkills = ["renewable energy", "grid optimization", "solar"];
    const resultWithSkills = calculateRelevanceScore(job, userSkills);
    const resultWithoutSkills = calculateRelevanceScore(job);
    
    expect(resultWithSkills.score).toBeGreaterThan(resultWithoutSkills.score);
  });
  
  it("handles null/empty job fields gracefully", () => {
    const job = {
      title: null,
      description: null,
      keywords: null
    };
    
    const result = calculateRelevanceScore(job);
    
    expect(result.score).toBe(0);
    expect(result.matchedKeywords).toEqual([]);
  });
  
  it("deduplicates matched keywords", () => {
    const job = {
      title: "Python Developer - Python Expert",
      description: "Python programming with Python frameworks",
      keywords: ["python", "python developer"]
    };
    
    const result = calculateRelevanceScore(job);
    
    // Check for no duplicates
    const uniqueKeywords = new Set(result.matchedKeywords);
    expect(result.matchedKeywords.length).toBe(uniqueKeywords.size);
  });
});

describe("Auto-Apply - Pattern Matching", () => {
  it("matches job when keywords overlap with pattern", () => {
    const job = {
      title: "Data Scientist - Energy",
      description: "Machine learning for energy systems",
      keywords: ["data scientist", "machine learning", "energy"],
      company: "Siemens Energy",
      location: "Berlin, Germany"
    };
    
    const patterns = [{
      keywords: ["data scientist", "machine learning", "python"],
      companies: ["Siemens Energy"],
      locations: ["Berlin"],
      minRelevanceScore: 50
    }];
    
    const result = matchesApplicationPattern(job, patterns);
    
    expect(result.matches).toBe(true);
    expect(result.confidence).toBeGreaterThan(60);
  });
  
  it("does not match job when keywords don't overlap enough", () => {
    const job = {
      title: "Marketing Manager",
      description: "Lead marketing campaigns",
      keywords: ["marketing", "campaigns"],
      company: "Random Corp",
      location: "Munich, Germany"
    };
    
    const patterns = [{
      keywords: ["data scientist", "machine learning", "python"],
      companies: ["Siemens Energy"],
      locations: ["Berlin"],
      minRelevanceScore: 50
    }];
    
    const result = matchesApplicationPattern(job, patterns);
    
    expect(result.matches).toBe(false);
    expect(result.confidence).toBeLessThan(60);
  });
  
  it("boosts confidence when company matches", () => {
    const job = {
      title: "Software Engineer",
      description: "Build software applications",
      keywords: ["software", "engineer"],
      company: "Siemens Energy",
      location: "Hamburg, Germany"
    };
    
    const patternsWithCompany = [{
      keywords: ["software", "engineer"],
      companies: ["Siemens Energy"],
      locations: [],
      minRelevanceScore: 50
    }];
    
    const patternsWithoutCompany = [{
      keywords: ["software", "engineer"],
      companies: [],
      locations: [],
      minRelevanceScore: 50
    }];
    
    const resultWithCompany = matchesApplicationPattern(job, patternsWithCompany);
    const resultWithoutCompany = matchesApplicationPattern(job, patternsWithoutCompany);
    
    expect(resultWithCompany.confidence).toBeGreaterThan(resultWithoutCompany.confidence);
  });
  
  it("handles empty patterns array", () => {
    const job = {
      title: "Data Scientist",
      description: "ML work",
      keywords: ["data scientist"],
      company: "Test Corp",
      location: "Berlin"
    };
    
    const result = matchesApplicationPattern(job, []);
    
    expect(result.matches).toBe(false);
    expect(result.confidence).toBe(0);
  });
  
  it("handles null values in job fields", () => {
    const job = {
      title: "Data Scientist",
      description: null,
      keywords: null,
      company: null,
      location: null
    };
    
    const patterns = [{
      keywords: ["data scientist"],
      companies: [],
      locations: [],
      minRelevanceScore: 50
    }];
    
    // Should not throw error
    const result = matchesApplicationPattern(job, patterns);
    expect(typeof result.matches).toBe("boolean");
  });
});
