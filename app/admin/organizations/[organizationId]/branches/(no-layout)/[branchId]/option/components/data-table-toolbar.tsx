"use client";

import { Table } from "@tanstack/react-table";

import { IconX } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { DataTableViewOptions } from "@/components/data-table-view-options";

import { useEffect, useState } from "react";
import { ISection } from "@/src/interfaces/Section";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { getSectionsAction } from "../../section/section.action";
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
  const [sections, setSections] = useState<ISection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const [rawSections, err] = await getSectionsAction();
        if (err) {
          throw new Error("Failed to fetch sections");
        }
        setSections(rawSections);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    fetchSections();
  }, []);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <SearchInput
          placeholder={tClasses(`option.${labelKey}.search`)}
          value={
            (table.getColumn("nameOption")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("nameOption")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("nameSection") && (
          <DataTableFacetedFilter
            column={table.getColumn("nameSection")}
            title={tClasses(`option.${labelKey}.sectionCol`)}
            options={sections.map((section) => ({
              label: section.nameSection,
              value: section.nameSection,
            }))}
            value={
              (table.getColumn("nameSection")?.getFilterValue() as string) ??
              "all"
            }
            onValueChange={(value) =>
              table
                .getColumn("nameSection")
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
            {tCommon("reset")}
            <IconX className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
