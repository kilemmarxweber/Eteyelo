import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import type {
  StudentAttendanceDetailRow,
  StudentAttendanceReport,
  StudentAttendanceStatusCounts,
} from "../attendance.action";

export type StudentAttendanceReportOptions = {
  emptyMessage?: string;
  /** Inclure le détail par élève (défaut : true). */
  includeDetail?: boolean;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatReportDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("fr-FR");
}

function formatPeriodLabel(dateStart: string, dateEnd: string): string {
  return `${formatReportDate(dateStart)} → ${formatReportDate(dateEnd)}`;
}

function formatSummaryLine(summary: StudentAttendanceStatusCounts): string {
  return `Présents ${summary.present} · Absents ${summary.absent} · Retards ${summary.late} · Excusés ${summary.excused} (total ${summary.total})`;
}

/** Titre PDF aligné sur les filtres UI. */
export function buildStudentAttendanceReportTitle(
  report: Pick<StudentAttendanceReport, "classeName">,
): string {
  const classeName = report.classeName?.trim();
  if (classeName) {
    return `Présences élèves — ${classeName}`;
  }
  return "Présences élèves";
}

/** Libellés des filtres actifs (sous-titre / métadonnées). */
export function buildStudentAttendanceReportFilterLabels(
  report: Pick<
    StudentAttendanceReport,
    "dateStart" | "dateEnd" | "classeName"
  >,
): string[] {
  const labels: string[] = [
    `Période : ${formatPeriodLabel(report.dateStart, report.dateEnd)}`,
  ];
  const classeName = report.classeName?.trim();
  if (classeName) {
    labels.push(`Classe : ${classeName}`);
  }
  return labels;
}

function buildReportFileName(
  report: Pick<StudentAttendanceReport, "classeName" | "dateStart" | "dateEnd">,
): string {
  const parts = ["presences-eleves"];
  const classeName = report.classeName?.trim();
  if (classeName) parts.push(safeFilePart(classeName));
  parts.push(formatReportDate(report.dateStart).replace(/\//g, "-"));
  parts.push(formatReportDate(report.dateEnd).replace(/\//g, "-"));
  return parts.join("-");
}

export async function buildStudentAttendanceReportPdf(
  report: StudentAttendanceReport,
  context: SchoolReportContext,
  options: StudentAttendanceReportOptions = {},
) {
  const includeDetail = options.includeDetail !== false;
  const title = buildStudentAttendanceReportTitle(report);
  const filterLabels = buildStudentAttendanceReportFilterLabels(report);
  const emptyMessage =
    options.emptyMessage?.trim() ||
    "Aucune présence élève pour cette période.";

  const details = report.details;
  const isEmpty = details.length === 0 || report.summary.total === 0;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const summaryHead = ["Présents", "Absents", "Retards", "Excusés", "Total"];
  const summaryBody = [
    [
      String(report.summary.present),
      String(report.summary.absent),
      String(report.summary.late),
      String(report.summary.excused),
      String(report.summary.total),
    ],
  ];

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: 10,
      bottom: 14,
      left: 10,
    },
    head: [summaryHead],
    body: summaryBody,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.5,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details: [
          ...filterLabels,
          isEmpty ? emptyMessage : formatSummaryLine(report.summary),
        ],
        logoDataUrl: logo,
      });
    },
  });

  if (includeDetail) {
    const detailStartY =
      (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY ?? REPORT_HEADER_CONTENT_TOP_MM;

    const head = [
      "#",
      "Élève",
      "Classe",
      "Présents",
      "Absents",
      "Retards",
      "Excusés",
      "Total",
    ];

    const body: string[][] = isEmpty
      ? [[emptyMessage, "", "", "", "", "", "", ""]]
      : details.map((row: StudentAttendanceDetailRow, index) => [
          String(index + 1),
          row.studentName,
          row.classeName,
          String(row.present),
          String(row.absent),
          String(row.late),
          String(row.excused),
          String(row.total),
        ]);

    autoTable(doc, {
      startY: detailStartY + 6,
      margin: {
        top: REPORT_HEADER_CONTENT_TOP_MM,
        right: 10,
        bottom: 14,
        left: 10,
      },
      head: [head],
      body,
      theme: "grid",
      showHead: "everyPage",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 70 },
        2: { cellWidth: 40 },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 24, halign: "center" },
        5: { cellWidth: 24, halign: "center" },
        6: { cellWidth: 24, halign: "center" },
        7: { cellWidth: 24, halign: "center" },
      },
      didParseCell: (data) => {
        if (isEmpty && data.section === "body") {
          if (data.column.index === 0) {
            data.cell.colSpan = 8;
            data.cell.styles.halign = "center";
            data.cell.styles.fontStyle = "italic";
            data.cell.styles.textColor = [100, 116, 139];
          } else {
            data.cell.styles.cellWidth = 0;
            data.cell.text = [];
          }
        }
      },
      didDrawPage: () => {
        drawReportHeader(doc, context, {
          title,
          subtitle: context.branchName,
          details: [
            ...filterLabels,
            isEmpty ? emptyMessage : formatSummaryLine(report.summary),
          ],
          logoDataUrl: logo,
        });
      },
    });
  }

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  return doc;
}

export async function exportStudentAttendanceReportPdf(
  report: StudentAttendanceReport,
  context: SchoolReportContext,
  options: StudentAttendanceReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(report);
  const doc = await buildStudentAttendanceReportPdf(report, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
