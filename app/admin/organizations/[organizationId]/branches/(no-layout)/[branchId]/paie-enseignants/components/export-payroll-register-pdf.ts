import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import { formatReportAmount } from "@/lib/reports/format-amount";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import { safePdfFilePart } from "@/lib/pdf/pdf-engine";
import type { SchoolReportContext } from "@/lib/reports/types";

export type PayrollRegisterRow = {
  teacherName: string;
  cycles: string[];
  cycleGroup: string;
  branchName: string;
  classes: string[];
  contractLabel: string;
  currency: string;
  gross: number;
  deductions: number;
  lostMinutes: number;
  net: number;
  difference: number;
  status: string;
  sessions: number;
};

export type PayrollRegisterCash = {
  currency: string;
  incomeTotal: number;
  expenseTotal: number;
  cashNet: number;
  payrollConsume: number;
  payrollGross: number;
  payrollDeductions: number;
  remainingAfterPayroll: number;
  unpaidCount: number;
};

export type PayrollRegisterOptions = {
  month: number;
  year: number;
  schoolYearLabel?: string;
};

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

const CYCLE_COLORS: Record<string, [number, number, number]> = {
  MATERNELLE: [219, 39, 119],
  PRIMAIRE: [2, 132, 199],
  SECONDAIRE: [79, 70, 229],
  MIXTE: [124, 58, 237],
  PERSONNEL: [180, 83, 9],
  ATELIER: [13, 148, 136],
  CENTRE_FORMATION: [14, 116, 144],
  UNIVERSITE: [67, 56, 202],
  AUTRE: [71, 85, 105],
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validé",
  PAID: "Payé",
  CANCELLED: "Annulé",
};

type RowKind = "group" | "item" | "subtotal" | "total";

function money(value: number, currency: string) {
  return formatReportAmount(value, currency);
}

