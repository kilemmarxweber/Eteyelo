"use client";

import { useMemo, useState } from "react";
import { Table } from "@tanstack/react-table";
import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/data-table-view-options";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const [searchValue, setSearchValue] = useState("");
  const isFiltered =
    table.getState().columnFilters.length > 0 || searchValue.length > 0;

  const getOptions = (columnId: string) =>
    Array.from(table.getColumn(columnId)?.getFacetedUniqueValues().keys() ?? [])
      .filter((value): value is string => typeof value === "string" && Boolean(value))
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((value) => ({ label: value, value }));

  const classOptions = useMemo(() => getOptions("className"), [table]);
  const periodOptions = useMemo(() => getOptions("periodName"), [table]);
  const subjectOptions = useMemo(() => getOptions("subjectName"), [table]);
  const yearOptions = useMemo(() => getOptions("anneeName"), [table]);
  const statusOptions = useMemo(() => getOptions("uiStatus"), [table]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
    table.getColumn("className")?.setFilterValue(value);
    table.getColumn("periodName")?.setFilterValue(value);
    table.getColumn("subjectName")?.setFilterValue(value);
    table.getColumn("anneeName")?.setFilterValue(value);
  };

  const resetFilters = () => {
    setSearchValue("");
    table.resetColumnFilters();
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder="Rechercher par classe, période, cours, année..."
          value={searchValue}
          onChange={(event) => handleSearch(event.target.value)}
          className="h-8 w-full sm:w-[220px] lg:w-[320px]"
        />

        {table.getColumn("className") && (
          <DataTableFacetedFilter
            column={table.getColumn("className")}
            title="Classe"
            options={classOptions}
            value="all"
            onValueChange={() => {}}
          />
        )}

        {table.getColumn("periodName") && (
          <DataTableFacetedFilter
            column={table.getColumn("periodName")}
            title="Période"
            options={periodOptions}
            value="all"
            onValueChange={() => {}}
          />
        )}

        {table.getColumn("subjectName") && (
          <DataTableFacetedFilter
            column={table.getColumn("subjectName")}
            title="Cours"
            options={subjectOptions}
            value="all"
            onValueChange={() => {}}
          />
        )}

        {table.getColumn("anneeName") && (
          <DataTableFacetedFilter
            column={table.getColumn("anneeName")}
            title="Année"
            options={yearOptions}
            value="all"
            onValueChange={() => {}}
          />
        )}

        {table.getColumn("uiStatus") && (
          <DataTableFacetedFilter
            column={table.getColumn("uiStatus")}
            title="Statut"
            options={statusOptions}
            value="all"
            onValueChange={() => {}}
          />
        )}

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={resetFilters}
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
