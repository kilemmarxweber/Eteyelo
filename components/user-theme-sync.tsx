"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { updateUserThemeAction } from "@/lib/user-theme.action";
import {
  isUserTheme,
  normalizeUserTheme,
  type UserTheme,
} from "@/lib/user-theme";

type UserThemeSyncProps = {
  userId: string;
  preferredTheme: UserTheme;
};

/**
 * Persiste le thème choisi (toggle / apparence) pour le compte connecté.
 * N'écrase pas un choix local : ThemeProvider lit déjà le storage par user.
 */
export function UserThemeSync({
  userId,
  preferredTheme,
}: UserThemeSyncProps) {
  const { theme, setTheme } = useTheme();
  const lastSavedRef = useRef<UserTheme>(normalizeUserTheme(preferredTheme));
  const lastUserRef = useRef(userId);

  useEffect(() => {
    if (lastUserRef.current === userId) return;
    lastUserRef.current = userId;
    const next = normalizeUserTheme(preferredTheme);
    lastSavedRef.current = next;
    setTheme(next);
  }, [userId, preferredTheme, setTheme]);

  useEffect(() => {
    if (!theme || !isUserTheme(theme)) return;
    if (theme === lastSavedRef.current) return;

    const handle = window.setTimeout(() => {
      void updateUserThemeAction(theme)
        .then(() => {
          lastSavedRef.current = theme;
        })
        .catch((err) => {
          console.error("[UserThemeSync] échec sauvegarde thème:", err);
        });
    }, 250);

    return () => window.clearTimeout(handle);
  }, [theme]);

  return null;
}
