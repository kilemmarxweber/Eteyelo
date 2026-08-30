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

export type TeacherPdfLabels = {
  listTitle: string;
  assignedPlural: string;
  unassignedPlural: string;
  assigned: string;
  unassigned: string;
  active: string;
  inactive: string;
  none: string;
  colIndex: string;
  colName: string;
  colContact: string;
  colClasses: string;
  colCourses: string;
  colStatus: string;
  teacherCount: string;
  classPrefix: string;
  classesCount: string;
  coursesCount: string;
  filterAssignment: string;
  filterClass: string;
  filterClasses: string;
  filterCourse: string;
  filterCourses: string;
};

export type TeacherReportOptions = {
  assignmentStatus?: TeacherAssignmentStatus | null;
  classNames?: string[];
  courseNames?: string[];
  labels: TeacherPdfLabels;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
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

function formatList(values: string[] | undefined, empty: string): string {
  if (!values?.length) return empty;
  return values.join(", ");
}

function teacherStatusLabel(
  teacher: ITeacher,
  labels: TeacherPdfLabels,
): string {
  if (teacher.assignmentStatus === "assigned") {
    const count = teacher.assignmentCount;
    return typeof count === "number" && count > 0
      ? `${labels.assigned} (${count})`
      : labels.assigned;
  }
  if (teacher.assignmentStatus === "unassigned") return labels.unassigned;
  return teacher.statusUser === false ? labels.inactive : labels.active;
}

export function buildTeachersReportTitle(options: TeacherReportOptions): string {
  const { labels } = options;
  const assignmentStatus = options.assignmentStatus ?? null;
  const classNames = options.classNames ?? [];
  const courseNames = options.courseNames ?? [];

  let title = labels.listTitle;

  if (assignmentStatus) {
    title = `${title} — ${
      assignmentStatus === "assigned"
        ? labels.assignedPlural
        : labels.unassignedPlural
    }`;
  }

  if (classNames.length === 1) {
    title = `${title} — ${labels.classPrefix} ${classNames[0]}`;
  } else if (classNames.length > 1) {
    title = `${title} — ${classNames.length} ${labels.classesCount}`;
  }

  if (courseNames.length === 1) {
    title = `${title} — ${courseNames[0]}`;
  } else if (courseNames.length > 1) {
    title = `${title} — ${courseNames.length} ${labels.coursesCount}`;
  }

  return title;
}

export function buildTeachersReportFilterLabels(
  options: TeacherReportOptions,
): string[] {
  const { labels } = options;
  const result: string[] = [];
  const assignmentStatus = options.assignmentStatus ?? null;
  const classNames = options.classNames ?? [];
  const courseNames = options.courseNames ?? [];

  if (assignmentStatus) {
    result.push(
      `${labels.filterAssignment} : ${
        assignmentStatus === "assigned"
          ? labels.assignedPlural
          : labels.unassignedPlural
      }`,
    );
  }
  if (classNames.length === 1) {
    result.push(`${labels.filterClass} : ${classNames[0]}`);
  } else if (classNames.length > 1) {
    result.push(`${labels.filterClasses} : ${classNames.join(", ")}`);
  }
  if (courseNames.length === 1) {
    result.push(`${labels.filterCourse} : ${courseNames[0]}`);
  } else if (courseNames.length > 1) {
    result.push(`${labels.filterCourses} : ${courseNames.join(", ")}`);
  }

  return result;
}

function buildReportFileName(options: TeacherReportOptions): string {
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
  options: TeacherReportOptions,
) {
  const { labels } = options;
  const title = buildTeachersReportTitle(options);
  const filterLabels = buildTeachersReportFilterLabels(options);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const head = [
    labels.colIndex,
    labels.colName,
    labels.colContact,
    labels.colClasses,
    labels.colCourses,
    labels.colStatus,
  ];
  const body = teachers.map((teacher, index) => [
    index + 1,
    formatFullName(teacher),
    formatContact(teacher),
    formatList(teacher.classNames, labels.none),
    formatList(teacher.courseNames, labels.none),
    teacherStatusLabel(teacher, labels),
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
        details: [
          ...filterLabels,
          labels.teacherCount.replace("{count}", String(teachers.length)),
        ],
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
  options: TeacherReportOptions,
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(options);
  const doc = await buildTeachersReportPdf(teachers, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
