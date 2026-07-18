import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
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
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: 10,
      bottom: 14,
      left: 10,
    },
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
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 9,
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
      0: { cellWidth: 10, halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details,
        logoDataUrl: logo,
      });
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

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
