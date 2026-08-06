"use client";

import { Table } from "@tanstack/react-table";
import { IconSearch, IconX } from "@tabler/icons-react";

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
  const nameColumn = table.getColumn("nameYear");
  const filterValue = (nameColumn?.getFilterValue() as string) ?? "";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 max-w-5xl">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Rechercher une ${labelLower}…`}
            value={filterValue}
            onChange={(event) =>
              nameColumn?.setFilterValue(event.target.value)
            }
            className="h-9 pl-8"
          />
        </div>
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
