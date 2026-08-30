import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import { formatDurationMinutes } from "@/lib/attendance-exit";
import type {
  AttendanceDailyJournal,
  PersonRosterReport,
  TeacherSessionReport,
} from "../attendance-exit.action";
import {
  formatPdfPeriod,
  type AttendancePdfLabels,
} from "../attendance-pdf-labels";

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function formatReportDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("fr-FR");
}

export async function exportTeacherSessionReportPdf(
  report: TeacherSessionReport,
  context: SchoolReportContext,
  labels: AttendancePdfLabels,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const title = labels.teacherSessionsTitle;
  const filters = [
    formatPdfPeriod(
      labels,
      formatReportDate(report.dateStart),
      formatReportDate(report.dateEnd),
    ),
    report.teacherName
      ? labels.teacherFilter.replace("{name}", report.teacherName)
      : null,
    report.classeName
      ? labels.classFilter.replace("{name}", report.classeName)
      : null,
    fill(labels.sessionsSummary, {
      sessions: report.summary.sessions,
      duration: formatDurationMinutes(report.summary.minutesTotal),
      earlyExits: report.summary.earlyExits,
    }),
  ].filter(Boolean) as string[];

  const head = [
    labels.columns.index,
    labels.columns.date,
    labels.columns.session,
    labels.columns.teacher,
    labels.columns.subject,
    labels.columns.class,
    labels.columns.start,
    labels.columns.end,
    labels.columns.duration,
    labels.columns.status,
    labels.columns.exitReason,
  ];

  const body =
    report.rows.length === 0
      ? [[labels.noSessionPeriod, "", "", "", "", "", "", "", "", "", ""]]
      : report.rows.map((row, index) => [
          String(index + 1),
          formatReportDate(row.date),
          row.sessionLabel,
          row.teacherName,
          row.subject,
          row.classeName,
          row.actualStart ?? row.plannedStart,
          row.actualEnd ?? row.plannedEnd,
          row.minutesLabel,
          row.statusLabel,
          row.earlyExit
            ? row.exitReason || labels.earlyExitLabel
            : "—",
        ]);

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: 8,
      bottom: 14,
      left: 8,
    },
    head: [head],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 1.6,
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
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details: filters,
        logoDataUrl: logo,
      });
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(
    `rapport-seances-enseignants-${formatReportDate(report.dateStart).replace(/\//g, "-")}-${stamp}.pdf`,
  );
}

export async function exportAttendanceDailyJournalPdf(
  journal: AttendanceDailyJournal,
  context: SchoolReportContext,
  labels: AttendancePdfLabels,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const dayLabel = formatReportDate(journal.date);
  const title = labels.dailyJournalTitle;
  const details = [
    labels.dateLabel.replace("{date}", dayLabel),
    fill(labels.dailyStats, {
      sessions: journal.stats.teacherSessions,
      duration: formatDurationMinutes(journal.stats.teacherMinutes),
    }),
    fill(labels.earlyExitsStats, {
      students: journal.stats.studentEarlyExits,
      teachers: journal.stats.teacherEarlyExits,
      personnel: journal.stats.personnelEarlyExits,
    }),
  ];

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: 8,
      bottom: 14,
      left: 8,
    },
    head: [
      [
        labels.columns.session,
        labels.columns.teacher,
        labels.columns.subject,
        labels.columns.class,
        labels.columns.start,
        labels.columns.end,
        labels.columns.duration,
        labels.columns.status,
      ],
    ],
    body:
      journal.teacherSessions.length === 0
        ? [[labels.noTeacherSessionToday, "", "", "", "", "", "", ""]]
        : journal.teacherSessions.map((row) => [
            row.sessionLabel,
            row.teacherName,
            row.subject,
            row.classeName,
            row.actualStart ?? row.plannedStart,
            row.actualEnd ?? row.plannedEnd,
            row.minutesLabel,
            row.earlyExit
              ? fill(labels.exitPrefix, {
                  reason: row.exitReason || labels.earlyExitShort,
                })
              : row.statusLabel,
          ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 1.8,
      overflow: "linebreak",
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
        details,
        logoDataUrl: logo,
      });
    },
  });

  const exitStartY =
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? REPORT_HEADER_CONTENT_TOP_MM;

  autoTable(doc, {
    startY: exitStartY + 8,
    margin: { top: 20, right: 8, bottom: 14, left: 8 },
    head: [
      [
        labels.columns.type,
        labels.columns.name,
        labels.columns.context,
        labels.columns.arrival,
        labels.columns.departure,
        labels.columns.reason,
        labels.columns.status,
      ],
    ],
    body:
      journal.earlyExits.length === 0
        ? [[labels.noEarlyExit, "", "", "", "", "", ""]]
        : journal.earlyExits.map((row) => [
            labels.personType[row.personType],
            row.personName,
            row.contextLabel || "—",
            row.checkIn || "—",
            row.checkOut || "—",
            row.exitReason,
            row.statusLabel,
          ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 1.8,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [180, 83, 9],
      textColor: 255,
      fontStyle: "bold",
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  doc.save(`rapport-journalier-presence-${dayLabel.replace(/\//g, "-")}.pdf`);
}

export async function exportPersonRosterReportPdf(
  report: PersonRosterReport,
  context: SchoolReportContext,
  labels: AttendancePdfLabels,
  options: { title: string; filePrefix: string },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const filters = [
    formatPdfPeriod(
      labels,
      formatReportDate(report.dateStart),
      formatReportDate(report.dateEnd),
    ),
    report.classeName
      ? labels.classFilter.replace("{name}", report.classeName)
      : null,
    fill(labels.rosterSummary, {
      total: report.summary.total,
      present: report.summary.present,
      late: report.summary.late,
      excused: report.summary.excused,
      absent: report.summary.absent,
      earlyExits: report.summary.earlyExits,
    }),
  ].filter(Boolean) as string[];

  const head = [
    labels.columns.index,
    labels.columns.date,
    labels.columns.name,
    labels.columns.context,
    labels.columns.status,
    labels.columns.arrival,
    labels.columns.departure,
    labels.columns.earlyExit,
    labels.columns.reason,
  ];

  const body =
    report.rows.length === 0
      ? [[labels.noDataPeriod, "", "", "", "", "", "", "", ""]]
      : report.rows.map((row, index) => [
          String(index + 1),
          formatReportDate(row.date),
          row.personName,
          row.contextLabel,
          row.statusLabel,
          row.checkIn || "—",
          row.checkOut || "—",
          row.earlyExit ? labels.yes : labels.no,
          row.earlyExit ? row.exitReason || "—" : "—",
        ]);

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: 8,
      bottom: 14,
      left: 8,
    },
    head: [head],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 1.6,
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
    didParseCell: (data) => {
      if (data.section !== "body" || report.rows.length === 0) return;
      const row = report.rows[data.row.index];
      if (!row) return;
      if (row.status === "ABSENT") {
        data.cell.styles.textColor = [185, 28, 28];
      } else if (row.earlyExit) {
        data.cell.styles.textColor = [180, 83, 9];
      }
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title: options.title,
        subtitle: context.branchName,
        details: filters,
        logoDataUrl: logo,
      });
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(
    `${options.filePrefix}-${formatReportDate(report.dateStart).replace(/\//g, "-")}-${stamp}.pdf`,
  );
}
