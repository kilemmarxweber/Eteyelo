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

export type PersonnelReportOptions = {
  /** Filtre sexe UI si un seul statut actif. */
  sexe?: PersonnelSexeFilter | null;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function sexeLabel(sexe: PersonnelSexeFilter): string {
  return sexe === "M" ? "Masculin" : "Féminin";
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

function formatFonction(personnel: IPersonnel): string {
  return personnel.role ? orgRoleLabel(personnel.role) : "Non défini";
}

function personnelStatusLabel(personnel: IPersonnel): string {
  if (personnel.statusPersonnal === false) return "Inactif";
  if (personnel.statusUser === false) return "Inactif";
  return "Actif";
}

/** Titre PDF aligné sur l'intention des filtres UI. */
export function buildPersonnelReportTitle(
  options: PersonnelReportOptions = {},
): string {
  const sexe = options.sexe ?? null;
  let title = "Liste du personnel";

  if (sexe) {
    title = `${title} — ${sexeLabel(sexe)}`;
  }

  return title;
}

/** Libellés des filtres actifs (pour sous-titre / métadonnées). */
export function buildPersonnelReportFilterLabels(
  options: PersonnelReportOptions = {},
): string[] {
  const labels: string[] = [];
  const sexe = options.sexe ?? null;

  if (sexe) {
    labels.push(`Sexe : ${sexeLabel(sexe)}`);
  }

  return labels;
}

function buildReportFileName(options: PersonnelReportOptions = {}): string {
  const parts = ["liste-personnel"];
  const sexe = options.sexe ?? null;

  if (sexe === "M") parts.push("masculin");
  if (sexe === "F") parts.push("feminin");

  return parts.map(safeFilePart).join("-");
}

export async function buildPersonnelReportPdf(
  personnels: IPersonnel[],
  context: SchoolReportContext,
  options: PersonnelReportOptions = {},
) {
  const title = buildPersonnelReportTitle(options);
  const filterLabels = buildPersonnelReportFilterLabels(options);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const head = ["#", "Identité", "Fonction", "Statut", "Contact"];
  const body = personnels.map((personnel, index) => [
    index + 1,
    formatFullName(personnel),
    formatFonction(personnel),
    personnelStatusLabel(personnel),
    formatContact(personnel),
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
      1: { cellWidth: 70 },
      2: { cellWidth: 45 },
      3: { cellWidth: 28, halign: "center" },
      4: { cellWidth: 80 },
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details: [...filterLabels, `${personnels.length} personnel(s)`],
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
  options: PersonnelReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(options);
  const doc = await buildPersonnelReportPdf(personnels, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
