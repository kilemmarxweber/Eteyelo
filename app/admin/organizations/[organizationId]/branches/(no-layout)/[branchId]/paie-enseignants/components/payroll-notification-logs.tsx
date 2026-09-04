"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { IconTrash, IconRefresh } from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { refreshNotificationBell } from "@/lib/notification-events";
import {
  deletePayrollNotificationLogsAction,
  listPayrollNotificationLogsAction,
  type PayrollNotificationLogRow,
} from "../payroll-logs.action";

type StatusFilter = "all" | "unread" | "read";

function typeLabel(type: string) {
  return type === "PAYROLL_DEDUCTION" ? "Impact paie" : "Paie";
}

export default function PayrollNotificationLogs() {
  const router = useRouter();
  const [rows, setRows] = useState<PayrollNotificationLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    all: boolean;
    count: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [result, error] = await listPayrollNotificationLogsAction();
    if (error) toast.error(error.message);
    else if (result) {
      setRows(result.rows);
      setTotal(result.total);
      setUnread(result.unread);
      setSelectedIds((current) => {
        const valid = new Set(result.rows.map((row) => row.id));
        return new Set([...current].filter((id) => valid.has(id)));
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    if (filter === "unread") return rows.filter((row) => !row.readAt);
    if (filter === "read") return rows.filter((row) => Boolean(row.readAt));
    return rows;
  }, [filter, rows]);

  const allVisibleSelected =
    visibleRows.length > 0 &&
    visibleRows.every((row) => selectedIds.has(row.id));

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of visibleRows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  function requestDeleteSelected() {
    if (selectedIds.size === 0) return;
    setPendingDelete({ all: false, count: selectedIds.size });
    setConfirmOpen(true);
  }

  function requestDeleteAll() {
    if (total === 0) return;
    setPendingDelete({ all: true, count: total });
    setConfirmOpen(true);
  }

  async function executeDelete() {
    if (!pendingDelete) return;
    setConfirmOpen(false);
    setWorking(true);
    const [result, error] = await deletePayrollNotificationLogsAction(
      pendingDelete.all
        ? { all: true }
        : { notificationIds: [...selectedIds] },
    );
    if (error) toast.error(error.message);
    else {
      toast.success(
        `${result?.count ?? 0} notification(s) supprimée(s) de la base`,
      );
      setSelectedIds(new Set());
      refreshNotificationBell();
      await load();
    }
    setPendingDelete(null);
    setWorking(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3.5 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Total en base
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{total}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Notifications paie / impact (max 500 affichées)
          </p>
        </div>
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 p-3.5 dark:border-rose-900 dark:bg-rose-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-rose-700 dark:text-rose-300">
            Non lues
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{unread}</p>
        </div>
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Lues
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {Math.max(0, total - unread)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          <span className="sr-only">Filtrer</span>
          <select
            className="flex h-8 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground"
            value={filter}
            onChange={(event) => setFilter(event.target.value as StatusFilter)}
          >
            <option value="all">Toutes</option>
            <option value="unread">Non lues</option>
            <option value="read">Lues</option>
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={loading || working}
          onClick={() => void load()}
        >
          <IconRefresh size={15} />
          Actualiser
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={working || selectedIds.size === 0}
          onClick={requestDeleteSelected}
        >
          <IconTrash size={15} />
          Nettoyer la sélection ({selectedIds.size})
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={working || total === 0}
          onClick={requestDeleteAll}
        >
          <IconTrash size={15} />
          Tout nettoyer
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune notification paie à afficher. La base est déjà allégée pour ce
          filtre.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-10 p-2">
                  <Checkbox
                    checked={
                      allVisibleSelected
                        ? true
                        : selectedIds.size > 0
                          ? "indeterminate"
                          : false
                    }
                    disabled={working}
                    onCheckedChange={(value) =>
                      toggleAllVisible(value === true)
                    }
                    aria-label="Sélectionner toutes les notifications visibles"
                  />
                </th>
                <th className="p-2">Date</th>
                <th className="p-2">Destinataire</th>
                <th className="p-2">Type</th>
                <th className="p-2">Titre / détail</th>
                <th className="p-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/60 hover:bg-accent/40"
                >
                  <td className="p-2 align-top">
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      disabled={working}
                      onCheckedChange={(value) =>
                        toggleRow(row.id, value === true)
                      }
                      aria-label={`Sélectionner ${row.title}`}
                    />
                  </td>
                  <td className="whitespace-nowrap p-2 align-top text-xs text-muted-foreground">
                    {format(new Date(row.createdAt), "dd MMM yyyy HH:mm", {
                      locale: fr,
                    })}
                  </td>
                  <td className="p-2 align-top">
                    <p className="font-medium">{row.recipientName}</p>
                    {row.recipientEmail ? (
                      <p className="text-[11px] text-muted-foreground">
                        {row.recipientEmail}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-2 align-top">
                    <Badge
                      variant="outline"
                      className={
                        row.type === "PAYROLL_DEDUCTION"
                          ? "border-amber-300/70 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }
                    >
                      {typeLabel(row.type)}
                    </Badge>
                  </td>
                  <td className="p-2 align-top">
                    <button
                      type="button"
                      className="w-full cursor-pointer text-left"
                      title="Ouvrir"
                      onClick={() => {
                        if (row.href) router.push(row.href);
                      }}
                    >
                      <p className="font-medium">{row.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.body}
                      </p>
                    </button>
                  </td>
                  <td className="p-2 align-top">
                    <Badge variant={row.readAt ? "secondary" : "default"}>
                      {row.readAt ? "Lue" : "Non lue"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nettoyer définitivement</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-foreground">
              {pendingDelete?.all
                ? `Supprimer les ${pendingDelete.count} notification(s) paie de cette branche ?`
                : `Supprimer ${pendingDelete?.count ?? 0} notification(s) sélectionnée(s) ?`}{" "}
              Cette action retire les enregistrements de la base et allège le
              stockage. Elle est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void executeDelete();
              }}
            >
              Nettoyer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
