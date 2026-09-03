"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconCash,
  IconCheck,
  IconPlus,
  IconX,
} from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
import {
  MAX_SALARY_ADVANCE_INSTALLMENTS,
  planAdvanceInstallments,
} from "@/lib/payroll/salary-advance";
import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import {
  approveSalaryAdvanceAction,
  createSalaryAdvanceAction,
  getSalaryAdvanceTeachersAction,
  getSalaryAdvancesAction,
  rejectSalaryAdvanceAction,
  toggleTeacherAdvanceRequestAction,
} from "./salary-advance.action";

type TeacherOption = {
  id: string;
  teacherId: string | null;
  personnelId: string | null;
  name: string;
  kind: "teacher" | "personnel" | "both";
  canRequest: boolean;
};

type AdvanceRow = {
  id: string;
  teacherId: string;
  personnelId: string | null;
  teacherName: string;
  kind?: string;
  amount: number;
  installmentCount: number;
  currency: string;
  reason: string | null;
  status: string;
  firstYear: number;
  firstMonth: number;
  expenseRef: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requestedByName: string;
  reviewedByName: string;
  installments: Array<{
    id: string;
    sequence: number;
    year: number;
    month: number;
    amount: number;
    status: string;
    deductedAt: string | null;
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

const STATUS_META: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "En attente",
    className:
      "border-amber-300/70 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
  APPROVED: {
    label: "Acceptée",
    className:
      "border-sky-300/70 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  },
  SETTLED: {
    label: "Soldée",
    className:
      "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  REJECTED: {
    label: "Refusée",
    className:
      "border-rose-300/70 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  },
  CANCELLED: {
    label: "Annulée",
    className: "border-border bg-muted text-muted-foreground",
  },
};

function formatAmount(value: number, currency: string) {
  const code = currency || "USD";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: code,
    maximumFractionDigits: code === "USD" ? 2 : 0,
  }).format(value);
}

function toCurrencyCode(value: string): CurrencyCode {
  if (value === CurrencyCode.CDF) return CurrencyCode.CDF;
  if (value === CurrencyCode.AOA) return CurrencyCode.AOA;
  return CurrencyCode.USD;
}

export default function SalaryCreditsClient({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const now = new Date();
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [currency, setCurrency] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [amount, setAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("3");
  const [firstMonth, setFirstMonth] = useState(now.getMonth() + 1);
  const [firstYear, setFirstYear] = useState(now.getFullYear());
  const [reason, setReason] = useState("");
  const [approveNow, setApproveNow] = useState(true);
  const [pendingApprove, setPendingApprove] = useState<AdvanceRow | null>(null);
  const [pendingReject, setPendingReject] = useState<AdvanceRow | null>(null);

  const payrollHref = `/admin/organizations/${params.organizationId}/branches/${params.branchId}/paie-enseignants`;

  const load = useCallback(async () => {
    setLoading(true);
    const [[teachersResult, teachersError], [advancesResult, advancesError]] =
      await Promise.all([
        getSalaryAdvanceTeachersAction(),
        getSalaryAdvancesAction(),
      ]);
    if (teachersError) toast.error(teachersError.message);
    else setTeachers((teachersResult ?? []) as TeacherOption[]);
    if (advancesError) toast.error(advancesError.message);
    else {
      setAdvances((advancesResult?.advances ?? []) as AdvanceRow[]);
      if (advancesResult?.currency) setCurrency(advancesResult.currency);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const preview = useMemo(() => {
    const value = Number(amount);
    const count = Number(installmentCount);
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(count) || count < 1) {
      return [];
    }
    return planAdvanceInstallments({
      total: value,
      count,
      currency: toCurrencyCode(currency),
      firstYear,
      firstMonth,
    });
  }, [amount, currency, firstMonth, firstYear, installmentCount]);

  async function submitCreate() {
    if (!teacherId) {
      toast.error("Choisissez un enseignant ou un personnel");
      return;
    }
    const selected = teachers.find((row) => row.id === teacherId);
    setWorking(true);
    const [result, error] = await createSalaryAdvanceAction({
      teacherId: selected?.teacherId ?? undefined,
      personnelId: selected?.personnelId ?? undefined,
      amount: Number(amount),
      installmentCount: Number(installmentCount),
      firstYear,
      firstMonth,
      reason: reason.trim() || undefined,
      approveNow,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(
        result?.approved
          ? result.draftApplied
            ? "Avance accordée, dépense enregistrée et retenue ajoutée au brouillon"
            : "Avance accordée et dépense enregistrée. Régénérez le bulletin du mois de départ si besoin."
          : "Demande enregistrée",
      );
      setAmount("");
      setReason("");
      await load();
    }
    setWorking(false);
  }

  async function executeApprove() {
    if (!pendingApprove) return;
    setWorking(true);
    const [result, error] = await approveSalaryAdvanceAction({
      advanceId: pendingApprove.id,
      installmentCount: pendingApprove.installmentCount,
      firstYear: pendingApprove.firstYear,
      firstMonth: pendingApprove.firstMonth,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(
        result?.draftApplied
          ? "Avance acceptée · dépense et retenue bulletin enregistrées"
          : "Avance acceptée · dépense enregistrée",
      );
      await load();
    }
    setPendingApprove(null);
    setWorking(false);
  }

  async function executeReject() {
    if (!pendingReject) return;
    setWorking(true);
    const [, error] = await rejectSalaryAdvanceAction({
      advanceId: pendingReject.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Demande refusée");
      await load();
    }
    setPendingReject(null);
    setWorking(false);
  }

  async function toggleRequest(teacher: TeacherOption, allowed: boolean) {
    setWorking(true);
    const [, error] = await toggleTeacherAdvanceRequestAction({
      teacherId: teacher.teacherId ?? undefined,
      personnelId: teacher.personnelId ?? undefined,
      allowed,
    });
    if (error) toast.error(error.message);
    else {
      setTeachers((current) =>
        current.map((row) =>
          row.id === teacher.id ? { ...row, canRequest: allowed } : row,
        ),
      );
    }
    setWorking(false);
  }

  return (
    <div className="space-y-4">
      {embedded ? null : (
        <Button variant="outline" size="sm" asChild>
          <Link href={payrollHref}>
            <IconArrowLeft size={16} />
            Retour à la paie
          </Link>
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle avance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
            <span>Agent (enseignant ou personnel)</span>
            <SearchableSelect
              options={teachers.map((teacher) => ({
                value: teacher.id,
                label:
                  teacher.kind === "personnel"
                    ? `${teacher.name} · Personnel`
                    : teacher.kind === "both"
                      ? `${teacher.name} · Enseignant + personnel`
                      : `${teacher.name} · Enseignant`,
              }))}
              value={teacherId || undefined}
              onValueChange={setTeacherId}
              placeholder="Choisir…"
              searchPlaceholder="Rechercher un agent"
            />
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span>Montant{currency ? ` (${currency})` : ""}</span>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span>Séances de remboursement</span>
            <Input
              type="number"
              min={1}
              max={MAX_SALARY_ADVANCE_INSTALLMENTS}
              value={installmentCount}
              onChange={(event) => setInstallmentCount(event.target.value)}
            />
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span>1re séance — mois</span>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={firstMonth}
              onChange={(event) => setFirstMonth(Number(event.target.value))}
            >
              {MONTHS.map((monthName, index) => (
                <option key={monthName} value={index + 1}>
                  {monthName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            <span>1re séance — année</span>
            <Input
              type="number"
              min={2000}
              value={firstYear}
              onChange={(event) => setFirstYear(Number(event.target.value))}
            />
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
            <span>Motif (optionnel)</span>
            <Textarea
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch
              checked={approveNow}
              onCheckedChange={setApproveNow}
              id="approve-now"
            />
            <label htmlFor="approve-now" className="text-sm">
              Accorder maintenant (dépense + retenue bulletin)
            </label>
          </div>
          {preview.length > 0 ? (
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
              {preview
                .map(
                  (item) =>
                    `séance ${item.sequence} : ${MONTHS[item.month - 1]} ${item.year} · ${formatAmount(item.amount, currency)}`,
                )
                .join(" · ")}
            </p>
          ) : null}
          <div className="sm:col-span-2 lg:col-span-4">
            <Button onClick={() => void submitCreate()} disabled={working}>
              <IconPlus size={16} />
              {approveNow ? "Accorder l'avance" : "Enregistrer la demande"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Autoriser les demandes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Un enseignant ou un personnel autorisé peut déposer une demande
            depuis Ma présence. Vous l’acceptez ensuite ici : la dépense est
            créée et le montant est retiré du bulletin, réparti sur les séances
            choisies. Le montant suit la devise de base du taux actif.
          </p>
          <div className="divide-y rounded-lg border">
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="text-sm">
                  {teacher.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {teacher.kind === "personnel"
                      ? "Personnel"
                      : teacher.kind === "both"
                        ? "Enseignant + personnel"
                        : "Enseignant"}
                  </span>
                </span>
                <Switch
                  checked={teacher.canRequest}
                  disabled={working}
                  onCheckedChange={(checked) => void toggleRequest(teacher, checked)}
                />
              </div>
            ))}
            {!loading && teachers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Aucun enseignant ou personnel actif.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : advances.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune avance pour le moment.</p>
        ) : (
          advances.map((row) => {
            const status = STATUS_META[row.status] ?? STATUS_META.PENDING;
            return (
              <Card key={row.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{row.teacherName || "Agent"}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatAmount(row.amount, row.currency)} · {row.installmentCount} séance
                      {row.installmentCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("font-medium", status.className)}>
                    {status.label}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Demandé le {new Date(row.createdAt).toLocaleDateString("fr-FR")} par{" "}
                    {row.requestedByName || "—"}
                    {row.reason ? ` · ${row.reason}` : ""}
                  </p>
                  {row.reviewedAt ? (
                    <p className="text-muted-foreground">
                      Décision le {new Date(row.reviewedAt).toLocaleDateString("fr-FR")} par{" "}
                      {row.reviewedByName || "—"}
                      {row.expenseRef ? ` · dépense ${row.expenseRef}` : ""}
                      {row.reviewNote ? ` · ${row.reviewNote}` : ""}
                    </p>
                  ) : null}
                  {row.installments.length > 0 ? (
                    <ol className="grid gap-1 sm:grid-cols-2">
                      {row.installments.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-md border bg-muted/40 px-2 py-1.5 text-xs"
                        >
                          Séance {item.sequence}/{row.installmentCount} ·{" "}
                          {MONTHS[item.month - 1]} {item.year} ·{" "}
                          {formatAmount(item.amount, row.currency)} ·{" "}
                          {item.status === "DEDUCTED"
                            ? "déduite du salaire"
                            : item.status === "SKIPPED"
                              ? "ignorée"
                              : "à déduire"}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Les séances de remboursement seront créées à l’acceptation.
                    </p>
                  )}
                  {row.status === "PENDING" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={working}
                        onClick={() => setPendingApprove(row)}
                      >
                        <IconCheck size={15} />
                        Accepter
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={working}
                        onClick={() => setPendingReject(row)}
                      >
                        <IconX size={15} />
                        Refuser
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog
        open={Boolean(pendingApprove)}
        onOpenChange={(open) => {
          if (!open) setPendingApprove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accorder l’avance</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-foreground">
              Enregistrer une dépense « Avance sur salaire » de{" "}
              {pendingApprove
                ? formatAmount(pendingApprove.amount, pendingApprove.currency)
                : ""}{" "}
              et retirer ce montant du salaire sur {pendingApprove?.installmentCount} séance
              {(pendingApprove?.installmentCount ?? 0) > 1 ? "s" : ""} mensuelle
              {(pendingApprove?.installmentCount ?? 0) > 1 ? "s" : ""} ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(event) => {
                event.preventDefault();
                void executeApprove();
              }}
            >
              <IconCash size={15} />
              Accorder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingReject)}
        onOpenChange={(open) => {
          if (!open) setPendingReject(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refuser la demande</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-foreground">
              La demande de {pendingReject?.teacherName} ne sera pas versée et
              n’impactera pas le bulletin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void executeReject();
              }}
            >
              Refuser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
