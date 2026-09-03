"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IconRefresh,
  IconFileInvoice,
  IconCheck,
  IconCash,
  IconSettings,
  IconTrash,
  IconCalculator,
  IconFileTypePdf,
} from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalaryCreditsClient from "../credits/credits-client";
import { exportPayrollRegisterPdf } from "./export-payroll-register-pdf";
import type { SchoolReportContext } from "@/lib/reports/types";
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
import {
  canComputePayroll,
  canPayPayroll,
  canValidatePayroll,
} from "@/lib/auth/session-roles";
import { calendarYearForSchoolMonth } from "@/lib/payroll/calendar-year";
import {
  getTeacherPayslipsAction,
  getPayrollSchoolYearsAction,
  getPayrollCashSnapshotAction,
  payTeacherPayslipAction,
  payAllTeacherPayslipsAction,
  recalculateTeacherPayslipsAction,
  deleteTeacherPayslipsAction,
  getPayrollPolicyAction,
  updatePayrollPolicyAction,
  validateTeacherPayslipAction,
  validateAllTeacherPayslipsAction,
  getPayrollReportContextAction,
} from "../payroll.action";

type PayrollTab = "brouillon" | "bareme" | "credit";

function readPayrollTab(): PayrollTab {
  if (typeof window === "undefined") return "brouillon";
  const value = new URLSearchParams(window.location.search).get("tab");
  if (value === "bareme" || value === "credit" || value === "brouillon") {
    return value;
  }
  return "brouillon";
}

type PayslipRow = {
  id: string;
  teacherId: string | null;
  branchMemberId: string;
  agentKind: string;
  teacherName: string;
  employmentKind: string;
  contractLabel: string;
  branchName: string;
  classes: string[];
  classSummary: string;
  cycles: string[];
  cycleGroup: string;
  cycleLabel: string;
  year: number;
  month: number;
  currency: string;
  gross: number;
  deductions: number;
  net: number;
  lostMinutes: number;
  difference: number;
  status: string;
  sessions: number;
};

type CashSnapshot = {
  currency: string;
  incomeTotal: number;
  expenseTotal: number;
  cashNet: number;
  payrollConsume: number;
  payrollGross: number;
  payrollDeductions: number;
  remainingAfterPayroll: number;
  unpaidCount: number;
};

type Policy = {
  secondarySessionMinutes: number;
  primarySessionMinutes: number;
  secondaryHourlyRate: number;
  secondaryMatriculePrimePercent: number;
  secondaryNonMatriculeSessionRate: number;
  primaryMatriculeMonthly: number;
  primaryNonMatriculeMonthly: number;
  lateGraceMinutes: number;
  notifyByEmail: boolean;
};

