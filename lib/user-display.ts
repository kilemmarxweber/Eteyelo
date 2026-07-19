const PLACEHOLDER_NAME =
  /^(defaultfirst|defaultlast|default|n\/a|null|undefined)$/i;

export type SessionUserDisplay = {
  name?: string | null;
  email?: string | null;
  username?: string | null;
  prenom?: string | null;
  postnom?: string | null;
  image?: string | null;
};

function cleanPart(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAME.test(trimmed)) return null;
  return trimmed;
}

/** Affiche uniquement prenom + name (sans username ni postnom). */
export function resolveUserDisplayName(
  user?: SessionUserDisplay | null,
): string {
  const prenom = cleanPart(user?.prenom);
  const name = cleanPart(user?.name);
  const display = [prenom, name].filter(Boolean).join(" ").trim();
  if (display) return display;

  const email = user?.email?.trim();
  if (email?.includes("@")) return email.split("@")[0] ?? "Utilisateur";
  return "Utilisateur";
}

export function getUserInitials(displayName: string): string {
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? "U").toUpperCase();
}
