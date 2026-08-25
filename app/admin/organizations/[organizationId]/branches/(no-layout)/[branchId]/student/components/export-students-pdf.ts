import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { IStudent } from "@/src/interfaces/Student";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import { studentAllowsExamCodes } from "@/lib/exam-export-meta";

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
  typebranch?: unknown;
  educationSystem?: unknown;
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

/** Codes E13 / E80 : inscription filtrée (année) sinon valeurs préférées. */
function resolveStudentExamCodes(
  student: IStudent,
  schoolYearIds?: string[] | null,
): { e13: string; e80: string } {
  if (schoolYearIds?.length === 1) {
    const enrollment = student.enrollments?.find(
      (item) => item.schoolYearId === schoolYearIds[0],
    );
    if (enrollment) {
      return {
        e13: enrollment.e13?.trim() || "—",
        e80: enrollment.e80?.trim() || "—",
      };
    }
  }
  return {
    e13: student.e13?.trim() || "—",
    e80: student.e80?.trim() || "—",
  };
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
  const examCodesContext = {
    typebranch: options.typebranch,
    educationSystem: options.educationSystem,
    schoolYearIds: options.schoolYearIds,
  };
  const showExamCodes = students.some((student) =>
    studentAllowsExamCodes(student, examCodesContext),
  );
  const title = buildStudentsReportTitle(options);
  const filterLabels = buildStudentsReportFilterLabels(options);
  // Landscape : place pour E13 / E80 (comme Liste finalistes / Cursus).
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 10;
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
    ...(showExamCodes ? (["E13", "E80"] as const) : []),
    ...(showBirthColumns
      ? (["Date n.", "Âge", "Lieu de naissance"] as const)
      : []),
  ];

  const body = students.map((student, index) => {
    const exam = resolveStudentExamCodes(student, options.schoolYearIds);
    const allowed = studentAllowsExamCodes(student, examCodesContext);
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
    if (showExamCodes) {
      row.push(allowed ? exam.e13 : "—", allowed ? exam.e80 : "—");
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

  // Largeurs proportionnelles — E13 / E80 seulement si au moins un élève terminal.
  type PdfColumnStyle = { cellWidth: number; halign: "center" | "left" };
  const columnStyles: Record<number, PdfColumnStyle> = (() => {
    const styles: Record<number, PdfColumnStyle> = {};
    const fractions: Array<{ width: number; align: "center" | "left" }> = [
      { width: 0.04, align: "center" }, // #
      { width: 0.12, align: "left" }, // Matricule
      { width: 0.11, align: "left" }, // Nom
      { width: 0.11, align: "left" }, // Postnom
      { width: 0.11, align: "left" }, // Prénom
      { width: 0.05, align: "center" }, // Sexe
    ];
    if (!isClassReport) fractions.push({ width: 0.12, align: "left" });
    if (showExamCodes) {
      fractions.push({ width: 0.1, align: "center" });
      fractions.push({ width: 0.1, align: "center" });
    }
    if (showBirthColumns) {
      fractions.push({ width: 0.08, align: "center" });
      fractions.push({ width: 0.04, align: "center" });
      fractions.push({ width: 0.12, align: "left" });
    }
    const total = fractions.reduce((sum, item) => sum + item.width, 0);
    fractions.forEach((item, index) => {
      styles[index] = {
        cellWidth: usableWidth * (item.width / total),
        halign: item.align,
      };
    });
    return styles;
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
      fontSize: 7.5,
      cellPadding: { top: 2.5, right: 1.5, bottom: 2.5, left: 1.5 },
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
      fontSize: 7.5,
      cellPadding: { top: 3, right: 1.5, bottom: 3, left: 1.5 },
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
