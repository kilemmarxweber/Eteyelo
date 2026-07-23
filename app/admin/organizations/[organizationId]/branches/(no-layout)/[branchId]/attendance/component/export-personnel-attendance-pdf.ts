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
  PersonnelAttendanceDetailRow,
  PersonnelAttendanceReport,
  StudentAttendanceStatusCounts,
} from "../attendance.action";

export type PersonnelAttendanceReportOptions = {
  emptyMessage?: string;
  /** Inclure le détail par personnel (défaut : true). */
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

export function buildPersonnelAttendanceReportTitle(): string {
  return "Présences personnel";
}

export function buildPersonnelAttendanceReportFilterLabels(
  report: Pick<PersonnelAttendanceReport, "dateStart" | "dateEnd">,
): string[] {
  return [`Période : ${formatPeriodLabel(report.dateStart, report.dateEnd)}`];
}

function buildReportFileName(
  report: Pick<PersonnelAttendanceReport, "dateStart" | "dateEnd">,
): string {
  return [
    "presences-personnel",
    formatReportDate(report.dateStart).replace(/\//g, "-"),
    formatReportDate(report.dateEnd).replace(/\//g, "-"),
  ].join("-");
}

export async function buildPersonnelAttendanceReportPdf(
  report: PersonnelAttendanceReport,
  context: SchoolReportContext,
  options: PersonnelAttendanceReportOptions = {},
) {
  const includeDetail = options.includeDetail !== false;
  const title = buildPersonnelAttendanceReportTitle();
  const filterLabels = buildPersonnelAttendanceReportFilterLabels(report);
  const emptyMessage =
    options.emptyMessage?.trim() ||
    "Aucune présence personnel pour cette période.";

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
      "Personnel",
      "Présents",
      "Absents",
      "Retards",
      "Excusés",
      "Total",
    ];

    const body: string[][] = isEmpty
      ? [[emptyMessage, "", "", "", "", "", ""]]
      : details.map((row: PersonnelAttendanceDetailRow, index) => [
          String(index + 1),
          row.personnelName,
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
        0: { cellWidth: usableWidth * 0.06,halign: "center" },
        1: { cellWidth: usableWidth * 0.4 },
        2: { cellWidth: usableWidth * 0.108,halign: "center" },
        3: { cellWidth: usableWidth * 0.108,halign: "center" },
        4: { cellWidth: usableWidth * 0.108,halign: "center" },
        5: { cellWidth: usableWidth * 0.108,halign: "center" },
        6: { cellWidth: usableWidth * 0.108,halign: "center" },
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
      didDrawPage: onLaterPages,
    });
  }

  finishBrandedReport(doc, ctx);
  return doc;
}

export async function exportPersonnelAttendanceReportPdf(
  report: PersonnelAttendanceReport,
  context: SchoolReportContext,
  options: PersonnelAttendanceReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(report);
  const doc = await buildPersonnelAttendanceReportPdf(report, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
