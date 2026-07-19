import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { IStudent } from "@/src/interfaces/Student";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
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

function ageFromBirthDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return "-";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return age >= 0 ? String(age) : "-";
}

function formatBirthDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

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
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const globalHead = [
    "#",
    "Matricule",
    "Nom",
    "Postnom",
    "Prenom",
    "Sexe",
    "Lieu de naissance",
    "Date de naissance",
    "Age",
    "Classe",
  ];
  const classHead = ["#", "Matricule", "Nom", "Postnom", "Prenom", "Sexe"];

  const globalBody = students.map((student, index) => [
    index + 1,
    student.username || "-",
    student.nom || "-",
    student.postnom || "-",
    student.prenom || "-",
    student.sexe || "-",
    student.placeOfBirth || "-",
    formatBirthDate(student.dateOfBirth),
    ageFromBirthDate(student.dateOfBirth),
    student.className || "Non affecte",
  ]);
  const classBody = students.map((student, index) => [
    index + 1,
    student.username || "-",
    student.nom || "-",
    student.postnom || "-",
    student.prenom || "-",
    student.sexe || "-",
  ]);

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: 10,
      bottom: 14,
      left: 10,
    },
    head: [isClassReport ? classHead : globalHead],
    body: isClassReport ? classBody : globalBody,
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: isClassReport ? 9 : 7.2,
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
    columnStyles: isClassReport
      ? {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 42 },
          2: { cellWidth: 54 },
          3: { cellWidth: 54 },
          4: { cellWidth: 54 },
          5: { cellWidth: 22, halign: "center" },
        }
      : {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 27 },
          2: { cellWidth: 31 },
          3: { cellWidth: 31 },
          4: { cellWidth: 31 },
          5: { cellWidth: 13, halign: "center" },
          6: { cellWidth: 35 },
          7: { cellWidth: 28, halign: "center" },
          8: { cellWidth: 11, halign: "center" },
          9: { cellWidth: 42 },
        },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details: [...filterLabels, `${students.length} élève(s)`],
        logoDataUrl: logo,
      });
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
