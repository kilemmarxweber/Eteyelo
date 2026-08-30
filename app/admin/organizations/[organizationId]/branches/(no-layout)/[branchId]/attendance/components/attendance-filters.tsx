"use client";

import {
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
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
import type {
  AttendancePeriod,
  AttendanceReportFilters,
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

const PERIOD_VALUES: AttendancePeriod[] = ["today", "week", "month", "year"];
const STATUS_VALUES = ["ALL", "PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

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
  const t = useTranslations("attendance");
  const tCommon = useTranslations("common");
  const now = new Date();
  const years = Array.from({ length: 5 }, (_, index) => now.getFullYear() - index);

  return (
    <Card className="border-0 p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase text-muted-foreground">
            {t("filters.period")}
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
              {PERIOD_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`period.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase text-muted-foreground">
            {t("filters.month")}
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
              {Array.from({ length: 12 }, (_, index) => (
                <SelectItem key={index} value={String(index)}>
                  {t(`months.${index}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase text-muted-foreground">
            {t("filters.year")}
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
            {t("filters.status")}
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
              {STATUS_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "ALL"
                    ? t("filters.allStatus")
                    : t(`status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase text-muted-foreground">
            {tCommon("search")}
          </label>
          <Input
            placeholder={t("filters.searchPlaceholder")}
            value={filters.search ?? ""}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
          />
        </div>

        <div className="flex items-end">
          <Button className="w-full" onClick={onApply} disabled={pending}>
            <Filter className="mr-2 size-4" />
            {t("filters.filter")}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={onReset} disabled={pending}>
          <RotateCcw className="mr-2 size-4" />
          {t("filters.reset")}
        </Button>
        <Button variant="outline" size="sm" onClick={onExportExcel}>
          <FileSpreadsheet className="mr-2 size-4" />
          {t("filters.excel")}
        </Button>
        <Button variant="outline" size="sm" onClick={onExportPdf}>
          <FileText className="mr-2 size-4" />
          {t("filters.pdf")}
        </Button>
        <Button variant="outline" size="sm" onClick={onPrint}>
          <Printer className="mr-2 size-4" />
          {t("filters.print")}
        </Button>
      </div>
    </Card>
  );
}
