"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { IconCurrencyDollar, IconDeviceFloppy } from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";
import {
  listExchangeRatesAction,
  selectExchangeRateAction,
  upsertExchangeRateAction,
  getFinanceDisplaySettingsAction,
  updateFinanceDisplaySettingsAction,
} from "../exchange-rate.action";
import { CURRENCY_LABELS, getBaseCurrency } from "@/lib/exchange-rate";
import type { CurrencyCode } from "@/prisma/generated/prisma/enums";

type RateRow = {
  id: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  isActive: boolean;
  isSelected?: boolean;
  updatedAt: Date;
};

type Draft = {
  rate: string;
  isActive: boolean;
  dirty: boolean;
};

export default function ExchangeRatesSettingsPage() {
  const [rows, setRows] = useState<RateRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [showReceiptConversion, setShowReceiptConversion] = useState(true);
  const [notifyParentOnPayment, setNotifyParentOnPayment] = useState(true);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [, startTransition] = useTransition();

  const baseCurrency = useMemo(() => getBaseCurrency(rows), [rows]);
  const selectedRow = useMemo(
    () => rows.find((row) => row.isSelected) ?? null,
    [rows],
  );

  const loadRates = useCallback(() => {
    startTransition(async () => {
      setLoading(true);
      const [[data, err], [display, displayErr]] = await Promise.all([
        listExchangeRatesAction(),
        getFinanceDisplaySettingsAction(),
      ]);
      if (err) {
        toast.error(err.message);
        setLoading(false);
        return;
      }
      if (!displayErr && display) {
        setShowReceiptConversion(display.showReceiptConversion);
        setNotifyParentOnPayment(display.notifyParentOnPayment);
      }
      const list = data ?? [];
      setRows(list);
      setDrafts(
        Object.fromEntries(
          list.map((row) => [
            row.id,
            {
              rate: String(row.rate),
              isActive: row.isActive,
              dirty: false,
            },
          ]),
        ),
      );
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
        dirty: true,
      },
    }));
  }

  async function saveRow(row: RateRow) {
    const draft = drafts[row.id];
    if (!draft) return;
    const rate = Number(draft.rate.replace(",", "."));
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error("Taux invalide.");
      return;
    }

    setSavingId(row.id);
    try {
      const [saved, err] = await upsertExchangeRateAction({
        fromCurrency: row.fromCurrency,
        toCurrency: row.toCurrency,
        rate,
        isActive: draft.isActive,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      toast.success("Taux enregistré.");
      if (saved) {
        setRows((prev) =>
          prev.map((item) => (item.id === row.id ? { ...item, ...saved } : item)),
        );
        setDrafts((prev) => ({
          ...prev,
          [row.id]: {
            rate: String(saved.rate),
            isActive: saved.isActive,
            dirty: false,
          },
        }));
      }
      loadRates();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function selectRow(row: RateRow) {
    setSelectingId(row.id);
    try {
      const [saved, err] = await selectExchangeRateAction({ id: row.id });
      if (err) {
        toast.error(err.message);
        return;
      }
      toast.success(
        `Taux sélectionné : devise de base = ${saved?.fromCurrency ?? row.fromCurrency}`,
      );
      loadRates();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Sélection impossible.",
      );
    } finally {
      setSelectingId(null);
    }
  }

  async function saveDisplaySettings(patch: {
    showReceiptConversion?: boolean;
    notifyParentOnPayment?: boolean;
  }) {
    const nextConversion = patch.showReceiptConversion ?? showReceiptConversion;
    const nextNotify = patch.notifyParentOnPayment ?? notifyParentOnPayment;
    setSavingDisplay(true);
    try {
      const [saved, err] = await updateFinanceDisplaySettingsAction({
        showReceiptConversion: nextConversion,
        notifyParentOnPayment: nextNotify,
      });
      if (err) {
        toast.error(err.message);
        return;
      }
      if (saved) {
        setShowReceiptConversion(saved.showReceiptConversion);
        setNotifyParentOnPayment(saved.notifyParentOnPayment);
      }
      toast.success("Option enregistrée.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSavingDisplay(false);
    }
  }

  return (
    <RequireBranchOrgSettingsAccess>
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Taux de change</h2>
            <Badge
              variant="outline-primary"
              icon={<IconCurrencyDollar size={14} />}
            >
              Organisation
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Le taux sélectionné définit la devise de base (source). Exemple :
            AOA → USD ⇒ base = AOA, convertible en USD. Ces taux
            s&apos;appliquent à toutes les branches.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium">Conversion sur le reçu</p>
              <p className="text-sm text-muted-foreground">
                Afficher la deuxième devise (taux de change) sur les reçus. Désactivez
                si vous encaissez uniquement en AOA, sans conversion.
              </p>
            </div>
            <Switch
              checked={showReceiptConversion}
              disabled={savingDisplay}
              onCheckedChange={(checked) => {
                setShowReceiptConversion(checked);
                void saveDisplaySettings({ showReceiptConversion: checked });
              }}
            />
          </div>
          <div className="flex items-start justify-between gap-4 border-t pt-3">
            <div className="space-y-1">
              <p className="font-medium">Notifier le parent</p>
              <p className="text-sm text-muted-foreground">
                Envoyer un e-mail et un WhatsApp (si le numéro est renseigné) au
                parent lors d’un paiement, d’une modification ou d’une suppression.
                Une notification apparaît aussi dans son compte.
              </p>
            </div>
            <Switch
              checked={notifyParentOnPayment}
              disabled={savingDisplay}
              onCheckedChange={(checked) => {
                setNotifyParentOnPayment(checked);
                void saveDisplaySettings({ notifyParentOnPayment: checked });
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
          <p>
            <span className="font-medium">Devise de base :</span>{" "}
            {CURRENCY_LABELS[baseCurrency]} ({baseCurrency})
          </p>
          {selectedRow ? (
            <p className="mt-1 text-muted-foreground">
              Taux sélectionné : {selectedRow.fromCurrency} →{" "}
              {selectedRow.toCurrency} (1 {selectedRow.fromCurrency} ={" "}
              {selectedRow.rate} {selectedRow.toCurrency})
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground">
              Aucun taux sélectionné — sélectionnez une paire ci-dessous.
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Paire</th>
                <th className="px-3 py-2">Taux</th>
                <th className="px-3 py-2">Actif</th>
                <th className="px-3 py-2">Base</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = drafts[row.id];
                const isSelected = Boolean(row.isSelected);
                return (
                  <tr
                    key={row.id}
                    className={`border-t ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        <span>
                          {row.fromCurrency} → {row.toCurrency}
                        </span>
                        {isSelected ? (
                          <Badge variant="outline-primary">Sélectionné</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        1 {CURRENCY_LABELS[row.fromCurrency]} ={" "}
                        {draft?.rate || row.rate}{" "}
                        {CURRENCY_LABELS[row.toCurrency]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Base si sélectionné : {row.fromCurrency}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        className="h-9 w-36"
                        inputMode="decimal"
                        value={draft?.rate ?? String(row.rate)}
                        onChange={(event) =>
                          updateDraft(row.id, { rate: event.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Switch
                        checked={draft?.isActive ?? row.isActive}
                        onCheckedChange={(checked) =>
                          updateDraft(row.id, { isActive: checked })
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        disabled={
                          isSelected ||
                          !(draft?.isActive ?? row.isActive) ||
                          selectingId === row.id
                        }
                        onClick={() => void selectRow(row)}
                      >
                        {selectingId === row.id
                          ? "..."
                          : isSelected
                            ? "Base"
                            : "Utiliser"}
                      </Button>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant={draft?.dirty ? "default" : "outline"}
                        disabled={!draft?.dirty || savingId === row.id}
                        onClick={() => void saveRow(row)}
                      >
                        <IconDeviceFloppy className="mr-1 size-4" />
                        {savingId === row.id ? "..." : "Enregistrer"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    {loading
                      ? "Chargement..."
                      : "Aucun taux configuré pour cette organisation."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
