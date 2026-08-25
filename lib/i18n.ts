import { cache } from "react";

import {
  normalizeUserLocale,
  type UserLocale,
} from "@/lib/user-locale";

export const I18N_NAMESPACES = [
  "common",
  "auth",
  "nav",
  "account",
  "registration",
  "people",
  "settings",
  "dashboard",
  "attendance",
  "users",
  "teaching",
  "classes",
  "cursus",
  "finance",
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

export const loadMessages = cache(async (locale: UserLocale) => {
  const safe = normalizeUserLocale(locale);
  const entries = await Promise.all(
    I18N_NAMESPACES.map(async (ns) => {
      const mod = await import(`../messages/${safe}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<
    I18nNamespace,
    Record<string, unknown>
  >;
});
