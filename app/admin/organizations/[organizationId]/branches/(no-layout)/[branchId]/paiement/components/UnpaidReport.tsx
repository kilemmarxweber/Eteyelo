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
import { cycleLabel } from "@/lib/cycle";
import { useTranslations } from "next-intl";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

type ClassOption = { id: string; name: string };
type YearOption = { id: string; name: string };

type UnpaidReportProps = {
  refreshKey?: number;
};

export default function UnpaidReport({ refreshKey = 0 }: UnpaidReportProps) {
  const t = useTranslations("finance");
  const peopleLabels = useBranchPeopleLabels();
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
  const [cycle, setCycle] = useState<string>("all");
  const [byCycle, setByCycle] = useState<
    Array<{ cycle: string; totalDu: number; totalPaye: number; totalReste: number }>
  >([]);
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
    totalRemise: 0,
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
            name: classe.nameClasse || classe.codeClasse || t("unpaid.classFallback"),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "fr"));
        setClasses(classOptions);

        const defaultYearId = currentYear?.id ?? yearOptions[0]?.id ?? "";
        setSchoolYearId(defaultYearId);
      } catch (e) {
        console.error(e);
        setError(t("unpaid.loadFiltersFailed"));
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
      setTotals({ totalDu: 0, totalPaye: 0, totalReste: 0, totalRemise: 0 });
      setSchoolYearLabel(null);
      setError(t("unpaid.noYear"));
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      setError(null);

      const [data, err] = await getUnpaidReportAction({
        schoolYearId,
        classeId: classeId === "all" ? null : classeId,
        cycle: cycle === "all" ? null : cycle,
      });

      if (err || !data) {
        setError(
          err?.message ?? t("unpaid.loadFailed"),
        );
        setRows([]);
        setCounts({ aJour: 0, partiel: 0, enRetard: 0 });
        setTotals({ totalDu: 0, totalPaye: 0, totalReste: 0, totalRemise: 0 });
        setSchoolYearLabel(null);
        setByCycle([]);
      } else {
        setRows(data.rows);
        setCounts(data.counts);
        setTotals({
          totalDu: data.totalDu,
          totalPaye: data.totalPaye,
          totalReste: data.totalReste,
          totalRemise: data.totalRemise ?? 0,
        });
        setSchoolYearLabel(data.schoolYearLabel);
        setByCycle(data.byCycle ?? []);
      }

      setLoading(false);
    };

    void fetchReport();
  }, [filtersReady, schoolYearId, classeId, cycle, refreshKey]);

  const selectedClasseName =
    classeId === "all"
      ? null
      : (classes.find((c) => c.id === classeId)?.name ?? null);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const [context, err] = await getUnpaidReportContextAction();
      if (err || !context) {
        throw new Error(err?.message || t("unpaid.contextFailed"));
      }

      await exportUnpaidReportPdf(rows, context, {
        schoolYearLabel,
        classeName: selectedClasseName,
        emptyMessage:
          rows.length === 0
            ? t("unpaid.emptyPdf", { student: peopleLabels.studentLower })
            : undefined,
      });
      if (context.baseCurrency) {
        setBaseCurrency(context.baseCurrency);
      }
      toast.success(t("unpaid.pdfSuccess"));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("unpaid.pdfError"),
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="rounded-xl border p-4">
      <CardHeader className="flex flex-col gap-4 px-0 pt-0 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{t("unpaid.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("unpaid.description", {
              students: peopleLabels.studentPlural,
              currency: baseCurrency,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={schoolYearId || undefined}
            onValueChange={setSchoolYearId}
            disabled={!years.length}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t("unpaid.year")} />
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
              <SelectValue placeholder={t("unpaid.class")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{t("unpaid.allClasses")}</SelectItem>
                {classes.map((classe) => (
                  <SelectItem key={classe.id} value={classe.id}>
                    {classe.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={cycle} onValueChange={setCycle}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Cycle" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Tous les cycles</SelectItem>
                <SelectItem value="MATERNELLE">Maternelle</SelectItem>
                <SelectItem value="PRIMAIRE">Primaire</SelectItem>
                <SelectItem value="SECONDAIRE">Secondaire</SelectItem>
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
            {exporting ? t("unpaid.generating") : t("unpaid.exportPdf")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-0 pb-0">
        {loading ? (
          <div className="animate-pulse py-4 text-center text-sm text-muted-foreground">
            {t("unpaid.loading")}
          </div>
        ) : error ? (
          <div className="py-4 text-sm text-destructive">{error}</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-border bg-muted p-4">
                <div className="text-sm text-muted-foreground">{t("unpaid.upToDate")}</div>
                <div className="mt-2 text-2xl font-semibold">{counts.aJour}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted p-4">
                <div className="text-sm text-muted-foreground">{t("unpaid.partial")}</div>
                <div className="mt-2 text-2xl font-semibold">{counts.partiel}</div>
              </div>
              <div className="rounded-xl border border-border bg-muted p-4">
                <div className="text-sm text-muted-foreground">{t("unpaid.late")}</div>
                <div className="mt-2 text-2xl font-semibold text-rose-600 dark:text-rose-400">
                  {counts.enRetard}
                </div>
              </div>
              <div className="rounded-xl border border-primary/30 bg-muted p-4 shadow-sm">
                <div className="text-sm font-medium text-foreground">
                  {t("unpaid.totalRemaining")}
                </div>
                <div className="mt-2 text-xl font-black tabular-nums tracking-normal text-primary sm:text-2xl">
                  {formatReportAmount(totals.totalReste, baseCurrency)}
                </div>
                <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                  {t("unpaid.duePaid", {
                    due: formatReportAmount(totals.totalDu, baseCurrency),
                    paid: formatReportAmount(totals.totalPaye, baseCurrency),
                  })}
                  {totals.totalRemise > 0
                    ? t("unpaid.discountPart", {
                        amount: formatReportAmount(
                          totals.totalRemise,
                          baseCurrency,
                        ),
                      })
                    : ""}
                </div>
              </div>
            </div>

            {byCycle.length > 1 ? (
              <div className="grid gap-3 md:grid-cols-3">
                {byCycle.map((item) => (
                  <div
                    key={item.cycle}
                    className="rounded-xl border border-border bg-muted/40 p-3"
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      {cycleLabel(item.cycle)}
                    </div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">
                      {formatReportAmount(item.totalReste, baseCurrency)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {rows.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                {t("unpaid.empty", { student: peopleLabels.studentLower })}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
