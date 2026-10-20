// Map custom country codes to ISO 3166-1 alpha-2 for flag emojis
const countryToISO: Record<string, string> = {
  "EU": "EU", "USA": "US", "BUL": "BG", "KAZ": "KZ", "FRA": "FR",
  "LTU": "LT", "BRA": "BR", "MNG": "MN", "SWE": "SE", "ESP": "ES",
  "DEN": "DK", "GER": "DE", "AUS": "AU", "RUS": "RU", "KOR": "KR",
  "RSA": "ZA", "TUR": "TR", "UKR": "UA", "FIN": "FI", "NED": "NL",
  "SRB": "RS", "SVN": "SI", "BEL": "BE", "POL": "PL", "ARG": "AR",
  "HUN": "HU", "NOR": "NO", "LBY": "LY", "NZL": "NZ", "CHN": "CN",
  "ROU": "RO", "EST": "EE", "CAN": "CA", "UK": "GB", "ISL": "IS",
  "MEX": "MX", "PAK": "PK", "EGY": "EG", "KOS": "XK", "MYS": "MY",
  "KGY": "KG", "IND": "IN", "THA": "TH", "AZE": "AZ", "FJI": "FJ",
  "IDN": "ID", "CZE": "CZ", "SVK": "SK", "PRT": "PT", "HRV": "HR",
  "DEU": "DE", "NLD": "NL", "CHE": "CH", "ZAF": "ZA", "GBR": "GB",
  "DNK": "DK", "FINL": "FI", "SWE-ALT": "SE", "BGR": "BG", "ROU2": "RO",
  "ESP2": "ES", "AUT": "AT", "ITA": "IT", "GRC": "GR", "LUX": "LU",
  "IRL": "IE", "MKD": "MK", "ALB": "AL", "BIH": "BA", "MNE": "ME",
  "MDA": "MD", "GEO": "GE", "ARM": "AM", "ISR": "IL", "SAU": "SA",
  "ARE": "AE", "QAT": "QA", "JPN": "JP", "CHN2": "CN", "TWN": "TW",
  "HKG": "HK", "SGP": "SG", "VNM": "VN", "THA2": "TH", "MYS2": "MY",
  "PHL": "PH", "IDN2": "ID", "NZL2": "NZ", "ARG2": "AR", "CHL": "CL",
  "COL": "CO", "PER": "PE", "URY": "UY", "VEN": "VE", "BOL": "BO",
  "CRI": "CR", "MAR": "MA", "DZA": "DZ", "TUN": "TN", "NGA": "NG",
  "GHA": "GH", "KEN": "KE", "UGA": "UG", "ETH": "ET", "COD": "CD",
  "KAZ2": "KZ", "UZB": "UZ", "KGZ": "KG", "TJK": "TJ", "TKM": "TM",
  "BLR": "BY", "MNG2": "MN", "MNG3": "MN", "IND2": "IN", "PAK2": "PK",
  "BGD": "BD", "LKA": "LK", "NPL": "NP", "MMR": "MM", "KHM": "KH",
  "LAO": "LA", "MHL": "MH", "MDV": "MV", "BHR": "BH", "KWT": "KW",
  "OMN": "OM", "JOR": "JO", "LBN": "LB", "SYR": "SY", "IRQ": "IQ",
  "IRN": "IR", "TUR2": "TR", "CYP": "CY", "MLT": "MT", "ISL2": "IS",
  "EST2": "EE", "LVA": "LV", "LTU2": "LT", "POL2": "PL", "SVK2": "SK",
  "SVN2": "SI", "HRV2": "HR", "SRB2": "RS", "BIH2": "BA", "MKD2": "MK",
  "ALB2": "AL", "MNE2": "ME", "UKR2": "UA", "BLR2": "BY", "MDA2": "MD",
  "GEO2": "GE", "ARM2": "AM", "AZE2": "AZ", "RUS2": "RU", "KOR2": "KR",
  "PRK": "KP", "MGL": "MN", "KAZ3": "KZ", "THA3": "TH", "VNM2": "VN",
  "MEX2": "MX", "CUB": "CU", "DOM": "DO", "HTI": "HT", "JAM": "JM",
  "TTO": "TT", "PAN": "PA", "NIC": "NI", "HND": "HN", "SLV": "SV",
  "GTM": "GT", "BLZ": "BZ", "CUB2": "CU", "BRA2": "BR", "ARG3": "AR",
  "PRY": "PY", "ECU": "EC", "GUY": "GY", "SUR": "SR", "ECU2": "EC",
  "FJI2": "FJ", "PNG": "PG", "SOL": "SB", "VUT": "VU", "SAM": "WS",
  "TON": "TO", "TUV": "TV", "KIR": "KI", "NAU": "NR", "PLW": "PW",
  "FSM": "FM", "MHL2": "MH", "TLS": "TL", "BRN": "BN", "MAC": "MO",
  "MYS3": "MY", "LBY2": "LY", "SDN": "SD", "SSD": "SS", "TCD": "TD",
  "NER": "NE", "BFA": "BF", "MLI": "ML", "SEN": "SN", "GMB": "GM",
  "GIN": "GN", "SLE": "SL", "LBR": "LR", "CIV": "CI", "BEN": "BJ",
  "TGO": "TG", "CMR": "CM", "GAB": "GA", "COG": "CG", "CAF": "CF",
  "GNQ": "GQ", "AGO": "AO", "ZMB": "ZM", "ZWE": "ZW", "MWI": "MW",
  "MOZ": "MZ", "SWZ": "SZ", "LSO": "LS", "BWA": "BW", "NAM": "NA",
  "MDG": "MG", "MUS": "MU", "SYC": "SC", "COM": "KM", "CPV": "CV",
  "STP": "ST", "GNB": "GW", "GMB2": "GM", "SLE2": "SL", "LBR2": "LR",
  "DJI": "DJ", "SOM": "SO", "ERI": "ER", "RWA": "RW", "BDI": "BI",
  "TKM2": "TM", "MNE3": "ME", "SRB3": "RS", "SVK3": "SK", "SVN3": "SI",
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
