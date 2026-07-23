import jsPDF from "jspdf";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  type DrawReportHeaderOptions,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";

export type BrandedReportDoc = {
  doc: jsPDF;
  contentTop: number;
  marginX: number;
  usableWidth: number;
  pageWidth: number;
  headerOptions: DrawReportHeaderOptions;
  context: SchoolReportContext;
};

export type CreateBrandedReportOptions = {
  title: string;
  details?: string[];
  subtitle?: string;
  orientation?: "portrait" | "landscape";
};

/**
 * Crée un PDF A4 brandé : charge le logo, dessine l'en-tête page 1,
 * retourne la marge haute réelle (anti-chevauchement).
 */
export async function createBrandedReportDoc(
  context: SchoolReportContext,
  options: CreateBrandedReportOptions,
): Promise<BrandedReportDoc> {
  const orientation = options.orientation ?? "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - marginX * 2;
  const logoDataUrl = await imageUrlToDataUrl(context.logoUrl);

  const headerOptions: DrawReportHeaderOptions = {
    title: options.title,
    subtitle: options.subtitle ?? context.branchName,
    details: options.details ?? [],
    logoDataUrl,
  };

  const contentTop = drawReportHeader(doc, context, headerOptions);

  return {
    doc,
    contentTop,
    marginX,
    usableWidth,
    pageWidth,
    headerOptions,
    context,
  };
}

export function reportTableMargin(contentTop: number, marginX = 14) {
  return {
    top: contentTop,
    right: marginX,
    bottom: 16,
    left: marginX,
  };
}

/** Styles tableau partagés (listes A4). */
export const REPORT_TABLE_BASE = {
  theme: "striped" as const,
  showHead: "everyPage" as const,
  styles: {
    font: "helvetica" as const,
    fontSize: 8,
    cellPadding: { top: 2.8, right: 2, bottom: 2.8, left: 2 },
    overflow: "linebreak" as const,
    valign: "middle" as const,
    lineColor: [226, 232, 240] as [number, number, number],
    lineWidth: 0.2,
    textColor: [30, 41, 59] as [number, number, number],
  },
  headStyles: {
    fillColor: [30, 64, 175] as [number, number, number],
    textColor: 255,
    fontStyle: "bold" as const,
    halign: "center" as const,
    fontSize: 8,
    cellPadding: { top: 3.2, right: 2, bottom: 3.2, left: 2 },
  },
  alternateRowStyles: {
    fillColor: [248, 250, 252] as [number, number, number],
  },
};

export function reportHeaderOnLaterPages(
  doc: jsPDF,
  context: SchoolReportContext,
  headerOptions: DrawReportHeaderOptions,
) {
  return (data: { pageNumber: number }) => {
    if (data.pageNumber > 1) {
      drawReportHeader(doc, context, headerOptions);
    }
  };
}

export function finishBrandedReport(
  doc: jsPDF,
  context: SchoolReportContext,
) {
  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });
}

/** Répartit des fractions (somme ≈ 1) sur une largeur utile. */
export function columnWidthsFromFractions(
  usableWidth: number,
  fractions: number[],
): number[] {
  return fractions.map((fraction) => usableWidth * fraction);
}
