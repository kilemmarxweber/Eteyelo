import type jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  createBrandedReportDoc,
  finishBrandedReport,
  reportHeaderOnLaterPages,
  reportTableMargin,
  REPORT_TABLE_BASE,
} from "@/lib/reports/report-pdf-kit";
import type { SchoolReportContext } from "@/lib/reports/types";

export type CashierReportPdfOptions = {
  dateStart: string;
  dateEnd?: string;
};

export type ReportData = {
  incomeTotal: number;
  outflowTotal: number;
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

const formatAmount = (value: number) =>
  value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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

function lastTableY(doc: jsPDF, fallback: number): number {
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? fallback
  );
}

export async function buildCashierReportPdf(
  data: ReportData,
  context: SchoolReportContext,
  options: CashierReportPdfOptions,
) {
  const title = "Rapport de Caisse";
  const periodDetail = buildPeriodDetail(options.dateStart, options.dateEnd);

  const { doc, contentTop, marginX, usableWidth, headerOptions, context: ctx } =
    await createBrandedReportDoc(context, {
      title,
      details: [periodDetail],
    });

  const onLaterPages = reportHeaderOnLaterPages(doc, ctx, headerOptions);

  // 1. Table des encaissements
  const incomeHead = ["Heure", "Référence", "Élève", "Motif", "Mode", "Montant"];
  const incomeBody = data.payments.map((p) => [
    new Date(p.createdAt).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    p.transactionRef || "-",
    p.studentName || "-",
    p.frais?.nameFrais || "-",
    p.method || "-",
    formatAmount(p.amount),
  ]);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Détail des Encaissements", marginX, contentTop + 4);

  autoTable(doc, {
    startY: contentTop + 8,
    margin: reportTableMargin(contentTop, marginX),
    tableWidth: usableWidth,
    head: [incomeHead],
    body: incomeBody,
    ...REPORT_TABLE_BASE,
    headStyles: {
      ...REPORT_TABLE_BASE.headStyles,
      fillColor: [16, 185, 129] as [number, number, number],
    },
    columnStyles: {
      0: { cellWidth: usableWidth * 0.1,halign: "center" },
      1: { cellWidth: usableWidth * 0.18 },
      2: { cellWidth: usableWidth * 0.24 },
      3: { cellWidth: usableWidth * 0.2 },
      4: { cellWidth: usableWidth * 0.14,halign: "center" },
      5: { cellWidth: usableWidth * 0.14,halign: "right" },
    },
    didDrawPage: onLaterPages,
  });

  // 2. Table des dépenses
  let finalY = lastTableY(doc, contentTop);

  if (data.expenses.length > 0) {
    const expenseHead = [
      "Heure",
      "Référence",
      "Catégorie",
      "Description",
      "Montant",
    ];
    const expenseBody = data.expenses.map((e) => [
      new Date(e.createdAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      e.transactionRef || "-",
      e.category || "-",
      e.description || "-",
      formatAmount(e.amount),
    ]);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("Détail des Dépenses", marginX, finalY + 10);

    autoTable(doc, {
      startY: finalY + 14,
      margin: reportTableMargin(contentTop, marginX),
      tableWidth: usableWidth,
      head: [expenseHead],
      body: expenseBody,
      ...REPORT_TABLE_BASE,
      headStyles: {
        ...REPORT_TABLE_BASE.headStyles,
        fillColor: [225, 29, 72] as [number, number, number],
      },
      columnStyles: {
        0: { cellWidth: usableWidth * 0.12,halign: "center" },
        1: { cellWidth: usableWidth * 0.2 },
        2: { cellWidth: usableWidth * 0.2 },
        3: { cellWidth: usableWidth * 0.32 },
        4: { cellWidth: usableWidth * 0.16,halign: "right" },
      },
      didDrawPage: onLaterPages,
    });

    finalY = lastTableY(doc, finalY);
  }

  // 3. Totaux (Summary box)
  if (finalY + 40 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    onLaterPages({ pageNumber: doc.getNumberOfPages() });
    finalY = contentTop;
  } else {
    finalY += 15;
  }

  const boxWidth = Math.min(90, usableWidth);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, finalY, boxWidth, 35, 2, 2, "FD");

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Récapitulatif", marginX + 4, finalY + 6);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const amountRight = marginX + boxWidth - 4;

  doc.text("Total Encaissements :", marginX + 4, finalY + 14);
  doc.setTextColor(16, 185, 129);
  doc.text(formatAmount(data.incomeTotal), amountRight, finalY + 14, {
    align: "right",
  });

  doc.setTextColor(15, 23, 42);
  doc.text("Total Dépenses :", marginX + 4, finalY + 20);
  doc.setTextColor(225, 29, 72);
  doc.text(formatAmount(data.outflowTotal), amountRight, finalY + 20, {
    align: "right",
  });

  doc.setDrawColor(203, 213, 225);
  doc.line(marginX + 4, finalY + 24, marginX + boxWidth - 4, finalY + 24);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Solde Net :", marginX + 4, finalY + 30);
  doc.text(formatAmount(data.balance), amountRight, finalY + 30, {
    align: "right",
  });

  finishBrandedReport(doc, ctx);
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
