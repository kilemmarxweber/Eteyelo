import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_CONTINUATION_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import { slotHourOnDay } from "@/lib/creneau-saturday";

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
  saturdayTimeSlots?: string[];
  saturdayEndTime?: string;
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
  const {
    context,
    days,
    timeSlots,
    recreationHour,
    endTime,
    saturdayTimeSlots = [],
    saturdayEndTime,
    entries,
  } = input;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const title = `Horaire de la classe ${context.classeName}`;
  const details = [
    context.creneauName ? `Vacation : ${context.creneauName}` : "",
    context.classeCode ? `Code : ${context.classeCode}` : "",
    saturdayTimeSlots.length
      ? `Samedi : 07:30 – ${saturdayEndTime || "12:30"}`
      : "",
  ].filter(Boolean);

  const body = timeSlots.map((hour, index) => {
    const nextTime = timeSlots[index + 1] || endTime;
    if (hour === recreationHour) {
      return [
        `${hour} - ${nextTime}`,
        ...days.map(() => "RECREATION"),
      ];
    }

    const saturdayNext =
      saturdayTimeSlots[index + 1] || saturdayEndTime || nextTime;
    const saturdayRange =
      saturdayTimeSlots[index] && saturdayTimeSlots[index] !== hour
        ? `${saturdayTimeSlots[index]} - ${saturdayNext}`
        : "";

    return [
      saturdayRange
        ? `${hour} - ${nextTime}\nSam. ${saturdayRange}`
        : `${hour} - ${nextTime}`,
      ...days.map((day) => {
        const cellHour = slotHourOnDay({
          day,
          weekdaySlot: hour,
          weekdaySlots: timeSlots,
          saturdaySlots: saturdayTimeSlots,
        });
        const cellEntries = entriesForCell(entries, day, cellHour);
        if (!cellEntries.length) return "-";
        const content = cellEntries
          .map((entry) =>
            [entry.courseName, entry.teacherName].filter(Boolean).join("\n"),
          )
          .join("\n---\n");
        return cellEntries.length > 1 ? `CONFLIT\n${content}` : content;
      }),
    ];
  });

  const headerBottomY = drawReportHeader(doc, context, {
    title,
    subtitle: context.branchName,
    details,
    logoDataUrl: logo,
  });

  autoTable(doc, {
    startY: headerBottomY,
    head: [["Heures", ...days]],
    body,
    theme: "grid",
    showHead: "everyPage",
    margin: {
      top: REPORT_CONTINUATION_CONTENT_TOP_MM,
      left: 10,
      right: 10,
      bottom: 14,
    },
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2,
      halign: "center",
      valign: "middle",
      textColor: [15, 23, 42],
      lineColor: [191, 219, 254],
      lineWidth: 0.2,
    },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: { 0: { cellWidth: 27, fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const text = Array.isArray(data.cell.text) ? data.cell.text.join(" ") : String(data.cell.text);
      if (data.column.index === 0) {
        data.cell.styles.fillColor = [219, 234, 254];
      }
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
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  doc.save(`horaire-${safeFilePart(context.classeName || "classe")}.pdf`);
}
