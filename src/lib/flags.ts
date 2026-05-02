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
  "IDN": "ID",
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
