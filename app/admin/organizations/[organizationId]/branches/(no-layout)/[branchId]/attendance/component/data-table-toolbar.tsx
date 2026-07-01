"use client";

import { Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { IconSearch, IconX, IconPlus } from "@tabler/icons-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DataTableViewOptions } from "@/components/data-table-view-options";
import { DateRangePicker } from "@/components/ui/DateRangePicker";

interface Props<TData> {
  table: Table<TData>;
  onAdd?: () => void;
}

export function DataTableToolbar<TData>({ table, onAdd }: Props<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between p-4">
      {/* SEARCH */}
      <div className="relative">
        <IconSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

        <Input
          placeholder="Rechercher..."
          className="pl-9 w-full lg:w-[280px]"
          value={(table.getColumn("cours")?.getFilterValue() as string) ?? ""}
          onChange={(e) =>
            table.getColumn("cours")?.setFilterValue(e.target.value)
          }
        />
      </div>

      {/* RIGHT FILTERS */}
      <div className="flex flex-wrap items-center gap-2">
        {/* TYPE */}
        <Select
          onValueChange={(value) =>
            table
              .getColumn("type")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="personnel">Personnel</SelectItem>
          </SelectContent>
        </Select>

        {/* STATUS */}
        <Select
          onValueChange={(value) =>
            table
              .getColumn("isClosed")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="false">Ouverte</SelectItem>
            <SelectItem value="true">Fermée</SelectItem>
          </SelectContent>
        </Select>

        {/* DATE RANGE (GOOGLE FLIGHTS STYLE) */}
        <DateRangePicker table={table} />

        {/* RESET */}
        {isFiltered && (
          <Button variant="outline" onClick={() => table.resetColumnFilters()}>
            <IconX className="mr-2 h-4 w-4" />
            Reset
          </Button>
        )}

        {/* ADD
        <Button onClick={onAdd}>
          <IconPlus className="mr-2 h-4 w-4" />
          Ajouter
        </Button> */}

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
