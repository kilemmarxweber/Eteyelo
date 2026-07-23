"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Clock3,
  Filter,
  RotateCcw,
  UserX,
  ShieldCheck,
} from "lucide-react";
import { IconListDetails } from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { AttendanceHourChart } from "../../../attendance/components/attendance-hour-chart";
import { AttendanceWeekdayChart } from "../../../attendance/components/attendance-weekday-chart";
import {
  ATTENDANCE_PERIOD_OPTIONS,
  MONTH_OPTIONS,
  type AttendancePeriod,
  type AttendanceReportFilters,
} from "../../../attendance/attendance-report-types";
import {
  getStudentPresenceReportAction,
  type StudentPresenceReport,
  type StudentPresenceRow,
} from "../student-presence.action";

const EMPTY_REPORT: StudentPresenceReport = {
  stats: {
    records: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  },
  weekdayStats: [],
  hourStats: [],
  rows: [],
};

function defaultFilters(): AttendanceReportFilters {
  const now = new Date();
  return {
    period: "month",
    month: now.getMonth(),
    year: now.getFullYear(),
    status: "ALL",
  };
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tous" },
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Retard" },
  { value: "EXCUSED", label: "Excuse" },
] as const;

function statusVariant(status: StudentPresenceRow["status"]) {
  switch (status) {
    case "PRESENT":
      return "success" as const;
    case "ABSENT":
      return "destructive" as const;
    case "LATE":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

type StudentPresenceSectionProps = {
  studentId: string;
};

export function StudentPresenceSection({ studentId }: StudentPresenceSectionProps) {
  const [filters, setFilters] = useState<AttendanceReportFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AttendanceReportFilters>(defaultFilters);
  const [report, setReport] = useState<StudentPresenceReport>(EMPTY_REPORT);
  const [pending, startTransition] = useTransition();

  const loadReport = useCallback(
    (nextFilters: AttendanceReportFilters) => {
      startTransition(async () => {
        try {
          const data = await getStudentPresenceReportAction(studentId, nextFilters);
          setReport(data);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossible de charger les presences.",
          );
        }
      });
    },
    [studentId],
  );

  useEffect(() => {
    loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  const applyFilters = () => setAppliedFilters({ ...filters });

  const resetFilters = () => {
    const next = defaultFilters();
    setFilters(next);
    setAppliedFilters(next);
  };

  const now = new Date();
  const years = Array.from({ length: 5 }, (_, index) => now.getFullYear() - index);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Presents"
          value={report.stats.present}
          icon={<CheckCircle2 className="size-4 text-emerald-600" />}
        />
        <StatCard
          label="Absents"
          value={report.stats.absent}
          icon={<UserX className="size-4 text-rose-600" />}
        />
        <StatCard
          label="Retards"
          value={report.stats.late}
          icon={<Clock3 className="size-4 text-amber-600" />}
        />
        <StatCard
          label="Excuses"
          value={report.stats.excused}
          icon={<ShieldCheck className="size-4 text-sky-600" />}
        />
      </div>

      <Card className="border-0 p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Periode
            </label>
            <Select
              value={filters.period ?? "month"}
              onValueChange={(value) =>
                setFilters({ ...filters, period: value as AttendancePeriod })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTENDANCE_PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Mois
            </label>
            <Select
              value={String(filters.month ?? now.getMonth())}
              onValueChange={(value) =>
                setFilters({ ...filters, month: Number(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((month, index) => (
                  <SelectItem key={month} value={String(index)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Annee
            </label>
            <Select
              value={String(filters.year ?? now.getFullYear())}
              onValueChange={(value) =>
                setFilters({ ...filters, year: Number(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Statut
            </label>
            <Select
              value={filters.status ?? "ALL"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  status: value as AttendanceReportFilters["status"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button className="flex-1" onClick={applyFilters} disabled={pending}>
              <Filter className="mr-2 size-4" />
              Filtrer
            </Button>
            <Button
              variant="outline"
              onClick={resetFilters}
              disabled={pending}
              aria-label="Reinitialiser"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <AttendanceWeekdayChart data={report.weekdayStats} />
        <AttendanceHourChart data={report.hourStats} />
      </div>

      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <IconListDetails size={18} className="text-primary" />
            <h3 className="font-semibold">Rapport journalier par cours</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {report.rows.length} enregistrement(s)
            {pending ? " · Chargement..." : ""}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Jour</th>
                <th className="px-5 py-3 font-medium">Cours</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Heure debut</th>
                <th className="px-5 py-3 font-medium">Heure fin</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-muted-foreground"
                  >
                    Aucune presence enregistree pour cette periode.
                  </td>
                </tr>
              ) : (
                report.rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold">
                        {new Date(row.date).toLocaleDateString("fr-FR")}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.dayLabel}</p>
                    </td>
                    <td className="px-5 py-4 align-top font-medium">
                      {row.courseName}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <Badge variant={statusVariant(row.status)}>
                        {row.statusLabel}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 align-top font-mono">
                      {row.arrival ?? "--:--:--"}
                    </td>
                    <td className="px-5 py-4 align-top font-mono">
                      {row.departure ?? "--:--:--"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Card className="border-0 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {value}
          </p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-full bg-muted/60">
          {icon}
        </div>
      </div>
    </Card>
  );
}
