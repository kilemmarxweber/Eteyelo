import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatModePaiementLabel } from "@/components/reports/receipt-format";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import { formatReportAmount } from "@/lib/reports/format-amount";
import { groupCashierPaymentsByMethod, formatCashierDateTime } from "./group-cashier-payments";

export type CashierReportPdfOptions = {
  dateStart: string;
  dateEnd?: string;
};

export type ReportData = {
  openingBalance?: number;
  hasOpeningBalance?: boolean;
  incomeTotal: number;
  outflowTotal: number;
  periodBalance?: number;
  balance: number;
  payments: Array<{
    id: string;
    amount: number;
    transactionRef: string;
    studentName: string;
    method?: string | null;
    createdAt: string;
    createdByUserId?: string | null;
    cashierName?: string | null;
    frais?: { nameFrais: string } | null;
  }>;
  expenses: Array<{
    id: string;
    amount: number;
    transactionRef: string;
    description: string | null;
    category: string | null;
    createdAt: string;
  }>;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function pdfMethodLabel(method: string) {
  if (method === "AUTRE") return "Autre";
  return formatModePaiementLabel(method);
}

function pdfCashierName(name?: string | null) {
  const value = name?.trim();
  return value && value.length > 0 ? value : "Non renseigné";
}

function buildPeriodDetail(dateStart: string, dateEnd?: string): string {
  const formattedStart = new Date(dateStart).toLocaleDateString("fr-FR");
  const formattedEnd = dateEnd
    ? new Date(dateEnd).toLocaleDateString("fr-FR")
    : null;

  return formattedEnd && formattedEnd !== formattedStart
    ? `Période du ${formattedStart} au ${formattedEnd}`
    : `Date : ${formattedStart}`;
}

export async function buildCashierReportPdf(
  data: ReportData,
  context: SchoolReportContext,
  options: CashierReportPdfOptions,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const title = "Rapport de Caisse";
  const periodDetail = buildPeriodDetail(options.dateStart, options.dateEnd);
  const branchLabel = context.branchName || context.schoolName;
  const currency = context.baseCurrency ?? "USD";
  const money = (value: number) => formatReportAmount(value, currency);
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 10;
  const usableWidth = pageWidth - marginX * 2;

  const drawHeader = () => {
    drawReportHeader(doc, context, {
      title,
      subtitle: context.branchName,
      details: [periodDetail],
      logoDataUrl: logo,
    });
  };

  // 1. Encaissements groupés par mode ; caissier sur chaque ligne de paiement
  const incomeColCount = 6;
  const incomeHead = [
    "Date / heure",
    "Référence",
    "Élève",
    "Motif",
    "Caissier",
    `Montant (${currency})`,
  ];
  type IncomeRowKind = "sequence" | "item" | "subtotal" | "grand" | "empty";
  const incomeBody: string[][] = [];
  const incomeRowKinds: IncomeRowKind[] = [];
  const methodGroups = groupCashierPaymentsByMethod(data.payments);

  if (methodGroups.length === 0) {
    incomeBody.push(["Aucun encaissement sur la période.", "", "", "", "", ""]);
    incomeRowKinds.push("empty");
  } else {
    for (const group of methodGroups) {
      const label = pdfMethodLabel(group.method);
      incomeBody.push([label, "", "", "", "", ""]);
      incomeRowKinds.push("sequence");

      for (const payment of group.payments) {
        incomeBody.push([
          formatCashierDateTime(payment.createdAt, "fr-FR"),
          payment.transactionRef || "-",
          payment.studentName || "-",
          payment.frais?.nameFrais || "-",
          pdfCashierName(payment.cashierName),
          money(payment.amount),
        ]);
        incomeRowKinds.push("item");
      }

      incomeBody.push([
        `Sous-total ${label}`,
        "",
        "",
        "",
        "",
        money(group.total),
      ]);
      incomeRowKinds.push("subtotal");
    }

    incomeBody.push([
      "Total général",
      "",
      "",
      "",
      "",
      money(data.incomeTotal),
    ]);
    incomeRowKinds.push("grand");
  }

  const incomeFirstPageTop = REPORT_HEADER_CONTENT_TOP_MM + 5;

  autoTable(doc, {
    startY: incomeFirstPageTop,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: marginX,
      bottom: 14,
      left: marginX,
    },
    tableWidth: usableWidth,
    head: [incomeHead],
    body: incomeBody,
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
      fillColor: [16, 185, 129],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: usableWidth * 0.16, halign: "center" },
      1: { cellWidth: usableWidth * 0.14 },
      2: { cellWidth: usableWidth * 0.16 },
      3: { cellWidth: usableWidth * 0.16 },
      4: { cellWidth: usableWidth * 0.18 },
      5: { cellWidth: usableWidth * 0.2, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const kind = incomeRowKinds[data.row.index];
      const lastCol = incomeColCount - 1;
      if (kind === "sequence") {
        if (data.column.index === 0) {
          data.cell.colSpan = incomeColCount;
          data.cell.styles.fillColor = [16, 185, 129];
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.halign = "left";
        } else {
          data.cell.styles.cellWidth = 0;
          data.cell.text = [];
        }
        return;
      }
      if (kind === "subtotal") {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [15, 23, 42];
        if (data.column.index === 0) {
          data.cell.colSpan = lastCol;
          data.cell.styles.halign = "right";
        } else if (data.column.index < lastCol) {
          data.cell.styles.cellWidth = 0;
          data.cell.text = [];
        } else {
          data.cell.styles.halign = "right";
        }
        return;
      }
      if (kind === "grand") {
        data.cell.styles.fillColor = [15, 23, 42];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = 255;
        if (data.column.index === 0) {
          data.cell.colSpan = lastCol;
          data.cell.styles.halign = "right";
        } else if (data.column.index < lastCol) {
          data.cell.styles.cellWidth = 0;
          data.cell.text = [];
        } else {
          data.cell.styles.halign = "right";
        }
        return;
      }
      if (kind === "empty") {
        if (data.column.index === 0) {
          data.cell.colSpan = incomeColCount;
          data.cell.styles.halign = "center";
          data.cell.styles.fontStyle = "italic";
          data.cell.styles.textColor = [100, 116, 139];
        } else {
          data.cell.styles.cellWidth = 0;
          data.cell.text = [];
        }
      }
    },
    didDrawPage: (hookData) => {
      drawHeader();
      if (hookData.pageNumber === 1) {
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text("Détail des Encaissements", marginX, REPORT_HEADER_CONTENT_TOP_MM - 2);
      }
    },
  });

  // 2. Table des dépenses
  let finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? REPORT_HEADER_CONTENT_TOP_MM;

  if (data.expenses.length > 0) {
    const expenseHead = [
      "Date / heure",
      "Référence",
      "Catégorie",
      "Description",
      `Montant (${currency})`,
    ];
    const expenseBody = data.expenses.map((e) => [
      formatCashierDateTime(e.createdAt, "fr-FR"),
      e.transactionRef || "-",
      e.category || "-",
      e.description || "-",
      money(e.amount),
    ]);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("Détail des dépenses / sorties de fond", marginX, finalY + 10);

    autoTable(doc, {
      startY: finalY + 14,
      margin: { right: marginX, left: marginX, bottom: 14 },
      tableWidth: usableWidth,
      head: [expenseHead],
      body: expenseBody,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [225, 29, 72],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: usableWidth * 0.2, halign: "center" },
        1: { cellWidth: usableWidth * 0.18 },
        2: { cellWidth: usableWidth * 0.16 },
        3: { cellWidth: usableWidth * 0.28 },
        4: { cellWidth: usableWidth * 0.18, halign: "right" },
      },
    });

    finalY =
      (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY ?? finalY;
  }

  // 3. Totaux (Summary box)
  if (finalY + 44 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    drawHeader();
    finalY = REPORT_HEADER_CONTENT_TOP_MM;
  } else {
    finalY += 15;
  }

  const boxWidth = 110;
  const boxX = marginX;
  const labelX = boxX + 4;
  const valueX = boxX + boxWidth - 4;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(boxX, finalY, boxWidth, 42, 2, 2, "FD");

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Récapitulatif", labelX, finalY + 6);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const opening = data.openingBalance ?? 0;

  doc.text("Solde d'ouverture (veille) :", labelX, finalY + 14);
  doc.text(money(opening), valueX, finalY + 14, { align: "right" });

  doc.text("Total Encaissements :", labelX, finalY + 20);
  doc.setTextColor(16, 185, 129);
  doc.text(money(data.incomeTotal), valueX, finalY + 20, {
    align: "right",
  });

  doc.setTextColor(15, 23, 42);
  doc.text("Total dépenses / sorties de fond :", labelX, finalY + 26);
  doc.setTextColor(225, 29, 72);
  doc.text(money(data.outflowTotal), valueX, finalY + 26, {
    align: "right",
  });

  doc.setDrawColor(203, 213, 225);
  doc.line(labelX, finalY + 30, valueX, finalY + 30);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Solde Net :", labelX, finalY + 36);
  doc.text(money(data.balance), valueX, finalY + 36, { align: "right" });

  drawReportFooterOnAllPages(doc, context, {
    leftText: branchLabel,
  });

  return doc;
}

export async function exportCashierReportPdf(
  data: ReportData,
  context: SchoolReportContext,
  options: CashierReportPdfOptions,
) {
  const doc = await buildCashierReportPdf(data, context, options);
  const startPart = new Date(options.dateStart).toISOString().slice(0, 10);
  const endPart = options.dateEnd
    ? new Date(options.dateEnd).toISOString().slice(0, 10)
    : startPart;

  const branchPart = safeFilePart(
    context.branchName || context.schoolName || "branche",
  );
  let reportName = `rapport-caisse-${branchPart}-${startPart}`;
  if (startPart !== endPart) {
    reportName += `-au-${endPart}`;
  }

  doc.save(`${reportName}.pdf`);
}
