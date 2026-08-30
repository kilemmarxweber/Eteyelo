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

export type StudentPdfLabels = {
  listTitle: string;
  classTitle: string;
  boys: string;
  girls: string;
  active: string;
  inactive: string;
  unassigned: string;
  periodToday: string;
  periodWeek: string;
  periodMonth: string;
  periodAll: string;
  studentCount: string;
  colIndex: string;
  colMatricule: string;
  colLastName: string;
  colPostnom: string;
  colFirstName: string;
  colGender: string;
  colAge: string;
  colClass: string;
  colE13: string;
  colE80: string;
  colBirthDate: string;
  colBirthPlace: string;
  filterPeriod: string;
  filterYear: string;
  filterYears: string;
  filterClass: string;
  filterGender: string;
  filterStatus: string;
  filterSearch: string;
  locale: string;
};

export type StudentReportOptions = {
  selectedClass?: { code: string; name: string } | null;
  sexe?: StudentReportSexe | null;
  status?: StudentReportStatus | null;
  period?: StudentReportPeriod | null;
  schoolYears?: string[] | null;
  schoolYearIds?: string[] | null;
  search?: string | null;
  typebranch?: unknown;
  educationSystem?: unknown;
  labels: StudentPdfLabels;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function periodLabel(
  period: StudentReportPeriod,
  labels: StudentPdfLabels,
): string {
  switch (period) {
    case "today":
      return labels.periodToday;
    case "week":
      return labels.periodWeek;
    case "month":
      return labels.periodMonth;
    default:
      return labels.periodAll;
  }
}

function sexeLabel(sexe: StudentReportSexe, labels: StudentPdfLabels): string {
  return sexe === "M" ? labels.boys : labels.girls;
}

function statusLabel(
  status: StudentReportStatus,
  labels: StudentPdfLabels,
): string {
  return status === "active" ? labels.active : labels.inactive;
}

export function buildStudentsReportTitle(options: StudentReportOptions): string {
  const { labels } = options;
  const selectedClass = options.selectedClass ?? null;
  const sexe = options.sexe ?? null;
  const status = options.status ?? null;
  const period = options.period ?? null;

  let title = labels.listTitle;

  if (selectedClass) {
    title = labels.classTitle.replace("{className}", selectedClass.name);
  }

  if (sexe) {
    title = `${title} — ${sexeLabel(sexe, labels)}`;
  }

  if (status) {
    title = `${title} — ${statusLabel(status, labels)}`;
  }

  if (period && period !== "all") {
    title = `${title} — ${periodLabel(period, labels)}`;
  }

  const schoolYears = options.schoolYears?.filter(Boolean) ?? [];
  if (schoolYears.length === 1) {
    title = `${title} — ${schoolYears[0]}`;
  }

  return title;
}

export function buildStudentsReportFilterLabels(
  options: StudentReportOptions,
): string[] {
  const { labels } = options;
  const result: string[] = [];
  const selectedClass = options.selectedClass ?? null;
  const sexe = options.sexe ?? null;
  const status = options.status ?? null;
  const period = options.period ?? null;
  const schoolYears = options.schoolYears?.filter(Boolean) ?? [];
  const search = options.search?.trim() || null;

  if (period && period !== "all") {
    result.push(`${labels.filterPeriod} ${periodLabel(period, labels)}`);
  }
  if (schoolYears.length === 1) {
    result.push(`${labels.filterYear} ${schoolYears[0]}`);
  } else if (schoolYears.length > 1) {
    result.push(`${labels.filterYears} ${schoolYears.join(", ")}`);
  }
  if (selectedClass) {
    result.push(`${labels.filterClass} ${selectedClass.name}`);
  }
  if (sexe) {
    result.push(`${labels.filterGender} ${sexeLabel(sexe, labels)}`);
  }
  if (status) {
    result.push(`${labels.filterStatus} ${statusLabel(status, labels)}`);
  }
  if (search) {
    result.push(`${labels.filterSearch} ${search}`);
  }

  return result;
}

function buildReportFileName(options: StudentReportOptions): string {
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
  labels: StudentPdfLabels,
  schoolYearIds?: string[] | null,
): string {
  if (schoolYearIds?.length === 1) {
    const enrollment = student.enrollments?.find(
      (item) => item.schoolYearId === schoolYearIds[0],
    );
    if (enrollment) {
      return (
        enrollment.className ||
        enrollment.classCode ||
        labels.unassigned
      );
    }
  }
  return student.className || student.classCode || labels.unassigned;
}

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

function formatDateOfBirth(
  dateOfBirth: Date | string | null | undefined,
  locale: string,
) {
  if (!dateOfBirth) return "-";
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(locale);
}

export async function buildStudentsReportPdf(
  students: IStudent[],
  context: SchoolReportContext,
  options: StudentReportOptions,
) {
  const { labels } = options;
  const selectedClass = options.selectedClass ?? null;
  const isClassReport = Boolean(selectedClass);
  const hasYearFilter = Boolean(options.schoolYearIds?.length);
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
    details: [
      ...filterLabels,
      labels.studentCount.replace("{count}", String(students.length)),
    ],
    logoDataUrl: logo,
  };

  const contentTop = drawReportHeader(doc, context, headerOptions);

  const head = [
    labels.colIndex,
    labels.colMatricule,
    labels.colLastName,
    labels.colPostnom,
    labels.colFirstName,
    labels.colGender,
    labels.colAge,
    ...(!isClassReport ? [labels.colClass] : []),
    ...(showExamCodes ? [labels.colE13, labels.colE80] : []),
    ...(showBirthColumns ? [labels.colBirthDate, labels.colBirthPlace] : []),
  ];

  const body = students.map((student, index) => {
    const exam = resolveStudentExamCodes(student, options.schoolYearIds);
    const allowed = studentAllowsExamCodes(student, examCodesContext);
    const age = calculateAge(student.dateOfBirth);
    const row: (string | number)[] = [
      index + 1,
      student.username || "-",
      student.nom || "-",
      student.postnom || "-",
      student.prenom || "-",
      student.sexe || "-",
      age === null ? "-" : String(age),
    ];
    if (!isClassReport) {
      row.push(
        resolveStudentClassLabel(student, labels, options.schoolYearIds),
      );
    }
    if (showExamCodes) {
      row.push(allowed ? exam.e13 : "—", allowed ? exam.e80 : "—");
    }
    if (showBirthColumns) {
      row.push(
        formatDateOfBirth(student.dateOfBirth, labels.locale),
        student.placeOfBirth?.trim() || "-",
      );
    }
    return row;
  });

  type PdfColumnStyle = { cellWidth: number; halign: "center" | "left" };
  const columnStyles: Record<number, PdfColumnStyle> = (() => {
    const styles: Record<number, PdfColumnStyle> = {};
    const fractions: Array<{ width: number; align: "center" | "left" }> = [
      { width: 0.04, align: "center" },
      { width: 0.12, align: "left" },
      { width: 0.11, align: "left" },
      { width: 0.11, align: "left" },
      { width: 0.11, align: "left" },
      { width: 0.05, align: "center" },
      { width: 0.05, align: "center" },
    ];
    if (!isClassReport) fractions.push({ width: 0.12, align: "left" });
    if (showExamCodes) {
      fractions.push({ width: 0.1, align: "center" });
      fractions.push({ width: 0.1, align: "center" });
    }
    if (showBirthColumns) {
      fractions.push({ width: 0.08, align: "center" });
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
  options: StudentReportOptions,
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(options);
  const doc = await buildStudentsReportPdf(students, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
