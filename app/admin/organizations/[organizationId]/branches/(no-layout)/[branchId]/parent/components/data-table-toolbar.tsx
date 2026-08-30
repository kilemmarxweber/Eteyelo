"use client";

import { useMemo, useState } from "react";
import type { Table } from "@tanstack/react-table";
import { IconFileTypePdf, IconSearch, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/custom/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import type { IParent } from "@/src/interfaces/Parent";

import { getParentReportContextAction } from "../parent.action";
import {
  applyParentArchiveFilter,
  exportParentsReportPdf,
  type ParentPdfLabels,
  type ParentReportOptions,
  type ParentSexeFilter,
  type ParentStatusFilter,
} from "./export-parents-pdf";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

function readFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim() && value !== "all") {
    return [value];
  }
  return [];
}

function resolveReportOptions(table: Table<unknown>): Omit<
  ParentReportOptions,
  "labels"
> {
  const sexeValues = readFilterValues(table.getColumn("sexe")?.getFilterValue());
  const statusValues = readFilterValues(
    table.getColumn("statusUser")?.getFilterValue(),
  );

  const sexeRaw = sexeValues.length === 1 ? sexeValues[0] : null;
  const sexe =
    sexeRaw === "masculin" ||
    sexeRaw === "feminin" ||
    sexeRaw === "M" ||
    sexeRaw === "F"
      ? (sexeRaw as ParentSexeFilter)
      : null;

  const statusRaw = statusValues.length === 1 ? statusValues[0] : null;
  const status =
    statusRaw === "active" || statusRaw === "archived"
      ? (statusRaw as ParentStatusFilter)
      : null;

  return { sexe, status };
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const t = useTranslations("users.parents.table");
  const tPdf = useTranslations("users.parents.pdf");
  const tCommon = useTranslations("common");
  const tPerson = useTranslations("common.person");
  const isFiltered = table.getState().columnFilters.length > 0;
  const hasRows = table.getFilteredRowModel().rows.length > 0;

  const sexeOptions = useMemo(
    () => [
      { value: "masculin", label: tPdf("masculine") },
      { value: "feminin", label: tPdf("feminine") },
    ],
    [tPdf],
  );

  const statusOptions = useMemo(
    () => [
      { value: "active", label: tPdf("activePlural") },
      { value: "archived", label: tPdf("archivedPlural") },
    ],
    [tPdf],
  );

  const pdfLabels: ParentPdfLabels = useMemo(
    () => ({
      listTitle: tPdf("listTitle"),
      activePlural: tPdf("activePlural"),
      archivedPlural: tPdf("archivedPlural"),
      masculine: tPdf("masculine"),
      feminine: tPdf("feminine"),
      none: tCommon("none"),
      colIndex: "#",
      colParentName: tPdf("colParentName"),
      colContact: tPdf("colContact"),
      colChildrenDetail: tPdf("colChildrenDetail"),
      parentCount: tPdf("parentCount", { count: "{count}" }),
      filterGender: tPdf("filterGender"),
      filterStatus: tPdf("filterStatus"),
    }),
    [tCommon, tPdf],
  );

  const exportFilteredPdf = async () => {
    setExportingPdf(true);
    try {
      const baseOptions = resolveReportOptions(table as Table<unknown>);
      const options: ParentReportOptions = { ...baseOptions, labels: pdfLabels };
      const filteredParents = applyParentArchiveFilter(
        table
          .getFilteredRowModel()
          .rows.map((row) => row.original as IParent),
        options.status,
      );

      if (filteredParents.length === 0) {
        throw new Error(tPdf("emptyExport"));
      }

      const [context, error] = await getParentReportContextAction();
      if (error || !context) {
        throw new Error(error?.message || tCommon("errorGeneric"));
      }
      await exportParentsReportPdf(filteredParents, context, options);
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
    <div className="flex flex-col gap-3 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="relative max-w-3xl">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={(table.getColumn("nom")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("nom")?.setFilterValue(event.target.value)
          }
          className="h-10 pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {table.getColumn("sexe") ? (
          <DataTableFacetedFilter
            column={table.getColumn("sexe")}
            title={tPerson("gender")}
            options={sexeOptions}
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

        {table.getColumn("statusUser") ? (
          <DataTableFacetedFilter
            column={table.getColumn("statusUser")}
            title={tCommon("status")}
            options={statusOptions}
            value={
              (table.getColumn("statusUser")?.getFilterValue() as string) ??
              "all"
            }
            onValueChange={(value) =>
              table
                .getColumn("statusUser")
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

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
