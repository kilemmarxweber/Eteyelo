"use client";

import { Table } from "@tanstack/react-table";

import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/data-table-view-options";

import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { useEffect, useState } from "react";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { getSchoolYearsAction } from "../../schoolYear/schoolYear.action";
import { useSession } from "@/lib/auth-client";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const [schoolYears, setSchoolYears] = useState<ISchoolYear[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        if (!branchId) return;
        const [rawSchoolYears, err] = await getSchoolYearsAction({ branchId });
        if (err) {
          throw new Error("Failed to fetch schoolYears");
        }
        setSchoolYears(rawSchoolYears);
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };

    fetchSchoolYears();
  }, [branchId]);

  // Fonction de transformation

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="chercher une section..."
          value={
            (table.getColumn("nameSection")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("nameSection")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
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
