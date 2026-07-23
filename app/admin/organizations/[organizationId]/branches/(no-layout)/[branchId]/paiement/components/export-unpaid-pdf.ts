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

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const currency = context.baseCurrency ?? "USD";
  const head = [
    "Élève",
    "Classe",
    `Dû (${currency})`,
    `Payé (${currency})`,
    `Reste (${currency})`,
    "Statut",
  ];
  const body =
    rows.length > 0
      ? rows.map((row) => [
          row.studentName,
          row.classeName,
          formatReportAmount(row.montantDu, currency),
          formatReportAmount(row.montantPaye, currency),
          formatReportAmount(row.reste, currency),
          unpaidStatusLabel(row.status),
        ])
      : [[emptyMessage, "", "", "", "", ""]];

  const foot =
    rows.length > 0
      ? [
          [
            "Total",
            "",
            formatReportAmount(totalDu, currency),
            formatReportAmount(totalPaye, currency),
            formatReportAmount(totalReste, currency),
            "",
          ],
        ]
      : undefined;

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
    foot,
    theme: "grid",
    showHead: "everyPage",
    showFoot: rows.length > 0 ? "lastPage" : "never",
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
    footStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 40 },
      2: { cellWidth: 32, halign: "right" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 32, halign: "right" },
      5: { cellWidth: 28, halign: "center" },
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

      if (data.section === "foot") {
        if (data.column.index === 0) {
          data.cell.styles.halign = "left";
        }
        if (data.column.index === 2 || data.column.index === 3 || data.column.index === 4) {
          data.cell.styles.halign = "right";
        }
      }
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details: [
          ...filterLabels,
          rows.length > 0
            ? `${rows.length} élève(s) — À jour ${counts.aJour} · Partiel ${counts.partiel} · En retard ${counts.enRetard}`
            : emptyMessage,
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
