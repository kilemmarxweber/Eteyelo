"use client";

import { useEffect, useState } from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCashierReportAction,
  getCashierReportContextAction,
} from "../paiement.action";
import { exportCashierReportPdf } from "./export-cashier-pdf";
import { toast } from "sonner";
import { IconFileTypePdf, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type CashierReportData = {
  date: string;
  endDate: string;
  openingBalance: number;
  hasOpeningBalance: boolean;
  openingLabel?: string;
  openingNote: string | null;
  incomeTotal: number;
  outflowTotal: number;
  periodBalance: number;
  balance: number;
  payments: Array<{
    id: string;
    amount: number;
    transactionRef: string;
    method?: string | null;
    studentName: string;
    createdAt: string;
    frais?: { nameFrais: string } | null;
  }>;
  expenses: Array<{
    id: string;
    amount: number;
    transactionRef: string;
    description: string | null;
    category: string | null;
    createdAt: string;
  }>;
};

interface Props {
  refreshKey?: number;
  onToggleExpenseForm?: () => void;
  showExpenseForm?: boolean;
}

const formatAmount = (value: number, currency = "USD") =>
  `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  })} ${currency}`;

export default function CashierReport({
  refreshKey,
  onToggleExpenseForm,
  showExpenseForm,
}: Props) {
  const [report, setReport] = useState<CashierReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<string>("USD");

  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  const fetchReport = async () => {
    setLoading(true);
    setError(null);

    const [data, err] = await getCashierReportAction({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    if (err || !data) {
      setError(err?.message ?? "Impossible de charger le rapport de caisse.");
      setReport(null);
    } else {
      setReport(data);
    }

    setLoading(false);
  };

  const handleExportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const [context, err] = await getCashierReportContextAction();
      if (err || !context) {
        throw new Error(err?.message || "Impossible de charger le contexte");
      }

      await exportCashierReportPdf(report, context, {
        dateStart: report.date,
        dateEnd: report.endDate,
      });
      if (context.baseCurrency) {
        setBaseCurrency(context.baseCurrency);
      }
      toast.success("Rapport PDF généré avec succès.");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération du PDF");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, [refreshKey, startDate, endDate]);

  useEffect(() => {
    void (async () => {
      const [context] = await getCashierReportContextAction();
      if (context?.baseCurrency) {
        setBaseCurrency(context.baseCurrency);
      }
    })();
  }, []);

  return (
    <Card className="rounded-xl border p-4">
      <CardHeader className="flex flex-col gap-4 px-0 pt-0 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Rapport de caisse</CardTitle>
          <p className="text-sm text-muted-foreground">
            Solde d&apos;ouverture = solde net de la veille. Solde net =
            ouverture + encaissements - depenses. Montants en{" "}
            <span className="font-medium text-foreground">{baseCurrency}</span>.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-none bg-transparent text-sm focus:ring-0"
            />
            <span className="text-sm text-muted-foreground">au</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-none bg-transparent text-sm focus:ring-0"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchReport()}
            disabled={loading}
          >
            <IconRefresh size={16} className="mr-2" />
            Actualiser
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={!report || loading || exporting}
          >
            <IconFileTypePdf size={16} className="mr-2" />
            {exporting ? "Génération..." : "Imprimer PDF"}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onToggleExpenseForm}
            aria-label={
              showExpenseForm ? "Masquer la dépense" : "Ajouter une dépense"
            }
            title={
              showExpenseForm ? "Masquer la dépense" : "Ajouter une dépense"
            }
            className={cn(
              "size-8 shrink-0 border-transparent p-0 text-white shadow-sm",
              "bg-red-900 hover:bg-red-950 focus-visible:ring-red-900/40",
              showExpenseForm && "bg-red-950 ring-2 ring-red-900/30",
            )}
          >
            <HandCoins className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-0">
        {loading ? (
          <div className="animate-pulse py-4 text-center text-sm text-muted-foreground">
            Chargement du rapport...
          </div>
        ) : error ? (
          <div className="py-4 text-sm text-destructive">{error}</div>
        ) : report ? (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-muted p-4">
              <div className="text-sm text-muted-foreground">
                Solde d&apos;ouverture
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {formatAmount(report.openingBalance, baseCurrency)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {report.openingLabel ?? "Solde net de la veille (automatique)"}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted p-4">
              <div className="text-sm text-muted-foreground">Encaissements</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {formatAmount(report.incomeTotal, baseCurrency)}
              </div>
              <div className="text-sm text-secondary">
                {report.payments.length} entrée(s)
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted p-4">
              <div className="text-sm text-muted-foreground">Sorties</div>
              <div className="mt-2 text-2xl font-semibold text-rose-600 dark:text-rose-400">
                {formatAmount(report.outflowTotal, baseCurrency)}
              </div>
              <div className="text-sm text-secondary">
                {report.expenses.length} dépense(s)
              </div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-muted p-4 shadow-sm">
              <div className="text-sm font-medium text-foreground">Solde Net</div>
              <div className="mt-2 text-2xl font-black text-primary">
                {formatAmount(report.balance, baseCurrency)}
              </div>
              <div className="text-sm text-secondary">
                Periode {formatAmount(report.periodBalance, baseCurrency)}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 text-sm text-muted-foreground">
            Aucune donnée disponible.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
