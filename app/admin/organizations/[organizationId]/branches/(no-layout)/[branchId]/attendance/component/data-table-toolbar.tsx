"use client";

import { useMemo } from "react";
import { Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { IconSearch, IconX } from "@tabler/icons-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DataTableViewOptions } from "@/components/data-table-view-options";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import type { AttendanceSessionRow } from "../interface/Attendance";

interface Props<TData> {
  table: Table<TData>;
  onAdd?: () => void;
}

function normalizeType(value: unknown) {
  return String(value ?? "").toLowerCase();
}

export function DataTableToolbar<TData>({ table }: Props<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const typeFilter =
    (table.getColumn("type")?.getFilterValue() as string | undefined) ?? "all";
  const statusFilter =
    (table.getColumn("isClosed")?.getFilterValue() as string | undefined) ??
    "all";
  const classeFilter =
    (table.getColumn("classe")?.getFilterValue() as string | undefined) ??
    "all";
  const isStudent = typeFilter === "student";

  const classeOptions = useMemo(() => {
    const rows = table.options.data as AttendanceSessionRow[];
    const values = new Set<string>();
    for (const row of rows) {
      if (normalizeType(row.type) !== "student") continue;
      const classe = row.classe?.trim();
      if (classe && classe !== "-") values.add(classe);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "fr"));
  }, [table.options.data]);

  return (
    <div className="flex flex-col gap-3 border-b bg-card p-4">
      <div className="relative w-full min-w-0 max-w-4xl">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un nom, cours ou classe..."
          className="h-10 w-full pl-9"
          value={(table.getColumn("nom")?.getFilterValue() as string) ?? ""}
          onChange={(e) =>
            table.getColumn("nom")?.setFilterValue(e.target.value)
          }
        />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select
          value={typeFilter}
          onValueChange={(value) => {
            table
              .getColumn("type")
              ?.setFilterValue(value === "all" ? undefined : value);
            if (value !== "student") {
              table.getColumn("classe")?.setFilterValue(undefined);
            }
          }}
        >
          <SelectTrigger className="h-10 w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="teacher">Enseignant</SelectItem>
            <SelectItem value="student">Élève</SelectItem>
            <SelectItem value="personnel">Personnel</SelectItem>
          </SelectContent>
        </Select>

        {isStudent ? (
          <Select
            value={classeFilter}
            onValueChange={(value) =>
              table
                .getColumn("classe")
                ?.setFilterValue(value === "all" ? undefined : value)
            }
          >
            <SelectTrigger className="h-10 w-[180px]">
              <SelectValue placeholder="Classe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classeOptions.map((classe) => (
                <SelectItem key={classe} value={classe}>
                  {classe}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Select
          value={statusFilter}
          onValueChange={(value) =>
            table
              .getColumn("isClosed")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="h-10 w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="false">Ouverte</SelectItem>
            <SelectItem value="true">Fermée</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker table={table} />

        {isFiltered ? (
          <Button
            variant="outline"
            className="h-10"
            onClick={() => table.resetColumnFilters()}
          >
            <IconX className="mr-2 size-4" />
            Reset
          </Button>
        ) : null}

        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
