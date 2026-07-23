import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import { formatReportAmount } from "@/lib/reports/format-amount";

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

  // 1. Table des encaissements
  const incomeHead = [
    "Heure",
    "Référence",
    "Élève",
    "Motif",
    "Mode",
    `Montant (${currency})`,
  ];
  const incomeBody = data.payments.map((p) => [
    new Date(p.createdAt).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    p.transactionRef || "-",
    p.studentName || "-",
    p.frais?.nameFrais || "-",
    p.method || "-",
    money(p.amount),
  ]);

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
      0: { cellWidth: usableWidth * 0.1, halign: "center" },
      1: { cellWidth: usableWidth * 0.18 },
      2: { cellWidth: usableWidth * 0.22 },
      3: { cellWidth: usableWidth * 0.22 },
      4: { cellWidth: usableWidth * 0.12, halign: "center" },
      5: { cellWidth: usableWidth * 0.16, halign: "right" },
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
      "Heure",
      "Référence",
      "Catégorie",
      "Description",
      `Montant (${currency})`,
    ];
    const expenseBody = data.expenses.map((e) => [
      new Date(e.createdAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      e.transactionRef || "-",
      e.category || "-",
      e.description || "-",
      money(e.amount),
    ]);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("Détail des Dépenses", marginX, finalY + 10);

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
        0: { cellWidth: usableWidth * 0.1, halign: "center" },
        1: { cellWidth: usableWidth * 0.2 },
        2: { cellWidth: usableWidth * 0.18 },
        3: { cellWidth: usableWidth * 0.34 },
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
  doc.text("Total Dépenses :", labelX, finalY + 26);
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