type SchoolYearOption = {
  id: string;
  nameYear: string;
  startYear: string;
  endYear: string;
  isCurrentYear: boolean;
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

function formatAmount(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}

function statusLabel(status: string) {
  return (
    {
      DRAFT: "Brouillon",
      VALIDATED: "Validé",
      PAID: "Payé",
      CANCELLED: "Annulé",
    }[status] ?? status
  );
}

function isDeletable(status: string) {
  return status === "DRAFT" || status === "VALIDATED";
}

const CYCLE_LABELS: Record<string, string> = {
  MATERNELLE: "Maternelle",
  PRIMAIRE: "Primaire",
  SECONDAIRE: "Secondaire",
  ATELIER: "Atelier",
  CENTRE_FORMATION: "Centre de formation",
  UNIVERSITE: "Université",
  MIXTE: "Mixte",
  PERSONNEL: "Personnel",
  AUTRE: "Autre",
};

const CYCLE_BADGE: Record<string, string> = {
  MATERNELLE: "border-pink-300/70 bg-pink-50 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300",
  PRIMAIRE: "border-sky-300/70 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  SECONDAIRE: "border-indigo-300/70 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  MIXTE: "border-violet-300/70 bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  PERSONNEL: "border-amber-300/70 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  AUTRE: "border-border bg-muted text-foreground",
};

export default function PayrollClient() {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const now = new Date();
  const [tab, setTab] = useState<PayrollTab>("brouillon");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);
  const [schoolYearId, setSchoolYearId] = useState("");
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [cash, setCash] = useState<CashSnapshot | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [branding, setBranding] = useState<SchoolReportContext | null>(null);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    setHydrated(true);
    setTab(readPayrollTab());
  }, []);

  function selectTab(value: string) {
    const next: PayrollTab =
      value === "bareme" || (value === "credit" && isManager) ? value : "brouillon";
    setTab(next);
    const search = new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    );
    if (next === "brouillon") search.delete("tab");
    else search.set("tab", next);
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    const [[result, error], [cashResult]] = await Promise.all([
      getTeacherPayslipsAction({
        year,
        month,
        schoolYearId: schoolYearId || undefined,
      }),
      getPayrollCashSnapshotAction({
        year,
        month,
        schoolYearId: schoolYearId || undefined,
      }),
    ]);
    if (requestId !== loadRequestRef.current) return;
    if (error) toast.error(error.message);
    else {
      const nextRows = (result ?? []) as PayslipRow[];
      setRows(nextRows);
      setSelectedIds((current) => {
        const valid = new Set(nextRows.map((row) => row.id));
        return new Set([...current].filter((id) => valid.has(id)));
      });
    }
    if (cashResult) setCash(cashResult as CashSnapshot);
    setLoading(false);
  }, [month, schoolYearId, year]);

  useEffect(() => {
    if (!schoolYearId) return;
    void load();
  }, [load, schoolYearId]);

  useEffect(() => {
    void getPayrollPolicyAction().then(([result, error]) => {
      if (!error && result) setPolicy(result as Policy);
    });
  }, []);

  useEffect(() => {
    void getPayrollSchoolYearsAction().then(([result, error]) => {
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      const options = (result ?? []) as SchoolYearOption[];
      setSchoolYears(options);
      const current = options.find((schoolYear) => schoolYear.isCurrentYear) ?? options[0];
      if (current) {
        setSchoolYearId(current.id);
        setYear(calendarYearForSchoolMonth(current, month));
      } else {
        setLoading(false);
      }
    });
  }, []);

  const isManager = useMemo(
    () => hydrated && !isPending && canComputePayroll(session),
    [hydrated, isPending, session],
  );
  const canValidate = useMemo(
    () => hydrated && !isPending && canValidatePayroll(session),
    [hydrated, isPending, session],
  );
  const canPay = useMemo(
    () => hydrated && !isPending && canPayPayroll(session),
    [hydrated, isPending, session],
  );

  useEffect(() => {
    if (!hydrated || isPending || tab !== "credit" || isManager) return;
    setTab("brouillon");
    const search = new URLSearchParams(window.location.search);
    search.delete("tab");
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [hydrated, isManager, isPending, pathname, router, tab]);

  const deletableRows = useMemo(
    () => rows.filter((row) => isDeletable(row.status)),
    [rows],
  );
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.id)),
    [rows, selectedIds],
  );
  const selectedDeletable = useMemo(
    () => selectedRows.filter((row) => isDeletable(row.status)),
    [selectedRows],
  );
  const draftRows = useMemo(
    () => rows.filter((row) => row.status === "DRAFT"),
    [rows],
  );
  const validatedRows = useMemo(
    () => rows.filter((row) => row.status === "VALIDATED"),
    [rows],
  );
  const selectedDrafts = useMemo(
    () => selectedRows.filter((row) => row.status === "DRAFT"),
    [selectedRows],
  );
  const selectedValidated = useMemo(
    () => selectedRows.filter((row) => row.status === "VALIDATED"),
    [selectedRows],
  );
  const allDeletableSelected =
    deletableRows.length > 0 &&
    deletableRows.every((row) => selectedIds.has(row.id));

  const listCurrency = cash?.currency ?? rows[0]?.currency ?? "USD";
  const totals = useMemo(() => {
    const gross = rows.reduce((sum, row) => sum + row.gross, 0);
    const net = rows.reduce((sum, row) => sum + row.net, 0);
    const lost = rows.reduce((sum, row) => sum + row.deductions, 0);
    const lostMinutes = rows.reduce((sum, row) => sum + row.lostMinutes, 0);
    return {
      gross,
      net,
      lost,
      lostMinutes,
      difference: gross - net,
    };
  }, [rows]);

  const groupedRows = useMemo(() => {
    const groups: Array<{ cycleGroup: string; label: string; rows: PayslipRow[] }> = [];
    for (const row of rows) {
      const last = groups[groups.length - 1];
      if (last && last.cycleGroup === row.cycleGroup) {
        last.rows.push(row);
      } else {
        groups.push({
          cycleGroup: row.cycleGroup,
          label: CYCLE_LABELS[row.cycleGroup] ?? row.cycleGroup,
          rows: [row],
        });
      }
    }
    return groups;
  }, [rows]);

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllDeletable(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of deletableRows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  async function recalculate(branchMemberIds?: string[]) {
    setWorking(true);
    const [result, error] = await recalculateTeacherPayslipsAction({
      year,
      month,
      schoolYearId: schoolYearId || undefined,
      ...(branchMemberIds && branchMemberIds.length > 0 ? { branchMemberIds } : {}),
    });
    if (error) toast.error(error.message);
    else {
      if (result?.missingExchangeRate) {
        toast.warning(
          "Aucun taux sélectionné : les brouillons utilisent USD. Configurez le taux avant validation.",
        );
      }
      if (result?.skippedPaid) {
        toast.warning(
          `${result.skippedPaid} bulletin(s) payé(s) non modifié(s).`,
        );
      }
      if (result?.skippedNoForfait) {
        toast.warning(
          `${result.skippedNoForfait} personnel(s) sans forfait mensuel : saisissez le salaire sur la fiche.`,
        );
      }
      toast.success(`${result?.count ?? 0} bulletin(s) généré(s)`);
      setSelectedIds(new Set());
      await load();
    }
    setWorking(false);
  }

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<{
    payslipIds?: string[];
    scopeLabel: string;
  } | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [pendingBulk, setPendingBulk] = useState<{
    kind: "validate" | "pay";
    payslipIds?: string[];
    count: number;
    netTotal: number;
  } | null>(null);

  function requestDeletePayslips(payslipIds?: string[]) {
    const count = payslipIds?.length ?? 0;
    const scope =
      count > 0
        ? count === 1
          ? "le bulletin sélectionné"
          : `les ${count} bulletins sélectionnés`
        : "tous les brouillons et validés du mois";
    setPendingDeleteTarget({ payslipIds, scopeLabel: scope });
    setDeleteConfirmOpen(true);
  }

  async function executePendingDelete() {
    if (!pendingDeleteTarget) return;
    const { payslipIds } = pendingDeleteTarget;
    setDeleteConfirmOpen(false);
    setWorking(true);
    const [result, error] = await deleteTeacherPayslipsAction({
      year,
      month,
      schoolYearId: schoolYearId || undefined,
      ...(payslipIds && payslipIds.length > 0 ? { payslipIds } : {}),
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`${result?.count ?? 0} bulletin(s) supprimé(s)`);
      setSelectedIds(new Set());
      await load();
    }
    setPendingDeleteTarget(null);
    setWorking(false);
  }

  function requestBulkValidate(payslipIds?: string[]) {
    const targets = payslipIds?.length
      ? draftRows.filter((row) => payslipIds.includes(row.id))
      : draftRows;
    if (targets.length === 0) {
      toast.error("Aucun bulletin brouillon à valider");
      return;
    }
    setPendingBulk({
      kind: "validate",
      payslipIds,
      count: targets.length,
      netTotal: targets.reduce((sum, row) => sum + row.net, 0),
    });
    setBulkConfirmOpen(true);
  }

  function requestBulkPay(payslipIds?: string[]) {
    const targets = payslipIds?.length
      ? validatedRows.filter((row) => payslipIds.includes(row.id))
      : validatedRows;
    if (targets.length === 0) {
      toast.error("Aucun bulletin validé à payer");
      return;
    }
    setPendingBulk({
      kind: "pay",
      payslipIds,
      count: targets.length,
      netTotal: targets.reduce((sum, row) => sum + row.net, 0),
    });
    setBulkConfirmOpen(true);
  }

  async function executePendingBulk() {
    if (!pendingBulk) return;
    const { kind, payslipIds } = pendingBulk;
    setBulkConfirmOpen(false);
    setWorking(true);
    const payload = {
      year,
      month,
      schoolYearId: schoolYearId || undefined,
      ...(payslipIds && payslipIds.length > 0 ? { payslipIds } : {}),
    };
    if (kind === "validate") {
      const [result, error] = await validateAllTeacherPayslipsAction(payload);
      if (error) toast.error(error.message);
      else {
        if (result?.skippedNoRate) {
          toast.warning(
            `${result.skippedNoRate} bulletin(s) non validé(s) : taux de change manquant.`,
          );
        }
        toast.success(`${result?.count ?? 0} bulletin(s) validé(s)`);
        setSelectedIds(new Set());
        await load();
      }
    } else {
      const [result, error] = await payAllTeacherPayslipsAction(payload);
      if (error) toast.error(error.message);
      else {
        toast.success(
          `${result?.count ?? 0} bulletin(s) payé(s) · dépenses « Paiement salaire » enregistrées`,
        );
        setSelectedIds(new Set());
        await load();
      }
    }
    setPendingBulk(null);
    setWorking(false);
  }

  function handleSchoolYearChange(value: string) {
    const selected = schoolYears.find((schoolYear) => schoolYear.id === value);
    setSchoolYearId(value);
    setSelectedIds(new Set());
    if (selected) setYear(calendarYearForSchoolMonth(selected, month));
  }

  function handleMonthChange(value: number) {
    setMonth(value);
    setSelectedIds(new Set());
    const selected = schoolYears.find((schoolYear) => schoolYear.id === schoolYearId);
    if (selected) setYear(calendarYearForSchoolMonth(selected, value));
  }

  async function savePolicy() {
    if (!policy) return;
    setWorking(true);
    const [, error] = await updatePayrollPolicyAction(policy);
    if (error) toast.error(error.message);
    else toast.success("Barème enregistré");
    setWorking(false);
  }

  async function exportRegisterPdf() {
    if (rows.length === 0) {
      toast.error("Aucun bulletin à exporter pour cette période.");
      return;
    }
    setExportingPdf(true);
    try {
      let context = branding;
      if (!context) {
        const [fresh, err] = await getPayrollReportContextAction();
        if (err || !fresh) {
          throw new Error(err?.message || "Impossible de préparer l’en-tête du PDF.");
        }
        context = fresh;
        setBranding(fresh);
      }
      const schoolYearLabel =
        schoolYears.find((schoolYear) => schoolYear.id === schoolYearId)?.nameYear;
      await exportPayrollRegisterPdf(rows, cash, context, {
        month,
        year,
        schoolYearLabel,
      });
      toast.success("PDF des bulletins téléchargé.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Échec de l’export PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  }

  async function mutate(
    action: (input: { payslipId: string }) => Promise<[unknown, { message: string } | null]>,
    success: string,
    id: string,
  ) {
    setWorking(true);
    const [, error] = await action({ payslipId: id });
    if (error) toast.error(error.message);
    else {
      toast.success(success);
      await load();
    }
    setWorking(false);
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Bulletins mensuels</CardTitle>
          <Tabs value={tab} onValueChange={selectTab} className="w-full sm:w-auto">
            <TabsList
              className={cn(
                "grid h-auto min-h-10 w-full border border-primary/20 bg-primary/10 sm:w-auto",
                isManager ? "grid-cols-3" : "grid-cols-2",
              )}
            >
              <TabsTrigger
                value="brouillon"
                className="px-4 py-2 text-sm text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Brouillon
              </TabsTrigger>
              <TabsTrigger
                value="bareme"
                className="px-4 py-2 text-sm text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Barème
              </TabsTrigger>
              {isManager ? (
                <TabsTrigger
                  value="credit"
                  className="px-4 py-2 text-sm text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Crédit
                </TabsTrigger>
              ) : null}
            </TabsList>
          </Tabs>
        </div>
        {tab === "brouillon" ? (
          <>
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_8rem_minmax(0,1fr)] lg:items-end">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="payroll-school-year">
            <span>Année scolaire</span>
            <select
              id="payroll-school-year"
              className="flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-normal text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              value={schoolYearId}
              disabled={schoolYears.length === 0}
              onChange={(event) => handleSchoolYearChange(event.target.value)}
            >
              {schoolYears.length === 0 ? (
                <option value="">Chargement…</option>
              ) : null}
              {schoolYears.map((schoolYear) => (
                <option key={schoolYear.id} value={schoolYear.id}>
                  {schoolYear.nameYear}
                  {schoolYear.isCurrentYear ? " (en cours)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="payroll-month">
            <span>Mois</span>
            <select
              id="payroll-month"
              className="flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-normal text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              value={month}
              onChange={(event) => handleMonthChange(Number(event.target.value))}
            >
              {MONTHS.map((monthName, index) => (
                <option key={monthName} value={index + 1}>
                  {monthName}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => void load()}
              disabled={loading}
            >
              <IconRefresh size={16} />
              Actualiser
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => void exportRegisterPdf()}
              disabled={loading || exportingPdf || rows.length === 0}
            >
              <IconFileTypePdf size={16} />
              {exportingPdf ? "Export…" : "Exporter PDF"}
            </Button>
            {isManager ? (
              <>
                <Button
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => void recalculate()}
                  disabled={working}
                >
                  <IconRefresh size={16} />
                  Régénérer tous
                </Button>
                {canValidate ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => requestBulkValidate()}
                    disabled={working || draftRows.length === 0}
                  >
                    <IconCheck size={16} />
                    Valider tous
                  </Button>
                ) : null}
                {canPay ? (
                  <Button
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => requestBulkPay()}
                    disabled={working || validatedRows.length === 0}
                  >
                    <IconCash size={16} />
                    Payer tous
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none text-destructive hover:text-destructive"
                  onClick={() => requestDeletePayslips()}
                  disabled={working || deletableRows.length === 0}
                >
                  <IconTrash size={16} />
                  Supprimer brouillons &amp; validés
                </Button>
              </>
            ) : null}
          </div>
        </div>
        {isManager && selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={working || selectedRows.length === 0}
              onClick={() =>
                void recalculate(selectedRows.map((row) => row.branchMemberId))
              }
            >
              <IconCalculator size={15} />
              Recalculer la sélection
            </Button>
            {canValidate ? (
              <Button
                size="sm"
                variant="outline"
                disabled={working || selectedDrafts.length === 0}
                onClick={() =>
                  requestBulkValidate(selectedDrafts.map((row) => row.id))
                }
              >
                <IconCheck size={15} />
                Valider la sélection
              </Button>
            ) : null}
            {canPay ? (
              <Button
                size="sm"
                disabled={working || selectedValidated.length === 0}
                onClick={() =>
                  requestBulkPay(selectedValidated.map((row) => row.id))
                }
              >
                <IconCash size={15} />
                Payer la sélection
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={working || selectedDeletable.length === 0}
              onClick={() =>
                requestDeletePayslips(selectedDeletable.map((row) => row.id))
              }
            >
              <IconTrash size={15} />
              Supprimer la sélection
            </Button>
          </div>
        ) : null}
          </>
        ) : null}
      </CardHeader>
      {tab === "brouillon" ? (
      <CardContent className="space-y-4">
        {cash ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryTile
              label="Encaissements"
              value={formatAmount(cash.incomeTotal, cash.currency)}
              tone="sky"
            />
            <SummaryTile
              label="Dépenses caisse"
              value={formatAmount(cash.expenseTotal, cash.currency)}
              tone="rose"
            />
            <SummaryTile
              label="Solde net de caisse"
              value={formatAmount(cash.cashNet, cash.currency)}
              tone="emerald"
              hint="Après encaissements − dépenses"
            />
            <SummaryTile
              label="Reste après paie"
              value={formatAmount(cash.remainingAfterPayroll, cash.currency)}
              tone={cash.remainingAfterPayroll >= 0 ? "emerald" : "rose"}
              hint={`Paie à consommer : ${formatAmount(cash.payrollConsume, cash.currency)} (${cash.unpaidCount} bulletin${cash.unpaidCount > 1 ? "s" : ""} non payé${cash.unpaidCount > 1 ? "s" : ""})`}
            />
          </div>
        ) : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun bulletin pour cette période. Lancez une régénération pour payer enseignants et personnels ensemble.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {isManager ? (
                    <th className="w-10 p-2">
                      <Checkbox
                        checked={allDeletableSelected}
                        disabled={deletableRows.length === 0 || working}
                        onCheckedChange={(value) =>
                          toggleAllDeletable(value === true)
                        }
                        aria-label="Sélectionner tous les brouillons et validés"
                      />
                    </th>
                  ) : null}
                  <th className="p-2">Agent</th>
                  <th className="p-2">Cycle / rôle</th>
                  <th className="p-2">Branche</th>
                  <th className="p-2">Classes</th>
                  <th className="p-2">Contrat</th>
                  <th className="p-2">Brut</th>
                  <th className="p-2">Pertes</th>
                  <th className="p-2">Min. perdues</th>
                  <th className="p-2">Net</th>
                  <th className="p-2">Différence</th>
                  <th className="p-2">Bulletin</th>
                  <th className="whitespace-nowrap p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((group) => (
                  <Fragment key={group.cycleGroup}>
                    <tr className="border-y bg-muted/60">
                      <td
                        colSpan={isManager ? 13 : 12}
                        className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-semibold",
                              CYCLE_BADGE[group.cycleGroup] ?? CYCLE_BADGE.AUTRE,
                            )}
                          >
                            {group.label}
                          </Badge>
                          <span className="text-muted-foreground normal-case tracking-normal">
                            {group.rows.length} agent
                            {group.rows.length > 1 ? "s" : ""}
                            {" · "}
                            pertes{" "}
                            {formatAmount(
                              group.rows.reduce((sum, row) => sum + row.deductions, 0),
                              listCurrency,
                            )}
                            {" · "}
                            net{" "}
                            {formatAmount(
                              group.rows.reduce((sum, row) => sum + row.net, 0),
                              listCurrency,
                            )}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        {isManager ? (
                          <td className="p-2">
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              disabled={working || row.status === "PAID"}
                              onCheckedChange={(value) =>
                                toggleRow(row.id, value === true)
                              }
                              aria-label={`Sélectionner ${row.teacherName || "agent"}`}
                            />
                          </td>
                        ) : null}
                        <td className="p-2 font-medium">{row.teacherName || "Enseignant"}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {(row.cycles.length > 0
                              ? row.cycles
                              : [row.cycleGroup || "AUTRE"]
                            ).map((cycle) => (
                              <Badge
                                key={cycle}
                                variant="outline"
                                className={cn(
                                  "px-1.5 py-0 text-[10px] font-medium",
                                  CYCLE_BADGE[cycle] ?? CYCLE_BADGE.AUTRE,
                                )}
                              >
                                {CYCLE_LABELS[cycle] ?? cycle}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          {row.branchName || "—"}
                        </td>
                        <td className="p-2">
                          {row.classes.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div
                              className="flex max-w-[16rem] flex-wrap gap-1"
                              title={row.classes.join(" · ")}
                            >
                              {(row.classes.length > 4
                                ? row.classes.slice(0, 3)
                                : row.classes
                              ).map((className) => (
                                <Badge
                                  key={className}
                                  variant="secondary"
                                  className="px-1.5 py-0 text-[10px] font-medium"
                                >
                                  {className}
                                </Badge>
                              ))}
                              {row.classes.length > 4 ? (
                                <Badge
                                  variant="outline"
                                  className="px-1.5 py-0 text-[10px] font-medium"
                                >
                                  +{row.classes.length - 3}
                                </Badge>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          {row.contractLabel}
                        </td>
                        <td className="p-2">{formatAmount(row.gross, row.currency)}</td>
                        <td className="p-2 font-medium text-destructive">
                          {formatAmount(row.deductions, row.currency)}
                        </td>
                        <td className="p-2 text-destructive/80">
                          {row.lostMinutes > 0
                            ? `${row.lostMinutes.toFixed(row.lostMinutes % 1 === 0 ? 0 : 1)} min`
                            : "—"}
                        </td>
                        <td className="p-2 font-semibold">
                          {formatAmount(row.net, row.currency)}
                        </td>
                        <td className="p-2 text-amber-700 dark:text-amber-400">
                          {formatAmount(row.difference, row.currency)}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline">{statusLabel(row.status)}</Badge>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex flex-nowrap items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8 shrink-0"
                            onClick={() =>
                              router.push(
                                `/admin/organizations/${params.organizationId}/branches/${params.branchId}/paie-enseignants/${row.id}`,
                              )
                            }
                            title="Détail"
                            aria-label={`Voir le détail de ${row.teacherName || "agent"}`}
                          >
                            <IconFileInvoice size={15} />
                          </Button>
                          {canValidate && row.status === "DRAFT" ? (
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8 shrink-0"
                              disabled={working}
                              onClick={() =>
                                void mutate(
                                  validateTeacherPayslipAction,
                                  "Bulletin validé",
                                  row.id,
                                )
                              }
                              title="Valider"
                              aria-label={`Valider le bulletin de ${row.teacherName || "agent"}`}
                            >
                              <IconCheck size={15} />
                            </Button>
                          ) : null}
                          {canPay && row.status === "VALIDATED" ? (
                            <Button
                              size="icon"
                              className="size-8 shrink-0"
                              disabled={working}
                              onClick={() =>
                                void mutate(
                                  payTeacherPayslipAction,
                                  "Bulletin payé · dépense enregistrée",
                                  row.id,
                                )
                              }
                              title="Payer"
                              aria-label={`Marquer payé le bulletin de ${row.teacherName || "agent"}`}
                            >
                              <IconCash size={15} />
                            </Button>
                          ) : null}
                          {isManager && row.status !== "PAID" ? (
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8 shrink-0"
                              disabled={working}
                              onClick={() => void recalculate([row.branchMemberId])}
                              title="Recalculer"
                              aria-label={`Recalculer le bulletin de ${row.teacherName || "agent"}`}
                            >
                              <IconCalculator size={15} />
                            </Button>
                          ) : null}
                          {isManager && isDeletable(row.status) ? (
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8 shrink-0 text-destructive hover:text-destructive"
                              disabled={working}
                              onClick={() => requestDeletePayslips([row.id])}
                              title="Supprimer"
                              aria-label={`Supprimer le bulletin de ${row.teacherName || "agent"}`}
                            >
                              <IconTrash size={15} />
                            </Button>
                          ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <td
                    className="p-2"
                    colSpan={isManager ? 6 : 5}
                  >
                    Totaux ({rows.length})
                  </td>
                  <td className="p-2">{formatAmount(totals.gross, listCurrency)}</td>
                  <td className="p-2 text-destructive">
                    {formatAmount(totals.lost, listCurrency)}
                  </td>
                  <td className="p-2 text-destructive/80">
                    {totals.lostMinutes > 0
                      ? `${totals.lostMinutes.toFixed(totals.lostMinutes % 1 === 0 ? 0 : 1)} min`
                      : "—"}
                  </td>
                  <td className="p-2">{formatAmount(totals.net, listCurrency)}</td>
                  <td className="p-2 text-amber-700 dark:text-amber-400">
                    {formatAmount(totals.difference, listCurrency)}
                  </td>
                  <td className="p-2" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
      ) : null}
      {tab === "bareme" && policy ? (
        <CardContent>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Barème de la branche</p>
              <p className="text-xs text-muted-foreground">
                Les montants utilisent la devise de base de l’organisation.
              </p>
            </div>
            {isManager ? (
              <Button size="sm" variant="outline" onClick={() => void savePolicy()} disabled={working}>
                <IconSettings size={15} /> Enregistrer
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["secondarySessionMinutes", "Secondaire : durée (min)"],
              ["primarySessionMinutes", "Primaire : durée (min)"],
              ["secondaryHourlyRate", "Secondaire matriculé : taux horaire"],
              ["secondaryMatriculePrimePercent", "Prime école (%)"],
              ["secondaryNonMatriculeSessionRate", "Secondaire non matriculé : séance"],
              ["primaryMatriculeMonthly", "Primaire matriculé : forfait"],
              ["primaryNonMatriculeMonthly", "Primaire non matriculé : forfait"],
              ["lateGraceMinutes", "Franchise retard (min)"],
            ] as Array<[keyof Policy, string]>).map(([key, label]) => (
              <label key={key} className="space-y-1 text-xs text-muted-foreground">
                <span>{label}</span>
                <Input
                  type="number"
                  value={policy[key] as number}
                  disabled={!isManager || working}
                  onChange={(event) =>
                    setPolicy((current) =>
                      current ? { ...current, [key]: Number(event.target.value) } : current,
                    )
                  }
                />
              </label>
            ))}
          </div>
        </CardContent>
      ) : null}
      {tab === "credit" && isManager ? (
        <CardContent>
          <SalaryCreditsClient embedded />
        </CardContent>
      ) : null}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-foreground">
              Voulez-vous vraiment supprimer{" "}
              {pendingDeleteTarget?.scopeLabel ?? "les bulletins"} ? Les
              bulletins payés sont conservés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void executePendingDelete();
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkConfirmOpen}
        onOpenChange={(open) => {
          setBulkConfirmOpen(open);
          if (!open) setPendingBulk(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingBulk?.kind === "pay"
                ? "Confirmer le paiement"
                : "Confirmer la validation"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-foreground">
              {pendingBulk?.kind === "pay" ? (
                <>
                  Payer {pendingBulk.count} bulletin
                  {pendingBulk.count > 1 ? "s" : ""} et enregistrer{" "}
                  {pendingBulk.count > 1 ? "les dépenses" : "la dépense"} «
                  Paiement salaire » pour un total de{" "}
                  {formatAmount(pendingBulk.netTotal, listCurrency)} ? Cette
                  action est irréversible.
                </>
              ) : (
                <>
                  Valider {pendingBulk?.count ?? 0} bulletin
                  {(pendingBulk?.count ?? 0) > 1 ? "s" : ""} brouillon
                  {(pendingBulk?.count ?? 0) > 1 ? "s" : ""} ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(e) => {
                e.preventDefault();
                void executePendingBulk();
              }}
            >
              {pendingBulk?.kind === "pay" ? "Payer" : "Valider"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "sky" | "rose" | "emerald";
  hint?: string;
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
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
