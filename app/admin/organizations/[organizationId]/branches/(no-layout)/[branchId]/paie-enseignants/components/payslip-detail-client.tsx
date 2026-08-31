"use client";

import Link from "next/link";
import { Button } from "@/components/custom/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportTeacherPayslipPdf } from "./export-teacher-payslip-pdf";
import type { TeacherPayslipLineDetailSnapshot } from "@/lib/payroll/teacher-payslip-line-detail";

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
    detail?: TeacherPayslipLineDetailSnapshot | null;
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Présent",
  LATE: "Retard",
  ABSENT: "Absent",
  EXCUSED: "Excusé",
};

const KIND_LABELS: Record<string, string> = {
  GROSS: "Séance / forfait",
  ABSENCE: "Absence",
  LATE: "Retard",
  EARLY_EXIT: "Sortie anticipée",
  ADJUSTMENT: "Ajustement",
};

function formatAmount(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}

function formatClock(iso: string | null | undefined) {
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

function formatMinutes(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} min`;
}

function parseDetail(
  value: unknown,
): TeacherPayslipLineDetailSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as TeacherPayslipLineDetailSnapshot;
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
  const sessionLines = payslip.lines.filter((line) => line.kind !== "GROSS" || line.detail || line.occurredOn);
  const summaryLine = payslip.lines.find(
    (line) => line.kind === "GROSS" && !line.occurredOn && !line.detail,
  );

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
          {summaryLine ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {summaryLine.label} · {summaryLine.sessions} séance
              {summaryLine.sessions > 1 ? "s" : ""} · durée prévue cumulée{" "}
              {formatMinutes(summaryLine.minutes)} ·{" "}
              {formatAmount(summaryLine.amount, payslip.currency)}
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Détail des séances</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Date</th>
                  <th className="p-2">Début</th>
                  <th className="p-2">Fin</th>
                  <th className="p-2">Durée prévue</th>
                  <th className="p-2">Pointage</th>
                  <th className="p-2">Retard</th>
                  <th className="p-2">Sortie ant.</th>
                  <th className="p-2">Perdues</th>
                  <th className="p-2">Statut</th>
                  <th className="p-2">Séance</th>
                  <th className="p-2">Motif</th>
                  <th className="p-2">Montant</th>
                </tr>
              </thead>
              <tbody>
                {sessionLines.length === 0 ? (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={12}>
                      Aucune séance sur cette période.
                    </td>
                  </tr>
                ) : (
                  sessionLines.map((line, index) => {
                    const detail = parseDetail(line.detail);
                    const isForfait = line.kind === "GROSS" && !line.occurredOn && !detail;
                    if (isForfait) return null;
                    return (
                      <tr key={`${line.occurredOn}-${index}`} className="border-b last:border-0 align-top">
                        <td className="p-2 whitespace-nowrap">
                          {line.occurredOn
                            ? new Date(line.occurredOn).toLocaleDateString("fr-FR")
                            : "—"}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatClock(detail?.startTime)}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatClock(detail?.endTime)}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatMinutes(detail?.plannedMinutes)}
                        </td>
                        <td className="p-2 whitespace-nowrap text-xs">
                          {detail ? (
                            <>
                              <div>Arrivée : {formatClock(detail.checkIn)}</div>
                              <div>Départ : {formatClock(detail.checkOut)}</div>
                              {detail.graceMinutes > 0 ? (
                                <div className="text-muted-foreground">
                                  Franchise {detail.graceMinutes} min
                                </div>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatMinutes(detail?.lateMinutes ?? (line.kind === "LATE" ? line.minutes : 0))}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatMinutes(detail?.earlyExitMinutes)}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatMinutes(detail?.lostMinutes ?? line.minutes)}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {STATUS_LABELS[detail?.status ?? ""] ?? detail?.status ?? "—"}
                        </td>
                        <td className="p-2">
                          <div>{line.label}</div>
                          {line.cycle ? (
                            <div className="text-xs text-muted-foreground">{line.cycle}</div>
                          ) : null}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {KIND_LABELS[line.kind] ?? line.kind}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatAmount(line.amount, payslip.currency)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
