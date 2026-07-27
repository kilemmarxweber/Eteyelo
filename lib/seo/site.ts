import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";

/**
 * Origine canonique pour SEO (sitemap, robots, Open Graph).
 * Priorité : NEXT_PUBLIC_APP_URL → fallback prod (jamais localhost auth).
 */
function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (
    fromEnv &&
    !fromEnv.includes("localhost") &&
    !fromEnv.includes("127.0.0.1")
  ) {
    return fromEnv;
  }
  return "https://klambocore.com";
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = "KlamboCore";
export const SITE_LEGAL_NAME = "Klambocore Sarl";

export const SITE_DESCRIPTION =
  "Plateforme de gestion scolaire KlamboCore — établissements, inscriptions, résultats et services numériques en RDC.";

export const SITE_OG_IMAGE = KLAMBOCORE_DEFAULT_IMAGE_PATH;

/** Pages marketing / publiques à indexer (hors dynamiques). */
export const PUBLIC_STATIC_ROUTES = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/etablissements", changeFrequency: "daily", priority: 0.9 },
  { path: "/evenements", changeFrequency: "daily", priority: 0.8 },
  { path: "/galerie", changeFrequency: "weekly", priority: 0.6 },
  { path: "/produits-digitaux", changeFrequency: "monthly", priority: 0.7 },
  { path: "/services/informatique", changeFrequency: "monthly", priority: 0.6 },
  {
    path: "/services/design-marketing",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  { path: "/services/autres", changeFrequency: "monthly", priority: 0.5 },
  { path: "/inscription", changeFrequency: "weekly", priority: 0.8 },
  { path: "/inscription-ecole", changeFrequency: "weekly", priority: 0.8 },
  { path: "/rejoindre-klambocore", changeFrequency: "monthly", priority: 0.6 },
  { path: "/depot-candidature", changeFrequency: "monthly", priority: 0.5 },
  { path: "/support", changeFrequency: "monthly", priority: 0.5 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
] as const;

/** Zones privées / techniques — ne pas indexer. */
export const DISALLOW_PATHS = [
  "/admin",
  "/auth",
  "/api",
  "/dev",
  "/accept-invitation",
  "/components",
] as const;

export function absoluteUrl(path = "/"): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized === "/" ? "" : normalized}`;
}
