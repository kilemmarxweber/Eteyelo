"use client";

import { useEffect, useRef } from "react";

import {
  intlLocaleFromUserLocale,
  normalizeUserLocale,
  writeUserLocalePreference,
  type UserLocale,
} from "@/lib/user-locale";

type UserLocaleSyncProps = {
  userId: string;
  preferredLocale: UserLocale;
};

/**
 * Aligne cookie / localStorage / <html lang> sur la locale DB
 * de l'utilisateur connecté (comme UserThemeSync pour le thème).
 */
export function UserLocaleSync({
  userId,
  preferredLocale,
}: UserLocaleSyncProps) {
  const lastUserRef = useRef(userId);

  useEffect(() => {
    if (lastUserRef.current !== userId) {
      lastUserRef.current = userId;
    }
    const next = normalizeUserLocale(preferredLocale);
    writeUserLocalePreference(next, userId);
    document.documentElement.lang = intlLocaleFromUserLocale(next);
  }, [userId, preferredLocale]);

  return null;
}
