import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ITeacher } from "@/src/interfaces/Teacher";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";

export type TeacherAssignmentStatus = "assigned" | "unassigned";

export type TeacherReportOptions = {
  /** Filtre affectation UI si un seul statut actif. */
  assignmentStatus?: TeacherAssignmentStatus | null;
  /** Filtre classe UI (une ou plusieurs). */
  classNames?: string[];
  /** Filtre cours / matière UI (une ou plusieurs). */
  courseNames?: string[];
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function assignmentStatusLabel(status: TeacherAssignmentStatus): string {
  return status === "assigned" ? "Affectés" : "Non affectés";
}

function formatFullName(teacher: ITeacher): string {
  return (
    [teacher.nom, teacher.postnom, teacher.prenom].filter(Boolean).join(" ") ||
    "-"
  );
}

function formatContact(teacher: ITeacher): string {
  const parts = [teacher.telephone, teacher.email]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : "-";
}

function formatList(values: string[] | undefined, empty = "-"): string {
  if (!values?.length) return empty;
  return values.join(", ");
}

function teacherStatusLabel(teacher: ITeacher): string {
  if (teacher.assignmentStatus === "assigned") {
    const count = teacher.assignmentCount;
    return typeof count === "number" && count > 0
      ? `Affecté (${count})`
      : "Affecté";
  }
  if (teacher.assignmentStatus === "unassigned") return "Non affecté";
  return teacher.statusUser === false ? "Inactif" : "Actif";
}

/** Titre PDF aligné sur l'intention des filtres UI. */
export function buildTeachersReportTitle(
  options: TeacherReportOptions = {},
): string {
  const assignmentStatus = options.assignmentStatus ?? null;
  const classNames = options.classNames ?? [];
  const courseNames = options.courseNames ?? [];

  let title = "Liste des enseignants";

  if (assignmentStatus) {
    title = `Liste des enseignants — ${assignmentStatusLabel(assignmentStatus)}`;
  }

  if (classNames.length === 1) {
    title = `${title} — Classe ${classNames[0]}`;
  } else if (classNames.length > 1) {
    title = `${title} — ${classNames.length} classes`;
  }

  if (courseNames.length === 1) {
    title = `${title} — ${courseNames[0]}`;
  } else if (courseNames.length > 1) {
    title = `${title} — ${courseNames.length} cours`;
  }

  return title;
}

/** Libellés des filtres actifs (pour sous-titre / métadonnées). */
export function buildTeachersReportFilterLabels(
  options: TeacherReportOptions = {},
): string[] {
  const labels: string[] = [];
  const assignmentStatus = options.assignmentStatus ?? null;
  const classNames = options.classNames ?? [];
  const courseNames = options.courseNames ?? [];

  if (assignmentStatus) {
    labels.push(`Affectation : ${assignmentStatusLabel(assignmentStatus)}`);
  }
  if (classNames.length === 1) {
    labels.push(`Classe : ${classNames[0]}`);
  } else if (classNames.length > 1) {
    labels.push(`Classes : ${classNames.join(", ")}`);
  }
  if (courseNames.length === 1) {
    labels.push(`Cours : ${courseNames[0]}`);
  } else if (courseNames.length > 1) {
    labels.push(`Cours : ${courseNames.join(", ")}`);
  }

  return labels;
}

function buildReportFileName(options: TeacherReportOptions = {}): string {
  const parts = ["liste-enseignants"];
  const assignmentStatus = options.assignmentStatus ?? null;
  const classNames = options.classNames ?? [];
  const courseNames = options.courseNames ?? [];

  if (assignmentStatus === "assigned") parts.push("affectes");
  if (assignmentStatus === "unassigned") parts.push("non-affectes");
  if (classNames.length === 1) parts.push(safeFilePart(classNames[0]));
  if (courseNames.length === 1) parts.push(safeFilePart(courseNames[0]));

  return parts.join("-");
}

export async function buildTeachersReportPdf(
  teachers: ITeacher[],
  context: SchoolReportContext,
  options: TeacherReportOptions = {},
) {
  const title = buildTeachersReportTitle(options);
  const filterLabels = buildTeachersReportFilterLabels(options);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const head = ["#", "Nom", "Contact", "Classes", "Matières", "Statut"];
  const body = teachers.map((teacher, index) => [
    index + 1,
    formatFullName(teacher),
    formatContact(teacher),
    formatList(teacher.classNames, "Aucune"),
    formatList(teacher.courseNames, "Aucune"),
    teacherStatusLabel(teacher),
  ]);

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
    theme: "grid",
    showHead: "everyPage",
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
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 50 },
      2: { cellWidth: 55 },
      3: { cellWidth: 55 },
      4: { cellWidth: 55 },
      5: { cellWidth: 32, halign: "center" },
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details: [...filterLabels, `${teachers.length} enseignant(s)`],
        logoDataUrl: logo,
      });
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  return doc;
}

export async function exportTeachersReportPdf(
  teachers: ITeacher[],
  context: SchoolReportContext,
  options: TeacherReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(options);
  const doc = await buildTeachersReportPdf(teachers, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
