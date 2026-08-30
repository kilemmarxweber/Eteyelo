import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  finalizePdfDocument,
  formatFrenchDate,
  safePdfFilePart,
  downloadPdfOutput,
  type PdfOutput,
} from "@/lib/pdf/pdf-engine";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_HEADER_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import type { SchoolReportContext } from "@/lib/reports/types";
import type { JobApplicationListItem } from "@/src/interfaces/JobApplication";

export type CandidatureStatusFilter =
  | "ALL"
  | "PENDING"
  | "REVIEWED"
  | "ACCEPTED"
  | "HIRED"
  | "REJECTED";

export type CandidatureReportOptions = {
  status?: CandidatureStatusFilter | null;
};

export type CandidaturePdfLabels = {
  statusLabels: Record<string, string>;
  allStatuses: string;
  listTitle: string;
  listTitleFiltered: string;
  statusFilter: string;
  dossierTitle: string;
  reference: string;
  statusLabel: string;
  depositedOn: string;
  statusBanner: string;
  candidateIdentity: string;
  fullName: string;
  phone: string;
  typeTeacher: string;
  typeStaff: string;
  gender: string;
  genderMale: string;
  genderFemale: string;
  birthDate: string;
  address: string;
  profileSought: string;
  profileRole: string;
  yearsExperience: string;
  availability: string;
  experience: string;
  education: string;
  skills: string;
  motivation: string;
  rejectReason: string;
  timelineTitle: string;
  timelineDeposit: string;
  timelineReview: string;
  timelineAccept: string;
  timelineHire: string;
  timelineReject: string;
  applicationCount: string;
  columns: {
    index: string;
    reference: string;
    identity: string;
    type: string;
    profile: string;
    status: string;
    date: string;
  };
};

export type CandidatureDossierInput = {
  reference: string;
  status: string;
  applicationType: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe?: string | null;
  dateOfBirth?: Date | string | null;
  telephone: string;
  email: string;
  address?: string | null;
  desiredSubjects?: string | null;
  desiredLevels?: string | null;
  desiredOrgRole?: string | null;
  yearsOfExperience?: number | null;
  experienceSummary?: string | null;
  educationSummary?: string | null;
  skills?: string | null;
  availability?: string | null;
  motivation?: string | null;
  rejectedReason?: string | null;
  createdAt: Date | string;
  reviewedAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  hiredAt?: Date | string | null;
};

function formatFullName(item: {
  nom: string;
  postnom: string;
  prenom: string;
}): string {
  return (
    [item.prenom, item.nom, item.postnom].filter(Boolean).join(" ") || "-"
  );
}

function formatType(
  applicationType: string,
  labels: Pick<CandidaturePdfLabels, "typeTeacher" | "typeStaff">,
): string {
  return applicationType === "TEACHER" ? labels.typeTeacher : labels.typeStaff;
}

