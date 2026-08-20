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
export type StudentReportPeriod = "all" | "today" | "week" | "month";

export type StudentReportOptions = {
  selectedClass?: { code: string; name: string } | null;
  /** Filtre genre UI (un seul sexe actif). */
  sexe?: StudentReportSexe | null;
  /** Filtre statut UI si présent. */
  status?: StudentReportStatus | null;
  /** Filtre période d'enregistrement. */
  period?: StudentReportPeriod | null;
  /** Libellés des années scolaires filtrées. */
  schoolYears?: string[] | null;
  /** Ids des années scolaires filtrées (affichage classe). */
  schoolYearIds?: string[] | null;
  /** Texte de recherche actif. */
  search?: string | null;
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

function periodLabel(period: StudentReportPeriod): string {
  switch (period) {
    case "today":
      return "Aujourd'hui";
    case "week":
      return "Semaine";
    case "month":
      return "Mois";
    default:
      return "Toute";
  }
}

/** Titre PDF aligné sur l'intention des filtres UI. */
export function buildStudentsReportTitle(
  options: StudentReportOptions = {},
): string {
  const selectedClass = options.selectedClass ?? null;
  const sexe = options.sexe ?? null;
  const status = options.status ?? null;
  const period = options.period ?? null;

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

  if (period && period !== "all") {
    title = `${title} — ${periodLabel(period)}`;
  }

  const schoolYears = options.schoolYears?.filter(Boolean) ?? [];
  if (schoolYears.length === 1) {
    title = `${title} — ${schoolYears[0]}`;
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
  const period = options.period ?? null;
  const schoolYears = options.schoolYears?.filter(Boolean) ?? [];
  const search = options.search?.trim() || null;

  if (period && period !== "all") {
    labels.push(`Période : ${periodLabel(period)}`);
  }
  if (schoolYears.length === 1) {
    labels.push(`Année : ${schoolYears[0]}`);
  } else if (schoolYears.length > 1) {
    labels.push(`Années : ${schoolYears.join(", ")}`);
  }
  if (selectedClass) {
    labels.push(`Classe : ${selectedClass.name}`);
  }
  if (sexe) {
    labels.push(`Genre : ${sexeLabel(sexe)}`);
  }
  if (status) {
    labels.push(`Statut : ${statusLabel(status)}`);
  }
  if (search) {
    labels.push(`Recherche : ${search}`);
  }

  return labels;
}

function buildReportFileName(options: StudentReportOptions = {}): string {
  const parts = ["liste-eleves"];
  const selectedClass = options.selectedClass ?? null;
  const sexe = options.sexe ?? null;
  const status = options.status ?? null;
  const period = options.period ?? null;

  if (selectedClass) {
    parts.push(safeFilePart(selectedClass.name));
  }
  if (sexe === "M") parts.push("garcons");
  if (sexe === "F") parts.push("filles");
  if (status === "active") parts.push("actifs");
  if (status === "inactive") parts.push("inactifs");
  if (period && period !== "all") parts.push(period);

  return parts.join("-");
}

function resolveStudentClassLabel(
  student: IStudent,
  schoolYearIds?: string[] | null,
): string {
  if (schoolYearIds?.length === 1) {
    const enrollment = student.enrollments?.find(
      (item) => item.schoolYearId === schoolYearIds[0],
    );
    if (enrollment) {
      return enrollment.className || enrollment.classCode || "Non affecté";
    }
  }
  return student.className || student.classCode || "Non affecté";
}

function calculateAge(dateOfBirth: Date | string | null | undefined) {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const birthdayNotReached =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (birthdayNotReached) age -= 1;
  return age >= 0 ? age : null;
}

function formatDateOfBirth(dateOfBirth: Date | string | null | undefined) {
  if (!dateOfBirth) return "-";
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

export async function buildStudentsReportPdf(
  students: IStudent[],
  context: SchoolReportContext,
  options: StudentReportOptions = {},
) {
  const selectedClass = options.selectedClass ?? null;
  const isClassReport = Boolean(selectedClass);
  const hasYearFilter = Boolean(options.schoolYearIds?.length);
  // Liste classe + année uniquement : pas de Date n. / Âge / Lieu de naissance.
  const isClassYearOnlyReport =
    isClassReport &&
    hasYearFilter &&
    !options.sexe &&
    (!options.period || options.period === "all") &&
    !options.search;
  const showBirthColumns = !isClassYearOnlyReport;

  const title = buildStudentsReportTitle(options);
  const filterLabels = buildStudentsReportFilterLabels(options);
  const doc = new jsPDF({
    orientation: showBirthColumns ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = showBirthColumns ? 12 : 14;
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

  const head = [
    "#",
    "Matricule",
    "Nom",
    "Postnom",
    "Prénom",
    "Sexe",
    ...(!isClassReport ? (["Classe"] as const) : []),
    ...(showBirthColumns
      ? (["Date n.", "Âge", "Lieu de naissance"] as const)
      : []),
  ];

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
      row.push(resolveStudentClassLabel(student, options.schoolYearIds));
    }
    if (showBirthColumns) {
      const age = calculateAge(student.dateOfBirth);
      row.push(
        formatDateOfBirth(student.dateOfBirth),
        age === null ? "-" : String(age),
        student.placeOfBirth?.trim() || "-",
      );
    }
    return row;
  });

  // Largeurs proportionnelles.
  const columnStyles: Record<
    number,
    { cellWidth: number; halign: "center" | "left" }
  > = (() => {
    if (isClassReport && !showBirthColumns) {
      return {
        0: { cellWidth: usableWidth * 0.06, halign: "center" as const },
        1: { cellWidth: usableWidth * 0.28, halign: "left" as const },
        2: { cellWidth: usableWidth * 0.18, halign: "left" as const },
        3: { cellWidth: usableWidth * 0.18, halign: "left" as const },
        4: { cellWidth: usableWidth * 0.18, halign: "left" as const },
        5: { cellWidth: usableWidth * 0.12, halign: "center" as const },
      };
    }
    if (isClassReport && showBirthColumns) {
      return {
        0: { cellWidth: usableWidth * 0.04, halign: "center" as const },
        1: { cellWidth: usableWidth * 0.14, halign: "left" as const },
        2: { cellWidth: usableWidth * 0.12, halign: "left" as const },
        3: { cellWidth: usableWidth * 0.12, halign: "left" as const },
        4: { cellWidth: usableWidth * 0.12, halign: "left" as const },
        5: { cellWidth: usableWidth * 0.06, halign: "center" as const },
        6: { cellWidth: usableWidth * 0.11, halign: "center" as const },
        7: { cellWidth: usableWidth * 0.06, halign: "center" as const },
        8: { cellWidth: usableWidth * 0.23, halign: "left" as const },
      };
    }
    if (!isClassReport && !showBirthColumns) {
      return {
        0: { cellWidth: usableWidth * 0.05, halign: "center" as const },
        1: { cellWidth: usableWidth * 0.22, halign: "left" as const },
        2: { cellWidth: usableWidth * 0.14, halign: "left" as const },
        3: { cellWidth: usableWidth * 0.14, halign: "left" as const },
        4: { cellWidth: usableWidth * 0.14, halign: "left" as const },
        5: { cellWidth: usableWidth * 0.08, halign: "center" as const },
        6: { cellWidth: usableWidth * 0.23, halign: "left" as const },
      };
    }
    return {
      0: { cellWidth: usableWidth * 0.035, halign: "center" as const },
      1: { cellWidth: usableWidth * 0.12, halign: "left" as const },
      2: { cellWidth: usableWidth * 0.1, halign: "left" as const },
      3: { cellWidth: usableWidth * 0.1, halign: "left" as const },
      4: { cellWidth: usableWidth * 0.1, halign: "left" as const },
      5: { cellWidth: usableWidth * 0.05, halign: "center" as const },
      6: { cellWidth: usableWidth * 0.13, halign: "left" as const },
      7: { cellWidth: usableWidth * 0.1, halign: "center" as const },
      8: { cellWidth: usableWidth * 0.05, halign: "center" as const },
      9: { cellWidth: usableWidth * 0.215, halign: "left" as const },
    };
  })();

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
