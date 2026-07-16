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

/** Resolve a simple display name: username → real name parts → name → email local-part. */
export function resolveUserDisplayName(
  user?: SessionUserDisplay | null,
): string {
  const username = cleanPart(user?.username);
  if (username) return username;

  const prenom = cleanPart(user?.prenom);
  const postnom = cleanPart(user?.postnom);
  const name = cleanPart(user?.name);
  const structured = [prenom, postnom].filter(Boolean).join(" ");

  if (structured && name && !name.includes(" ")) {
    return `${structured} ${name}`.trim();
  }
  if (structured) return structured;
  if (name) return name;

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
