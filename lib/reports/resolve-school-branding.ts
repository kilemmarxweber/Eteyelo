import { extractBulletinBranchLogo } from "@/lib/bulletin-context";
import type { SchoolReportContext } from "@/lib/reports/types";

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

function normalizeOptionalImageUrl(value: unknown): string {
  if (typeof value !== "string") return "";

  const image = value.trim();
  if (!image) return "";

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:") ||
    image.startsWith("/")
  ) {
    return image;
  }

  return `/uploads/${image}`;
}

/**
 * Logo rapport : branche (`image.logo`) → organisation → chaîne vide
 * (pas de fallback Klambocore, contrairement aux bulletins).
 */
export function resolveReportLogoUrl(
  branchImage: unknown,
  organizationLogo: unknown,
): string {
  return (
    extractBulletinBranchLogo(branchImage) ||
    normalizeOptionalImageUrl(organizationLogo) ||
    ""
  );
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
  baseCurrency?: SchoolReportContext["baseCurrency"];
  quoteCurrency?: SchoolReportContext["quoteCurrency"];
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
    baseCurrency: options.baseCurrency,
    quoteCurrency: options.quoteCurrency,
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
