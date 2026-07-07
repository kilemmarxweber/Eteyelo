"use client";

import { Cross2Icon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";
import {
  IconFilter,
  IconKey,
  IconSearch,
  IconUpload,
} from "@tabler/icons-react";

import { Button } from "@/components/custom/button";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { Input } from "@/components/ui/input";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  canManageStudents?: boolean;
}

const sexes = [
  {
    label: "Masculin",
    value: "M",
  },
  {
    label: "Féminin",
    value: "F",
  },
];

export function DataTableToolbar<TData>({
  table,
  canManageStudents = true,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-col gap-3 border-b border-blue-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-[300px]">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-blue-950/40" />

        <Input
          placeholder="Rechercher par nom ou matricule..."
          value={(table.getColumn("nom")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("nom")?.setFilterValue(event.target.value)
          }
          className="h-11 rounded-xl border-blue-100 bg-white pl-9 text-blue-950 placeholder:text-blue-950/40 focus-visible:ring-blue-200"
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

        {isFiltered ? (
          <Button
            variant="outline"
            onClick={() => table.resetColumnFilters()}
            className="h-10 border-blue-100 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          >
            Réinitialiser
            <Cross2Icon className="ml-2 size-4" />
          </Button>
        ) : null}

        {canManageStudents ? (
          <>
            <Button variant="outline" leftSection={<IconUpload size={16} />}>
              Importer
            </Button>

            <Button variant="outline" leftSection={<IconKey size={16} />}>
              Générer logins
            </Button>
          </>
        ) : null}

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
