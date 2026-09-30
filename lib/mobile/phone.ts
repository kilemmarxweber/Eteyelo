/**
 * Normalisation téléphone (RDC / Angola / E.164) pour auth messagerie mobile.
 */

const DIGITS = /\D/g;

/** Indicatifs supportés (RDC + Angola — écoles Klambocore). */
export const SUPPORTED_COUNTRY_CODES = ["243", "244"] as const;

/**
 * Indicatif défaut si numéro local ambigu.
 * Sur VPS Angola : MOBILE_DEFAULT_COUNTRY_CODE=244
 */
export const DEFAULT_COUNTRY_CODE =
  (process.env.MOBILE_DEFAULT_COUNTRY_CODE ?? "243").replace(/\D/g, "") ||
  "243";

export function digitsOnly(value: string) {
  return value.replace(DIGITS, "");
}

/**
 * Clés numériques pour retrouver un user quelle que soit la forme en base
 * (+244…, 244…, 0…, 9 chiffres seuls, espaces).
 */
export function phoneDigitKeys(input: string): string[] {
  let digits = digitsOnly(input);
  if (!digits) return [];

  if (digits.startsWith("00")) digits = digits.slice(2);

  const keys = new Set<string>([digits]);

  const addNationalForms = (national: string) => {
    if (!national) return;
    keys.add(national);
    keys.add(`0${national}`);
    for (const cc of SUPPORTED_COUNTRY_CODES) {
      keys.add(`${cc}${national}`);
    }
  };

  for (const cc of SUPPORTED_COUNTRY_CODES) {
    if (digits.startsWith(cc) && digits.length > cc.length) {
      addNationalForms(digits.slice(cc.length));
    }
  }

  // Local avec 0 : 0XXXXXXXXX
  if (digits.startsWith("0") && digits.length >= 9) {
    addNationalForms(digits.slice(1));
  }

  // National nu (souvent Angola 9 chiffres, ou CD sans 0)
  if (digits.length >= 8 && digits.length <= 10 && !digits.startsWith("0")) {
    const looksLikeCc = SUPPORTED_COUNTRY_CODES.some((cc) =>
      digits.startsWith(cc),
    );
    if (!looksLikeCc) {
      addNationalForms(digits);
    }
  }

  return Array.from(keys);
}

/**
 * Choisit l'indicatif pour un national à 9 chiffres.
 * AO mobiles : 90–96… ; CD : 81–89, 97, 99…
 */
function countryForNational9(national: string): string {
  if (/^9[0-6]/.test(national)) return "244";
  if (DEFAULT_COUNTRY_CODE === "244" || DEFAULT_COUNTRY_CODE === "243") {
    return DEFAULT_COUNTRY_CODE;
  }
  return "243";
}

/**
 * Normalise vers E.164 avec `+`.
 * Ex. 0890123456 → +243890123456 ; 935304134 → +244935304134
 */
export function normalizePhoneE164(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let digits = digitsOnly(raw);
  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Déjà avec indicatif supporté
  for (const cc of SUPPORTED_COUNTRY_CODES) {
    if (digits.startsWith(cc) && digits.length >= cc.length + 8) {
      return `+${digits}`;
    }
  }

  // Local avec 0 + 9 chiffres (forme classique CD ; aussi possible ailleurs)
  if (digits.startsWith("0") && digits.length === 10) {
    const national = digits.slice(1);
    digits = `${countryForNational9(national)}${national}`;
    return `+${digits}`;
  }

  // 9 chiffres sans indicatif
  if (digits.length === 9) {
    digits = `${countryForNational9(digits)}${digits}`;
    return `+${digits}`;
  }

  if (digits.length < 10 || digits.length > 15) return null;

  return `+${digits}`;
}

/** Variantes exactes à chercher en base (compat + formats fréquents). */
export function phoneLookupVariants(e164: string): string[] {
  const digits = digitsOnly(e164);
  const keys = phoneDigitKeys(e164);
  const variants = new Set<string>();

  for (const key of keys) {
    variants.add(key);
    variants.add(`+${key}`);
    for (const cc of SUPPORTED_COUNTRY_CODES) {
      if (key.startsWith(cc) && key.length > cc.length) {
        const national = key.slice(cc.length);
        variants.add(`+${cc} ${national}`);
        variants.add(`${cc} ${national}`);
      }
    }
  }

  variants.add(e164);
  variants.add(digits);
  variants.add(`+${digits}`);

  return Array.from(variants).filter(Boolean);
}

export function maskPhone(e164: string) {
  const digits = digitsOnly(e164);
  if (digits.length < 4) return "****";
  return `+${digits.slice(0, 3)}****${digits.slice(-2)}`;
}

/** Digits « needle » pour recherche destinataires (contient). */
export function phoneSearchNeedle(query: string): string | null {
  const digits = digitsOnly(query);
  if (digits.length < 4) return null;
  return digits;
}
