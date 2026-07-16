import fs from "fs";
import path from "path";

/** Identifiant CID pour le logo embarqué dans les emails. */
export const KLAMBOCORE_EMAIL_LOGO_CID = "klambocore-logo@klambocore";

const DEFAULT_LOGO_RELATIVE = "uploads/klambocore.png";

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function resolveFromAppLogoUrl(): string | null {
  const fromEnv = process.env.APP_LOGO_URL?.trim();
  if (!fromEnv) return null;

  if (fromEnv.startsWith("http://") || fromEnv.startsWith("https://")) {
    try {
      const url = new URL(fromEnv);
      const relativePath = url.pathname.replace(/^\//, "");

      const publicFile = path.join(process.cwd(), "public", relativePath);
      if (fileExists(publicFile)) return publicFile;

      const uploadDir = process.env.UPLOAD_DIR?.trim();
      if (uploadDir) {
        const uploadFile = path.join(uploadDir, path.basename(relativePath));
        if (fileExists(uploadFile)) return uploadFile;
      }
    } catch {
      return null;
    }

    return null;
  }

  const relative = fromEnv.replace(/^\//, "");
  const publicFile = path.join(process.cwd(), "public", relative);
  if (fileExists(publicFile)) return publicFile;

  const uploadDir = process.env.UPLOAD_DIR?.trim();
  if (uploadDir) {
    const uploadFile = path.join(uploadDir, path.basename(relative));
    if (fileExists(uploadFile)) return uploadFile;
  }

  return null;
}

/** Chemin local du fichier logo pour pièce jointe inline. */
export function resolveKlambocoreEmailLogoFilePath(): string | null {
  const fromEnv = resolveFromAppLogoUrl();
  if (fromEnv) return fromEnv;

  const defaultFile = path.join(process.cwd(), "public", DEFAULT_LOGO_RELATIVE);
  if (fileExists(defaultFile)) return defaultFile;

  const uploadDir = process.env.UPLOAD_DIR?.trim();
  if (uploadDir) {
    const uploadFile = path.join(uploadDir, "klambocore.png");
    if (fileExists(uploadFile)) return uploadFile;
  }

  return null;
}

function getPublicLogoFallbackUrl(): string {
  const fromEnv = process.env.APP_LOGO_URL?.trim();
  if (fromEnv?.startsWith("http://") || fromEnv?.startsWith("https://")) {
    return fromEnv;
  }

  const origin = (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://klambocore.com"
  ).replace(/\/$/, "");

  const publicOrigin =
    origin.includes("localhost") || origin.includes("127.0.0.1")
      ? "https://klambocore.com"
      : origin;

  if (fromEnv) {
    const logoPath = fromEnv.startsWith("/") ? fromEnv : `/${fromEnv}`;
    return `${publicOrigin}${logoPath}`;
  }

  return `${publicOrigin}/${DEFAULT_LOGO_RELATIVE}`;
}

/** Src HTML du logo : CID embarqué si le fichier local existe, sinon URL publique. */
export function getKlambocoreEmailLogoSrc(): string {
  if (resolveKlambocoreEmailLogoFilePath()) {
    return `cid:${KLAMBOCORE_EMAIL_LOGO_CID}`;
  }

  return getPublicLogoFallbackUrl();
}

export function buildKlambocoreEmailLogoAttachment(): {
  filename: string;
  path: string;
  cid: string;
} | null {
  const logoPath = resolveKlambocoreEmailLogoFilePath();
  if (!logoPath) return null;

  return {
    filename: path.basename(logoPath),
    path: logoPath,
    cid: KLAMBOCORE_EMAIL_LOGO_CID,
  };
}