function formatPoste(
  item: {
    applicationType: string;
    desiredSubjects?: string | null;
    desiredLevels?: string | null;
    desiredOrgRole?: string | null;
  },
  labels: Pick<CandidaturePdfLabels, "typeTeacher" | "typeStaff">,
): string {
  if (item.applicationType === "TEACHER") {
    const parts = [item.desiredSubjects, item.desiredLevels]
      .map((part) => part?.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "-";
  }
  return item.desiredOrgRole
    ? orgRoleLabel(item.desiredOrgRole)
    : formatType(item.applicationType, labels);
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formatFrenchDate(date);
}

function statusFilterLabel(
  status: CandidatureStatusFilter,
  labels: CandidaturePdfLabels,
): string {
  if (status === "ALL") return labels.allStatuses;
  return labels.statusLabels[status] ?? status;
}

export function buildCandidaturesReportTitle(
  labels: CandidaturePdfLabels,
  options: CandidatureReportOptions = {},
): string {
  const status = options.status ?? "ALL";
  if (!status || status === "ALL") return labels.listTitle;
  return labels.listTitleFiltered.replace(
    "{status}",
    statusFilterLabel(status, labels),
  );
}

export function buildCandidaturesReportFilterLabels(
  labels: CandidaturePdfLabels,
  options: CandidatureReportOptions = {},
): string[] {
  const status = options.status ?? "ALL";
  if (!status || status === "ALL") return [];
  return [
    labels.statusFilter.replace(
      "{status}",
      statusFilterLabel(status, labels),
    ),
  ];
}

function buildListFileName(
  labels: CandidaturePdfLabels,
  options: CandidatureReportOptions = {},
): string {
  const parts = ["candidatures"];
  const status = options.status ?? "ALL";
  if (status && status !== "ALL") {
    parts.push(safePdfFilePart(statusFilterLabel(status, labels)));
  }
  return parts.join("-");
}

export async function buildCandidaturesReportPdf(
  applications: JobApplicationListItem[],
  context: SchoolReportContext,
  labels: CandidaturePdfLabels,
  options: CandidatureReportOptions = {},
) {
  const title = buildCandidaturesReportTitle(labels, options);
  const filterLabels = buildCandidaturesReportFilterLabels(labels, options);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);

  const head = [
    labels.columns.index,
    labels.columns.reference,
    labels.columns.identity,
    labels.columns.type,
    labels.columns.profile,
    labels.columns.status,
    labels.columns.date,
  ];
  const body = applications.map((application, index) => [
    index + 1,
    application.reference,
    formatFullName(application),
    formatType(application.applicationType, labels),
    formatPoste(application, labels),
    labels.statusLabels[application.status] ?? application.status,
    formatDate(application.createdAt),
  ]);

  autoTable(doc, {
    startY: REPORT_HEADER_CONTENT_TOP_MM,
    margin: {
      top: REPORT_HEADER_CONTENT_TOP_MM,
      right: 10,
      bottom: 18,
      left: 10,
    },
    head: [head],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 28 },
      2: { cellWidth: 45 },
      3: { cellWidth: 24 },
      4: { cellWidth: 55 },
      5: { cellWidth: 36 },
      6: { cellWidth: 32 },
    },
    didDrawPage: () => {
      drawReportHeader(doc, context, {
        title,
        subtitle: context.branchName,
        details: [
          ...filterLabels,
          labels.applicationCount.replace(
            "{count}",
            String(applications.length),
          ),
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

export async function exportCandidaturesReportPdf(
  applications: JobApplicationListItem[],
  context: SchoolReportContext,
  labels: CandidaturePdfLabels,
  options: CandidatureReportOptions = {},
) {
  const date = new Date().toISOString().slice(0, 10);
  const reportName = buildListFileName(labels, options);
  const doc = await buildCandidaturesReportPdf(
    applications,
    context,
    labels,
    options,
  );
  doc.save(`${reportName}-${date}.pdf`);
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 175);
  doc.text(title, 14, y);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, y + 2, doc.internal.pageSize.getWidth() - 14, y + 2);
  return y + 8;
}

function drawField(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const lines = doc.splitTextToSize(value || "-", maxWidth);
  doc.text(lines, x, y + 5);
  return y + 5 + lines.length * 4.5 + 3;
}

function drawParagraph(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  pageHeight: number,
): number {
  if (!value?.trim()) return y;
  let cursor = y;
  if (cursor > pageHeight - 40) {
    doc.addPage();
    cursor = 20;
  }
  cursor = drawSectionTitle(doc, label, cursor);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const lines = doc.splitTextToSize(value.trim(), 182);
  for (const line of lines) {
    if (cursor > pageHeight - 20) {
      doc.addPage();
      cursor = 20;
    }
    doc.text(line, 14, cursor);
    cursor += 5;
  }
  return cursor + 4;
}

export async function buildCandidatureDossierPdf(
  application: CandidatureDossierInput,
  context: SchoolReportContext,
  labels: CandidaturePdfLabels,
): Promise<PdfOutput> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const fullName = formatFullName(application);
  const statusLabel =
    labels.statusLabels[application.status] ?? application.status;

  const contentTop = drawReportHeader(doc, context, {
    title: labels.dossierTitle,
    subtitle: context.branchName,
    details: [
      labels.reference.replace("{reference}", application.reference),
      labels.statusLabel.replace("{status}", statusLabel),
      labels.depositedOn.replace(
        "{date}",
        formatDate(application.createdAt),
      ),
    ],
    logoDataUrl: logo,
  });

  let y = contentTop + 4;

  const bannerColors: Record<string, [number, number, number]> = {
    PENDING: [245, 158, 11],
    REVIEWED: [59, 130, 246],
    ACCEPTED: [16, 185, 129],
    HIRED: [5, 150, 105],
    REJECTED: [239, 68, 68],
    CANCELLED: [100, 116, 139],
  };
  const [r, g, b] = bannerColors[application.status] ?? [100, 116, 139];
  doc.setFillColor(r, g, b);
  doc.roundedRect(14, y, pageWidth - 28, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    labels.statusBanner.replace("{status}", statusLabel.toUpperCase()),
    pageWidth / 2,
    y + 7.5,
    { align: "center" },
  );
  y += 18;

  y = drawSectionTitle(doc, labels.candidateIdentity, y);
  const colWidth = (pageWidth - 28 - 8) / 2;
  const leftY = drawField(doc, labels.fullName, fullName, 14, y, colWidth);
  const rightY = drawField(
    doc,
    labels.columns.type,
    formatType(application.applicationType, labels),
    14 + colWidth + 8,
    y,
    colWidth,
  );
  y = Math.max(leftY, rightY);

  const leftY2 = drawField(doc, "Email", application.email, 14, y, colWidth);
  const rightY2 = drawField(
    doc,
    labels.phone,
    application.telephone,
    14 + colWidth + 8,
    y,
    colWidth,
  );
  y = Math.max(leftY2, rightY2);

  if (application.sexe) {
    const leftY3 = drawField(
      doc,
      labels.gender,
      application.sexe === "feminin"
        ? labels.genderFemale
        : labels.genderMale,
      14,
      y,
      colWidth,
    );
    const rightY3 = drawField(
      doc,
      labels.birthDate,
      formatDate(application.dateOfBirth),
      14 + colWidth + 8,
      y,
      colWidth,
    );
    y = Math.max(leftY3, rightY3);
  }

  if (application.address) {
    y = drawField(doc, labels.address, application.address, 14, y, pageWidth - 28);
  }

  y = drawSectionTitle(doc, labels.profileSought, y + 2);
  y = drawField(
    doc,
    labels.profileRole,
    formatPoste(application, labels),
    14,
    y,
    pageWidth - 28,
  );
  if (application.yearsOfExperience != null) {
    y = drawField(
      doc,
      labels.yearsExperience,
      String(application.yearsOfExperience),
      14,
      y,
      colWidth,
    );
  }
  if (application.availability) {
    y = drawField(
      doc,
      labels.availability,
      application.availability,
      14,
      y,
      pageWidth - 28,
    );
  }

  y = drawParagraph(
    doc,
    labels.experience,
    application.experienceSummary ?? "",
    y,
    pageHeight,
  );
  y = drawParagraph(
    doc,
    labels.education,
    application.educationSummary ?? "",
    y,
    pageHeight,
  );
  y = drawParagraph(doc, labels.skills, application.skills ?? "", y, pageHeight);
  y = drawParagraph(
    doc,
    labels.motivation,
    application.motivation ?? "",
    y,
    pageHeight,
  );

  if (application.status === "REJECTED" && application.rejectedReason) {
    y = drawParagraph(
      doc,
      labels.rejectReason,
      application.rejectedReason,
      y,
      pageHeight,
    );
  }

  const timeline: string[] = [
    labels.timelineDeposit.replace(
      "{date}",
      formatDate(application.createdAt),
    ),
  ];
  if (application.reviewedAt) {
    timeline.push(
      labels.timelineReview.replace(
        "{date}",
        formatDate(application.reviewedAt),
      ),
    );
  }
  if (application.acceptedAt) {
    timeline.push(
      labels.timelineAccept.replace(
        "{date}",
        formatDate(application.acceptedAt),
      ),
    );
  }
  if (application.hiredAt) {
    timeline.push(
      labels.timelineHire.replace("{date}", formatDate(application.hiredAt)),
    );
  }
  if (application.status === "REJECTED") {
    timeline.push(
      labels.timelineReject.replace(
        "{date}",
        formatDate(application.reviewedAt ?? application.createdAt),
      ),
    );
  }

  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }
  y = drawSectionTitle(doc, labels.timelineTitle, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  for (const line of timeline) {
    doc.text(`•  ${line}`, 16, y);
    y += 6;
  }

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  const fileName = `candidature-${safePdfFilePart(application.reference)}-${safePdfFilePart(fullName)}.pdf`;
  return finalizePdfDocument(doc, fileName);
}

export async function downloadCandidatureDossierPdf(
  application: CandidatureDossierInput,
  context: SchoolReportContext,
  labels: CandidaturePdfLabels,
) {
  const output = await buildCandidatureDossierPdf(application, context, labels);
  downloadPdfOutput(output);
  return output;
}
