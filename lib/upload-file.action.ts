"use server";

import fs from "fs/promises";
import path from "path";

export type UploadResponse =
  | {
      ok: true;
      fileName: string;
      url: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function uploadFileAction(
  formData: FormData,
): Promise<UploadResponse> {
  try {
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return {
        ok: false,
        message: "Aucun fichier reçu.",
      };
    }

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
      ok: true,
      fileName,
      url: `/uploads/${fileName}`,
    };
  } catch {
    return {
      ok: false,
      message: "Erreur lors de l’upload du fichier.",
    };
  }
}
