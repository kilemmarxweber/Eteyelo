import autoTable from "jspdf-autotable";

import {
  createBrandedReportDoc,
  finishBrandedReport,
  reportHeaderOnLaterPages,
  reportTableMargin,
  REPORT_TABLE_BASE,
} from "@/lib/reports/report-pdf-kit";
import type { SchoolReportContext } from "@/lib/reports/types";

export type FicheNotesReportInfo = {
  coursName: string;
  teacher: string;
  anneeName: string;
  typeFiche: string;
  periodeName: string;
  classeName: string;
  dateCreated: string;
};

export type FicheNotesReportRow = {
  nom: string;
  studentSurname: string;
  studentusername: string;
  studentSexe: string;
  score: number;
  maxScore: number;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function buildFicheNotesTitle(info: FicheNotesReportInfo): string {
  return `Fiche de notes — ${info.coursName}`;
}

function buildFicheNotesDetails(info: FicheNotesReportInfo): string[] {
  return [
    info.classeName ? `Classe : ${info.classeName}` : "",
    info.periodeName ? `Période : ${info.periodeName}` : "",
    info.typeFiche ? `Type : ${info.typeFiche}` : "",
    info.teacher ? `Enseignant : ${info.teacher}` : "",
    info.dateCreated ? `Date : ${info.dateCreated}` : "",
  ].filter(Boolean);
}

export async function buildFicheNotesReportPdf(
  notes: FicheNotesReportRow[],
  context: SchoolReportContext,
  ficheInfo: FicheNotesReportInfo,
) {
  const title = buildFicheNotesTitle(ficheInfo);
  const details = buildFicheNotesDetails(ficheInfo);

  const { doc, contentTop, marginX, usableWidth, headerOptions, context: ctx } =
    await createBrandedReportDoc(context, {
      title,
      details,
    });

  autoTable(doc, {
    startY: contentTop,
    margin: reportTableMargin(contentTop, marginX),
    tableWidth: usableWidth,
    head: [["#", "Nom", "Prénom", "Username", "Sexe", "Score", "Max"]],
    body: notes.map((n, index) => [
      index + 1,
      n.nom,
      n.studentSurname,
      n.studentusername,
      n.studentSexe,
      n.score,
      n.maxScore,
    ]),
    ...REPORT_TABLE_BASE,
    styles: {
      ...REPORT_TABLE_BASE.styles,
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: usableWidth * 0.06,halign: "center" },
      1: { cellWidth: usableWidth * 0.2 },
      2: { cellWidth: usableWidth * 0.18 },
      3: { cellWidth: usableWidth * 0.22 },
      4: { cellWidth: usableWidth * 0.1,halign: "center" },
      5: { cellWidth: usableWidth * 0.12,halign: "center" },
      6: { cellWidth: usableWidth * 0.12,halign: "center" },
    },
    didDrawPage: reportHeaderOnLaterPages(doc, ctx, headerOptions),
  });

  finishBrandedReport(doc, ctx);
  return doc;
}

export async function exportFicheNotesReportPdf(
  notes: FicheNotesReportRow[],
  context: SchoolReportContext,
  ficheInfo: FicheNotesReportInfo,
) {
  const doc = await buildFicheNotesReportPdf(notes, context, ficheInfo);
  const coursePart = safeFilePart(ficheInfo.coursName || "cours");
  const classPart = safeFilePart(ficheInfo.classeName || "classe");
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`fiche-notes-${coursePart}-${classPart}-${date}.pdf`);
}
