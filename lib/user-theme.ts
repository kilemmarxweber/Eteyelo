export const USER_THEME_VALUES = ["light", "dark", "system"] as const;

export type UserTheme = (typeof USER_THEME_VALUES)[number];

export function isUserTheme(value: unknown): value is UserTheme {
  return (
    typeof value === "string" &&
    (USER_THEME_VALUES as readonly string[]).includes(value)
  );
}

export function normalizeUserTheme(value: unknown): UserTheme {
  return isUserTheme(value) ? value : "light";
}

/** Clé localStorage isolée par utilisateur (évite le partage entre comptes). */
export function userThemeStorageKey(userId: string) {
  return `eteyelo-theme-${userId}`;
}
