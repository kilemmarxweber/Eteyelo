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

export type RapportEffectifsSummary = {
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  boys: number;
  girls: number;
  teachers: number;
  parents: number;
  totalPayments: number;
  totalExpenses: number;
  balance: number;
};

export type RapportEffectifsPdfData = {
  summary: RapportEffectifsSummary;
  studentsByClass: Array<{ name: string; total: number }>;
  genderStats: Array<{ name: string; value: number }>;
  statusStats: Array<{ name: string; value: number }>;
  attendanceStats: Array<{ name: string; value: number }>;
  financeByMonth: Array<{
    month: string;
    paiements: number;
    depenses: number;
  }>;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? fallback
  );
}

export async function buildRapportEffectifsPdf(
  data: RapportEffectifsPdfData,
  context: SchoolReportContext,
) {
  const { summary, studentsByClass, genderStats, statusStats, attendanceStats, financeByMonth } =
    data;
  const title = "Synthèse des effectifs";

  const { doc, contentTop, marginX, usableWidth, headerOptions, context: ctx } =
    await createBrandedReportDoc(context, {
      title,
      details: [
        `${summary.activeStudents} élève(s) actif(s)`,
        `${summary.teachers} enseignant(s)`,
      ],
    });

  const onLaterPages = reportHeaderOnLaterPages(doc, ctx, headerOptions);
  const tableMargin = reportTableMargin(contentTop, marginX);

  const tableBase = {
    ...REPORT_TABLE_BASE,
    styles: {
      ...REPORT_TABLE_BASE.styles,
      fontSize: 9,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
    },
    headStyles: {
      ...REPORT_TABLE_BASE.headStyles,
      halign: "left" as const,
    },
  };

  autoTable(doc, {
    startY: contentTop,
    margin: tableMargin,
    tableWidth: usableWidth,
    head: [["Indicateur", "Valeur"]],
    body: [
      ["Élèves actifs", summary.activeStudents],
      ["Élèves inactifs", summary.inactiveStudents],
      ["Total élèves", summary.totalStudents],
      ["Garçons", summary.boys],
      ["Filles", summary.girls],
      ["Enseignants", summary.teachers],
      ["Parents", summary.parents],
      ["Paiements", `${formatMoney(summary.totalPayments)} FC`],
      ["Dépenses", `${formatMoney(summary.totalExpenses)} FC`],
      ["Balance", `${formatMoney(summary.balance)} FC`],
    ],
    ...tableBase,
    columnStyles: {
      0: { cellWidth: usableWidth * 0.55 },
      1: { cellWidth: usableWidth * 0.45 },
    },
    didDrawPage: onLaterPages,
  });

  autoTable(doc, {
    startY: lastTableY(doc, contentTop) + 8,
    margin: tableMargin,
    tableWidth: usableWidth,
    head: [["Classe", "Total élèves"]],
    body:
      studentsByClass.length > 0
        ? studentsByClass.map((item) => [item.name, item.total])
        : [["Aucune classe", "—"]],
    ...tableBase,
    columnStyles: {
      0: { cellWidth: usableWidth * 0.7 },
      1: { cellWidth: usableWidth * 0.3 },
    },
    didDrawPage: onLaterPages,
  });

  autoTable(doc, {
    startY: lastTableY(doc, contentTop) + 8,
    margin: tableMargin,
    tableWidth: usableWidth,
    head: [["Sexe", "Total"]],
    body: genderStats.map((item) => [item.name, item.value]),
    ...tableBase,
    columnStyles: {
      0: { cellWidth: usableWidth * 0.55 },
      1: { cellWidth: usableWidth * 0.45 },
    },
    didDrawPage: onLaterPages,
  });

  autoTable(doc, {
    startY: lastTableY(doc, contentTop) + 8,
    margin: tableMargin,
    tableWidth: usableWidth,
    head: [["Statut élèves", "Total"]],
    body: statusStats.map((item) => [item.name, item.value]),
    ...tableBase,
    columnStyles: {
      0: { cellWidth: usableWidth * 0.55 },
      1: { cellWidth: usableWidth * 0.45 },
    },
    didDrawPage: onLaterPages,
  });

  if (financeByMonth.length > 0) {
    autoTable(doc, {
      startY: lastTableY(doc, contentTop) + 8,
      margin: tableMargin,
      tableWidth: usableWidth,
      head: [["Mois", "Paiements", "Dépenses"]],
      body: financeByMonth.map((item) => [
        item.month,
        `${formatMoney(item.paiements)} FC`,
        `${formatMoney(item.depenses)} FC`,
      ]),
      ...tableBase,
      columnStyles: {
        0: { cellWidth: usableWidth * 0.34 },
        1: { cellWidth: usableWidth * 0.33 },
        2: { cellWidth: usableWidth * 0.33 },
      },
      didDrawPage: onLaterPages,
    });
  }

  if (attendanceStats.length > 0) {
    autoTable(doc, {
      startY: lastTableY(doc, contentTop) + 8,
      margin: tableMargin,
      tableWidth: usableWidth,
      head: [["Présence", "Total"]],
      body: attendanceStats.map((item) => [item.name, item.value]),
      ...tableBase,
      columnStyles: {
        0: { cellWidth: usableWidth * 0.55 },
        1: { cellWidth: usableWidth * 0.45 },
      },
      didDrawPage: onLaterPages,
    });
  }

  finishBrandedReport(doc, ctx);
  return doc;
}

export async function exportRapportEffectifsPdf(
  data: RapportEffectifsPdfData,
  context: SchoolReportContext,
) {
  const date = new Date().toISOString().slice(0, 10);
  const branchPart = context.branchName
    ? `-${context.branchName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()}`
    : "";
  const doc = await buildRapportEffectifsPdf(data, context);
  doc.save(`synthese-effectifs${branchPart}-${date}.pdf`);
}
