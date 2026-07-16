/** Logo / image par défaut Klambocore (fichier dans public/uploads). */
export const KLAMBOCORE_DEFAULT_IMAGE_PATH = "/uploads/klambocore.png";

/** Domaine public pour les emails et liens absolus. */
export const KLAMBOCORE_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, "") ||
  "https://klambocore.com";

/** URL absolue du logo pour les emails (clients mail n’ont pas le chemin relatif). */
export const KLAMBOCORE_DEFAULT_IMAGE_URL = `${KLAMBOCORE_PUBLIC_ORIGIN.replace(/\/$/, "")}${KLAMBOCORE_DEFAULT_IMAGE_PATH}`;

/**
 * Retourne une URL d’image utilisable côté app, ou le logo Klambocore si vide.
 */
export function resolveImageSrc(
  src?: string | null | unknown,
  fallback: string = KLAMBOCORE_DEFAULT_IMAGE_PATH,
): string {
  if (src == null) return fallback;

  if (typeof src === "string") {
    const trimmed = src.trim();
    if (!trimmed) return fallback;
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("/")
    ) {
      return trimmed;
    }
    return `/uploads/${trimmed}`;
  }

  if (Array.isArray(src) && src.length > 0) {
    return resolveImageSrc(src[0], fallback);
  }

  if (typeof src === "object" && src !== null) {
    const data = src as Record<string, unknown>;
    if (typeof data.logo === "string" && data.logo.trim()) {
      return resolveImageSrc(data.logo, fallback);
    }
    for (const key of ["ecole", "event", "gallery"] as const) {
      const list = data[key];
      if (Array.isArray(list) && list.length > 0) {
        return resolveImageSrc(String(list[0]), fallback);
      }
    }
  }

  return fallback;
}

/** URL absolue pour les emails (priorité env APP_LOGO_URL, sinon klambocore.png). */
export function getKlambocoreEmailLogoUrl(): string {
  const fromEnv = process.env.APP_LOGO_URL?.trim();
  if (!fromEnv) return KLAMBOCORE_DEFAULT_IMAGE_URL;
  if (fromEnv.startsWith("http://") || fromEnv.startsWith("https://")) {
    return fromEnv;
  }
  const path = fromEnv.startsWith("/") ? fromEnv : `/${fromEnv}`;
  return `${KLAMBOCORE_PUBLIC_ORIGIN.replace(/\/$/, "")}${path}`;
}
