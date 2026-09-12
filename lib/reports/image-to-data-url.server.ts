import "server-only";

import fs from "fs/promises";
import path from "path";
import {
  getUploadDirectory,
  storedUploadFileName,
} from "@/lib/upload-file.server";

function mimeFromExtension(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

async function bufferToDataUrl(buffer: Buffer, mime: string) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** Charge un logo en data URL côté serveur (disque ou HTTP). */
export async function imageUrlToDataUrlServer(
  url?: string | null,
): Promise<string | null> {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    try {
      const response = await fetch(trimmed);
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      const mime =
        response.headers.get("content-type")?.split(";")[0]?.trim() ||
        "image/png";
      return bufferToDataUrl(buffer, mime);
    } catch {
      return null;
    }
  }

  const fileName = storedUploadFileName(trimmed);
  if (!fileName) return null;

  const candidates = [
    path.join(getUploadDirectory(), fileName),
    path.join(process.cwd(), "public", "uploads", fileName),
  ];

  for (const filePath of candidates) {
    try {
      const buffer = await fs.readFile(filePath);
      return bufferToDataUrl(buffer, mimeFromExtension(filePath));
    } catch {
      continue;
    }
  }

  return null;
}
