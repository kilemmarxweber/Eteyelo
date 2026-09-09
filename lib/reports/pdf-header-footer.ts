import type jsPDF from "jspdf";
import { pdfFontsFromContext } from "@/lib/reports/pdf-font-scale";
import type { SchoolReportContext } from "@/lib/reports/types";
import {
  documentChrome,
  formatDocumentDateTime,
} from "@/lib/reports/document-locale";

/**
 * Marge haute de secours (autotable). Préférer la valeur renvoyée par
 * `drawReportHeader` quand elle est disponible.
 * Aligné sur l’en-tête horizontal (logo à gauche + identité).
 */
export const REPORT_HEADER_CONTENT_TOP_MM = 58;

/** Marge haute des pages suivantes quand l’en-tête n’est dessiné que sur la 1re page. */
export const REPORT_CONTINUATION_CONTENT_TOP_MM = 12;

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

function detectImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function schoolInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * En-tête document : logo à gauche, identité au même niveau, puis titre + meta.
 * Aligné sur `SchoolBrandHeader` (aperçu HTML = PDF).
 * @returns Y (mm) où le corps du document doit commencer.
 */
export function drawReportHeader(
  doc: jsPDF,
  context: SchoolReportContext,
  options: DrawReportHeaderOptions,
): number {
  const fonts = pdfFontsFromContext(context);
  const chrome = documentChrome(context.locale);
  const pageWidth = doc.internal.pageSize.getWidth();
  const { title, subtitle, details = [], logoDataUrl } = options;
  const marginX = 14;
  const logoSize = 18;
  const logoX = marginX;
  const logoY = 10;
  const textX = logoX + logoSize + 5;
  const textMaxWidth = pageWidth - textX - marginX;

  if (logoDataUrl) {
    try {
      doc.addImage(
        logoDataUrl,
        detectImageFormat(logoDataUrl),
        logoX,
        logoY,
        logoSize,
        logoSize,
      );
    } catch {
      try {
        doc.addImage(logoDataUrl, logoX, logoY, logoSize, logoSize);
      } catch {
        // ignore
      }
    }
  } else {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fonts.meta);
    doc.setTextColor(100, 116, 139);
    doc.text(
      schoolInitials(context.schoolName || "E") || "E",
      logoX + logoSize / 2,
      logoY + logoSize / 2 + 1.5,
      { align: "center" },
    );
  }

  let textY = logoY + 5;

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fonts.school);
  doc.text(context.schoolName || chrome.establishment, textX, textY, {
    maxWidth: textMaxWidth,
  });
  textY += 5;

  if (subtitle?.trim() && subtitle.trim() !== (context.schoolName || "").trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fonts.subtitle);
    doc.setTextColor(71, 85, 105);
    doc.text(subtitle.trim(), textX, textY, {
      maxWidth: textMaxWidth,
    });
    textY += 4;
  }

  const contactLine = [context.address, context.phone, context.email]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");

  if (contactLine) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(fonts.meta);
    doc.text(contactLine, textX, textY, {
      maxWidth: textMaxWidth,
    });
    textY += 3.8;
  }

  if (context.academicYearLabel) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(fonts.meta);
    doc.text(`${chrome.academicYear} : ${context.academicYearLabel}`, textX, textY, {
      maxWidth: textMaxWidth,
    });
    textY += 3.8;
  }

  let y = Math.max(logoY + logoSize, textY) + 3;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(fonts.title);
  doc.text(title, pageWidth / 2, y, {
    align: "center",
    maxWidth: pageWidth - marginX * 2,
  });
  y += 5.5;

  const meta = [
    ...details,
    context.generatedAt
      ? `${chrome.generatedAt} ${formatDocumentDateTime(context.generatedAt, context.locale)}`
      : "",
  ]
    .filter(Boolean)
    .join("  ·  ");

  if (meta) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(fonts.meta);
    doc.text(meta, pageWidth / 2, y, {
      align: "center",
      maxWidth: pageWidth - marginX * 2,
    });
    y += 4.5;
  }

  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);

  return y + 5;
}

/**
 * Pied de page : nom établissement à gauche, pagination à droite.
 */
export function drawReportFooter(
  doc: jsPDF,
  context: SchoolReportContext,
  options: DrawReportFooterOptions = {},
): void {
  const fonts = pdfFontsFromContext(context);
  const chrome = documentChrome(context.locale);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const {
    pageNumber,
    totalPages,
    leftText = context.schoolName,
  } = options;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fonts.footer);
  doc.setTextColor(100);

  if (leftText) {
    doc.text(leftText, 14, pageHeight - 6);
  }

  if (pageNumber != null && totalPages != null) {
    doc.text(`${chrome.page} ${pageNumber} / ${totalPages}`, pageWidth - 14, pageHeight - 6, {
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
