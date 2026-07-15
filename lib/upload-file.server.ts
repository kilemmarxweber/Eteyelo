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
 * Retourne le dossier physique utilisé pour enregistrer les uploads.
 *
 * Développement :
 *   public/uploads
 *
 * Production :
 *   valeur de UPLOAD_DIR
 */
export function getUploadDirectory(): string {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    return path.join(process.cwd(), "public", "uploads");
  }

  const productionUploadDirectory =
    process.env.UPLOAD_DIR?.trim() ||
    (process.platform === "win32" ? "C:\\eteyelo-uploads" : "");

  if (!productionUploadDirectory)
    throw new Error("La variable d'environnement UPLOAD_DIR est obligatoire en production.");

  return path.resolve(productionUploadDirectory);
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
