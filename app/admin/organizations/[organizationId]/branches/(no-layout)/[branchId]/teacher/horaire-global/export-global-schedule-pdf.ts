import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_CONTINUATION_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import { pdfFontsFromContext } from "@/lib/reports/pdf-font-scale";
import type { SchoolReportContext } from "@/lib/reports/types";
import type { GlobalScheduleEntry } from "./types";
import {
  SATURDAY_SESSION_START,
  SATURDAY_SESSION_END,
  slotHourOnDay,
} from "@/lib/creneau-saturday";
import {
  intlLocaleFromUnknown,
  weekdayLabel,
  weekdayShortLabel,
} from "@/lib/reports/document-locale";

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
  yearLabel: string;
  saturdayLabel: string;
  tables: GlobalSchedulePdfTable[];
};

const HEADER_BLUE: [number, number, number] = [30, 64, 175];
const ROW_ALT: [number, number, number] = [239, 246, 255];
const HOURS_COL: [number, number, number] = [219, 234, 254];
const RECREATION_BG: [number, number, number] = [254, 243, 199];
const RECREATION_FG: [number, number, number] = [146, 64, 14];
const GRID_LINE: [number, number, number] = [191, 219, 254];
const TEXT_MAIN: [number, number, number] = [15, 23, 42];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];

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
  locale?: unknown,
) {
  const collator = intlLocaleFromUnknown(locale);
  return entries
    .filter((entry) => entry.day === day && entry.hour === hour)
    .sort(
      (a, b) =>
        a.teacher.name.localeCompare(b.teacher.name, collator) ||
        a.classe.codeClasse.localeCompare(b.classe.codeClasse, collator),
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
      ?.finalY ?? REPORT_CONTINUATION_CONTENT_TOP_MM
  );
}

function cellText(value: unknown) {
  return Array.isArray(value) ? value.join(" ") : String(value ?? "");
}

export async function exportGlobalSchedulePdf(input: GlobalSchedulePdfInput) {
  const {
    context,
    title,
    details = [],
    hoursLabel,
    recreationLabel,
    yearLabel,
    saturdayLabel,
    tables,
  } = input;
  const fonts = pdfFontsFromContext(context);
  const locale = context.locale;
  const saturdayShort = weekdayShortLabel("Samedi", locale);
  const saturdayRangeText = `${SATURDAY_SESSION_START} – ${SATURDAY_SESSION_END}`;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const pageHeight = doc.internal.pageSize.getHeight();

  const hasSaturdayMorning = tables.some((table) =>
    (table.saturdayHours ?? []).some(
      (hour, index) => hour && hour !== table.hours[index],
    ),
  );

  const headerBottomY = drawReportHeader(doc, context, {
    title,
    subtitle: context.branchName,
    details: [
      ...details,
      context.academicYearLabel
        ? yearLabel.replace("{year}", context.academicYearLabel)
        : "",
      hasSaturdayMorning
        ? saturdayLabel.replace("{range}", saturdayRangeText)
        : "",
    ].filter(Boolean),
    logoDataUrl: logo,
  });

  let startY = headerBottomY;

  for (const table of tables) {
    if (startY > pageHeight - 50) {
      doc.addPage();
      startY = REPORT_CONTINUATION_CONTENT_TOP_MM;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fonts.title);
    doc.setTextColor(...TEXT_MAIN);
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
        ? saturdayLabel.replace(
            "{range}",
            `${SATURDAY_SESSION_START} – ${saturdayEnd}`,
          )
        : "",
    ]
      .filter(Boolean)
      .join(" · ");

    if (tableSubtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fonts.meta);
      doc.setTextColor(...TEXT_MUTED);
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
        ? `${hour} - ${nextTime}\n${saturdayShort} ${saturdayRange}`
        : `${hour} - ${nextTime}`;

      if (table.recreationHour && hour === table.recreationHour) {
        const recLabel = saturdayRange
          ? `${recreationLabel}\n${saturdayShort} ${saturdayRange}`
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
              locale,
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
              ? `${weekdayLabel(day, locale)}\n${SATURDAY_SESSION_START} – ${saturdayEnd}`
              : weekdayLabel(day, locale),
          ),
        ],
      ],
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
        fontSize: fonts.dense,
        cellPadding: 1.6,
        halign: "center",
        valign: "middle",
        textColor: TEXT_MAIN,
        lineColor: GRID_LINE,
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: HEADER_BLUE,
        textColor: 255,
        fontStyle: "bold",
        fontSize: fonts.head,
        halign: "center",
        valign: "middle",
      },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: { 0: { cellWidth: 28, fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const text = cellText(data.cell.text);

        if (data.column.index === 0) {
          data.cell.styles.fillColor = HOURS_COL;
        }

        if (text.includes(recreationLabel)) {
          data.cell.styles.fillColor = RECREATION_BG;
          data.cell.styles.textColor = RECREATION_FG;
          data.cell.styles.fontStyle = "bold";
          return;
        }

        if (text.trim() === "-") {
          data.cell.styles.textColor = TEXT_MUTED;
        }
      },
    });

    startY = tableEndY(doc) + 10;
  }

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  doc.save(`horaire-global-${safeFilePart(title)}.pdf`);
}
