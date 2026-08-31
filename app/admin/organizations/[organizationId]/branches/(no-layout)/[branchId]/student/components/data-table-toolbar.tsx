"use client";

import { useMemo, useState } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";
import { IconFileTypePdf, IconSearch, IconUpload } from "@tabler/icons-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/custom/button";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PeopleLabels } from "@/lib/people-labels";
import { DEFAULT_PEOPLE_LABELS } from "@/lib/people-labels";
import type { IStudent } from "@/src/interfaces/Student";
import {
  exportStudentsReportPdf,
  type StudentPdfLabels,
  type StudentReportOptions,
  type StudentReportPeriod,
  type StudentReportSexe,
} from "./export-students-pdf";
import { getStudentReportContextAction } from "../student.action";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  canManageStudents?: boolean;
  requiresImport?: boolean;
  supportsImport?: boolean;
  importScope?: "school_only" | "organization";
  peopleLabels?: PeopleLabels;
  classLabel?: string;
  onOpenImport?: () => void;
  typebranch?: unknown;
  educationSystem?: unknown;
}

function readFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim() && value !== "all") {
    return [value];
  }
  return [];
}

function readPeriodFilter(value: unknown): StudentReportPeriod {
  const values = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? [value]
      : [];
  const period = values[0];
  if (period === "today" || period === "week" || period === "month") {
    return period;
  }
  return "all";
}

function resolveReportOptions(table: Table<unknown>): Omit<
  StudentReportOptions,
  "labels"
> {
  const classFilterValue = table.getColumn("classCode")?.getFilterValue();
  const selectedClassCodes = readFilterValues(classFilterValue);
  const selectedClassCode =
    selectedClassCodes.length === 1 ? selectedClassCodes[0] : null;
  const selectedClassStudent = selectedClassCode
    ? table
        .getPreFilteredRowModel()
        .rows.map((row) => row.original as IStudent)
        .find((student) => student.classCode === selectedClassCode)
    : null;

  const sexeValues = readFilterValues(
    table.getColumn("sexe")?.getFilterValue(),
  );
  const sexe =
    sexeValues.length === 1 && (sexeValues[0] === "M" || sexeValues[0] === "F")
      ? (sexeValues[0] as StudentReportSexe)
      : null;

  const period = readPeriodFilter(
    table.getColumn("registeredPeriod")?.getFilterValue(),
  );

  const selectedYearIds = readFilterValues(
    table.getColumn("schoolYearId")?.getFilterValue(),
  );
  const schoolYears = selectedYearIds.length
    ? Array.from(
        new Map(
          table
            .getPreFilteredRowModel()
            .rows.flatMap((row) => {
              const student = row.original as IStudent;
              const fromEnrollments = (student.enrollments ?? [])
                .filter((enrollment) =>
                  selectedYearIds.includes(enrollment.schoolYearId),
                )
                .map(
                  (enrollment) =>
                    [enrollment.schoolYearId, enrollment.schoolYearName] as const,
                );
              if (fromEnrollments.length) return fromEnrollments;
              if (
                student.schoolYearId &&
                student.schoolYearName &&
                selectedYearIds.includes(student.schoolYearId)
              ) {
                return [[student.schoolYearId, student.schoolYearName] as const];
              }
              return [];
            }),
        ).values(),
      )
    : [];

  const searchRaw = table.getColumn("nom")?.getFilterValue();
  const search =
    typeof searchRaw === "string" && searchRaw.trim() ? searchRaw.trim() : null;

  const selectedClassName =
    selectedClassStudent?.className ||
    selectedClassStudent?.classCode ||
    selectedClassCode;

  return {
    selectedClass: selectedClassCode
      ? {
          code: selectedClassCode,
          name: selectedClassName || selectedClassCode,
        }
      : null,
    sexe,
    period: period === "all" ? null : period,
    schoolYears: schoolYears.length ? schoolYears : null,
    schoolYearIds: selectedYearIds.length ? selectedYearIds : null,
    search,
  };
}

