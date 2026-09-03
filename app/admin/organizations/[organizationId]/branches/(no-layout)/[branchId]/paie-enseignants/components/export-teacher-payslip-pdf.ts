import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  parsePayslipLineDetail,
  type TeacherPayslipLineDetailSnapshot,
} from "@/lib/payroll/teacher-payslip-line-detail";

type PayslipForPdf = {
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

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Présent",
  LATE: "Retard",
  ABSENT: "Absent",
  EXCUSED: "Excusé",
};

function amount(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
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

export async function exportTeacherPayslipPdf(payslip: PayslipForPdf) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const user =
    payslip.branchMember?.member?.user ??
    payslip.teacher?.branchMember?.member?.user ??
    payslip.personnel?.branchMember?.member?.user;
  const teacherName = [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ");
  const isPersonnel = payslip.agentKind === "PERSONNEL" || !payslip.teacher;
  const statusLabel = isPersonnel
    ? "Personnel · forfait"
    : `${payslip.teacher?.employmentKind === "MATRICULE" ? "Matriculé État" : "Non matriculé"}${payslip.teacher?.matriculeEtat ? ` (${payslip.teacher.matriculeEtat})` : ""}${payslip.agentKind === "BOTH" ? " + forfait personnel" : ""}`;

  doc.setFontSize(16);
  doc.text("BULLETIN DE PAIE — PERSONNEL", 148, 14, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Période : ${String(payslip.month).padStart(2, "0")}/${payslip.year}`, 14, 24);
  doc.text(`Agent : ${teacherName || "Agent"}`, 14, 30);
  doc.text(`Statut : ${statusLabel}`, 14, 36);
  doc.text(`Devise de base : ${payslip.currency}`, 14, 42);

  autoTable(doc, {
    startY: 48,
    head: [["Brut", "Retenues", "Net à payer", "Statut"]],
    body: [[
      amount(payslip.gross, payslip.currency),
      amount(payslip.deductions, payslip.currency),
      amount(payslip.net, payslip.currency),
      payslip.status,
    ]],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  const detailRows = payslip.lines
    .map((line) => {
      const detail = parseDetail(line.detail);
      if (line.kind === "GROSS" && !line.occurredOn && !detail) {
        return [
          "—",
          "—",
          "—",
          minutes(line.minutes),
          "—",
          "—",
          "—",
          minutes(line.minutes),
          "Forfait",
          line.label,
          amount(line.amount, payslip.currency),
          "—",
        ];
      }
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
        minutes(detail?.lateMinutes ?? (line.kind === "LATE" ? line.minutes : 0)),
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
    startY: 70,
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
    theme: "striped",
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.setFontSize(8);
  doc.text("Document généré par Eteyelo / KlamboCore", 148, 200, { align: "center" });
  const safeName = (teacherName || "enseignant").replace(/[^\p{L}\p{N}]+/gu, "-");
  doc.save(`bulletin-paie-${safeName}-${payslip.year}-${String(payslip.month).padStart(2, "0")}.pdf`);
}
