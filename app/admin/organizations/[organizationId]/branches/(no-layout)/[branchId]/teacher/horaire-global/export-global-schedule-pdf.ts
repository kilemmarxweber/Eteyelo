import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import type { GlobalScheduleEntry } from "./types";
import {
  SATURDAY_SESSION_START,
  SATURDAY_SESSION_END,
  slotHourOnDay,
} from "@/lib/creneau-saturday";

export type GlobalSchedulePdfTable = {
  title: string;
  subtitle?: string;
  hours: string[];
  workingDays: string[];
  recreationHour?: string;
  endTime?: string;
  saturdayHours?: string[];
  saturdayEndTime?: string;
  entries: GlobalScheduleEntry[];
  showTeacher: boolean;
};

type GlobalSchedulePdfInput = {
  context: SchoolReportContext;
  title: string;
  details?: string[];
  hoursLabel: string;
  recreationLabel: string;
  tables: GlobalSchedulePdfTable[];
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function entriesForCell(
  entries: GlobalScheduleEntry[],
  day: string,
  hour: string,
) {
  return entries
    .filter((entry) => entry.day === day && entry.hour === hour)
    .sort(
      (a, b) =>
        a.teacher.name.localeCompare(b.teacher.name, "fr") ||
        a.classe.codeClasse.localeCompare(b.classe.codeClasse, "fr"),
    );
}

function formatCell(entries: GlobalScheduleEntry[], showTeacher: boolean) {
  if (!entries.length) return "-";
  return entries
    .map((entry) =>
      [
        showTeacher ? entry.teacher.name : "",
        entry.cours.nameCours,
        entry.classe.codeClasse || entry.classe.nameClasse,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n---\n");
}

function tableEndY(doc: jsPDF) {
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? REPORT_HEADER_CONTENT_TOP_MM
  );
}

export async function exportGlobalSchedulePdf(input: GlobalSchedulePdfInput) {
  const { context, title, details = [], hoursLabel, recreationLabel, tables } =
    input;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const pageHeight = doc.internal.pageSize.getHeight();

  const hasSaturdayMorning = tables.some((table) =>
    (table.saturdayHours ?? []).some(
      (hour, index) => hour && hour !== table.hours[index],
    ),
  );

  const drawHeader = () => {
    drawReportHeader(doc, context, {
      title,
      subtitle: context.branchName,
      details: [
        ...details,
        context.academicYearLabel ? `Année : ${context.academicYearLabel}` : "",
        hasSaturdayMorning
          ? `Samedi : ${SATURDAY_SESSION_START} – ${SATURDAY_SESSION_END}`
          : "",
      ].filter(Boolean),
      logoDataUrl: logo,
    });
  };

  drawHeader();
  let startY = REPORT_HEADER_CONTENT_TOP_MM;

  for (const table of tables) {
    if (startY > pageHeight - 50) {
      doc.addPage();
      drawHeader();
      startY = REPORT_HEADER_CONTENT_TOP_MM;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(table.title, 10, startY);
    startY += 5;
    const saturdayHours = table.saturdayHours ?? [];
    const showSaturdayClock = saturdayHours.some(
      (hour, index) => hour && hour !== table.hours[index],
    );
    const saturdayEnd = table.saturdayEndTime || SATURDAY_SESSION_END;
    const tableSubtitle = [
      table.subtitle,
      showSaturdayClock
        ? `Samedi : ${SATURDAY_SESSION_START} – ${saturdayEnd}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");

    if (tableSubtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(tableSubtitle, 10, startY);
      startY += 4;
    }

    const body = table.hours.map((hour, index) => {
      const nextTime = table.hours[index + 1] || table.endTime || "";
      const saturdayHour = saturdayHours[index] || "";
      const saturdayNext =
        saturdayHours[index + 1] || table.saturdayEndTime || nextTime;
      const saturdayRange =
        showSaturdayClock && saturdayHour && saturdayHour !== hour
          ? `${saturdayHour} - ${saturdayNext}`
          : "";
      const hoursCell = saturdayRange
        ? `${hour} - ${nextTime}\nSam. ${saturdayRange}`
        : `${hour} - ${nextTime}`;

      if (table.recreationHour && hour === table.recreationHour) {
        const recLabel = saturdayRange
          ? `${recreationLabel}\nSam. ${saturdayRange}`
          : recreationLabel;
        return [hoursCell, ...table.workingDays.map(() => recLabel)];
      }

      return [
        hoursCell,
        ...table.workingDays.map((day) =>
          formatCell(
            entriesForCell(
              table.entries,
              day,
              slotHourOnDay({
                day,
                weekdaySlot: hour,
                weekdaySlots: table.hours,
                saturdaySlots: saturdayHours,
              }),
            ),
            table.showTeacher,
          ),
        ),
      ];
    });

    autoTable(doc, {
      startY,
      head: [
        [
          hoursLabel,
          ...table.workingDays.map((day) =>
            showSaturdayClock && day === "Samedi"
              ? `${day}\n${SATURDAY_SESSION_START} – ${saturdayEnd}`
              : day,
          ),
        ],
      ],
      body,
      theme: "grid",
      margin: {
        top: REPORT_HEADER_CONTENT_TOP_MM,
        left: 10,
        right: 10,
        bottom: 14,
      },
      styles: {
        font: "helvetica",
        fontSize: table.showTeacher ? 6.5 : 7.5,
        cellPadding: 1.6,
        halign: "center",
        valign: "middle",
      },
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: { 0: { cellWidth: 28, fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const text = Array.isArray(data.cell.text)
          ? data.cell.text.join(" ")
          : String(data.cell.text);
        if (text.includes(recreationLabel)) {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => {
        drawHeader();
      },
    });

    startY = tableEndY(doc) + 10;
  }

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  doc.save(`horaire-global-${safeFilePart(title)}.pdf`);
}