export function DataTableToolbar<TData>({
  table,
  canManageStudents = true,
  requiresImport = false,
  supportsImport = false,
  peopleLabels = DEFAULT_PEOPLE_LABELS,
  classLabel,
  onOpenImport,
  typebranch,
  educationSystem,
}: DataTableToolbarProps<TData>) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const locale = useLocale();
  const t = useTranslations("users.students.table");
  const tPdf = useTranslations("users.students.pdf");
  const tCommon = useTranslations("common");
  const isFiltered = table.getState().columnFilters.length > 0;
  const preFilteredRows = table.getPreFilteredRowModel().rows;
  const selectedYearIds = readFilterValues(
    table.getColumn("schoolYearId")?.getFilterValue(),
  );
  const resolvedClassLabel = classLabel ?? t("class");

  const sexes = useMemo(
    () => [
      { label: t("masculine"), value: "M" },
      { label: t("feminine"), value: "F" },
    ],
    [t],
  );

  const pdfLabels: StudentPdfLabels = useMemo(
    () => ({
      listTitle: tPdf("listTitle", {
        studentsLower: peopleLabels.studentPluralLower,
      }),
      classTitle: tPdf("classTitle", {
        studentsLower: peopleLabels.studentPluralLower,
        className: "{className}",
      }),
      boys: tPdf("boys"),
      girls: tPdf("girls"),
      active: tPdf("active"),
      inactive: tPdf("inactive"),
      unassigned: tPdf("unassigned"),
      periodToday: tPdf("periodToday"),
      periodWeek: tPdf("periodWeek"),
      periodMonth: tPdf("periodMonth"),
      periodAll: tPdf("periodAll"),
      studentCount: tPdf("studentCount", { count: "{count}" }),
      colIndex: tPdf("colIndex"),
      colMatricule: tPdf("colMatricule"),
      colLastName: tPdf("colLastName"),
      colPostnom: tPdf("colPostnom"),
      colFirstName: tPdf("colFirstName"),
      colGender: tPdf("colGender"),
      colAge: tPdf("colAge"),
      colClass: tPdf("colClass"),
      colE13: tPdf("colE13"),
      colE80: tPdf("colE80"),
      colBirthDate: tPdf("colBirthDate"),
      colBirthPlace: tPdf("colBirthPlace"),
      filterPeriod: tPdf("filterPeriod"),
      filterYear: tPdf("filterYear"),
      filterYears: tPdf("filterYears"),
      filterClass: tPdf("filterClass"),
      filterGender: tPdf("filterGender"),
      filterStatus: tPdf("filterStatus"),
      filterSearch: tPdf("filterSearch"),
      locale,
    }),
    [locale, peopleLabels.studentPluralLower, tPdf],
  );

  const classOptions = useMemo(() => {
    const entries = preFilteredRows.flatMap((row) => {
      const student = row.original as IStudent;
      const enrollments = student.enrollments?.length
        ? student.enrollments
        : student.classCode
          ? [
              {
                schoolYearId: student.schoolYearId ?? "",
                schoolYearName: student.schoolYearName ?? "",
                classCode: student.classCode,
                className: student.className ?? null,
              },
            ]
          : [];

      return enrollments
        .filter((enrollment) => {
          if (!enrollment.classCode) return false;
          if (!selectedYearIds.length) return true;
          return selectedYearIds.includes(enrollment.schoolYearId);
        })
        .map(
          (enrollment) =>
            [
              enrollment.classCode as string,
              {
                value: enrollment.classCode as string,
                label: enrollment.className
                  ? `${enrollment.classCode} — ${enrollment.className}`
                  : (enrollment.classCode as string),
              },
            ] as const,
        );
    });

    return Array.from(new Map(entries).values()).sort((left, right) =>
      left.label.localeCompare(right.label, locale),
    );
  }, [locale, preFilteredRows, selectedYearIds]);

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Map(
          preFilteredRows.flatMap((row) => {
            const student = row.original as IStudent;
            const fromEnrollments = (student.enrollments ?? []).map(
              (enrollment) =>
                [
                  enrollment.schoolYearId,
                  {
                    value: enrollment.schoolYearId,
                    label: enrollment.schoolYearName,
                  },
                ] as const,
            );
            if (fromEnrollments.length) return fromEnrollments;
            if (student.schoolYearId && student.schoolYearName) {
              return [
                [
                  student.schoolYearId,
                  {
                    value: student.schoolYearId,
                    label: student.schoolYearName,
                  },
                ] as const,
              ];
            }
            return [];
          }),
        ).values(),
      ).sort((left, right) => right.label.localeCompare(left.label, locale)),
    [locale, preFilteredRows],
  );

  const loadReportPayload = async () => {
    const filteredStudents = table
      .getSortedRowModel()
      .rows.map((row) => row.original as IStudent);
    const options: StudentReportOptions = {
      ...resolveReportOptions(table as Table<unknown>),
      typebranch,
      educationSystem,
      labels: pdfLabels,
    };
    const [context, error] = await getStudentReportContextAction();
    if (error || !context) {
      throw new Error(error?.message || tCommon("errorGeneric"));
    }
    return { filteredStudents, context, options };
  };

  const exportFilteredPdf = async () => {
    setExportingPdf(true);
    try {
      const { filteredStudents, context, options } = await loadReportPayload();
      await exportStudentsReportPdf(filteredStudents, context, options);
      toast.success(
        tPdf("generated", {
          studentsLower: peopleLabels.studentPluralLower,
        }),
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : tPdf("generateFailed"),
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const hasRows = table.getSortedRowModel().rows.length > 0;
  const periodFilter = readPeriodFilter(
    table.getColumn("registeredPeriod")?.getFilterValue(),
  );

  return (
    <div className="flex flex-col gap-3 border-b border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-[300px]">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />

        <Input
          placeholder={t("searchPlaceholder")}
          value={(table.getColumn("nom")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("nom")?.setFilterValue(event.target.value)
          }
          className="h-11 rounded-xl border bg-card pl-9 text-foreground placeholder:text-foreground/40 focus-visible:ring-blue-200"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {table.getColumn("registeredPeriod") ? (
          <Select
            value={periodFilter}
            onValueChange={(value) =>
              table
                .getColumn("registeredPeriod")
                ?.setFilterValue(
                  value === "all" || !value ? undefined : [value],
                )
            }
          >
            <SelectTrigger className="h-8 w-[130px] border-dashed">
              <SelectValue placeholder={t("period")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("periodAll")}</SelectItem>
              <SelectItem value="today">{t("periodToday")}</SelectItem>
              <SelectItem value="week">{t("periodWeek")}</SelectItem>
              <SelectItem value="month">{t("periodMonth")}</SelectItem>
            </SelectContent>
          </Select>
        ) : null}

        {table.getColumn("schoolYearId") && yearOptions.length ? (
          <DataTableFacetedFilter
            column={table.getColumn("schoolYearId")}
            title={t("schoolYear")}
            options={yearOptions}
            value="all"
            onValueChange={() => undefined}
          />
        ) : null}

        {table.getColumn("classCode") && classOptions.length ? (
          <DataTableFacetedFilter
            column={table.getColumn("classCode")}
            title={resolvedClassLabel}
            options={classOptions}
            value="all"
            onValueChange={() => undefined}
          />
        ) : null}

        {table.getColumn("sexe") ? (
          <DataTableFacetedFilter
            column={table.getColumn("sexe")}
            title={tPdf("colGender")}
            options={sexes}
            value={
              (table.getColumn("sexe")?.getFilterValue() as string) ?? "all"
            }
            onValueChange={(value) =>
              table
                .getColumn("sexe")
                ?.setFilterValue(value === "all" ? "" : value)
            }
          />
        ) : null}

        <Button
          variant="outline"
          leftSection={<IconFileTypePdf size={16} />}
          onClick={exportFilteredPdf}
          loading={exportingPdf}
          disabled={!hasRows || exportingPdf}
        >
          {exportingPdf ? tPdf("generating") : t("exportPdf")}
        </Button>

        {isFiltered ? (
          <Button
            variant="outline"
            onClick={() => table.resetColumnFilters()}
            className="h-10 border-border text-primary hover:bg-blue-50 hover:text-blue-800"
          >
            {tCommon("reset")}
            <Cross2Icon className="ml-2 size-4" />
          </Button>
        ) : null}

        {canManageStudents && (requiresImport || supportsImport) ? (
          <Button
            variant={requiresImport ? "default" : "outline"}
            leftSection={<IconUpload size={16} />}
            onClick={() => onOpenImport?.()}
          >
            {t("import")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
