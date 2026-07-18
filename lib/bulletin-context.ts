import {
  type ManagedBranchType,
  normalizeBranchType,
} from "@/lib/academic-structure";
import { usesBulletinForBranch } from "@/lib/branch-capabilities";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";

export type BulletinLayoutKind = "primary" | "secondary";

/** Sélectionne le moteur de dessin selon le type de branche (repli SECONDAIRE si inconnu). */
export function resolveBulletinLayoutKind(
  branchType: ManagedBranchType | unknown,
): BulletinLayoutKind {
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
};

export type BulletinBranchRecord = {
  name: string;
  code?: string | null;
  adresse?: string | null;
  province?: string | null;
  ville?: string | null;
  commune?: string | null;
  pays?: string | null;
  image?: unknown;
  typebranch?: unknown;
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
    branchName: branch.name.trim(),
    branchCode: branch.code?.trim() ?? "",
    address: branch.adresse?.trim() ?? "",
    province: branch.province?.trim() ?? "",
    city: branch.ville?.trim() ?? "",
    commune: branch.commune?.trim() ?? "",
    country: branch.pays?.trim() ?? "",
    logoUrl: resolveBulletinLogoUrl(branch.image, branch.organization.logo),
    branchType: normalizeBranchType(branch.typebranch),
  };
}
