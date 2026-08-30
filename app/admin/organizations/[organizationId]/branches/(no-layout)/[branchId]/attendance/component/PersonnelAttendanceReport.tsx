"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { IconFileTypePdf, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPersonnelAttendanceReportAction,
  getPersonnelAttendanceReportContextAction,
  type PersonnelAttendanceReport,
} from "../attendance.action";
import { exportPersonnelAttendanceReportPdf } from "./export-personnel-attendance-pdf";
import { buildAttendancePdfLabels } from "../attendance-pdf-labels";

function firstDayOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PersonnelAttendanceReport({
  selfOnly = false,
}: {
  selfOnly?: boolean;
}) {
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const pdfLabels = useMemo(() => buildAttendancePdfLabels(t), [t]);
  const [startDate, setStartDate] = useState(firstDayOfMonthIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [report, setReport] = useState<PersonnelAttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);

    const [data, err] = await getPersonnelAttendanceReportAction({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      selfOnly,
    });

    if (err || !data) {
      setError(err?.message ?? t("reportCards.loadPersonnelFailed"));
      setReport(null);
    } else {
      setReport(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on filter / scope changes only
  }, [startDate, endDate, selfOnly]);

  const handleExportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const [context, err] = await getPersonnelAttendanceReportContextAction();
      if (err || !context) {
        throw new Error(err?.message || t("reportCards.loadContextFailed"));
      }

      await exportPersonnelAttendanceReportPdf(report, context, pdfLabels, {
        emptyMessage:
          report.summary.total === 0
            ? t("reportCards.emptyPersonnel")
            : undefined,
      });
      toast.success(t("reportCards.personnelPdfSuccess"));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("reportCards.pdfGenerateError"),
      );
    } finally {
      setExporting(false);
    }
  };

  const summary = report?.summary;

  return (
    <Card className="rounded-xl border p-4">
      <CardHeader className="flex flex-col gap-4 px-0 pt-0 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>
            {selfOnly ? t("reportCards.myReport") : t("reportCards.personnelTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("reportCards.summaryDescription")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-none bg-transparent text-sm focus:ring-0"
            />
            <span className="text-sm text-muted-foreground">{t("filters.to")}</span>
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
            <IconRefresh data-icon="inline-start" />
            {t("filters.refresh")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportPdf()}
            disabled={!report || loading || exporting}
          >
            <IconFileTypePdf data-icon="inline-start" />
            {exporting ? t("reportCards.generating") : tCommon("exportPdf")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-0 pb-0">
        {loading ? (
          <div className="animate-pulse py-4 text-center text-sm text-muted-foreground">
            {t("reportCards.loading")}
          </div>
        ) : error ? (
          <div className="py-4 text-sm text-destructive">{error}</div>
        ) : summary ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border bg-muted p-4">
                <div className="text-sm text-muted-foreground">{t("stats.present")}</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-600">
                  {summary.present}
                </div>
              </div>
              <div className="rounded-xl border bg-muted p-4">
                <div className="text-sm text-muted-foreground">{t("stats.absent")}</div>
                <div className="mt-2 text-2xl font-semibold text-rose-600">
                  {summary.absent}
                </div>
              </div>
              <div className="rounded-xl border bg-muted p-4">
                <div className="text-sm text-muted-foreground">{t("stats.late")}</div>
                <div className="mt-2 text-2xl font-semibold">{summary.late}</div>
              </div>
              <div className="rounded-xl border bg-muted p-4">
                <div className="text-sm text-muted-foreground">{t("stats.excused")}</div>
                <div className="mt-2 text-2xl font-semibold">
                  {summary.excused}
                </div>
              </div>
            </div>

            {summary.total === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                {t("reportCards.emptyExportHint")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("reportCards.personnelDetail", {
                  count: report?.details.length ?? 0,
                  total: summary.total,
                })}
              </p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
