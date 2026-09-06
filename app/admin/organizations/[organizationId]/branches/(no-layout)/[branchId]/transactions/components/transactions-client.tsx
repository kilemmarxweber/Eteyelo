"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  IconArchive,
  IconArchiveOff,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  archiveBranchTransactionAction,
  deleteBranchTransactionAction,
  getBranchTransactionsAction,
  unarchiveBranchTransactionAction,
} from "../transactions.action";

type TransactionRow = {
  id: string;
  kind: "PAYMENT" | "EXPENSE";
  transactionRef: string;
  amount: number;
  receivedCurrency: string | null;
  receivedAmount: number | null;
  method: string | null;
  status: string;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  studentName: string;
  parentName: string;
  className: string;
  cycle: string | null;
  description: string | null;
  category: string | null;
  cashierName: string | null;
};

function formatAmount(value: number, currency: string, localeTag: string) {
  return new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}

function formatDate(iso: string, localeTag: string) {
  try {
    return new Date(iso).toLocaleString(localeTag, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function toDateInputValue(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kinshasa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

type PeriodMode = "day" | "all" | "period";

export default function TransactionsClient() {
  const t = useTranslations("finance.transactions");
  const locale = useLocale();
  const localeTag =
    locale === "fr" ? "fr-FR" : locale === "pt" ? "pt-PT" : "en-US";
  const today = toDateInputValue();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [canDelete, setCanDelete] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [mode, setMode] = useState<PeriodMode>("day");
  const [day, setDay] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TransactionRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [result, error] = await getBranchTransactionsAction({
      includeArchived,
      search: appliedSearch.trim() || undefined,
      mode,
      ...(mode === "day" ? { day } : {}),
      ...(mode === "period" ? { startDate, endDate } : {}),
    });
    if (error) toast.error(error.message);
    else if (result) {
      setRows(result.rows as TransactionRow[]);
      setCurrency(result.currency);
      setCanDelete(Boolean(result.canDelete));
    }
    setLoading(false);
  }, [appliedSearch, day, endDate, includeArchived, mode, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const periodLabel =
    mode === "day"
      ? t("periodDailyLabel", {
          date: new Date(`${day}T00:00:00`).toLocaleDateString(localeTag),
        })
      : mode === "all"
        ? t("periodAllLabel")
        : t("periodRangeLabel", {
            start: new Date(`${startDate}T00:00:00`).toLocaleDateString(
              localeTag,
            ),
            end: new Date(`${endDate}T00:00:00`).toLocaleDateString(localeTag),
          });

  async function archiveRow(row: TransactionRow) {
    setWorking(true);
    const [, error] = await archiveBranchTransactionAction({
      id: row.id,
      kind: row.kind,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(
        row.kind === "EXPENSE"
          ? t("toast.expenseArchived")
          : t("toast.transactionArchived"),
      );
      await load();
    }
    setWorking(false);
  }

  async function unarchiveRow(row: TransactionRow) {
    setWorking(true);
    const [, error] = await unarchiveBranchTransactionAction({
      id: row.id,
      kind: row.kind,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(
        row.kind === "EXPENSE"
          ? t("toast.expenseRestored")
          : t("toast.transactionRestored"),
      );
      await load();
    }
    setWorking(false);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setWorking(true);
    const [, error] = await deleteBranchTransactionAction({
      id: pendingDelete.id,
      kind: pendingDelete.kind,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(t("toast.deleted"));
      setPendingDelete(null);
      await load();
    }
    setWorking(false);
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle>{t("cardTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("cardSubtitle", { period: periodLabel })}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>{t("filters.period")}</span>
            <select
              className="flex h-9 w-[11rem] rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={mode}
              onChange={(event) => setMode(event.target.value as PeriodMode)}
            >
              <option value="day">{t("filters.dayMode")}</option>
              <option value="all">{t("filters.allMode")}</option>
              <option value="period">{t("filters.rangeMode")}</option>
            </select>
          </label>
          {mode === "day" ? (
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>{t("filters.day")}</span>
              <Input
                type="date"
                className="h-9 w-[11rem]"
                value={day}
                onChange={(event) => setDay(event.target.value)}
              />
            </label>
          ) : null}
          {mode === "period" ? (
            <>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>{t("filters.from")}</span>
                <Input
                  type="date"
                  className="h-9 w-[11rem]"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>{t("filters.to")}</span>
                <Input
                  type="date"
                  className="h-9 w-[11rem]"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="min-w-[14rem] flex-1 space-y-1 text-xs text-muted-foreground">
            <span>{t("filters.search")}</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setAppliedSearch(search.trim());
              }}
              placeholder={t("filters.searchPlaceholder")}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox
              checked={includeArchived}
              onCheckedChange={(value) => setIncludeArchived(value === true)}
            />
            {t("filters.includeArchived")}
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAppliedSearch(search.trim());
              if (search.trim() === appliedSearch) void load();
            }}
            disabled={loading || working}
          >
            <IconRefresh size={16} />
            {t("actions.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("state.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("state.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">{t("table.type")}</th>
                  <th className="p-2">{t("table.reference")}</th>
                  <th className="p-2">{t("table.date")}</th>
                  <th className="p-2">{t("table.studentLabel")}</th>
                  <th className="p-2">{t("table.parentCashier")}</th>
                  <th className="p-2">{t("table.classCategory")}</th>
                  <th className="p-2">{t("table.amount")}</th>
                  <th className="p-2">{t("table.status")}</th>
                  <th className="p-2">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isExpense = row.kind === "EXPENSE";
                  return (
                    <tr
                      key={`${row.kind}-${row.id}`}
                      className={cn(
                        "border-b last:border-0",
                        row.isArchived && "bg-muted/30 text-muted-foreground",
                      )}
                    >
                      <td className="p-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            isExpense
                              ? "border-rose-300/70 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                              : "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                          )}
                        >
                          {isExpense ? t("kinds.expense") : t("kinds.payment")}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono text-xs">{row.transactionRef}</td>
                      <td className="p-2 whitespace-nowrap">
                        {formatDate(row.createdAt, localeTag)}
                      </td>
                      <td className="p-2 font-medium">
                        {isExpense
                          ? row.description || t("table.expenseFallback")
                          : row.studentName}
                      </td>
                      <td className="p-2">
                        {isExpense ? row.cashierName || "—" : row.parentName}
                      </td>
                      <td className="p-2">
                        {isExpense ? (
                          <div>{row.category || "—"}</div>
                        ) : (
                          <>
                            <div>{row.className}</div>
                            {row.cycle ? (
                              <div className="text-[10px] uppercase text-muted-foreground">
                                {row.cycle}
                              </div>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td
                        className={cn(
                          "p-2 font-semibold",
                          isExpense && "text-destructive",
                        )}
                      >
                        {isExpense ? "−" : ""}
                        {formatAmount(row.amount, currency, localeTag)}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{row.status}</Badge>
                          {row.isArchived ? (
                            <Badge variant="secondary">{t("table.archived")}</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="flex flex-wrap gap-1 p-2">
                        {!row.isArchived ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            disabled={working}
                            title={t("actions.archive")}
                            aria-label={t("actions.archiveAria", {
                              ref: row.transactionRef,
                            })}
                            onClick={() => void archiveRow(row)}
                          >
                            <IconArchive size={15} />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            disabled={working}
                            title={t("actions.unarchive")}
                            aria-label={t("actions.unarchiveAria", {
                              ref: row.transactionRef,
                            })}
                            onClick={() => void unarchiveRow(row)}
                          >
                            <IconArchiveOff size={15} />
                          </Button>
                        )}
                        {canDelete ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            disabled={working}
                            title={t("actions.deletePermanently")}
                            aria-label={t("actions.deleteAria", {
                              ref: row.transactionRef,
                            })}
                            onClick={() => setPendingDelete(row)}
                          >
                            <IconTrash size={15} />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !working) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-foreground">
              {t("confirm.descriptionPrefix")}{" "}
              {pendingDelete?.kind === "EXPENSE"
                ? t("confirm.expense")
                : t("confirm.transaction")}{" "}
              <span className="inline font-mono font-medium break-all">
                {pendingDelete?.transactionRef}
              </span>{" "}
              {t("confirm.descriptionSuffix")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={working}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {working ? t("actions.deleting") : t("actions.deletePermanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
