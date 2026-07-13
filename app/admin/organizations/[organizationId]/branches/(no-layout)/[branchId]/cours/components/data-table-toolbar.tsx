"use client";

import { Table } from "@tanstack/react-table";

import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/data-table-view-options"

import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

/* const sexe = [
  {
    value: "masculin",
    label: "masculin",
  },
  {
    value: "feminin",
    label: "Feminin",
  },
]; */
export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  // Fonction de transformation

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="chercher un cours..."
          value={
            (table.getColumn("nameCours")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("nameCours")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("statusCours") && (
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
        )}
        {/* {table.getColumn("nameYear") && (
          <DataTableFacetedFilter
            column={table.getColumn("nameYear")}
            title="Année scolaire"
            options={schoolYears.map((year) => ({
              label: year.nameYear,
              value: year.nameYear,
            }))}
            value={
              (table.getColumn("nameYear")?.getFilterValue() as string) ?? "all"
            }
            onValueChange={(value) =>
              table
                .getColumn("nameYear")
                ?.setFilterValue(value === "all" ? "" : value)
            }
          />
        )}
        {table.getColumn("sexe") && (
          <DataTableFacetedFilter
            column={table.getColumn("sexe")}
            title="Sexe"
            options={sexe}
            value={
              (table.getColumn("sexe")?.getFilterValue() as string) ?? "all"
            }
            onValueChange={(value) =>
              table
                .getColumn("sexe")
                ?.setFilterValue(value === "all" ? "" : value)
            }
          />
        )} */}
        
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <IconX className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
