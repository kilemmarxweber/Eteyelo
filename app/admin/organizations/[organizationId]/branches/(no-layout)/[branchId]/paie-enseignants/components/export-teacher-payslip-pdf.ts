import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import { formatPayrollAmount } from "@/lib/reports/format-amount";
import {
  drawReportFooterOnAllPages,
  drawReportHeader,
  REPORT_CONTINUATION_CONTENT_TOP_MM,
} from "@/lib/reports/pdf-header-footer";
import { safePdfFilePart } from "@/lib/pdf/pdf-engine";
import type { SchoolReportContext } from "@/lib/reports/types";
import {
  parsePayslipLineDetail,
  type TeacherPayslipLineDetailSnapshot,
} from "@/lib/payroll/teacher-payslip-line-detail";

export type PayslipForPdf = {
  id: string;
  year: number;
  month: number;
  currency: string;
  gross: number;
  deductions: number;
  net: number;
  status: string;
  agentKind?: string;
  teacher: {
    employmentKind: string;
    matriculeEtat: string | null;
    branchMember: {
      member: { user: { name: string; postnom: string | null; prenom: string | null } };
    } | null;
  } | null;
  personnel?: {
    branchMember?: {
      member?: { user?: { name?: string | null; postnom?: string | null; prenom?: string | null } | null } | null;
    } | null;
  } | null;
  branchMember?: {
    member?: { user?: { name?: string | null; postnom?: string | null; prenom?: string | null } | null } | null;
  } | null;
  lines: Array<{
    occurredOn: string | null;
    cycle: string | null;
    kind: string;
    label: string;
    sessions: number;
    minutes: number;
    amount: number;
    detail?: TeacherPayslipLineDetailSnapshot | null;
  }>;
};

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Présent",
  LATE: "Retard",
  ABSENT: "Absent",
  EXCUSED: "Excusé",
};

function amount(value: number, currency: string) {
  return formatPayrollAmount(value, currency);
}

function clock(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Kinshasa",
    });
  } catch {
    return "—";
  }
}

