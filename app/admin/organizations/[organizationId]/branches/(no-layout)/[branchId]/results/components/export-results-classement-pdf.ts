import autoTable from "jspdf-autotable";

import {
  createBrandedReportDoc,
  finishBrandedReport,
  reportHeaderOnLaterPages,
  reportTableMargin,
  REPORT_TABLE_BASE,
} from "@/lib/reports/report-pdf-kit";
import type { SchoolReportContext } from "@/lib/reports/types";
import type { StudentType } from "@/lib/types";

export type ClassementStudentBase = {
  id: string;
  noteSum: number;
  totalSum: number;
  avg: number;
  sexe?: string;
};

export type ClassementRow = {
  rank: number;
  studentId: string;
  studentName: string;
  sexe: string;
  moyenne: number;
  pointsLabel: string;
};

export type ResultsClassementReportOptions = {
  classLabels?: string[];
  periodLabel?: string;
  yearLabel?: string;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatStudentName(student: StudentType | undefined): string {
  if (!student) return "Élève inconnu";
  const parts = [student.username, student.nom, student.surname]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" ") : "Élève inconnu";
}

function formatSexe(sexe: string | undefined): string {
  if (sexe === "M") return "M";
  if (sexe === "F") return "F";
  return "-";
}

/** Construit le classement dense (même moyenne → même rang) depuis studentsBase. */
export function buildClassementRows(
  studentsBase: ClassementStudentBase[],
  students: StudentType[],
): ClassementRow[] {
  const byId = new Map(students.map((s) => [s.studentid, s]));
  const ranked = [...studentsBase].sort((a, b) => b.avg - a.avg);

  let currentRank = 0;
  let lastAvg = Number.NaN;

  return ranked.map((entry, index) => {
    if (entry.avg !== lastAvg) {
      currentRank = index + 1;
      lastAvg = entry.avg;
    }

    const student = byId.get(entry.id);
    const moyenne =
      entry.totalSum > 0
        ? Number(((entry.noteSum / entry.totalSum) * 100).toFixed(1))
        : 0;

    return {
      rank: currentRank,
      studentId: entry.id,
      studentName: formatStudentName(student),
      sexe: formatSexe(entry.sexe || student?.sexe),
      moyenne,
      pointsLabel: `${entry.noteSum} / ${entry.totalSum}`,
    };
  });
}

export function buildResultsClassementReportTitle(
  options: ResultsClassementReportOptions = {},
): string {
  const classes = options.classLabels?.filter(Boolean) ?? [];
  if (classes.length === 1) {
    return `Classement — ${classes[0]}`;
  }
  if (classes.length > 1) {
    return "Classement — classes sélectionnées";
  }
  return "Classement des résultats";
}

export function buildResultsClassementFilterLabels(
  options: ResultsClassementReportOptions = {},
): string[] {
  const labels: string[] = [];
  const classes = options.classLabels?.filter(Boolean) ?? [];

  if (classes.length === 1) {
    labels.push(`Classe : ${classes[0]}`);
  } else if (classes.length > 1) {
    labels.push(`Classes : ${classes.join(", ")}`);
  }

  if (options.periodLabel) {
    labels.push(`Période : ${options.periodLabel}`);
  }

  if (options.yearLabel) {
    labels.push(`Année : ${options.yearLabel}`);
  }

  return labels;
}

function buildReportFileName(options: ResultsClassementReportOptions = {}): string {
  const parts = ["classement-resultats"];
  const classes = options.classLabels?.filter(Boolean) ?? [];

  if (classes.length === 1) {
    parts.push(classes[0]);
  }

  if (options.periodLabel) {
    parts.push(options.periodLabel);
  }

  if (options.yearLabel) {
    parts.push(options.yearLabel);
  }

  return parts.map(safeFilePart).join("-");
}

export async function buildResultsClassementReportPdf(
  rows: ClassementRow[],
  context: SchoolReportContext,
  options: ResultsClassementReportOptions = {},
) {
  if (rows.length === 0) {
    throw new Error(
      "Aucun résultat à exporter pour cette sélection. Choisissez une classe avec des notes.",
    );
  }

  const title = buildResultsClassementReportTitle(options);
  const filterLabels = buildResultsClassementFilterLabels(options);

  const { doc, contentTop, marginX, usableWidth, headerOptions, context: ctx } =
    await createBrandedReportDoc(context, {
      title,
      details: [...filterLabels, `${rows.length} élève(s)`],
    });

  const head = ["Rang", "Élève", "Sexe", "Moyenne (%)", "Points"];
  const body = rows.map((row) => [
    String(row.rank),
    row.studentName,
    row.sexe,
    row.moyenne.toFixed(1),
    row.pointsLabel,
  ]);

  autoTable(doc, {
    startY: contentTop,
    margin: reportTableMargin(contentTop, marginX),
    tableWidth: usableWidth,
    head: [head],
    body,
    ...REPORT_TABLE_BASE,
    styles: {
      ...REPORT_TABLE_BASE.styles,
      fontSize: 9,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
    },
    columnStyles: {
      0: { cellWidth: usableWidth * 0.1,halign: "center" },
      1: { cellWidth: usableWidth * 0.42 },
      2: { cellWidth: usableWidth * 0.1,halign: "center" },
      3: { cellWidth: usableWidth * 0.18,halign: "center" },
      4: { cellWidth: usableWidth * 0.2,halign: "center" },
    },
    didDrawPage: reportHeaderOnLaterPages(doc, ctx, headerOptions),
  });

  finishBrandedReport(doc, ctx);
  return doc;
}

export async function exportResultsClassementReportPdf(
  rows: ClassementRow[],
  context: SchoolReportContext,
  options: ResultsClassementReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(options);
  const doc = await buildResultsClassementReportPdf(rows, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
