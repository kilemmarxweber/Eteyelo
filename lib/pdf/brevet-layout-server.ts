import "server-only";

import {
  buildBrevetPdfDoc,
  type BrevetPdfInput,
} from "@/lib/pdf/brevet-layout";
import { getBrevetCertificateTemplateDataUrlSync } from "@/lib/pdf/brevet-certificate-template-server";
import {
  finalizePdfDocument,
  safePdfFilePart,
  type PdfOutput,
} from "@/lib/pdf/pdf-engine";

export function createBrevetPdfOutputSync(input: BrevetPdfInput): PdfOutput {
  const templateDataUrl = getBrevetCertificateTemplateDataUrlSync();
  const fileName = `certificat-${safePdfFilePart(input.brevetNumber || input.studentName)}.pdf`;
  return finalizePdfDocument(buildBrevetPdfDoc(input, templateDataUrl), fileName);
}
