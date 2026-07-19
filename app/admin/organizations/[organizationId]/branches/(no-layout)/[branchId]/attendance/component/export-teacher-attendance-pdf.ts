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
  StudentAttendanceStatusCounts,
  TeacherAttendanceDetailRow,
  TeacherAttendanceReport,
} from "../attendance.action";

export type TeacherAttendanceReportOptions = {
  emptyMessage?: string;
  /** Inclure le détail par enseignant (défaut : true). */
  includeDetail?: boolean;
};

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

export function buildTeacherAttendanceReportTitle(): string {
  return "Présences enseignants";
}

export function buildTeacherAttendanceReportFilterLabels(
  report: Pick<TeacherAttendanceReport, "dateStart" | "dateEnd">,
): string[] {
  return [`Période : ${formatPeriodLabel(report.dateStart, report.dateEnd)}`];
}

function buildReportFileName(
  report: Pick<TeacherAttendanceReport, "dateStart" | "dateEnd">,
): string {
  return [
    "presences-enseignants",
    formatReportDate(report.dateStart).replace(/\//g, "-"),
    formatReportDate(report.dateEnd).replace(/\//g, "-"),
  ].join("-");
}

export async function buildTeacherAttendanceReportPdf(
  report: TeacherAttendanceReport,
  context: SchoolReportContext,
  options: TeacherAttendanceReportOptions = {},
) {
  const includeDetail = options.includeDetail !== false;
  const title = buildTeacherAttendanceReportTitle();
  const filterLabels = buildTeacherAttendanceReportFilterLabels(report);
  const emptyMessage =
    options.emptyMessage?.trim() ||
    "Aucune présence enseignant pour cette période.";

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
      "Enseignant",
      "Présents",
      "Absents",
      "Retards",
      "Excusés",
      "Total",
    ];

    const body: string[][] = isEmpty
      ? [[emptyMessage, "", "", "", "", "", ""]]
      : details.map((row: TeacherAttendanceDetailRow, index) => [
          String(index + 1),
          row.teacherName,
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
        1: { cellWidth: 90 },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 28,halign: "center" },
        4: { cellWidth: 28,halign: "center" },
        5: { cellWidth: 28,halign: "center" },
        6: { cellWidth: 28,halign: "center" },
      },
      didParseCell: (data) => {
        if (isEmpty && data.section === "body") {
          if (data.column.index === 0) {
            data.cell.colSpan = 7;
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

export async function exportTeacherAttendanceReportPdf(
  report: TeacherAttendanceReport,
  context: SchoolReportContext,
  options: TeacherAttendanceReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(report);
  const doc = await buildTeacherAttendanceReportPdf(report, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
