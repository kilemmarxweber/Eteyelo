import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
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

function lastTableY(doc: jsPDF): number {
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? REPORT_HEADER_CONTENT_TOP_MM
  );
}

const TABLE_THEME = {
  theme: "grid" as const,
  styles: {
    font: "helvetica" as const,
    fontSize: 9,
    cellPadding: 2.5,
    overflow: "linebreak" as const,
    valign: "middle" as const,
  },
  headStyles: {
    fillColor: [30, 64, 175] as [number, number, number],
    textColor: 255,
    fontStyle: "bold" as const,
    halign: "left" as const,
  },
  alternateRowStyles: { fillColor: [239, 246, 255] as [number, number, number] },
};

export async function buildRapportEffectifsPdf(
  data: RapportEffectifsPdfData,
  context: SchoolReportContext,
) {
  const { summary, studentsByClass, genderStats, statusStats, attendanceStats, financeByMonth } =
    data;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const title = "Synthèse des effectifs";

  const drawHeader = () => {
    drawReportHeader(doc, context, {
      title,
      subtitle: context.branchName,
      details: [
        `${summary.activeStudents} élève(s) actif(s)`,
        `${summary.teachers} enseignant(s)`,
      ],
      logoDataUrl: logo,
    });
  };

  const margin = {
    top: REPORT_HEADER_CONTENT_TOP_MM,
    right: 14,
    bottom: 14,
    left: 14,
  };

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin,
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
    ...TABLE_THEME,
    didDrawPage: drawHeader,
  });

  autoTable(doc, {
    startY: lastTableY(doc) + 8,
    margin,
    head: [["Classe", "Total élèves"]],
    body:
      studentsByClass.length > 0
        ? studentsByClass.map((item) => [item.name, item.total])
        : [["Aucune classe", "—"]],
    ...TABLE_THEME,
    didDrawPage: drawHeader,
  });

  autoTable(doc, {
    startY: lastTableY(doc) + 8,
    margin,
    head: [["Sexe", "Total"]],
    body: genderStats.map((item) => [item.name, item.value]),
    ...TABLE_THEME,
    didDrawPage: drawHeader,
  });

  autoTable(doc, {
    startY: lastTableY(doc) + 8,
    margin,
    head: [["Statut élèves", "Total"]],
    body: statusStats.map((item) => [item.name, item.value]),
    ...TABLE_THEME,
    didDrawPage: drawHeader,
  });

  if (financeByMonth.length > 0) {
    autoTable(doc, {
      startY: lastTableY(doc) + 8,
      margin,
      head: [["Mois", "Paiements", "Dépenses"]],
      body: financeByMonth.map((item) => [
        item.month,
        `${formatMoney(item.paiements)} FC`,
        `${formatMoney(item.depenses)} FC`,
      ]),
      ...TABLE_THEME,
      didDrawPage: drawHeader,
    });
  }

  if (attendanceStats.length > 0) {
    autoTable(doc, {
      startY: lastTableY(doc) + 8,
      margin,
      head: [["Présence", "Total"]],
      body: attendanceStats.map((item) => [item.name, item.value]),
      ...TABLE_THEME,
      didDrawPage: drawHeader,
    });
  }

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

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
