import crypto from "crypto";
import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getUploadDirectory } from "@/lib/upload-file.server";

export const MAX_LIBRARY_BOOK_BYTES = 50 * 1024 * 1024; // 50 Mo

export const ALLOWED_LIBRARY_MIME_TYPES = new Set([
  "application/pdf",
  "application/epub+zip",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/epub+zip": ".epub",
};

export type LibraryFileTypeValue = "PDF" | "EPUB";
export type LibraryStorageDriver = "local" | "s3";

export type SavedLibraryFile = {
  /** Clé privée stockée en DB (chemin relatif local ou clé objet S3) */
  storageKey: string;
  fileType: LibraryFileTypeValue;
  fileSize: number;
  mimeType: string;
};

function sanitizeBaseName(fileName: string): string {
  const extension = path.extname(fileName);
  const nameWithoutExtension = path.basename(fileName, extension);
  const safeName = nameWithoutExtension
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safeName || "book";
}

function resolveLibraryFileTypeFromName(
  fileName: string,
  mimeType?: string,
): LibraryFileTypeValue {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/epub+zip") return "EPUB";

  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "PDF";
  if (ext === ".epub") return "EPUB";

  throw new Error("Format non autorisé. Utilisez PDF ou EPUB.");
}

function resolveLibraryFileType(file: File): LibraryFileTypeValue {
  return resolveLibraryFileTypeFromName(file.name, file.type);
}

/** Driver actif : `s3` si configuré, sinon local. */
export function getLibraryStorageDriver(): LibraryStorageDriver {
  const requested = (process.env.LIBRARY_STORAGE_DRIVER || "local")
    .trim()
    .toLowerCase();

  if (requested !== "s3") {
    return "local";
  }

  const bucket = process.env.LIBRARY_S3_BUCKET?.trim();
  const accessKey = process.env.LIBRARY_S3_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.LIBRARY_S3_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !accessKey || !secretKey) {
    console.warn(
      "[library-storage] LIBRARY_STORAGE_DRIVER=s3 mais credentials incomplets — fallback local.",
    );
    return "local";
  }

  return "s3";
}

function getS3Config() {
  return {
    bucket: process.env.LIBRARY_S3_BUCKET!.trim(),
    region: process.env.LIBRARY_S3_REGION?.trim() || "auto",
    endpoint: process.env.LIBRARY_S3_ENDPOINT?.trim() || undefined,
    accessKeyId: process.env.LIBRARY_S3_ACCESS_KEY_ID!.trim(),
    secretAccessKey: process.env.LIBRARY_S3_SECRET_ACCESS_KEY!.trim(),
    forcePathStyle:
      process.env.LIBRARY_S3_FORCE_PATH_STYLE === "true" ||
      process.env.LIBRARY_S3_FORCE_PATH_STYLE === "1",
    prefix: (process.env.LIBRARY_S3_PREFIX || "library-books")
      .trim()
      .replace(/^\/+|\/+$/g, ""),
  };
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;
  const config = getS3Config();
  s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return s3Client;
}

function toS3ObjectKey(storageKey: string): string {
  const config = getS3Config();
  const normalized = storageKey.replace(/^\/+/, "").replace(/\\/g, "/");
  if (normalized.startsWith(`${config.prefix}/`)) {
    return normalized;
  }
  return `${config.prefix}/${normalized}`;
}

/**
 * Dossier racine privé des livres (jamais sous public/).
 * Dev: {cwd}/.data/library-books
 * Prod: {UPLOAD_DIR}/library-books
 */
export function getLibraryBooksRoot(): string {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    return path.join(process.cwd(), ".data", "library-books");
  }
  return path.join(getUploadDirectory(), "library-books");
}

export function resolveLibraryAbsolutePath(storageKey: string): string {
  const root = path.resolve(getLibraryBooksRoot());
  const absolute = path.resolve(root, storageKey);

  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    throw new Error("Chemin de fichier invalide.");
  }

  return absolute;
}

