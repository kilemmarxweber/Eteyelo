/**
 * Helpers chemins/URLs uploads — utilisables client + serveur
 * (sans dépendance fs).
 */

export function storedUploadFileName(
  storedName: string | null | undefined,
): string {
  const raw = storedName?.trim() ?? "";
  if (!raw) return "";

  const withoutQuery = raw.split("?")[0] ?? raw;
  const normalized = withoutQuery
    .replace(/\\/g, "/")
    .replace(/^https?:\/\/[^/]+/i, "");
  const stripped = normalized
    .replace(/^\/+/, "")
    .replace(/^api\/uploads\//, "")
    .replace(/^uploads\//, "");

  const parts = stripped.split("/").filter((part) => part && part !== ".");
  if (
    parts.length === 0 ||
    parts.some((part) => part === ".." || part.includes("\0"))
  ) {
    return "";
  }

  // Conservateur : un seul segment (basename) pour éviter les chemins douteux.
  try {
    return decodeURIComponent(parts[parts.length - 1] ?? "");
  } catch {
    return parts[parts.length - 1] ?? "";
  }
}

/** URL publique `/uploads/<file>` avec segments encodés. */
export function publicUploadPath(fileName: string): string {
  const stored = storedUploadFileName(fileName) || fileName.trim();
  if (!stored) return "";

  const urlPath = stored.replace(/\\/g, "/").replace(/^\/+/, "");
  return `/uploads/${urlPath
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return encodeURIComponent(decodeURIComponent(part));
      } catch {
        return encodeURIComponent(part);
      }
    })
    .join("/")}`;
}

/** Valeur CSS `url('...')` sûre pour background-image. */
export function cssBackgroundImage(src: string): string {
  const safe = src.replace(/\\/g, "/").replace(/'/g, "%27").replace(/"/g, "%22");
  return `url('${safe}')`;
}
