"use client";

import { ColumnDef } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/custom/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteSectionsDialog } from "./delete-Section-dialog";
import { UpdateSectionDialog } from "./edit-Section-dialog";
import React from "react";
import { ISection } from "@/src/interfaces/Section";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import type { TrainingLabelKey } from "@/lib/training-labels";

export function useSectionColumns(labelKey: TrainingLabelKey = "school") {
  const tClasses = useTranslations("classes");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const tSection = (key: string) => tClasses(`section.${labelKey}.${key}`);

  const columns: ColumnDef<ISection>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={tCommon("selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={tCommon("selectRow")}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "codeSection",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tSection("codeCol")} />
      ),
      cell: ({ row }) => {
        return row.original.codeSection;
      },
    },
    {
      accessorKey: "nameSection",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tSection("name")} />
      ),
      cell: ({ row }) => {
        return row.original.nameSection;
      },
    },
    {
      accessorKey: "createdAt",
      cell: (row) =>
        new Date(row.getValue() as string).toLocaleDateString(locale),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tCommon("addedOn")} />
      ),
    },
    {
      id: "actions",
      cell: function Cell({ row }) {
        const [showUpdateTaskSheet, setShowUpdateTaskSheet] =
          React.useState(false);
        const [showDeleteTaskDialog, setShowDeleteTaskDialog] =
          React.useState(false);

        return (
          <>
            <UpdateSectionDialog
              open={showUpdateTaskSheet}
              onOpenChange={setShowUpdateTaskSheet}
              section={row.original}
              labelKey={labelKey}
            />

            <DeleteSectionsDialog
              open={showDeleteTaskDialog}
              onOpenChange={setShowDeleteTaskDialog}
              Sections={[row.original]}
              showTrigger={false}
              labelKey={labelKey}
              onSuccess={() => row.toggleSelected(false)}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={tCommon("openMenu")}
                  variant="ghost"
                  className="flex size-8 p-0 data-[state= open]:bg-muted"
                >
                  <IconDots className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onSelect={() => setShowUpdateTaskSheet(true)}>
                  {tCommon("edit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setShowDeleteTaskDialog(true)}>
                  {tCommon("archive")}
                  <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        );
      },
    },
  ];

  return columns;
}

/** @deprecated Use useSectionColumns() hook instead */
export const columns: ColumnDef<ISection>[] = [];
