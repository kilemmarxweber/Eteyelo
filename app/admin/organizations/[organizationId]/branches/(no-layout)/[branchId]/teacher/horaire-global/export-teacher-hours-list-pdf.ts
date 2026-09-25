import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_CONTINUATION_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import { pdfFontsFromContext } from "@/lib/reports/pdf-font-scale";
import { SCHEDULE_PDF_MARGIN_BOTTOM_MM } from "@/lib/reports/schedule-pdf-layout";
import { safePdfFilePart } from "@/lib/pdf/pdf-engine";
import type { SchoolReportContext } from "@/lib/reports/types";

export type TeacherHoursListRow = {
  name: string;
  details: string;
};

type TeacherHoursListPdfInput = {
  context: SchoolReportContext;
  title: string;
  details?: string[];
  yearLabel: string;
  teacherColumn: string;
  loadColumn: string;
  rows: TeacherHoursListRow[];
};

const HEADER_BLUE: [number, number, number] = [30, 64, 175];
const ROW_ALT: [number, number, number] = [239, 246, 255];
const GRID_LINE: [number, number, number] = [191, 219, 254];
const TEXT_MAIN: [number, number, number] = [15, 23, 42];

export async function exportTeacherHoursListPdf(
  input: TeacherHoursListPdfInput,
) {
  const {
    context,
    title,
    details = [],
    yearLabel,
    teacherColumn,
    loadColumn,
    rows,
  } = input;
  const fonts = pdfFontsFromContext(context);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const tableWidth = pageWidth - marginX * 2;

  const headerDetails = [
    ...details,
    context.academicYearLabel
      ? yearLabel.replace("{year}", context.academicYearLabel)
      : "",
  ].filter(Boolean);

  const drawHeader = () =>
    drawReportHeader(doc, context, {
      title,
      subtitle: context.branchName,
      details: headerDetails,
      logoDataUrl: logo,
    });

  const headerBottomY = drawHeader();

  autoTable(doc, {
    startY: headerBottomY,
    head: [[teacherColumn, loadColumn]],
    body: rows.map((row) => [row.name, row.details]),
    theme: "grid",
    showHead: "everyPage",
    tableWidth,
    margin: {
      top: REPORT_CONTINUATION_CONTENT_TOP_MM,
      left: marginX,
      right: marginX,
      bottom: SCHEDULE_PDF_MARGIN_BOTTOM_MM,
    },
    columnStyles: {
      0: { cellWidth: tableWidth * 0.32, fontStyle: "bold", halign: "left" },
      1: { cellWidth: tableWidth * 0.68, halign: "left" },
    },
    styles: {
      font: "helvetica",
      fontSize: fonts.body,
      cellPadding: 2.2,
      valign: "middle",
      textColor: TEXT_MAIN,
      lineColor: GRID_LINE,
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: HEADER_BLUE,
      textColor: 255,
      fontStyle: "bold",
      fontSize: fonts.head,
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: ROW_ALT,
    },
    didDrawPage: () => {
      drawHeader();
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  doc.save(`horaire-heures-${safePdfFilePart(title)}.pdf`);
}
