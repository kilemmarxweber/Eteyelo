import type jsPDF from "jspdf";
import type { SchoolReportContext } from "@/lib/reports/types";

/** Marge haute recommandée pour le corps (autotable `startY` / `margin.top`). */
export const REPORT_HEADER_CONTENT_TOP_MM = 37;

export type DrawReportHeaderOptions = {
  title: string;
  /** Ligne secondaire sous le nom (ex. nom de branche). */
  subtitle?: string;
  /** Métadonnées additionnelles (compteurs, période, etc.). */
  details?: string[];
  logoDataUrl?: string | null;
};

export type DrawReportFooterOptions = {
  pageNumber?: number;
  totalPages?: number;
  leftText?: string;
};

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
}

/**
 * En-tête standard : logo + établissement + adresse + titre + meta.
 * Aligné sur le style de l'export élèves / caisse.
 */
export function drawReportHeader(
  doc: jsPDF,
  context: SchoolReportContext,
  options: DrawReportHeaderOptions,
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const { title, subtitle, details = [], logoDataUrl } = options;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 12, 8, 18, 18);
    } catch {
      // Un logo invalide ne doit pas empêcher la production du rapport.
    }
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(context.schoolName || "Eteyelo", pageWidth / 2, 10, {
    align: "center",
  });

  let y = 16;
  if (subtitle?.trim()) {
    doc.setFontSize(11);
    doc.text(subtitle.trim(), pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  const contactLine = [context.address, context.phone]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("  ·  ");

  if (contactLine) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.text(contactLine, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(15);
  doc.text(title, pageWidth / 2, Math.max(y, 24), { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  const meta = [
    context.academicYearLabel
      ? `Année scolaire : ${context.academicYearLabel}`
      : "",
    ...details,
    context.generatedAt
      ? `Généré le ${formatGeneratedAt(context.generatedAt)}`
      : "",
  ]
    .filter(Boolean)
    .join("  |  ");

  if (meta) {
    doc.text(meta, pageWidth / 2, 30, { align: "center" });
  }

  doc.setDrawColor(191, 219, 254);
  doc.line(10, 33, pageWidth - 10, 33);
}

/**
 * Pied de page : nom établissement à gauche, pagination à droite.
 */
export function drawReportFooter(
  doc: jsPDF,
  context: SchoolReportContext,
  options: DrawReportFooterOptions = {},
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const {
    pageNumber,
    totalPages,
    leftText = context.schoolName,
  } = options;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100);

  if (leftText) {
    doc.text(leftText, 10, pageHeight - 6);
  }

  if (pageNumber != null && totalPages != null) {
    doc.text(`Page ${pageNumber} / ${totalPages}`, pageWidth - 10, pageHeight - 6, {
      align: "right",
    });
  }
}

/** Applique le pied de page sur toutes les pages du document. */
export function drawReportFooterOnAllPages(
  doc: jsPDF,
  context: SchoolReportContext,
  options: Omit<DrawReportFooterOptions, "pageNumber" | "totalPages"> = {},
): void {
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawReportFooter(doc, context, {
      ...options,
      pageNumber: page,
      totalPages,
    });
  }
}
