"use client";

import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
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
import { DeleteCreneausDialog } from "./delete-Creneau-dialog";
import { UpdateCreneauDialog } from "./edit-Creneau-dialog";
import { ICreneau } from "@/src/interfaces/creneau";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { formatCreneauWorkingDaysLabel } from "@/lib/creneau-working-days";

export function useCreneauColumns(): ColumnDef<ICreneau>[] {
  const t = useTranslations("teaching.vacation");
  const tc = useTranslations("teaching.vacation.columns");
  const tf = useTranslations("teaching.vacation.form");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  return React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "nameCreneau",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columnName")} />
        ),
        cell: ({ row }) => row.original.nameCreneau,
      },
      {
        accessorKey: "startTime",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tf("start")} />
        ),
        cell: ({ row }) => row.original.startTime,
      },
      {
        accessorKey: "endTime",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tf("end")} />
        ),
        cell: ({ row }) => row.original.endTime,
      },
      {
        accessorKey: "durationCourse",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tc("duration")} />
        ),
        cell: ({ row }) => <span>{row.original.durationCourse} min</span>,
      },
      {
        id: "workingDays",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tf("workingDays")} />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatCreneauWorkingDaysLabel(row.original.workingDays)}
          </span>
        ),
      },
      {
        accessorKey: "recreationHour",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tc("recreation")} />
        ),
        cell: ({ row }) => row.original.recreationHour,
      },
      {
        accessorKey: "recreationDuration",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={tc("recreationDuration")}
          />
        ),
        cell: ({ row }) => (
          <span>{row.original.recreationDuration} min</span>
        ),
      },
      {
        accessorKey: "createdAt",
        cell: (row) =>
          new Date(row.getValue() as string).toLocaleDateString(locale),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tc("addedOn")} />
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
              <UpdateCreneauDialog
                open={showUpdateTaskSheet}
                onOpenChange={setShowUpdateTaskSheet}
                creneau={row.original}
              />

              <DeleteCreneausDialog
                open={showDeleteTaskDialog}
                onOpenChange={setShowDeleteTaskDialog}
                Creneaus={[row.original]}
                showTrigger={false}
                onSuccess={() => row.toggleSelected(false)}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="Open menu"
                    variant="ghost"
                    className="flex size-8 p-0 data-[state= open]:bg-muted"
                  >
                    <IconDots className="size-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onSelect={() => setShowUpdateTaskSheet(true)}
                  >
                    {tCommon("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setShowDeleteTaskDialog(true)}
                  >
                    {tCommon("archive")}
                    <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          );
        },
      },
    ],
    [locale, t, tc, tf, tCommon],
  );
}

/** @deprecated Use useCreneauColumns() instead */
export const columns: ColumnDef<ICreneau>[] = [];
