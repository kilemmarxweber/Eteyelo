"use client";

import { useCallback, useEffect, useState } from "react";
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

function formatAmount(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
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
      ? `Journalier · ${new Date(`${day}T00:00:00`).toLocaleDateString("fr-FR")}`
      : mode === "all"
        ? "Toutes les transactions"
        : `Du ${new Date(`${startDate}T00:00:00`).toLocaleDateString("fr-FR")} au ${new Date(`${endDate}T00:00:00`).toLocaleDateString("fr-FR")}`;

  async function archiveRow(row: TransactionRow) {
    setWorking(true);
    const [, error] = await archiveBranchTransactionAction({
      id: row.id,
      kind: row.kind,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(
        row.kind === "EXPENSE" ? "Dépense archivée" : "Transaction archivée",
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
        row.kind === "EXPENSE" ? "Dépense restaurée" : "Transaction restaurée",
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
      toast.success("Suppression définitive effectuée");
      setPendingDelete(null);
      await load();
    }
    setWorking(false);
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle>Transactions de la branche</CardTitle>
        <p className="text-sm text-muted-foreground">
          Encaissements et dépenses · {periodLabel}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Période</span>
            <select
              className="flex h-9 w-[11rem] rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={mode}
              onChange={(event) => setMode(event.target.value as PeriodMode)}
            >
              <option value="day">Journalier</option>
              <option value="all">Tous</option>
              <option value="period">Période précise</option>
            </select>
          </label>
          {mode === "day" ? (
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Jour</span>
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
                <span>Du</span>
                <Input
                  type="date"
                  className="h-9 w-[11rem]"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Au</span>
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
            <span>Recherche</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setAppliedSearch(search.trim());
              }}
              placeholder="Réf., élève, parent, classe, dépense…"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox
              checked={includeArchived}
              onCheckedChange={(value) => setIncludeArchived(value === true)}
            />
            Afficher les archivées
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
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune transaction pour cette branche.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Type</th>
                  <th className="p-2">N° transaction</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Élève / Libellé</th>
                  <th className="p-2">Parent / Caissier</th>
                  <th className="p-2">Classe / Catégorie</th>
                  <th className="p-2">Montant</th>
                  <th className="p-2">Statut</th>
                  <th className="p-2">Actions</th>
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
                          {isExpense ? "Dépense" : "Encaissement"}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono text-xs">{row.transactionRef}</td>
                      <td className="p-2 whitespace-nowrap">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="p-2 font-medium">
                        {isExpense
                          ? row.description || "Dépense de caisse"
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
                        {formatAmount(row.amount, currency)}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{row.status}</Badge>
                          {row.isArchived ? (
                            <Badge variant="secondary">Archivée</Badge>
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
                            title="Archiver"
                            aria-label={`Archiver ${row.transactionRef}`}
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
                            title="Désarchiver"
                            aria-label={`Désarchiver ${row.transactionRef}`}
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
                            title="Supprimer définitivement"
                            aria-label={`Supprimer ${row.transactionRef}`}
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
            <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-foreground">
              Cette action est irréversible.{" "}
              {pendingDelete?.kind === "EXPENSE" ? "La dépense" : "La transaction"}{" "}
              <span className="inline font-mono font-medium break-all">
                {pendingDelete?.transactionRef}
              </span>{" "}
              sera effacée de la base. Préférez l’archivage pour seulement la
              masquer de la caisse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={working}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {working ? "Suppression…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
