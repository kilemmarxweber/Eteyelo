import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { orgRoleLabel } from "@/lib/org-role-labels";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import type { IPersonnel } from "@/src/interfaces/Personnel";

export type PersonnelSexeFilter = "M" | "F";

export type PersonnelPdfLabels = {
  listTitle: string;
  masculine: string;
  feminine: string;
  active: string;
  inactive: string;
  roleUndefined: string;
  colIndex: string;
  colIdentity: string;
  colFunction: string;
  colStatus: string;
  colContact: string;
  personnelCount: string;
  filterGender: string;
};

export type PersonnelReportOptions = {
  sexe?: PersonnelSexeFilter | null;
  labels: PersonnelPdfLabels;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function sexeLabel(sexe: PersonnelSexeFilter, labels: PersonnelPdfLabels): string {
  return sexe === "M" ? labels.masculine : labels.feminine;
}

function formatFullName(personnel: IPersonnel): string {
  return (
    [personnel.nom, personnel.postnom, personnel.prenom]
      .filter(Boolean)
      .join(" ") || "-"
  );
}

function formatContact(personnel: IPersonnel): string {
  const parts = [personnel.telephone, personnel.email]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : "-";
}

function formatFonction(
  personnel: IPersonnel,
  roleUndefined: string,
): string {
  return personnel.role ? orgRoleLabel(personnel.role) : roleUndefined;
}

function personnelStatusLabel(
  personnel: IPersonnel,
  labels: PersonnelPdfLabels,
): string {
  if (personnel.statusPersonnal === false) return labels.inactive;
  if (personnel.statusUser === false) return labels.inactive;
  return labels.active;
}

export function buildPersonnelReportTitle(
  options: PersonnelReportOptions,
): string {
  const { labels } = options;
  const sexe = options.sexe ?? null;
  let title = labels.listTitle;

  if (sexe) {
    title = `${title} — ${sexeLabel(sexe, labels)}`;
  }

  return title;
}

export function buildPersonnelReportFilterLabels(
  options: PersonnelReportOptions,
): string[] {
  const { labels } = options;
  const result: string[] = [];
  const sexe = options.sexe ?? null;

  if (sexe) {
    result.push(`${labels.filterGender} ${sexeLabel(sexe, labels)}`);
  }

  return result;
}

function buildReportFileName(options: PersonnelReportOptions): string {
  const parts = ["liste-personnel"];
  const sexe = options.sexe ?? null;

  if (sexe === "M") parts.push("masculin");
  if (sexe === "F") parts.push("feminin");

  return parts.map(safeFilePart).join("-");
}

export async function buildPersonnelReportPdf(
  personnels: IPersonnel[],
  context: SchoolReportContext,
  options: PersonnelReportOptions,
) {
  const { labels } = options;
  const title = buildPersonnelReportTitle(options);
  const filterLabels = buildPersonnelReportFilterLabels(options);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const head = [
    labels.colIndex,
    labels.colIdentity,
    labels.colFunction,
    labels.colStatus,
    labels.colContact,
  ];
  const body = personnels.map((personnel, index) => [
    index + 1,
    formatFullName(personnel),
    formatFonction(personnel, labels.roleUndefined),
    personnelStatusLabel(personnel, labels),
    formatContact(personnel),
  ]);

  const countLabel = labels.personnelCount.replace(
    "{count}",
    String(personnels.length),
  );

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
      1: { cellWidth: 70 },
      2: { cellWidth: 45 },
      3: { cellWidth: 28, halign: "center" },
      4: { cellWidth: 80 },
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details: [...filterLabels, countLabel],
        logoDataUrl: logo,
      });
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  return doc;
}

export async function exportPersonnelReportPdf(
  personnels: IPersonnel[],
  context: SchoolReportContext,
  options: PersonnelReportOptions,
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(options);
  const doc = await buildPersonnelReportPdf(personnels, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
