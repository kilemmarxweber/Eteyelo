"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { canComputePayroll } from "@/lib/auth/session-roles";
import { exportTeacherPayslipPdf } from "./export-teacher-payslip-pdf";
import {
  parsePayslipLineDetail,
  type TeacherPayslipLineDetailSnapshot,
} from "@/lib/payroll/teacher-payslip-line-detail";
import { waiveTeacherPayslipDeductionAction } from "../payroll.action";

type Payslip = {
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
    monthlyForfait?: number | null;
    branchMember?: {
      member?: { user?: { name?: string | null; postnom?: string | null; prenom?: string | null } | null } | null;
    } | null;
  } | null;
  branchMember?: {
    member?: { user?: { name?: string | null; postnom?: string | null; prenom?: string | null } | null } | null;
  } | null;
  lines: Array<{
    id: string;
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

const PAYSLIP_STATUS: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Brouillon",
    className:
      "border-amber-300/70 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
  VALIDATED: {
    label: "Validé",
    className:
      "border-sky-300/70 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  },
  PAID: {
    label: "Payé",
    className:
      "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  CANCELLED: {
    label: "Annulé",
    className:
      "border-rose-300/70 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  },
};

const KIND_LABELS: Record<string, string> = {
  GROSS: "Séance / forfait",
  ABSENCE: "Absence",
  LATE: "Retard",
  EARLY_EXIT: "Sortie anticipée",
  ADJUSTMENT: "Ajustement",
  ADVANCE: "Avance sur salaire",
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
  return parsePayslipLineDetail(value);
}

const LOSS_KINDS = new Set(["ABSENCE", "LATE", "EARLY_EXIT"]);

export default function PayslipDetailClient({
  payslip,
  backHref,
}: {
  payslip: Payslip;
  backHref: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const canEdit = useMemo(() => canComputePayroll(session), [session]);
  const [pendingWaiver, setPendingWaiver] = useState<{
    lineId: string;
    waive: boolean;
    label: string;
    amount: number;
  } | null>(null);
  const [working, setWorking] = useState(false);

  const user =
    payslip.branchMember?.member?.user ??
    payslip.teacher?.branchMember?.member?.user ??
    payslip.personnel?.branchMember?.member?.user;
  const name = [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ");
  const sessionLines = payslip.lines.filter(
    (line) =>
      line.kind !== "ADVANCE" &&
      (line.kind !== "GROSS" || line.detail || line.occurredOn),
  );
  const advanceLines = payslip.lines.filter((line) => line.kind === "ADVANCE");
  const summaryLine = payslip.lines.find(
    (line) => line.kind === "GROSS" && !line.occurredOn && !line.detail,
  );
  const isPersonnel = payslip.agentKind === "PERSONNEL" || !payslip.teacher;
  const isMatricule = payslip.teacher?.employmentKind === "MATRICULE";
  const contractLabel = isPersonnel
    ? "Personnel · forfait"
    : isMatricule
      ? payslip.agentKind === "BOTH"
        ? "Matriculé État + forfait"
        : "Matriculé État"
      : payslip.agentKind === "BOTH"
        ? "Non matriculé + forfait"
        : "Non matriculé";
  const statusMeta = PAYSLIP_STATUS[payslip.status] ?? {
    label: payslip.status,
    className: "border-border bg-muted text-foreground",
  };
  const periodLabel = `${MONTHS[payslip.month - 1] ?? payslip.month} ${payslip.year}`;
  const editable =
    canEdit && (payslip.status === "DRAFT" || payslip.status === "VALIDATED");

  async function applyWaiver() {
    if (!pendingWaiver) return;
    setWorking(true);
    const [, error] = await waiveTeacherPayslipDeductionAction({
      payslipId: payslip.id,
      lineId: pendingWaiver.lineId,
      waive: pendingWaiver.waive,
    });
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      pendingWaiver.waive
        ? "Retenue retirée. Le net a été recalculé."
        : "Retenue rétablie.",
    );
    setPendingWaiver(null);
    router.refresh();
  }

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
      <Card className="overflow-hidden border-primary/15">
        <div className="border-b bg-gradient-to-r from-primary/10 via-sky-500/5 to-emerald-500/10 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <CardTitle className="text-xl tracking-tight">
                {name || "Agent"}
              </CardTitle>
              <p className="text-sm font-medium text-primary/90">
                Bulletin · {periodLabel}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    isMatricule
                      ? "border-indigo-300/70 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : "border-violet-300/70 bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
                  )}
                >
                  {contractLabel}
                </Badge>
                {payslip.teacher?.matriculeEtat ? (
                  <Badge
                    variant="outline"
                    className="border-slate-300/70 bg-slate-50 font-mono text-[11px] text-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
                  >
                    {payslip.teacher.matriculeEtat}
                  </Badge>
                ) : null}
                <Badge variant="outline" className={cn("font-medium", statusMeta.className)}>
                  {statusMeta.label}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-teal-300/70 bg-teal-50 font-medium text-teal-800 dark:bg-teal-950/40 dark:text-teal-300"
                >
                  {payslip.currency}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <CardContent className="pt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Brut"
              value={formatAmount(payslip.gross, payslip.currency)}
              tone="sky"
            />
            <Metric
              label="Retenues"
              value={formatAmount(payslip.deductions, payslip.currency)}
              tone="rose"
            />
            <Metric
              label="Net à payer"
              value={formatAmount(payslip.net, payslip.currency)}
              tone="emerald"
            />
          </div>
          {summaryLine ? (
            <div className="mt-4 rounded-lg border border-primary/10 bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{summaryLine.label}</span>
              {" · "}
              {summaryLine.sessions} séance
              {summaryLine.sessions > 1 ? "s" : ""}
              {" · durée prévue cumulée "}
              {formatMinutes(summaryLine.minutes)}
              {" · "}
              <span className="font-semibold text-foreground">
                {formatAmount(summaryLine.amount, payslip.currency)}
              </span>
            </div>
          ) : null}
          {advanceLines.length > 0 ? (
            <ul className="mt-3 space-y-1.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-sm dark:border-amber-900 dark:bg-amber-950/30">
              {advanceLines.map((line) => (
                <li key={line.id} className="flex flex-wrap justify-between gap-2">
                  <span>{line.label}</span>
                  <span className="font-semibold text-amber-900 dark:text-amber-200">
                    − {formatAmount(line.amount, payslip.currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Détail des séances</CardTitle>
          {editable ? (
            <p className="text-sm font-normal text-muted-foreground">
              Vous pouvez retirer une retenue (excuse ou jugement) : le montant
              revient dans le net. Rétablissez-la tant que le bulletin n’est pas
              payé.
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
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
                  <th className="p-2">Valeur séance</th>
                  <th className="p-2">Perte</th>
                  {editable ? <th className="p-2">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {sessionLines.length === 0 ? (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={editable ? 14 : 13}>
                      Aucune séance sur cette période.
                    </td>
                  </tr>
                ) : (
                  sessionLines.map((line) => {
                    const detail = parseDetail(line.detail);
                    const isForfait = line.kind === "GROSS" && !line.occurredOn && !detail;
                    if (isForfait) return null;
                    const waived = Boolean(detail?.waived);
                    const isLoss = LOSS_KINDS.has(line.kind);
                    const displayedLoss = waived
                      ? (detail?.waivedAmount ?? 0)
                      : isLoss
                        ? line.amount
                        : 0;
                    return (
                      <tr key={line.id} className="border-b last:border-0 align-top">
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
                          {waived ? (
                            <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                              Retenue retirée
                            </div>
                          ) : null}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatAmount(
                            detail?.sessionGross ??
                              (line.kind === "GROSS" ? line.amount : 0),
                            payslip.currency,
                          )}
                        </td>
                        <td
                          className={cn(
                            "p-2 whitespace-nowrap",
                            waived
                              ? "text-muted-foreground line-through"
                              : isLoss
                                ? "text-destructive"
                                : "",
                          )}
                        >
                          {isLoss || waived
                            ? formatAmount(displayedLoss, payslip.currency)
                            : "—"}
                        </td>
                        {editable ? (
                          <td className="p-2 whitespace-nowrap">
                            {isLoss ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={working}
                                onClick={() =>
                                  setPendingWaiver({
                                    lineId: line.id,
                                    waive: !waived,
                                    label: line.label,
                                    amount: displayedLoss,
                                  })
                                }
                              >
                                {waived ? "Rétablir" : "Retirer"}
                              </Button>
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <AlertDialog
        open={pendingWaiver != null}
        onOpenChange={(open) => {
          if (!open && !working) setPendingWaiver(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingWaiver?.waive ? "Retirer cette retenue ?" : "Rétablir cette retenue ?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-foreground">
              {pendingWaiver?.waive ? (
                <>
                  La perte de{" "}
                  <span className="font-medium">
                    {formatAmount(pendingWaiver.amount, payslip.currency)}
                  </span>{" "}
                  sur {pendingWaiver.label} sera annulée et réintégrée au net.
                  Un bulletin validé repassera en brouillon.
                </>
              ) : (
                <>
                  La retenue de{" "}
                  <span className="font-medium">
                    {formatAmount(pendingWaiver?.amount ?? 0, payslip.currency)}
                  </span>{" "}
                  sur {pendingWaiver?.label} sera de nouveau appliquée.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(event) => {
                event.preventDefault();
                void applyWaiver();
              }}
            >
              {working
                ? "Enregistrement…"
                : pendingWaiver?.waive
                  ? "Retirer la retenue"
                  : "Rétablir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sky" | "rose" | "emerald";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 shadow-sm",
        tone === "sky" &&
          "border-sky-200/80 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/30",
        tone === "rose" &&
          "border-rose-200/80 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30",
        tone === "emerald" &&
          "border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30",
      )}
    >
      <p
        className={cn(
          "text-xs font-medium uppercase tracking-wide",
          tone === "sky" && "text-sky-700 dark:text-sky-300",
          tone === "rose" && "text-rose-700 dark:text-rose-300",
          tone === "emerald" && "text-emerald-700 dark:text-emerald-300",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "sky" && "text-sky-950 dark:text-sky-50",
          tone === "rose" && "text-rose-950 dark:text-rose-50",
          tone === "emerald" && "text-emerald-950 dark:text-emerald-50",
        )}
      >
        {value}
      </p>
    </div>
  );
}
