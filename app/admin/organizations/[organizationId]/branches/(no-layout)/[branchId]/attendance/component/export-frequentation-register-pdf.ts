import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import type { FrequentationRegister } from "@/lib/attendance-frequentation-register";
import type { AttendancePdfLabels } from "../attendance-pdf-labels";

const INK = [30, 64, 175] as const;
const LINE = [147, 197, 253] as const;

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function monthlyGridCapacity(pageH: number, startY: number) {
  const headerH = 12;
  const rowH = 6.2;
  const marginBottom = 28;
  return Math.max(8, Math.floor((pageH - startY - headerH - marginBottom) / rowH));
}

function markColor(mark: string): [number, number, number] {
  if (mark === "I") return [21, 128, 61];
  if (mark === "O") return [185, 28, 28];
  if (mark === "M" || mark === "R") return [180, 83, 9];
  return [15, 23, 42];
}

function drawMonthlyGrid(
  doc: jsPDF,
  month: FrequentationRegister["months"][number],
  students: FrequentationRegister["months"][number]["students"],
  startIndex: number,
  labels: AttendancePdfLabels["frequentation"],
  startY: number,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 8;
  const usableW = pageW - marginX * 2;
  const indexW = 8;
  const nameW = 52;
  const summaryW = 9;
  const obsW = 42;
  const daysW = usableW - indexW - nameW - summaryW * 2 - obsW;
  const dayW = daysW / 31;
  const headerH = 12;
  const rowH = 6.2;
  const tableTop = startY;
  const tableLeft = marginX;

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.35);

  const colX = (day: number) =>
    tableLeft + indexW + nameW + (day - 1) * dayW;
  const pX = tableLeft + indexW + nameW + 31 * dayW;
  const aX = pX + summaryW;
  const obsX = aX + summaryW;

  doc.setFillColor(239, 246, 255);
  doc.rect(tableLeft, tableTop, usableW, headerH, "F");
  doc.rect(tableLeft, tableTop, usableW, headerH, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...INK);
  doc.text("N°", tableLeft + indexW / 2, tableTop + 7, { align: "center" });
  doc.text(labels.studentNames, tableLeft + indexW + 1.5, tableTop + 7);
  doc.text(labels.attendanceBlock, tableLeft + indexW + nameW + (15 * dayW) / 2, tableTop + 3.6, {
    align: "center",
  });
  doc.text(labels.perDay, tableLeft + indexW + nameW + 15 * dayW + (16 * dayW) / 2, tableTop + 3.6, {
    align: "center",
  });
  doc.setFontSize(5.5);
  doc.text(labels.totalOf, pX + summaryW, tableTop + 3.4, { align: "center" });
  doc.setFontSize(6.5);
  doc.text("P", pX + summaryW / 2, tableTop + 10.2, { align: "center" });
  doc.text("A", aX + summaryW / 2, tableTop + 10.2, { align: "center" });
  doc.setFontSize(5.2);
  doc.text(labels.observations, obsX + 1.2, tableTop + 4.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.8);
  doc.text(labels.observationsSub, obsX + 1.2, tableTop + 8.4);

  for (let day = 1; day <= 31; day += 1) {
    const x = colX(day);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...INK);
    doc.text(String(day), x + dayW / 2, tableTop + 10.4, { align: "center" });
  }

  doc.setLineWidth(0.2);
  doc.setDrawColor(...LINE);
  doc.line(tableLeft + indexW, tableTop, tableLeft + indexW, tableTop + headerH);
  doc.line(tableLeft + indexW + nameW, tableTop, tableLeft + indexW + nameW, tableTop + headerH);
  for (let day = 2; day <= 31; day += 1) {
    doc.line(colX(day), tableTop + 6.2, colX(day), tableTop + headerH);
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.28);
  doc.line(colX(16), tableTop, colX(16), tableTop + headerH);
  doc.line(pX, tableTop, pX, tableTop + headerH);
  doc.line(aX, tableTop, aX, tableTop + headerH);
  doc.line(obsX, tableTop, obsX, tableTop + headerH);

  const maxRows = monthlyGridCapacity(pageH, startY);
  const rows = students.slice(0, maxRows);

  rows.forEach((student, index) => {
    const y = tableTop + headerH + index * rowH;
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(tableLeft, y, usableW, rowH, "F");
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    doc.rect(tableLeft, y, usableW, rowH, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(15, 23, 42);
    doc.text(String(startIndex + index + 1), tableLeft + indexW / 2, y + 4.2, { align: "center" });
    doc.text(student.personName.slice(0, 42), tableLeft + indexW + 1.2, y + 4.2);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.12);
    for (let day = 2; day <= 31; day += 1) {
      doc.line(colX(day), y, colX(day), y + rowH);
    }
    for (let day = 1; day <= 31; day += 1) {
      const cell = student.days[day - 1];
      const mark = cell?.mark ?? "";
      if (!mark) continue;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(...markColor(mark));
      doc.text(mark, colX(day) + dayW / 2, y + 4.2, { align: "center" });
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(21, 128, 61);
    doc.text(String(student.presentCount), pX + summaryW / 2, y + 4.2, {
      align: "center",
    });
    doc.setTextColor(185, 28, 28);
    doc.text(String(student.absentCount), aX + summaryW / 2, y + 4.2, {
      align: "center",
    });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(5.2);
    if (student.observation) {
      doc.text(student.observation.slice(0, 48), obsX + 1, y + 4.2);
    }
  });

  const emptyRows = Math.min(4, Math.max(0, maxRows - rows.length));
  for (let i = 0; i < emptyRows; i += 1) {
    const y = tableTop + headerH + (rows.length + i) * rowH;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    doc.rect(tableLeft, y, usableW, rowH, "S");
    doc.setLineWidth(0.12);
    for (let day = 2; day <= 31; day += 1) {
      doc.line(colX(day), y, colX(day), y + rowH);
    }
  }

  const usedRows = rows.length + emptyRows;
  const tableBottom = tableTop + headerH + usedRows * rowH;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.35);
  doc.line(tableLeft + indexW, tableTop, tableLeft + indexW, tableBottom);
  doc.line(tableLeft + indexW + nameW, tableTop, tableLeft + indexW + nameW, tableBottom);
  doc.line(colX(16), tableTop, colX(16), tableBottom);
  doc.line(pX, tableTop, pX, tableBottom);
  doc.line(aX, tableTop, aX, tableBottom);
  doc.line(obsX, tableTop, obsX, tableBottom);
  doc.rect(tableLeft, tableTop, usableW, tableBottom - tableTop, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const footerY = pageH - 18;
  doc.text(
    `${labels.monthPresence}: ${month.presenceMonth}    ${labels.previousPresence}: ${month.presencePrevious}    ${labels.averagePresence}: ${month.averageAttendance ?? "—"}`,
    marginX,
    footerY,
  );
  doc.text(
    `${labels.monthDays}: ${month.openDays}    ${labels.previousClassDays}: ${month.classDaysPrevious}    ${labels.schoolOpenDays}: ${month.openDays}`,
    marginX,
    footerY + 5,
  );
}

