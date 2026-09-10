const COUNTRY_ALIASES: Record<string, string> = {
  AR: "AR",
  ARG: "AR",
  ARGENTINA: "AR",
  BO: "BO",
  BOL: "BO",
  BOLIVIA: "BO",
  BR: "BR",
  BRA: "BR",
  BRASIL: "BR",
  BRAZIL: "BR",
  CL: "CL",
  CHL: "CL",
  CHILE: "CL",
  CO: "CO",
  COL: "CO",
  COLOMBIA: "CO",
  MX: "MX",
  MEX: "MX",
  MEXICO: "MX",
  PE: "PE",
  PER: "PE",
  PERU: "PE",
  PY: "PY",
  PRY: "PY",
  PARAGUAY: "PY",
  "PARAGUAI": "PY",
  UY: "UY",
  URY: "UY",
  URUGUAY: "UY",
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
  "ESTADOS UNIDOS": "US",
  PT: "PT",
  PRT: "PT",
  PORTUGAL: "PT",
  ES: "ES",
  ESP: "ES",
  SPAIN: "ES",
  ESPANA: "ES",
};

const COUNTRY_NAMES: Record<string, string> = {
  AR: "Argentina",
  BO: "Bolívia",
  BR: "Brasil",
  CL: "Chile",
  CO: "Colômbia",
  MX: "México",
  PE: "Peru",
  PY: "Paraguai",
  UY: "Uruguai",
  US: "Estados Unidos",
  PT: "Portugal",
  ES: "Espanha",
};

function compactCountry(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Convert provider country codes, ISO-3 values, or localized names to ISO-2. */
export function normalizeCountryCode(raw: unknown): string | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = raw as Record<string, unknown>;
    return normalizeCountryCode(
      value.iso ?? value.code ?? value.country_code ?? value.countryCode ?? value.name,
    );
  }

  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const normalized = compactCountry(String(raw));
  if (!normalized) return null;
  if (COUNTRY_ALIASES[normalized]) return COUNTRY_ALIASES[normalized];
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function countryName(raw: unknown): string {
  const code = normalizeCountryCode(raw);
  return (code && COUNTRY_NAMES[code]) || code || "Não informado";
}
