import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";

export type ScheduleReportContext = SchoolReportContext & {
  classeName: string;
  classeCode: string;
  creneauName: string;
};

export type ScheduleReportEntry = {
  id: string;
  day: string;
  startTime: string;
  courseName: string;
  teacherName: string;
};

type SchedulePdfInput = {
  context: ScheduleReportContext;
  days: string[];
  timeSlots: string[];
  recreationHour: string;
  endTime: string;
  entries: ScheduleReportEntry[];
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function entriesForCell(entries: ScheduleReportEntry[], day: string, hour: string) {
  return entries.filter((entry) => entry.day === day && entry.startTime === hour);
}

export function findScheduleConflicts(entries: ScheduleReportEntry[]) {
  const counts = new Map<string, ScheduleReportEntry[]>();
  for (const entry of entries) {
    const key = `${entry.day}-${entry.startTime}`;
    counts.set(key, [...(counts.get(key) ?? []), entry]);
  }
  return Array.from(counts.values()).filter((items) => items.length > 1);
}

export async function exportSchedulePdf(input: SchedulePdfInput) {
  const { context, days, timeSlots, recreationHour, endTime, entries } = input;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const title = `Horaire de la classe ${context.classeName}`;
  const details = [
    context.creneauName ? `Vacation : ${context.creneauName}` : "",
    context.classeCode ? `Code : ${context.classeCode}` : "",
  ].filter(Boolean);

  const body = timeSlots.map((hour, index) => {
    const nextTime = timeSlots[index + 1] || endTime;
    if (hour === recreationHour) {
      return [
        `${hour} - ${nextTime}`,
        ...days.map(() => "RECREATION"),
      ];
    }

    return [
      `${hour} - ${nextTime}`,
      ...days.map((day) => {
        const cellEntries = entriesForCell(entries, day, hour);
        if (!cellEntries.length) return "-";
        const content = cellEntries.map((entry) =>
          [entry.courseName, entry.teacherName].filter(Boolean).join("\n"),
        ).join("\n---\n");
        return cellEntries.length > 1 ? `CONFLIT\n${content}` : content;
      }),
    ];
  });

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    head: [["Heures", ...days]],
    body,
    theme: "grid",
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      left: 10,
      right: 10,
      bottom: 14,
    },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2, halign: "center", valign: "middle" },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 27, fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const text = Array.isArray(data.cell.text) ? data.cell.text.join(" ") : String(data.cell.text);
      if (text.includes("RECREATION")) {
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
        data.cell.styles.fontStyle = "bold";
      } else if (text.includes("CONFLIT")) {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [153, 27, 27];
        data.cell.styles.fontStyle = "bold";
      }
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

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  doc.save(`horaire-${safeFilePart(context.classeName || "classe")}.pdf`);
}