function minutesLabel(value: number) {
  if (!value) return "—";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} min`;
}

function cycleLabel(code: string) {
  return CYCLE_LABELS[code] ?? code;
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function lastTableY(doc: jsPDF) {
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? REPORT_HEADER_CONTENT_TOP_MM
  );
}

export async function exportPayrollRegisterPdf(
  rows: PayrollRegisterRow[],
  cash: PayrollRegisterCash | null,
  context: SchoolReportContext,
  options: PayrollRegisterOptions,
) {
  const monthName = MONTHS[options.month - 1] ?? String(options.month);
  const periodLabel = `${monthName} ${options.year}`;
  const currency = cash?.currency ?? rows[0]?.currency ?? context.baseCurrency ?? "USD";
  const title = `Bulletins de paie — ${periodLabel}`;

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
    if (last && last.cycleGroup === row.cycleGroup) {
      last.rows.push(row);
    } else {
      groups.push({
        cycleGroup: row.cycleGroup,
        label: cycleLabel(row.cycleGroup),
        rows: [row],
      });
    }
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 8;
  const usableWidth = pageWidth - marginX * 2;
  const colCount = 12;
  const colWeights = [16, 9, 9, 12, 8, 5, 8, 8, 6, 8, 7, 4];
  const colWeightTotal = colWeights.reduce((sum, value) => sum + value, 0);
  const colWidths = colWeights.map(
    (weight) => Math.floor((weight / colWeightTotal) * usableWidth * 10) / 10,
  );
  colWidths[colWidths.length - 1] +=
    usableWidth - colWidths.reduce((sum, value) => sum + value, 0);

  const headerDetails = [
    options.schoolYearLabel ? `Année scolaire : ${options.schoolYearLabel}` : "",
    `${rows.length} bulletin${rows.length > 1 ? "s" : ""}`,
    `${draftCount} brouillon${draftCount > 1 ? "s" : ""} · ${validatedCount} validé${validatedCount > 1 ? "s" : ""} · ${paidCount} payé${paidCount > 1 ? "s" : ""}`,
    `Net à payer : ${money(net, currency)}`,
  ].filter(Boolean);

  const drawHeader = () => {
    drawReportHeader(doc, context, {
      title,
      subtitle: context.branchName,
      details: headerDetails,
      logoDataUrl: logo,
    });
  };

  const kpiBody = cash
    ? [[
        money(cash.incomeTotal, currency),
        money(cash.expenseTotal, currency),
        money(cash.cashNet, currency),
        money(cash.remainingAfterPayroll, currency),
      ]]
    : [[
        money(gross, currency),
        money(deductions, currency),
        money(net, currency),
        money(difference, currency),
      ]];

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: marginX,
      bottom: 14,
      left: marginX,
    },
    tableWidth: usableWidth,
    head: cash
      ? [[
          "Encaissements",
          "Dépenses caisse",
          "Solde net de caisse",
          "Reste après paie",
        ]]
      : [["Brut", "Pertes", "Net à payer", "Différence"]],
    body: kpiBody,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.2,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
    },
    bodyStyles: {
      fontStyle: "bold",
      textColor: [15, 23, 42],
      fillColor: [239, 246, 255],
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (cash && data.column.index === 3 && cash.remainingAfterPayroll < 0) {
        data.cell.styles.textColor = [185, 28, 28];
      }
    },
    didDrawPage: () => {
      drawHeader();
    },
  });

  if (cash) {
    const kpiY = lastTableY(doc);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Paie du mois : brut ${money(cash.payrollGross, currency)}  ·  retenues ${money(cash.payrollDeductions, currency)}  ·  à consommer ${money(cash.payrollConsume, currency)}  ·  ${sessions} séance${sessions > 1 ? "s" : ""}`,
      pageWidth / 2,
      kpiY + 6,
      { align: "center", maxWidth: usableWidth },
    );
  }

  const body: string[][] = [];
  const rowKinds: RowKind[] = [];
  const rowCycleGroups: string[] = [];

  for (const group of groups) {
    const groupGross = group.rows.reduce((sum, row) => sum + row.gross, 0);
    const groupLost = group.rows.reduce((sum, row) => sum + row.deductions, 0);
    const groupNet = group.rows.reduce((sum, row) => sum + row.net, 0);
    body.push([
      `${group.label}  ·  ${group.rows.length} agent${group.rows.length > 1 ? "s" : ""}  ·  brut ${money(groupGross, currency)}  ·  pertes ${money(groupLost, currency)}  ·  net ${money(groupNet, currency)}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    rowKinds.push("group");
    rowCycleGroups.push(group.cycleGroup);

    for (const row of group.rows) {
      body.push([
        row.teacherName || "Agent",
        (row.cycles.length > 0 ? row.cycles : [row.cycleGroup || "AUTRE"])
          .map(cycleLabel)
          .join(", "),
        row.branchName || "—",
        row.classes.length > 0 ? row.classes.join(" · ") : "—",
        row.contractLabel,
        String(row.sessions || "—"),
        money(row.gross, row.currency || currency),
        money(row.deductions, row.currency || currency),
        minutesLabel(row.lostMinutes),
        money(row.net, row.currency || currency),
        money(row.difference, row.currency || currency),
        statusLabel(row.status),
      ]);
      rowKinds.push("item");
      rowCycleGroups.push(group.cycleGroup);
    }
  }

  body.push([
    `Totaux (${rows.length} bulletin${rows.length > 1 ? "s" : ""})`,
    "",
    "",
    "",
    "",
    String(sessions || "—"),
    money(gross, currency),
    money(deductions, currency),
    minutesLabel(lostMinutes),
    money(net, currency),
    money(difference, currency),
    "",
  ]);
  rowKinds.push("total");
  rowCycleGroups.push("AUTRE");

  const mainStartY = lastTableY(doc) + (cash ? 12 : 6);

  autoTable(doc, {
    startY: mainStartY,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: marginX,
      bottom: 14,
      left: marginX,
    },
    tableWidth: usableWidth,
    horizontalPageBreak: false,
    head: [[
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
    ]],
    body,
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: 1.4,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.4,
      halign: "center",
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: colWidths[0] },
      1: { cellWidth: colWidths[1] },
      2: { cellWidth: colWidths[2] },
      3: { cellWidth: colWidths[3] },
      4: { cellWidth: colWidths[4] },
      5: { cellWidth: colWidths[5], halign: "center" },
      6: { cellWidth: colWidths[6], halign: "right" },
      7: { cellWidth: colWidths[7], halign: "right" },
      8: { cellWidth: colWidths[8], halign: "center" },
      9: { cellWidth: colWidths[9], halign: "right" },
      10: { cellWidth: colWidths[10], halign: "right" },
      11: { cellWidth: colWidths[11], halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const kind = rowKinds[data.row.index];
      if (kind === "group") {
        const fill =
          CYCLE_COLORS[rowCycleGroups[data.row.index] ?? "AUTRE"] ??
          CYCLE_COLORS.AUTRE;
        if (data.column.index === 0) {
          data.cell.colSpan = colCount;
          data.cell.styles.fillColor = fill;
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.halign = "left";
          data.cell.styles.fontSize = 7.5;
        } else {
          data.cell.styles.cellWidth = 0;
          data.cell.text = [];
        }
        return;
      }
      if (kind === "total") {
        data.cell.styles.fillColor = [15, 23, 42];
        data.cell.styles.textColor = 255;
        data.cell.styles.fontStyle = "bold";
        if (data.column.index === 0) {
          data.cell.colSpan = 5;
          data.cell.styles.halign = "left";
        } else if (data.column.index > 0 && data.column.index < 5) {
          data.cell.styles.cellWidth = 0;
          data.cell.text = [];
        }
        return;
      }
      if (data.row.index % 2 === 1) {
        data.cell.styles.fillColor = [239, 246, 255];
      }
      if (data.column.index === 7 || data.column.index === 8) {
        data.cell.styles.textColor = [185, 28, 28];
      }
      if (data.column.index === 9) {
        data.cell.styles.fontStyle = "bold";
      }
      if (data.column.index === 10) {
        data.cell.styles.textColor = [180, 83, 9];
      }
    },
    didDrawPage: () => {
      drawHeader();
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  const fileName = [
    "bulletins-paie",
    safePdfFilePart(monthName),
    String(options.year),
  ].join("-");
  doc.save(`${fileName}.pdf`);
}
