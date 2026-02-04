import { invokeLLM } from "../_core/llm";

export interface ParsedCVData {
  success: boolean;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  skills: string[];
  preferredTitles: string[];
  experienceYears: number | null;
  education: string | null;
  workExperience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
}

const CV_PARSE_SCHEMA = {
  type: "object",
  properties: {
    fullName: {
      type: ["string", "null"],
      description: "The candidate's full name"
    },
    email: {
      type: ["string", "null"],
      description: "The candidate's email address"
    },
    phone: {
      type: ["string", "null"],
      description: "The candidate's phone number"
    },
    location: {
      type: ["string", "null"],
      description: "The candidate's current location/city"
    },
    summary: {
      type: ["string", "null"],
      description: "A professional summary of the candidate's background and career goals"
    },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "List of technical and soft skills mentioned in the CV"
    },
    preferredTitles: {
      type: "array",
      items: { type: "string" },
      description: "Job titles the candidate is likely targeting based on their experience"
    },
    experienceYears: {
      type: ["number", "null"],
      description: "Total years of professional experience"
    },
    education: {
      type: ["string", "null"],
      description: "Highest education level and field (e.g., 'Master's in Computer Science')"
    },
    workExperience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          company: { type: "string" },
          duration: { type: "string" },
          description: { type: "string" }
        },
        required: ["title", "company", "duration", "description"]
      },
      description: "List of work experiences with details"
    }
  },
  required: ["fullName", "email", "phone", "location", "summary", "skills", "preferredTitles", "experienceYears", "education", "workExperience"]
};

/**
 * Extract structured CV fields from raw CV text using an LLM-powered parser.
 *
 * Parses the provided CV text and returns a normalized ParsedCVData object where absent optional
 * string fields are `null`, list fields are empty arrays when missing, and numeric fields are
 * `null` when not present or invalid. On transient parsing failures the function returns a safe
 * empty structure and uses the first 500 characters of the input as a fallback `summary`.
 *
 * @param cvText - The raw CV/resume text to parse. Must be non-empty and at least 50 characters.
 * @returns A ParsedCVData object containing parsed fields such as `fullName`, `email`, `phone`,
 * `location`, `summary`, `skills`, `preferredTitles`, `experienceYears`, `education`, and
 * `workExperience`.
 * @throws Error if `cvText` is empty or shorter than 50 characters.
 */
export async function parseCV(cvText: string): Promise<ParsedCVData> {
  if (!cvText || cvText.trim().length < 50) {
    throw new Error("CV text is too short or empty");
  }

  const systemPrompt = `You are an expert CV/resume parser. Extract structured information from the provided CV text.
Be thorough and accurate. If information is not present, use null for optional fields or empty arrays for lists.

For preferredTitles, infer 3-5 job titles the candidate would be suitable for based on their experience and skills.
For skills, extract both technical skills (programming languages, tools, frameworks) and soft skills.
Calculate experienceYears by summing up work experience durations, accounting for overlaps.

Focus on accuracy and completeness of the extracted data.`;

  const userPrompt = `Please parse the following CV and extract all relevant information:

---
${cvText}
---

Extract the candidate's details, skills, work experience, and education.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "cv_data",
          schema: CV_PARSE_SCHEMA,
          strict: true
        }
      }
    });

    const content = result.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No content returned from LLM");
    }

    const parsedData = JSON.parse(content) as ParsedCVData;

    // Validate and sanitize the parsed data
    return {
      success: true,
      fullName: parsedData.fullName || null,
      email: parsedData.email || null,
      phone: parsedData.phone || null,
      location: parsedData.location || null,
      summary: parsedData.summary || null,
      skills: Array.isArray(parsedData.skills) ? parsedData.skills : [],
      preferredTitles: Array.isArray(parsedData.preferredTitles) ? parsedData.preferredTitles : [],
      experienceYears: typeof parsedData.experienceYears === "number" ? parsedData.experienceYears : null,
      education: parsedData.education || null,
      workExperience: Array.isArray(parsedData.workExperience) ? parsedData.workExperience : [],
    };
  } catch (error) {
    console.error("Error parsing CV:", error);
    
    // Sanitize fallback summary: strip excessive whitespace and limit length
    const sanitizedSummary = cvText
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);
    
    // Return empty structure with success: false if parsing fails
    return {
      success: false,
      fullName: null,
      email: null,
      phone: null,
      location: null,
      summary: sanitizedSummary,
      skills: [],
      preferredTitles: [],
      experienceYears: null,
      education: null,
      workExperience: [],
    };
  }
}

/**
 * Attempt to extract readable plain text from a PDF buffer using a best-effort, naive method.
 *
 * This is a lightweight placeholder extraction; use a dedicated PDF parsing library for reliable results.
 *
 * @param pdfBuffer - The PDF file contents as a Buffer
 * @returns The extracted readable text from the PDF
 * @throws Error if extraction fails or the extracted text is too short to be considered valid
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // This is a placeholder - in production you would use pdf-parse or similar
  // For now, we'll just return a message indicating PDF parsing is needed
  
  // Basic attempt to extract text from PDF
  const text = pdfBuffer.toString("utf8");
  
  // Try to find readable text patterns
  const readableText = text
    .replace(/[^\x20-\x7E\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  if (readableText.length > 100) {
    return readableText;
  }
  
  throw new Error(
    "PDF text extraction requires additional processing. " +
    "Please copy and paste your CV text directly, or upload a text-based document."
  );
}

/**
 * Normalize CV text by standardizing line endings, collapsing excessive blank lines and spaces, replacing tabs with single spaces, and trimming surrounding whitespace.
 *
 * @returns The sanitized, normalized CV text
 */
export function cleanCVText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}