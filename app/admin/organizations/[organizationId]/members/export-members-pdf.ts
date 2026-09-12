import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  comparePersonNames,
  formatPersonFullName,
} from "@/lib/person-full-name";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import { pdfFontsFromContext } from "@/lib/reports/pdf-font-scale";
import type { SchoolReportContext } from "@/lib/reports/types";

type MemberPdfRow = {
  role: string;
  isArchived: boolean;
  user: {
    name: string;
    postnom: string | null;
    prenom: string | null;
    telephone: string | null;
    address: string | null;
  };
};

function dash(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function primaryRole(role: string): string {
  return role.split(",")[0]?.trim() || "";
}

function memberRoleLabel(member: MemberPdfRow): string {
  const label = orgRoleLabel(primaryRole(member.role));
  return member.isArchived ? `${label} (archivé)` : label;
}

function sortMembersForPdf(members: MemberPdfRow[]) {
  return [...members].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    const byRole = memberRoleLabel(a).localeCompare(memberRoleLabel(b), "fr", {
      sensitivity: "base",
    });
    if (byRole !== 0) return byRole;
    return comparePersonNames(a.user, b.user);
  });
}

export async function exportMembersReportPdf(
  members: MemberPdfRow[],
  context: SchoolReportContext,
  options?: { roleLabel?: string | null },
) {
  const fonts = pdfFontsFromContext(context);
  const sorted = sortMembersForPdf(members);
  const roleLabel = options?.roleLabel?.trim() || null;
  const title = roleLabel
    ? `Liste des membres — ${roleLabel}`
    : "Liste des membres";
  const countLabel = `${sorted.length} membre${sorted.length === 1 ? "" : "s"}`;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: 10,
      bottom: 14,
      left: 10,
    },
    head: [["#", "Nom complet", "Adresse", "Téléphone", "Rôle"]],
    body: sorted.map((member, index) => [
      index + 1,
      formatPersonFullName(member.user) || "—",
      dash(member.user.address),
      dash(member.user.telephone),
      memberRoleLabel(member),
    ]),
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: fonts.body,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: fonts.head,
    },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 70 },
      2: { cellWidth: 95 },
      3: { cellWidth: 45 },
      4: { cellWidth: 55 },
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.schoolName,
        details: [countLabel],
        logoDataUrl: logo,
      });
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.schoolName,
  });

  const date = new Date().toISOString().slice(0, 10);
  const rolePart = roleLabel
    ? `-${roleLabel
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()}`
    : "";
  doc.save(`liste-membres${rolePart}-${date}.pdf`);
}
