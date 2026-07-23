import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { IStudent } from "@/src/interfaces/Student";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";

export type StudentReportSexe = "M" | "F";
export type StudentReportStatus = "active" | "inactive";

export type StudentReportOptions = {
  selectedClass?: { code: string; name: string } | null;
  /** Filtre genre UI (un seul sexe actif). */
  sexe?: StudentReportSexe | null;
  /** Filtre statut UI si présent. */
  status?: StudentReportStatus | null;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function sexeLabel(sexe: StudentReportSexe): string {
  return sexe === "M" ? "Garçons" : "Filles";
}

function statusLabel(status: StudentReportStatus): string {
  return status === "active" ? "Actifs" : "Inactifs";
}

/** Titre PDF aligné sur l'intention des filtres UI. */
export function buildStudentsReportTitle(
  options: StudentReportOptions = {},
): string {
  const selectedClass = options.selectedClass ?? null;
  const sexe = options.sexe ?? null;
  const status = options.status ?? null;

  let title = "Liste des élèves";

  if (selectedClass) {
    title = `Liste des élèves de la classe ${selectedClass.name}`;
  }

  if (sexe) {
    title = `${title} — ${sexeLabel(sexe)}`;
  }

  if (status) {
    title = `${title} — ${statusLabel(status)}`;
  }

  return title;
}

/** Libellés des filtres actifs (pour sous-titre / métadonnées). */
export function buildStudentsReportFilterLabels(
  options: StudentReportOptions = {},
): string[] {
  const labels: string[] = [];
  const selectedClass = options.selectedClass ?? null;
  const sexe = options.sexe ?? null;
  const status = options.status ?? null;

  if (selectedClass) {
    labels.push(`Classe : ${selectedClass.name}`);
  }
  if (sexe) {
    labels.push(`Genre : ${sexeLabel(sexe)}`);
  }
  if (status) {
    labels.push(`Statut : ${statusLabel(status)}`);
  }

  return labels;
}

function buildReportFileName(options: StudentReportOptions = {}): string {
  const parts = ["liste-eleves"];
  const selectedClass = options.selectedClass ?? null;
  const sexe = options.sexe ?? null;
  const status = options.status ?? null;

  if (selectedClass) {
    parts.push(safeFilePart(selectedClass.name));
  }
  if (sexe === "M") parts.push("garcons");
  if (sexe === "F") parts.push("filles");
  if (status === "active") parts.push("actifs");
  if (status === "inactive") parts.push("inactifs");

  return parts.join("-");
}

export async function buildStudentsReportPdf(
  students: IStudent[],
  context: SchoolReportContext,
  options: StudentReportOptions = {},
) {
  const selectedClass = options.selectedClass ?? null;
  const isClassReport = Boolean(selectedClass);
  const title = buildStudentsReportTitle(options);
  const filterLabels = buildStudentsReportFilterLabels(options);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const usableWidth = pageWidth - marginX * 2;
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const headerOptions = {
    title,
    subtitle: context.branchName,
    details: [...filterLabels, `${students.length} élève(s)`],
    logoDataUrl: logo,
  };

  // Dessine l'en-tête page 1 et récupère la vraie hauteur (évite le chevauchement).
  const contentTop = drawReportHeader(doc, context, headerOptions);

  const head = isClassReport
    ? ["#", "Matricule", "Nom", "Postnom", "Prénom", "Sexe"]
    : ["#", "Matricule", "Nom", "Postnom", "Prénom", "Sexe", "Classe"];

  const body = students.map((student, index) => {
    const row: (string | number)[] = [
      index + 1,
      student.username || "-",
      student.nom || "-",
      student.postnom || "-",
      student.prenom || "-",
      student.sexe || "-",
    ];
    if (!isClassReport) {
      row.push(student.className || "Non affecté");
    }
    return row;
  });

  // Largeurs proportionnelles sur toute la largeur utile A4.
  const columnStyles: Record<
    number,
    { cellWidth: number; halign: "center" | "left" }
  > = isClassReport
    ? {
        0: { cellWidth: usableWidth * 0.06, halign: "center" },
        1: { cellWidth: usableWidth * 0.28, halign: "left" },
        2: { cellWidth: usableWidth * 0.18, halign: "left" },
        3: { cellWidth: usableWidth * 0.18, halign: "left" },
        4: { cellWidth: usableWidth * 0.18, halign: "left" },
        5: { cellWidth: usableWidth * 0.12, halign: "center" },
      }
    : {
        0: { cellWidth: usableWidth * 0.05, halign: "center" },
        1: { cellWidth: usableWidth * 0.22, halign: "left" },
        2: { cellWidth: usableWidth * 0.14, halign: "left" },
        3: { cellWidth: usableWidth * 0.14, halign: "left" },
        4: { cellWidth: usableWidth * 0.14, halign: "left" },
        5: { cellWidth: usableWidth * 0.08, halign: "center" },
        6: { cellWidth: usableWidth * 0.23, halign: "left" },
      };

  autoTable(doc, {
    startY: contentTop,
    margin: {
      top: contentTop,
      right: marginX,
      bottom: 16,
      left: marginX,
    },
    tableWidth: usableWidth,
    head: [head],
    body,
    theme: "striped",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 2.8, right: 2, bottom: 2.8, left: 2 },
      overflow: "linebreak",
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
      cellPadding: { top: 3.2, right: 2, bottom: 3.2, left: 2 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawReportHeader(doc, context, headerOptions);
      }
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  return doc;
}

export async function exportStudentsReportPdf(
  students: IStudent[],
  context: SchoolReportContext,
  options: StudentReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(options);
  const doc = await buildStudentsReportPdf(students, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
