/**
 * Schengen Area country codes (ISO 3166-1 alpha-2)
 * These countries have abolished passport control at their mutual borders.
 */
export const SCHENGEN_COUNTRIES = [
  "AT", // Austria
  "BE", // Belgium
  "CZ", // Czech Republic
  "DK", // Denmark
  "EE", // Estonia
  "FI", // Finland
  "FR", // France
  "DE", // Germany
  "GR", // Greece
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
 * Check if a country code is in the Schengen area
 */
export function isSchengenCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return SCHENGEN_COUNTRIES.includes(countryCode.toUpperCase() as SchengenCountryCode);
}

/**
 * Extract country code from a location string
 * Examples: "Berlin, Germany" -> "DE", "Paris, France" -> "FR"
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
 * Detect VISA sponsorship from job description
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