function minutes(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}`;
}

function parseDetail(value: unknown): TeacherPayslipLineDetailSnapshot | null {
  return parsePayslipLineDetail(value);
}

function lastTableY(doc: jsPDF, fallback: number) {
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? fallback
  );
}

function isSummaryGrossLine(line: PayslipForPdf["lines"][number]) {
  return line.kind === "GROSS" && !line.occurredOn;
}

export async function exportTeacherPayslipPdf(
  payslip: PayslipForPdf,
  context: SchoolReportContext,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logo = await imageUrlToDataUrl(context.logoUrl);
  const user =
    payslip.branchMember?.member?.user ??
    payslip.teacher?.branchMember?.member?.user ??
    payslip.personnel?.branchMember?.member?.user;
  const teacherName = [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ");
  const isPersonnel = payslip.agentKind === "PERSONNEL" || !payslip.teacher;
  const statusLabel = isPersonnel
    ? "Personnel · forfait"
    : `${payslip.teacher?.employmentKind === "MATRICULE" ? "Matriculé État" : "Non matriculé"}${payslip.teacher?.matriculeEtat ? ` (${payslip.teacher.matriculeEtat})` : ""}${payslip.agentKind === "BOTH" ? " + forfait personnel" : ""}`;
  const monthName = MONTHS[payslip.month - 1] ?? String(payslip.month);
  const periodLabel = `${monthName} ${payslip.year}`;
  const currencyLabel = payslip.currency === "AOA" ? "Kz" : payslip.currency;

  const headerBottomY = drawReportHeader(doc, context, {
    title: `Bulletin de paie — ${periodLabel}`,
    subtitle: context.branchName,
    details: [
      `Agent : ${teacherName || "Agent"}`,
      `Statut : ${statusLabel}`,
      `Devise : ${currencyLabel}`,
      `Net à payer : ${amount(payslip.net, payslip.currency)}`,
    ],
    logoDataUrl: logo,
  });

  const tableMargin = {
    top: REPORT_CONTINUATION_CONTENT_TOP_MM,
    left: 10,
    right: 10,
    bottom: 14,
  };

  const grossLines = payslip.lines.filter(isSummaryGrossLine);
  const recapBody: string[][] = [
    ...grossLines.map((line) => [
      line.label,
      line.sessions > 0 ? String(line.sessions) : "—",
      amount(line.amount, payslip.currency),
    ]),
    ["Total brut", "", amount(payslip.gross, payslip.currency)],
    ["Retenues", "", amount(payslip.deductions, payslip.currency)],
    ["Net à payer", "", amount(payslip.net, payslip.currency)],
  ];
  const recapOffset = grossLines.length;

  autoTable(doc, {
    startY: headerBottomY,
    margin: tableMargin,
    showHead: "everyPage",
    head: [["Libellé", "Séances", "Montant"]],
    body: recapBody,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      1: { halign: "right", cellWidth: 28 },
      2: { halign: "right", cellWidth: 42 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const rowIndex = data.row.index;
      if (rowIndex === recapOffset) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [219, 234, 254];
      } else if (rowIndex === recapOffset + 1) {
        data.cell.styles.textColor = [153, 27, 27];
      } else if (rowIndex === recapOffset + 2) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [209, 250, 229];
      }
    },
  });

  const detailRows = payslip.lines
    .filter((line) => !isSummaryGrossLine(line))
    .map((line) => {
      const detail = parseDetail(line.detail);
      const isLoss =
        line.kind === "ABSENCE" ||
        line.kind === "LATE" ||
        line.kind === "EARLY_EXIT" ||
        line.kind === "ADVANCE";
      return [
        line.occurredOn ? new Date(line.occurredOn).toLocaleDateString("fr-FR") : "",
        clock(detail?.startTime),
        clock(detail?.endTime),
        minutes(detail?.plannedMinutes),
        `${clock(detail?.checkIn)} / ${clock(detail?.checkOut)}`,
        minutes(detail?.lateMinutes ?? (line.kind === "LATE" ? line.minutes : 0)) +
          (detail?.lateWithinGrace ? " (autorisé)" : ""),
        minutes(detail?.earlyExitMinutes),
        minutes(detail?.lostMinutes ?? line.minutes),
        STATUS_LABELS[detail?.status ?? ""] ?? detail?.status ?? line.kind,
        `${line.label}${line.cycle ? ` (${line.cycle})` : ""}${detail?.waived ? " · retenue retirée" : ""}`,
        amount(
          detail?.sessionGross ?? (line.kind === "GROSS" ? line.amount : 0),
          payslip.currency,
        ),
        isLoss || detail?.waived
          ? detail?.waived
            ? `${amount(detail.waivedAmount ?? 0, payslip.currency)} (retirée)`
            : amount(line.amount, payslip.currency)
          : "—",
      ];
    });

  autoTable(doc, {
    startY: lastTableY(doc, headerBottomY) + 8,
    margin: tableMargin,
    showHead: "everyPage",
    head: [[
      "Date",
      "Début",
      "Fin",
      "Durée",
      "Pointage",
      "Retard",
      "Sortie ant.",
      "Perdues",
      "Statut",
      "Séance",
      "Valeur séance",
      "Perte",
    ]],
    body: detailRows,
    foot: [[
      "Totaux",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      amount(payslip.gross, payslip.currency),
      amount(payslip.deductions, payslip.currency),
    ]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    footStyles: {
      fillColor: [219, 234, 254],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      10: { halign: "right" },
      11: { halign: "right" },
    },
  });

  drawReportFooterOnAllPages(doc, context, {
    leftText: context.branchName || context.schoolName,
  });

  const safeName = safePdfFilePart(teacherName || "agent");
  doc.save(
    `bulletin-paie-${safeName}-${payslip.year}-${String(payslip.month).padStart(2, "0")}.pdf`,
  );
}
