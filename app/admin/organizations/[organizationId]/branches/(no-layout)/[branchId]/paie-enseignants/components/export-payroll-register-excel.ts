import type ExcelJS from "exceljs";

import { formatReportAmount } from "@/lib/reports/format-amount";
import { safePdfFilePart } from "@/lib/pdf/pdf-engine";
import type { SchoolReportContext } from "@/lib/reports/types";
import type {
  PayrollRegisterCash,
  PayrollRegisterOptions,
  PayrollRegisterRow,
} from "./export-payroll-register-pdf";

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const CYCLE_LABELS: Record<string, string> = {
  MATERNELLE: "Maternelle",
  PRIMAIRE: "Primaire",
  SECONDAIRE: "Secondaire",
  ATELIER: "Atelier",
  CENTRE_FORMATION: "Centre de formation",
  UNIVERSITE: "Université",
  MIXTE: "Mixte",
  PERSONNEL: "Personnel",
  AUTRE: "Autre",
};

const CYCLE_COLORS: Record<string, string> = {
  MATERNELLE: "FFDB2777",
  PRIMAIRE: "FF0284C7",
  SECONDAIRE: "FF4F46E5",
  MIXTE: "FF7C3AED",
  PERSONNEL: "FFB45309",
  ATELIER: "FF0D9488",
  CENTRE_FORMATION: "FF0E7490",
  UNIVERSITE: "FF4338CA",
  AUTRE: "FF475569",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validé",
  PAID: "Payé",
  CANCELLED: "Annulé",
};

const HEADERS = [
  "Agent",
  "Cycle / rôle",
  "Branche",
  "Classes",
  "Contrat",
  "Séances",
  "Brut",
  "Pertes",
  "Min. perdues",
  "Net",
  "Différence",
  "Bulletin",
] as const;

const COL_COUNT = HEADERS.length;
const THIN: ExcelJS.Borders = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
  diagonal: {},
};

