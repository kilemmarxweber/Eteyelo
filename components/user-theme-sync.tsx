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
 * Applique le thème stocké en base pour l'utilisateur connecté,
 * et persiste les changements locaux (toggle / apparence) pour ce compte uniquement.
 */
export function UserThemeSync({
  userId,
  preferredTheme,
}: UserThemeSyncProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const lastSavedRef = useRef<UserTheme>(normalizeUserTheme(preferredTheme));
  const lastUserRef = useRef(userId);
  const hydratedRef = useRef(false);

  // Changement de compte : réappliquer la préférence DB de ce user.
  useEffect(() => {
    if (lastUserRef.current !== userId) {
      lastUserRef.current = userId;
      lastSavedRef.current = normalizeUserTheme(preferredTheme);
      hydratedRef.current = false;
      setTheme(normalizeUserTheme(preferredTheme));
    }
  }, [userId, preferredTheme, setTheme]);

  // Première hydratation : aligner next-themes sur la préférence serveur.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const next = normalizeUserTheme(preferredTheme);
    if (theme !== next) {
      setTheme(next);
    }
    lastSavedRef.current = next;
  }, [preferredTheme, setTheme, theme]);

  // Persister les changements faits par l'utilisateur connecté.
  useEffect(() => {
    if (!hydratedRef.current) return;
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
  }, [theme, resolvedTheme]);

  return null;
}
