"use client";

import { Cross2Icon } from "@radix-ui/react-icons";
import { IconSearch } from "@tabler/icons-react";
import type { Table } from "@tanstack/react-table";

import { Button } from "@/components/custom/button";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { Input } from "@/components/ui/input";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-col gap-3 border-b border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-[300px]">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <Input
          placeholder="Rechercher un cours..."
          value={
            (table.getColumn("nameCours")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("nameCours")?.setFilterValue(event.target.value)
          }
          className="h-11 rounded-xl border bg-card pl-9 text-foreground placeholder:text-foreground/40 focus-visible:ring-blue-200"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {table.getColumn("statusCours") ? (
          <DataTableFacetedFilter
            column={table.getColumn("statusCours")}
            title="Statut"
            options={[
              { label: "Actif", value: "active" },
              { label: "Inactif", value: "inactive" },
            ]}
            value={
              (table.getColumn("statusCours")?.getFilterValue() as string) ??
              "all"
            }
            onValueChange={(value) =>
              table
                .getColumn("statusCours")
                ?.setFilterValue(value === "all" ? "" : value)
            }
          />
        ) : null}

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
