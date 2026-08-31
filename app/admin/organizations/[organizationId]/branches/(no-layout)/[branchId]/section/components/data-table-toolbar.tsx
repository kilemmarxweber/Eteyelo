"use client";

import { Table } from "@tanstack/react-table";

import { IconX } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { DataTableViewOptions } from "@/components/data-table-view-options";

import { useEffect, useState } from "react";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { getSchoolYearsAction } from "../../schoolYear/schoolYear.action";
import { useSession } from "@/lib/auth-client";
import type { TrainingLabelKey } from "@/lib/training-labels";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  labelKey?: TrainingLabelKey;
}

export function DataTableToolbar<TData>({
  table,
  labelKey = "school",
}: DataTableToolbarProps<TData>) {
  const tClasses = useTranslations("classes");
  const tCommon = useTranslations("common");
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
      } catch {
        setLoading(false);
      }
    };

    fetchSchoolYears();
  }, [branchId]);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <SearchInput
          placeholder={tClasses(`section.${labelKey}.search`)}
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
            {tCommon("reset")}
            <IconX className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
