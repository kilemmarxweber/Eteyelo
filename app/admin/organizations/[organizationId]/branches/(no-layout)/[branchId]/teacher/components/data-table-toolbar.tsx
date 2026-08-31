"use client";

import { useMemo, useState } from "react";
import { Table } from "@tanstack/react-table";
import { IconFileTypePdf, IconSearch, IconUpload, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/custom/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import type { ITeacher } from "@/src/interfaces/Teacher";
import type { PeopleLabels } from "@/lib/people-labels";
import { cycleLabel, type SchoolCycle } from "@/lib/cycle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  exportTeachersReportPdf,
  type TeacherAssignmentStatus,
  type TeacherPdfLabels,
  type TeacherReportOptions,
} from "./export-teachers-pdf";
import { getTeacherReportContextAction } from "../teacher.action";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  canManageTeachers?: boolean;
  supportsStaffImport?: boolean;
  onOpenImport?: () => void;
  peopleLabels?: PeopleLabels;
  cycles?: SchoolCycle[];
  cycleFilter?: "all" | SchoolCycle;
  onCycleFilterChange?: (cycle: "all" | SchoolCycle) => void;
}

function uniqueOptions(values: string[], locale: string) {
  return Array.from(new Set(values))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, locale))
    .map((value) => ({ value, label: value }));
}

function readFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim() && value !== "all") {
    return [value];
  }
  return [];
}

function resolveReportOptions(
  table: Table<unknown>,
): Omit<TeacherReportOptions, "labels"> {
  const assignmentValues = readFilterValues(
    table.getColumn("assignmentStatus")?.getFilterValue(),
  );
  const assignmentStatus =
    assignmentValues.length === 1 &&
    (assignmentValues[0] === "assigned" ||
      assignmentValues[0] === "unassigned")
      ? (assignmentValues[0] as TeacherAssignmentStatus)
      : null;

  return {
    assignmentStatus,
    classNames: readFilterValues(table.getColumn("classNames")?.getFilterValue()),
    courseNames: readFilterValues(
      table.getColumn("courseNames")?.getFilterValue(),
    ),
  };
}

export function DataTableToolbar<TData>({
  table,
  canManageTeachers = false,
  supportsStaffImport = false,
  onOpenImport,
  peopleLabels,
  cycles = [],
  cycleFilter = "all",
  onCycleFilterChange,
}: DataTableToolbarProps<TData>) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const locale = useLocale();
  const t = useTranslations("users.teachers.table");
  const tPdf = useTranslations("users.teachers.pdf");
  const tCommon = useTranslations("common");
  const isFiltered = table.getState().columnFilters.length > 0;

  const assignmentStatuses = useMemo(
    () => [
      { value: "assigned", label: t("assigned") },
      { value: "unassigned", label: t("unassigned") },
    ],
    [t],
  );

  const pdfLabels: TeacherPdfLabels = useMemo(
    () => ({
      listTitle: tPdf("listTitle", {
        teachersLower: peopleLabels?.teacherPluralLower ?? "",
      }),
      assignedPlural: t("assigned"),
      unassignedPlural: t("unassigned"),
      assigned: t("assigned"),
      unassigned: t("unassigned"),
      active: tCommon("active"),
      inactive: tCommon("inactive"),
      none: tCommon("none"),
      colIndex: "#",
      colName: tPdf("colLastName"),
      colContact: tPdf("colPhone"),
      colClasses: tPdf("colClasses"),
      colCourses: tPdf("colCourses"),
      colStatus: t("status"),
      teacherCount: tPdf("teacherCount", { count: "{count}" }),
      classPrefix: t("classes"),
      classesCount: t("classes"),
      coursesCount: t("courses"),
      filterAssignment: t("assignment"),
      filterClass: t("classes"),
      filterClasses: t("classes"),
      filterCourse: t("courses"),
      filterCourses: t("courses"),
    }),
    [t, tPdf, tCommon, peopleLabels?.teacherPluralLower],
  );

  const teachers = table
    .getPreFilteredRowModel()
    .rows.map((row) => row.original as ITeacher);
  const classOptions = uniqueOptions(
    teachers.flatMap((teacher) => teacher.classNames ?? []),
    locale,
  );
  const courseOptions = uniqueOptions(
    teachers.flatMap((teacher) => teacher.courseNames ?? []),
    locale,
  );
  const hasRows = table.getFilteredRowModel().rows.length > 0;

  const exportFilteredPdf = async () => {
    setExportingPdf(true);
    try {
      const filteredTeachers = table
        .getFilteredRowModel()
        .rows.map((row) => row.original as ITeacher);
      const options: TeacherReportOptions = {
        ...resolveReportOptions(table as Table<unknown>),
        labels: pdfLabels,
      };
      const [context, error] = await getTeacherReportContextAction();
      if (error || !context) {
        throw new Error(error?.message || tCommon("errorGeneric"));
      }
      await exportTeachersReportPdf(filteredTeachers, context, options);
      toast.success(
        tPdf("generated", {
          teachersLower: peopleLabels?.teacherPluralLower ?? "",
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
        {cycles.length > 0 ? (
          <Select
            value={cycleFilter}
            onValueChange={(value) =>
              onCycleFilterChange?.(value as "all" | SchoolCycle)
            }
          >
            <SelectTrigger className="h-8 w-[170px]">
              <SelectValue placeholder={tCommon("all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon("all")}</SelectItem>
              {cycles.map((cycle) => (
                <SelectItem key={cycle} value={cycle}>
                  {cycleLabel(cycle)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {table.getColumn("assignmentStatus") ? (
          <DataTableFacetedFilter
            column={table.getColumn("assignmentStatus")}
            title={t("assignment")}
            options={assignmentStatuses}
            value="all"
            onValueChange={() => undefined}
          />
        ) : null}
        {classOptions.length > 0 && table.getColumn("classNames") ? (
          <DataTableFacetedFilter
            column={table.getColumn("classNames")}
            title={t("classes")}
            options={classOptions}
            value="all"
            onValueChange={() => undefined}
          />
        ) : null}
        {courseOptions.length > 0 && table.getColumn("courseNames") ? (
          <DataTableFacetedFilter
            column={table.getColumn("courseNames")}
            title={t("courses")}
            options={courseOptions}
            value="all"
            onValueChange={() => undefined}
          />
        ) : null}
        <Button
          variant="outline"
          leftSection={<IconFileTypePdf size={16} />}
          onClick={exportFilteredPdf}
          loading={exportingPdf}
          disabled={!hasRows || exportingPdf}
        >
          {exportingPdf ? tCommon("loading") : t("exportPdf")}
        </Button>
        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
          >
            {tCommon("reset")}
            <IconX className="ml-2 size-4" />
          </Button>
        ) : null}
        {canManageTeachers && supportsStaffImport ? (
          <Button
            variant="outline"
            size="sm"
            leftSection={<IconUpload size={16} />}
            onClick={() => onOpenImport?.()}
          >
            {t("import")}
          </Button>
        ) : null}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
