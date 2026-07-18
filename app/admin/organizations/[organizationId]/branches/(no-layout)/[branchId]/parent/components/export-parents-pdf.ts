import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import type { IParent } from "@/src/interfaces/Parent";
import type { IStudent } from "@/src/interfaces/Student";

export type ParentSexeFilter = "masculin" | "feminin" | "M" | "F";
export type ParentStatusFilter = "active" | "archived";

export type ParentReportOptions = {
  /** Filtre sexe UI si un seul statut actif. */
  sexe?: ParentSexeFilter | null;
  /** Filtre archivage UI si un seul statut actif. */
  status?: ParentStatusFilter | null;
};

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function sexeLabel(sexe: ParentSexeFilter): string {
  if (sexe === "M" || sexe === "masculin") return "Masculin";
  return "Féminin";
}

function statusLabel(status: ParentStatusFilter): string {
  return status === "active" ? "Actifs" : "Archivés";
}

function formatFullName(parent: IParent): string {
  return (
    [parent.nom, parent.postnom, parent.prenom].filter(Boolean).join(" ") || "-"
  );
}

function formatContact(parent: IParent): string {
  const parts = [parent.telephone, parent.email]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : "-";
}

function formatChildName(student: IStudent): string {
  return (
    [student.prenom, student.nom, student.postnom].filter(Boolean).join(" ") ||
    "-"
  );
}

function formatChildren(parent: IParent): string {
  const children = (parent.students ?? []).filter(
    (student) => student.statusUser !== false,
  );
  if (children.length === 0) return "Aucun";

  return children
    .map((student) => {
      const name = formatChildName(student);
      const classe = student.className?.trim() || student.classCode?.trim();
      return classe ? `${name} (${classe})` : name;
    })
    .join("\n");
}

/** Titre PDF aligné sur l'intention des filtres UI. */
export function buildParentsReportTitle(
  options: ParentReportOptions = {},
): string {
  const sexe = options.sexe ?? null;
  const status = options.status ?? null;
  let title = "Liste des parents / tuteurs";

  if (status) {
    title = `${title} — ${statusLabel(status)}`;
  }

  if (sexe) {
    title = `${title} — ${sexeLabel(sexe)}`;
  }

  return title;
}

/** Libellés des filtres actifs (pour sous-titre / métadonnées). */
export function buildParentsReportFilterLabels(
  options: ParentReportOptions = {},
): string[] {
  const labels: string[] = [];
  const sexe = options.sexe ?? null;
  const status = options.status ?? null;

  if (status) {
    labels.push(`Statut : ${statusLabel(status)}`);
  }
  if (sexe) {
    labels.push(`Sexe : ${sexeLabel(sexe)}`);
  }

  return labels;
}

function buildReportFileName(options: ParentReportOptions = {}): string {
  const parts = ["liste-parents"];
  const sexe = options.sexe ?? null;
  const status = options.status ?? null;

  if (status === "active") parts.push("actifs");
  if (status === "archived") parts.push("archives");
  if (sexe === "M" || sexe === "masculin") parts.push("masculin");
  if (sexe === "F" || sexe === "feminin") parts.push("feminin");

  return parts.map(safeFilePart).join("-");
}

/** Applique le filtre d'archivage côté export (défaut : exclus les archivés). */
export function applyParentArchiveFilter(
  parents: IParent[],
  status: ParentStatusFilter | null | undefined = null,
): IParent[] {
  if (status === "archived") {
    return parents.filter((parent) => parent.statusUser === false);
  }
  // Actifs ou aucun filtre explicite → masquer les archivés
  return parents.filter((parent) => parent.statusUser !== false);
}

export async function buildParentsReportPdf(
  parents: IParent[],
  context: SchoolReportContext,
  options: ParentReportOptions = {},
) {
  const title = buildParentsReportTitle(options);
  const filterLabels = buildParentsReportFilterLabels(options);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const head = ["#", "Nom du parent", "Contacts", "Enfants (noms + classes)"];
  const body = parents.map((parent, index) => [
    index + 1,
    formatFullName(parent),
    formatContact(parent),
    formatChildren(parent),
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
      1: { cellWidth: 55 },
      2: { cellWidth: 55 },
      3: { cellWidth: 120 },
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details: [...filterLabels, `${parents.length} parent(s)`],
        logoDataUrl: logo,
      });
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  return doc;
}

export async function exportParentsReportPdf(
  parents: IParent[],
  context: SchoolReportContext,
  options: ParentReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildReportFileName(options);
  const doc = await buildParentsReportPdf(parents, context, options);
  doc.save(`${reportName}-${date}.pdf`);
}