function cycleLabel(code: string) {
  return CYCLE_LABELS[code] ?? code;
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function moneyFormat(currency: string) {
  return currency === "USD" ? '#,##0.00 "USD"' : `#,##0 "${currency}"`;
}

function fillArgb(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function paintRange(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  startCol: number,
  endCol: number,
  style: {
    font?: Partial<ExcelJS.Font>;
    fill?: ExcelJS.Fill;
    alignment?: Partial<ExcelJS.Alignment>;
    border?: ExcelJS.Borders;
  },
) {
  for (let col = startCol; col <= endCol; col += 1) {
    const cell = sheet.getCell(rowIndex, col);
    if (style.font) cell.font = style.font;
    if (style.fill) cell.fill = style.fill;
    if (style.alignment) cell.alignment = style.alignment;
    if (style.border) cell.border = style.border;
  }
}

export async function exportPayrollRegisterExcel(
  rows: PayrollRegisterRow[],
  cash: PayrollRegisterCash | null,
  context: SchoolReportContext,
  options: PayrollRegisterOptions,
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eteyelo";
  workbook.created = new Date();

  const monthName = MONTHS[options.month - 1] ?? String(options.month);
  const periodLabel = `${monthName} ${options.year}`;
  const currency =
    cash?.currency ?? rows[0]?.currency ?? context.baseCurrency ?? "USD";
  const amountFmt = moneyFormat(currency);

  const draftCount = rows.filter((row) => row.status === "DRAFT").length;
  const validatedCount = rows.filter((row) => row.status === "VALIDATED").length;
  const paidCount = rows.filter((row) => row.status === "PAID").length;
  const gross = rows.reduce((sum, row) => sum + row.gross, 0);
  const deductions = rows.reduce((sum, row) => sum + row.deductions, 0);
  const net = rows.reduce((sum, row) => sum + row.net, 0);
  const lostMinutes = rows.reduce((sum, row) => sum + row.lostMinutes, 0);
  const difference = rows.reduce((sum, row) => sum + row.difference, 0);
  const sessions = rows.reduce((sum, row) => sum + row.sessions, 0);

  const groups: Array<{
    cycleGroup: string;
    label: string;
    rows: PayrollRegisterRow[];
  }> = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.cycleGroup === row.cycleGroup) last.rows.push(row);
    else {
      groups.push({
        cycleGroup: row.cycleGroup,
        label: cycleLabel(row.cycleGroup),
        rows: [row],
      });
    }
  }

  const sheet = workbook.addWorksheet("Bulletins de paie", {
    views: [{ showGridLines: false, state: "frozen", ySplit: cash ? 11 : 7 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  sheet.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `Bulletins de paie — ${periodLabel}`;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF1E40AF" } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 22;

  sheet.mergeCells(2, 1, 2, COL_COUNT);
  sheet.getCell(2, 1).value = context.branchName || context.schoolName;
  sheet.getCell(2, 1).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF0F172A" } };

  const metaParts = [
    options.schoolYearLabel ? `Année scolaire : ${options.schoolYearLabel}` : "",
    `${rows.length} bulletin${rows.length > 1 ? "s" : ""}`,
    `${draftCount} brouillon${draftCount > 1 ? "s" : ""} · ${validatedCount} validé${validatedCount > 1 ? "s" : ""} · ${paidCount} payé${paidCount > 1 ? "s" : ""}`,
  ].filter(Boolean);
  sheet.mergeCells(3, 1, 3, COL_COUNT);
  sheet.getCell(3, 1).value = metaParts.join("  ·  ");
  sheet.getCell(3, 1).font = { name: "Calibri", size: 9, color: { argb: "FF64748B" } };

  let nextRow = 5;
  if (cash) {
    const kpiLabels = [
      "Encaissements",
      "Dépenses caisse",
      "Solde net de caisse",
      "Reste après paie",
    ];
    const kpiValues = [
      cash.incomeTotal,
      cash.expenseTotal,
      cash.cashNet,
      cash.remainingAfterPayroll,
    ];
    kpiLabels.forEach((label, index) => {
      const col = index + 1;
      const header = sheet.getCell(nextRow, col);
      header.value = label;
      header.font = { name: "Calibri", size: 8, bold: true, color: { argb: "FFFFFFFF" } };
      header.fill = fillArgb("FF1E40AF");
      header.alignment = { horizontal: "center", vertical: "middle" };
      header.border = THIN;
      const value = sheet.getCell(nextRow + 1, col);
      value.value = kpiValues[index];
      value.numFmt = amountFmt;
      value.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: {
          argb:
            index === 3 && cash.remainingAfterPayroll < 0
              ? "FFB91C1C"
              : "FF0F172A",
        },
      };
      value.fill = fillArgb("FFEFF6FF");
      value.alignment = { horizontal: "center", vertical: "middle" };
      value.border = THIN;
    });
    sheet.getRow(nextRow + 1).height = 20;
    nextRow += 3;
    sheet.mergeCells(nextRow, 1, nextRow, COL_COUNT);
    sheet.getCell(nextRow, 1).value =
      `Paie du mois : brut ${formatReportAmount(cash.payrollGross, currency)} · retenues ${formatReportAmount(cash.payrollDeductions, currency)} · à consommer ${formatReportAmount(cash.payrollConsume, currency)} · ${cash.unpaidCount} bulletin${cash.unpaidCount > 1 ? "s" : ""} non payé${cash.unpaidCount > 1 ? "s" : ""} · ${sessions} séance${sessions > 1 ? "s" : ""}`;
    sheet.getCell(nextRow, 1).font = {
      name: "Calibri",
      size: 9,
      color: { argb: "FF64748B" },
    };
    nextRow += 2;
  }

  const headerRowIndex = nextRow;
  HEADERS.forEach((label, index) => {
    const cell = sheet.getCell(headerRowIndex, index + 1);
    cell.value = label;
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = fillArgb("FF1E40AF");
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = THIN;
  });
  sheet.getRow(headerRowIndex).height = 22;
  sheet.views = [{ showGridLines: false, state: "frozen", ySplit: headerRowIndex }];

  let rowIndex = headerRowIndex + 1;
  for (const group of groups) {
    sheet.mergeCells(rowIndex, 1, rowIndex, COL_COUNT);
    const groupGross = group.rows.reduce((sum, row) => sum + row.gross, 0);
    const groupLost = group.rows.reduce((sum, row) => sum + row.deductions, 0);
    const groupNet = group.rows.reduce((sum, row) => sum + row.net, 0);
    const groupCell = sheet.getCell(rowIndex, 1);
    groupCell.value = `${group.label}  ·  ${group.rows.length} agent${group.rows.length > 1 ? "s" : ""}  ·  brut ${formatReportAmount(groupGross, currency)}  ·  pertes ${formatReportAmount(groupLost, currency)}  ·  net ${formatReportAmount(groupNet, currency)}`;
    const groupFill = CYCLE_COLORS[group.cycleGroup] ?? CYCLE_COLORS.AUTRE;
    paintRange(sheet, rowIndex, 1, COL_COUNT, {
      font: { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
      fill: fillArgb(groupFill),
      alignment: { vertical: "middle" },
      border: THIN,
    });
    rowIndex += 1;

    for (const [itemIndex, row] of group.rows.entries()) {
      const values: Array<string | number> = [
        row.teacherName || "Agent",
        (row.cycles.length > 0 ? row.cycles : [row.cycleGroup || "AUTRE"])
          .map(cycleLabel)
          .join(", "),
        row.branchName || "—",
        row.classes.length > 0 ? row.classes.join(" · ") : "—",
        row.contractLabel,
        row.sessions,
        row.gross,
        row.deductions,
        row.lostMinutes,
        row.net,
        row.difference,
        statusLabel(row.status),
      ];
      values.forEach((value, colIndex) => {
        const cell = sheet.getCell(rowIndex, colIndex + 1);
        cell.value = value;
        cell.font = { name: "Calibri", size: 9, color: { argb: "FF0F172A" } };
        cell.border = THIN;
        cell.alignment = {
          vertical: "middle",
          wrapText: colIndex === 0 || colIndex === 3,
          horizontal:
            colIndex >= 5 && colIndex <= 10
              ? "right"
              : colIndex === 11
                ? "center"
                : "left",
        };
        if (itemIndex % 2 === 1) cell.fill = fillArgb("FFEFF6FF");
        if (colIndex >= 6 && colIndex <= 7) {
          cell.numFmt = amountFmt;
          cell.font = { name: "Calibri", size: 9, color: { argb: "FFB91C1C" } };
        }
        if (colIndex === 6) {
          cell.font = { name: "Calibri", size: 9, color: { argb: "FF0F172A" } };
          cell.numFmt = amountFmt;
        }
        if (colIndex === 7) {
          cell.numFmt = amountFmt;
          cell.font = { name: "Calibri", size: 9, color: { argb: "FFB91C1C" } };
        }
        if (colIndex === 8) {
          cell.numFmt = "0.0";
          cell.font = { name: "Calibri", size: 9, color: { argb: "FFB91C1C" } };
        }
        if (colIndex === 9) {
          cell.numFmt = amountFmt;
          cell.font = { name: "Calibri", size: 9, bold: true };
        }
        if (colIndex === 10) {
          cell.numFmt = amountFmt;
          cell.font = { name: "Calibri", size: 9, color: { argb: "FFB45309" } };
        }
      });
      rowIndex += 1;
    }
  }

  sheet.mergeCells(rowIndex, 1, rowIndex, 5);
  const totalLabel = sheet.getCell(rowIndex, 1);
  totalLabel.value = `Totaux (${rows.length} bulletin${rows.length > 1 ? "s" : ""})`;
  const totals: Array<number | string> = [
    sessions,
    gross,
    deductions,
    lostMinutes,
    net,
    difference,
    "",
  ];
  sheet.getCell(rowIndex, 6).value = totals[0];
  sheet.getCell(rowIndex, 7).value = totals[1];
  sheet.getCell(rowIndex, 8).value = totals[2];
  sheet.getCell(rowIndex, 9).value = totals[3];
  sheet.getCell(rowIndex, 10).value = totals[4];
  sheet.getCell(rowIndex, 11).value = totals[5];
  sheet.getCell(rowIndex, 12).value = totals[6];
  paintRange(sheet, rowIndex, 1, COL_COUNT, {
    font: { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
    fill: fillArgb("FF0F172A"),
    border: THIN,
    alignment: { vertical: "middle" },
  });
  for (const col of [6, 7, 8, 9, 10, 11]) {
    const cell = sheet.getCell(rowIndex, col);
    cell.alignment = { horizontal: "right", vertical: "middle" };
    if (col === 6 || col === 9) cell.numFmt = "0.0";
    if (col === 7 || col === 8 || col === 10 || col === 11) cell.numFmt = amountFmt;
  }
  sheet.getCell(rowIndex, 6).numFmt = "0";
  sheet.getCell(rowIndex, 9).numFmt = "0.0";

  const widths = [28, 16, 16, 28, 18, 10, 14, 14, 12, 14, 14, 12];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bulletins-paie-${safePdfFilePart(monthName)}-${options.year}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
