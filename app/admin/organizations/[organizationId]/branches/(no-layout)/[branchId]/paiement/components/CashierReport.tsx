"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  HandCoins,
  Scale,
  Wallet,
} from "lucide-react";
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
import { formatReportAmount } from "@/lib/reports/format-amount";

type CashierReportData = {
  date: string;
  endDate: string;
  openingBalance: number;
  hasOpeningBalance: boolean;
  openingLabel?: string;
  openingNote: string | null;
  scopedToSelf?: boolean;
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
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  delayClass,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "income" | "expense" | "net";
  delayClass?: string;
}) {
  const toneClass = {
    neutral: "from-slate-500/10 to-transparent text-foreground",
    income: "from-emerald-500/12 to-transparent text-emerald-700 dark:text-emerald-400",
    expense: "from-rose-500/12 to-transparent text-rose-700 dark:text-rose-400",
    net: "from-primary/15 to-transparent text-primary",
  }[tone];

  const iconWrap = {
    neutral: "bg-muted text-muted-foreground",
    income: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    expense: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    net: "bg-primary/15 text-primary",
  }[tone];

  return (
    <div
      className={cn(
        "animate-fade-up group relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-md hover:border-border",
        delayClass,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
          toneClass,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
              tone === "income" && "text-emerald-700 dark:text-emerald-400",
              tone === "expense" && "text-rose-700 dark:text-rose-400",
              tone === "net" && "text-primary",
            )}
          >
            {value}
          </p>
          {hint ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105",
            iconWrap,
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

export default function CashierReport({
  refreshKey,
  onToggleExpenseForm,
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
    <Card className="mx-auto w-full max-w-7xl overflow-hidden rounded-2xl border-border/70 shadow-sm ring-1 ring-black/[0.02]">
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 bg-gradient-to-r from-muted/40 via-background to-background px-4 py-4 sm:px-5 md:flex-row md:items-start md:justify-between">
        <div className="w-full max-w-4xl">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-4" />
            </span>
            {report?.scopedToSelf ? "Ma caisse" : "Rapport de caisse"}
          </CardTitle>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-2 py-1 shadow-sm">
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
            className="transition-transform active:scale-[0.98]"
          >
            <IconRefresh
              size={16}
              className={cn("mr-2", loading && "animate-spin")}
            />
            Actualiser
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={!report || loading || exporting}
            className="transition-transform active:scale-[0.98]"
          >
            <IconFileTypePdf size={16} className="mr-2" />
            {exporting ? "Génération..." : "Imprimer PDF"}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onToggleExpenseForm}
            aria-label="Dépense ou sortie de fond"
            title="Dépense ou sortie de fond"
            className={cn(
              "size-8 shrink-0 border-transparent p-0 text-white shadow-sm transition-transform active:scale-95",
              "bg-red-900 hover:bg-red-950 focus-visible:ring-red-900/40",
            )}
          >
            <HandCoins className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-4 sm:px-5">
        {loading ? (
          <div className="grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[104px] animate-pulse rounded-xl border bg-muted/50"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : report ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Solde d'ouverture"
              value={formatReportAmount(report.openingBalance, baseCurrency)}
              hint={
                report.openingLabel ?? "Solde net de la veille (automatique)"
              }
              icon={Scale}
              tone="neutral"
            />
            <MetricCard
              label="Encaissements"
              value={formatReportAmount(report.incomeTotal, baseCurrency)}
              hint={`${report.payments.length} entrée(s)`}
              icon={ArrowUpRight}
              tone="income"
              delayClass="animate-delay-75"
            />
            <MetricCard
              label="Sorties de fond"
              value={formatReportAmount(report.outflowTotal, baseCurrency)}
              hint={`${report.expenses.length} sortie(s) de fond`}
              icon={ArrowDownRight}
              tone="expense"
              delayClass="animate-delay-150"
            />
            <MetricCard
              label="Solde net"
              value={formatReportAmount(report.balance, baseCurrency)}
              hint={`Période ${formatReportAmount(report.periodBalance, baseCurrency)}`}
              icon={Wallet}
              tone="net"
              delayClass="animate-delay-225"
            />
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
