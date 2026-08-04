"use client";

import { Table } from "@tanstack/react-table";
import { IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { useSchoolYearLabels } from "@/hooks/use-school-year-labels";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const { labelLower } = useSchoolYearLabels();
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder={`Rechercher une ${labelLower}…`}
          value={
            (table.getColumn("nameYear")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("nameYear")?.setFilterValue(event.target.value)
          }
          className="h-9 w-full max-w-sm"
        />
        {isFiltered ? (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-9 px-2 lg:px-3"
          >
            Réinitialiser
            <IconX className="ml-2 h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
