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

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as UploadResponse;

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        message:
          data.ok === false
            ? data.message
            : "Erreur lors de l'upload du fichier.",
      };
    }

    return data;
  } catch {
    return {
      ok: false,
      message: "Impossible de joindre le serveur d'upload.",
    };
  }
}

export async function uploadFiles(files: File[]): Promise<string[]> {
  const uploadedNames: string[] = [];

  for (const file of files) {
    const result = await uploadFile(file);

    if (!result.ok) {
      throw new Error(result.message);
    }

    uploadedNames.push(result.fileName);
  }

  return uploadedNames;
}
