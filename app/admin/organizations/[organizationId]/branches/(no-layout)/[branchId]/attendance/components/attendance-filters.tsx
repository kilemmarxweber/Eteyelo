"use client";

import {
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  ATTENDANCE_PERIOD_OPTIONS,
  MONTH_OPTIONS,
  type AttendancePeriod,
  type AttendanceReportFilters,
} from "../attendance-report-types";

type AttendanceFiltersProps = {
  filters: AttendanceReportFilters;
  onChange: (filters: AttendanceReportFilters) => void;
  onApply: () => void;
  onReset: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onPrint?: () => void;
  pending?: boolean;
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tous" },
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Retard" },
  { value: "EXCUSED", label: "Excuse" },
] as const;

export function AttendanceFilters({
  filters,
  onChange,
  onApply,
  onReset,
  onExportExcel,
  onExportPdf,
  onPrint,
  pending = false,
}: AttendanceFiltersProps) {
  const now = new Date();
  const years = Array.from({ length: 5 }, (_, index) => now.getFullYear() - index);

  return (
    <Card className="border-0 p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase text-muted-foreground">
            Periode
          </label>
          <Select
            value={filters.period ?? "month"}
            onValueChange={(value) =>
              onChange({ ...filters, period: value as AttendancePeriod })
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
              onChange({ ...filters, month: Number(value) })
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
              onChange({ ...filters, year: Number(value) })
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
              onChange({
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

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase text-muted-foreground">
            Rechercher
          </label>
          <Input
            placeholder="Nom ou matricule..."
            value={filters.search ?? ""}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
          />
        </div>

        <div className="flex items-end">
          <Button className="w-full" onClick={onApply} disabled={pending}>
            <Filter className="mr-2 size-4" />
            Filtrer
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={onReset} disabled={pending}>
          <RotateCcw className="mr-2 size-4" />
          Reinitialiser
        </Button>
        <Button variant="outline" size="sm" onClick={onExportExcel}>
          <FileSpreadsheet className="mr-2 size-4" />
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={onExportPdf}>
          <FileText className="mr-2 size-4" />
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={onPrint}>
          <Printer className="mr-2 size-4" />
          Imprimer
        </Button>
      </div>
    </Card>
  );
}
