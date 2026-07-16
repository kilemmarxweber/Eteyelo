export type UploadSuccessResponse = {
  ok: true;
  fileName: string;
  url: string;
};

export type UploadErrorResponse = {
  ok: false;
  message: string;
};

export type UploadResponse = UploadSuccessResponse | UploadErrorResponse;

/** Limite images côté client (alignée sur le serveur). */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Envoie un fichier vers la route `/api/upload`.
 */
export async function uploadFile(
  file: File | null | undefined,
): Promise<UploadResponse> {
  if (!file) {
    return {
      ok: false,
      message: "Aucun fichier sélectionné.",
    };
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      ok: false,
      message: "Le fichier dépasse la taille maximale autorisée de 5 Mo.",
    };
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const contentType = response.headers.get("content-type");

    if (!contentType?.includes("application/json")) {
      const responseText = await response.text();

      console.error("UPLOAD_INVALID_RESPONSE:", {
        status: response.status,
        body: responseText,
      });

      return {
        ok: false,
        message: `Le serveur d'upload a retourné une réponse invalide (${response.status}).`,
      };
    }

    const result = (await response.json()) as UploadResponse;

    if (!response.ok) {
      return {
        ok: false,
        message:
          result.ok === false
            ? result.message
            : "Erreur lors de l'upload du fichier.",
      };
    }

    return result;
  } catch (error) {
    console.error("UPLOAD_CLIENT_ERROR:", error);

    return {
      ok: false,
      message: "Impossible de joindre le serveur d'upload.",
    };
  }
}

/**
 * Envoie plusieurs fichiers un après l'autre.
 *
 * Retourne uniquement leurs noms pour pouvoir les enregistrer en base.
 */
export async function uploadFiles(files: File[]): Promise<string[]> {
  if (files.length === 0) {
    return [];
  }

  const uploadedFileNames: string[] = [];

  for (const file of files) {
    const result = await uploadFile(file);

    if (!result.ok) {
      throw new Error(result.message);
    }

    uploadedFileNames.push(result.fileName);
  }

  return uploadedFileNames;
}

/**
 * Envoie un document (PDF, DOC, DOCX) vers `/api/upload/document`.
 */
export async function uploadDocument(
  file: File | null | undefined,
): Promise<UploadResponse> {
  if (!file) {
    return {
      ok: false,
      message: "Aucun fichier sélectionné.",
    };
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return {
      ok: false,
      message: "Le fichier dépasse la taille maximale autorisée de 10 Mo.",
    };
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/upload/document", {
      method: "POST",
      body: formData,
    });

    const contentType = response.headers.get("content-type");

    if (!contentType?.includes("application/json")) {
      const responseText = await response.text();

      console.error("UPLOAD_DOCUMENT_INVALID_RESPONSE:", {
        status: response.status,
        body: responseText,
      });

      return {
        ok: false,
        message: `Le serveur d'upload a retourné une réponse invalide (${response.status}).`,
      };
    }

    const result = (await response.json()) as UploadResponse;

    if (!response.ok) {
      return {
        ok: false,
        message:
          result.ok === false
            ? result.message
            : "Erreur lors de l'upload du document.",
      };
    }

    return result;
  } catch (error) {
    console.error("UPLOAD_DOCUMENT_CLIENT_ERROR:", error);

    return {
      ok: false,
      message: "Impossible de joindre le serveur d'upload.",
    };
  }
}
