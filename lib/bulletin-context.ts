import {
  type ManagedBranchType,
  normalizeBranchType,
} from "@/lib/academic-structure";
import { usesBulletinForBranch } from "@/lib/branch-capabilities";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { branchDocumentName } from "@/lib/branch-document-name";
import {
  normalizeEducationSystem,
  usesTermPeriodCalendar,
  type EducationSystem,
} from "@/lib/education-system";

export type BulletinLayoutKind = "primary" | "secondary" | "term-period";

/** Sélectionne le moteur de dessin selon le type de branche (repli SECONDAIRE si inconnu). */
export function resolveBulletinLayoutKind(
  branchType: ManagedBranchType | unknown,
  educationSystem?: unknown,
): BulletinLayoutKind {
  if (usesTermPeriodCalendar(branchType, educationSystem)) {
    return "term-period";
  }

  if (!usesBulletinForBranch(branchType)) {
    return "secondary";
  }

  return normalizeBranchType(branchType) === "PRIMAIRE" ? "primary" : "secondary";
}

export type BulletinBranchContext = {
  organizationName: string;
  branchName: string;
  branchCode: string;
  address: string;
  province: string;
  city: string;
  commune: string;
  country: string;
  logoUrl: string;
  branchType: ManagedBranchType;
  educationSystem: EducationSystem;
  directorName?: string;
  directorTitle?: string;
  /** Domaines bulletin primaire (libellés custom par branche). */
  primaryDomains?: Array<{
    code: string;
    label: string;
    shortLabel: string;
    sortOrder: number;
  }>;
};

export type BulletinBranchRecord = {
  name: string;
  description?: string | null;
  code?: string | null;
  adresse?: string | null;
  province?: string | null;
  ville?: string | null;
  commune?: string | null;
  pays?: string | null;
  image?: unknown;
  typebranch?: unknown;
  educationSystem?: unknown;
  organization: {
    name: string;
    logo?: string | null;
  };
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

export function extractBulletinBranchLogo(image: unknown): string {
  if (!image) return "";

  let parsedImage = image;
  if (typeof image === "string") {
    try {
      parsedImage = JSON.parse(image);
    } catch {
      return normalizeOptionalImageUrl(image);
    }
  }

  if (!parsedImage || typeof parsedImage !== "object" || Array.isArray(parsedImage)) {
    return "";
  }

  return normalizeOptionalImageUrl(
    (parsedImage as Record<string, unknown>).logo,
  );
}

export function resolveBulletinLogoUrl(
  branchImage: unknown,
  organizationLogo: unknown,
): string {
  return (
    extractBulletinBranchLogo(branchImage) ||
    normalizeOptionalImageUrl(organizationLogo) ||
    KLAMBOCORE_DEFAULT_IMAGE_PATH
  );
}

export function buildBulletinBranchContext(
  branch: BulletinBranchRecord,
): BulletinBranchContext {
  return {
    organizationName: branch.organization.name.trim(),
    branchName: branchDocumentName(branch),
    branchCode: branch.code?.trim() ?? "",
    address: branch.adresse?.trim() ?? "",
    province: branch.province?.trim() ?? "",
    city: branch.ville?.trim() ?? "",
    commune: branch.commune?.trim() ?? "",
    country: branch.pays?.trim() ?? "",
    logoUrl: resolveBulletinLogoUrl(branch.image, branch.organization.logo),
    branchType: normalizeBranchType(branch.typebranch),
    educationSystem: normalizeEducationSystem(branch.educationSystem),
  };
}
