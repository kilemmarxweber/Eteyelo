import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  getUploadDirectory,
  MAX_DOCUMENT_UPLOAD_BYTES,
} from "@/lib/upload-file.server";

const ALLOWED = new Set([
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
]);

export async function uploadDevoirFile(file: File) {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Type de fichier non autorisé (images, PDF, DOC/DOCX).");
  }
  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new Error("Fichier trop volumineux (max 10 Mo).");
  }

  const uploadRoot = getUploadDirectory();
  const dir = path.join(uploadRoot, "devoirs");
  await fs.mkdir(dir, { recursive: true });

  const ext =
    path.extname(file.name).toLowerCase() ||
    (file.type === "application/pdf" ? ".pdf" : ".bin");
  const safeBase = path
    .basename(file.name, path.extname(file.name))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "devoir";
  const fileName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeBase}${ext}`;
  const absolutePath = path.join(dir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return {
    name: file.name,
    mimeType: file.type,
    size: file.size,
    url: `/api/uploads/${encodeURIComponent(`devoirs/${fileName}`)}`,
  };
}
