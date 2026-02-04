/**
 * Schengen Area country codes (ISO 3166-1 alpha-2)
 * These countries have abolished passport control at their mutual borders.
 */
export const SCHENGEN_COUNTRIES = [
  "AT", // Austria
  "BE", // Belgium
  "BG", // Bulgaria
  "CZ", // Czech Republic
  "DK", // Denmark
  "EE", // Estonia
  "FI", // Finland
  "FR", // France
  "DE", // Germany
  "GR", // Greece
  "HR", // Croatia
  "HU", // Hungary
  "IS", // Iceland
  "IT", // Italy
  "LV", // Latvia
  "LI", // Liechtenstein
  "LT", // Lithuania
  "LU", // Luxembourg
  "MT", // Malta
  "NL", // Netherlands
  "NO", // Norway
  "PL", // Poland
  "PT", // Portugal
  "RO", // Romania
  "SK", // Slovakia
  "SI", // Slovenia
  "ES", // Spain
  "SE", // Sweden
  "CH", // Switzerland
] as const;

export type SchengenCountryCode = typeof SCHENGEN_COUNTRIES[number];

/**
 * Map of country codes to full country names
 */
export const COUNTRY_NAMES: Record<string, string> = {
  AT: "Austria",
  BE: "Belgium",
  BG: "Bulgaria",
  HR: "Croatia",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DK: "Denmark",
  EE: "Estonia",
  FI: "Finland",
  FR: "France",
  DE: "Germany",
  GR: "Greece",
  HU: "Hungary",
  IS: "Iceland",
  IE: "Ireland",
  IT: "Italy",
  LV: "Latvia",
  LI: "Liechtenstein",
  LT: "Lithuania",
  LU: "Luxembourg",
  MT: "Malta",
  NL: "Netherlands",
  NO: "Norway",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  SK: "Slovakia",
  SI: "Slovenia",
  ES: "Spain",
  SE: "Sweden",
  CH: "Switzerland",
  GB: "United Kingdom",
  US: "United States",
  CA: "Canada",
  AU: "Australia",
  IN: "India",
  SG: "Singapore",
  AE: "United Arab Emirates",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
};

/**
 * Reverse lookup: country name to code
 */
export const COUNTRY_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAMES).map(([code, name]) => [name.toLowerCase(), code])
);

/**
 * Determines whether the given ISO 3166-1 alpha-2 country code belongs to the Schengen Area.
 *
 * Null or undefined values are treated as non-Schengen.
 *
 * @param countryCode - The country code to check; case is ignored and null/undefined are allowed.
 * @returns `true` if the provided country code is a Schengen member, `false` otherwise.
 */
export function isSchengenCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return SCHENGEN_COUNTRIES.includes(countryCode.toUpperCase() as SchengenCountryCode);
}

/**
 * Determine a two-letter ISO country code from a freeform location string.
 *
 * Matches full country names case-insensitively (e.g., "Paris, France") or two-letter
 * ISO codes appearing as separate tokens (e.g., "Berlin, DE"). If the location text
 * mentions "remote" without a specific country, no code is returned.
 *
 * @param location - Freeform location text (may be null or undefined)
 * @returns The matching two-letter country code (e.g., "DE", "FR"), or `null` if none found
 */
export function extractCountryCode(location: string | null | undefined): string | null {
  if (!location) return null;
  
  const locationLower = location.toLowerCase();
  
  // Try to find country name in the location string
  for (const [name, code] of Object.entries(COUNTRY_CODES)) {
    if (locationLower.includes(name)) {
      return code;
    }
  }
  
  // Try to find country code directly (e.g., "Berlin, DE")
  const parts = location.split(/[,\s]+/);
  for (const part of parts) {
    const upperPart = part.toUpperCase();
    if (COUNTRY_NAMES[upperPart]) {
      return upperPart;
    }
  }
  
  // Handle "Remote" specially
  if (locationLower.includes("remote")) {
    // Check if specific country mentioned
    for (const [name, code] of Object.entries(COUNTRY_CODES)) {
      if (locationLower.includes(name)) {
        return code;
      }
    }
    return null; // Remote with no country specified
  }
  
  return null;
}

/**
 * VISA sponsorship detection keywords
 */
export const VISA_POSITIVE_KEYWORDS = [
  "visa sponsorship",
  "visa support",
  "sponsor visa",
  "work permit",
  "relocation assistance",
  "relocation support",
  "relocation package",
  "willing to sponsor",
  "immigration support",
  "we sponsor",
  "sponsorship available",
  "visa assistance",
];

export const VISA_NEGATIVE_KEYWORDS = [
  "no visa sponsorship",
  "no sponsorship",
  "must be authorized",
  "must have right to work",
  "eu citizens only",
  "citizenship required",
  "permanent resident",
  "no relocation",
  "local candidates only",
];

/**
 * Determine whether a job listing indicates visa sponsorship.
 *
 * @param description - The job description text to analyze
 * @param requirements - The job requirements or qualifications to analyze
 * @returns `"yes"` if the text contains sponsorship-positive keywords, `"no"` if it contains sponsorship-negative keywords (negative indicators take precedence), `"unknown"` if no decisive keywords are found
 */
export function detectVisaSponsorship(
  description: string | null | undefined,
  requirements: string | null | undefined
): "yes" | "no" | "unknown" {
  if (!description && !requirements) return "unknown";
  
  const text = `${description || ""} ${requirements || ""}`.toLowerCase();
  
  // Check for negative keywords first (more specific)
  for (const keyword of VISA_NEGATIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      return "no";
    }
  }
  
  // Check for positive keywords
  for (const keyword of VISA_POSITIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      return "yes";
    }
  }
  
  return "unknown";
}