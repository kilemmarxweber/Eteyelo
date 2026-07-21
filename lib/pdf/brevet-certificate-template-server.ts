import "server-only";

let cachedTemplateDataUrl: string | null = null;

function readTemplateFromDisk(): string {
  const fs = require("node:fs") as typeof import("node:fs");
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
