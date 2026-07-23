import type { SchoolReportContext } from "@/lib/reports/types";

/** Même image que la sidebar quand branche / org n'ont pas de logo. */
export const REPORT_DEFAULT_LOGO_PATH = "/cmj.jpg";

export type SchoolBrandingBranchRecord = {
  id: string;
  name: string;
  organizationId: string;
  adresse?: string | null;
  commune?: string | null;
  ville?: string | null;
  province?: string | null;
  pays?: string | null;
  tel?: string | null;
  image?: unknown;
  organization: {
    id?: string;
    name: string;
    logo?: string | null;
  };
  schoolYear?: Array<{ nameYear: string | null }>;
};

/**
 * Normalise un chemin image comme l'UI (sidebar / galerie),
 * sans fallback Klambocore.
 */
export function normalizeOptionalImageUrl(value: unknown): string {
  if (typeof value !== "string") return "";

  let image = value.trim();
  if (!image) return "";

  // Corrige un double préfixe éventuel
  image = image.replace(/^\/uploads\/uploads\//, "/uploads/");

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:") ||
    image.startsWith("blob:") ||
    image.startsWith("/")
  ) {
    return image;
  }

  // Même convention que l'app : /uploads/… (rewrite → /api/uploads/…)
  return `/uploads/${image}`;
}

function readRawBranchLogo(branchImage: unknown): string {
  if (!branchImage) return "";

  let parsed: unknown = branchImage;
  if (typeof branchImage === "string") {
    const trimmed = branchImage.trim();
    if (!trimmed) return "";
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "";
  }

  const logo = (parsed as Record<string, unknown>).logo;
  return typeof logo === "string" ? logo.trim() : "";
}

function readRawFirstListImage(
  branchImage: unknown,
  key: "ecole" | "event" | "gallery",
): string {
  if (!branchImage) return "";

  let parsed: unknown = branchImage;
  if (typeof branchImage === "string") {
    try {
      parsed = JSON.parse(branchImage);
    } catch {
      return "";
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "";
  }

  const list = (parsed as Record<string, unknown>)[key];
  if (!Array.isArray(list) || list.length === 0) return "";
  const first = list[0];
  return typeof first === "string" ? first.trim() : "";
}

/**
 * Logo rapport — aligné sur la sidebar :
 * 1. `branch.image.logo`
 * 2. première image `ecole`
 * 3. `organization.logo`
 * 4. `/cmj.jpg` (même fallback que la sidebar)
 */
export function resolveReportLogoUrl(
  branchImage: unknown,
  organizationLogo: unknown,
): string {
  const rawLogo = readRawBranchLogo(branchImage);
  if (rawLogo) {
    return normalizeOptionalImageUrl(rawLogo);
  }

  const ecole = readRawFirstListImage(branchImage, "ecole");
  if (ecole) {
    return normalizeOptionalImageUrl(ecole);
  }

  const orgLogo = normalizeOptionalImageUrl(organizationLogo);
  if (orgLogo) {
    return orgLogo;
  }

  return REPORT_DEFAULT_LOGO_PATH;
}

export function formatSchoolAddress(
  branch: Pick<
    SchoolBrandingBranchRecord,
    "adresse" | "commune" | "ville" | "province" | "pays"
  >,
): string | undefined {
  const parts = [
    branch.adresse,
    branch.commune,
    branch.ville,
    branch.province,
    branch.pays,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : undefined;
}

export type BuildSchoolReportContextOptions = {
  generatedAt?: string;
  exchangeRateUsdCdf?: number;
  /** Si fourni, remplace le libellé année scolaire dérivé de la branche. */
  academicYearLabel?: string;
};

/**
 * Construit le contexte branding partagé pour PDF / aperçus HTML.
 * `schoolName` = nom d'organisation (établissement), adresse / téléphone = branche.
 */
export function buildSchoolReportContext(
  branch: SchoolBrandingBranchRecord,
  options: BuildSchoolReportContextOptions = {},
): SchoolReportContext {
  const organizationName = branch.organization.name.trim();
  const branchName = branch.name.trim();
  const academicYearFromBranch = branch.schoolYear?.[0]?.nameYear?.trim();

  return {
    organizationId: branch.organization.id ?? branch.organizationId,
    branchId: branch.id,
    schoolName: organizationName || branchName || "Établissement",
    branchName: branchName || undefined,
    address: formatSchoolAddress(branch),
    city: branch.ville?.trim() || undefined,
    phone: branch.tel?.trim() || undefined,
    logoUrl: resolveReportLogoUrl(branch.image, branch.organization.logo),
    academicYearLabel:
      options.academicYearLabel?.trim() || academicYearFromBranch || undefined,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    exchangeRateUsdCdf: options.exchangeRateUsdCdf,
  };
}

/** Select Prisma réutilisable pour peupler `SchoolBrandingBranchRecord`. */
export const schoolReportBranchSelect = {
  id: true,
  name: true,
  organizationId: true,
  adresse: true,
  commune: true,
  ville: true,
  province: true,
  pays: true,
  tel: true,
  image: true,
  organization: { select: { id: true, name: true, logo: true } },
  schoolYear: {
    where: { isCurrentYear: true, isArchived: false },
    select: { nameYear: true },
    take: 1,
  },
} as const;