function buildStorageKey(branchId: string, fileName: string): string {
  const safeBranch = branchId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${safeBranch}/${fileName}`;
}

function buildUniqueFileName(originalName: string, extension: string): string {
  return `${Date.now()}-${crypto.randomUUID()}-${sanitizeBaseName(originalName)}${extension}`;
}

async function putLocalBuffer(
  storageKey: string,
  buffer: Buffer,
): Promise<void> {
  const absolutePath = resolveLibraryAbsolutePath(storageKey);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
}

async function putS3Buffer(
  storageKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  const config = getS3Config();
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: toS3ObjectKey(storageKey),
      Body: buffer,
      ContentType: mimeType,
      CacheControl: "private, no-store",
    }),
  );
}

export async function uploadLibraryBuffer(options: {
  buffer: Buffer;
  fileName: string;
  branchId: string;
  mimeType?: string;
}): Promise<SavedLibraryFile> {
  const { buffer, fileName, branchId } = options;

  if (!buffer.length) {
    throw new Error("Le fichier est vide.");
  }

  if (buffer.length > MAX_LIBRARY_BOOK_BYTES) {
    throw new Error("Le fichier dépasse la taille maximale autorisée de 50 Mo.");
  }

  const fileType = resolveLibraryFileTypeFromName(fileName, options.mimeType);
  const mimeType =
    options.mimeType ||
    (fileType === "PDF" ? "application/pdf" : "application/epub+zip");
  const extension =
    EXTENSION_BY_MIME[mimeType] || (fileType === "PDF" ? ".pdf" : ".epub");
  const uniqueName = buildUniqueFileName(fileName, extension);
  const storageKey = buildStorageKey(branchId, uniqueName);

  if (getLibraryStorageDriver() === "s3") {
    await putS3Buffer(storageKey, buffer, mimeType);
  } else {
    await putLocalBuffer(storageKey, buffer);
  }

  return {
    storageKey,
    fileType,
    fileSize: buffer.length,
    mimeType,
  };
}

export async function uploadLibraryFile(
  file: File,
  branchId: string,
): Promise<SavedLibraryFile> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Le fichier est vide.");
  }

  if (file.size > MAX_LIBRARY_BOOK_BYTES) {
    throw new Error("Le fichier dépasse la taille maximale autorisée de 50 Mo.");
  }

  const fileType = resolveLibraryFileType(file);
  const mimeType =
    file.type ||
    (fileType === "PDF" ? "application/pdf" : "application/epub+zip");

  if (
    file.type &&
    !ALLOWED_LIBRARY_MIME_TYPES.has(file.type) &&
    ![".pdf", ".epub"].includes(path.extname(file.name).toLowerCase())
  ) {
    throw new Error("Format non autorisé. Utilisez PDF ou EPUB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadLibraryBuffer({
    buffer,
    fileName: file.name,
    branchId,
    mimeType,
  });
}

export async function deleteLibraryFile(storageKey: string): Promise<void> {
  if (!storageKey || storageKey.startsWith("http")) {
    return;
  }

  try {
    if (getLibraryStorageDriver() === "s3") {
      const config = getS3Config();
      await getS3Client().send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: toS3ObjectKey(storageKey),
        }),
      );
      return;
    }

    const absolute = resolveLibraryAbsolutePath(storageKey);
    await fs.unlink(absolute);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT" && code !== "NoSuchKey") {
      console.error("LIBRARY_FILE_DELETE_ERROR:", error);
    }
  }
}

export async function readLibraryFile(storageKey: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  size: number;
}> {
  const ext = path.extname(storageKey).toLowerCase();
  const mimeType =
    ext === ".epub" ? "application/epub+zip" : "application/pdf";

  if (getLibraryStorageDriver() === "s3") {
    const config = getS3Config();
    const result = await getS3Client().send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: toS3ObjectKey(storageKey),
      }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error("Fichier cloud vide.");
    }
    const buffer = Buffer.from(bytes);
    return {
      buffer,
      mimeType: result.ContentType || mimeType,
      size: buffer.length,
    };
  }

  const absolutePath = resolveLibraryAbsolutePath(storageKey);
  const buffer = await fs.readFile(absolutePath);
  return { buffer, mimeType, size: buffer.length };
}

export async function openLibraryFileStream(storageKey: string): Promise<{
  stream: Readable;
  mimeType: string;
  size?: number;
}> {
  const ext = path.extname(storageKey).toLowerCase();
  const mimeType =
    ext === ".epub" ? "application/epub+zip" : "application/pdf";

  if (getLibraryStorageDriver() === "s3") {
    const config = getS3Config();
    const result = await getS3Client().send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: toS3ObjectKey(storageKey),
      }),
    );

    const body = result.Body;
    if (!body) {
      throw new Error("Fichier cloud introuvable.");
    }

    const nodeStream =
      body instanceof Readable
        ? body
        : Readable.fromWeb(body.transformToWebStream() as any);

    return {
      stream: nodeStream,
      mimeType: result.ContentType || mimeType,
      size: result.ContentLength,
    };
  }

  const absolutePath = resolveLibraryAbsolutePath(storageKey);
  const stat = await fs.stat(absolutePath);
  return {
    stream: createReadStream(absolutePath),
    mimeType,
    size: stat.size,
  };
}

/** Vérifie si un objet existe (local ou S3). */
export async function libraryFileExists(storageKey: string): Promise<boolean> {
  try {
    if (getLibraryStorageDriver() === "s3") {
      const config = getS3Config();
      await getS3Client().send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: toS3ObjectKey(storageKey),
        }),
      );
      return true;
    }
    await fs.access(resolveLibraryAbsolutePath(storageKey));
    return true;
  } catch {
    return false;
  }
}
