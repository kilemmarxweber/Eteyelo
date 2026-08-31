import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PayslipForPdf = {
  id: string;
  year: number;
  month: number;
  currency: string;
  gross: number;
  deductions: number;
  net: number;
  status: string;
  teacher: {
    employmentKind: string;
    matriculeEtat: string | null;
    branchMember: {
      member: { user: { name: string; postnom: string | null; prenom: string | null } };
    } | null;
  };
  lines: Array<{
    occurredOn: string | null;
    cycle: string | null;
    kind: string;
    label: string;
    sessions: number;
    minutes: number;
    amount: number;
  }>;
};

function amount(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}

export async function exportTeacherPayslipPdf(payslip: PayslipForPdf) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const user = payslip.teacher.branchMember?.member.user;
  const teacherName = [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ");

  doc.setFontSize(16);
  doc.text("BULLETIN DE PAIE — ENSEIGNANT", 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Période : ${String(payslip.month).padStart(2, "0")}/${payslip.year}`, 14, 30);
  doc.text(`Enseignant : ${teacherName || "Enseignant"}`, 14, 37);
  doc.text(
    `Statut : ${payslip.teacher.employmentKind === "MATRICULE" ? "Matriculé État" : "Non matriculé"}${payslip.teacher.matriculeEtat ? ` (${payslip.teacher.matriculeEtat})` : ""}`,
    14,
    44,
  );
  doc.text(`Devise de base : ${payslip.currency}`, 14, 51);

  autoTable(doc, {
    startY: 59,
    head: [["Brut", "Retenues", "Net à payer", "Statut"]],
    body: [[
      amount(payslip.gross, payslip.currency),
      amount(payslip.deductions, payslip.currency),
      amount(payslip.net, payslip.currency),
      payslip.status,
    ]],
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  autoTable(doc, {
    startY: 82,
    head: [["Date", "Cycle", "Motif / séance", "Séances", "Minutes", "Montant"]],
    body: payslip.lines.map((line) => [
      line.occurredOn ? new Date(line.occurredOn).toLocaleDateString("fr-FR") : "",
      line.cycle ?? "",
      line.label,
      String(line.sessions),
      line.minutes.toFixed(1),
      amount(line.amount, payslip.currency),
    ]),
    theme: "striped",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.setFontSize(8);
  doc.text("Document généré par Eteyelo / KlamboCore", 105, 287, { align: "center" });
  const safeName = (teacherName || "enseignant").replace(/[^\p{L}\p{N}]+/gu, "-");
  doc.save(`bulletin-paie-${safeName}-${payslip.year}-${String(payslip.month).padStart(2, "0")}.pdf`);
}
