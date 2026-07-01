"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCashierReportAction } from "../paiement.action";

type CashierReportData = {
  date: string;
  incomeTotal: number;
  outflowTotal: number;
  balance: number;
  payments: Array<{ id: string; amount: number; transactionRef: string }>;
  expenses: Array<{ id: string; amount: number; transactionRef: string }>;
};

interface Props {
  refreshKey?: number;
  onToggleExpenseForm?: () => void;
  showExpenseForm?: boolean;
}

const formatAmount = (value: number) =>
  value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function CashierReport({
  refreshKey,
  onToggleExpenseForm,
  showExpenseForm,
}: Props) {
  const [report, setReport] = useState<CashierReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);

    const [data, err] = await getCashierReportAction({});
    if (err || !data) {
      setError(err?.message ?? "Impossible de charger le rapport de caisse.");
      setReport(null);
    } else {
      setReport(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, [refreshKey]);

  return (
    <Card className="rounded-xl border p-4">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Rapport de caisse</CardTitle>
          <p className="text-sm text-muted-foreground">
            Bilan quotidien des encaissements et sorties.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReport}
            disabled={loading}
          >
            Rafraîchir
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleExpenseForm}>
            {showExpenseForm ? "Masquer" : "Ajouter"} dépense
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div>Chargement...</div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : report ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-950">
              <div className="text-sm text-muted-foreground">Encaissements</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-600">
                {formatAmount(report.incomeTotal)}
              </div>
              <div className="text-sm text-secondary">
                {report.payments.length} entrée(s)
              </div>
            </div>
            <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-950">
              <div className="text-sm text-muted-foreground">Sorties</div>
              <div className="mt-2 text-2xl font-semibold text-rose-600">
                {formatAmount(report.outflowTotal)}
              </div>
              <div className="text-sm text-secondary">
                {report.expenses.length} dépense(s)
              </div>
            </div>
            <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-950">
              <div className="text-sm text-muted-foreground">Solde</div>
              <div className="mt-2 text-2xl font-semibold text-primary">
                {formatAmount(report.balance)}
              </div>
              <div className="text-sm text-secondary">
                Date: {new Date(report.date).toLocaleDateString("fr-FR")}
              </div>
            </div>
          </div>
        ) : (
          <div>Aucune donnée disponible.</div>
        )}
      </CardContent>
    </Card>
  );
}
