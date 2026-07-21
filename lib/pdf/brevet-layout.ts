import jsPDF from "jspdf";

import {
  loadBrevetCertificateTemplate,
  getBrevetCertificateTemplateDataUrlSync,
} from "@/lib/pdf/brevet-certificate-template";
import {
  downloadPdfOutput,
  finalizePdfDocument,
  formatFrenchDateNumeric,
  safePdfFilePart,
  type PdfOutput,
} from "@/lib/pdf/pdf-engine";

export type BrevetPdfInput = {
  organizationName: string;
  branchName: string;
  branchCode?: string | null;
  branchCity?: string | null;
  schoolYearName?: string | null;
  studentName: string;
  username?: string | null;
  programmeName?: string | null;
  sessionName?: string | null;
  brevetNumber: string;
  issuedAt?: Date;
  placeOfBirth?: string | null;
  dateOfBirth?: Date | null;
  sexe?: string | null;
  trainingStartDate?: Date | null;
  trainingEndDate?: Date | null;
};

function formatSpacedCertificateDate(date: Date) {
  return formatFrenchDateNumeric(date).replace(/\//g, " / ");
}

function bornLabel(sexe?: string | null) {
  if (sexe === "feminin") return "Née";
  if (sexe === "masculin") return "Né";
  return "Né(e)";
}

function learnerEvaluationLine(sexe?: string | null) {
  if (sexe === "feminin") {
    return "L'apprenante a été évaluée sur base des Examens théoriques, Projets pratiques, et Stages en entreprise.";
  }
  if (sexe === "masculin") {
    return "L'apprenant a été évalué sur base des Examens théoriques, Projets pratiques, et Stages en entreprise.";
  }
  return "L'apprenant(e) a été évalué(e) sur base des Examens théoriques, Projets pratiques, et Stages en entreprise.";
}

function buildCertificateParagraphs(input: BrevetPdfInput): string[] {
  const studentName = input.studentName.trim().toUpperCase();
  const placeOfBirth = (input.placeOfBirth?.trim() || "………………").toUpperCase();
  const birthDate = input.dateOfBirth
    ? formatFrenchDateNumeric(input.dateOfBirth)
    : "………………";
  const programme = (input.programmeName?.trim() || "formation professionnelle").toLowerCase();
  const branchCity = input.branchCity?.trim();
  const cityPart = branchCity ? ` de ${branchCity}` : "";
  const trainingStart = input.trainingStartDate
    ? formatSpacedCertificateDate(input.trainingStartDate)
    : "………………";
  const trainingEnd = input.trainingEndDate
    ? formatSpacedCertificateDate(input.trainingEndDate)
    : "………………";

  return [
    `Nous certifions que ${studentName}, ${bornLabel(input.sexe)} à ${placeOfBirth}, le ${birthDate}, a suivi avec succès la formation technique en ${programme} au sein du ${input.branchName}${cityPart}, qui s'est déroulée du ${trainingStart} au ${trainingEnd}.`,
    learnerEvaluationLine(input.sexe),
    "Nous lui remettons ce document pour servir et valoir ce que de droit.",
  ];
}

function coverArea(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, width, height, "F");
}

function writeCertificateBody(
  doc: jsPDF,
  paragraphs: string[],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  let cursorY = y;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);

  for (const [index, paragraph] of paragraphs.entries()) {
    const lines = doc.splitTextToSize(paragraph, maxWidth) as string[];
    doc.text(lines, x, cursorY, { align: "left", maxWidth });
    cursorY += lines.length * lineHeight + (index < paragraphs.length - 1 ? 4 : 0);
  }
}

export function buildBrevetPdfDoc(
  input: BrevetPdfInput,
  templateDataUrl: string,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.addImage(templateDataUrl, "JPEG", 0, 0, pageWidth, pageHeight);

  const bodyLeft = pageWidth * 0.115;
  const bodyTop = pageHeight * 0.335;
  const bodyWidth = pageWidth * 0.77;
  const bodyHeight = pageHeight * 0.36;

  coverArea(doc, bodyLeft - 2, bodyTop - 4, bodyWidth + 4, bodyHeight);

  writeCertificateBody(
    doc,
    buildCertificateParagraphs(input),
    bodyLeft,
    bodyTop,
    bodyWidth,
    5.5,
  );

  return doc;
}

export function createBrevetPdfOutputSync(input: BrevetPdfInput): PdfOutput {
  const templateDataUrl = getBrevetCertificateTemplateDataUrlSync();
  const fileName = `certificat-${safePdfFilePart(input.brevetNumber || input.studentName)}.pdf`;
  return finalizePdfDocument(buildBrevetPdfDoc(input, templateDataUrl), fileName);
}

export async function createBrevetPdfOutput(input: BrevetPdfInput): Promise<PdfOutput> {
  const templateDataUrl = await loadBrevetCertificateTemplate();
  const fileName = `certificat-${safePdfFilePart(input.brevetNumber || input.studentName)}.pdf`;
  return finalizePdfDocument(buildBrevetPdfDoc(input, templateDataUrl), fileName);
}

export async function generateBrevetPdf(input: BrevetPdfInput) {
  downloadPdfOutput(await createBrevetPdfOutput(input));
}

export function buildCertificateParagraphsForTest(input: BrevetPdfInput) {
  return buildCertificateParagraphs(input);
}
