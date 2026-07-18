"use client";

import { useEffect, useState } from "react";
import { IconFileTypePdf, IconRefresh } from "@tabler/icons-react";
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
import { getClassesAction } from "../../classe/classe.action";
import {
  getStudentAttendanceReportAction,
  getStudentAttendanceReportContextAction,
  type StudentAttendanceReport,
} from "../attendance.action";
import { exportStudentAttendanceReportPdf } from "./export-student-attendance-pdf";

type ClassOption = { id: string; name: string };

function firstDayOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentAttendanceReport() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classeId, setClasseId] = useState<string>("all");
  const [startDate, setStartDate] = useState(firstDayOfMonthIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [report, setReport] = useState<StudentAttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersReady, setFiltersReady] = useState(false);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [classesData] = await getClassesAction();
        const classOptions = (classesData ?? [])
          .map((classe) => ({
            id: classe.id,
            name: classe.nameClasse || classe.codeClasse || "Classe",
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "fr"));
        setClasses(classOptions);
      } catch (e) {
        console.error(e);
        setError("Impossible de charger les classes.");
      } finally {
        setFiltersReady(true);
      }
    };

    void loadFilters();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);

    const [data, err] = await getStudentAttendanceReportAction({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      classeId: classeId === "all" ? null : classeId,
    });

    if (err || !data) {
      setError(
        err?.message ?? "Impossible de charger le rapport de présences.",
      );
      setReport(null);
    } else {
      setReport(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!filtersReady) return;
    void fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on filter changes only
  }, [filtersReady, startDate, endDate, classeId]);

  const handleExportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const [context, err] = await getStudentAttendanceReportContextAction();
      if (err || !context) {
        throw new Error(err?.message || "Impossible de charger le contexte");
      }

      await exportStudentAttendanceReportPdf(report, context, {
        emptyMessage:
          report.summary.total === 0
            ? "Aucune présence élève pour cette période."
            : undefined,
      });
      toast.success("Rapport PDF des présences élèves généré.");
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

  const summary = report?.summary;

  return (
    <Card className="rounded-xl border p-4">
      <CardHeader className="flex flex-col gap-4 px-0 pt-0 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Présences élèves</CardTitle>
          <p className="text-sm text-muted-foreground">
            Synthèse présents / absents / retards / excusés sur une période.
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
            <span className="text-sm text-muted-foreground">au</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-none bg-transparent text-sm focus:ring-0"
            />
          </div>

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
            onClick={() => void fetchReport()}
            disabled={loading}
          >
            <IconRefresh data-icon="inline-start" />
            Actualiser
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportPdf()}
            disabled={!report || loading || exporting}
          >
            <IconFileTypePdf data-icon="inline-start" />
            {exporting ? "Génération..." : "Export PDF"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-0 pb-0">
        {loading ? (
          <div className="animate-pulse py-4 text-center text-sm text-muted-foreground">
            Chargement des présences…
          </div>
        ) : error ? (
          <div className="py-4 text-sm text-destructive">{error}</div>
        ) : summary ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border bg-muted p-4">
                <div className="text-sm text-muted-foreground">Présents</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-600">
                  {summary.present}
                </div>
              </div>
              <div className="rounded-xl border bg-muted p-4">
                <div className="text-sm text-muted-foreground">Absents</div>
                <div className="mt-2 text-2xl font-semibold text-rose-600">
                  {summary.absent}
                </div>
              </div>
              <div className="rounded-xl border bg-muted p-4">
                <div className="text-sm text-muted-foreground">Retards</div>
                <div className="mt-2 text-2xl font-semibold">{summary.late}</div>
              </div>
              <div className="rounded-xl border bg-muted p-4">
                <div className="text-sm text-muted-foreground">Excusés</div>
                <div className="mt-2 text-2xl font-semibold">{summary.excused}</div>
              </div>
            </div>

            {summary.total === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Aucune présence pour cette période. Vous pouvez quand même
                exporter un PDF avec ce message.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {report?.details.length ?? 0} élève(s) · {summary.total}{" "}
                pointage(s) — le PDF inclut le détail par élève.
              </p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
