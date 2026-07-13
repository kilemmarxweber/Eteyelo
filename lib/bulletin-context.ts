export type BulletinBranchContext = {
  organizationName: string;
  branchName: string;
  branchCode: string;
  address: string;
  city: string;
  country: string;
  logoUrl: string;
};

export type BulletinBranchRecord = {
  name: string;
  code?: string | null;
  adresse?: string | null;
  ville?: string | null;
  pays?: string | null;
  image?: unknown;
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
    normalizeOptionalImageUrl(organizationLogo)
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
    city: branch.ville?.trim() ?? "",
    country: branch.pays?.trim() ?? "",
    logoUrl: resolveBulletinLogoUrl(branch.image, branch.organization.logo),
  };
}
