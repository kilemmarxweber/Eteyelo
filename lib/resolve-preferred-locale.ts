import { cookies } from "next/headers";

import {
  normalizeUserLocale,
  USER_LOCALE_COOKIE,
  type UserLocale,
} from "@/lib/user-locale";

/** Locale effective côté serveur : cookie (choix immédiat) puis session/DB. */
export async function resolvePreferredLocale(
  sessionLocale?: string | null,
): Promise<UserLocale> {
  const jar = await cookies();
  const fromCookie = jar.get(USER_LOCALE_COOKIE)?.value;
  if (fromCookie) return normalizeUserLocale(fromCookie);
  return normalizeUserLocale(sessionLocale);
}
