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
import { DeleteOptionsDialog } from "./delete-Option-dialog";
import { UpdateOptionDialog } from "./edit-Option-dialog";
import React from "react";
import { IOption } from "@/src/interfaces/Option";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import type { TrainingLabelKey } from "@/lib/training-labels";

export function useOptionColumns(labelKey: TrainingLabelKey = "school") {
  const tClasses = useTranslations("classes");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const tOption = (key: string) => tClasses(`option.${labelKey}.${key}`);

  const columns: ColumnDef<IOption>[] = [
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
      accessorKey: "codeOption",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tOption("codeCol")} />
      ),
      cell: ({ row }) => {
        return row.original.codeOption;
      },
    },
    {
      accessorKey: "nameOption",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tOption("name")} />
      ),
      cell: ({ row }) => {
        return row.original.nameOption;
      },
    },
    {
      accessorKey: "nameSection",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tOption("sectionCol")} />
      ),
      cell: ({ row }) => {
        return row.original?.codeSection;
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "createdAt",
      cell: (row) =>
        new Date(row.getValue() as string).toLocaleDateString(locale),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={tCommon("createdOnFeminine")}
        />
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
            <UpdateOptionDialog
              open={showUpdateTaskSheet}
              onOpenChange={setShowUpdateTaskSheet}
              option={row.original}
              labelKey={labelKey}
            />

            <DeleteOptionsDialog
              open={showDeleteTaskDialog}
              onOpenChange={setShowDeleteTaskDialog}
              Options={[row.original]}
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

/** @deprecated Use useOptionColumns() hook instead */
export const columns: ColumnDef<IOption>[] = [];
