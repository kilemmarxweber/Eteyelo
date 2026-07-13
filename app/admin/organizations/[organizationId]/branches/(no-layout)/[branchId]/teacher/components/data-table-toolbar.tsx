"use client";

import { Table } from "@tanstack/react-table";
import { IconSearch, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import type { ITeacher } from "@/src/interfaces/Teacher";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

const assignmentStatuses = [
  { value: "assigned", label: "Affectes" },
  { value: "unassigned", label: "Non affectes" },
];

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "fr"))
    .map((value) => ({ value, label: value }));
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const teachers = table
    .getPreFilteredRowModel()
    .rows.map((row) => row.original as ITeacher);
  const classOptions = uniqueOptions(
    teachers.flatMap((teacher) => teacher.classNames ?? []),
  );
  const courseOptions = uniqueOptions(
    teachers.flatMap((teacher) => teacher.courseNames ?? []),
  );

  return (
    <div className="flex flex-col gap-3 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="relative max-w-3xl">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un enseignant..."
          value={(table.getColumn("nom")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("nom")?.setFilterValue(event.target.value)
          }
          className="h-10 pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {table.getColumn("assignmentStatus") ? (
          <DataTableFacetedFilter
            column={table.getColumn("assignmentStatus")}
            title="Affectation"
            options={assignmentStatuses}
            value="all"
            onValueChange={() => undefined}
          />
        ) : null}
        {classOptions.length > 0 && table.getColumn("classNames") ? (
          <DataTableFacetedFilter
            column={table.getColumn("classNames")}
            title="Classe"
            options={classOptions}
            value="all"
            onValueChange={() => undefined}
          />
        ) : null}
        {courseOptions.length > 0 && table.getColumn("courseNames") ? (
          <DataTableFacetedFilter
            column={table.getColumn("courseNames")}
            title="Cours"
            options={courseOptions}
            value="all"
            onValueChange={() => undefined}
          />
        ) : null}
        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
          >
            Reinitialiser
            <IconX className="ml-2 size-4" />
          </Button>
        ) : null}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
