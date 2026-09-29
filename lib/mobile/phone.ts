/**
 * Normalisation téléphone (RDC / E.164) pour auth messagerie mobile.
 */

const DIGITS = /\D/g;

/** Indicatif défaut si numéro local CD (0xxxxxxxxx). */
const DEFAULT_COUNTRY_CODE = "243";

export function digitsOnly(value: string) {
  return value.replace(DIGITS, "");
}

/**
 * Normalise vers E.164 sans `+` stocké parfois en base, et avec `+` pour API.
 * Ex. 0890123456 → +243890123456 ; 243890123456 → +243890123456
 */
export function normalizePhoneE164(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let digits = digitsOnly(raw);
  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Local CD : 0 + 9 chiffres
  if (digits.startsWith("0") && digits.length === 10) {
    digits = `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  }

  // Sans indicatif : 9 chiffres → CD
  if (digits.length === 9) {
    digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  if (digits.length < 10 || digits.length > 15) return null;

  return `+${digits}`;
}

/** Variantes à chercher en base (telephone stocké avec/sans +, espaces, 0 local). */
export function phoneLookupVariants(e164: string): string[] {
  const digits = digitsOnly(e164);
  const local = digits.startsWith(DEFAULT_COUNTRY_CODE)
    ? `0${digits.slice(DEFAULT_COUNTRY_CODE.length)}`
    : null;

  const variants = new Set<string>([
    e164,
    digits,
    `+${digits}`,
    local ?? "",
  ].filter(Boolean));

  return Array.from(variants);
}

export function maskPhone(e164: string) {
  const digits = digitsOnly(e164);
  if (digits.length < 4) return "****";
  return `+${digits.slice(0, 3)}****${digits.slice(-2)}`;
}
