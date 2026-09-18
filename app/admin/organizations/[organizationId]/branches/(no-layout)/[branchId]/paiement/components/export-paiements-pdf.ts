import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ModePaiement,
  StatusPaiement,
} from "@/src/interfaces/Paiement";
import { cycleLabel } from "@/lib/cycle";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_CONTINUATION_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import { pdfFontsFromContext } from "@/lib/reports/pdf-font-scale";
import {
  DEFAULT_EXCHANGE_RATE_USD_CDF,
  type SchoolReportContext,
} from "@/lib/reports/types";
import {
  formatReportAmount,
  formatReportNumber,
} from "@/lib/reports/format-amount";

export type PaiementReportRow = {
  reference: string;
  students: string[];
  cycles?: string[];
  classes?: string[];
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

function formatCycles(cycles?: string[]): string {
  if (!cycles?.length) return "-";
  return cycles.map((c) => cycleLabel(c)).join(", ");
}

function formatClasses(classes?: string[]): string {
  if (!classes?.length) return "-";
  return classes.join(", ");
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
  const fonts = pdfFontsFromContext(context);
  const title = buildPaiementsReportTitle(options);
  const filterLabels = buildPaiementsReportFilterLabels(options);
  const exchangeRate = resolveExchangeRate(context);
  const baseCurrency = context.baseCurrency ?? "USD";
  const totalBase = rows.reduce((sum, row) => sum + row.total, 0);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const marginX = 10;
  const usableWidth = doc.internal.pageSize.getWidth() - marginX * 2;

  const quoteLabel =
    context.quoteCurrency ??
    (baseCurrency === "USD" ? "CDF" : "USD");
  const rateLabel =
    baseCurrency === "USD" && quoteLabel === "CDF"
      ? `Taux : 1 USD = ${formatReportNumber(exchangeRate, "CDF")} CDF`
      : context.selectedRate != null
        ? `Taux : 1 ${baseCurrency} = ${formatReportNumber(context.selectedRate, quoteLabel)} ${quoteLabel}`
        : `Devise de base : ${baseCurrency}`;
  const contentTop = drawReportHeader(doc, context, {
    title,
    subtitle: context.branchName,
    details: [
      ...filterLabels,
      `${rows.length} paiement(s)`,
      `Total : ${formatReportAmount(totalBase, baseCurrency)}`,
      rateLabel,
    ],
    logoDataUrl: logo,
  });

  const head = [
    "Date",
    "Élève",
    "Cycle",
    "Classe",
    "Mode",
    baseCurrency,
    quoteLabel,
    "Référence",
  ];
  const body = rows.map((row) => {
    const quoteValue =
      baseCurrency === "USD" && quoteLabel === "CDF"
        ? formatReportAmount(row.total * exchangeRate, "CDF")
        : quoteLabel === "USD"
          ? formatReportAmount(
              exchangeRate > 0 ? row.total / exchangeRate : 0,
              "USD",
            )
          : formatReportAmount(row.total, quoteLabel);
    return [
      formatDate(row.date),
      row.students.join(", ") || "-",
      formatCycles(row.cycles),
      formatClasses(row.classes),
      modeLabel(row.mode),
      formatReportAmount(row.total, baseCurrency),
      quoteValue,
      row.reference,
    ];
  });

  autoTable(doc, {
    startY: contentTop,
    margin: {
      top: REPORT_CONTINUATION_CONTENT_TOP_MM,
      right: marginX,
      bottom: 14,
      left: marginX,
    },
    tableWidth: usableWidth,
    head: [head],
    body,
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: fonts.body,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: fonts.head,
    },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: {
      0: { cellWidth: usableWidth * 0.09, halign: "center" },
      1: { cellWidth: usableWidth * 0.2 },
      2: { cellWidth: usableWidth * 0.11 },
      3: { cellWidth: usableWidth * 0.14 },
      4: { cellWidth: usableWidth * 0.1, halign: "center" },
      5: { cellWidth: usableWidth * 0.1, halign: "right" },
      6: { cellWidth: usableWidth * 0.11, halign: "right" },
      7: { cellWidth: usableWidth * 0.15 },
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
