export {
  LOCALE_OPTIONS,
  readUserLocalePreference,
  writeUserLocalePreference,
  type UserLocale as LocalePreference,
  USER_LOCALE_COOKIE as LOCALE_STORAGE_KEY,
} from "@/lib/user-locale";

import {
  readUserLocalePreference,
  writeUserLocalePreference,
  type UserLocale,
} from "@/lib/user-locale";

/** @deprecated Prefer readUserLocalePreference(userId) */
export function readLocalePreference(): UserLocale {
  return readUserLocalePreference();
}

/** @deprecated Prefer writeUserLocalePreference(locale, userId) */
export function writeLocalePreference(locale: UserLocale) {
  writeUserLocalePreference(locale);
}
