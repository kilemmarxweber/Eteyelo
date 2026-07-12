import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type CashierReportContext = {
  branchName: string;
  organizationName: string;
  logoUrl: string;
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

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawReportHeader(
  doc: jsPDF,
  context: CashierReportContext,
  title: string,
  logo: string | null,
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (logo) {
    try {
      doc.addImage(logo, 12, 8, 18, 18);
    } catch {
      // Ignore if logo is invalid
    }
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(context.organizationName || "Eteyelo", pageWidth / 2, 10, {
    align: "center",
  });
  doc.setFontSize(11);
  doc.text(context.branchName, pageWidth / 2, 16, { align: "center" });

  doc.setTextColor(30, 64, 175);
  doc.setFontSize(15);
  doc.text(title, pageWidth / 2, 24, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  
  const formattedStart = new Date(context.dateStart).toLocaleDateString("fr-FR");
  const formattedEnd = context.dateEnd 
    ? new Date(context.dateEnd).toLocaleDateString("fr-FR")
    : null;
    
  const periodText = formattedEnd && formattedEnd !== formattedStart
    ? `Période du ${formattedStart} au ${formattedEnd}`
    : `Date : ${formattedStart}`;

  const details = [
    periodText,
    `Généré le ${new Date().toLocaleString("fr-FR")}`,
  ].join("  |  ");
  
  doc.text(details, pageWidth / 2, 30, { align: "center" });
  doc.setDrawColor(191, 219, 254);
  doc.line(10, 33, pageWidth - 10, 33);
}

export async function buildCashierReportPdf(
  data: ReportData,
  context: CashierReportContext,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const title = "Rapport de Caisse";

  // 1. Table des encaissements
  const incomeHead = ["Heure", "Référence", "Élève", "Motif", "Mode", "Montant"];
  const incomeBody = data.payments.map((p) => [
    new Date(p.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    p.transactionRef || "-",
    p.studentName || "-",
    p.frais?.nameFrais || "-",
    p.method || "-",
    formatAmount(p.amount),
  ]);

  autoTable(doc, {
    startY: 37,
    margin: { top: 37, right: 10, bottom: 14, left: 10 },
    head: [incomeHead],
    body: incomeBody,
    theme: "grid",
    showHead: "everyPage",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2, valign: "middle" },
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
    columnStyles: { 5: { halign: "right" } },
    didDrawPage: (hookData) => {
      if (hookData.pageNumber === 1) {
        drawReportHeader(doc, context, title, logo);
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text("Détail des Encaissements", 10, 32);
      }
    },
  });

  // 2. Table des dépenses
  let finalY = (doc as any).lastAutoTable.finalY || 37;
  
  if (data.expenses.length > 0) {
    const expenseHead = ["Heure", "Référence", "Catégorie", "Description", "Montant"];
    const expenseBody = data.expenses.map((e) => [
      new Date(e.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      e.transactionRef || "-",
      e.category || "-",
      e.description || "-",
      formatAmount(e.amount),
    ]);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("Détail des Dépenses", 10, finalY + 10);

    autoTable(doc, {
      startY: finalY + 14,
      margin: { right: 10, left: 10 },
      head: [expenseHead],
      body: expenseBody,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, valign: "middle" },
      headStyles: { fillColor: [225, 29, 72], textColor: 255, fontStyle: "bold" },
      columnStyles: { 4: { halign: "right" } },
    });
    
    finalY = (doc as any).lastAutoTable.finalY;
  }

  // 3. Totaux (Summary box)
  if (finalY + 40 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    finalY = 20;
  } else {
    finalY += 15;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(10, finalY, 90, 35, 2, 2, "FD");

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Récapitulatif", 14, finalY + 6);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  doc.text("Total Encaissements :", 14, finalY + 14);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(formatAmount(data.incomeTotal), 95, finalY + 14, { align: "right" });

  doc.setTextColor(15, 23, 42);
  doc.text("Total Dépenses :", 14, finalY + 20);
  doc.setTextColor(225, 29, 72); // Rose
  doc.text(formatAmount(data.outflowTotal), 95, finalY + 20, { align: "right" });

  doc.setDrawColor(203, 213, 225);
  doc.line(14, finalY + 24, 96, finalY + 24);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Solde Net :", 14, finalY + 30);
  doc.text(formatAmount(data.balance), 95, finalY + 30, { align: "right" });

  // Add page numbers
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text(context.branchName, 10, pageHeight - 6);
    doc.text(`Page ${page} / ${totalPages}`, pageWidth - 10, pageHeight - 6, {
      align: "right",
    });
  }

  return doc;
}

export async function exportCashierReportPdf(
  data: ReportData,
  context: CashierReportContext,
) {
  const doc = await buildCashierReportPdf(data, context);
  const startPart = new Date(context.dateStart).toISOString().slice(0, 10);
  const endPart = context.dateEnd ? new Date(context.dateEnd).toISOString().slice(0, 10) : startPart;
  
  let reportName = `rapport-caisse-${safeFilePart(context.branchName)}-${startPart}`;
  if (startPart !== endPart) {
    reportName += `-au-${endPart}`;
  }
  
  doc.save(`${reportName}.pdf`);
}
