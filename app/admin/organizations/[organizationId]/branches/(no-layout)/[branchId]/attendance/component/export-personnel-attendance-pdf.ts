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
  PersonnelAttendanceDetailRow,
  PersonnelAttendanceReport,
  StudentAttendanceStatusCounts,
} from "../attendance.action";
import {
  formatPdfPeriod,
  formatPdfSummaryPresent,
  type AttendancePdfLabels,
} from "../attendance-pdf-labels";

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

function formatSummaryLine(
  labels: AttendancePdfLabels,
  summary: StudentAttendanceStatusCounts,
): string {
  return formatPdfSummaryPresent(labels, summary);
}

export function buildPersonnelAttendanceReportTitle(
  labels: AttendancePdfLabels,
): string {
  return labels.personnelAttendanceTitle;
}

export function buildPersonnelAttendanceReportFilterLabels(
  labels: AttendancePdfLabels,
  report: Pick<PersonnelAttendanceReport, "dateStart" | "dateEnd">,
): string[] {
  return [
    formatPdfPeriod(
      labels,
      formatReportDate(report.dateStart),
      formatReportDate(report.dateEnd),
    ),
  ];
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
  labels: AttendancePdfLabels,
  options: PersonnelAttendanceReportOptions = {},
) {
  const includeDetail = options.includeDetail !== false;
  const title = buildPersonnelAttendanceReportTitle(labels);
  const filterLabels = buildPersonnelAttendanceReportFilterLabels(labels, report);
  const emptyMessage =
    options.emptyMessage?.trim() || labels.emptyPersonnel;

  const details = report.details;
  const isEmpty = details.length === 0 || report.summary.total === 0;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const summaryHead = [
    labels.columns.present,
    labels.columns.absent,
    labels.columns.late,
    labels.columns.excused,
    labels.columns.total,
  ];
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
          isEmpty ? emptyMessage : formatSummaryLine(labels, report.summary),
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
      labels.columns.index,
      labels.columns.personnel,
      labels.columns.present,
      labels.columns.absent,
      labels.columns.late,
      labels.columns.excused,
      labels.columns.total,
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
        0: { cellWidth: 12,halign: "center" },
        1: { cellWidth: 90 },
        2: { cellWidth: 28,halign: "center" },
        3: { cellWidth: 28, halign: "center" },
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
            isEmpty ? emptyMessage : formatSummaryLine(labels, report.summary),
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

export async function exportPersonnelAttendanceReportPdf(
  report: PersonnelAttendanceReport,
  context: SchoolReportContext,
  labels: AttendancePdfLabels,
  options: PersonnelAttendanceReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(report);
  const doc = await buildPersonnelAttendanceReportPdf(
    report,
    context,
    labels,
    options,
  );
  doc.save(`${reportName}-${date}.pdf`);
}
