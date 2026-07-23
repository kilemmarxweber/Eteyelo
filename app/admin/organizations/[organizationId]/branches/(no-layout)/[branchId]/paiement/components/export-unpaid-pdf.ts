import autoTable from "jspdf-autotable";
import {
  createBrandedReportDoc,
  finishBrandedReport,
  reportHeaderOnLaterPages,
  reportTableMargin,
  REPORT_TABLE_BASE,
} from "@/lib/reports/report-pdf-kit";
import type { SchoolReportContext } from "@/lib/reports/types";
import type { UnpaidFinancialStatus, UnpaidReportRow } from "../paiement.action";

export type UnpaidReportOptions = {
  schoolYearLabel?: string | null;
  classeName?: string | null;
  emptyMessage?: string;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function unpaidStatusLabel(status: UnpaidFinancialStatus): string {
  switch (status) {
    case "A_JOUR":
      return "À jour";
    case "PARTIEL":
      return "Partiel";
    case "EN_RETARD":
      return "En retard";
    default:
      return status;
  }
}

/** Titre PDF aligné sur les filtres UI. */
export function buildUnpaidReportTitle(
  options: UnpaidReportOptions = {},
): string {
  const classeName = options.classeName?.trim();
  if (classeName) {
    return `Situation financière — ${classeName}`;
  }
  return "Situation financière / impayés";
}

/** Libellés des filtres actifs (sous-titre / métadonnées). */
export function buildUnpaidReportFilterLabels(
  options: UnpaidReportOptions = {},
): string[] {
  const labels: string[] = [];
  const year = options.schoolYearLabel?.trim();
  const classeName = options.classeName?.trim();

  if (year) labels.push(`Année : ${year}`);
  if (classeName) labels.push(`Classe : ${classeName}`);

  return labels;
}

function buildReportFileName(options: UnpaidReportOptions = {}): string {
  const parts = ["situation-financiere"];
  const year = options.schoolYearLabel?.trim();
  const classeName = options.classeName?.trim();

  if (year) parts.push(safeFilePart(year));
  if (classeName) parts.push(safeFilePart(classeName));

  return parts.join("-");
}

export async function buildUnpaidReportPdf(
  rows: UnpaidReportRow[],
  context: SchoolReportContext,
  options: UnpaidReportOptions = {},
) {
  const title = buildUnpaidReportTitle(options);
  const filterLabels = buildUnpaidReportFilterLabels(options);
  const emptyMessage =
    options.emptyMessage?.trim() ||
    "Aucun élève pour ces filtres.";

  const totalDu = rows.reduce((sum, row) => sum + row.montantDu, 0);
  const totalPaye = rows.reduce((sum, row) => sum + row.montantPaye, 0);
  const totalReste = rows.reduce((sum, row) => sum + row.reste, 0);
  const counts = {
    aJour: rows.filter((r) => r.status === "A_JOUR").length,
    partiel: rows.filter((r) => r.status === "PARTIEL").length,
    enRetard: rows.filter((r) => r.status === "EN_RETARD").length,
  };

  const { doc, contentTop, marginX, usableWidth, headerOptions, context: ctx } =
    await createBrandedReportDoc(context, {
      title,
      details: [
        ...filterLabels,
        rows.length > 0
          ? `${rows.length} élève(s) — À jour ${counts.aJour} · Partiel ${counts.partiel} · En retard ${counts.enRetard}`
          : emptyMessage,
        ...(rows.length > 0
          ? [
              `Total dû : ${formatUsd(totalDu)}`,
              `Total payé : ${formatUsd(totalPaye)}`,
              `Total reste : ${formatUsd(totalReste)}`,
            ]
          : []),
      ],
    });

  const head = ["Élève", "Classe", "Dû", "Payé", "Reste", "Statut"];
  const body =
    rows.length > 0
      ? rows.map((row) => [
          row.studentName,
          row.classeName,
          formatUsd(row.montantDu),
          formatUsd(row.montantPaye),
          formatUsd(row.reste),
          unpaidStatusLabel(row.status),
        ])
      : [[emptyMessage, "", "", "", "", ""]];

  autoTable(doc, {
    startY: contentTop,
    margin: reportTableMargin(contentTop, marginX),
    tableWidth: usableWidth,
    head: [head],
    body,
    ...REPORT_TABLE_BASE,
    columnStyles: {
      0: { cellWidth: usableWidth * 0.28 },
      1: { cellWidth: usableWidth * 0.18 },
      2: { cellWidth: usableWidth * 0.14,halign: "right" },
      3: { cellWidth: usableWidth * 0.14,halign: "right" },
      4: { cellWidth: usableWidth * 0.14,halign: "right" },
      5: { cellWidth: usableWidth * 0.12,halign: "center" },
    },
    didParseCell: (data) => {
      if (rows.length === 0 && data.section === "body") {
        if (data.column.index === 0) {
          data.cell.colSpan = 6;
          data.cell.styles.halign = "center";
          data.cell.styles.fontStyle = "italic";
          data.cell.styles.textColor = [100, 116, 139];
        } else {
          data.cell.styles.cellWidth = 0;
          data.cell.text = [];
        }
      }
    },
    didDrawPage: reportHeaderOnLaterPages(doc, ctx, headerOptions),
  });

  finishBrandedReport(doc, ctx);
  return doc;
}

export async function exportUnpaidReportPdf(
  rows: UnpaidReportRow[],
  context: SchoolReportContext,
  options: UnpaidReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(options);
  const doc = await buildUnpaidReportPdf(rows, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
