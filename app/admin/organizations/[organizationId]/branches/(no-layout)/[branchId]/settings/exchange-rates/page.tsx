"use client";

import { useCallback, useEffect, useState } from "react";
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
  upsertExchangeRateAction,
} from "../exchange-rate.action";
import { CURRENCY_LABELS } from "@/lib/exchange-rate";
import type { CurrencyCode } from "@/prisma/generated/prisma/enums";

type RateRow = {
  id: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  isActive: boolean;
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
  const [, startTransition] = useTransition();

  const loadRates = useCallback(() => {
    startTransition(async () => {
      setLoading(true);
      const [data, err] = await listExchangeRatesAction();
      if (err) {
        toast.error(err.message);
        setLoading(false);
        return;
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSavingId(null);
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
            Ces taux s&apos;appliquent à toutes les branches. Une devise
            désactivée disparaît du basculeur de paiement.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Paire</th>
                <th className="px-3 py-2">Taux</th>
                <th className="px-3 py-2">Actif</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = drafts[row.id];
                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-3">
                      <p className="font-medium">
                        {row.fromCurrency} → {row.toCurrency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        1 {CURRENCY_LABELS[row.fromCurrency]} ={" "}
                        {draft?.rate || row.rate}{" "}
                        {CURRENCY_LABELS[row.toCurrency]}
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
                    colSpan={4}
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
