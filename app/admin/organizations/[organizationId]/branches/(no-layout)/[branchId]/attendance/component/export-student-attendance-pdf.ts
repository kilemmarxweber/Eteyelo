import autoTable from "jspdf-autotable";

import {
  createBrandedReportDoc,
  finishBrandedReport,
  reportHeaderOnLaterPages,
  reportTableMargin,
  REPORT_TABLE_BASE,
} from "@/lib/reports/report-pdf-kit";
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

  const { doc, contentTop, marginX, usableWidth, headerOptions, context: ctx } =
    await createBrandedReportDoc(context, {
      title,
      details: [
        ...filterLabels,
        isEmpty ? emptyMessage : formatSummaryLine(report.summary),
      ],
    });

  const onLaterPages = reportHeaderOnLaterPages(doc, ctx, headerOptions);
  const tableMargin = reportTableMargin(contentTop, marginX);

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
    startY: contentTop,
    margin: tableMargin,
    tableWidth: usableWidth,
    head: [summaryHead],
    body: summaryBody,
    ...REPORT_TABLE_BASE,
    styles: {
      ...REPORT_TABLE_BASE.styles,
      fontSize: 9,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      halign: "center",
    },
    didDrawPage: onLaterPages,
  });

  if (includeDetail) {
    const detailStartY =
      (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ??
      contentTop;

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
      startY: detailStartY + 8,
      margin: tableMargin,
      tableWidth: usableWidth,
      head: [head],
      body,
      ...REPORT_TABLE_BASE,
      columnStyles: {
        0: { cellWidth: usableWidth * 0.05,halign: "center" },
        1: { cellWidth: usableWidth * 0.28 },
        2: { cellWidth: usableWidth * 0.17 },
        3: { cellWidth: usableWidth * 0.1, halign: "center" },
        4: { cellWidth: usableWidth * 0.1,halign: "center" },
        5: { cellWidth: usableWidth * 0.1,halign: "center" },
        6: { cellWidth: usableWidth * 0.1,halign: "center" },
        7: { cellWidth: usableWidth * 0.1,halign: "center" },
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
      didDrawPage: onLaterPages,
    });
  }

  finishBrandedReport(doc, ctx);
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
