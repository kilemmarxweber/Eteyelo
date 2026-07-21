import type jsPDF from "jspdf";

export type PdfOutput = {
  blob: Blob;
  blobUrl: string;
  fileName: string;
  arrayBuffer: ArrayBuffer;
};

export function safePdfFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function finalizePdfDocument(doc: jsPDF, fileName: string): PdfOutput {
  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });

  return {
    blob,
    blobUrl: URL.createObjectURL(blob),
    fileName,
    arrayBuffer,
  };
}

export function downloadPdfOutput(output: PdfOutput) {
  const link = document.createElement("a");
  link.href = output.blobUrl;
  link.download = output.fileName;
  link.click();
}

export function printPdfOutput(output: PdfOutput) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = output.blobUrl;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => {
      iframe.remove();
    }, 1000);
  };
}

export function revokePdfOutput(output: PdfOutput | null | undefined) {
  if (output?.blobUrl) {
    URL.revokeObjectURL(output.blobUrl);
  }
}

export async function pdfOutputToBase64(output: PdfOutput): Promise<string> {
  const bytes = new Uint8Array(output.arrayBuffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function formatFrenchDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatFrenchDateNumeric(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
