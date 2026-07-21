let cachedTemplateDataUrl: string | null = null;

function readTemplateFromDisk(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("node:path") as typeof import("node:path");

  const filePath = path.join(process.cwd(), "public", "uploads", "certificat.jpeg");
  const buffer = fs.readFileSync(filePath);
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

export function getBrevetCertificateTemplateDataUrlSync(): string {
  if (!cachedTemplateDataUrl) {
    cachedTemplateDataUrl = readTemplateFromDisk();
  }

  return cachedTemplateDataUrl;
}

export async function loadBrevetCertificateTemplate(): Promise<string> {
  if (cachedTemplateDataUrl) {
    return cachedTemplateDataUrl;
  }

  if (typeof window === "undefined") {
    cachedTemplateDataUrl = readTemplateFromDisk();
    return cachedTemplateDataUrl;
  }

  const response = await fetch("/uploads/certificat.jpeg");
  if (!response.ok) {
    throw new Error("Impossible de charger le modele de certificat");
  }

  const blob = await response.blob();
  cachedTemplateDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lecture du modele de certificat impossible"));
    reader.readAsDataURL(blob);
  });

  return cachedTemplateDataUrl;
}
