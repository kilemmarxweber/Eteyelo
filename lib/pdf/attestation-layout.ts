import jsPDF from "jspdf";

import {
  finalizePdfDocument,
  formatFrenchDate,
  safePdfFilePart,
  downloadPdfOutput,
  type PdfOutput,
} from "@/lib/pdf/pdf-engine";

export type AttestationPdfInput = {
  organizationName: string;
  branchName: string;
  schoolYearName?: string | null;
  studentName: string;
  username?: string | null;
  sourceBranchName?: string | null;
  groupName?: string | null;
  workshopName?: string | null;
  issuedAt?: Date;
};

export function buildAttestationPdfDoc(input: AttestationPdfInput) {
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
  doc.setFontSize(18);
  doc.setTextColor(30, 64, 175);
  doc.text("ATTESTATION DE PARTICIPATION", pageWidth / 2, 48, {
    align: "center",
  });

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  const lines = [
    "Nous soussignes certifions que",
    input.studentName.toUpperCase(),
    input.username ? `Matricule : ${input.username}` : null,
    input.sourceBranchName
      ? `Etablissement scolaire d'origine : ${input.sourceBranchName}`
      : null,
    input.workshopName
      ? `Atelier / module : ${input.workshopName}`
      : "Atelier pratique",
    input.groupName ? `Groupe : ${input.groupName}` : null,
    input.schoolYearName ? `Annee : ${input.schoolYearName}` : null,
    "a participe aux activites pratiques organisees par notre atelier.",
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
  doc.text(`Fait le ${dateLabel}`, pageWidth / 2, y + 16, { align: "center" });
  doc.setFontSize(10);
  doc.text("Le responsable de l'atelier", 30, 250);
  doc.text("Le directeur", pageWidth - 30, 250, { align: "right" });

  return doc;
}

export function createAttestationPdfOutput(input: AttestationPdfInput): PdfOutput {
  const fileName = `attestation-${safePdfFilePart(input.studentName || "eleve")}.pdf`;
  return finalizePdfDocument(buildAttestationPdfDoc(input), fileName);
}

export function generateAttestationPdf(input: AttestationPdfInput) {
  downloadPdfOutput(createAttestationPdfOutput(input));
}
