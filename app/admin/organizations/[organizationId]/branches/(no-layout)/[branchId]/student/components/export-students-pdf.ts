import autoTable from "jspdf-autotable";
import type { IStudent } from "@/src/interfaces/Student";
import {
  createBrandedReportDoc,
  finishBrandedReport,
  reportHeaderOnLaterPages,
  reportTableMargin,
  REPORT_TABLE_BASE,
} from "@/lib/reports/report-pdf-kit";
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

  const { doc, contentTop, marginX, usableWidth, headerOptions, context: ctx } =
    await createBrandedReportDoc(context, {
      title,
      details: [...filterLabels, `${students.length} élève(s)`],
    });

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

  const columnStyles = isClassReport
    ? {
        0: { cellWidth: usableWidth * 0.06, halign: "center" as const },
        1: { cellWidth: usableWidth * 0.28, halign: "left" as const },
        2: { cellWidth: usableWidth * 0.18,halign: "left" as const },
        3: { cellWidth: usableWidth * 0.18,halign: "left" as const },
        4: { cellWidth: usableWidth * 0.18,halign: "left" as const },
        5: { cellWidth: usableWidth * 0.12,halign: "center" as const },
      }
    : {
        0: { cellWidth: usableWidth * 0.05,halign: "center" as const },
        1: { cellWidth: usableWidth * 0.22,halign: "left" as const },
        2: { cellWidth: usableWidth * 0.14,halign: "left" as const },
        3: { cellWidth: usableWidth * 0.14,halign: "left" as const },
        4: { cellWidth: usableWidth * 0.14,halign: "left" as const },
        5: { cellWidth: usableWidth * 0.08,halign: "center" as const },
        6: { cellWidth: usableWidth * 0.23,halign: "left" as const },
      };

  autoTable(doc, {
    startY: contentTop,
    margin: reportTableMargin(contentTop, marginX),
    tableWidth: usableWidth,
    head: [head],
    body,
    ...REPORT_TABLE_BASE,
    columnStyles,
    didDrawPage: reportHeaderOnLaterPages(doc, ctx, headerOptions),
  });

  finishBrandedReport(doc, ctx);
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
