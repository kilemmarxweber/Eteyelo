import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type SavedUpload = {
  fileName: string;
  url: string;
};

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

/**
 * Dossier physique des uploads (logos branche, photos d’école,
 * événements, logos partenaires, documents).
 *
 * Priorité :
 * 1. UPLOAD_DIR (ex. C:/eteyelo-uploads)
 * 2. C:\eteyelo-uploads sous Windows
 * 3. public/uploads en développement si rien n’est configuré
 */
export function getUploadDirectory(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  if (process.platform === "win32") {
    return path.resolve("C:\\eteyelo-uploads");
  }

  if (process.env.NODE_ENV !== "production") {
    return path.join(process.cwd(), "public", "uploads");
  }

  throw new Error(
    "La variable d'environnement UPLOAD_DIR est obligatoire en production.",
  );
}

function publicUploadsDirectory(): string {
  return path.join(process.cwd(), "public", "uploads");
}

/** Nom de fichier stocké en base → nom sûr, sans préfixe /uploads. */
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

  return path.basename(stripped);
}

/**
 * Copie un fichier encore présent dans public/uploads vers le dossier partagé
 * (eteyelo-uploads), s’il n’y est pas déjà.
 */
export async function ensureUploadInSharedDirectory(
  storedName: string | null | undefined,
): Promise<void> {
  const fileName = storedUploadFileName(storedName);
  if (!fileName) return;

  const destDir = getUploadDirectory();
  const destPath = path.join(destDir, fileName);

  try {
    await fs.access(destPath);
    return;
  } catch {
    // pas encore dans le dossier partagé
  }

  const publicPath = path.join(publicUploadsDirectory(), fileName);
  try {
    await fs.access(publicPath);
    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(publicPath, destPath);
  } catch {
    // source absente — rien à copier
  }
}

/**
 * Nettoie le nom original du fichier.
 */
function sanitizeFileName(fileName: string): string {
  const extension = path.extname(fileName);

  const nameWithoutExtension = path.basename(fileName, extension);

  const safeName = nameWithoutExtension
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safeName || "file";
}

/**
 * Détermine l'extension finale à partir du type MIME.
 */
function getFileExtension(
  file: File,
  kind: "image" | "document" = "image",
): string {
  const extensionFromMimeType = EXTENSION_BY_MIME_TYPE[file.type];

  if (extensionFromMimeType) {
    return extensionFromMimeType;
  }

  const originalExtension = path.extname(file.name).toLowerCase();

  if (kind === "document") {
    return originalExtension || ".pdf";
  }

  return originalExtension || ".jpg";
}

/**
 * Valide le fichier avant son enregistrement.
 */
function validateUploadedFile(
  file: File,
  options: { kind: "image" | "document" },
): void {
  if (file.size === 0) {
    throw new Error("Le fichier est vide.");
  }

  const maxBytes =
    options.kind === "document"
      ? MAX_DOCUMENT_UPLOAD_BYTES
      : MAX_UPLOAD_BYTES;

  if (file.size > maxBytes) {
    throw new Error(
      options.kind === "document"
        ? "Le fichier dépasse la taille maximale autorisée de 10 Mo."
        : "Le fichier dépasse la taille maximale autorisée de 5 Mo.",
    );
  }

  const allowedTypes =
    options.kind === "document" ? ALLOWED_DOCUMENT_TYPES : ALLOWED_IMAGE_TYPES;

  if (!allowedTypes.has(file.type)) {
    throw new Error(
      options.kind === "document"
        ? "Format non autorisé. Utilisez PDF, DOC ou DOCX."
        : "Format d'image non autorisé. Utilisez PNG, JPG, JPEG ou WEBP.",
    );
  }
}

/**
 * Enregistre physiquement un fichier.
 */
export async function saveUploadedFile(file: File): Promise<SavedUpload> {
  return saveUploadedFileByKind(file, "image");
}

export async function saveUploadedDocument(file: File): Promise<SavedUpload> {
  return saveUploadedFileByKind(file, "document");
}

async function saveUploadedFileByKind(
  file: File,
  kind: "image" | "document",
): Promise<SavedUpload> {
  validateUploadedFile(file, { kind });
  return writeUploadedFileToSharedDirectory(file, kind);
}

async function writeUploadedFileToSharedDirectory(
  file: File,
  kind: "image" | "document",
): Promise<SavedUpload> {
  const uploadDirectory = getUploadDirectory();

  await fs.mkdir(uploadDirectory, {
    recursive: true,
  });

  const safeName = sanitizeFileName(file.name);
  const extension = getFileExtension(file, kind);
  const uniquePart = crypto.randomUUID();
  const fileName = `${Date.now()}-${uniquePart}-${safeName}${extension}`;
  const filePath = path.join(uploadDirectory, fileName);
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  await fs.writeFile(filePath, buffer);

  return {
    fileName,
    url: `/api/uploads/${encodeURIComponent(fileName)}`,
  };
}

/**
 * Enregistre un fichier (image ou document) dans le même dossier que les
 * logos de branche / photos d’école — UPLOAD_DIR (eteyelo-uploads).
 */
export async function persistFileInUploadDirectory(
  file: File,
  kind: "image" | "document" = "image",
): Promise<SavedUpload> {
  if (kind === "image" || ALLOWED_IMAGE_TYPES.has(file.type)) {
    return saveUploadedFile(file);
  }

  if (ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return saveUploadedDocument(file);
  }

  if (file.size === 0) {
    throw new Error("Le fichier est vide.");
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new Error(
      "Le fichier dépasse la taille maximale autorisée de 10 Mo.",
    );
  }

  return writeUploadedFileToSharedDirectory(file, "document");
}
