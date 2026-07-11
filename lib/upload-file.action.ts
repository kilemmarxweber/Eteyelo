"use server";

import type { UploadResponse } from "./upload-file";
import { saveUploadedFile } from "./upload-file.server";

/** @deprecated Préférer l'upload client via `/api/upload`. */
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

    const saved = await saveUploadedFile(file);

    if (!saved) {
      return {
        ok: false,
        message: "Erreur lors de l'upload du fichier.",
      };
    }

    return {
      ok: true,
      fileName: saved.fileName,
      url: saved.url,
    };
  } catch {
    return {
      ok: false,
      message: "Erreur lors de l'upload du fichier.",
    };
  }
}

export type { UploadResponse };
