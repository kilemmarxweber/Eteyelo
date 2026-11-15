import {
  bulletinLocaleForEducationSystem,
  normalizeEducationSystem,
} from "@/lib/education-system";
import {
  isUserLocale,
  normalizeUserLocale,
  type UserLocale,
} from "@/lib/user-locale";

/**
 * Langue UI par défaut selon le type d’établissement :
 * Congolais → fr · Angolais → pt · Anglais → en.
 */
export function defaultLocaleForEducationSystem(
  educationSystem: unknown,
): UserLocale {
  return bulletinLocaleForEducationSystem(educationSystem);
}

/**
 * Locale effective d’une branche : préférence enregistrée, sinon défaut système éducatif.
 */
export function resolveBranchUiLocale(input: {
  locale?: string | null;
  educationSystem?: unknown;
}): UserLocale {
  if (isUserLocale(input.locale)) return input.locale;
  if (typeof input.locale === "string" && input.locale.trim()) {
    return normalizeUserLocale(input.locale);
  }
  return defaultLocaleForEducationSystem(input.educationSystem);
}

export function branchLocaleHint(educationSystem: unknown): UserLocale {
  return defaultLocaleForEducationSystem(
    normalizeEducationSystem(educationSystem),
  );
}
