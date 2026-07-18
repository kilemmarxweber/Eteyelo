"use client";

import { useState } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { IconFileTypePdf, IconFilter, IconSearch } from "@tabler/icons-react";
import type { Table } from "@tanstack/react-table";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { Input } from "@/components/ui/input";
import type { IPersonnel } from "@/src/interfaces/Personnel";

import { getPersonnelReportContextAction } from "../personnel.action";
import {
  exportPersonnelReportPdf,
  type PersonnelReportOptions,
  type PersonnelSexeFilter,
} from "./export-personnel-pdf";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  canManagePersonnel?: boolean;
}

const sexes = [
  { label: "Masculin", value: "M" },
  { label: "Féminin", value: "F" },
];

function readFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim() && value !== "all") {
    return [value];
  }
  return [];
}

function resolveReportOptions(table: Table<unknown>): PersonnelReportOptions {
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
}: DataTableToolbarProps<TData>) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const isFiltered = table.getState().columnFilters.length > 0;
  const hasRows = table.getFilteredRowModel().rows.length > 0;

  const exportFilteredPdf = async () => {
    setExportingPdf(true);
    try {
      const filteredPersonnels = table
        .getFilteredRowModel()
        .rows.map((row) => row.original as IPersonnel);
      const options = resolveReportOptions(table as Table<unknown>);
      const [context, error] = await getPersonnelReportContextAction();
      if (error || !context) {
        throw new Error(
          error?.message || "Impossible de charger les informations du rapport.",
        );
      }
      await exportPersonnelReportPdf(filteredPersonnels, context, options);
      toast.success("Le rapport PDF du personnel a été généré.");
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
    <div className="flex flex-col gap-3 border-b border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-[300px]">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />

        <Input
          placeholder="Rechercher par nom, prénom ou postnom..."
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
            title="Sexe"
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
          Filtres
        </Button>

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
            variant="outline"
            onClick={() => table.resetColumnFilters()}
            className="h-10 border-border text-primary hover:bg-blue-50 hover:text-blue-800"
          >
            Réinitialiser
            <Cross2Icon className="ml-2 size-4" />
          </Button>
        ) : null}

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
