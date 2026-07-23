/**
 * Convertit une URL d'image (http, relative `/uploads` ou `/api/uploads`, data:)
 * en data URL PNG pour jsPDF (webp/jpeg → canvas PNG).
 */

function candidateImageUrls(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return [];

  const urls = new Set<string>();

  const toAbsolute = (path: string) => {
    if (
      path.startsWith("http://") ||
      path.startsWith("https://") ||
      path.startsWith("data:") ||
      path.startsWith("blob:")
    ) {
      return path;
    }
    if (path.startsWith("/") && typeof window !== "undefined") {
      return `${window.location.origin}${path}`;
    }
    return path;
  };

  urls.add(toAbsolute(trimmed));

  // `/uploads/x` ↔ `/api/uploads/x` (rewrite Next + API disque)
  if (trimmed.startsWith("/uploads/")) {
    const fileName = trimmed.slice("/uploads/".length);
    urls.add(toAbsolute(`/api/uploads/${fileName}`));
  } else if (trimmed.startsWith("/api/uploads/")) {
    const fileName = trimmed.slice("/api/uploads/".length);
    urls.add(toAbsolute(`/uploads/${fileName}`));
  } else if (
    !trimmed.startsWith("http") &&
    !trimmed.startsWith("data:") &&
    !trimmed.startsWith("/")
  ) {
    urls.add(toAbsolute(`/uploads/${trimmed}`));
    urls.add(toAbsolute(`/api/uploads/${trimmed}`));
  }

  return [...urls];
}

async function blobToPngDataUrl(blob: Blob): Promise<string | null> {
  if (typeof window !== "undefined") {
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.toDataURL("image/png");
    } catch {
      // FileReader fallback below
    }
  }

  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

/**
 * Convertit une URL d'image en data URL PNG pour incorporation PDF.
 */
export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  if (!url?.trim()) return null;
  if (url.startsWith("data:")) return url;

  for (const candidate of candidateImageUrls(url)) {
    const blob = await fetchImageBlob(candidate);
    if (!blob) continue;
    const dataUrl = await blobToPngDataUrl(blob);
    if (dataUrl) return dataUrl;
  }

  return null;
}
