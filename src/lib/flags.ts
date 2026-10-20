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

  // Official ISO 3166-1 alpha-3 codes
  "DEU": "DE", "ITA": "IT", "PRT": "PT", "NLD": "NL", "LUX": "LU",
  "CHE": "CH", "AUT": "AT", "DNK": "DK", "CZE": "CZ", "SVK": "SK",
  "HRV": "HR", "BIH": "BA", "MKD": "MK", "ALB": "AL", "MNE": "ME",
  "BGR": "BG", "GRC": "GR", "MDA": "MD", "BLR": "BY", "GEO": "GE",
  "ARM": "AM", "CYP": "CY", "MLT": "MT", "IRL": "IE", "UZB": "UZ",
  "KGZ": "KG", "TJK": "TJ", "TKM": "TM", "JPN": "JP", "PRK": "KP",
  "TWN": "TW", "HKG": "HK", "MAC": "MO", "BGD": "BD", "LKA": "LK",
  "NPL": "NP", "BTN": "BT", "MMR": "MM", "VNM": "VN", "LAO": "LA",
  "KHM": "KH", "SGP": "SG", "PHL": "PH", "BRN": "BN", "TLS": "TL",
  "PNG": "PG", "SLB": "SB", "VUT": "VU", "WSM": "WS", "TON": "TO",
  "TUV": "TV", "KIR": "KI", "NRU": "NR", "PLW": "PW", "FSM": "FM",
  "MHL": "MH", "CUB": "CU", "DOM": "DO", "HTI": "HT", "JAM": "JM",
  "TTO": "TT", "BHS": "BS", "BRB": "BB", "PAN": "PA", "CRI": "CR",
  "NIC": "NI", "HND": "HN", "SLV": "SV", "GTM": "GT", "BLZ": "BZ",
  "CHL": "CL", "URY": "UY", "VEN": "VE", "BOL": "BO", "PRY": "PY",
  "ECU": "EC", "GUY": "GY", "SUR": "SR",
  "DZA": "DZ", "SDN": "SD", "SSD": "SS", "ETH": "ET", "ERI": "ER",
  "DJI": "DJ", "SOM": "SO", "KEN": "KE", "UGA": "UG", "TZA": "TZ",
  "RWA": "RW", "BDI": "BI", "NGA": "NG", "GHA": "GH", "SEN": "SN",
  "MLI": "ML", "NER": "NE", "TCD": "TD", "BFA": "BF", "CIV": "CI",
  "GMB": "GM", "GIN": "GN", "SLE": "SL", "LBR": "LR", "BEN": "BJ",
  "TGO": "TG", "CMR": "CM", "GAB": "GA", "COG": "CG", "COD": "CD",
  "CAF": "CF", "GNQ": "GQ", "AGO": "AO", "ZMB": "ZM", "ZWE": "ZW",
  "MWI": "MW", "MOZ": "MZ", "SWZ": "SZ", "LSO": "LS", "BWA": "BW",
  "NAM": "NA", "MDG": "MG", "MUS": "MU", "SYC": "SC", "COM": "KM",
  "CPV": "CV", "STP": "ST",
  "SAU": "SA", "ARE": "AE", "QAT": "QA", "BHR": "BH", "KWT": "KW",
  "OMN": "OM", "JOR": "JO", "LBN": "LB", "SYR": "SY", "IRQ": "IQ",
  "IRN": "IR", "ISR": "IL", "YEM": "YE",

  // Remaining official ISO 3166-1 alpha-3 codes (including territories)
  "AFG": "AF", "ALA": "AX", "ASM": "AS", "AND": "AD", "AIA": "AI",
  "ATA": "AQ", "ATG": "AG", "ABW": "AW", "BMU": "BM", "BES": "BQ",
  "BVT": "BV", "IOT": "IO", "CYM": "KY", "CXR": "CX", "CCK": "CC",
  "COL": "CO", "COK": "CK", "CUW": "CW", "DMA": "DM", "FLK": "FK",
  "FRO": "FO", "GUF": "GF", "PYF": "PF", "ATF": "TF", "GIB": "GI",
  "GRL": "GL", "GRD": "GD", "GLP": "GP", "GUM": "GU", "GGY": "GG",
  "GNB": "GW", "HMD": "HM", "VAT": "VA", "IMN": "IM", "JEY": "JE",
  "LVA": "LV", "LIE": "LI", "MDV": "MV", "MTQ": "MQ", "MRT": "MR",
  "MYT": "YT", "MCO": "MC", "MSR": "MS", "MAR": "MA", "NCL": "NC",
  "NIU": "NU", "NFK": "NF", "MNP": "MP", "PSE": "PS", "PER": "PE",
  "PCN": "PN", "PRI": "PR", "REU": "RE", "BLM": "BL", "SHN": "SH",
  "KNA": "KN", "LCA": "LC", "MAF": "MF", "SPM": "PM", "VCT": "VC",
  "SMR": "SM", "SXM": "SX", "ZAF": "ZA", "SGS": "GS", "SJM": "SJ",
  "TKL": "TK", "TUN": "TN", "TCA": "TC", "GBR": "GB", "UMI": "UM",
  "VGB": "VG", "VIR": "VI", "WLF": "WF", "ESH": "EH",

  // Common aliases used by esports databases
  "SUI": "CH", "CRO": "HR", "ENG": "GB-ENG", "SCO": "GB-SCT",
  "WAL": "GB-WLS", "BOS": "BA", "MAC2": "MK", "UAE": "AE",
  "PHI": "PH", "CHI": "CL", "URU": "UY", "NGR": "NG",
  "POR": "PT", "GRE": "GR", "ROM": "RO", "INA": "ID",
  "MAS": "MY", "VIE": "VN", "TPE": "TW", "ZIM": "ZW",
  "GB-ENG": "GB-ENG", "GB-SCT": "GB-SCT", "GB-WLS": "GB-WLS",
};

/** Return an ISO alpha-2 code, a UK subdivision code, or "" if unknown. */
export function normalizeCountry(code: string | undefined | null): string {
  if (!code) return "";
  const up = code.toUpperCase().trim();
  if (Object.prototype.hasOwnProperty.call(countryToISO, up)) return countryToISO[up];
  if (/^[A-Z]{2}$/.test(up)) return up;
  return "";
}

export function countryFlag(countryCode: string | undefined | null): string {
  const iso = normalizeCountry(countryCode);
  // England / Scotland / Wales use Unicode tag sequences (not regional indicators)
  if (iso === "GB-ENG") return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
  if (iso === "GB-SCT") return "🏴󠁧󠁢󠁳󠁣󠁴󠁿";
  if (iso === "GB-WLS") return "🏴󠁧󠁢󠁷󠁬󠁳󠁿";
  if (!iso || iso.length !== 2) return "🏳️";
  const codePoints = [...iso].map(
    (c) => 0x1f1e6 + c.charCodeAt(0) - 65
  );
  return String.fromCodePoint(...codePoints);
}
