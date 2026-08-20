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

function formatReportDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("fr-FR");
}

export async function exportTeacherSessionReportPdf(
  report: TeacherSessionReport,
  context: SchoolReportContext,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const title = "Rapport séances enseignants";
  const filters = [
    `Période : ${formatReportDate(report.dateStart)} → ${formatReportDate(report.dateEnd)}`,
    report.teacherName ? `Enseignant : ${report.teacherName}` : null,
    report.classeName ? `Classe : ${report.classeName}` : null,
    `Séances : ${report.summary.sessions} · Heures effectuées : ${formatDurationMinutes(report.summary.minutesTotal)} · Sorties anticipées : ${report.summary.earlyExits}`,
  ].filter(Boolean) as string[];

  const head = [
    "#",
    "Date",
    "Séance",
    "Enseignant",
    "Matière",
    "Classe",
    "Début",
    "Fin",
    "Durée",
    "Statut",
    "Motif sortie",
  ];

  const body =
    report.rows.length === 0
      ? [["Aucune séance pour cette période.", "", "", "", "", "", "", "", "", "", ""]]
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
          row.earlyExit ? row.exitReason || "Sortie anticipée" : "—",
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
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const dayLabel = formatReportDate(journal.date);
  const title = "Rapport journalier de présence";
  const details = [
    `Date : ${dayLabel}`,
    `Séances enseignants : ${journal.stats.teacherSessions} · Durée totale : ${formatDurationMinutes(journal.stats.teacherMinutes)}`,
    `Sorties anticipées — Élèves : ${journal.stats.studentEarlyExits} · Enseignants : ${journal.stats.teacherEarlyExits} · Personnel : ${journal.stats.personnelEarlyExits}`,
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
        "Séance",
        "Enseignant",
        "Matière",
        "Classe",
        "Début",
        "Fin",
        "Durée",
        "Statut",
      ],
    ],
    body:
      journal.teacherSessions.length === 0
        ? [["Aucune séance enseignant ce jour.", "", "", "", "", "", "", ""]]
        : journal.teacherSessions.map((row) => [
            row.sessionLabel,
            row.teacherName,
            row.subject,
            row.classeName,
            row.actualStart ?? row.plannedStart,
            row.actualEnd ?? row.plannedEnd,
            row.minutesLabel,
            row.earlyExit
              ? `Sortie : ${row.exitReason || "anticipée"}`
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
      ["Type", "Nom", "Contexte", "Arrivée", "Sortie", "Motif", "Statut"],
    ],
    body:
      journal.earlyExits.length === 0
        ? [["Aucune sortie anticipée.", "", "", "", "", "", ""]]
        : journal.earlyExits.map((row) => [
            row.personType === "student"
              ? "Élève"
              : row.personType === "teacher"
                ? "Enseignant"
                : "Personnel",
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
  options: { title: string; filePrefix: string },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const filters = [
    `Période : ${formatReportDate(report.dateStart)} → ${formatReportDate(report.dateEnd)}`,
    report.classeName ? `Classe : ${report.classeName}` : null,
    `Total ${report.summary.total} · Présents ${report.summary.present} · Retards ${report.summary.late} · Excusés ${report.summary.excused} · Absents ${report.summary.absent} · Sorties anticipées ${report.summary.earlyExits}`,
  ].filter(Boolean) as string[];

  const head = [
    "#",
    "Date",
    "Nom",
    "Contexte",
    "Statut",
    "Arrivée",
    "Sortie",
    "Sortie anticipée",
    "Motif",
  ];

  const body =
    report.rows.length === 0
      ? [["Aucune donnée pour cette période.", "", "", "", "", "", "", "", ""]]
      : report.rows.map((row, index) => [
          String(index + 1),
          formatReportDate(row.date),
          row.personName,
          row.contextLabel,
          row.statusLabel,
          row.checkIn || "—",
          row.checkOut || "—",
          row.earlyExit ? "Oui" : "Non",
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
