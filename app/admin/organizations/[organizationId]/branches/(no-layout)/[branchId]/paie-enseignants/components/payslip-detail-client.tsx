"use client";

import Link from "next/link";
import { Button } from "@/components/custom/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportTeacherPayslipPdf } from "./export-teacher-payslip-pdf";

type Payslip = {
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

function formatAmount(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}

export default function PayslipDetailClient({
  payslip,
  backHref,
}: {
  payslip: Payslip;
  backHref: string;
}) {
  const user = payslip.teacher.branchMember?.member.user;
  const name = [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href={backHref}>Retour aux bulletins</Link>
        </Button>
        <Button onClick={() => void exportTeacherPayslipPdf(payslip)}>
          Télécharger le PDF
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{name || "Enseignant"} · {payslip.month}/{payslip.year}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {payslip.teacher.employmentKind === "MATRICULE" ? "Matriculé État" : "Non matriculé"}
            {payslip.teacher.matriculeEtat ? ` · ${payslip.teacher.matriculeEtat}` : ""}
            {" · "}Statut : {payslip.status} · Devise : {payslip.currency}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Brut" value={formatAmount(payslip.gross, payslip.currency)} />
            <Metric label="Retenues" value={formatAmount(payslip.deductions, payslip.currency)} />
            <Metric label="Net à payer" value={formatAmount(payslip.net, payslip.currency)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Détail des séances</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="p-2">Date</th><th className="p-2">Cycle</th><th className="p-2">Libellé</th>
                <th className="p-2">Minutes</th><th className="p-2">Montant</th>
              </tr></thead>
              <tbody>
                {payslip.lines.map((line, index) => (
                  <tr key={`${line.occurredOn}-${index}`} className="border-b last:border-0">
                    <td className="p-2">{line.occurredOn ? new Date(line.occurredOn).toLocaleDateString("fr-FR") : "—"}</td>
                    <td className="p-2">{line.cycle ?? "—"}</td>
                    <td className="p-2">{line.label}</td>
                    <td className="p-2">{line.minutes.toFixed(1)}</td>
                    <td className="p-2">{formatAmount(line.amount, payslip.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>;
}
