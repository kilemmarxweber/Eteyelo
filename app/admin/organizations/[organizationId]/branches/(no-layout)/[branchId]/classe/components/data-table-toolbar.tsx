"use client";

import { Table } from "@tanstack/react-table";

import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/data-table-view-options";

import { useEffect, useState } from "react";
import { IOption } from "@/src/interfaces/Option";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { ICreneau } from "@/src/interfaces/creneau";
import { getCreneauxAction } from "../../creneau/creneau.action";
import { getOptionsAction } from "../../option/option.action";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const [options, setOptions] = useState<IOption[]>([]);
  const [creneaux, setCreneaux] = useState<ICreneau[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [rawOptions, err] = await getOptionsAction();
        if (err) {
          throw new Error("Failed to fetch options");
        }
        setOptions(rawOptions);
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };
    const fetchCreneaux = async () => {
      try {
        const [rawCreneaux, err] = await getCreneauxAction();
        if (err) {
          throw err.message;
        }
        setCreneaux(rawCreneaux);
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };
    fetchCreneaux();
    fetchOptions();
  }, []);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="chercher une classe..."
          value={
            (table.getColumn("nameClasse")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("nameClasse")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("nameOption") && (
          <DataTableFacetedFilter
            column={table.getColumn("nameOption")}
            title="Option"
            options={options.map((option) => ({
              label: option.nameOption,
              value: option.nameOption,
            }))}
            value={
              (table.getColumn("nameOption")?.getFilterValue() as string) ??
              "all"
            }
            onValueChange={(value) =>
              table
                .getColumn("nameOption")
                ?.setFilterValue(value === "all" ? "" : value)
            }
          />
        )}
        {table.getColumn("nameCreneau") && (
          <DataTableFacetedFilter
            column={table.getColumn("nameCreneau")}
            title="Vacation"
            options={creneaux.map((creneau) => ({
              label: creneau.nameCreneau,
              value: creneau.nameCreneau,
            }))}
            value={
              (table.getColumn("nameCreneau")?.getFilterValue() as string) ??
              "all"
            }
            onValueChange={(value) =>
              table
                .getColumn("nameCreneau")
                ?.setFilterValue(value === "all" ? "" : value)
            }
          />
        )}

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