export async function exportFrequentationRegisterPdf(
  register: FrequentationRegister,
  context: SchoolReportContext,
  labels: AttendancePdfLabels,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const f = labels.frequentation;
  const classLine = register.classeName
    ? labels.classFilter.replace("{name}", register.classeName)
    : f.allClasses;

  drawReportHeader(doc, context, {
    title: f.title,
    subtitle: context.branchName,
    details: [
      `${f.schoolYear}: ${register.schoolYearLabel}`,
      classLine,
    ],
    logoDataUrl: logo,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(f.legendTitle, 14, REPORT_HEADER_CONTENT_TOP_MM + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const legend = [
    `I — ${f.markPresent}`,
    `O — ${f.markUnexcused}`,
    `M — ${f.markSick}`,
    `R — ${f.markLeave}`,
  ];
  legend.forEach((line, index) => {
    doc.text(line, 14, REPORT_HEADER_CONTENT_TOP_MM + 10 + index * 5);
  });
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(f.legendNote, 14, REPORT_HEADER_CONTENT_TOP_MM + 32, {
    maxWidth: 182,
  });

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM + 38,
    margin: { top: 14, right: 14, bottom: 16, left: 14 },
    head: [
      [
        f.month,
        f.colA,
        f.colB,
        f.colC,
        f.colD,
        f.colE,
        f.colF,
      ],
    ],
    body: register.averages.map((row) => [
      row.monthLabel,
      String(row.enrolled),
      String(row.classDaysMonth),
      String(row.classDaysYear),
      String(row.presenceMonth),
      String(row.presenceYear),
      row.average == null ? "—" : row.average.toFixed(1),
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 1.6,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 28 },
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.5,
      overflow: "linebreak",
    },
  });

  const lastY =
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? REPORT_HEADER_CONTENT_TOP_MM + 80;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(f.formula, 14, lastY + 8, { maxWidth: 182 });

  register.months.forEach((month) => {
    let offset = 0;
    do {
      doc.addPage("a3", "landscape");
      const contentTop = drawReportHeader(doc, context, {
        title: f.title,
        subtitle: context.branchName,
        details: [
          fill(f.monthOf, { month: month.monthLabel, year: month.year }),
          classLine,
          `${f.schoolOpenDays}: ${month.openDays}`,
        ],
        logoDataUrl: logo,
      });
      const startY = contentTop + 1;
      const maxRows = monthlyGridCapacity(
        doc.internal.pageSize.getHeight(),
        startY,
      );
      const group = month.students.slice(offset, offset + maxRows);
      drawMonthlyGrid(doc, month, group, offset, f, startY);
      offset += Math.max(group.length, maxRows);
    } while (offset < month.students.length);
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = (register.classeName || "toutes-classes")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  doc.save(`registre-frequentation-${slug}-${stamp}.pdf`);
}
