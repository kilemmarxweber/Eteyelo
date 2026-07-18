import jsPDF from "jspdf";

import {
  downloadPdfOutput,
  finalizePdfDocument,
  formatFrenchDate,
  safePdfFilePart,
  type PdfOutput,
} from "@/lib/pdf/pdf-engine";

export type BrevetPdfInput = {
  organizationName: string;
  branchName: string;
  branchCode?: string | null;
  schoolYearName?: string | null;
  studentName: string;
  username?: string | null;
  programmeName?: string | null;
  sessionName?: string | null;
  brevetNumber: string;
  issuedAt?: Date;
};

export function buildBrevetPdfDoc(input: BrevetPdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const issuedAt = input.issuedAt ?? new Date();
  const dateLabel = formatFrenchDate(issuedAt);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(input.organizationName, pageWidth / 2, 24, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(input.branchName, pageWidth / 2, 31, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(22, 101, 52);
  doc.text("BREVET DE FORMATION", pageWidth / 2, 48, { align: "center" });

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  const lines = [
    "Le centre de formation certifie que",
    input.studentName.toUpperCase(),
    input.username ? `Matricule : ${input.username}` : null,
    input.programmeName ? `Programme : ${input.programmeName}` : null,
    input.sessionName ? `Session : ${input.sessionName}` : null,
    input.schoolYearName ? `Annee : ${input.schoolYearName}` : null,
    "a suivi avec succes la formation et merite la presente attestation.",
    `Numero de brevet : ${input.brevetNumber}`,
  ].filter(Boolean) as string[];

  let y = 68;
  for (const line of lines) {
    const isName = line === input.studentName.toUpperCase();
    doc.setFont("helvetica", isName ? "bold" : "normal");
    doc.setFontSize(isName ? 14 : 12);
    doc.text(line, pageWidth / 2, y, { align: "center", maxWidth: 170 });
    y += isName ? 12 : 8;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Delivre le ${dateLabel}`, pageWidth / 2, y + 16, { align: "center" });
  doc.text("Le formateur referent", 30, 250);
  doc.text("Le directeur du centre", pageWidth - 30, 250, { align: "right" });

  return doc;
}

export function createBrevetPdfOutput(input: BrevetPdfInput): PdfOutput {
  const fileName = `brevet-${safePdfFilePart(input.brevetNumber || input.studentName)}.pdf`;
  return finalizePdfDocument(buildBrevetPdfDoc(input), fileName);
}

export function generateBrevetPdf(input: BrevetPdfInput) {
  downloadPdfOutput(createBrevetPdfOutput(input));
}
