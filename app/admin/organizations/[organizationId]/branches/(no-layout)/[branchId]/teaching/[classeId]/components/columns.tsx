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
import { UpdateStudentDialog } from "./edit-Teaching-dialog";
import { ITeaching } from "@/src/interfaces/Teaching";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DeleteTeachingsDialog } from "./delete-Teaching-dialog";

export function useTeachingColumns(): ColumnDef<ITeaching>[] {
  const t = useTranslations("teaching.assignments");
  const tt = useTranslations("teaching.assignments.table");
  const tc = useTranslations("common");
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
            aria-label={tt("selectAll")}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={tt("selectRow")}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "username",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="username" />
        ),
        cell: ({ row }) => row.original.username ?? "N/A",
      },
      {
        accessorKey: "nom",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={tc("person.lastName")}
          />
        ),
        cell: ({ row }) => row.original.nom ?? "N/A",
      },
      {
        accessorKey: "postnom",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tc("person.postnom")} />
        ),
        cell: ({ row }) => row.original.postnom ?? "N/A",
      },
      {
        accessorKey: "prenom",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={tc("person.firstName")}
          />
        ),
        cell: ({ row }) => row.original.prenom ?? "N/A",
      },
      {
        accessorKey: "sexe",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={tc("person.gender")}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <span>{row.original.sexe}</span>
          </div>
        ),
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        accessorKey: "coursId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tt("courseNameColumn")} />
        ),
        cell: ({ row }) => row.original.nameCours ?? "N/A",
      },
      {
        accessorKey: "nameYear",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("schoolYear")} />
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <span>{row.original.nameYear}</span>
          </div>
        ),
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        accessorKey: "createdAt",
        cell: (row) =>
          new Date(row.getValue() as string).toLocaleDateString(locale),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("assignedOn")} />
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
              <UpdateStudentDialog
                open={showUpdateTaskSheet}
                onOpenChange={setShowUpdateTaskSheet}
                teaching={row.original}
              />

              <DeleteTeachingsDialog
                open={showDeleteTaskDialog}
                onOpenChange={setShowDeleteTaskDialog}
                teaches={[row.original]}
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
                    {tc("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setShowDeleteTaskDialog(true)}
                  >
                    {tc("deactivate")}
                    <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          );
        },
      },
    ],
    [locale, t, tc, tt],
  );
}
