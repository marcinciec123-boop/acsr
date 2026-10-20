// Map custom country codes to ISO 3166-1 alpha-2 for flag emojis
const countryToISO: Record<string, string> = {
  // Custom / esports-style codes
  "EU": "EU", "USA": "US", "BUL": "BG", "KAZ": "KZ", "FRA": "FR",
  "LTU": "LT", "BRA": "BR", "MNG": "MN", "SWE": "SE", "ESP": "ES",
  "DEN": "DK", "GER": "DE", "AUS": "AU", "RUS": "RU", "KOR": "KR",
  "RSA": "ZA", "TUR": "TR", "UKR": "UA", "FIN": "FI", "NED": "NL",
  "SRB": "RS", "SVN": "SI", "BEL": "BE", "POL": "PL", "ARG": "AR",
  "HUN": "HU", "NOR": "NO", "LBY": "LY", "NZL": "NZ", "CHN": "CN",
  "ROU": "RO", "EST": "EE", "CAN": "CA", "UK": "GB", "ISL": "IS",
  "MEX": "MX", "PAK": "PK", "EGY": "EG", "KOS": "XK", "MYS": "MY",
  "KGY": "KG", "IND": "IN", "THA": "TH", "AZE": "AZ", "FJI": "FJ",
  "IDN": "ID",

  // Official ISO 3166-1 alpha-3 codes (Europe)
  "POL3": "PL", "DEU": "DE", "FRA3": "FR", "GBR": "GB", "ITA": "IT",
  "ESP3": "ES", "PRT": "PT", "NLD3": "NL", "BEL3": "BE", "LUX": "LU",
  "CHE": "CH", "AUT": "AT", "DNK": "DK", "NOR3": "NO", "SWE3": "SE",
  "FIN3": "FI", "ISL3": "IS", "EST3": "EE", "LVA": "LV", "LTU3": "LT",
  "CZE": "CZ", "SVK": "SK", "SVN3": "SI", "HRV": "HR", "SRB3": "RS",
  "BIH": "BA", "MKD": "MK", "ALB": "AL", "MNE": "ME", "ROU3": "RO",
  "BGR": "BG", "GRC": "GR", "MDA": "MD", "UKR3": "UA", "BLR": "BY",
  "RUS3": "RU", "GEO": "GE", "ARM": "AM", "AZE3": "AZ", "CYP": "CY",
  "MLT": "MT", "IRL": "IE",

  // ISO alpha-3 (Asia, Oceania)
  "KAZ3": "KZ", "UZB": "UZ", "KGZ": "KG", "TJK": "TJ", "TKM": "TM",
  "MNG3": "MN", "CHN3": "CN", "JPN": "JP", "KOR3": "KR", "PRK": "KP",
  "TWN": "TW", "HKG": "HK", "MAC": "MO", "IND3": "IN", "PAK3": "PK",
  "BGD": "BD", "LKA": "LK", "NPL": "NP", "BTN": "BT", "MMR": "MM",
  "THA3": "TH", "VNM": "VN", "LAO": "LA", "KHM": "KH", "MYS3": "MY",
  "SGP": "SG", "IDN3": "ID", "PHL": "PH", "BRN": "BN", "TLS": "TL",
  "AUS3": "AU", "NZL3": "NZ", "FJI3": "FJ", "PNG": "PG", "SLB": "SB",
  "VUT": "VU", "WSM": "WS", "TON3": "TO", "TUV": "TV", "KIR": "KI",
  "NRU": "NR", "PLW": "PW", "FSM": "FM", "MHL": "MH",

  // ISO alpha-3 (Americas)
  "USA3": "US", "CAN3": "CA", "MEX3": "MX", "CUB": "CU", "DOM": "DO",
  "HTI": "HT", "JAM": "JM", "TTO": "TT", "BHS": "BS", "BRB": "BB",
  "PAN3": "PA", "CRI": "CR", "NIC": "NI", "HND": "HN", "SLV": "SV",
  "GTM": "GT", "BLZ": "BZ", "BRA3": "BR", "ARG3": "AR", "CHL": "CL",
  "COL3": "CO", "PER3": "PE", "URY": "UY", "VEN": "VE", "BOL": "BO",
  "PRY": "PY", "ECU": "EC", "GUY": "GY", "SUR": "SR",

  // ISO alpha-3 (Africa & Middle East)
  "MAR": "MA", "DZA": "DZ", "TUN3": "TN", "LBY3": "LY", "EGY3": "EG",
  "SDN": "SD", "SSD": "SS", "ETH": "ET", "ERI": "ER", "DJI": "DJ",
  "SOM": "SO", "KEN": "KE", "UGA": "UG", "TZA": "TZ", "RWA": "RW",
  "BDI": "BI", "NGA": "NG", "GHA": "GH", "SEN": "SN", "MLI": "ML",
  "NER": "NE", "TCD": "TD", "BFA": "BF", "CIV": "CI", "GMB": "GM",
  "GIN": "GN", "SLE": "SL", "LBR": "LR", "BEN": "BJ", "TGO": "TG",
  "CMR": "CM", "GAB": "GA", "COG": "CG", "COD": "CD", "CAF": "CF",
  "GNQ": "GQ", "AGO": "AO", "ZMB": "ZM", "ZWE": "ZW", "MWI": "MW",
  "MOZ": "MZ", "SWZ": "SZ", "LSO": "LS", "BWA": "BW", "NAM": "NA",
  "ZAF3": "ZA", "MDG": "MG", "MUS": "MU", "SYC": "SC", "COM": "KM",
  "CPV": "CV", "STP": "ST",
  "SAU": "SA", "ARE": "AE", "QAT": "QA", "BHR": "BH", "KWT": "KW",
  "OMN": "OM", "JOR": "JO", "LBN": "LB", "SYR": "SY", "IRQ": "IQ",
  "IRN": "IR", "ISR": "IL", "TUR3": "TR", "YEM": "YE",

  // Common aliases used by esports databases
  "SUI": "CH", "CRO": "HR", "ENG": "GB-ENG", "SCO": "GB-SCT",
  "WAL": "GB-WLS", "BOS": "BA", "MAC2": "MK", "UAE": "AE",
  "PHI": "PH", "CHI": "CL", "URU": "URY", "NGR": "NG",
  "IRL2": "IE", "CZE2": "CZ", "SVK2": "SK", "SVN2": "SI", "HRV2": "HR",
  "BUL2": "BG", "DEN2": "DK", "GER2": "DE", "NED2": "NL", "FIN2": "FI",
  "SWE2": "SE", "NOR2": "NO", "EST2": "EE", "LVA2": "LV", "LTU2": "LT",
  "POL2": "PL", "UKR2": "UA", "BLR2": "BY", "RUS2": "RU", "ROU2": "RO",
  "HUN2": "HU", "GEO2": "GE", "ARM2": "AM", "AZE2": "AZ", "KAZ2": "KZ",
  "MNG2": "MN", "CHN2": "CN", "JPN2": "JP", "KOR2": "KR", "TWN2": "TW",
  "IND2": "IN", "PAK2": "PK", "THA2": "TH", "VNM2": "VN", "MYS2": "MY",
  "IDN2": "ID", "SGP2": "SG", "AUS2": "AU", "NZL2": "NZ", "FJI2": "FJ",
  "USA2": "US", "CAN2": "CA", "MEX2": "MX", "BRA2": "BR", "ARG2": "AR",
  "COL2": "CO", "PER2": "PE", "VEN2": "VE", "ZAF2": "ZA", "RSA2": "ZA",
  "EGY2": "EG", "MAR2": "MA", "TUN2": "TN", "TUR2": "TR", "ISR2": "IL",
  "KOS2": "XK", "KGV": "XK",
};

/** Always return a 2-letter ISO code (or "" if unknown). */
export function normalizeCountry(code: string | undefined | null): string {
  if (!code) return "";
  const up = code.toUpperCase().trim();
  if (countryToISO[up]) return countryToISO[up];
  if (up.length === 2) return up;
  return "";
}

export function countryFlag(countryCode: string): string {
  const iso = countryToISO[countryCode] || countryCode;
  if (!iso || iso.length !== 2) return "🏳️";
  if (iso === "XK") return "🇽🇰"; // Kosovo special case
  const codePoints = [...iso.toUpperCase()].map(
    (c) => 0x1f1e6 + c.charCodeAt(0) - 65
  );
  return String.fromCodePoint(...codePoints);
}
