"use client";

import { toast } from "sonner";
import type { UploadResponse } from "./upload-file.action";

export async function uploadFile(
  file: File | null | undefined,
): Promise<UploadResponse> {
  if (!file) {
    return {
      ok: false,
      message: "Aucun fichier sélectionné.",
    };
  }

  const formData = new FormData();
  formData.append("file", file);

  const { uploadFileAction } = await import("./upload-file.action");

  const res = await uploadFileAction(formData);

  if (!res.ok) {
    toast.error(res.message);
    return res;
  }

  toast.success("Fichier uploadé avec succès.");

  return res;
}
