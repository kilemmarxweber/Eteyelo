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

export const WINDOWS_UPLOAD_DIRECTORY = "C:\\eteyelo-uploads";
export const LINUX_UPLOAD_DIRECTORY = "/var/www/eteyelo-uploads";

/** Lecture runtime (évite que Next inline UPLOAD_DIR au `next build`). */
function runtimeEnv(name: string): string {
  const bag = process.env as Record<string, string | undefined>;
  return (bag[name] ?? "").trim();
}

function isWindowsDrivePath(value: string) {
  return /^[A-Za-z]:[\\/]/.test(value);
}

function publicUploadsDirectory(): string {
  return path.join(process.cwd(), "public", "uploads");
}

function addUniqueDir(dirs: string[], value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return;
  const resolved = path.resolve(trimmed);
  if (!dirs.includes(resolved)) dirs.push(resolved);
}

export function platformUploadDirectory(): string {
  return process.platform === "win32"
    ? WINDOWS_UPLOAD_DIRECTORY
    : LINUX_UPLOAD_DIRECTORY;
}

/**
 * Dossier physique des uploads (logos, photos, PDF, documents).
 * Même emplacement que les images :
 * - Windows : C:\eteyelo-uploads
 * - Linux   : /var/www/eteyelo-uploads
 * UPLOAD_DIR surcharge si le chemin est valide pour l’OS.
 */
export function getUploadDirectory(): string {
  const configured = runtimeEnv("UPLOAD_DIR");
  if (configured) {
    if (process.platform === "win32" || !isWindowsDrivePath(configured)) {
      return path.resolve(configured);
    }
  }
  return path.resolve(platformUploadDirectory());
}

/** Dossiers où un upload peut se trouver (écriture vs lecture, standalone, ancien chemin). */
export function listUploadDirectories(): string[] {
  const dirs: string[] = [];
  addUniqueDir(dirs, getUploadDirectory());
  addUniqueDir(dirs, LINUX_UPLOAD_DIRECTORY);
  addUniqueDir(dirs, WINDOWS_UPLOAD_DIRECTORY);
  addUniqueDir(dirs, "C:/eteyelo-uploads");
  addUniqueDir(dirs, runtimeEnv("UPLOAD_DIR"));
  addUniqueDir(dirs, publicUploadsDirectory());
  addUniqueDir(dirs, path.join(process.cwd(), "..", "public", "uploads"));
  addUniqueDir(dirs, path.join(process.cwd(), "..", "..", "public", "uploads"));
  addUniqueDir(dirs, path.join(process.cwd(), "eteyelo-uploads"));
  return dirs;
}

function isPathInsideDirectory(directory: string, filePath: string) {
  const relative = path.relative(path.resolve(directory), path.resolve(filePath));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/** Nom relatif sûr (`file.pdf` ou `devoirs/file.pdf`). */
export function safeUploadRelativePath(fileName: string): string {
  let decoded = fileName.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // déjà décodé
  }
  decoded = decoded.replace(/\\/g, "/");
  const parts = decoded.split("/").filter((part) => part && part !== ".");
  if (
    parts.length === 0 ||
    parts.some((part) => part === ".." || part.includes("\0"))
  ) {
    throw Object.assign(new Error("Nom de fichier invalide."), {
      code: "EINVAL",
    });
  }
  return path.join(...parts);
}

export async function readUploadedFileBuffer(fileName: string): Promise<Buffer> {
  const relative = safeUploadRelativePath(fileName);
  let lastError: NodeJS.ErrnoException | undefined;

  for (const directory of listUploadDirectories()) {
    const fullPath = path.join(directory, relative);
    if (!isPathInsideDirectory(directory, fullPath)) continue;
    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") throw nodeError;
      lastError = nodeError;
    }
  }

  throw (
    lastError ??
    Object.assign(new Error("Fichier introuvable sur le disque."), {
      code: "ENOENT",
    })
  );
}

async function mirrorUploadToPublicDirectory(
  relative: string,
  sourcePath: string,
) {
  const destination = path.join(publicUploadsDirectory(), relative);
  if (path.resolve(destination) === path.resolve(sourcePath)) return;
  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(sourcePath, destination);
  } catch {
    // repli facultatif — le fichier canonique reste dans eteyelo-uploads
  }
}

/** URL publique identique aux images (`/uploads/photo.jpg`). */
export function publicUploadPath(fileName: string): string {
  const urlPath = fileName.replace(/\\/g, "/").replace(/^\/+/, "");
  return `/uploads/${urlPath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

export async function writeUploadBuffer(
  fileName: string,
  buffer: Buffer,
): Promise<SavedUpload> {
  const relative = safeUploadRelativePath(fileName);
  const uploadDirectory = getUploadDirectory();
  const filePath = path.join(uploadDirectory, relative);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
  await mirrorUploadToPublicDirectory(relative, filePath);

  const storedName = relative.replace(/\\/g, "/");
  return {
    fileName: storedName,
    url: publicUploadPath(storedName),
  };
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
  const safeName = sanitizeFileName(file.name);
  const extension = getFileExtension(file, kind);
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeName}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  return writeUploadBuffer(fileName, buffer);
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
