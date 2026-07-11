"use client";

import { ColumnDef } from "@tanstack/react-table";
import { IconArrowUp, IconDots } from "@tabler/icons-react";
import { Button } from "@/components/custom/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteSchoolYearsDialog } from "./delete-SchoolYear-dialog";
import { UpdateSchoolYearDialog } from "./edit-SchoolYear-dialog";
import React from "react";
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Switch } from "@/components/ui/switch";
import { CurrentYear } from "./currentYear";

export const columns: ColumnDef<ISchoolYear>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
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
    accessorKey: "nameYear",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Denomination de l'année" />
    ),
    cell: ({ row }) => {
      return row.original.nameYear;
    }, 
  },
  {
    accessorKey: "startYear",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date de la rentrée" />
    ),
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
  },
  {
    accessorKey: "endYear",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date de la fin de l'année" />
    ),
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
  },
  {
    accessorKey: "isCurrentYear",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Année en cours" />
    ),
    cell: ({ row }) => {
      return (
        <CurrentYear
          id={row.original.id}
          nameYear={row.original.nameYear}
          startYear={row.original.startYear}
          endYear={row.original.endYear}
          isCurrentYear={row.original.isCurrentYear}
          branchId={row.original.branchId}
          //refetchData={() => fetchSchoolYears()}
        />
      );
    },
  },
  {
    accessorKey: "createdAt",
    cell: (row) => new Date(row.getValue() as string).toLocaleDateString(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ajoutée le " />
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
          {/* Dialogue ou feuille pour l'édition */}
          <UpdateSchoolYearDialog
            open={showUpdateTaskSheet}
            onOpenChange={setShowUpdateTaskSheet}
            schoolYear={row.original} 
            branchId={row.original.branchId}// Passerlesdonnéesactuellesdel'élèveonSuccess={() => row.toggleSelected(false)}
            onSuccess={() => {
              row.toggleSelected(false);
              setShowUpdateTaskSheet(false);
            }}
          />

          <DeleteSchoolYearsDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
            SchoolYears={[row.original]}
            showTrigger={false}
            onSuccess={() => {
              row.toggleSelected(false);
              setShowDeleteTaskDialog(false);
            }}
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
              {/* Ajout de l'option Edit */}
              <DropdownMenuItem onSelect={() => setShowUpdateTaskSheet(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setShowDeleteTaskDialog(true)}>
                Clôturer
                <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      );
    },
  },
];
