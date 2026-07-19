"use client";

import { useState } from "react";
import type { Table } from "@tanstack/react-table";
import { IconFileTypePdf, IconSearch, IconX } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import type { IParent } from "@/src/interfaces/Parent";

import { getParentReportContextAction } from "../parent.action";
import {
  applyParentArchiveFilter,
  exportParentsReportPdf,
  type ParentReportOptions,
  type ParentSexeFilter,
  type ParentStatusFilter,
} from "./export-parents-pdf";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

const sexeOptions = [
  { value: "masculin", label: "Masculin" },
  { value: "feminin", label: "Féminin" },
];

const statusOptions = [
  { value: "active", label: "Actifs" },
  { value: "archived", label: "Archivés" },
];

function readFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim() && value !== "all") {
    return [value];
  }
  return [];
}

function resolveReportOptions(table: Table<unknown>): ParentReportOptions {
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
  const isFiltered = table.getState().columnFilters.length > 0;
  const hasRows = table.getFilteredRowModel().rows.length > 0;

  const exportFilteredPdf = async () => {
    setExportingPdf(true);
    try {
      const options = resolveReportOptions(table as Table<unknown>);
      const filteredParents = applyParentArchiveFilter(
        table
          .getFilteredRowModel()
          .rows.map((row) => row.original as IParent),
        options.status,
      );

      if (filteredParents.length === 0) {
        throw new Error("Aucun parent à exporter avec les filtres actuels.");
      }

      const [context, error] = await getParentReportContextAction();
      if (error || !context) {
        throw new Error(
          error?.message || "Impossible de charger les informations du rapport.",
        );
      }
      await exportParentsReportPdf(filteredParents, context, options);
      toast.success("Le rapport PDF des parents a été généré.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de générer le rapport PDF.",
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
          placeholder="Chercher un parent..."
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
            title="Sexe"
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
            title="Statut"
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
          {exportingPdf ? "Génération..." : "Rapport PDF"}
        </Button>

        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
          >
            Réinitialiser
            <IconX className="ml-2 size-4" />
          </Button>
        ) : null}

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
