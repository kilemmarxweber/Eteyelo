"use client";

import { useMemo, useState } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { IconFileTypePdf, IconFilter, IconSearch, IconUpload } from "@tabler/icons-react";
import type { Table } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/custom/button";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { Input } from "@/components/ui/input";
import type { IPersonnel } from "@/src/interfaces/Personnel";

import { getPersonnelReportContextAction } from "../personnel.action";
import {
  exportPersonnelReportPdf,
  type PersonnelPdfLabels,
  type PersonnelReportOptions,
  type PersonnelSexeFilter,
} from "./export-personnel-pdf";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  canManagePersonnel?: boolean;
  supportsStaffImport?: boolean;
  onOpenImport?: () => void;
}

function readFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim() && value !== "all") {
    return [value];
  }
  return [];
}

function resolveReportOptions(table: Table<unknown>): Omit<
  PersonnelReportOptions,
  "labels"
> {
  const sexeValues = readFilterValues(table.getColumn("sexe")?.getFilterValue());
  const sexe =
    sexeValues.length === 1 &&
    (sexeValues[0] === "M" || sexeValues[0] === "F")
      ? (sexeValues[0] as PersonnelSexeFilter)
      : null;

  return { sexe };
}

export function DataTableToolbar<TData>({
  table,
  canManagePersonnel = false,
  supportsStaffImport = false,
  onOpenImport,
}: DataTableToolbarProps<TData>) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const t = useTranslations("users.staff.table");
  const tPdf = useTranslations("users.staff.pdf");
  const tCommon = useTranslations("common");
  const tPerson = useTranslations("common.person");
  const isFiltered = table.getState().columnFilters.length > 0;
  const hasRows = table.getFilteredRowModel().rows.length > 0;

  const sexes = useMemo(
    () => [
      { label: tPdf("masculine"), value: "M" },
      { label: tPdf("feminine"), value: "F" },
    ],
    [tPdf],
  );

  const pdfLabels: PersonnelPdfLabels = useMemo(
    () => ({
      listTitle: tPdf("listTitle"),
      masculine: tPdf("masculine"),
      feminine: tPdf("feminine"),
      active: tCommon("active"),
      inactive: tCommon("inactive"),
      roleUndefined: tPdf("roleUndefined"),
      colIndex: "#",
      colIdentity: tPdf("colIdentity"),
      colFunction: tPdf("colFunction"),
      colStatus: tPdf("colStatus"),
      colContact: tPdf("colContact"),
      personnelCount: tPdf("personnelCount", { count: "{count}" }),
      filterGender: tPdf("filterGender"),
    }),
    [tCommon, tPdf],
  );

  const exportFilteredPdf = async () => {
    setExportingPdf(true);
    try {
      const filteredPersonnels = table
        .getFilteredRowModel()
        .rows.map((row) => row.original as IPersonnel);
      const options: PersonnelReportOptions = {
        ...resolveReportOptions(table as Table<unknown>),
        labels: pdfLabels,
      };
      const [context, error] = await getPersonnelReportContextAction();
      if (error || !context) {
        throw new Error(error?.message || tCommon("errorGeneric"));
      }
      await exportPersonnelReportPdf(filteredPersonnels, context, options);
      toast.success(tPdf("generated"));
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
        {table.getColumn("sexe") ? (
          <DataTableFacetedFilter
            column={table.getColumn("sexe")}
            title={tPerson("gender")}
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

        <Button variant="outline" leftSection={<IconFilter size={16} />}>
          {t("filters")}
        </Button>

        {canManagePersonnel && supportsStaffImport ? (
          <Button
            variant="outline"
            leftSection={<IconUpload size={16} />}
            onClick={() => onOpenImport?.()}
          >
            {t("import")}
          </Button>
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
            variant="outline"
            onClick={() => table.resetColumnFilters()}
            className="h-10 border-border text-primary hover:bg-blue-50 hover:text-blue-800"
          >
            {tCommon("reset")}
            <Cross2Icon className="ml-2 size-4" />
          </Button>
        ) : null}

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
