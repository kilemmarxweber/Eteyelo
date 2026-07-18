"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCashierReportAction, getCashierReportContextAction } from "../paiement.action";
import { exportCashierReportPdf } from "./export-cashier-pdf";
import { toast } from "sonner";
import { IconFileTypePdf, IconRefresh } from "@tabler/icons-react";

type CashierReportData = {
  date: string;
  endDate: string;
  incomeTotal: number;
  outflowTotal: number;
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
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
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
      if (err || !context) throw new Error(err?.message || "Impossible de charger le contexte");
      
      await exportCashierReportPdf(report, context, {
        dateStart: report.date,
        dateEnd: report.endDate,
      });
      toast.success("Rapport PDF généré avec succès.");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération du PDF");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [refreshKey, startDate, endDate]);

  return (
    <Card className="rounded-xl border p-4">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between px-0 pt-0">
        <div>
          <CardTitle>Rapport de caisse</CardTitle>
          <p className="text-sm text-muted-foreground">
            Bilan des encaissements et sorties.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-2 items-center bg-muted/50 p-1 rounded-md">
            <input 
              type="date" 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-sm border-none bg-transparent focus:ring-0"
            />
            <span className="text-sm text-muted-foreground">au</span>
            <input 
              type="date" 
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-sm border-none bg-transparent focus:ring-0"
            />
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReport}
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

          <Button variant="default" size="sm" onClick={onToggleExpenseForm}>
            {showExpenseForm ? "Masquer" : "Ajouter"} dépense
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-0">
        {loading ? (
          <div className="py-4 text-center text-sm text-muted-foreground animate-pulse">
            Chargement du rapport...
          </div>
        ) : error ? (
          <div className="text-sm text-destructive py-4">{error}</div>
        ) : report ? (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-muted p-4">
              <div className="text-sm text-muted-foreground">Solde d'ouverture</div>
              <div className="mt-2 text-xl font-semibold text-muted-foreground">
                Non géré
              </div>
              <div className="text-xs text-secondary mt-1">
                Phase 15
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted p-4">
              <div className="text-sm text-muted-foreground">Encaissements</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {formatAmount(report.incomeTotal)}
              </div>
              <div className="text-sm text-secondary">
                {report.payments.length} entrée(s)
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted p-4">
              <div className="text-sm text-muted-foreground">Sorties</div>
              <div className="mt-2 text-2xl font-semibold text-rose-600 dark:text-rose-400">
                {formatAmount(report.outflowTotal)}
              </div>
              <div className="text-sm text-secondary">
                {report.expenses.length} dépense(s)
              </div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-muted p-4 shadow-sm">
              <div className="text-sm font-medium text-foreground">Solde Net</div>
              <div className="mt-2 text-2xl font-black text-primary">
                {formatAmount(report.balance)}
              </div>
              <div className="text-sm text-secondary">
                Sur la période
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 text-sm text-muted-foreground">Aucune donnée disponible.</div>
        )}
      </CardContent>
    </Card>
  );
}
