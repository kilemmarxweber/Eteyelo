"use server";

import type { UploadResponse } from "./upload-file";
import { saveUploadedFile } from "./upload-file.server";

/**
 * @deprecated
 * Préférer uploadFile() qui utilise `/api/upload`.
 */
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

    const savedFile = await saveUploadedFile(file);

    return {
      ok: true,
      fileName: savedFile.fileName,
      url: savedFile.url,
    };
  } catch (error) {
    console.error("UPLOAD_ACTION_ERROR:", error);

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Erreur lors de l'upload du fichier.",
    };
  }
}

export type { UploadResponse };
