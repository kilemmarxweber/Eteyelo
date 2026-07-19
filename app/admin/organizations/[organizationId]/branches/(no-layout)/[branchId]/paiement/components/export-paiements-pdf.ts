import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ModePaiement,
  StatusPaiement,
} from "@/src/interfaces/Paiement";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import {
  DEFAULT_EXCHANGE_RATE_USD_CDF,
  type SchoolReportContext,
} from "@/lib/reports/types";

export type PaiementReportRow = {
  reference: string;
  students: string[];
  total: number;
  status: StatusPaiement;
  mode: ModePaiement;
  date: Date;
};

export type PaiementReportPeriod =
  | "today"
  | "week"
  | "month"
  | "year";

export type PaiementReportOptions = {
  period?: PaiementReportPeriod | null;
  statusFilter?: string | null;
  modeFilter?: string | null;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatCdf(value: number): string {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "CDF",
  });
}

function modeLabel(mode: ModePaiement): string {
  switch (mode) {
    case ModePaiement.ESPECES:
      return "Espèces";
    case ModePaiement.MPESA:
      return "Mpesa";
    case ModePaiement.AIRTEL_MONEY:
      return "Airtel Money";
    case ModePaiement.ORANGE_MONEY:
      return "Orange Money";
    case ModePaiement.CARTE:
      return "Carte Bancaire";
    case ModePaiement.BANQUE:
      return "Banque";
    default:
      return "Inconnu";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case StatusPaiement.VALIDE:
      return "Validé";
    case StatusPaiement.ANNULE:
      return "Annulé";
    case StatusPaiement.EN_ATTENTE:
      return "En attente";
    case StatusPaiement.REMBOURSE:
      return "Remboursé";
    default:
      return status;
  }
}

function periodLabel(period: PaiementReportPeriod): string {
  switch (period) {
    case "today":
      return "Aujourd'hui";
    case "week":
      return "Cette semaine";
    case "month":
      return "Ce mois";
    case "year":
      return "Année";
    default:
      return period;
  }
}

/** Titre PDF aligné sur l'intention des filtres UI. */
export function buildPaiementsReportTitle(
  options: PaiementReportOptions = {},
): string {
  const period = options.period ?? null;
  if (period) {
    return `Liste des paiements — ${periodLabel(period)}`;
  }
  return "Liste des paiements";
}

/** Libellés des filtres actifs (pour sous-titre / métadonnées). */
export function buildPaiementsReportFilterLabels(
  options: PaiementReportOptions = {},
): string[] {
  const labels: string[] = [];
  const period = options.period ?? null;
  const statusFilter = options.statusFilter ?? null;
  const modeFilter = options.modeFilter ?? null;

  if (period) {
    labels.push(`Période : ${periodLabel(period)}`);
  }
  if (statusFilter && statusFilter !== "all") {
    labels.push(`Statut : ${statusLabel(statusFilter)}`);
  }
  if (modeFilter && modeFilter !== "all") {
    labels.push(`Mode : ${modeLabel(modeFilter as ModePaiement)}`);
  }

  return labels;
}

function buildReportFileName(options: PaiementReportOptions = {}): string {
  const parts = ["liste-paiements"];
  const period = options.period ?? null;
  const statusFilter = options.statusFilter ?? null;
  const modeFilter = options.modeFilter ?? null;

  if (period) parts.push(period);
  if (statusFilter && statusFilter !== "all") {
    parts.push(safeFilePart(statusFilter));
  }
  if (modeFilter && modeFilter !== "all") {
    parts.push(safeFilePart(modeFilter));
  }

  return parts.join("-");
}

function resolveExchangeRate(context: SchoolReportContext): number {
  return context.exchangeRateUsdCdf ?? DEFAULT_EXCHANGE_RATE_USD_CDF;
}

export async function buildPaiementsReportPdf(
  rows: PaiementReportRow[],
  context: SchoolReportContext,
  options: PaiementReportOptions = {},
) {
  const title = buildPaiementsReportTitle(options);
  const filterLabels = buildPaiementsReportFilterLabels(options);
  const exchangeRate = resolveExchangeRate(context);
  const totalUsd = rows.reduce((sum, row) => sum + row.total, 0);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const head = ["Date", "Élève", "Mode", "USD", "CDF", "Référence"];
  const body = rows.map((row) => [
    formatDate(row.date),
    row.students.join(", ") || "-",
    modeLabel(row.mode),
    formatUsd(row.total),
    formatCdf(row.total * exchangeRate),
    row.reference,
  ]);

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: 10,
      bottom: 14,
      left: 10,
    },
    head: [head],
    body,
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
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: 70 },
      2: { cellWidth: 32, halign: "center" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 40, halign: "right" },
      5: { cellWidth: 55 },
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details: [
          ...filterLabels,
          `${rows.length} paiement(s)`,
          `Total : ${formatUsd(totalUsd)}`,
          `Taux : 1 USD = ${exchangeRate.toLocaleString("fr-FR")} CDF`,
        ],
        logoDataUrl: logo,
      });
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  return doc;
}

export async function exportPaiementsReportPdf(
  rows: PaiementReportRow[],
  context: SchoolReportContext,
  options: PaiementReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(options);
  const doc = await buildPaiementsReportPdf(rows, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
