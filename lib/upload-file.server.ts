import fs from "fs/promises";
import path from "path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export type SavedUpload = {
  fileName: string;
  url: string;
};

export async function saveUploadedFile(
  file: File,
): Promise<SavedUpload | null> {
  if (file.size === 0) return null;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = path.extname(file.name);
  const safeName = file.name
    .replace(ext, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  const fileName = `${Date.now()}-${safeName}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, fileName), buffer);

  return {
    fileName,
    url: `/uploads/${fileName}`,
  };
}
