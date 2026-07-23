"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IconFileTypePdf } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/lib/auth-client";
import { getClassesAction } from "../../classe/classe.action";
import {
  getCurrentSchoolYearAction,
  getSchoolYearsAction1,
} from "../../schoolYear/schoolYear.action";
import {
  getUnpaidReportAction,
  getUnpaidReportContextAction,
  type UnpaidReportRow,
} from "../paiement.action";
import { exportUnpaidReportPdf } from "./export-unpaid-pdf";
import { formatReportAmount } from "@/lib/reports/format-amount";

type ClassOption = { id: string; name: string };
type YearOption = { id: string; name: string };

type UnpaidReportProps = {
  refreshKey?: number;
};

export default function UnpaidReport({ refreshKey = 0 }: UnpaidReportProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const branchIdFromPath = pathname.match(/\/branches\/([^/]+)/)?.[1];
  const branchId =
    branchIdFromPath ??
    session?.branch?.id ??
    session?.session?.activeBranchId;

  const [years, setYears] = useState<YearOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [schoolYearId, setSchoolYearId] = useState<string>("");
  const [classeId, setClasseId] = useState<string>("all");
  const [rows, setRows] = useState<UnpaidReportRow[]>([]);
  const [schoolYearLabel, setSchoolYearLabel] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    aJour: 0,
    partiel: 0,
    enRetard: 0,
  });
  const [totals, setTotals] = useState({
    totalDu: 0,
    totalPaye: 0,
    totalReste: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersReady, setFiltersReady] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState<string>("USD");

  useEffect(() => {
    void (async () => {
      const [context] = await getUnpaidReportContextAction();
      if (context?.baseCurrency) {
        setBaseCurrency(context.baseCurrency);
      }
    })();
  }, []);

  useEffect(() => {
    if (!branchId) return;

    const loadFilters = async () => {
      try {
        const [[yearsData], [classesData], [currentYear]] = await Promise.all([
          getSchoolYearsAction1({ branchId }),
          getClassesAction(),
          getCurrentSchoolYearAction(),
        ]);

        const yearOptions = (yearsData ?? []).map((year) => ({
          id: year.id,
          name: year.nameYear,
        }));
        setYears(yearOptions);

        const classOptions = (classesData ?? [])
          .map((classe) => ({
            id: classe.id,
            name: classe.nameClasse || classe.codeClasse || "Classe",
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "fr"));
        setClasses(classOptions);

        const defaultYearId = currentYear?.id ?? yearOptions[0]?.id ?? "";
        setSchoolYearId(defaultYearId);
      } catch (e) {
        console.error(e);
        setError("Impossible de charger les filtres du rapport.");
      } finally {
        setFiltersReady(true);
      }
    };

    void loadFilters();
  }, [branchId]);

  useEffect(() => {
    if (!filtersReady) return;

    if (!schoolYearId) {
      setLoading(false);
      setRows([]);
      setCounts({ aJour: 0, partiel: 0, enRetard: 0 });
      setTotals({ totalDu: 0, totalPaye: 0, totalReste: 0 });
      setSchoolYearLabel(null);
      setError("Aucune année scolaire disponible.");
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      setError(null);

      const [data, err] = await getUnpaidReportAction({
        schoolYearId,
        classeId: classeId === "all" ? null : classeId,
      });

      if (err || !data) {
        setError(
          err?.message ?? "Impossible de charger la situation financière.",
        );
        setRows([]);
        setCounts({ aJour: 0, partiel: 0, enRetard: 0 });
        setTotals({ totalDu: 0, totalPaye: 0, totalReste: 0 });
        setSchoolYearLabel(null);
      } else {
        setRows(data.rows);
        setCounts(data.counts);
        setTotals({
          totalDu: data.totalDu,
          totalPaye: data.totalPaye,
          totalReste: data.totalReste,
        });
        setSchoolYearLabel(data.schoolYearLabel);
      }

      setLoading(false);
    };

    void fetchReport();
  }, [filtersReady, schoolYearId, classeId, refreshKey]);

  const selectedClasseName =
    classeId === "all"
      ? null
      : (classes.find((c) => c.id === classeId)?.name ?? null);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const [context, err] = await getUnpaidReportContextAction();
      if (err || !context) {
        throw new Error(err?.message || "Impossible de charger le contexte");
      }

      await exportUnpaidReportPdf(rows, context, {
        schoolYearLabel,
        classeName: selectedClasseName,
        emptyMessage:
          rows.length === 0
            ? "Aucun élève / aucun impayé pour ces filtres."
            : undefined,
      });
      if (context.baseCurrency) {
        setBaseCurrency(context.baseCurrency);
      }
      toast.success("Rapport PDF généré avec succès.");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Erreur lors de la génération du PDF",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="rounded-xl border p-4">
      <CardHeader className="flex flex-col gap-4 px-0 pt-0 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Situation financière / impayés</CardTitle>
          <p className="text-sm text-muted-foreground">
            Élèves à jour, partiels ou en retard — montants dus et restes (
            {baseCurrency}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={schoolYearId || undefined}
            onValueChange={setSchoolYearId}
            disabled={!years.length}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={classeId} onValueChange={setClasseId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Classe" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classes.map((classe) => (
                  <SelectItem key={classe.id} value={classe.id}>
                    {classe.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={loading || exporting || !schoolYearId}
          >
            <IconFileTypePdf data-icon="inline-start" />
            {exporting ? "Génération..." : "Export PDF"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-0 pb-0">
        {loading ? (
          <div className="animate-pulse py-4 text-center text-sm text-muted-foreground">
            Chargement de la situation…
          </div>
        ) : error ? (
          <div className="py-4 text-sm text-destructive">{error}</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-border bg-muted p-4">
                <div className="text-sm text-muted-foreground">À jour</div>
                <div className="mt-2 text-2xl font-semibold">{counts.aJour}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted p-4">
                <div className="text-sm text-muted-foreground">Partiel</div>
                <div className="mt-2 text-2xl font-semibold">{counts.partiel}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted p-4">
                <div className="text-sm text-muted-foreground">En retard</div>
                <div className="mt-2 text-2xl font-semibold text-rose-600 dark:text-rose-400">
                  {counts.enRetard}
                </div>
              </div>
              <div className="rounded-xl border border-primary/30 bg-muted p-4 shadow-sm">
                <div className="text-sm font-medium text-foreground">
                  Reste total
                </div>
                <div className="mt-2 text-xl font-black tabular-nums tracking-normal text-primary sm:text-2xl">
                  {formatReportAmount(totals.totalReste, baseCurrency)}
                </div>
                <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                  Dû {formatReportAmount(totals.totalDu, baseCurrency)} · Payé{" "}
                  {formatReportAmount(totals.totalPaye, baseCurrency)}
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Aucun élève pour ces filtres. Vous pouvez quand même exporter un
                PDF avec ce message.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
