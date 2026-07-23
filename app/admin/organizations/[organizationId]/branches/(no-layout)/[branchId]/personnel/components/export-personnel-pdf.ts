import autoTable from "jspdf-autotable";

import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  createBrandedReportDoc,
  finishBrandedReport,
  reportHeaderOnLaterPages,
  reportTableMargin,
  REPORT_TABLE_BASE,
} from "@/lib/reports/report-pdf-kit";
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

  const { doc, contentTop, marginX, usableWidth, headerOptions, context: ctx } =
    await createBrandedReportDoc(context, {
      title,
      details: [...filterLabels, `${personnels.length} personnel(s)`],
    });

  const head = ["#", "Identité", "Fonction", "Statut", "Contact"];
  const body = personnels.map((personnel, index) => [
    index + 1,
    formatFullName(personnel),
    formatFonction(personnel),
    personnelStatusLabel(personnel),
    formatContact(personnel),
  ]);

  autoTable(doc, {
    startY: contentTop,
    margin: reportTableMargin(contentTop, marginX),
    tableWidth: usableWidth,
    head: [head],
    body,
    ...REPORT_TABLE_BASE,
    columnStyles: {
      0: { cellWidth: usableWidth * 0.06,halign: "center" },
      1: { cellWidth: usableWidth * 0.28 },
      2: { cellWidth: usableWidth * 0.22 },
      3: { cellWidth: usableWidth * 0.12,halign: "center" },
      4: { cellWidth: usableWidth * 0.32 },
    },
    didDrawPage: reportHeaderOnLaterPages(doc, ctx, headerOptions),
  });

  finishBrandedReport(doc, ctx);
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
