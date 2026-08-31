"use client";

import { Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { DataTableViewOptions } from "@/components/data-table-view-options";

import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { useEffect, useState } from "react";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { getSchoolYearsAction } from "../../../schoolYear/schoolYear.action";
import { useSession } from "@/lib/auth-client";
import { getCurrentSchoolYearName } from "@/lib/school-year-utils";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const t = useTranslations("teaching.assignments");
  const tc = useTranslations("common");
  const isFiltered = table.getState().columnFilters.length > 0;
  const [schoolYears, setSchoolYears] = useState<ISchoolYear[]>([]);
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
        const currentYearName = getCurrentSchoolYearName(rawSchoolYears);
        const nameYearColumn = table.getColumn("nameYear");
        if (currentYearName && nameYearColumn && !nameYearColumn.getFilterValue()) {
          nameYearColumn.setFilterValue(currentYearName);
        }
      } catch (error) {
        // ignore
      }
    };

    fetchSchoolYears();
  }, [branchId, table]);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <SearchInput
          placeholder={t("searchTeacher")}
          value={
            (table.getColumn("username")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("username")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("nameYear") && (
          <DataTableFacetedFilter
            column={table.getColumn("nameYear")}
            title={t("schoolYear")}
            options={schoolYears.map((year) => ({
              label: year.nameYear,
              value: year.nameYear,
            }))}
            value={
              (table.getColumn("nameYear")?.getFilterValue() as string) ?? "all"
            }
            onValueChange={(value) =>
              table
                .getColumn("nameYear")
                ?.setFilterValue(value === "all" ? "" : value)
            }
          />
        )}
        <div></div>
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            {tc("reset")}
            <IconX className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
